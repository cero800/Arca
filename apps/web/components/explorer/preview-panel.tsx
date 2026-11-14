"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileWarning,
  Loader2,
  Lock,
  Maximize2,
  X,
} from "lucide-react";
import type { ExplorerAsset, ExplorerComment } from "@/lib/queries";
import { formatBytes, formatDuration, relativeTime, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CommentPanel } from "@/components/comments/comment-panel";
import { FileIcon, kindLabel } from "./file-icon";
import { VideoPlayer } from "./video-player";
import { TrashAssetButton } from "./asset-actions";

type PreviewVault = {
  id: string;
  name: string;
  description: string;
  assetCount: number;
};

function previewOf(asset: ExplorerAsset, type: "thumb" | "preview" | "poster" | "audio_wave") {
  return asset.derivatives.find((item) => item.type === type)?.url ?? null;
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-0">
      <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-[11.5px] text-muted">{value}</dd>
    </div>
  );
}

function TextPreview({ assetId }: { assetId: string }) {
  const [state, setState] = useState<{ body: string; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setError(null);

    fetch(`/api/assets/${assetId}/text`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`No se pudo leer el archivo (${response.status})`);
        return (await response.json()) as { body: string; truncated: boolean };
      })
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Error de lectura");
      });

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (error) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <FileWarning className="mx-auto h-6 w-6 text-faint" />
          <p className="mt-2 text-[12.5px] text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-faint" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-muted">
        {state.body || "(archivo vacío)"}
      </pre>
      {state.truncated ? (
        <p className="mt-3 border-t border-line pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          Vista parcial · descarga el original para verlo completo
        </p>
      ) : null}
    </div>
  );
}

export function AssetPreview({
  asset,
  large = false,
}: {
  asset: ExplorerAsset;
  large?: boolean;
}) {
  const poster = previewOf(asset, "poster");
  const padding = large ? "p-6 lg:p-10" : "p-4";

  if (asset.status === "error") {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-[280px]">
          <FileWarning className="mx-auto h-7 w-7 text-danger/70" />
          <p className="mt-3 text-[13px] font-medium text-ink">No se pudo procesar</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            El original está guardado. Reintenta el procesamiento desde los ajustes del baúl.
          </p>
        </div>
      </div>
    );
  }

  if (asset.status === "uploading") {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
          <p className="mt-3 text-[12.5px] text-muted">Subiendo original…</p>
        </div>
      </div>
    );
  }

  if (asset.kind === "image") {
    const src = previewOf(asset, "preview") ?? asset.originalUrl;
    if (!src) return <FallbackPreview asset={asset} />;

    return (
      <div className={cn("grid h-full place-items-center", padding)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={asset.name}
          className="max-h-full max-w-full rounded-[8px] object-contain shadow-[0_24px_60px_-24px_rgb(0_0_0/0.9)]"
        />
      </div>
    );
  }

  if (asset.kind === "video") {
    const hasHls = asset.derivatives.some((item) => item.type === "hls");
    if (!hasHls && !asset.originalUrl) return <FallbackPreview asset={asset} />;

    return (
      <VideoPlayer
        assetId={asset.id}
        poster={poster}
        fallbackUrl={asset.originalUrl}
        hasHls={hasHls}
      />
    );
  }

  if (asset.kind === "audio") {
    if (!asset.originalUrl) return <FallbackPreview asset={asset} />;
    const wave = previewOf(asset, "audio_wave");

    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6">
        {wave ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wave} alt="" className="max-h-32 w-full max-w-[360px] object-contain" />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-full border border-line bg-surface-2">
            <FileIcon kind="audio" className="h-8 w-8 text-faint" />
          </div>
        )}
        <audio controls preload="metadata" src={asset.originalUrl} className="w-full max-w-[420px]" />
      </div>
    );
  }

  if (asset.kind === "pdf") {
    const pages = asset.derivatives
      .filter((item) => item.type === "pdf_page" && item.url)
      .sort((a, b) => {
        const pageA = Number((a.meta as { page?: number } | null)?.page ?? 0);
        const pageB = Number((b.meta as { page?: number } | null)?.page ?? 0);
        return pageA - pageB;
      });

    if (pages.length > 0) {
      return (
        <div className={cn("h-full space-y-3 overflow-auto", padding)}>
          {pages.map((page) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={page.url}
              src={page.url ?? ""}
              alt=""
              className="mx-auto w-full max-w-[640px] rounded-[6px] border border-line"
            />
          ))}
        </div>
      );
    }

    if (asset.originalUrl) {
      return (
        <iframe
          title={asset.name}
          src={asset.originalUrl}
          className="h-full w-full border-0 bg-white"
        />
      );
    }

    return <FallbackPreview asset={asset} />;
  }

  if (asset.kind === "text") {
    return <TextPreview assetId={asset.id} />;
  }

  return <FallbackPreview asset={asset} />;
}

function FallbackPreview({ asset }: { asset: ExplorerAsset }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-[14px] border border-line bg-surface-2 text-faint">
          <FileIcon kind={asset.kind} className="h-7 w-7" />
        </div>
        <p className="mt-4 text-[13px] font-medium text-ink">
          {asset.originalUrl ? "Sin vista previa" : "Original aún no disponible"}
        </p>
        <p className="mt-1 text-[12px] text-muted">
          {kindLabel(asset.kind)} · {formatBytes(asset.size)}
        </p>
        {asset.originalUrl ? (
          <a
            href={asset.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-8 items-center gap-2 rounded-[8px] border border-line bg-surface-2 px-3 text-[12px] text-ink transition-colors hover:border-line-strong hover:bg-surface-3"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir original
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function PreviewPanel({
  vault,
  asset,
  comments,
  onClose,
  onPrevious,
  onNext,
  onQuickLook,
  className,
}: {
  vault: PreviewVault;
  asset: ExplorerAsset | null;
  comments: ExplorerComment[];
  onClose?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onQuickLook?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-surface-1/60",
        className,
      )}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-muted transition-colors hover:bg-white/5 hover:text-ink lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {asset ? (
            <FileIcon kind={asset.kind} className="h-3.5 w-3.5 shrink-0 text-faint" />
          ) : (
            <Lock className="h-3.5 w-3.5 shrink-0 text-faint" />
          )}
          <span className="truncate text-[12px] font-medium text-ink">
            {asset ? asset.name : vault.name}
          </span>
          {asset ? (
            <Badge tone={asset.status === "ready" ? "neutral" : "warn"} className="shrink-0">
              {kindLabel(asset.kind)}
            </Badge>
          ) : null}
        </div>

        {asset ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Archivo anterior"
              className="grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Archivo siguiente"
              className="grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {asset.originalUrl ? (
              <>
                <a
                  href={asset.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir original"
                  className="grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href={asset.originalUrl}
                  download={asset.name}
                  aria-label="Descargar original"
                  className="grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <Download className="h-4 w-4" />
                </a>
              </>
            ) : null}
            {onQuickLook ? (
              <button
                type="button"
                onClick={onQuickLook}
                aria-label="Abrir vista rápida"
                title="Vista rápida (Espacio)"
                className="grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <TrashAssetButton assetId={asset.id} assetName={asset.name} />
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {asset ? (
          <div className="flex h-full flex-col">
            <div className="min-h-[220px] flex-1 overflow-hidden">
              <AssetPreview asset={asset} />
            </div>

            <dl className="grid shrink-0 gap-x-6 border-t border-line px-4 py-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <MetaRow label="Tipo" value={`${kindLabel(asset.kind)} · ${asset.mime}`} />
              <MetaRow label="Tamaño" value={formatBytes(asset.size)} />
              {asset.width && asset.height ? (
                <MetaRow label="Dimensiones" value={`${asset.width} × ${asset.height}`} />
              ) : null}
              {asset.durationMs ? (
                <MetaRow label="Duración" value={formatDuration(asset.durationMs)} />
              ) : null}
              <MetaRow label="Añadido" value={relativeTime(asset.createdAt)} />
              {asset.caption ? (
                <MetaRow label="Nota" value={asset.caption} />
              ) : null}
            </dl>
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex flex-1 flex-col justify-center px-5 py-8">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                Baúl privado
              </p>
              <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight text-ink">
                {vault.name}
              </h2>
              <p className="mt-2 max-w-[340px] text-[12.5px] leading-relaxed text-muted">
                {vault.description ||
                  "Sin descripción todavía. Añade una nota para recordar qué guarda este baúl y por qué."}
              </p>

              <dl className="mt-6 max-w-[300px]">
                <MetaRow label="Archivos" value={`${vault.assetCount}`} />
                <MetaRow label="Privacidad" value="Solo tú · enlace privado" />
              </dl>

              <p className="mt-6 text-[11px] text-faint">Elige un archivo para verlo.</p>

              <div className="mt-2 space-y-1.5 text-[11px] text-faint">
                <p className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span>
                    <kbd className="font-mono">j</kbd> /{" "}
                    <kbd className="font-mono">k</kbd> para navegar
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span>
                    <kbd className="font-mono">Espacio</kbd> para vista rápida
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span>
                    <kbd className="font-mono">⌘K</kbd> para comandos
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex h-[38%] min-h-[220px] shrink-0 flex-col border-t border-line">
        <CommentPanel
          vaultId={vault.id}
          assetId={asset?.id ?? null}
          comments={comments}
          title={asset ? "Notas del archivo" : "Notas del baúl"}
        />
      </div>
    </div>
  );
}
