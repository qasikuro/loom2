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

    // App settings key-value table (feature flags, maintenance mode, min version).
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default settings rows if they don't already exist.
    await client.query(`
      INSERT INTO app_settings (key, value) VALUES
        ('maintenance_mode',  'false'::jsonb),
        ('min_app_version',   '"1.0.0"'::jsonb),
        ('features',          '{"stories":true,"music":true,"shop":true,"campfire":true,"guides":true,"notifications":true}'::jsonb)
      ON CONFLICT (key) DO NOTHING
    `);

    // Notification broadcasts log.
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_broadcasts (
        id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        audience    TEXT NOT NULL DEFAULT 'all',
        sent_at     TIMESTAMPTZ,
        sent_count  INTEGER NOT NULL DEFAULT 0,
        created_by  TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Beta tester flag on character table.
    await client.query(`
      ALTER TABLE character
        ADD COLUMN IF NOT EXISTS is_beta_tester BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Founder flag on character table.
    await client.query(`
      ALTER TABLE character
        ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT FALSE
    `);
  } finally {
    client.release();
  }
}
