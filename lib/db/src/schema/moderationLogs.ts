import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type ModerationSnapshot = {
  contentType?: string;
  title?: string;
  preview?: string;
  userName?: string | null;
  username?: string | null;
  category?: string | null;
  confidence?: number | null;
  [key: string]: unknown;
};

export const moderationLogsTable = pgTable("moderation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  targetUserId: text("target_user_id"),
  reason: text("reason").notNull().default(""),
  snapshot: jsonb("snapshot").$type<ModerationSnapshot>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("moderation_logs_created_at_idx").on(table.createdAt),
  index("moderation_logs_target_idx").on(table.targetType, table.targetId, table.createdAt),
  index("moderation_logs_action_idx").on(table.action, table.createdAt),
]);

export type ModerationLog = typeof moderationLogsTable.$inferSelect;
export type ModerationLogInput = typeof moderationLogsTable.$inferInsert;
