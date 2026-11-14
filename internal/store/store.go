// Package store encapsula el acceso a Postgres para el worker y la CLI.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNoJob = errors.New("no hay trabajos pendientes")

type Store struct {
	Pool *pgxpool.Pool
}

type Asset struct {
	ID           string
	VaultID      string
	Kind         string
	Status       string
	OriginalName string
	Mime         string
	StorageKey   string
	Size         int64
	Width        *int
	Height       *int
	DurationMS   *int
}

type Job struct {
	ID       string
	AssetID  string
	Type     string
	Attempts int
}

type Derivative struct {
	Type   string
	Key    string
	Width  *int
	Height *int
	Size   int64
	Meta   map[string]any
}

type Result struct {
	Width       *int
	Height      *int
	DurationMS  *int
	Derivatives []Derivative
	Metrics     map[string]any
}

type JobRow struct {
	ID         string     `json:"id"`
	AssetID    string     `json:"assetId"`
	AssetName  string     `json:"assetName"`
	Kind       string     `json:"kind"`
	Type       string     `json:"type"`
	Status     string     `json:"status"`
	Attempts   int        `json:"attempts"`
	Error      *string    `json:"error"`
	RunAt      time.Time  `json:"runAt"`
	LeaseUntil *time.Time `json:"leaseUntil"`
	CreatedAt  time.Time  `json:"createdAt"`
	FinishedAt *time.Time `json:"finishedAt"`
}

func Open(ctx context.Context, url string) (*Store, error) {
	poolConfig, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("DATABASE_URL inválida: %w", err)
	}
	poolConfig.MaxConns = 4
	poolConfig.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("conectando a Postgres: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("Postgres no responde: %w", err)
	}

	return &Store{Pool: pool}, nil
}

func (s *Store) Close() {
	s.Pool.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	return s.Pool.Ping(ctx)
}

// RecoverStale devuelve a la cola los jobs cuyo lease expiró.
func (s *Store) RecoverStale(ctx context.Context) (int64, error) {
	tag, err := s.Pool.Exec(ctx, `
		UPDATE processing_job
		SET status = 'pending', lease_until = NULL, locked_at = NULL
		WHERE status = 'processing' AND lease_until IS NOT NULL AND lease_until < now()`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// Claim toma un job de forma atómica con FOR UPDATE SKIP LOCKED.
func (s *Store) Claim(ctx context.Context, lease time.Duration) (*Job, error) {
	row := s.Pool.QueryRow(ctx, `
		WITH candidate AS (
			SELECT id
			FROM processing_job
			WHERE (status = 'pending' AND run_at <= now())
			   OR (status = 'processing' AND (lease_until IS NULL OR lease_until < now()))
			ORDER BY run_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		UPDATE processing_job j
		SET status = 'processing',
		    attempts = j.attempts + 1,
		    locked_at = now(),
		    lease_until = now() + make_interval(secs => $1),
		    error = NULL
		FROM candidate c
		WHERE j.id = c.id
		RETURNING j.id, j.asset_id, j.type, j.attempts`,
		lease.Seconds(),
	)

	var job Job
	if err := row.Scan(&job.ID, &job.AssetID, &job.Type, &job.Attempts); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNoJob
		}
		return nil, err
	}

	return &job, nil
}

func (s *Store) GetAsset(ctx context.Context, id string) (*Asset, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, vault_id, kind, status, original_name, mime, storage_key, size,
		       width, height, duration_ms
		FROM asset
		WHERE id = $1 AND deleted_at IS NULL`, id)

	var a Asset
	if err := row.Scan(
		&a.ID, &a.VaultID, &a.Kind, &a.Status, &a.OriginalName, &a.Mime,
		&a.StorageKey, &a.Size, &a.Width, &a.Height, &a.DurationMS,
	); err != nil {
		return nil, err
	}
	return &a, nil
}

// Finish guarda derivados, metadatos y marca el asset como listo.
func (s *Store) Finish(ctx context.Context, jobID, assetID string, result Result) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM derivative WHERE asset_id = $1`, assetID); err != nil {
		return err
	}

	for _, derivative := range result.Derivatives {
		meta := derivative.Meta
		if meta == nil {
			meta = map[string]any{}
		}
		encoded, err := json.Marshal(meta)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO derivative (asset_id, type, storage_key, width, height, size, meta)
			VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			assetID, derivative.Type, derivative.Key, derivative.Width,
			derivative.Height, derivative.Size, encoded,
		); err != nil {
			return fmt.Errorf("insertando derivado %s: %w", derivative.Type, err)
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE asset
		SET status = 'ready',
		    width = COALESCE($2, width),
		    height = COALESCE($3, height),
		    duration_ms = COALESCE($4, duration_ms),
		    updated_at = now()
		WHERE id = $1`,
		assetID, result.Width, result.Height, result.DurationMS,
	); err != nil {
		return err
	}

	metrics := result.Metrics
	if metrics == nil {
		metrics = map[string]any{}
	}
	encodedMetrics, err := json.Marshal(metrics)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE processing_job
		SET status = 'done', finished_at = now(), lease_until = NULL, metrics = $2
		WHERE id = $1`, jobID, encodedMetrics,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// Fail reintenta con backoff o marca el job y el asset como error.
func (s *Store) Fail(ctx context.Context, job Job, message string, maxAttempts int) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	dead := job.Attempts >= maxAttempts
	if dead {
		if _, err := tx.Exec(ctx, `
			UPDATE processing_job
			SET status = 'error', error = $2, finished_at = now(), lease_until = NULL
			WHERE id = $1`, job.ID, message,
		); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE asset SET status = 'error', updated_at = now() WHERE id = $1`,
			job.AssetID,
		); err != nil {
			return err
		}
	} else {
		backoff := job.Attempts * job.Attempts * 30
		if _, err := tx.Exec(ctx, `
			UPDATE processing_job
			SET status = 'pending', error = $2, lease_until = NULL, locked_at = NULL,
			    run_at = now() + make_interval(secs => $3)
			WHERE id = $1`, job.ID, message, backoff,
		); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE asset SET status = 'processing', updated_at = now() WHERE id = $1`,
			job.AssetID,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (s *Store) ListJobs(ctx context.Context, status string, limit int) ([]JobRow, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT j.id, j.asset_id, a.original_name, a.kind, j.type, j.status,
		       j.attempts, j.error, j.run_at, j.lease_until, j.created_at, j.finished_at
		FROM processing_job j
		JOIN asset a ON a.id = j.asset_id
		WHERE ($1 = '' OR j.status = $1::job_status)
		ORDER BY j.created_at DESC
		LIMIT $2`, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []JobRow
	for rows.Next() {
		var row JobRow
		if err := rows.Scan(
			&row.ID, &row.AssetID, &row.AssetName, &row.Kind, &row.Type,
			&row.Status, &row.Attempts, &row.Error, &row.RunAt, &row.LeaseUntil,
			&row.CreatedAt, &row.FinishedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s *Store) Stats(ctx context.Context) (map[string]int, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT status, count(*)::int FROM processing_job GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := map[string]int{"pending": 0, "processing": 0, "done": 0, "error": 0}
	for rows.Next() {
		var status string
		var total int
		if err := rows.Scan(&status, &total); err != nil {
			return nil, err
		}
		stats[status] = total
	}
	return stats, rows.Err()
}

func (s *Store) RetryAsset(ctx context.Context, assetID string) (int64, error) {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx, `
		UPDATE processing_job
		SET status = 'pending', attempts = 0, error = NULL, run_at = now(),
		    locked_at = NULL, lease_until = NULL, finished_at = NULL
		WHERE asset_id = $1`, assetID)
	if err != nil {
		return 0, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE asset SET status = 'processing', updated_at = now() WHERE id = $1`,
		assetID,
	); err != nil {
		return 0, err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
