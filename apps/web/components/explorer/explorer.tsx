"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Command, Settings2, Trash2, UploadCloud } from "lucide-react";
import type { ExplorerAsset, ExplorerComment, VaultSummary } from "@/lib/queries";
import { MAX_UPLOAD_BYTES, uploadFile } from "@/lib/upload-client";

import { UploadButton } from "@/components/upload/upload-button";
import { UploadTray, type UploadItem } from "@/components/upload/upload-tray";
import { AssetList, AssetSearch, ViewToggle } from "./asset-list";
import { CommandPalette } from "./command-palette";
import { PreviewPanel } from "./preview-panel";
import { QuickLook } from "./quick-look";

let uploadSeq = 0;

/** Normaliza archivos pegados: algunos navegadores llegan sin nombre. */
function clipboardFiles(data: DataTransfer): File[] {
  const files = Array.from(data.files);
  if (files.length === 0) {
    for (const item of Array.from(data.items)) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  const stamp = Date.now();
  return files.map((file) => {
    if (file.name) return file;
    const extension = file.type.split("/")[1]?.split(";")[0] || "bin";
    return new File([file], `pegado-${stamp}.${extension}`, { type: file.type });
  });
}

function matchesQuery(asset: ExplorerAsset, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    asset.name.toLowerCase().includes(needle) ||
    asset.kind.toLowerCase().includes(needle) ||
    asset.mime.toLowerCase().includes(needle)
  );
}

export function Explorer({
  vault,
  vaults,
  assets,
  comments,
}: {
  vault: VaultSummary;
  vaults: VaultSummary[];
  assets: ExplorerAsset[];
  comments: ExplorerComment[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickLookOpen, setQuickLookOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => assets.filter((asset) => matchesQuery(asset, query)),
    [assets, query],
  );

  const selected = selectedId ? assets.find((asset) => asset.id === selectedId) ?? null : null;
  const selectedIndex = selected ? visible.findIndex((asset) => asset.id === selected.id) : -1;

  const hasProcessing = assets.some(
    (asset) => asset.status === "processing" || asset.status === "uploading",
  );
  const uploadsActive = uploads.some(
    (item) => item.status === "queued" || item.status === "uploading",
  );

  /* Refresca mientras el worker tenga trabajo pendiente. */
  useEffect(() => {
    if (!hasProcessing && !uploadsActive) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [hasProcessing, uploadsActive, router]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setMobileOpen(true);
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (visible.length === 0) return;
      const current = selected ? visible.findIndex((asset) => asset.id === selected.id) : -1;
      const nextIndex =
        current === -1
          ? direction === 1
            ? 0
            : visible.length - 1
          : (current + direction + visible.length) % visible.length;
      const next = visible[nextIndex];
      if (next) select(next.id);
    },
    [visible, selected, select],
  );

  /* Atajos: ⌘K comandos, Espacio vista rápida, j/k o flechas, Esc, "/" buscar. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickLookOpen(false);
        setPaletteOpen((value) => !value);
        return;
      }

      if (paletteOpen) return;

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (typing) return;

      if (event.key === " " || event.key === "Spacebar") {
        if (!selected) return;
        const interactive = target?.closest(
          "button, a, input, textarea, select, [role='button']",
        );
        const fromRow = target?.closest("[data-asset-row]");
        if (interactive && !fromRow) return;
        event.preventDefault();
        setQuickLookOpen((value) => !value);
      } else if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        step(1);
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "Escape") {
        if (quickLookOpen) {
          setQuickLookOpen(false);
          return;
        }
        setMobileOpen(false);
        setSelectedId(null);
      } else if (event.key === "/") {
        event.preventDefault();
        document.getElementById("arca-asset-search")?.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen, quickLookOpen, selected, step]);

  /* Si el filtro deja fuera el archivo abierto, cierra la vista rápida. */
  useEffect(() => {
    if (quickLookOpen && (!selected || selectedIndex < 0)) {
      setQuickLookOpen(false);
    }
  }, [quickLookOpen, selected, selectedIndex]);

  const pushFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const accepted = files.filter((file) => file.size <= MAX_UPLOAD_BYTES);
      const oversized = files.filter((file) => file.size > MAX_UPLOAD_BYTES);

      const queued = accepted.map((file) => ({
        id: `up-${(uploadSeq += 1)}`,
        file,
        item: {
          id: `up-${uploadSeq}`,
          name: file.name,
          size: file.size,
          loaded: 0,
          status: "queued" as const,
        },
      }));

      if (queued.length === 0 && oversized.length === 0) return;

      setUploads((previous) => [
        ...previous.filter((item) => item.status !== "done"),
        ...queued.map((entry) => entry.item),
        ...oversized.map((file) => ({
          id: `up-${(uploadSeq += 1)}`,
          name: file.name,
          size: file.size,
          loaded: 0,
          status: "error" as const,
          error: "Supera 1 GB",
        })),
      ]);

      const queue = [...queued];

      const run = async () => {
        for (;;) {
          const entry = queue.shift();
          if (!entry) return;

          setUploads((previous) =>
            previous.map((item) =>
              item.id === entry.item.id ? { ...item, status: "uploading" } : item,
            ),
          );

          try {
            const result = await uploadFile(entry.file, vault.id, (progress) => {
              setUploads((previous) =>
                previous.map((item) =>
                  item.id === entry.item.id
                    ? { ...item, loaded: progress.loaded, status: "uploading" }
                    : item,
                ),
              );
            });

            setUploads((previous) =>
              previous.map((item) =>
                item.id === entry.item.id
                  ? {
                      ...item,
                      loaded: entry.file.size,
                      status: "done",
                      deduped: result.deduped,
                    }
                  : item,
              ),
            );
          } catch (cause) {
            setUploads((previous) =>
              previous.map((item) =>
                item.id === entry.item.id
                  ? {
                      ...item,
                      status: "error",
                      error: cause instanceof Error ? cause.message : "Falló la subida",
                    }
                  : item,
              ),
            );
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(2, queue.length) }, run));
      router.refresh();
    },
    [router, vault.id],
  );

  /* Pegar imágenes o archivos desde el portapapeles sube al baúl actual. */
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const files = clipboardFiles(event.clipboardData as DataTransfer);
      if (files.length === 0) return;

      event.preventDefault();
      void pushFiles(files);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pushFiles]);

  const requestUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const openFromPalette = useCallback(
    (id: string) => {
      setQuery("");
      setSelectedId(id);
      setQuickLookOpen(true);
    },
    [],
  );

  const clearUploads = useCallback(() => {
    setUploads((previous) => previous.filter((item) => item.status !== "done"));
  }, []);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_380px]"
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const files = Array.from(event.dataTransfer.files ?? []);
        if (files.length > 0) void pushFiles(files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void pushFiles(files);
          event.target.value = "";
        }}
      />

      <section className="flex min-h-0 min-w-0 flex-col">
        <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line px-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="truncate font-display text-[19px] font-semibold leading-none text-ink">
                {vault.name}
              </h1>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                {vault.assetCount} {vault.assetCount === 1 ? "archivo" : "archivos"}
              </span>
            </div>
            {vault.description ? (
              <p className="mt-1 truncate text-[11.5px] text-muted">{vault.description}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setQuickLookOpen(false);
                setPaletteOpen(true);
              }}
              aria-label="Buscar y ejecutar comandos"
              title="Comandos (⌘K)"
              className="grid h-8 w-8 place-items-center rounded-[8px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Command className="h-4 w-4" />
            </button>
            <Link
              href={`/v/${vault.slug}/settings`}
              aria-label="Ajustes del baúl"
              className="grid h-8 w-8 place-items-center rounded-[8px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
            <Link
              href={`/v/${vault.slug}/trash`}
              aria-label="Papelera"
              className="grid h-8 w-8 place-items-center rounded-[8px] text-faint transition-colors hover:bg-white/5 hover:text-ink"
            >
              <Trash2 className="h-4 w-4" />
            </Link>
            <UploadButton onFiles={(files) => void pushFiles(files)} label="Subir" />
          </div>
        </header>

        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
          <AssetSearch value={query} onChange={setQuery} />
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AssetList
            assets={visible}
            selectedId={selectedId}
            onSelect={select}
            view={view}
            hasAssets={assets.length > 0}
            onFiles={(files) => void pushFiles(files)}
          />
        </div>

        <UploadTray items={uploads} onClear={clearUploads} />

        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-bg/80 backdrop-blur-[2px]">
            <div className="flex flex-col items-center rounded-[16px] border border-dashed border-accent/50 bg-accent/[0.06] px-10 py-8">
              <UploadCloud className="h-7 w-7 text-accent" />
              <p className="mt-3 font-display text-[16px] font-semibold text-ink">
                Suelta para guardar en {vault.name}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                Hasta 1 GB por archivo
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="hidden min-h-0 border-l border-line lg:flex lg:flex-col">
        <PreviewPanel
          vault={vault}
          asset={selected}
          comments={comments}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
          onQuickLook={() => setQuickLookOpen(true)}
          className="min-h-0 flex-1"
        />
      </aside>

      {mobileOpen && selected ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg lg:hidden">
          <PreviewPanel
            vault={vault}
            asset={selected}
            comments={comments}
            onClose={() => setMobileOpen(false)}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
            onQuickLook={() => setQuickLookOpen(true)}
            className="min-h-0 flex-1"
          />
        </div>
      ) : null}

      {quickLookOpen && selected && selectedIndex >= 0 ? (
        <QuickLook
          asset={selected}
          index={selectedIndex}
          total={visible.length}
          onClose={() => setQuickLookOpen(false)}
          onPrevious={() => step(-1)}
          onNext={() => step(1)}
        />
      ) : null}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        vaults={vaults}
        vault={vault}
        assets={assets}
        onUpload={requestUpload}
        onOpenAsset={openFromPalette}
        onViewChange={setView}
      />

      {selected ? (
        <span className="sr-only" aria-live="polite">
          {selected.name}, {selectedIndex + 1} de {visible.length}
        </span>
      ) : null}
    </div>
  );
}
