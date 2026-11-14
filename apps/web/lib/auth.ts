import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@arca/db";
import { env } from "./env";

export type CreateAuthOptions = {
  /** Solo el script de seed lo activa. El endpoint público queda cerrado. */
  allowSignUp?: boolean;
};

export function createAuth(options: CreateAuthOptions = {}) {
  return betterAuth({
    appName: "Arca",
    secret: env.authSecret,
    baseURL: env.authUrl,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUp,
      requireEmailVerification: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 80,
    },
    advanced: {
      cookiePrefix: "arca",
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    plugins: [nextCookies()],
  });
}

export const auth = createAuth();

export type Auth = typeof auth;
