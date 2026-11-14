"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db, asset, comment, guest } from "@arca/db";
import { guestCommentSchema } from "@arca/core";
import { getShareContext, SHARE_COOKIE, signGuestCookie, verifyGuestCookie } from "@/lib/share";

export type GuestCommentState = { ok?: boolean; error?: string } | null;

export async function createGuestCommentAction(
  _previous: GuestCommentState,
  formData: FormData,
): Promise<GuestCommentState> {
  const assetId = String(formData.get("assetId") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();
  const atSecond = String(formData.get("atSecond") ?? "").trim();

  const parsed = guestCommentSchema.safeParse({
    shareToken: formData.get("shareToken"),
    assetId: assetId || undefined,
    parentId: parentId || undefined,
    body: formData.get("body") ?? "",
    atSecond: atSecond ? Number(atSecond) : undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Comentario inválido." };
  }

  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);

  if (name.length < 2) {
    return { error: "Escribe tu nombre (mínimo 2 caracteres)." };
  }

  const context = await getShareContext(parsed.data.shareToken);
  if (!context) {
    return { error: "Este enlace ya no es válido." };
  }

  if (context.link.role !== "commenter") {
    return { error: "Este enlace es de solo lectura." };
  }

  if (parsed.data.assetId) {
    const found = await db.query.asset.findFirst({
      where: and(
        eq(asset.id, parsed.data.assetId),
        eq(asset.vaultId, context.vault.id),
        isNull(asset.deletedAt),
      ),
      columns: { id: true },
    });
    if (!found) return { error: "Archivo no encontrado." };
  }

  if (parsed.data.parentId) {
    const parent = await db.query.comment.findFirst({
      where: and(
        eq(comment.id, parsed.data.parentId),
        eq(comment.vaultId, context.vault.id),
        isNull(comment.deletedAt),
      ),
      columns: { id: true },
    });
    if (!parent) return { error: "Comentario original no encontrado." };
  }

  const jar = await cookies();
  const rememberedId = verifyGuestCookie(jar.get(SHARE_COOKIE)?.value);

  let guestId: string | null = null;
  if (rememberedId) {
    const existing = await db.query.guest.findFirst({
      where: and(eq(guest.id, rememberedId), eq(guest.shareLinkId, context.link.id)),
      columns: { id: true },
    });
    if (existing) guestId = existing.id;
  }

  if (guestId) {
    await db
      .update(guest)
      .set({ name, lastSeenAt: new Date() })
      .where(eq(guest.id, guestId));
  } else {
    const [created] = await db
      .insert(guest)
      .values({ shareLinkId: context.link.id, name })
      .returning({ id: guest.id });

    if (!created) return { error: "No se pudo guardar tu nombre." };
    guestId = created.id;
  }

  await db.insert(comment).values({
    vaultId: context.vault.id,
    assetId: parsed.data.assetId ?? null,
    parentId: parsed.data.parentId ?? null,
    guestId,
    body: parsed.data.body,
    atSecond: parsed.data.atSecond ?? null,
  });

  jar.set(SHARE_COOKIE, signGuestCookie(guestId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath(`/s/${parsed.data.shareToken}`);
  return { ok: true };
}
