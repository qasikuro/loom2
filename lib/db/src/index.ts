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

    // Deep link support for admin push notifications.
    await client.query(`
      ALTER TABLE notification_broadcasts
        ADD COLUMN IF NOT EXISTS deep_link TEXT
    `);

    // Beta tester flag on character table (keep for backward compat).
    await client.query(`
      ALTER TABLE character
        ADD COLUMN IF NOT EXISTS is_beta_tester BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Founder flag on character table (keep for backward compat).
    await client.query(`
      ALTER TABLE character
        ADD COLUMN IF NOT EXISTS is_founder BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // ── Dynamic badge system ─────────────────────────────────────────────────

    // Master badge catalog.
    await client.query(`
      CREATE TABLE IF NOT EXISTS badges (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug        TEXT NOT NULL UNIQUE,
        name        TEXT NOT NULL,
        emoji       TEXT NOT NULL DEFAULT '🏅',
        color       TEXT NOT NULL DEFAULT '#6366f1',
        image_url   TEXT,
        description TEXT NOT NULL DEFAULT '',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Per-user badge assignments.
    await client.query(`
      CREATE TABLE IF NOT EXISTS character_badges (
        user_id    TEXT NOT NULL REFERENCES character(user_id) ON DELETE CASCADE,
        badge_id   UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, badge_id)
      )
    `);

    // Seed built-in badges (idempotent — slug is UNIQUE).
    await client.query(`
      INSERT INTO badges (slug, name, emoji, color, description, sort_order) VALUES
        ('founder',      'Founder',      '👑', '#C8A84B', 'One of the founding members of Sky Journal', 0),
        ('beta_tester',  'Beta Tester',  '🧪', '#8B5CF6', 'Helped test Sky Journal before public launch', 1)
      ON CONFLICT (slug) DO NOTHING
    `);

    // Migrate existing isFounder boolean holders → character_badges.
    await client.query(`
      INSERT INTO character_badges (user_id, badge_id)
      SELECT c.user_id, b.id
        FROM character c, badges b
       WHERE c.is_founder = TRUE AND b.slug = 'founder'
      ON CONFLICT DO NOTHING
    `);

    // Migrate existing isBetaTester boolean holders → character_badges.
    await client.query(`
      INSERT INTO character_badges (user_id, badge_id)
      SELECT c.user_id, b.id
        FROM character c, badges b
       WHERE c.is_beta_tester = TRUE AND b.slug = 'beta_tester'
      ON CONFLICT DO NOTHING
    `);

    // ── Messages: soft-delete support ───────────────────────────────────────
    await client.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS deleted_for TEXT
    `);

    // ── Blocks table ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        blocker_id  TEXT    NOT NULL,
        blocked_id  TEXT    NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (blocker_id, blocked_id)
      )
    `);

    // ── Story Studio: Books ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT        NOT NULL,
        title           TEXT        NOT NULL,
        subtitle        TEXT        NOT NULL DEFAULT '',
        series_type     TEXT        NOT NULL DEFAULT 'standalone',
        genre           JSONB       NOT NULL DEFAULT '[]',
        language        TEXT        NOT NULL DEFAULT 'English',
        age_rating      TEXT        NOT NULL DEFAULT 'All Ages',
        visibility      TEXT        NOT NULL DEFAULT 'public',
        cover_image_uri TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS books_user_id_idx ON books(user_id)`);

    // ── Story Studio: Chapters ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        book_id       UUID        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        title         TEXT        NOT NULL,
        order_index   INTEGER     NOT NULL DEFAULT 0,
        status        TEXT        NOT NULL DEFAULT 'draft',
        published_at  TIMESTAMPTZ,
        page_count    INTEGER     NOT NULL DEFAULT 0,
        pages         JSONB       NOT NULL DEFAULT '[]',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS chapters_book_id_idx ON chapters(book_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS chapters_book_id_order_idx ON chapters(book_id, order_index)`);

    // Add read_count to existing chapters table (idempotent)
    await client.query(`
      ALTER TABLE chapters
        ADD COLUMN IF NOT EXISTS read_count INTEGER NOT NULL DEFAULT 0
    `);

    // ── Story Studio: Book follows ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS book_follows (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        book_id    UUID        NOT NULL,
        user_id    TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (book_id, user_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS book_follows_book_id_idx ON book_follows(book_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS book_follows_user_id_idx ON book_follows(user_id)`);

    // ── Story Studio: Chapter comments ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS book_comments (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_id  UUID        NOT NULL,
        user_id     TEXT        NOT NULL,
        parent_id   UUID,
        content     TEXT        NOT NULL,
        like_count  INTEGER     NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS book_comments_chapter_id_idx ON book_comments(chapter_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS book_comments_parent_id_idx ON book_comments(parent_id)`);

    // ── Story Studio: Comment likes ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id UUID        NOT NULL,
        user_id    TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (comment_id, user_id)
      )
    `);

  } finally {
    client.release();
  }
}
