"use client";

import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { formatBytes } from "@/lib/utils";

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  loaded: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  deduped?: boolean;
};

export function UploadTray({
  items,
  onClear,
}: {
  items: UploadItem[];
  onClear: () => void;
}) {
  if (items.length === 0) return null;

  const active = items.filter((item) => item.status === "uploading" || item.status === "queued");
  const done = items.filter((item) => item.status === "done");
  const total = items.length;

  return (
    <div className="absolute bottom-4 left-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[12px] border border-line bg-surface-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
      <header className="flex h-10 items-center justify-between border-b border-line px-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          {active.length > 0 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          ) : (
            <Check className="h-3.5 w-3.5 text-ok" />
          )}
          {active.length > 0
            ? `Subiendo ${total - active.length + 1} de ${total}`
            : `${done.length} ${done.length === 1 ? "archivo listo" : "archivos listos"}`}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded p-1 text-faint transition-colors hover:bg-white/5 hover:text-ink"
          aria-label="Cerrar bandeja de subidas"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <ul className="max-h-56 overflow-y-auto p-2">
        {items.map((item) => {
          const percent =
            item.size > 0 ? Math.min(100, Math.round((item.loaded / item.size) * 100)) : 0;

          return (
            <li key={item.id} className="rounded-[8px] px-1.5 py-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                  {item.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-faint">
                  {item.status === "error"
                    ? "error"
                    : item.status === "done"
                      ? item.deduped
                        ? "ya existía"
                        : "listo"
                      : `${percent}%`}
                </span>
              </div>

              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={
                    item.status === "error"
                      ? "h-full rounded-full bg-danger/70"
                      : item.status === "done"
                        ? "h-full rounded-full bg-ok/70"
                        : "h-full rounded-full bg-accent transition-[width] duration-200"
                  }
                  style={{ width: `${item.status === "error" ? 100 : percent}%` }}
                />
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="font-mono text-[9.5px] text-faint">
                  {formatBytes(item.loaded)} / {formatBytes(item.size)}
                </span>
                {item.status === "error" ? (
                  <span className="flex items-center gap-1 text-[9.5px] text-danger">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {item.error ?? "Falló"}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
