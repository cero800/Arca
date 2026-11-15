// arca es la CLI operativa de Arca: salud, cola y reintentos.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/silver/arca/internal/config"
	"github.com/silver/arca/internal/storage"
	"github.com/silver/arca/internal/store"
)

const usage = `arca — CLI de Arca

Uso:
  arca health
  arca jobs list [pending|processing|done|error] [límite]
  arca jobs retry <asset-id>
  arca stats
  arca put <baúl> <archivo...>
  arca pull <baúl> <destino>

Variables: DATABASE_URL, S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_KEY, S3_SECRET.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Print(usage)
		os.Exit(1)
	}

	timeout := 60 * time.Second
	if os.Args[1] == "put" || os.Args[1] == "pull" {
		timeout = 6 * time.Hour
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cfg, err := config.Load()
	if err != nil {
		fail(err)
	}

	switch os.Args[1] {
	case "health":
		health(ctx, cfg)
	case "jobs":
		jobs(ctx, cfg)
	case "stats":
		stats(ctx, cfg)
	case "put":
		put(ctx, cfg, os.Args[2:])
	case "pull":
		pull(ctx, cfg, os.Args[2:])
	case "help", "-h", "--help":
		fmt.Print(usage)
	default:
		fmt.Print(usage)
		os.Exit(1)
	}
}

func jobs(ctx context.Context, cfg config.Config) {
	if len(os.Args) < 3 || os.Args[2] != "list" {
		if len(os.Args) >= 4 && os.Args[2] == "retry" {
			retry(ctx, cfg, os.Args[3])
			return
		}
		fmt.Println("Uso: arca jobs list [status] [límite] | arca jobs retry <asset-id>")
		os.Exit(1)
	}

	status := ""
	if len(os.Args) >= 4 {
		status = strings.ToLower(os.Args[3])
	}
	limit := 50
	if len(os.Args) >= 5 {
		_, _ = fmt.Sscanf(os.Args[4], "%d", &limit)
	}

	st := open(ctx, cfg)
	defer st.Close()

	rows, err := st.ListJobs(ctx, status, limit)
	if err != nil {
		fail(err)
	}
	printJSON(rows)
}

func retry(ctx context.Context, cfg config.Config, assetID string) {
	st := open(ctx, cfg)
	defer st.Close()

	affected, err := st.RetryAsset(ctx, assetID)
	if err != nil {
		fail(err)
	}
	fmt.Printf("Reintentos programados: %d job(s) para %s\n", affected, assetID)
}

func stats(ctx context.Context, cfg config.Config) {
	st := open(ctx, cfg)
	defer st.Close()

	result, err := st.Stats(ctx)
	if err != nil {
		fail(err)
	}
	printJSON(result)
}

func health(ctx context.Context, cfg config.Config) {
	report := map[string]any{"database": "ok", "storage": "skipped"}

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		report["database"] = err.Error()
	} else {
		defer st.Close()
		if err := st.Ping(ctx); err != nil {
			report["database"] = err.Error()
		}
	}

	if cfg.StorageReady() {
		objects, err := storage.New(ctx, cfg)
		if err != nil {
			report["storage"] = err.Error()
		} else if err := objects.Health(ctx); err != nil {
			report["storage"] = err.Error()
		} else {
			report["storage"] = "ok"
		}
	}

	printJSON(report)
	if report["database"] != "ok" {
		os.Exit(1)
	}
}

func open(ctx context.Context, cfg config.Config) *store.Store {
	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		fail(err)
	}
	return st
}

func printJSON(value any) {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		fail(err)
	}
	fmt.Println(string(encoded))
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "arca:", err)
	os.Exit(1)
}
