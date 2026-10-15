import { defineConfig } from "drizzle-kit";

// Migrations use the direct (unpooled) connection. Run via the npm scripts,
// which load .env.local.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? "" },
});
