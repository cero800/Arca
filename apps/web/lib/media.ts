import "server-only";
import { presignGet } from "./storage";
import { isS3Configured } from "./env";

export async function signedUrl(
  key: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!key || !isS3Configured()) return null;
  try {
    return await presignGet(key, expiresIn);
  } catch {
    return null;
  }
}
