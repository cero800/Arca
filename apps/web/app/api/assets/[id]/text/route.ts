import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db, asset } from "@arca/db";
import { TEXT_PREVIEW_BYTES } from "@arca/core";
import { auth } from "@/lib/auth";
import { getShareContext } from "@/lib/share";
import { getObjectText } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  const shareToken = new URL(request.url).searchParams.get("share");

  if (!session && !shareToken) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const found = await db.query.asset.findFirst({
    where: and(eq(asset.id, id), isNull(asset.deletedAt)),
    columns: {
      id: true,
      vaultId: true,
      ownerId: true,
      kind: true,
      storageKey: true,
      size: true,
    },
  });

  if (!found || found.kind !== "text") {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  if (session) {
    if (found.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }
  } else {
    const context = shareToken ? await getShareContext(shareToken) : null;
    if (!context || context.vault.id !== found.vaultId) {
      return NextResponse.json({ error: "Enlace no válido" }, { status: 404 });
    }
  }

  try {
    const body = await getObjectText(found.storageKey, TEXT_PREVIEW_BYTES);
    return NextResponse.json(
      { body, truncated: found.size > TEXT_PREVIEW_BYTES, size: found.size },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[arca] text preview", error);
    return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 500 });
  }
}
