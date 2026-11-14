"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CornerDownLeft,
  FileUp,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import type { ExplorerAsset, VaultSummary } from "@/lib/queries";
import { cn, formatBytes } from "@/lib/utils";
import { FileIcon, kindLabel } from "./file-icon";

type PaletteItem = {
  id: string;
  group: "Baúles" | "Acciones" | "Archivos";
  label: string;
  hint?: string;
  keywords?: string;
  icon: React.ReactNode;
  run: () => void;
};

/**
 * Paleta de comandos (⌘K / Ctrl+K).
 *
 * Búsqueda local: baúles, acciones del baúl actual y archivos visibles.
 * Sin dependencias externas; el teclado se maneja en el propio diálogo.
 */
export function CommandPalette({
  open,
  onClose,
  vaults,
  vault,
  assets,
  onUpload,
  onOpenAsset,
  onViewChange,
}: {
  open: boolean;
  onClose: () => void;
  vaults: VaultSummary[];
  vault: VaultSummary;
  assets: ExplorerAsset[];
  onUpload: () => void;
  onOpenAsset: (id: string) => void;
  onViewChange: (view: "list" | "grid") => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = vaults.map((item) => ({
      id: `vault-${item.id}`,
      group: "Baúles",
      label: item.name,
      hint: `${item.assetCount} ${item.assetCount === 1 ? "archivo" : "archivos"}`,
      keywords: `${item.name} ${item.slug}`,
      icon: <Archive className="h-4 w-4" strokeWidth={1.5} />,
      run: () => router.push(`/v/${item.slug}`),
    }));

    list.push(
      {
        id: "action-upload",
        group: "Acciones",
        label: "Subir archivos",
        hint: "hasta 1 GB",
        keywords: "subir adjuntar importar",
        icon: <FileUp className="h-4 w-4" strokeWidth={1.5} />,
        run: onUpload,
      },
      {
        id: "action-new-vault",
        group: "Acciones",
        label: "Nuevo baúl",
        keywords: "crear baul carpeta",
        icon: <Plus className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push("/v/new"),
      },
      {
        id: "action-settings",
        group: "Acciones",
        label: "Ajustes del baúl",
        hint: vault.name,
        keywords: "configuracion nombre descripcion",
        icon: <Settings2 className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push(`/v/${vault.slug}/settings`),
      },
      {
        id: "action-trash",
        group: "Acciones",
        label: "Abrir papelera",
        keywords: "borrados restaurar eliminar",
        icon: <Trash2 className="h-4 w-4" strokeWidth={1.5} />,
        run: () => router.push(`/v/${vault.slug}/trash`),
      },
      {
        id: "action-view-list",
        group: "Acciones",
        label: "Vista de lista",
        keywords: "lista filas",
        icon: <List className="h-4 w-4" strokeWidth={1.5} />,
        run: () => onViewChange("list"),
      },
      {
        id: "action-view-grid",
        group: "Acciones",
        label: "Vista de cuadrícula",
        keywords: "grid cuadricula mosaico",
        icon: <LayoutGrid className="h-4 w-4" strokeWidth={1.5} />,
        run: () => onViewChange("grid"),
      },
    );

    return list;
  }, [vaults, vault.name, vault.slug, onUpload, onViewChange, router]);

  const needle = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return items;

    const matches = items.filter((item) =>
      `${item.label} ${item.hint ?? ""} ${item.keywords ?? ""}`
        .toLowerCase()
        .includes(needle),
    );

    const assetMatches = assets
      .filter((asset) =>
        `${asset.name} ${asset.kind} ${asset.mime}`.toLowerCase().includes(needle),
      )
      .slice(0, 20)
      .map<PaletteItem>((asset) => ({
        id: `asset-${asset.id}`,
        group: "Archivos",
        label: asset.name,
        hint: `${kindLabel(asset.kind)} · ${formatBytes(asset.size)}`,
        keywords: `${asset.name} ${asset.kind} ${asset.mime}`,
        icon: <FileIcon kind={asset.kind} className="h-4 w-4" />,
        run: () => onOpenAsset(asset.id),
      }));

    return [...matches, ...assetMatches];
  }, [assets, items, needle, onOpenAsset]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setActive((current) =>
      Math.min(current, Math.max(0, filtered.length - 1)),
    );
  }, [filtered.length]);

  if (!open) return null;

  const current = filtered[Math.min(active, Math.max(0, filtered.length - 1))];

  function run(item: PaletteItem) {
    onClose();
    item.run();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (current) run(current);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  let lastGroup: PaletteItem["group"] | null = null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onKeyDown={onKeyDown}
        className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-line bg-surface-1 shadow-panel"
      >
        <div className="flex h-12 items-center gap-2.5 border-b border-line px-3.5">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar baúles, acciones o archivos…"
            aria-label="Buscar comando"
            aria-controls="arca-command-list"
            aria-activedescendant={current ? `arca-command-${current.id}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none"
          />
          <kbd className="shrink-0 rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">
            esc
          </kbd>
        </div>

        <ul
          id="arca-command-list"
          role="listbox"
          aria-label="Resultados"
          className="max-h-[min(58vh,420px)] overflow-y-auto p-1.5"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-[12.5px] text-muted">
              Nada coincide con «{query.trim()}».
            </li>
          ) : null}

          {filtered.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const isActive = index === active;

            return (
              <li key={item.id}>
                {header ? (
                  <div className="px-2.5 pb-1 pt-2.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
                    {header}
                  </div>
                ) : null}
                <button
                  id={`arca-command-${item.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(item)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left transition-colors",
                    isActive ? "bg-accent-soft text-ink" : "text-muted hover:bg-white/[0.03]",
                  )}
                >
                  <span className={cn("shrink-0", isActive ? "text-accent" : "text-faint")}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.label}</span>
                  {item.hint ? (
                    <span className="shrink-0 font-mono text-[10px] text-faint">
                      {item.hint}
                    </span>
                  ) : null}
                  {isActive ? (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-line px-3.5 py-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[4px] border border-line px-1 py-0.5">↑↓</kbd>
            mover
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[4px] border border-line px-1 py-0.5">↵</kbd>
            abrir
          </span>
          <span className="ml-auto normal-case tracking-normal">⌘K</span>
        </div>
      </div>
    </div>
  );
}
