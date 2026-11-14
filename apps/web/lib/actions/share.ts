"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, shareLink, vault } from "@arca/db";
import { env } from "@/lib/env";
import { createShareToken, hashShareToken } from "@/lib/share";
import { requireUser } from "@/lib/session";

const uuidSchema = z.uuid();

export type ShareActionState = {
  ok?: boolean;
  error?: string;
  url?: string;
  role?: "viewer" | "commenter";
} | null;

export async function createShareLinkAction(
  _previous: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  const user = await requireUser();

  const vaultId = String(formData.get("vaultId") ?? "").trim();
  const parsedId = uuidSchema.safeParse(vaultId);
  if (!parsedId.success) return { error: "Baúl no encontrado." };

  const role = formData.get("role") === "commenter" ? "commenter" : "viewer";
  const requestedDays = Number(formData.get("days") ?? 0);
  const days = Number.isFinite(requestedDays)
    ? Math.min(365, Math.max(0, Math.trunc(requestedDays)))
    : 0;

  const found = await db.query.vault.findFirst({
    where: and(eq(vault.id, vaultId), eq(vault.ownerId, user.id)),
    columns: { id: true, slug: true },
  });

  if (!found) return { error: "Baúl no encontrado." };

  const token = createShareToken();
  const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000) : null;

  await db.insert(shareLink).values({
    tokenHash: hashShareToken(token),
    vaultId: found.id,
    role,
    createdBy: user.id,
    expiresAt,
  });

  revalidatePath(`/v/${found.slug}/settings`);

  return {
    ok: true,
    role,
    url: `${env.appUrl.replace(/\/$/, "")}/s/${token}`,
  };
}

export async function revokeShareLinkAction(
  _previous: ShareActionState,
  formData: FormData,
): Promise<ShareActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!uuidSchema.safeParse(id).success) return { error: "Enlace no encontrado." };

  const rows = await db
    .select({ id: shareLink.id, slug: vault.slug })
    .from(shareLink)
    .innerJoin(vault, eq(vault.id, shareLink.vaultId))
    .where(and(eq(shareLink.id, id), eq(vault.ownerId, user.id)))
    .limit(1);

  const found = rows[0];
  if (!found) return { error: "Enlace no encontrado." };

  await db.update(shareLink).set({ revokedAt: new Date() }).where(eq(shareLink.id, id));
  revalidatePath(`/v/${found.slug}/settings`);

  return { ok: true };
}
