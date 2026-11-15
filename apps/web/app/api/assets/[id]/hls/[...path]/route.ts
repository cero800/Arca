import { NextResponse } from "next/server";
import { authorizeVideoAsset } from "@/lib/asset-access";
import { rewritePlaylist } from "@/lib/hls";
import { getObjectText, presignGet } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Sirve el HLS privado de un asset.
 *
 * - Las playlists (.m3u8) se leen de B2 y se reescriben: cada URI relativa
 *   pasa a ser una URL firmada de corta vida. Así el navegador nunca ve una
 *   URL permanente y el bucket sigue privado.
 * - Los segmentos (.m4s, init.mp4) se redirigen a una URL firmada, de modo
 *   que el tráfico pesado no pasa por Vercel.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  const { id, path } = await params;

  if (
    !Array.isArray(path) ||
    path.length === 0 ||
    path.length > 3 ||
    !path.every((segment) => SAFE_SEGMENT.test(segment) && segment !== "." && segment !== "..")
  ) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  const shareToken = new URL(request.url).searchParams.get("share");
  const access = await authorizeVideoAsset(id, shareToken);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const base = `vaults/${access.vaultId}/${access.id}/hls`;
  const key = `${base}/${path.join("/")}`;
  const fileName = path[path.length - 1] ?? "";

  if (!fileName.endsWith(".m3u8")) {
    try {
      return NextResponse.redirect(await presignGet(key, 3600), 307);
    } catch (error) {
      console.error("[arca] hls segment", error);
      return NextResponse.json({ error: "Segmento no disponible" }, { status: 502 });
    }
  }

  try {
    const playlist = await getObjectText(key, 2 * 1024 * 1024);
    const rewritten = await rewritePlaylist(playlist, async (uri) => {
      const clean = uri.split("?")[0]?.trim();
      if (!clean || !SAFE_SEGMENT.test(clean)) return null;
      return presignGet(`${base}/${clean}`, 3600);
    });

    return new NextResponse(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[arca] hls playlist", error);
    return NextResponse.json({ error: "Playlist no disponible" }, { status: 502 });
  }
}
