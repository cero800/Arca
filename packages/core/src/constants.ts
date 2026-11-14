export const ASSET_KINDS = ["image", "video", "text", "pdf", "audio", "other"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_STATUSES = ["uploading", "processing", "ready", "error"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const DERIVATIVE_TYPES = [
  "thumb",
  "preview",
  "poster",
  "storyboard",
  "storyboard_vtt",
  "hls",
  "pdf_page",
  "text",
  "audio_wave",
] as const;
export type DerivativeType = (typeof DERIVATIVE_TYPES)[number];

export const JOB_TYPES = ["image", "video", "pdf", "text", "audio", "all"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ["pending", "processing", "done", "error"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const SHARE_ROLES = ["viewer", "commenter"] as const;
export type ShareRole = (typeof SHARE_ROLES)[number];

export const API_TOKEN_SCOPES = ["read", "upload", "backup"] as const;
export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

/** 1 GB */
export const MAX_FILE_BYTES = 1024 * 1024 * 1024;
/** 10 GB */
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
/** 10 MB de texto se guarda, pero solo se previsualiza una parte */
export const TEXT_PREVIEW_BYTES = 1024 * 1024;
/** Partes de 16 MB para multipart upload */
export const MULTIPART_PART_SIZE = 16 * 1024 * 1024;

export const MIME_ALLOWLIST: Record<string, AssetKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "image/heic": "image",
  "image/tiff": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "video/x-matroska": "video",
  "video/mpeg": "video",
  "text/plain": "text",
  "text/markdown": "text",
  "text/csv": "text",
  "application/json": "text",
  "application/xml": "text",
  "text/html": "text",
  "text/css": "text",
  "text/javascript": "text",
  "application/pdf": "pdf",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/flac": "audio",
  "audio/mp4": "audio",
};

export function kindFromMime(mime: string): AssetKind {
  return MIME_ALLOWLIST[mime.toLowerCase()] ?? "other";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
