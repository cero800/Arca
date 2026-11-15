// Package media envuelve ffmpeg, ffprobe y pdftoppm.
package media

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/silver/arca/internal/config"
)

const (
	StoryboardColumns    = 10
	StoryboardRows       = 10
	StoryboardTileWidth  = 160
	StoryboardTileHeight = 90
	StoryboardMaxTiles   = StoryboardColumns * StoryboardRows
)

type Tools struct {
	ffmpeg   string
	ffprobe  string
	pdftoppm string
}

type Info struct {
	Width      int
	Height     int
	DurationMS int64
}

func New(cfg config.Config) *Tools {
	return &Tools{ffmpeg: cfg.FFmpeg, ffprobe: cfg.FFprobe, pdftoppm: cfg.PDFToPPM}
}

func (t *Tools) Probe(ctx context.Context, path string) (Info, error) {
	out, err := exec.CommandContext(ctx, t.ffprobe,
		"-v", "error",
		"-show_entries", "stream=width,height:format=duration",
		"-of", "json",
		path,
	).Output()
	if err != nil {
		return Info{}, fmt.Errorf("ffprobe falló: %w", err)
	}
	return parseProbe(out)
}

func parseProbe(out []byte) (Info, error) {
	var payload struct {
		Streams []struct {
			Width  int `json:"width"`
			Height int `json:"height"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}

	if err := json.Unmarshal(out, &payload); err != nil {
		return Info{}, fmt.Errorf("ffprobe devolvió JSON inválido: %w", err)
	}

	info := Info{}
	if len(payload.Streams) > 0 {
		info.Width = payload.Streams[0].Width
		info.Height = payload.Streams[0].Height
	}
	if seconds, err := strconv.ParseFloat(payload.Format.Duration, 64); err == nil {
		info.DurationMS = int64(seconds * 1000)
	}
	return info, nil
}

func (t *Tools) Image(ctx context.Context, src, dst string, width int) error {
	filter := fmt.Sprintf("scale=w=min(%d\\,iw):h=-2", width)
	return t.run(ctx, t.ffmpeg,
		"-y", "-hide_banner", "-loglevel", "error",
		"-i", src,
		"-vf", filter,
		"-frames:v", "1",
		"-c:v", "libwebp", "-quality", "82",
		dst,
	)
}

func (t *Tools) VideoPoster(ctx context.Context, src, dst string, width int) error {
	filter := fmt.Sprintf("scale=w=min(%d\\,iw):h=-2", width)
	err := t.run(ctx, t.ffmpeg,
		"-y", "-hide_banner", "-loglevel", "error",
		"-ss", "1", "-i", src,
		"-frames:v", "1",
		"-vf", filter,
		"-c:v", "libwebp", "-quality", "82",
		dst,
	)
	if err == nil {
		return nil
	}

	return t.run(ctx, t.ffmpeg,
		"-y", "-hide_banner", "-loglevel", "error",
		"-i", src,
		"-frames:v", "1",
		"-vf", filter,
		"-c:v", "libwebp", "-quality", "82",
		dst,
	)
}

// HLS genera un master VOD 720p en fMP4 con segmentos de 4 s.
func (t *Tools) HLS(ctx context.Context, src, dir string) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}

	master := filepath.Join(dir, "master.m3u8")
	err := t.run(ctx, t.ffmpeg,
		"-y", "-hide_banner", "-loglevel", "error",
		"-i", src,
		"-map", "0:v:0",
		"-map", "0:a:0?",
		"-vf", "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
		"-profile:v", "high", "-pix_fmt", "yuv420p",
		"-c:a", "aac", "-b:a", "128k", "-ac", "2",
		"-hls_time", "4",
		"-hls_playlist_type", "vod",
		"-hls_segment_type", "fmp4",
		"-hls_fmp4_init_filename", "init.mp4",
		"-hls_segment_filename", filepath.Join(dir, "seg_%04d.m4s"),
		master,
	)
	if err != nil {
		return "", err
	}
	return master, nil
}

// StoryboardPlan describe cuántos fotogramas caben en la grilla y cada cuánto.
type StoryboardPlan struct {
	IntervalMS int64
	Tiles      int
}

type Storyboard struct {
	SpritePath string
	VTT        []byte
	Width      int
	Height     int
	Plan       StoryboardPlan
}

// PlanStoryboard reparte la duración en como mucho 100 miniaturas.
// Para videos cortos usa 1 segundo; para largos, una fracción proporcional.
func PlanStoryboard(durationMS int64) StoryboardPlan {
	if durationMS <= 0 {
		return StoryboardPlan{}
	}

	seconds := float64(durationMS) / 1000
	interval := seconds / StoryboardMaxTiles
	if interval < 1 {
		interval = 1
	}

	intervalMS := int64(math.Round(interval * 1000))
	if intervalMS < 1000 {
		intervalMS = 1000
	}

	tiles := int(math.Ceil(float64(durationMS) / float64(intervalMS)))
	if tiles < 1 {
		tiles = 1
	}
	if tiles > StoryboardMaxTiles {
		tiles = StoryboardMaxTiles
	}

	return StoryboardPlan{IntervalMS: intervalMS, Tiles: tiles}
}

// BuildStoryboardVTT genera los cues que apuntan a cada celda del sprite.
func BuildStoryboardVTT(plan StoryboardPlan, durationMS int64) []byte {
	var body strings.Builder
	body.WriteString("WEBVTT\n\n")

	for index := 0; index < plan.Tiles; index++ {
		start := int64(index) * plan.IntervalMS
		end := start + plan.IntervalMS
		if end > durationMS {
			end = durationMS
		}
		if end <= start {
			continue
		}

		column := index % StoryboardColumns
		row := index / StoryboardColumns
		fmt.Fprintf(
			&body,
			"%s --> %s\nstoryboard.webp#xywh=%d,%d,%d,%d\n\n",
			formatVTTTime(start),
			formatVTTTime(end),
			column*StoryboardTileWidth,
			row*StoryboardTileHeight,
			StoryboardTileWidth,
			StoryboardTileHeight,
		)
	}

	return []byte(body.String())
}

// Storyboard extrae una grilla 10x10 de miniaturas y su VTT.
func (t *Tools) Storyboard(ctx context.Context, src, dir string, durationMS int64) (Storyboard, error) {
	plan := PlanStoryboard(durationMS)
	if plan.Tiles == 0 {
		return Storyboard{}, fmt.Errorf("el video no tiene duración para generar el storyboard")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return Storyboard{}, err
	}

	sprite := filepath.Join(dir, "storyboard.webp")
	interval := strconv.FormatFloat(float64(plan.IntervalMS)/1000, 'f', 3, 64)
	filter := fmt.Sprintf(
		"fps=1/%s,scale=%d:%d:force_original_aspect_ratio=decrease,"+
			"pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=black,tile=%dx%d",
		interval,
		StoryboardTileWidth, StoryboardTileHeight,
		StoryboardTileWidth, StoryboardTileHeight,
		StoryboardColumns, StoryboardRows,
	)

	err := t.run(ctx, t.ffmpeg,
		"-y", "-hide_banner", "-loglevel", "error",
		"-i", src,
		"-an",
		"-vf", filter,
		"-frames:v", "1",
		"-c:v", "libwebp", "-quality", "80",
		sprite,
	)
	if err != nil {
		return Storyboard{}, err
	}

	return Storyboard{
		SpritePath: sprite,
		VTT:        BuildStoryboardVTT(plan, durationMS),
		Width:      StoryboardColumns * StoryboardTileWidth,
		Height:     StoryboardRows * StoryboardTileHeight,
		Plan:       plan,
	}, nil
}

func formatVTTTime(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	hours := ms / 3_600_000
	ms %= 3_600_000
	minutes := ms / 60_000
	ms %= 60_000
	seconds := ms / 1000
	millis := ms % 1000
	return fmt.Sprintf("%02d:%02d:%02d.%03d", hours, minutes, seconds, millis)
}

func (t *Tools) AudioWave(ctx context.Context, src, dst string) error {
	return t.run(ctx, t.ffmpeg,
		"-y", "-hide_banner", "-loglevel", "error",
		"-i", src,
		"-filter_complex", "showwavespic=s=1200x160:colors=#4C8DFF",
		"-frames:v", "1",
		"-c:v", "libwebp", "-quality", "85",
		dst,
	)
}

// PDFPages rasteriza hasta maxPages páginas y devuelve los archivos generados.
func (t *Tools) PDFPages(ctx context.Context, src, dir string, maxPages int) ([]string, error) {
	prefix := filepath.Join(dir, "page")
	err := t.run(ctx, t.pdftoppm,
		"-jpeg", "-jpegopt", "quality=82", "-r", "96",
		"-f", "1", "-l", strconv.Itoa(maxPages),
		src, prefix,
	)
	if err != nil {
		return nil, err
	}

	matches, err := filepath.Glob(prefix + "*.jpg")
	if err != nil {
		return nil, err
	}
	sort.Strings(matches)
	return matches, nil
}

// TextPreview devuelve hasta maxBytes del archivo como UTF-8 tolerante.
func TextPreview(path string, maxBytes int64) ([]byte, bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, false, err
	}
	defer file.Close()

	body, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return nil, false, err
	}

	truncated := int64(len(body)) > maxBytes
	if truncated {
		body = body[:maxBytes]
	}
	return body, truncated, nil
}

func (t *Tools) run(ctx context.Context, name string, args ...string) error {
	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("%s falló: %w: %s", filepath.Base(name), err, tail(stderr.String(), 1200))
	}
	return nil
}

func tail(value string, limit int) string {
	value = strings.TrimSpace(value)
	if len(value) <= limit {
		return value
	}
	return "…" + value[len(value)-limit:]
}
