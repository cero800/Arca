import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getTrash } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { TrashList } from "@/components/vaults/trash-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trash = await getTrash(slug);
  return { title: trash ? `Papelera · ${trash.vault.name}` : "Papelera" };
}

export default async function VaultTrashPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const trash = await getTrash(slug);

  if (!trash || trash.vault.ownerId !== user.id) notFound();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-5 py-8 sm:py-12">
        <Link
          href={`/v/${trash.vault.slug}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a {trash.vault.name}
        </Link>

        <div className="mt-4 flex items-center gap-2.5">
          <Trash2 className="h-5 w-5 text-faint" />
          <h1 className="font-display text-[26px] font-semibold leading-tight text-ink">
            Papelera
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          Los archivos borrados siguen ocupando espacio hasta que los elimines de forma
          definitiva.
        </p>

        <div className="mt-7">
          <TrashList vaultId={trash.vault.id} assets={trash.assets} />
        </div>
      </div>
    </div>
  );
}