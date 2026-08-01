import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";

/**
 * Apply any schema additions that cannot be handled by drizzle-kit push at
 * runtime (e.g. when the column was added to the schema after the initial
 * deployment).  Each statement is idempotent — safe to run on every server
 * start.
 */
export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Add ping_friends_at if it was not present in the deployed schema.
    await client.query(`
      ALTER TABLE character
        ADD COLUMN IF NOT EXISTS ping_friends_at TIMESTAMPTZ
    `);
  } finally {
    client.release();
  }
}
