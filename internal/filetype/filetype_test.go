package filetype

import "testing"

func TestMIME(t *testing.T) {
	tests := map[string]string{
		"foto.JPG":         "image/jpeg",
		"clip.mkv":         "video/x-matroska",
		"voz.flac":         "audio/flac",
		"notas.md":         "text/markdown",
		"contrato.pdf":     "application/pdf",
		"desconocido.arca": "application/octet-stream",
	}
	for path, expected := range tests {
		if actual := MIME(path); actual != expected {
			t.Fatalf("MIME(%q) = %q, esperado %q", path, actual, expected)
		}
	}
}

func TestKind(t *testing.T) {
	tests := map[string]string{
		"image/png":        "image",
		"video/mp4":        "video",
		"audio/mpeg":       "audio",
		"application/pdf":  "pdf",
		"text/plain":       "text",
		"application/json": "text",
		"application/zip":  "other",
	}
	for mimetype, expected := range tests {
		if actual := Kind(mimetype); actual != expected {
			t.Fatalf("Kind(%q) = %q, esperado %q", mimetype, actual, expected)
		}
	}
}

func TestJobType(t *testing.T) {
	if JobType("image") != "image" {
		t.Fatal("las imágenes deben usar un job specific")
	}
	if JobType("video") != "all" {
		t.Fatal("el resto de tipos debe usar all")
	}
}

func TestName(t *testing.T) {
	if Name("/tmp/opencode/archivo.jpg") != "archivo.jpg" {
		t.Fatal("debe devolver sólo el nombre base")
	}
	if Name("") != "archivo" {
		t.Fatal("un nombre vacío debe normalizarse")
	}
}
