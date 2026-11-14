import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/arca";

const globalForDb = globalThis as unknown as {
  arcaSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.arcaSql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    // Neon/pgbouncer no soporta prepared statements en modo transacción.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.arcaSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
export * as schema from "./schema";
export * from "./schema";
