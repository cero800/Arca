import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { db, vault } from "@arca/db";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireSession();

  const first = await db.query.vault.findFirst({
    orderBy: [asc(vault.createdAt)],
    columns: { slug: true },
  });

  redirect(first ? `/v/${first.slug}` : "/v/new");
}
