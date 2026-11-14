import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db, asset } from "@arca/db";
import { TEXT_PREVIEW_BYTES } from "@arca/core";
import { auth } from "@/lib/auth";
import { getObjectText } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const found = await db.query.asset.findFirst({
    where: and(eq(asset.id, id), eq(asset.ownerId, session.user.id), isNull(asset.deletedAt)),
  });

  if (!found || found.kind !== "text") {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
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
