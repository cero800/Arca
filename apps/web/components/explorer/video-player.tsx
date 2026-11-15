"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Hls from "hls.js";
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StoryboardMeta = {
  tileWidth?: number;
  tileHeight?: number;
  columns?: number;
  rows?: number;
  tiles?: number;
  intervalMs?: number;
};

type Cue = {
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
};

function parseTimestamp(value: string): number {
  const parts = value.trim().replace(",", ".").split(":").map(Number);
  const first = parts[0] ?? 0;
  const second = parts[1] ?? 0;
  const third = parts[2] ?? 0;
  if (parts.length === 3) return first * 3600 + second * 60 + third;
  if (parts.length === 2) return first * 60 + second;
  return 0;
}

function parseVtt(text: string): Cue[] {
  const body = text.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const blocks = body.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex < 0) continue;

    const [startRaw, endRaw] = (lines[timingIndex] ?? "").split("-->");
    if (!startRaw || !endRaw) continue;

    const sprite = lines
      .slice(timingIndex + 1)
      .join(" ")
      .match(/(\S+?)#xywh=(\d+),(\d+),(\d+),(\d+)/);
    if (!sprite) continue;

    cues.push({
      start: parseTimestamp(startRaw),
      end: parseTimestamp(endRaw.trim().split(/\s+/)[0] ?? ""),
      url: sprite[1] ?? "",
      x: Number(sprite[2]),
      y: Number(sprite[3]),
      width: Number(sprite[4]),
      height: Number(sprite[5]),
    });
  }

  return cues;
}

function formatClock(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getStoryboardCue(cues: Cue[], time: number): Cue | null {
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) {
      return cue;
    }
  }
  return null;
}

type VideoPlayerProps = {
  assetId: string;
  poster: string | null;
  fallbackUrl: string | null;
  hasHls: boolean;
  hasStoryboard?: boolean;
  storyboard?: StoryboardMeta | null;
  shareToken?: string;
};

export function VideoPlayer({
  assetId,
  poster,
  fallbackUrl,
  hasHls,
  hasStoryboard = false,
  storyboard,
  shareToken,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"hls" | "original">(hasHls ? "hls" : "original");
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cues, setCues] = useState<Cue[]>([]);
  const [spriteReady, setSpriteReady] = useState(false);
  const [hover, setHover] = useState<{ time: number; left: number } | null>(null);

  const query = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
  const hlsUrl = `/api/assets/${assetId}/hls/master.m3u8${query}`;
  const storyboardUrl = `/api/assets/${assetId}/storyboard${query}`;

  const tileWidth = storyboard?.tileWidth ?? 160;
  const tileHeight = storyboard?.tileHeight ?? 90;
  const columns = storyboard?.columns ?? 10;
  const rows = storyboard?.rows ?? 10;

  /* HLS u original. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (mode === "original") {
      if (fallbackUrl) {
        video.src = fallbackUrl;
        video.load();
      }
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.load();
      // Algunos navegadores dicen "maybe" y luego no pueden reproducir HLS.
      const onError = () => {
        setFailed(true);
        setMode("original");
      };
      video.addEventListener("error", onError, { once: true });
      return () => video.removeEventListener("error", onError);
    }

    // hls.js se carga sólo cuando hace falta, para no pesar en la lista.
    let instance: Hls | null = null;
    let cancelled = false;

    void import("hls.js").then(({ default: HlsPlayer }) => {
      if (cancelled) return;

      if (!HlsPlayer.isSupported()) {
        setMode("original");
        return;
      }

      instance = new HlsPlayer({ maxBufferLength: 30, enableWorker: true });
      instance.loadSource(hlsUrl);
      instance.attachMedia(video);
      instance.on(HlsPlayer.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setFailed(true);
          setMode("original");
        }
      });
    });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [mode, hlsUrl, fallbackUrl]);

  /* Estado del elemento <video>. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function sync() {
      if (!video) return;
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      setCurrentTime(video.currentTime || 0);
      setPlaying(!video.paused && !video.ended);
      setMuted(video.muted);
      setBuffered(
        video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0,
      );
    }

    const events = [
      "loadedmetadata",
      "durationchange",
      "timeupdate",
      "play",
      "pause",
      "ended",
      "progress",
      "emptied",
      "volumechange",
    ];
    for (const event of events) video.addEventListener(event, sync);
    sync();

    return () => {
      for (const event of events) video.removeEventListener(event, sync);
    };
  }, [mode]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /* VTT del storyboard. */
  useEffect(() => {
    if (!hasStoryboard) {
      setCues([]);
      setSpriteReady(false);
      return;
    }

    const controller = new AbortController();
    setSpriteReady(false);

    fetch(storyboardUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`storyboard ${response.status}`);
        return response.text();
      })
      .then((text) => {
        const parsed = parseVtt(text);
        setCues(parsed);

        const sprite = parsed[0]?.url;
        if (!sprite) return;
        const image = new Image();
        image.onload = () => setSpriteReady(true);
        image.onerror = () => setSpriteReady(false);
        image.src = sprite;
      })
      .catch(() => {
        if (!controller.signal.aborted) setCues([]);
      });

    return () => controller.abort();
  }, [hasStoryboard, storyboardUrl]);

  const seekTo = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      const max = Number.isFinite(video.duration) ? video.duration : duration;
      const next = Math.min(Math.max(value, 0), max || 0);
      video.currentTime = next;
      setCurrentTime(next);
    },
    [duration],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    const video = videoRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (shell?.requestFullscreen) {
        await shell.requestFullscreen();
        return;
      }
      const legacy = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      legacy?.webkitEnterFullscreen?.();
    } catch {
      // El navegador puede rechazar pantalla completa sin gesto de usuario.
    }
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select")) return;

    const key = event.key.toLowerCase();
    if (event.key === " " || event.key === "Spacebar" || key === "k") {
      event.preventDefault();
      event.stopPropagation();
      togglePlay();
    } else if (event.key === "ArrowLeft" || key === "j") {
      event.preventDefault();
      event.stopPropagation();
      seekTo(currentTime - 5);
    } else if (event.key === "ArrowRight" || key === "l") {
      event.preventDefault();
      event.stopPropagation();
      seekTo(currentTime + 5);
    } else if (key === "m") {
      event.preventDefault();
      event.stopPropagation();
      toggleMute();
    } else if (key === "f") {
      event.preventDefault();
      event.stopPropagation();
      void toggleFullscreen();
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;

    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const boxWidth = 160;
    const left = Math.min(Math.max(x, boxWidth / 2 + 4), rect.width - boxWidth / 2 - 4);
    setHover({ time: (x / rect.width) * duration, left });
  }

  const playedPct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const bufferedPct = duration > 0 ? Math.min((buffered / duration) * 100, 100) : 0;
  const sprite = cues[0]?.url ?? null;

  const previewCue = useMemo(() => {
    if (!hover || cues.length === 0) return null;
    return getStoryboardCue(cues, hover.time) ?? cues[cues.length - 1] ?? null;
  }, [hover, cues]);

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      role="group"
      aria-label="Reproductor de video"
      onKeyDown={onKeyDown}
      className="relative grid h-full w-full place-items-center overflow-hidden bg-black/40 p-3 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
    >
      <video
        ref={videoRef}
        key={`${assetId}-${mode}`}
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        onClick={togglePlay}
        onDoubleClick={() => void toggleFullscreen()}
        className="max-h-full w-full cursor-pointer rounded-[8px] bg-black"
      />

      {duration === 0 && !failed ? (
        <Loader2 className="pointer-events-none absolute h-5 w-5 animate-spin text-white/60" />
      ) : null}

      {failed ? (
        <p className="pointer-events-none absolute left-4 top-4 rounded-[6px] bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          HLS no disponible · original
        </p>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 z-10 rounded-[8px] bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-2 pt-7">
        <div
          className="relative pb-2 pt-1"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          {spriteReady && sprite ? (
            <div
              className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 overflow-hidden rounded-[6px] border border-white/20 bg-black shadow-[0_12px_32px_-12px_rgb(0_0_0/0.9)]"
              style={{
                left: `${hover?.left ?? 0}px`,
                width: `${spriteReady ? tileWidth : 0}px`,
                height: `${spriteReady ? tileHeight : 0}px`,
                backgroundImage: spriteReady ? `url("${sprite}")` : "none",
                backgroundPosition: `${spriteReady ? `${previewCue?.x ?? 0}px` : "0px"} ${spriteReady ? `${previewCue?.y ?? 0}px` : "0px"}`,
                backgroundSize: `${columns * tileWidth}px ${rows * tileHeight}px`,
                backgroundRepeat: "no-repeat",
              }}
            >
              <span className="absolute bottom-1 right-1 rounded-[3px] bg-black/70 px-1 font-mono text-[9px] text-white/80">
                {formatClock(previewCue?.start ?? 0)}
              </span>
            </div>
          ) : null}

          <div className="group-seek relative h-4">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
              <div
                className="absolute inset-y-0 left-0 bg-white/30"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-accent"
                style={{ width: `${playedPct}%` }}
              />
            </div>
            <div
              className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgb(0_0_0/0.35)]"
              style={{ left: `${playedPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seekTo(Number(event.target.value))}
              aria-label="Posición del video"
              aria-valuetext={`${formatClock(currentTime)} de ${formatClock(duration)}`}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-white">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pausar" : "Reproducir"}
            className="grid h-8 w-8 place-items-center rounded-[6px] transition-colors hover:bg-white/15"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <span className="font-mono text-[11px] tabular-nums text-white/80">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>

          <div className="flex-1" />

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
            className="grid h-8 w-8 place-items-center rounded-[6px] transition-colors hover:bg-white/15"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            className="grid h-8 w-8 place-items-center rounded-[6px] transition-colors hover:bg-white/15"
          >
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-3 bottom-3 h-16 rounded-[8px] opacity-0 transition-opacity",
          "group-focus-within/player:opacity-100",
        )}
      />
    </div>
  );
}