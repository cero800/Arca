import "server-only";
import { dispatchTranscode } from "./github";

export async function notifyWorker(assetId: string): Promise<void> {
  try {
    const result = await dispatchTranscode(assetId);
    if (!result.dispatched && result.reason === "failed") {
      console.error("[arca] dispatch falló:", result.error);
    }
  } catch (error) {
    // El cron de barrido recogerá el job aunque el dispatch falle.
    console.error("[arca] no se pudo disparar el worker:", error);
  }
}
