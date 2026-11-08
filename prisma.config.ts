import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// `neon deploy` / `neon env pull` write to .env.local; fall back to .env.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: {
    externalTables: true,
  },
  // Neon Auth owns the whole neon_auth schema. Prisma models neon_auth.user
  // (for relations and reads); every neon_auth table must be listed here or
  // Prisma will generate DROP TABLE statements for it. If Neon Auth adds a
  // table later, add it here; always read generated migration SQL before applying.
  // List current tables:
  //   select table_name from information_schema.tables where table_schema = 'neon_auth';
  tables: {
    external: [
      "neon_auth.user",
      "neon_auth.session",
      "neon_auth.account",
      "neon_auth.verification",
      "neon_auth.jwks",
      "neon_auth.organization",
      "neon_auth.member",
      "neon_auth.invitation",
      "neon_auth.project_config",
    ],
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
    // The shadow database used by `prisma migrate dev` has no Neon Auth, so
    // recreate the external table there for foreign keys to resolve against.
    initShadowDb: `
      CREATE SCHEMA IF NOT EXISTS neon_auth;
      CREATE TABLE IF NOT EXISTS neon_auth."user" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "emailVerified" boolean NOT NULL,
        "image" text,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "role" text,
        "banned" boolean,
        "banReason" text,
        "banExpires" timestamptz
      );
    `,
  },
  datasource: {
    // The Prisma CLI (migrations, introspection) needs a direct connection:
    // PgBouncer's transaction pooling breaks Prisma Migrate. The app itself
    // uses the pooled DATABASE_URL (see lib/db.ts).
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
