import { NextResponse } from "next/server";
import { storageKey } from "@arca/core";
import { authorizeVideoAsset } from "@/lib/asset-access";
import { getObjectText } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === "NoSuchKey" || value.$metadata?.httpStatusCode === 404;
}

/**
 * Devuelve el VTT del storyboard y sustituye la referencia al sprite por una
 * ruta propia. El sprite real se entrega con una URL firmada de corta vida.
 */
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

  const key = storageKey(access.vaultId, access.id, "storyboard_vtt");
  const query = shareToken ? `?share=${encodeURIComponent(shareToken)}` : "";
  const sprite = `/api/assets/${access.id}/storyboard/sprite${query}`;

  try {
    const vtt = await getObjectText(key, 2 * 1024 * 1024);
    return new NextResponse(vtt.replaceAll("storyboard.webp", sprite), {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    if (isMissing(error)) {
      return NextResponse.json({ error: "Storyboard no disponible" }, { status: 404 });
    }
    console.error("[arca] storyboard vtt", error);
    return NextResponse.json({ error: "Storyboard no disponible" }, { status: 502 });
  }
}
