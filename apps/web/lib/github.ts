import "server-only";
import { env } from "./env";

export type DispatchResult =
  | { dispatched: true }
  | { dispatched: false; reason: "not-configured" | "failed"; error?: string };

/**
 * Dispara el workflow de GitHub Actions. El worker también tiene un cron
 * de barrido, así que un fallo aquí no pierde el job.
 */
export async function dispatchTranscode(assetId: string): Promise<DispatchResult> {
  if (!env.github.repo || !env.github.token) {
    return { dispatched: false, reason: "not-configured" };
  }

  const response = await fetch(
    `https://api.github.com/repos/${env.github.repo}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.github.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "transcode",
        client_payload: { assetId },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      dispatched: false,
      reason: "failed",
      error: `GitHub ${response.status}: ${detail.slice(0, 300)}`,
    };
  }

  return { dispatched: true };
}
