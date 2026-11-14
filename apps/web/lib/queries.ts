import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db, asset, comment, derivative, shareLink, vault, type Vault } from "@arca/db";
import { signedUrl } from "./media";
import { getShareContext } from "./share";

export type VaultSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  assetCount: number;
};

export type ExplorerDerivative = {
  type: string;
  url: string | null;
  width: number | null;
  height: number | null;
  meta?: Record<string, unknown> | null;
};

export type ExplorerAsset = {
  id: string;
  name: string;
  kind: string;
  status: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  caption: string | null;
  createdAt: string;
  originalUrl: string | null;
  derivatives: ExplorerDerivative[];
};

export type ExplorerComment = {
  id: string;
  assetId: string | null;
  parentId: string | null;
  body: string;
  atSecond: number | null;
  createdAt: string;
  authorName: string;
  authorKind: "owner" | "guest";
};

export type TrashedAsset = ExplorerAsset & { deletedAt: string };

type AssetRow = typeof asset.$inferSelect & {
  derivatives: Array<typeof derivative.$inferSelect>;
};

async function toExplorerAsset(row: AssetRow): Promise<ExplorerAsset> {
  const derivatives = await Promise.all(
    row.derivatives.map(async (item) => ({
      type: item.type,
      url: await signedUrl(item.storageKey),
      width: item.width,
      height: item.height,
      meta: item.meta,
    })),
  );

  return {
    id: row.id,
    name: row.originalName,
    kind: row.kind,
    status: row.status,
    mime: row.mime,
    size: row.size,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    caption: row.caption,
    createdAt: row.createdAt.toISOString(),
    originalUrl: await signedUrl(row.storageKey),
    derivatives,
  };
}

export async function listVaults(ownerId: string): Promise<VaultSummary[]> {
  const rows = await db
    .select({
      id: vault.id,
      name: vault.name,
      slug: vault.slug,
      description: vault.description,
      assetCount: sql<number>`count(${asset.id})::int`,
    })
    .from(vault)
    .leftJoin(
      asset,
      and(eq(asset.vaultId, vault.id), isNull(asset.deletedAt)),
    )
    .where(eq(vault.ownerId, ownerId))
    .groupBy(vault.id)
    .orderBy(asc(vault.createdAt));

  return rows;
}

export async function getVaultBySlug(slug: string): Promise<Vault | undefined> {
  return db.query.vault.findFirst({ where: eq(vault.slug, slug) });
}

export async function getWorkspace(slug: string) {
  const found = await getVaultBySlug(slug);
  if (!found) return null;

  const assetRows = await db.query.asset.findMany({
    where: and(eq(asset.vaultId, found.id), isNull(asset.deletedAt)),
    with: { derivatives: true },
    orderBy: [desc(asset.createdAt)],
  });

  const commentRows = await db.query.comment.findMany({
    where: and(eq(comment.vaultId, found.id), isNull(comment.deletedAt)),
    with: { author: true, guest: true },
    orderBy: [asc(comment.createdAt)],
  });

  const assets: ExplorerAsset[] = await Promise.all(
    assetRows.map((row) => toExplorerAsset(row)),
  );

  const comments: ExplorerComment[] = commentRows.map((row) => ({
    id: row.id,
    assetId: row.assetId,
    parentId: row.parentId,
    body: row.body,
    atSecond: row.atSecond,
    createdAt: row.createdAt.toISOString(),
    authorName: row.author?.name ?? row.guest?.name ?? "Invitado",
    authorKind: row.author ? "owner" : "guest",
  }));

  return { vault: found, assets, comments };
}

/** Archivos en papelera, con URLs firmadas para mostrar miniaturas. */
export async function getTrash(slug: string) {
  const found = await getVaultBySlug(slug);
  if (!found) return null;

  const rows = await db.query.asset.findMany({
    where: and(eq(asset.vaultId, found.id), isNotNull(asset.deletedAt)),
    with: { derivatives: true },
    orderBy: [desc(asset.deletedAt)],
  });

  const assets: TrashedAsset[] = await Promise.all(
    rows.map(async (row) => ({
      ...(await toExplorerAsset(row)),
      deletedAt: (row.deletedAt ?? row.updatedAt).toISOString(),
    })),
  );

  return { vault: found, assets };
}

export async function storageUsage(ownerId: string): Promise<number> {
  // Cuenta también la papelera: los bytes siguen ocupando el bucket.
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${asset.size}), 0)::bigint` })
    .from(asset)
    .where(eq(asset.ownerId, ownerId));

  return Number(row?.total ?? 0);
}

export function derivativeOf(
  asset: ExplorerAsset,
  type: "thumb" | "preview" | "poster" | "storyboard" | "hls" | "pdf_page" | "audio_wave",
): string | null {
  return asset.derivatives.find((item) => item.type === type)?.url ?? null;
}

export type ShareLinkSummary = {
  id: string;
  role: "viewer" | "commenter";
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};

export async function listShareLinks(vaultId: string): Promise<ShareLinkSummary[]> {
  const rows = await db
    .select({
      id: shareLink.id,
      role: shareLink.role,
      createdAt: shareLink.createdAt,
      expiresAt: shareLink.expiresAt,
      revokedAt: shareLink.revokedAt,
    })
    .from(shareLink)
    .where(eq(shareLink.vaultId, vaultId))
    .orderBy(desc(shareLink.createdAt));

  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }));
}

/**
 * Carga el baúl y sus archivos para una vista compartida.
 *
 * Cualquier persona con el token puede leer los archivos y sus notas; el rol
 * del enlace decide si además puede comentar.
 */
export const getSharedWorkspace = cache(async function getSharedWorkspace(
  token: string,
) {
  const context = await getShareContext(token);
  if (!context) return null;

  const assetRows = await db.query.asset.findMany({
    where: and(eq(asset.vaultId, context.vault.id), isNull(asset.deletedAt)),
    with: { derivatives: true },
    orderBy: [desc(asset.createdAt)],
  });

  const commentRows = await db.query.comment.findMany({
    where: and(eq(comment.vaultId, context.vault.id), isNull(comment.deletedAt)),
    with: { author: true, guest: true },
    orderBy: [asc(comment.createdAt)],
  });

  const assets: ExplorerAsset[] = await Promise.all(
    assetRows.map((row) => toExplorerAsset(row)),
  );

  const comments: ExplorerComment[] = commentRows.map((row) => ({
    id: row.id,
    assetId: row.assetId,
    parentId: row.parentId,
    body: row.body,
    atSecond: row.atSecond,
    createdAt: row.createdAt.toISOString(),
    authorName: row.author?.name ?? row.guest?.name ?? "Invitado",
    authorKind: row.author ? "owner" : "guest",
  }));

  return {
    role: context.link.role,
    expiresAt: context.link.expiresAt?.toISOString() ?? null,
    vault: context.vault,
    assets,
    comments,
  };
});
