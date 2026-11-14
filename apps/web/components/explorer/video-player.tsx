"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";

/**
 * Reproductor de video privado.
 *
 * Usa HLS cuando el worker ya generó los derivados; si hls.js no está
 * disponible o la reproducción falla, cae al original firmado.
 */
export function VideoPlayer({
  assetId,
  poster,
  fallbackUrl,
  hasHls,
}: {
  assetId: string;
  poster: string | null;
  fallbackUrl: string | null;
  hasHls: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"hls" | "original">(hasHls ? "hls" : "original");
  const [failed, setFailed] = useState(false);

  const hlsUrl = `/api/assets/${assetId}/hls/master.m3u8`;

  useEffect(() => {
    if (mode !== "hls") return;
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      return;
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
  }, [mode, hlsUrl]);

  if (mode === "original" && fallbackUrl) {
    return (
      <div className="grid h-full w-full place-items-center bg-black/40 p-3">
        <div className="w-full">
          <video
            key={`${assetId}-original`}
            controls
            playsInline
            preload="metadata"
            poster={poster ?? undefined}
            className="max-h-full w-full rounded-[8px] bg-black"
            src={fallbackUrl}
          />
          {failed ? (
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              Reproduciendo el original · HLS no disponible
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full w-full place-items-center bg-black/40 p-3">
      <video
        ref={videoRef}
        key={`${assetId}-hls`}
        controls
        playsInline
        preload="metadata"
        poster={poster ?? undefined}
        className="max-h-full w-full rounded-[8px] bg-black"
      />
    </div>
  );
}
