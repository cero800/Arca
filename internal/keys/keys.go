// Package keys construye las rutas de objetos dentro del bucket.
package keys

import "fmt"

func base(vaultID, assetID string) string {
	return fmt.Sprintf("vaults/%s/%s", vaultID, assetID)
}

// Derivative devuelve la key de un archivo derivado concreto.
func Derivative(vaultID, assetID, name string) string {
	return fmt.Sprintf("%s/%s", base(vaultID, assetID), name)
}

// HLS devuelve la key de un archivo dentro del directorio HLS.
func HLS(vaultID, assetID, name string) string {
	return fmt.Sprintf("%s/hls/%s", base(vaultID, assetID), name)
}

// Original devuelve la key del archivo original subido por la web o la CLI.
func Original(vaultID, assetID string) string { return Derivative(vaultID, assetID, "original") }

func Thumb(vaultID, assetID string) string   { return Derivative(vaultID, assetID, "thumb.webp") }
func Preview(vaultID, assetID string) string { return Derivative(vaultID, assetID, "preview.webp") }
func Poster(vaultID, assetID string) string  { return Derivative(vaultID, assetID, "poster.webp") }
func AudioWave(vaultID, assetID string) string {
	return Derivative(vaultID, assetID, "audio-wave.webp")
}
func Text(vaultID, assetID string) string { return Derivative(vaultID, assetID, "text.txt") }
func Storyboard(vaultID, assetID string) string {
	return Derivative(vaultID, assetID, "storyboard.webp")
}
func StoryboardVTT(vaultID, assetID string) string {
	return Derivative(vaultID, assetID, "storyboard.vtt")
}

func MediaType(name string) string {
	switch {
	case hasSuffix(name, ".webp"):
		return "image/webp"
	case hasSuffix(name, ".jpg"), hasSuffix(name, ".jpeg"):
		return "image/jpeg"
	case hasSuffix(name, ".vtt"):
		return "text/vtt"
	case hasSuffix(name, ".m3u8"):
		return "application/vnd.apple.mpegurl"
	case hasSuffix(name, ".m4s"), hasSuffix(name, ".mp4"):
		return "video/mp4"
	case hasSuffix(name, ".txt"):
		return "text/plain; charset=utf-8"
	default:
		return "application/octet-stream"
	}
}

func hasSuffix(value, suffix string) bool {
	if len(value) < len(suffix) {
		return false
	}
	return value[len(value)-len(suffix):] == suffix
}
