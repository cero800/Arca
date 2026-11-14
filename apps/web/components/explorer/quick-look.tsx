"use client";

import { useEffect, useRef } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import type { ExplorerAsset } from "@/lib/queries";
import { formatBytes, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AssetPreview } from "./preview-panel";
import { FileIcon, kindLabel } from "./file-icon";

/**
 * Vista rápida a pantalla completa.
 *
 * No tiene atajos propios: `Explorer` sigue siendo el único dueño del teclado
 * (Espacio cierra, j/k y flechas cambian de archivo).
 */
export function QuickLook({
  asset,
  index,
  total,
  onClose,
  onPrevious,
  onNext,
  shareToken,
}: {
  asset: ExplorerAsset;
  index: number;
  total: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  shareToken?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vista rápida de ${asset.name}`}
      className="fixed inset-0 z-[70] flex flex-col bg-bg/95 backdrop-blur-md"
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
        <FileIcon kind={asset.kind} className="h-4 w-4 shrink-0 text-faint" />

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h2 className="truncate text-[13px] font-medium text-ink">{asset.name}</h2>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {index + 1} / {total}
          </span>
        </div>

        <Badge tone="neutral" className="hidden shrink-0 sm:inline-flex">
          {kindLabel(asset.kind)}
        </Badge>

        <div className="flex shrink-0 items-center gap-0.5">
          {asset.originalUrl ? (
            <>
              <a
                href={asset.originalUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Abrir original"
                className="grid h-8 w-8 place-items-center rounded-[7px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={asset.originalUrl}
                download={asset.name}
                aria-label="Descargar original"
                className="grid h-8 w-8 place-items-center rounded-[7px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
              >
                <Download className="h-4 w-4" />
              </a>
            </>
          ) : null}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista rápida"
            className="grid h-8 w-8 place-items-center rounded-[7px] text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <AssetPreview asset={asset} large shareToken={shareToken} />
      </div>

      <footer className="flex h-10 shrink-0 items-center gap-4 border-t border-line px-4 font-mono text-[10px] text-faint">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="uppercase tracking-[0.12em]">{kindLabel(asset.kind)}</span>
          <span className="text-white/15">·</span>
          <span>{formatBytes(asset.size)}</span>
          <span className="text-white/15">·</span>
          <span>{relativeTime(asset.createdAt)}</span>
        </span>

        <span className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
          <button
            type="button"
            onClick={onPrevious}
            className="rounded-[5px] border border-line px-1.5 py-0.5 transition-colors hover:border-line-strong hover:text-ink"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-[5px] border border-line px-1.5 py-0.5 transition-colors hover:border-line-strong hover:text-ink"
          >
            →
          </button>
          <span>navegar</span>
          <span className="text-white/15">·</span>
          <kbd className="rounded-[4px] border border-line px-1.5 py-0.5">Espacio</kbd>
          <span>cerrar</span>
        </span>
      </footer>
    </div>
  );
}
