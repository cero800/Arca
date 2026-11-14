import "server-only";

/**
 * Acceso tipado a variables de entorno del servidor.
 * Los valores por defecto son solo para desarrollo local.
 */
export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/arca",
  databaseUrlDirect:
    process.env.DATABASE_URL_DIRECT ??
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/arca",
  authSecret:
    process.env.BETTER_AUTH_SECRET ?? "arca-dev-secret-change-me-please-32chars",
  authUrl: process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000",
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "us-east-1",
    bucket: process.env.S3_BUCKET ?? "arca-media",
    key: process.env.S3_KEY ?? "",
    secret: process.env.S3_SECRET ?? "",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  },
  github: {
    repo: process.env.GITHUB_REPO ?? "",
    token: process.env.GITHUB_DISPATCH_TOKEN ?? "",
  },
  cronSecret: process.env.CRON_SECRET ?? "",
  maxFileBytes: Number(process.env.MAX_FILE_BYTES ?? 1024 * 1024 * 1024),
  storageQuotaBytes: Number(process.env.STORAGE_QUOTA_BYTES ?? 10 * 1024 * 1024 * 1024),
} as const;

export function isS3Configured(): boolean {
  return Boolean(env.s3.endpoint && env.s3.key && env.s3.secret);
}
