package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ErrNotFound indica que la fila solicitada no existe.
var ErrNotFound = errors.New("no encontrado")

// ErrDuplicate indica que ya hay un asset con el mismo sha256 en el baúl.
var ErrDuplicate = errors.New("el archivo ya existe en este baúl")

type Vault struct {
	ID      string
	OwnerID string
	Name    string
	Slug    string
}

type AssetRef struct {
	ID           string
	OriginalName string
}

type BackupAsset struct {
	ID           string
	OriginalName string
	StorageKey   string
	SHA256       string
	Size         int64
}

type NewAsset struct {
	ID           string
	VaultID      string
	OwnerID      string
	Kind         string
	OriginalName string
	Mime         string
	StorageKey   string
	SHA256       string
	Size         int64
	JobType      string
}

// VaultBySlug busca un baúl por su slug público.
func (s *Store) VaultBySlug(ctx context.Context, slug string) (*Vault, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, owner_id, name, slug
		FROM vault
		WHERE slug = $1`, slug)

	var vault Vault
	if err := row.Scan(&vault.ID, &vault.OwnerID, &vault.Name, &vault.Slug); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &vault, nil
}

// FindAssetBySHA busca un asset vivo con el mismo contenido en el baúl.
func (s *Store) FindAssetBySHA(ctx context.Context, vaultID, sha256 string) (*AssetRef, error) {
	row := s.Pool.QueryRow(ctx, `
		SELECT id, original_name
		FROM asset
		WHERE vault_id = $1 AND sha256 = $2 AND deleted_at IS NULL
		LIMIT 1`, vaultID, sha256)

	var asset AssetRef
	if err := row.Scan(&asset.ID, &asset.OriginalName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &asset, nil
}

// StorageUsage suma todos los bytes del dueño, incluida la papelera.
func (s *Store) StorageUsage(ctx context.Context, ownerID string) (int64, error) {
	var total int64
	if err := s.Pool.QueryRow(ctx, `
		SELECT coalesce(sum(size), 0)::bigint
		FROM asset
		WHERE owner_id = $1`, ownerID).Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

// CreateAsset inserta el asset ya subido y encola su procesamiento.
func (s *Store) CreateAsset(ctx context.Context, input NewAsset) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var sha any
	if input.SHA256 != "" {
		sha = input.SHA256
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO asset (
			id, vault_id, owner_id, kind, status, original_name, mime, size, sha256, storage_key
		) VALUES ($1, $2, $3, $4::asset_kind, 'processing', $5, $6, $7, $8, $9)`,
		input.ID, input.VaultID, input.OwnerID, input.Kind, input.OriginalName,
		input.Mime, input.Size, sha, input.StorageKey,
	); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrDuplicate
		}
		return fmt.Errorf("insertando asset: %w", err)
	}

	jobType := input.JobType
	if jobType == "" {
		jobType = "all"
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO processing_job (asset_id, type, status)
		VALUES ($1, $2::job_type, 'pending')`, input.ID, jobType,
	); err != nil {
		return fmt.Errorf("encolando asset: %w", err)
	}

	return tx.Commit(ctx)
}

// ListBackupAssets devuelve los originales que la CLI puede descargar.
func (s *Store) ListBackupAssets(ctx context.Context, vaultID string) ([]BackupAsset, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT id, original_name, storage_key, coalesce(sha256, ''), size
		FROM asset
		WHERE vault_id = $1
		  AND deleted_at IS NULL
		  AND status <> 'uploading'
		ORDER BY created_at ASC`, vaultID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assets []BackupAsset
	for rows.Next() {
		var asset BackupAsset
		if err := rows.Scan(
			&asset.ID, &asset.OriginalName, &asset.StorageKey, &asset.SHA256, &asset.Size,
		); err != nil {
			return nil, err
		}
		assets = append(assets, asset)
	}
	return assets, rows.Err()
}
