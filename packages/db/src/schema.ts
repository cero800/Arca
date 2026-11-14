import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/* ─────────────────────────────────────────────────────────────
 * Better Auth
 * ───────────────────────────────────────────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/* ─────────────────────────────────────────────────────────────
 * Dominio de Arca
 * ───────────────────────────────────────────────────────────── */

export const assetKind = pgEnum("asset_kind", [
  "image",
  "video",
  "text",
  "pdf",
  "audio",
  "other",
]);

export const assetStatus = pgEnum("asset_status", [
  "uploading",
  "processing",
  "ready",
  "error",
]);

export const derivativeType = pgEnum("derivative_type", [
  "thumb",
  "preview",
  "poster",
  "storyboard",
  "storyboard_vtt",
  "hls",
  "pdf_page",
  "text",
  "audio_wave",
]);

export const jobType = pgEnum("job_type", [
  "image",
  "video",
  "pdf",
  "text",
  "audio",
  "all",
]);

export const jobStatus = pgEnum("job_status", ["pending", "processing", "done", "error"]);

export const shareRole = pgEnum("share_role", ["viewer", "commenter"]);

export const vault = pgTable(
  "vault",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    coverAssetId: uuid("cover_asset_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("vault_owner_id_idx").on(table.ownerId)],
);

export const asset = pgTable(
  "asset",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vault.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: assetKind("kind").notNull().default("other"),
    status: assetStatus("status").notNull().default("processing"),
    originalName: text("original_name").notNull(),
    mime: text("mime").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    storageKey: text("storage_key").notNull(),
    caption: text("caption"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("asset_vault_id_idx").on(table.vaultId),
    index("asset_vault_deleted_idx").on(table.vaultId, table.deletedAt),
    index("asset_sha256_idx").on(table.vaultId, table.sha256),
    uniqueIndex("asset_vault_sha256_uidx")
      .on(table.vaultId, table.sha256)
      .where(sql`${table.sha256} is not null and ${table.deletedAt} is null`),
  ],
);

export const derivative = pgTable(
  "derivative",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    type: derivativeType("type").notNull(),
    storageKey: text("storage_key").notNull(),
    width: integer("width"),
    height: integer("height"),
    size: bigint("size", { mode: "number" }),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("derivative_asset_type_idx").on(table.assetId, table.type),
    index("derivative_asset_id_idx").on(table.assetId),
  ],
);

export const guest = pgTable(
  "guest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shareLinkId: uuid("share_link_id")
      .notNull()
      .references(() => shareLink.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("guest_share_link_id_idx").on(table.shareLinkId)],
);

export const comment = pgTable(
  "comment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vault.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => asset.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    guestId: uuid("guest_id").references(() => guest.id, { onDelete: "set null" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => comment.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    atSecond: integer("at_second"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("comment_vault_id_idx").on(table.vaultId),
    index("comment_asset_id_idx").on(table.assetId),
    index("comment_parent_id_idx").on(table.parentId),
  ],
);

export const shareLink = pgTable(
  "share_link",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vault.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => asset.id, { onDelete: "cascade" }),
    role: shareRole("role").notNull().default("viewer"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("share_link_vault_id_idx").on(table.vaultId)],
);

export const apiToken = pgTable(
  "api_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    scopes: text("scopes").array().notNull().default(sql`ARRAY['read']::text[]`),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("api_token_user_id_idx").on(table.userId)],
);

export const upload = pgTable(
  "upload",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    s3UploadId: text("s3_upload_id"),
    parts: jsonb("parts").$type<Array<{ partNumber: number; etag: string }>>().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("upload_asset_id_uidx").on(table.assetId)],
);

export const processingJob = pgTable(
  "processing_job",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => asset.id, { onDelete: "cascade" }),
    type: jobType("type").notNull().default("all"),
    status: jobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    error: text("error"),
    metrics: jsonb("metrics").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("processing_job_status_run_at_idx").on(table.status, table.runAt),
    index("processing_job_asset_id_idx").on(table.assetId),
  ],
);

/* ─────────────────────────────────────────────────────────────
 * Relaciones (API de consultas de Drizzle)
 * ───────────────────────────────────────────────────────────── */

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  vaults: many(vault),
}));

export const vaultRelations = relations(vault, ({ one, many }) => ({
  owner: one(user, { fields: [vault.ownerId], references: [user.id] }),
  assets: many(asset),
  comments: many(comment),
  shareLinks: many(shareLink),
}));

export const assetRelations = relations(asset, ({ one, many }) => ({
  vault: one(vault, { fields: [asset.vaultId], references: [vault.id] }),
  owner: one(user, { fields: [asset.ownerId], references: [user.id] }),
  derivatives: many(derivative),
  comments: many(comment),
  jobs: many(processingJob),
  upload: one(upload, { fields: [asset.id], references: [upload.assetId] }),
}));

export const derivativeRelations = relations(derivative, ({ one }) => ({
  asset: one(asset, { fields: [derivative.assetId], references: [asset.id] }),
}));

export const commentRelations = relations(comment, ({ one, many }) => ({
  vault: one(vault, { fields: [comment.vaultId], references: [vault.id] }),
  asset: one(asset, { fields: [comment.assetId], references: [asset.id] }),
  author: one(user, { fields: [comment.authorId], references: [user.id] }),
  guest: one(guest, { fields: [comment.guestId], references: [guest.id] }),
  parent: one(comment, {
    fields: [comment.parentId],
    references: [comment.id],
    relationName: "comment_replies",
  }),
  replies: many(comment, { relationName: "comment_replies" }),
}));

export const guestRelations = relations(guest, ({ one }) => ({
  shareLink: one(shareLink, { fields: [guest.shareLinkId], references: [shareLink.id] }),
}));

export const shareLinkRelations = relations(shareLink, ({ one, many }) => ({
  vault: one(vault, { fields: [shareLink.vaultId], references: [vault.id] }),
  asset: one(asset, { fields: [shareLink.assetId], references: [asset.id] }),
  creator: one(user, { fields: [shareLink.createdBy], references: [user.id] }),
  guests: many(guest),
}));

export const processingJobRelations = relations(processingJob, ({ one }) => ({
  asset: one(asset, { fields: [processingJob.assetId], references: [asset.id] }),
}));

export type User = typeof user.$inferSelect;
export type Vault = typeof vault.$inferSelect;
export type Asset = typeof asset.$inferSelect;
export type Derivative = typeof derivative.$inferSelect;
export type Comment = typeof comment.$inferSelect;
export type ShareLink = typeof shareLink.$inferSelect;
export type Guest = typeof guest.$inferSelect;
export type ProcessingJob = typeof processingJob.$inferSelect;
export type ApiToken = typeof apiToken.$inferSelect;
