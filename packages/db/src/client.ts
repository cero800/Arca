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
    // Aiven Free tiene max_connections=20 y Vercel puede abrir varias
    // instancias: mantener el pool pequeño evita agotar las conexiones.
    max: process.env.NODE_ENV === "production" ? 2 : 10,
    // Aiven no tiene pooler; tampoco hace falta prepared statements.
    prepare: false,
    idle_timeout: 5,
    max_lifetime: 30,
    connect_timeout: 15,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.arcaSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
export * as schema from "./schema";
export * from "./schema";
