package main

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/silver/arca/internal/config"
	"github.com/silver/arca/internal/filetype"
	"github.com/silver/arca/internal/id"
	"github.com/silver/arca/internal/keys"
	"github.com/silver/arca/internal/storage"
	"github.com/silver/arca/internal/store"
)

func put(ctx context.Context, cfg config.Config, args []string) {
	if len(args) < 2 {
		fmt.Println("Uso: arca put <baúl> <archivo...>")
		os.Exit(1)
	}
	if !cfg.StorageReady() {
		fail(errors.New("faltan S3_ENDPOINT, S3_KEY o S3_SECRET para subir archivos"))
	}

	slug, paths := args[0], args[1:]
	st := open(ctx, cfg)
	defer st.Close()

	vault, err := st.VaultBySlug(ctx, slug)
	if errors.Is(err, store.ErrNotFound) {
		fail(fmt.Errorf("el baúl %q no existe", slug))
	}
	if err != nil {
		fail(err)
	}

	objects, err := storage.New(ctx, cfg)
	if err != nil {
		fail(err)
	}

	failures := 0
	for _, path := range paths {
		if err := putFile(ctx, cfg, st, objects, vault, path); err != nil {
			fmt.Fprintf(os.Stderr, "arca: %s: %v\n", path, err)
			failures++
		}
	}
	if failures > 0 {
		os.Exit(1)
	}
}

func putFile(
	ctx context.Context,
	cfg config.Config,
	st *store.Store,
	objects *storage.Client,
	vault *store.Vault,
	path string,
) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return errors.New("es un directorio; indica archivos")
	}
	if info.Size() > cfg.MaxFileBytes {
		return fmt.Errorf(
			"supera el máximo de %s por archivo",
			formatSize(cfg.MaxFileBytes),
		)
	}

	sha, err := hashFile(path)
	if err != nil {
		return err
	}

	existing, err := st.FindAssetBySHA(ctx, vault.ID, sha)
	if err == nil {
		fmt.Printf("= %s ya existe en %s (%s)\n", filetype.Name(path), vault.Slug, existing.ID)
		return nil
	}
	if !errors.Is(err, store.ErrNotFound) {
		return err
	}

	usage, err := st.StorageUsage(ctx, vault.OwnerID)
	if err != nil {
		return err
	}
	if usage+info.Size() > cfg.StorageQuotaBytes {
		return fmt.Errorf(
			"cuota agotada: %s usados de %s",
			formatSize(usage),
			formatSize(cfg.StorageQuotaBytes),
		)
	}

	assetID, err := id.New()
	if err != nil {
		return err
	}

	name := filetype.Name(path)
	mimetype := filetype.MIME(path)
	kind := filetype.Kind(mimetype)
	key := keys.Original(vault.ID, assetID)

	fmt.Printf("↑ %s (%s, %s)\n", name, mimetype, formatSize(info.Size()))
	if err := objects.UploadFile(ctx, key, path, mimetype); err != nil {
		return err
	}

	err = st.CreateAsset(ctx, store.NewAsset{
		ID:           assetID,
		VaultID:      vault.ID,
		OwnerID:      vault.OwnerID,
		Kind:         kind,
		OriginalName: name,
		Mime:         mimetype,
		StorageKey:   key,
		SHA256:       sha,
		Size:         info.Size(),
		JobType:      filetype.JobType(kind),
	})
	if errors.Is(err, store.ErrDuplicate) {
		_ = objects.Delete(ctx, key)
		fmt.Printf("= %s ya existe en %s\n", name, vault.Slug)
		return nil
	}
	if err != nil {
		_ = objects.Delete(ctx, key)
		return err
	}

	fmt.Printf("✓ %s → %s (%s, job pendiente)\n", name, assetID, kind)
	return nil
}

func pull(ctx context.Context, cfg config.Config, args []string) {
	if len(args) < 2 {
		fmt.Println("Uso: arca pull <baúl> <destino>")
		os.Exit(1)
	}
	if !cfg.StorageReady() {
		fail(errors.New("faltan S3_ENDPOINT, S3_KEY o S3_SECRET para descargar archivos"))
	}

	slug, destination := args[0], args[1]
	st := open(ctx, cfg)
	defer st.Close()

	vault, err := st.VaultBySlug(ctx, slug)
	if errors.Is(err, store.ErrNotFound) {
		fail(fmt.Errorf("el baúl %q no existe", slug))
	}
	if err != nil {
		fail(err)
	}

	objects, err := storage.New(ctx, cfg)
	if err != nil {
		fail(err)
	}

	assets, err := st.ListBackupAssets(ctx, vault.ID)
	if err != nil {
		fail(err)
	}
	if len(assets) == 0 {
		fmt.Printf("El baúl %q no tiene archivos para descargar.\n", vault.Slug)
		return
	}
	if err := os.MkdirAll(destination, 0o755); err != nil {
		fail(err)
	}

	downloaded, skipped, failures := 0, 0, 0
	for _, asset := range assets {
		status, err := pullFile(ctx, objects, destination, asset)
		if err != nil {
			fmt.Fprintf(os.Stderr, "arca: %s: %v\n", asset.OriginalName, err)
			failures++
			continue
		}
		if status == "skipped" {
			skipped++
		} else {
			downloaded++
		}
	}

	fmt.Printf(
		"Resumen: %d descargados, %d omitidos, %d errores → %s\n",
		downloaded, skipped, failures, destination,
	)
	if failures > 0 {
		os.Exit(1)
	}
}

func pullFile(
	ctx context.Context,
	objects *storage.Client,
	destination string,
	asset store.BackupAsset,
) (string, error) {
	name := filepath.Base(strings.TrimSpace(asset.OriginalName))
	if name == "" || name == "." || name == string(filepath.Separator) {
		name = "archivo-" + shortID(asset.ID)
	}

	target := filepath.Join(destination, name)
	if fileExists(target) {
		if asset.SHA256 != "" {
			existingSHA, err := hashFile(target)
			if err == nil && existingSHA == asset.SHA256 {
				fmt.Printf("= %s ya está al día\n", name)
				return "skipped", nil
			}
		}
		target = uniqueTarget(destination, name, asset.ID)
	}

	temp := filepath.Join(destination, ".arca-"+shortID(asset.ID)+".part")
	defer func() { _ = os.Remove(temp) }()

	fmt.Printf("↓ %s (%s)\n", name, formatSize(asset.Size))
	if err := objects.Download(ctx, asset.StorageKey, temp); err != nil {
		return "", err
	}

	if asset.SHA256 != "" {
		sha, err := hashFile(temp)
		if err != nil {
			return "", err
		}
		if sha != asset.SHA256 {
			return "", errors.New("el sha256 descargado no coincide con el registrado")
		}
	}

	if err := os.Rename(temp, target); err != nil {
		return "", err
	}

	fmt.Printf("✓ %s\n", filepath.Base(target))
	return "downloaded", nil
}

func hashFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", fmt.Errorf("leyendo %s: %w", path, err)
	}
	return fmt.Sprintf("%x", hasher.Sum(nil)), nil
}

func uniqueTarget(destination, name, assetID string) string {
	ext := filepath.Ext(name)
	base := strings.TrimSuffix(name, ext)
	if base == "" {
		base = "archivo"
	}
	suffix := shortID(assetID)

	candidate := filepath.Join(destination, fmt.Sprintf("%s-%s%s", base, suffix, ext))
	for index := 2; fileExists(candidate); index++ {
		candidate = filepath.Join(
			destination,
			fmt.Sprintf("%s-%s-%d%s", base, suffix, index, ext),
		)
	}
	return candidate
}

func shortID(value string) string {
	if len(value) >= 8 {
		return value[:8]
	}
	if value == "" {
		return "sin-id"
	}
	return value
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	value := float64(bytes)
	units := []string{"KB", "MB", "GB", "TB"}
	for _, name := range units {
		value /= unit
		if value < unit {
			return fmt.Sprintf("%.1f %s", value, name)
		}
	}
	return fmt.Sprintf("%.1f PB", value/unit)
}
