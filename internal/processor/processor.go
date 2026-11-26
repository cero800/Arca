// Package processor convierte un original en los derivados que usa la web.
package processor

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/cero800/Arca/internal/keys"
	"github.com/cero800/Arca/internal/media"
	"github.com/cero800/Arca/internal/storage"
	"github.com/cero800/Arca/internal/store"
)

type Processor struct {
	store   *store.Store
	storage *storage.Client
	tools   *media.Tools
	tempDir string
}

func New(s *store.Store, c *storage.Client, t *media.Tools, tempDir string) *Processor {
	return &Processor{store: s, storage: c, tools: t, tempDir: tempDir}
}

func (p *Processor) Process(ctx context.Context, asset *store.Asset) (store.Result, error) {
	started := time.Now()

	dir, err := os.MkdirTemp(p.tempDir, "arca-job-*")
	if err != nil {
		return store.Result{}, err
	}
	defer os.RemoveAll(dir)

	original := filepath.Join(dir, "original")
	if err := p.storage.Download(ctx, asset.StorageKey, original); err != nil {
		return store.Result{}, err
	}

	var result store.Result
	switch asset.Kind {
	case "image":
		result, err = p.image(ctx, asset, original)
	case "video":
		result, err = p.video(ctx, asset, original)
	case "audio":
		result, err = p.audio(ctx, asset, original)
	case "pdf":
		result, err = p.pdf(ctx, asset, original)
	case "text":
		result, err = p.text(ctx, asset, original)
	default:
		result = store.Result{Metrics: map[string]any{"skipped": true}}
	}
	if err != nil {
		return store.Result{}, err
	}

	if result.Metrics == nil {
		result.Metrics = map[string]any{}
	}
	result.Metrics["elapsedMs"] = time.Since(started).Milliseconds()
	result.Metrics["kind"] = asset.Kind
	result.Metrics["originalBytes"] = asset.Size

	return result, nil
}

func (p *Processor) image(ctx context.Context, asset *store.Asset, original string) (store.Result, error) {
	result := store.Result{Metrics: map[string]any{}}

	if info, err := p.tools.Probe(ctx, original); err == nil {
		if info.Width > 0 {
			result.Width = &info.Width
		}
		if info.Height > 0 {
			result.Height = &info.Height
		}
	}

	thumbPath := filepath.Join(filepath.Dir(original), "thumb.webp")
	if err := p.tools.Image(ctx, original, thumbPath, 480); err != nil {
		return store.Result{}, err
	}
	derivative, err := p.upload(ctx, asset, keys.Thumb(asset.VaultID, asset.ID), thumbPath, "thumb", nil)
	if err != nil {
		return store.Result{}, err
	}
	result.Derivatives = append(result.Derivatives, derivative)

	previewPath := filepath.Join(filepath.Dir(original), "preview.webp")
	if err := p.tools.Image(ctx, original, previewPath, 1600); err != nil {
		return store.Result{}, err
	}
	derivative, err = p.upload(ctx, asset, keys.Preview(asset.VaultID, asset.ID), previewPath, "preview", nil)
	if err != nil {
		return store.Result{}, err
	}
	result.Derivatives = append(result.Derivatives, derivative)

	return result, nil
}

func (p *Processor) video(ctx context.Context, asset *store.Asset, original string) (store.Result, error) {
	result := store.Result{Metrics: map[string]any{}}

	if info, err := p.tools.Probe(ctx, original); err == nil {
		if info.Width > 0 {
			result.Width = &info.Width
		}
		if info.Height > 0 {
			result.Height = &info.Height
		}
		if info.DurationMS > 0 {
			duration := int(info.DurationMS)
			result.DurationMS = &duration
		}
	}

	dir := filepath.Dir(original)

	posterPath := filepath.Join(dir, "poster.webp")
	if err := p.tools.VideoPoster(ctx, original, posterPath, 1280); err != nil {
		return store.Result{}, err
	}
	derivative, err := p.upload(ctx, asset, keys.Poster(asset.VaultID, asset.ID), posterPath, "poster", nil)
	if err != nil {
		return store.Result{}, err
	}
	result.Derivatives = append(result.Derivatives, derivative)

	thumbPath := filepath.Join(dir, "thumb.webp")
	if err := p.tools.Image(ctx, posterPath, thumbPath, 480); err != nil {
		return store.Result{}, err
	}
	derivative, err = p.upload(ctx, asset, keys.Thumb(asset.VaultID, asset.ID), thumbPath, "thumb", nil)
	if err != nil {
		return store.Result{}, err
	}
	result.Derivatives = append(result.Derivatives, derivative)

	if result.DurationMS != nil && *result.DurationMS > 0 {
		storyboard, storyboardErr := p.tools.Storyboard(ctx, original, dir, int64(*result.DurationMS))
		if storyboardErr != nil {
			// El storyboard es opcional: si falla, el video sigue siendo usable.
			result.Metrics["storyboardError"] = storyboardErr.Error()
		} else {
			derivative, err = p.upload(
				ctx, asset, keys.Storyboard(asset.VaultID, asset.ID),
				storyboard.SpritePath, "storyboard", nil,
			)
			if err != nil {
				return store.Result{}, err
			}
			width, height := storyboard.Width, storyboard.Height
			derivative.Width = &width
			derivative.Height = &height
			derivative.Meta = storyboardMeta(storyboard.Plan, width, height)
			result.Derivatives = append(result.Derivatives, derivative)

			vttKey := keys.StoryboardVTT(asset.VaultID, asset.ID)
			if err := p.storage.PutBytes(ctx, vttKey, storyboard.VTT, keys.MediaType(vttKey)); err != nil {
				return store.Result{}, err
			}
			result.Derivatives = append(result.Derivatives, store.Derivative{
				Type: "storyboard_vtt",
				Key:  vttKey,
				Size: int64(len(storyboard.VTT)),
				Meta: storyboardMeta(storyboard.Plan, width, height),
			})

			result.Metrics["storyboardTiles"] = storyboard.Plan.Tiles
			result.Metrics["storyboardIntervalMs"] = storyboard.Plan.IntervalMS
		}
	}

	hlsDir := filepath.Join(dir, "hls")
	if _, err := p.tools.HLS(ctx, original, hlsDir); err != nil {
		return store.Result{}, err
	}

	files, err := filepath.Glob(filepath.Join(hlsDir, "*"))
	if err != nil {
		return store.Result{}, err
	}
	sort.Strings(files)

	var totalBytes int64
	for _, file := range files {
		name := filepath.Base(file)
		key := keys.HLS(asset.VaultID, asset.ID, name)
		if err := p.storage.UploadFile(ctx, key, file, keys.MediaType(name)); err != nil {
			return store.Result{}, err
		}
		info, statErr := os.Stat(file)
		if statErr == nil {
			totalBytes += info.Size()
		}
	}

	result.Derivatives = append(result.Derivatives, store.Derivative{
		Type: "hls",
		Key:  keys.HLS(asset.VaultID, asset.ID, "master.m3u8"),
		Size: totalBytes,
		Meta: map[string]any{
			"segmentCount": len(files) - 2,
			"bytes":        totalBytes,
			"maxHeight":    720,
			"format":       "fmp4",
		},
	})
	result.Metrics["hlsBytes"] = totalBytes
	result.Metrics["hlsFiles"] = len(files)

	return result, nil
}

func (p *Processor) audio(ctx context.Context, asset *store.Asset, original string) (store.Result, error) {
	result := store.Result{Metrics: map[string]any{}}

	if info, err := p.tools.Probe(ctx, original); err == nil && info.DurationMS > 0 {
		duration := int(info.DurationMS)
		result.DurationMS = &duration
	}

	wavePath := filepath.Join(filepath.Dir(original), "audio-wave.webp")
	if err := p.tools.AudioWave(ctx, original, wavePath); err != nil {
		return store.Result{}, err
	}
	derivative, err := p.upload(ctx, asset, keys.AudioWave(asset.VaultID, asset.ID), wavePath, "audio_wave", nil)
	if err != nil {
		return store.Result{}, err
	}
	result.Derivatives = append(result.Derivatives, derivative)
	return result, nil
}

func (p *Processor) pdf(ctx context.Context, asset *store.Asset, original string) (store.Result, error) {
	result := store.Result{Metrics: map[string]any{}}

	dir := filepath.Join(filepath.Dir(original), "pdf")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return store.Result{}, err
	}

	pages, err := p.tools.PDFPages(ctx, original, dir, 5)
	if err != nil {
		return store.Result{}, err
	}

	for index, page := range pages {
		name := fmt.Sprintf("pdf/page-%d.jpg", index+1)
		derivative, err := p.upload(ctx, asset, keys.Derivative(asset.VaultID, asset.ID, name), page, "pdf_page", nil)
		if err != nil {
			return store.Result{}, err
		}
		derivative.Meta = map[string]any{"page": index + 1}
		result.Derivatives = append(result.Derivatives, derivative)
	}

	result.Metrics["pages"] = len(pages)
	return result, nil
}

func (p *Processor) text(ctx context.Context, asset *store.Asset, original string) (store.Result, error) {
	body, truncated, err := media.TextPreview(original, 1024*1024)
	if err != nil {
		return store.Result{}, err
	}

	key := keys.Text(asset.VaultID, asset.ID)
	if err := p.storage.PutBytes(ctx, key, body, "text/plain; charset=utf-8"); err != nil {
		return store.Result{}, err
	}

	return store.Result{
		Derivatives: []store.Derivative{{
			Type: "text",
			Key:  key,
			Size: int64(len(body)),
			Meta: map[string]any{"truncated": truncated},
		}},
		Metrics: map[string]any{"truncated": truncated},
	}, nil
}

func storyboardMeta(plan media.StoryboardPlan, width, height int) map[string]any {
	return map[string]any{
		"columns":    media.StoryboardColumns,
		"rows":       media.StoryboardRows,
		"tileWidth":  media.StoryboardTileWidth,
		"tileHeight": media.StoryboardTileHeight,
		"tiles":      plan.Tiles,
		"intervalMs": plan.IntervalMS,
		"width":      width,
		"height":     height,
	}
}

func (p *Processor) upload(
	ctx context.Context,
	asset *store.Asset,
	key, path, derivativeType string,
	sizeOverride *int64,
) (store.Derivative, error) {
	info, err := os.Stat(path)
	if err != nil {
		return store.Derivative{}, err
	}

	if err := p.storage.UploadFile(ctx, key, path, keys.MediaType(path)); err != nil {
		return store.Derivative{}, err
	}

	size := info.Size()
	if sizeOverride != nil {
		size = *sizeOverride
	}

	return store.Derivative{
		Type: derivativeType,
		Key:  key,
		Size: size,
	}, nil
}
