"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, asset, vault } from "@arca/db";
import { assetIdSchema, vaultIdSchema } from "@arca/core";
import { requireUser } from "@/lib/session";
import { deletePrefix } from "@/lib/storage";

export type AssetActionState = { ok?: boolean; error?: string } | null;

function revalidateVault(slug: string) {
  revalidatePath(`/v/${slug}`);
  revalidatePath(`/v/${slug}/trash`);
  revalidatePath(`/v/${slug}/settings`);
  revalidatePath("/");
}

async function ownedAsset(id: string, userId: string) {
  const row = await db.query.asset.findFirst({
    where: eq(asset.id, id),
    with: { vault: { columns: { id: true, slug: true, ownerId: true } } },
  });

  if (!row || row.vault.ownerId !== userId) return null;
  return row;
}

/** Mueve un archivo a la papelera sin borrar bytes. */
export async function trashAssetAction(
  _previous: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  const user = await requireUser();
  const parsed = assetIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Archivo inválido." };

  const found = await ownedAsset(parsed.data.id, user.id);
  if (!found) return { error: "Archivo no encontrado." };

  if (!found.deletedAt) {
    await db
      .update(asset)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(asset.id, found.id));
  }

  revalidateVault(found.vault.slug);
  return { ok: true };
}

/** Devuelve un archivo de la papelera al baúl. */
export async function restoreAssetAction(
  _previous: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  const user = await requireUser();
  const parsed = assetIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Archivo inválido." };

  const found = await ownedAsset(parsed.data.id, user.id);
  if (!found) return { error: "Archivo no encontrado." };

  try {
    await db
      .update(asset)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(asset.id, found.id));
  } catch (error) {
    console.error("[arca] restoreAsset", error);
    return {
      error: "No se pudo restaurar: ya existe un archivo idéntico en este baúl.",
    };
  }

  revalidateVault(found.vault.slug);
  return { ok: true };
}

/** Borra el archivo, sus derivados y sus objetos del bucket. */
export async function purgeAssetAction(
  _previous: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  const user = await requireUser();
  const parsed = assetIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Archivo inválido." };

  const found = await ownedAsset(parsed.data.id, user.id);
  if (!found) return { error: "Archivo no encontrado." };

  try {
    await deletePrefix(`vaults/${found.vaultId}/${found.id}/`);
  } catch (error) {
    console.error("[arca] purgeAsset storage", error);
    return { error: "No se pudieron borrar los objetos del almacenamiento." };
  }

  await db.delete(asset).where(eq(asset.id, found.id));

  revalidateVault(found.vault.slug);
  return { ok: true };
}

/** Vacía la papelera completa de un baúl. */
export async function emptyTrashAction(
  _previous: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  const user = await requireUser();
  const parsed = vaultIdSchema.safeParse({ vaultId: formData.get("vaultId") });
  if (!parsed.success) return { error: "Baúl inválido." };

  const found = await db.query.vault.findFirst({
    where: eq(vault.id, parsed.data.vaultId),
    columns: { id: true, slug: true, ownerId: true },
  });

  if (!found || found.ownerId !== user.id) {
    return { error: "Baúl no encontrado." };
  }

  const trashed = await db.query.asset.findMany({
    where: and(eq(asset.vaultId, found.id), isNotNull(asset.deletedAt)),
    columns: { id: true },
  });

  for (const target of trashed) {
    try {
      await deletePrefix(`vaults/${found.id}/${target.id}/`);
    } catch (error) {
      console.error("[arca] emptyTrash storage", error);
      return {
        error: "No se pudieron borrar todos los objetos. Inténtalo de nuevo.",
      };
    }
  }

  for (const target of trashed) {
    await db.delete(asset).where(eq(asset.id, target.id));
  }

  revalidateVault(found.slug);
  return { ok: true };
}
