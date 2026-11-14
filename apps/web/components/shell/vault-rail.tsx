"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, HardDrive, LogOut, Plus, Settings2 } from "lucide-react";
import type { VaultSummary } from "@/lib/queries";
import { formatBytes, cn } from "@/lib/utils";
import { signOutAction } from "@/lib/actions/auth";
import { Brand } from "./brand";

export function StorageMeter({
  used,
  quota,
  className,
}: {
  used: number;
  quota: number;
  className?: string;
}) {
  const percent = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          <HardDrive className="h-3 w-3" />
          Almacenamiento
        </span>
        <span className="font-mono text-[10px] text-faint">
          {formatBytes(used)} / {formatBytes(quota)}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            percent > 92 ? "bg-danger/80" : percent > 75 ? "bg-warn/80" : "bg-accent/80",
          )}
          style={{ width: `${Math.max(percent, 1.5)}%` }}
        />
      </div>
    </div>
  );
}

export function VaultRail({
  vaults,
  used,
  quota,
}: {
  vaults: VaultSummary[];
  used: number;
  quota: number;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-surface-1/40 lg:flex">
      <div className="flex h-[60px] shrink-0 items-center border-b border-line px-4">
        <Link href="/" aria-label="Arca, inicio" className="rounded-[8px]">
          <Brand />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2.5 py-3">
        <div className="px-2 pb-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">
          Baúles
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-2" aria-label="Baúles">
          {vaults.map((vault) => {
            const active =
              pathname === `/v/${vault.slug}` || pathname.startsWith(`/v/${vault.slug}/`);

            return (
              <Link
                key={vault.id}
                href={`/v/${vault.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-[38px] items-center gap-2.5 rounded-[8px] px-2.5 text-[12.5px] transition-colors duration-150",
                  active
                    ? "bg-accent-soft text-ink"
                    : "text-muted hover:bg-white/[0.04] hover:text-ink",
                )}
              >
                <Archive
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-accent" : "text-faint group-hover:text-muted",
                  )}
                  strokeWidth={1.5}
                />
                <span className="min-w-0 flex-1 truncate">{vault.name}</span>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] tabular-nums",
                    active ? "text-accent/80" : "text-faint",
                  )}
                >
                  {vault.assetCount}
                </span>
                {active ? (
                  <Settings2 className="hidden h-3 w-3 shrink-0 text-accent/60 group-hover:block" />
                ) : null}
              </Link>
            );
          })}

          {vaults.length === 0 ? (
            <p className="px-2.5 py-3 text-[11.5px] leading-relaxed text-faint">
              Aún no hay baúles. Crea el primero para empezar a guardar.
            </p>
          ) : null}
        </nav>

        <Link
          href="/v/new"
          className={cn(
            "flex h-[38px] items-center gap-2.5 rounded-[8px] px-2.5 text-[12.5px] transition-colors",
            pathname === "/v/new"
              ? "bg-white/[0.06] text-ink"
              : "text-muted hover:bg-white/[0.04] hover:text-ink",
          )}
        >
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-line-strong text-faint">
            <Plus className="h-3 w-3" />
          </span>
          Nuevo baúl
        </Link>
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <StorageMeter used={used} quota={quota} className="px-1" />
        <form action={signOutAction} className="mt-3">
          <button
            type="submit"
            className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-[11.5px] text-faint transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
