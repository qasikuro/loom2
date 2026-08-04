import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const blocksTable = pgTable("blocks", {
  id:        uuid("id").primaryKey().defaultRandom(),
  blockerId: text("blocker_id").notNull(),
  blockedId: text("blocked_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Block      = typeof blocksTable.$inferSelect;
export type BlockInput = typeof blocksTable.$inferInsert;
