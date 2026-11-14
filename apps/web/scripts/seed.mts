/**
 * Seed inicial de Arca.
 *
 * Crea la única cuenta de owner y un baúl de bienvenida.
 * Es idempotente: si el usuario ya existe, no lo modifica.
 *
 *   pnpm db:seed
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });
config();

const { betterAuth } = await import("better-auth");
const { drizzleAdapter } = await import("better-auth/adapters/drizzle");
const { db, schema, sql, vault, user } = await import("@arca/db");
const { slugify } = await import("@arca/core");
const { eq } = await import("drizzle-orm");

const email = (process.env.OWNER_EMAIL ?? "owner@arca.local").trim().toLowerCase();
const password = process.env.OWNER_PASSWORD ?? "arca-dev-password";
const name = process.env.OWNER_NAME ?? "Owner";
const secret =
  process.env.BETTER_AUTH_SECRET ?? "arca-dev-secret-change-me-please-32chars";
const baseURL = process.env.BETTER_AUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";

if (password.length < 10) {
  console.error("OWNER_PASSWORD debe tener al menos 10 caracteres.");
  process.exit(1);
}

const seedAuth = betterAuth({
  appName: "Arca",
  secret,
  baseURL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Solo este script permite registro. La app mantiene disableSignUp.
    disableSignUp: false,
    minPasswordLength: 10,
  },
});

const existing = await db.query.user.findFirst({ where: eq(user.email, email) });

let ownerId: string;

if (existing) {
  ownerId = existing.id;
  console.log(`· El owner ${email} ya existe. No se toca la contraseña.`);
} else {
  const result = await seedAuth.api.signUpEmail({
    body: { email, password, name },
  });
  ownerId = result.user.id;
  console.log(`✓ Owner creado: ${email}`);
}

const vaults = await db.query.vault.findMany({
  where: eq(vault.ownerId, ownerId),
  columns: { id: true, slug: true },
});

if (vaults.length === 0) {
  const vaultName = "Archivo personal";
  const slug = slugify(vaultName) || "archivo-personal";

  await db.insert(vault).values({
    ownerId,
    name: vaultName,
    slug,
    description:
      "El cajón de lo que quiero conservar: fotos sueltas, documentos y referencias.",
  });

  console.log(`✓ Baúl de bienvenida creado: /v/${slug}`);
} else {
  console.log(`· Ya hay ${vaults.length} baúl(es); no se crea ninguno.`);
}

console.log("\nListo. Inicia sesión con:");
console.log(`  email:    ${email}`);
console.log(`  password: ${existing ? "(la que ya tenías)" : password}`);

await sql.end();
