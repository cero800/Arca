package media

import (
	"strings"
	"testing"
)

func TestPlanStoryboard(t *testing.T) {
	tests := []struct {
		name       string
		durationMS int64
		intervalMS int64
		tiles      int
	}{
		{"sin duración", 0, 0, 0},
		{"corto", 500, 1000, 1},
		{"seis segundos", 6000, 1000, 6},
		{"cien segundos", 100_000, 1000, 100},
		{"mil segundos", 1_000_000, 10_000, 100},
		{"dos horas", 7_200_000, 72_000, 100},
		{"fracción", 100_500, 1005, 100},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			plan := PlanStoryboard(test.durationMS)
			if plan.IntervalMS != test.intervalMS {
				t.Fatalf("intervalo = %d ms, esperado %d", plan.IntervalMS, test.intervalMS)
			}
			if plan.Tiles != test.tiles {
				t.Fatalf("tiles = %d, esperado %d", plan.Tiles, test.tiles)
			}
			if plan.Tiles > StoryboardMaxTiles {
				t.Fatalf("tiles = %d supera el máximo %d", plan.Tiles, StoryboardMaxTiles)
			}
		})
	}
}

func TestBuildStoryboardVTT(t *testing.T) {
	plan := StoryboardPlan{IntervalMS: 1000, Tiles: 3}
	body := string(BuildStoryboardVTT(plan, 2500))

	if !strings.HasPrefix(body, "WEBVTT\n\n") {
		t.Fatalf("falta cabecera WEBVTT: %q", body)
	}
	for _, expected := range []string{
		"00:00:00.000 --> 00:00:01.000",
		"storyboard.webp#xywh=0,0,160,90",
		"00:00:01.000 --> 00:00:02.000",
		"storyboard.webp#xywh=160,0,160,90",
		"00:00:02.000 --> 00:00:02.500",
		"storyboard.webp#xywh=320,0,160,90",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("el VTT no contiene %q:\n%s", expected, body)
		}
	}
}

func TestBuildStoryboardVTTSecondRow(t *testing.T) {
	plan := StoryboardPlan{IntervalMS: 1000, Tiles: 11}
	body := string(BuildStoryboardVTT(plan, 11_000))

	if !strings.Contains(body, "storyboard.webp#xywh=0,90,160,90") {
		t.Fatalf("la miniatura 11 no cae en la segunda fila:\n%s", body)
	}
}

func TestFormatVTTTime(t *testing.T) {
	tests := map[int64]string{
		0:         "00:00:00.000",
		1234:      "00:00:01.234",
		61_500:    "00:01:01.500",
		3_723_004: "01:02:03.004",
	}
	for input, expected := range tests {
		if actual := formatVTTTime(input); actual != expected {
			t.Fatalf("formatVTTTime(%d) = %q, esperado %q", input, actual, expected)
		}
	}
}
