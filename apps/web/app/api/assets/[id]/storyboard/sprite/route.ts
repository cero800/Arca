import { NextResponse } from "next/server";
import { storageKey } from "@arca/core";
import { authorizeVideoAsset } from "@/lib/asset-access";
import { presignGet } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Redirige al sprite firmado del storyboard sin exponer la key del bucket. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const shareToken = new URL(request.url).searchParams.get("share");

  const access = await authorizeVideoAsset(id, shareToken);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const key = storageKey(access.vaultId, access.id, "storyboard");

  try {
    return NextResponse.redirect(await presignGet(key, 3600), 307);
  } catch (error) {
    console.error("[arca] storyboard sprite", error);
    return NextResponse.json({ error: "Storyboard no disponible" }, { status: 502 });
  }
}
