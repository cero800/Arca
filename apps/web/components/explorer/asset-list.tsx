"use client";

import { useMemo } from "react";
import { LayoutGrid, List, Search, UploadCloud } from "lucide-react";
import type { ExplorerAsset } from "@/lib/queries";
import { formatBytes, relativeTime, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { UploadButton } from "@/components/upload/upload-button";
import { FileIcon, kindLabel } from "./file-icon";

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") return null;
  if (status === "error") return <Badge tone="danger">error</Badge>;
  if (status === "uploading") return <Badge tone="accent">subiendo</Badge>;
  return <Badge tone="warn">procesando</Badge>;
}

function Thumb({ asset, className }: { asset: ExplorerAsset; className?: string }) {
  const thumb = asset.derivatives.find((item) => item.type === "thumb")?.url;

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[6px] border border-line bg-surface-3 text-faint",
        className,
      )}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <FileIcon kind={asset.kind} className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

export function AssetList({
  assets,
  selectedId,
  onSelect,
  view,
  hasAssets,
  onFiles,
}: {
  assets: ExplorerAsset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  view: "list" | "grid";
  hasAssets: boolean;
  onFiles?: (files: File[]) => void;
}) {
  if (!hasAssets) {
    return (
      <div className="grid h-full place-items-center px-6 py-10">
        <div className="max-w-[380px] text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-[14px] border border-dashed border-line-strong bg-surface-2 text-faint">
            <UploadCloud className="h-6 w-6" strokeWidth={1.25} />
          </div>
          <h2 className="font-display text-[20px] font-semibold text-ink">
            {onFiles ? "Este baúl está vacío" : "Todavía no hay archivos"}
          </h2>
          <p className="mx-auto mt-1.5 max-w-[300px] text-[12.5px] leading-relaxed text-muted">
            {onFiles
              ? "Arrastra fotos, videos, documentos o texto aquí. Todo queda privado y organizado en un solo lugar."
              : "Quien compartió este baúl aún no ha guardado nada. Vuelve más tarde."}
          </p>
          {onFiles ? (
            <>
              <UploadButton
                onFiles={onFiles}
                label="Subir los primeros archivos"
                className="mt-5"
              />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                Hasta 1 GB por archivo · 10 GB en total
              </p>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6">
        <div className="text-center">
          <Search className="mx-auto h-5 w-5 text-faint" />
          <p className="mt-3 text-[13px] text-muted">Nada coincide con esa búsqueda.</p>
          <p className="mt-1 text-[11.5px] text-faint">Prueba con otro nombre o tipo.</p>
        </div>
      </div>
    );
  }

  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {assets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            data-asset-row
            onClick={() => onSelect(asset.id)}
            className={cn(
              "group overflow-hidden rounded-[11px] border border-line bg-surface-1 text-left transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-line-strong",
              selectedId === asset.id &&
                "border-accent/50 ring-1 ring-accent/30 hover:border-accent/60",
            )}
          >
            <span className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line bg-surface-2">
              {asset.derivatives.find((item) => item.type === "thumb")?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    asset.derivatives.find((item) => item.type === "thumb")?.url ?? ""
                  }
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <FileIcon kind={asset.kind} className="h-7 w-7 text-faint" />
              )}
              <span className="absolute right-2 top-2">
                <StatusBadge status={asset.status} />
              </span>
            </span>
            <span className="block px-3 py-2.5">
              <span className="block truncate text-[12.5px] font-medium text-ink">
                {asset.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-faint">
                <span>{kindLabel(asset.kind)}</span>
                <span className="text-white/15">·</span>
                <span>{formatBytes(asset.size)}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_84px_80px] items-center gap-3 border-b border-line bg-bg/85 px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint backdrop-blur-md sm:grid-cols-[minmax(0,1fr)_84px_80px_96px]">
        <span>Nombre</span>
        <span className="hidden sm:block">Tipo</span>
        <span className="text-right">Tamaño</span>
        <span className="hidden text-right sm:block">Modificado</span>
      </div>

      <ul className="divide-y divide-line/60">
        {assets.map((asset) => (
          <li key={asset.id}>
            <button
              type="button"
              data-asset-row
              onClick={() => onSelect(asset.id)}
              aria-current={selectedId === asset.id ? "true" : undefined}
              className={cn(
                "group grid w-full grid-cols-[minmax(0,1fr)_84px_80px] items-center gap-3 px-4 py-2 text-left transition-colors duration-100 hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_84px_80px_96px]",
                selectedId === asset.id && "bg-accent/[0.07] hover:bg-accent/[0.09]",
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Thumb asset={asset} className="h-8 w-8" />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-[12.5px] font-medium",
                        selectedId === asset.id ? "text-ink" : "text-ink/90",
                      )}
                    >
                      {asset.name}
                    </span>
                    <StatusBadge status={asset.status} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-faint sm:hidden">
                    {kindLabel(asset.kind)}
                    <span className="text-white/15">·</span>
                    {formatBytes(asset.size)}
                  </span>
                </span>
              </span>

              <span className="hidden text-[11.5px] text-muted sm:block">
                {kindLabel(asset.kind)}
              </span>

              <span className="text-right font-mono text-[10.5px] text-faint">
                {formatBytes(asset.size)}
              </span>

              <span className="hidden text-right font-mono text-[10.5px] text-faint sm:block">
                {relativeTime(asset.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: "list" | "grid";
  onChange: (view: "list" | "grid") => void;
}) {
  return (
    <div className="flex items-center rounded-[8px] border border-line bg-surface-1 p-0.5">
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={view === "list"}
        aria-label="Vista de lista"
        className={cn(
          "grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors",
          view === "list" ? "bg-surface-3 text-ink" : "hover:text-muted",
        )}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={view === "grid"}
        aria-label="Vista de cuadrícula"
        className={cn(
          "grid h-7 w-7 place-items-center rounded-[6px] text-faint transition-colors",
          view === "grid" ? "bg-surface-3 text-ink" : "hover:text-muted",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AssetSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const hint = useMemo(() => (value ? "Esc para limpiar" : "Buscar por nombre"), [value]);

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
      <input
        id="arca-asset-search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        placeholder={hint}
        className="h-8 w-full rounded-[8px] border border-line bg-bg/50 pl-8 pr-3 text-[12.5px] text-ink placeholder:text-faint transition-colors hover:border-line-strong focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15"
      />
    </div>
  );
}
