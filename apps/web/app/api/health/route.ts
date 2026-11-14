import { NextResponse } from "next/server";
import { sql } from "@arca/db";
import { isS3Configured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await sql`select 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  checks.storage = isS3Configured() ? "ok" : "error";

  const healthy = Object.values(checks).every((value) => value === "ok");

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      product: "arca",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
