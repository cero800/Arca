import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWorkspace, listVaults } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { Explorer } from "@/components/explorer/explorer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await getWorkspace(slug);
  return { title: workspace?.vault.name ?? "Baúl" };
}

export default async function VaultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const [workspace, vaults] = await Promise.all([
    getWorkspace(slug),
    listVaults(user.id),
  ]);

  if (!workspace || workspace.vault.ownerId !== user.id) notFound();

  return (
    <Explorer
      vault={{
        id: workspace.vault.id,
        name: workspace.vault.name,
        slug: workspace.vault.slug,
        description: workspace.vault.description,
        assetCount: workspace.assets.length,
      }}
      vaults={vaults}
      assets={workspace.assets}
      comments={workspace.comments}
    />
  );
}
