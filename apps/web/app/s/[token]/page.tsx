import type { Metadata } from "next";
import Link from "next/link";
import { Link2Off } from "lucide-react";
import { getSharedWorkspace } from "@/lib/queries";
import { SharedViewer } from "@/components/share/shared-viewer";
import { Brand } from "@/components/shell/brand";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const workspace = await getSharedWorkspace(token);

  const title = workspace ? workspace.vault.name : "Enlace no válido";

  return {
    title,
    robots: { index: false, follow: false },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const workspace = await getSharedWorkspace(token);

  if (!workspace) return <InvalidShare />;

  return (
    <SharedViewer
      token={token}
      role={workspace.role}
      vault={{
        id: workspace.vault.id,
        name: workspace.vault.name,
        description: workspace.vault.description,
        assetCount: workspace.assets.length,
      }}
      assets={workspace.assets}
      comments={workspace.comments}
    />
  );
}

function InvalidShare() {
  return (
    <main className="relative z-10 grid min-h-dvh place-items-center px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgb(255_255_255/0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.025)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
      />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>

        <div className="surface-raised rounded-[16px] p-7 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-[12px] border border-dashed border-line-strong bg-surface-2 text-faint">
            <Link2Off className="h-5 w-5" strokeWidth={1.4} />
          </div>

          <h1 className="mt-4 font-display text-[21px] font-semibold leading-tight text-ink">
            Enlace no válido
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            Este enlace caducó, fue revocado o no existe. Pide uno nuevo a quien
            compartió el baúl.
          </p>

          <Link
            href="/"
            className="mt-5 inline-flex h-9 items-center justify-center rounded-[8px] border border-line px-3.5 text-[12.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Ir a Arca
          </Link>
        </div>
      </div>
    </main>
  );
}
