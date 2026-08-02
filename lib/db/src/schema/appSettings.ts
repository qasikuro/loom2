import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Key-value store for app-wide settings and feature flags.
 * Admin panel reads/writes these; the app fetches them via GET /api/config.
 *
 * Well-known keys:
 *   maintenance_mode  → boolean
 *   min_app_version   → string  (e.g. "1.0.0")
 *   features          → Record<string, boolean>
 */
export const appSettingsTable = pgTable("app_settings", {
  key:       text("key").primaryKey(),
  value:     jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSetting      = typeof appSettingsTable.$inferSelect;
export type AppSettingInput = typeof appSettingsTable.$inferInsert;
