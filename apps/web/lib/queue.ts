import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, processingJob, type Asset, type ProcessingJob } from "@arca/db";
import type { JobType } from "@arca/core";
import { notifyWorker } from "./worker-dispatch";

export async function enqueueProcessing(
  assetId: string,
  type: JobType = "all",
): Promise<ProcessingJob> {
  const [job] = await db
    .insert(processingJob)
    .values({ assetId, type, status: "pending" })
    .returning();

  if (!job) throw new Error("No se pudo crear el job de procesamiento");

  await notifyWorker(assetId);
  return job;
}

export async function queueStats() {
  const rows = await db
    .select({
      status: processingJob.status,
      total: sql<number>`count(*)::int`,
    })
    .from(processingJob)
    .groupBy(processingJob.status);

  const stats = { pending: 0, processing: 0, done: 0, error: 0 };
  for (const row of rows) {
    stats[row.status] = row.total;
  }
  return stats;
}

export async function retryJob(assetId: string): Promise<void> {
  await db
    .update(processingJob)
    .set({
      status: "pending",
      attempts: 0,
      error: null,
      runAt: new Date(),
      lockedAt: null,
      leaseUntil: null,
      finishedAt: null,
    })
    .where(and(eq(processingJob.assetId, assetId), eq(processingJob.status, "error")));

  await notifyWorker(assetId);
}

export function assetIsReady(asset: Pick<Asset, "status">): boolean {
  return asset.status === "ready";
}
