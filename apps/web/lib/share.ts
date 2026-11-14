import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, shareLink, vault } from "@arca/db";
import { env } from "./env";

export const SHARE_COOKIE = "arca_guest";

/** Token URL-safe de 256 bits. Solo se guarda su hash en la base de datos. */
export function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function guestSignature(guestId: string): string {
  return createHmac("sha256", env.authSecret)
    .update(`arca-guest:${guestId}`)
    .digest("base64url");
}

/** Firma el id del invitado para que la cookie no pueda falsificarse. */
export function signGuestCookie(guestId: string): string {
  return `${guestId}.${guestSignature(guestId)}`;
}

export function verifyGuestCookie(value: string | null | undefined): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const guestId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!guestId || !signature) return null;

  const expected = guestSignature(guestId);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length) return null;
  if (!timingSafeEqual(provided, wanted)) return null;

  return guestId;
}

export type ShareContext = {
  link: typeof shareLink.$inferSelect;
  vault: typeof vault.$inferSelect;
};

/**
 * Resuelve un enlace por token y comprueba que siga vigente.
 *
 * Los enlaces por archivo aún no se ofrecen en la UI; si existiera uno en la
 * base se rechaza para no exponer el baúl completo por accidente.
 */
export async function getShareContext(token: string): Promise<ShareContext | null> {
  if (!token || token.length < 16 || token.length > 128) return null;

  const rows = await db
    .select({ link: shareLink, vault })
    .from(shareLink)
    .innerJoin(vault, eq(vault.id, shareLink.vaultId))
    .where(eq(shareLink.tokenHash, hashShareToken(token)))
    .limit(1);

  const found = rows[0];
  if (!found || found.link.assetId || found.link.revokedAt) return null;
  if (found.link.expiresAt && found.link.expiresAt.getTime() <= Date.now()) return null;

  return found;
}
