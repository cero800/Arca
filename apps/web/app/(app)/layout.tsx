import { env } from "@/lib/env";
import { listVaults, storageUsage } from "@/lib/queries";
import { requireSession } from "@/lib/session";
import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [vaults, used] = await Promise.all([
    listVaults(session.user.id),
    storageUsage(session.user.id),
  ]);

  return (
    <AppShell vaults={vaults} used={used} quota={env.storageQuotaBytes}>
      {children}
    </AppShell>
  );
}
