import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const reportsTable = pgTable("reports", {
  id:           uuid("id").primaryKey().defaultRandom(),
  reporterId:   text("reporter_id").notNull(),
  targetType:   text("target_type").notNull(), // 'story' | 'outfit' | 'user'
  targetId:     text("target_id").notNull(),
  reason:       text("reason").notNull(),
  details:      text("details").notNull().default(""),
  status:       text("status").notNull().default("pending"), // 'pending' | 'resolved' | 'dismissed'
  resolvedById: text("resolved_by_id"),
  resolvedAt:   timestamp("resolved_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Report      = typeof reportsTable.$inferSelect;
export type ReportInput = typeof reportsTable.$inferInsert;
