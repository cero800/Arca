import "server-only";

import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db, asset } from "@arca/db";
import { auth } from "./auth";
import { getShareContext } from "./share";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VideoAccess =
  | { ok: true; id: string; vaultId: string }
  | { ok: false; status: number; error: string };

/**
 * Autoriza el acceso a un derivado de video.
 *
 * Acepta la sesión del dueño o un token de share válido para el mismo baúl.
 * Se usa tanto en HLS como en el storyboard para no duplicar la lógica.
 */
export async function authorizeVideoAsset(
  id: string,
  shareToken: string | null,
): Promise<VideoAccess> {
  if (!UUID.test(id)) {
    return { ok: false, status: 404, error: "Video no encontrado" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session && !shareToken) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const found = await db.query.asset.findFirst({
    where: and(eq(asset.id, id), isNull(asset.deletedAt)),
    columns: { id: true, vaultId: true, ownerId: true, kind: true },
  });

  if (!found || found.kind !== "video") {
    return { ok: false, status: 404, error: "Video no encontrado" };
  }

  if (session) {
    if (found.ownerId !== session.user.id) {
      return { ok: false, status: 404, error: "Video no encontrado" };
    }
  } else {
    const context = shareToken ? await getShareContext(shareToken) : null;
    if (!context || context.vault.id !== found.vaultId) {
      return { ok: false, status: 404, error: "Enlace no válido" };
    }
  }

  return { ok: true, id: found.id, vaultId: found.vaultId };
}
