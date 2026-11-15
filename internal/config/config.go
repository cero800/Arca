// Package config carga la configuración del worker y la CLI desde el entorno.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string

	S3Endpoint     string
	S3Region       string
	S3Bucket       string
	S3Key          string
	S3Secret       string
	S3ForcePath    bool
	StorageTimeout time.Duration

	MaxAttempts       int
	Lease             time.Duration
	Poll              time.Duration
	JobTimeout        time.Duration
	TempDir           string
	MaxFileBytes      int64
	StorageQuotaBytes int64

	FFmpeg   string
	FFprobe  string
	PDFToPPM string
}

// Load lee .env (si existe) y luego el entorno del proceso.
func Load() (Config, error) {
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")

	cfg := Config{
		DatabaseURL: firstEnv("DATABASE_URL_DIRECT", "DATABASE_URL"),
		S3Endpoint:  os.Getenv("S3_ENDPOINT"),
		S3Region:    envOr("S3_REGION", "us-east-1"),
		S3Bucket:    envOr("S3_BUCKET", "arca-media"),
		S3Key:       os.Getenv("S3_KEY"),
		S3Secret:    os.Getenv("S3_SECRET"),
		S3ForcePath: envBool("S3_FORCE_PATH_STYLE", true),

		StorageTimeout:    time.Duration(envInt("STORAGE_TIMEOUT_SECONDS", 900)) * time.Second,
		MaxAttempts:       envInt("WORKER_MAX_ATTEMPTS", 3),
		Lease:             time.Duration(envInt("WORKER_LEASE_SECONDS", 1800)) * time.Second,
		Poll:              time.Duration(envInt("WORKER_POLL_SECONDS", 10)) * time.Second,
		JobTimeout:        time.Duration(envInt("WORKER_JOB_TIMEOUT_SECONDS", 1500)) * time.Second,
		TempDir:           envOr("WORKER_TMP", os.TempDir()),
		MaxFileBytes:      envInt64("MAX_FILE_BYTES", 1024*1024*1024),
		StorageQuotaBytes: envInt64("STORAGE_QUOTA_BYTES", 10*1024*1024*1024),
		FFmpeg:            envOr("FFMPEG_PATH", "ffmpeg"),
		FFprobe:           envOr("FFPROBE_PATH", "ffprobe"),
		PDFToPPM:          envOr("PDFTOPPM_PATH", "pdftoppm"),
	}

	if strings.TrimSpace(cfg.DatabaseURL) == "" {
		return Config{}, fmt.Errorf("falta DATABASE_URL (o DATABASE_URL_DIRECT)")
	}

	return cfg, nil
}

func (c Config) StorageReady() bool {
	return c.S3Endpoint != "" && c.S3Key != "" && c.S3Secret != ""
}

func firstEnv(names ...string) string {
	for _, name := range names {
		if value := strings.TrimSpace(os.Getenv(name)); value != "" {
			return value
		}
	}
	return ""
}

func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func envInt(name string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func envInt64(name string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func envBool(name string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(name)))
	if value == "" {
		return fallback
	}
	return value == "1" || value == "true" || value == "yes"
}
