"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, vault, asset } from "@arca/db";
import {
  createVaultSchema,
  deleteVaultSchema,
  slugify,
  updateVaultSchema,
} from "@arca/core";
import { requireUser } from "@/lib/session";
import { deletePrefix } from "@/lib/storage";

export type VaultFormState = { error?: string } | null;

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "baul";
  let candidate = base;

  for (let index = 2; index < 100; index += 1) {
    const existing = await db.query.vault.findFirst({
      where: eq(vault.slug, candidate),
      columns: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${index}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function createVaultAction(
  _previous: VaultFormState,
  formData: FormData,
): Promise<VaultFormState> {
  const user = await requireUser();
  const parsed = createVaultSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const slug = await uniqueSlug(parsed.data.name);

  try {
    await db.insert(vault).values({
      ownerId: user.id,
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
    });
  } catch (error) {
    console.error("[arca] createVault", error);
    return { error: "No se pudo crear el baúl. Inténtalo de nuevo." };
  }

  revalidatePath("/");
  redirect(`/v/${slug}`);
}

export async function updateVaultAction(
  _previous: VaultFormState,
  formData: FormData,
): Promise<VaultFormState> {
  const user = await requireUser();
  const parsed = updateVaultSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const current = await db.query.vault.findFirst({
    where: eq(vault.id, parsed.data.id),
    columns: { id: true, slug: true, ownerId: true },
  });

  if (!current || current.ownerId !== user.id) {
    return { error: "Baúl no encontrado." };
  }

  await db
    .update(vault)
    .set({
      name: parsed.data.name,
      description: parsed.data.description,
      updatedAt: new Date(),
    })
    .where(eq(vault.id, parsed.data.id));

  revalidatePath(`/v/${current.slug}`);
  revalidatePath(`/v/${current.slug}/settings`);
  redirect(`/v/${current.slug}`);
}

export async function deleteVaultAction(
  _previous: VaultFormState,
  formData: FormData,
): Promise<VaultFormState> {
  const user = await requireUser();
  const parsed = deleteVaultSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) return { error: "Baúl inválido." };

  const current = await db.query.vault.findFirst({
    where: eq(vault.id, parsed.data.id),
    columns: { id: true, ownerId: true },
  });

  if (!current || current.ownerId !== user.id) {
    return { error: "Baúl no encontrado." };
  }

  const assets = await db.query.asset.findMany({
    where: eq(asset.vaultId, current.id),
    columns: { id: true },
  });

  await db.delete(vault).where(eq(vault.id, parsed.data.id));

  // El borrado en cascada no toca el bucket: limpiamos los objetos después.
  for (const item of assets) {
    try {
      await deletePrefix(`vaults/${current.id}/${item.id}/`);
    } catch (error) {
      console.error("[arca] deleteVault storage", item.id, error);
    }
  }

  revalidatePath("/");
  redirect("/");
}
