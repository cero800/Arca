"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, Plus } from "lucide-react";
import type { VaultSummary } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";

export function MobileBar({ vaults }: { vaults: VaultSummary[] }) {
  const pathname = usePathname();

  return (
    <header className="shrink-0 border-b border-line bg-surface-1/60 lg:hidden">
      <div className="flex h-[52px] items-center justify-between px-4">
        <Link href="/" aria-label="Arca, inicio">
          <Brand />
        </Link>
        <Link
          href="/v/new"
          aria-label="Nuevo baúl"
          className="grid h-8 w-8 place-items-center rounded-[8px] border border-line bg-surface-2 text-muted transition-colors hover:text-ink"
        >
          <Plus className="h-4 w-4" />
        </Link>
      </div>

      <nav
        aria-label="Baúles"
        className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]"
      >
        {vaults.map((vault) => {
          const active =
            pathname === `/v/${vault.slug}` || pathname.startsWith(`/v/${vault.slug}/`);

          return (
            <Link
              key={vault.id}
              href={`/v/${vault.slug}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] transition-colors",
                active
                  ? "border-accent/30 bg-accent-soft text-ink"
                  : "border-line bg-surface-2/60 text-muted",
              )}
            >
              <Archive
                className={cn("h-3 w-3", active ? "text-accent" : "text-faint")}
                strokeWidth={1.6}
              />
              {vault.name}
              <span className="font-mono text-[9.5px] text-faint">{vault.assetCount}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
