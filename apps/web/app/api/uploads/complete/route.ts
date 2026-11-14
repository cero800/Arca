import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, asset, upload } from "@arca/db";
import { auth } from "@/lib/auth";
import { enqueueProcessing } from "@/lib/queue";
import { completeMultipart, deleteObject, headObject } from "@/lib/storage";

export const runtime = "nodejs";

const bodySchema = z.object({
  assetId: z.uuid(),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const found = await db.query.asset.findFirst({
    where: eq(asset.id, parsed.data.assetId),
    with: { upload: true },
  });

  if (!found || found.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  try {
    if (found.upload?.s3UploadId) {
      if (!parsed.data.parts?.length) {
        return NextResponse.json(
          { error: "Faltan las partes del multipart." },
          { status: 400 },
        );
      }
      await completeMultipart(found.storageKey, found.upload.s3UploadId, parsed.data.parts);
      await db.delete(upload).where(eq(upload.assetId, found.id));
    }

    const head = await headObject(found.storageKey);

    await db
      .update(asset)
      .set({
        status: "processing",
        size: head.ContentLength ?? found.size,
        updatedAt: new Date(),
      })
      .where(eq(asset.id, found.id));

    await enqueueProcessing(found.id, found.kind === "image" ? "image" : "all");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[arca] upload complete", error);

    await db
      .update(asset)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(asset.id, found.id));

    try {
      await deleteObject(found.storageKey);
    } catch {
      // el objeto puede no existir todavía
    }

    return NextResponse.json(
      { error: "No se pudo completar la subida." },
      { status: 500 },
    );
  }
}
