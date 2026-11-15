// Package filetype detecta MIME y tipo de asset a partir del nombre del archivo.
package filetype

import (
	"mime"
	"path/filepath"
	"strings"
)

var byExtension = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".webp": "image/webp",
	".gif":  "image/gif",
	".avif": "image/avif",
	".heic": "image/heic",
	".tif":  "image/tiff",
	".tiff": "image/tiff",

	".mp4":  "video/mp4",
	".m4v":  "video/mp4",
	".webm": "video/webm",
	".mov":  "video/quicktime",
	".mkv":  "video/x-matroska",
	".mpeg": "video/mpeg",
	".mpg":  "video/mpeg",

	".mp3":  "audio/mpeg",
	".wav":  "audio/wav",
	".ogg":  "audio/ogg",
	".flac": "audio/flac",
	".m4a":  "audio/mp4",
	".aac":  "audio/aac",

	".pdf": "application/pdf",

	".txt":      "text/plain",
	".md":       "text/markdown",
	".markdown": "text/markdown",
	".csv":      "text/csv",
	".json":     "application/json",
	".xml":      "application/xml",
	".html":     "text/html",
	".htm":      "text/html",
	".css":      "text/css",
	".js":       "text/javascript",
	".mjs":      "text/javascript",
}

// MIME devuelve el tipo MIME probable de un archivo.
func MIME(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if value, ok := byExtension[ext]; ok {
		return value
	}
	if value := mime.TypeByExtension(ext); value != "" {
		if index := strings.IndexByte(value, ';'); index >= 0 {
			value = value[:index]
		}
		return value
	}
	return "application/octet-stream"
}

// Kind traduce el MIME al enum asset_kind de Postgres.
func Kind(mimetype string) string {
	value := strings.ToLower(mimetype)
	switch {
	case strings.HasPrefix(value, "image/"):
		return "image"
	case strings.HasPrefix(value, "video/"):
		return "video"
	case strings.HasPrefix(value, "audio/"):
		return "audio"
	case value == "application/pdf":
		return "pdf"
	case strings.HasPrefix(value, "text/"),
		value == "application/json",
		value == "application/xml",
		value == "application/javascript":
		return "text"
	default:
		return "other"
	}
}

// JobType usa el mismo criterio que la web: imágenes van a un job específico.
func JobType(kind string) string {
	if kind == "image" {
		return "image"
	}
	return "all"
}

// Name normaliza el nombre visible de un archivo.
func Name(path string) string {
	name := strings.TrimSpace(filepath.Base(path))
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "archivo"
	}
	return name
}
