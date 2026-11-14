"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, comment, vault } from "@arca/db";
import { createCommentSchema } from "@arca/core";
import { requireUser } from "@/lib/session";

export type CommentState = { ok?: boolean; error?: string } | null;

export async function createCommentAction(
  _previous: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const user = await requireUser();

  const assetId = String(formData.get("assetId") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const atSecond = String(formData.get("atSecond") ?? "").trim();

  const parsed = createCommentSchema.safeParse({
    vaultId: formData.get("vaultId"),
    assetId: assetId || undefined,
    parentId: parentId || undefined,
    body: formData.get("body") ?? "",
    atSecond: atSecond ? Number(atSecond) : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Comentario inválido." };
  }

  const found = await db.query.vault.findFirst({
    where: eq(vault.id, parsed.data.vaultId),
    columns: { id: true, ownerId: true, slug: true },
  });

  if (!found || found.ownerId !== user.id) {
    return { error: "Baúl no encontrado." };
  }

  await db.insert(comment).values({
    vaultId: parsed.data.vaultId,
    assetId: parsed.data.assetId ?? null,
    parentId: parsed.data.parentId ?? null,
    body: parsed.data.body,
    atSecond: parsed.data.atSecond ?? null,
    authorId: user.id,
  });

  revalidatePath(`/v/${found.slug}`);
  return { ok: true };
}
