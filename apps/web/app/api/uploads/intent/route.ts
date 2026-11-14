import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, asset, vault, upload } from "@arca/db";
import {
  MIME_ALLOWLIST,
  MULTIPART_PART_SIZE,
  kindFromMime,
  storageKey,
  uploadIntentSchema,
} from "@arca/core";
import { auth } from "@/lib/auth";
import { env, isS3Configured } from "@/lib/env";
import { createMultipart, presignPart, presignPut } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!isS3Configured()) {
    return NextResponse.json(
      { error: "El almacenamiento no está configurado todavía." },
      { status: 503 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = uploadIntentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { vaultId, fileName, mime, size, sha256 } = parsed.data;

  if (size > env.maxFileBytes) {
    return NextResponse.json(
      { error: `El archivo supera el máximo de ${Math.round(env.maxFileBytes / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  const found = await db.query.vault.findFirst({ where: eq(vault.id, vaultId) });
  if (!found || found.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Baúl no encontrado" }, { status: 404 });
  }

  if (sha256) {
    const duplicate = await db.query.asset.findFirst({
      where: and(
        eq(asset.vaultId, vaultId),
        eq(asset.sha256, sha256.toLowerCase()),
        isNull(asset.deletedAt),
      ),
      columns: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ assetId: duplicate.id, deduped: true });
    }
  }

  const [usage] = await db
    .select({ total: sql<number>`coalesce(sum(${asset.size}), 0)::bigint` })
    .from(asset)
    .where(eq(asset.ownerId, session.user.id));

  if (Number(usage?.total ?? 0) + size > env.storageQuotaBytes) {
    return NextResponse.json(
      { error: "Has alcanzado la cuota de almacenamiento." },
      { status: 413 },
    );
  }

  const assetId = crypto.randomUUID();
  const key = storageKey(vaultId, assetId, "original");
  const kind = kindFromMime(mime);

  await db.insert(asset).values({
    id: assetId,
    vaultId,
    ownerId: session.user.id,
    kind,
    status: "uploading",
    originalName: fileName,
    mime: MIME_ALLOWLIST[mime] ? mime : mime || "application/octet-stream",
    size,
    sha256: sha256?.toLowerCase() ?? null,
    storageKey: key,
  });

  if (size > 5 * 1024 * 1024) {
    const uploadId = await createMultipart(key, mime);
    const partCount = Math.ceil(size / MULTIPART_PART_SIZE);
    const parts = await Promise.all(
      Array.from({ length: partCount }, async (_, index) => ({
        partNumber: index + 1,
        url: await presignPart(key, uploadId, index + 1),
      })),
    );

    await db.insert(upload).values({
      assetId,
      key,
      s3UploadId: uploadId,
      parts: [],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    return NextResponse.json({
      assetId,
      key,
      multipart: {
        uploadId,
        partSize: MULTIPART_PART_SIZE,
        parts,
      },
    });
  }

  const url = await presignPut(key, mime);
  return NextResponse.json({ assetId, key, url });
}
