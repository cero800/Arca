package media

import "testing"

func TestParseProbe(t *testing.T) {
	payload := []byte(`{
		"streams": [{"width": 1920, "height": 1080}],
		"format": {"duration": "12.345"}
	}`)

	info, err := parseProbe(payload)
	if err != nil {
		t.Fatalf("parseProbe: %v", err)
	}

	if info.Width != 1920 || info.Height != 1080 {
		t.Fatalf("dimensiones = %dx%d, esperado 1920x1080", info.Width, info.Height)
	}
	if info.DurationMS != 12345 {
		t.Fatalf("duración = %d ms, esperado 12345", info.DurationMS)
	}
}

func TestParseProbeSinStreams(t *testing.T) {
	info, err := parseProbe([]byte(`{"streams": [], "format": {}}`))
	if err != nil {
		t.Fatalf("parseProbe: %v", err)
	}
	if info.Width != 0 || info.DurationMS != 0 {
		t.Fatalf("se esperaba info vacía, fue %+v", info)
	}
}
