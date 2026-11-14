import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ShieldCheck, Trash2 } from "lucide-react";
import { getVaultBySlug } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { VaultForm } from "@/components/vaults/vault-form";
import { DeleteVault } from "@/components/vaults/delete-vault";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const vault = await getVaultBySlug(slug);
  return { title: vault ? `Ajustes · ${vault.name}` : "Ajustes" };
}

export default async function VaultSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const vault = await getVaultBySlug(slug);

  if (!vault || vault.ownerId !== user.id) notFound();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[620px] px-5 py-8 sm:py-12">
        <Link
          href={`/v/${vault.slug}`}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a {vault.name}
        </Link>

        <h1 className="mt-4 font-display text-[26px] font-semibold leading-tight text-ink">
          Ajustes del baúl
        </h1>
        <p className="mt-1.5 text-[13px] text-muted">Nombre, descripción y privacidad.</p>

        <section className="mt-7 rounded-[14px] border border-line bg-surface-1 p-5 shadow-panel">
          <VaultForm mode="edit" vault={vault} />
        </section>

        <section className="mt-6 rounded-[12px] border border-line bg-surface-1/60 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
            <div>
              <h2 className="text-[13px] font-medium text-ink">Enlace privado</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                Los enlaces para compartir llegan en la siguiente etapa. Serán revocables y con
                roles de solo lectura o comentarios.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[12px] border border-line bg-surface-1/60 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-medium text-ink">Papelera</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                Restaura archivos borrados o elimínalos definitivamente para liberar
                espacio.
              </p>
              <Link
                href={`/v/${vault.slug}/trash`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-[7px] border border-line px-3 py-1.5 text-[11.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                Abrir papelera
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-10">
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            Zona de riesgo
          </h2>
          <DeleteVault vault={vault} />
        </div>
      </div>
    </div>
  );
}
