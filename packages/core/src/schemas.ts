import { z } from "zod";

export const vaultNameSchema = z
  .string()
  .trim()
  .min(1, "El baúl necesita un nombre")
  .max(80, "Máximo 80 caracteres");

export const vaultDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Máximo 500 caracteres")
  .default("");

export const createVaultSchema = z.object({
  name: vaultNameSchema,
  description: vaultDescriptionSchema,
});

export const updateVaultSchema = createVaultSchema.extend({
  id: z.uuid(),
});

export const deleteVaultSchema = z.object({
  id: z.uuid(),
});

export const createCommentSchema = z.object({
  vaultId: z.uuid(),
  assetId: z.uuid().optional(),
  parentId: z.uuid().optional(),
  body: z.string().trim().min(1, "Escribe algo").max(4_000, "Máximo 4000 caracteres"),
  atSecond: z.number().int().min(0).optional(),
});

export const uploadIntentSchema = z.object({
  vaultId: z.uuid(),
  fileName: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(1).max(255),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});

export const assetIdSchema = z.object({
  id: z.uuid(),
});

export const vaultIdSchema = z.object({
  vaultId: z.uuid(),
});

export const guestCommentSchema = createCommentSchema
  .omit({ vaultId: true })
  .extend({ shareToken: z.string().min(16) });
