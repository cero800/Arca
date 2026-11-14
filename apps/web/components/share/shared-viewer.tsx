"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, MessageSquare } from "lucide-react";
import type { ExplorerAsset, ExplorerComment } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { AssetList, AssetSearch, ViewToggle } from "@/components/explorer/asset-list";
import { PreviewPanel } from "@/components/explorer/preview-panel";
import { QuickLook } from "@/components/explorer/quick-look";
import { GuestCommentForm } from "@/components/comments/guest-comment-form";
import { Brand } from "@/components/shell/brand";

function matchesQuery(asset: ExplorerAsset, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    asset.name.toLowerCase().includes(needle) ||
    asset.kind.toLowerCase().includes(needle) ||
    asset.mime.toLowerCase().includes(needle)
  );
}

/** Vista pública de un baúl compartido: sin subida, ajustes ni papelera. */
export function SharedViewer({
  token,
  role,
  vault,
  assets,
  comments,
}: {
  token: string;
  role: "viewer" | "commenter";
  vault: { id: string; name: string; description: string; assetCount: number };
  assets: ExplorerAsset[];
  comments: ExplorerComment[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickLookOpen, setQuickLookOpen] = useState(false);

  const visible = useMemo(
    () => assets.filter((asset) => matchesQuery(asset, query)),
    [assets, query],
  );

  const selected = selectedId
    ? assets.find((asset) => asset.id === selectedId) ?? null
    : null;
  const selectedIndex = selected
    ? visible.findIndex((asset) => asset.id === selected.id)
    : -1;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setMobileOpen(true);
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      if (visible.length === 0) return;
      const current = selected
        ? visible.findIndex((asset) => asset.id === selected.id)
        : -1;
      const nextIndex =
        current === -1
          ? direction === 1
            ? 0
            : visible.length - 1
          : (current + direction + visible.length) % visible.length;
      const next = visible[nextIndex];
      if (next) setSelectedId(next.id);
    },
    [selected, visible],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
  }, [quickLookOpen, selected, step]);

  useEffect(() => {
    if (quickLookOpen && (!selected || selectedIndex < 0)) {
      setQuickLookOpen(false);
    }
  }, [quickLookOpen, selected, selectedIndex]);

  const canComment = role === "commenter";

  const composer = canComment ? (
    <GuestCommentForm shareToken={token} assetId={selected?.id ?? null} />
  ) : (
    <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-faint">
      <Lock className="mt-0.5 h-3 w-3 shrink-0" />
      Solo lectura. Pide un enlace con permiso de comentarios para dejar notas.
    </p>
  );

  return (
    <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line px-4">
        <Brand />

        <span className="hidden h-5 w-px shrink-0 bg-line sm:block" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate font-display text-[18px] font-semibold leading-none text-ink">
              {vault.name}
            </h1>
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-faint sm:inline">
              {vault.assetCount} {vault.assetCount === 1 ? "archivo" : "archivos"}
            </span>
          </div>
          {vault.description ? (
            <p className="mt-1 truncate text-[11.5px] text-muted">{vault.description}</p>
          ) : null}
        </div>

        <Badge tone={canComment ? "accent" : "neutral"} className="shrink-0">
          {canComment ? (
            <>
              <MessageSquare className="mr-1 h-3 w-3" />
              Puede comentar
            </>
          ) : (
            <>
              <Lock className="mr-1 h-3 w-3" />
              Solo lectura
            </>
          )}
        </Badge>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-0 min-w-0 flex-col">
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
            />
          </div>
        </section>

        <aside className="hidden min-h-0 border-l border-line lg:flex lg:flex-col">
          <PreviewPanel
            vault={vault}
            asset={selected}
            comments={comments}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
            onQuickLook={() => setQuickLookOpen(true)}
            readOnly
            shareToken={token}
            composer={composer}
            privacyLabel={
              canComment ? "Enlace privado · comentarios" : "Enlace privado · solo lectura"
            }
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
              readOnly
              shareToken={token}
              composer={composer}
              privacyLabel={
                canComment ? "Enlace privado · comentarios" : "Enlace privado · solo lectura"
              }
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
            shareToken={token}
          />
        ) : null}
      </div>
    </div>
  );
}
