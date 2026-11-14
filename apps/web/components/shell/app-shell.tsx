import type { VaultSummary } from "@/lib/queries";
import { MobileBar } from "./mobile-bar";
import { VaultRail } from "./vault-rail";

export function AppShell({
  vaults,
  used,
  quota,
  children,
}: {
  vaults: VaultSummary[];
  used: number;
  quota: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex h-dvh overflow-hidden">
      <VaultRail vaults={vaults} used={used} quota={quota} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileBar vaults={vaults} />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
