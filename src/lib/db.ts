import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "@/db/schema";

declare global {
  var __studiskartePool: Pool | undefined;
  var __studiskarteDb: NodePgDatabase<typeof schema> | undefined;
}

// Application traffic uses the pooled DATABASE_URL (the "-pooler" host).
// Migrations and session-level work use DATABASE_URL_UNPOOLED instead.
function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });
  // On Vercel Fluid compute this lets the platform close idle connections
  // before a function instance is suspended.
  attachDatabasePool(pool);
  return pool;
}

// Reuse one pool per server process, including across dev hot reloads.
export function getPool(): Pool {
  globalThis.__studiskartePool ??= createPool();
  return globalThis.__studiskartePool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  globalThis.__studiskarteDb ??= drizzle(getPool(), { schema });
  return globalThis.__studiskarteDb;
}
