import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: "../../.env" });
config();

const url =
  process.env.DATABASE_URL_DIRECT ??
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/arca";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
