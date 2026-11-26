"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MessageSquare,
  X,
} from "lucide-react";
import type { ExplorerAsset, ExplorerComment } from "@/lib/queries";
import { formatBytes, formatDuration, relativeTime, cn } from "@/lib/utils";
import { CommentForm } from "@/components/comments/comment-form";
import { CommentPanel } from "@/components/comments/comment-panel";
import { kindLabel } from "./file-icon";
import { AssetPreview, MetaRow } from "./preview-panel";
import { TrashAssetButton } from "./asset-actions";

export type MobileTab = "preview" | "notes" | "details";

type MobileVault = {
  id: string;
  name: string;
  description: string;
  assetCount: number;
};

function countNotes(comments: ExplorerComment[], assetId: string | null): number {
  return comments.filter((item) =>
    assetId
      ? item.assetId === assetId
      : item.assetId === null && item.parentId === null,
  ).length;
}

/**
 * Panel inferior para móvil: la lista sigue visible detrás y las notas van
 * en su propia pestaña. Los detalles son la última pestaña, a petición.
 */
export function MobileAssetSheet({
  vault,
  asset,
  comments,
  initialTab = "preview",
  onClose,
  onPrevious,
  onNext,
  onQuickLook,
  readOnly = false,
  shareToken,
  composer,
  privacyLabel = "Solo tú · enlace privado",
}: {
  vault: MobileVault;
  asset: ExplorerAsset | null;
  comments: ExplorerComment[];
  initialTab?: "preview" | "notes";
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onQuickLook?: () => void;
  readOnly?: boolean;
  shareToken?: string;
  composer?: React.ReactNode | null;
  privacyLabel?: string;
}) {
  const [tab, setTab] = useState<MobileTab>(asset ? initialTab : "notes");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const tabs: Array<{ id: MobileTab; label: string; icon?: React.ReactNode }> = asset
    ? [
        { id: "preview", label: "Vista previa" },
        {
          id: "notes",
          label: `Notas (${countNotes(comments, asset.id)})`,
          icon: <MessageSquare className="h-3.5 w-3.5" />,
        },
        { id: "details", label: "Detalles" },
      ]
    : [
        {
          id: "notes",
          label: `Notas (${countNotes(comments, null)})`,
          icon: <MessageSquare className="h-3.5 w-3.5" />,
        },
        { id: "details", label: "Detalles" },
      ];

  function onDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === "Tab") {
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if ((event.target as HTMLElement).getAttribute("role") !== "tab") return;
    event.preventDefault();
    const index = tabs.findIndex((item) => item.id === tab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    if (next) setTab(next.id);
  }

  const noteComposer =
    composer === undefined
      ? <CommentForm vaultId={vault.id} assetId={asset?.id ?? undefined} />
      : composer;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar panel"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={asset ? `Archivo ${asset.name}` : `Notas de ${vault.name}`}
        onKeyDown={onDialogKeyDown}
        className="absolute inset-x-0 bottom-0 flex h-[min(88dvh,820px)] flex-col overflow-hidden rounded-t-[18px] border-t border-line bg-surface-1 shadow-[0_-24px_60px_-24px_rgb(0_0_0/0.9)]"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong"
        />

        <header className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2.5">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-[12px] font-medium text-ink">
              {asset ? asset.name : `Notas de ${vault.name}`}
            </p>
          </div>

          {asset ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={onPrevious}
                aria-label="Archivo anterior"
                className="grid h-8 w-8 place-items-center rounded-[7px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label="Archivo siguiente"
                className="grid h-8 w-8 place-items-center rounded-[7px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {asset.originalUrl ? (
                <a
                  href={asset.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir original"
                  className="grid h-8 w-8 place-items-center rounded-[7px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              ) : null}
              {onQuickLook ? (
                <button
                  type="button"
                  onClick={onQuickLook}
                  aria-label="Abrir vista rápida"
                  className="grid h-8 w-8 place-items-center rounded-[7px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
              {readOnly ? null : (
                <TrashAssetButton assetId={asset.id} assetName={asset.name} />
              )}
            </div>
          ) : null}
        </header>

        <div
          role="tablist"
          aria-label="Vistas del archivo"
          className="flex h-10 shrink-0 items-stretch border-b border-line px-2"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              id={`arca-sheet-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`arca-sheet-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative flex h-full flex-1 items-center justify-center gap-1.5 text-[11.5px] transition-colors",
                tab === item.id ? "text-ink" : "text-faint hover:text-muted",
              )}
            >
              {item.icon}
              {item.label}
              {tab === item.id ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 bottom-0 h-px bg-accent"
                />
              ) : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "preview" && asset ? (
            <div
              id="arca-sheet-panel-preview"
              role="tabpanel"
              aria-labelledby="arca-sheet-tab-preview"
              className="h-full min-h-0"
            >
              <AssetPreview asset={asset} shareToken={shareToken} />
            </div>
          ) : null}

          {tab === "details" ? (
            <div
              id="arca-sheet-panel-details"
              role="tabpanel"
              aria-labelledby="arca-sheet-tab-details"
              className="sheet-scroll h-full overflow-y-auto px-4 py-3"
            >
              {asset ? (
                <dl>
                  <MetaRow label="Tipo" value={`${kindLabel(asset.kind)} · ${asset.mime}`} />
                  <MetaRow label="Tamaño" value={formatBytes(asset.size)} />
                  {asset.width && asset.height ? (
                    <MetaRow label="Dimensiones" value={`${asset.width} × ${asset.height}`} />
                  ) : null}
                  {asset.durationMs ? (
                    <MetaRow label="Duración" value={formatDuration(asset.durationMs)} />
                  ) : null}
                  <MetaRow label="Añadido" value={relativeTime(asset.createdAt)} />
                  {asset.caption ? <MetaRow label="Nota" value={asset.caption} /> : null}
                </dl>
              ) : (
                <div>
                  <p className="text-[12.5px] leading-relaxed text-muted">
                    {vault.description ||
                      "Sin descripción todavía. Añade una nota para recordar qué guarda este baúl y por qué."}
                  </p>
                  <dl className="mt-4">
                    <MetaRow label="Archivos" value={`${vault.assetCount}`} />
                    <MetaRow label="Privacidad" value={privacyLabel} />
                  </dl>
                </div>
              )}
            </div>
          ) : null}

          {tab === "notes" ? (
            <div
              id="arca-sheet-panel-notes"
              role="tabpanel"
              aria-labelledby="arca-sheet-tab-notes"
              className="h-full min-h-0"
            >
              <CommentPanel
                vaultId={vault.id}
                assetId={asset?.id ?? null}
                comments={comments}
                title={asset ? "Notas del archivo" : "Notas del baúl"}
                composer={
                  noteComposer === null ? null : <div className="safe-bottom">{noteComposer}</div>
                }
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
