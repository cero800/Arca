package keys

import "testing"

func TestDerivativeKey(t *testing.T) {
	got := Thumb("vault-1", "asset-1")
	want := "vaults/vault-1/asset-1/thumb.webp"
	if got != want {
		t.Fatalf("Thumb = %q, esperado %q", got, want)
	}
}

func TestHLSKey(t *testing.T) {
	got := HLS("v", "a", "seg_0001.m4s")
	want := "vaults/v/a/hls/seg_0001.m4s"
	if got != want {
		t.Fatalf("HLS = %q, esperado %q", got, want)
	}
}

func TestMediaType(t *testing.T) {
	cases := map[string]string{
		"thumb.webp":      "image/webp",
		"master.m3u8":     "application/vnd.apple.mpegurl",
		"init.mp4":        "video/mp4",
		"seg_0001.m4s":    "video/mp4",
		"text.txt":        "text/plain; charset=utf-8",
		"poster.webp":     "image/webp",
		"desconocido.bin": "application/octet-stream",
	}

	for name, want := range cases {
		if got := MediaType(name); got != want {
			t.Fatalf("MediaType(%q) = %q, esperado %q", name, got, want)
		}
	}
}
