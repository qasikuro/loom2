import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const mediaCompositionsTable = pgTable("media_compositions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  videoPath: text("video_path").notNull(),
  thumbnailPath: text("thumbnail_path").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
}, (table) => [
  index("media_compositions_status_expires_idx").on(table.status, table.expiresAt),
  index("media_compositions_user_id_idx").on(table.userId),
]);

export type MediaComposition = typeof mediaCompositionsTable.$inferSelect;
export type MediaCompositionInput = typeof mediaCompositionsTable.$inferInsert;