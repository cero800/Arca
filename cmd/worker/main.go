// arca-worker procesa la cola de Postgres y genera derivados en B2.
package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/silver/arca/internal/config"
	"github.com/silver/arca/internal/media"
	"github.com/silver/arca/internal/processor"
	"github.com/silver/arca/internal/storage"
	"github.com/silver/arca/internal/store"
)

func main() {
	once := flag.Bool("once", false, "drena la cola y termina (útil en GitHub Actions)")
	interval := flag.Duration("interval", 0, "intervalo de sondeo (sobrescribe WORKER_POLL_SECONDS)")
	flag.Parse()

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("configuración inválida", "error", err)
		os.Exit(1)
	}
	if !cfg.StorageReady() {
		logger.Error("faltan credenciales de storage (S3_ENDPOINT, S3_KEY, S3_SECRET)")
		os.Exit(1)
	}
	if *interval > 0 {
		cfg.Poll = *interval
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	st, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("no se pudo abrir Postgres", "error", err)
		os.Exit(1)
	}
	defer st.Close()

	objects, err := storage.New(ctx, cfg)
	if err != nil {
		logger.Error("no se pudo crear el cliente S3", "error", err)
		os.Exit(1)
	}

	if recovered, err := st.RecoverStale(ctx); err != nil {
		logger.Warn("no se pudieron recuperar leases vencidos", "error", err)
	} else if recovered > 0 {
		logger.Info("leases recuperados", "jobs", recovered)
	}

	tools := media.New(cfg)
	proc := processor.New(st, objects, tools, cfg.TempDir)

	logger.Info("worker listo", "once", *once, "poll", cfg.Poll.String(), "maxAttempts", cfg.MaxAttempts)

	for {
		job, claimErr := st.Claim(ctx, cfg.Lease)
		if errors.Is(claimErr, store.ErrNoJob) {
			if *once {
				logger.Info("cola vacía; saliendo")
				return
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(cfg.Poll):
				continue
			}
		}
		if claimErr != nil {
			if ctx.Err() != nil {
				return
			}
			logger.Error("no se pudo tomar un job", "error", claimErr)
			select {
			case <-ctx.Done():
				return
			case <-time.After(cfg.Poll):
				continue
			}
		}

		runJob(ctx, cfg, st, proc, job, logger)
	}
}

func runJob(
	ctx context.Context,
	cfg config.Config,
	st *store.Store,
	proc *processor.Processor,
	job *store.Job,
	logger *slog.Logger,
) {
	log := logger.With("job", job.ID, "asset", job.AssetID, "attempt", job.Attempts)

	asset, err := st.GetAsset(ctx, job.AssetID)
	if err != nil {
		log.Error("asset no encontrado", "error", err)
		_ = st.Fail(ctx, *job, "asset no encontrado", cfg.MaxAttempts)
		return
	}

	jobCtx, cancel := context.WithTimeout(ctx, cfg.JobTimeout)
	defer cancel()

	started := time.Now()
	result, err := proc.Process(jobCtx, asset)
	if err != nil {
		log.Error("procesamiento falló", "error", err, "elapsed", time.Since(started).String())
		if failErr := st.Fail(ctx, *job, err.Error(), cfg.MaxAttempts); failErr != nil {
			log.Error("no se pudo registrar el fallo", "error", failErr)
		}
		return
	}

	if err := st.Finish(ctx, job.ID, job.AssetID, result); err != nil {
		log.Error("no se pudieron guardar los derivados", "error", err)
		_ = st.Fail(ctx, *job, err.Error(), cfg.MaxAttempts)
		return
	}

	log.Info("listo",
		"kind", asset.Kind,
		"derivatives", len(result.Derivatives),
		"elapsed", time.Since(started).Round(time.Millisecond).String(),
	)
}
