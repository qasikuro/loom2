import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export interface GuideTutorialStep {
  id: string;
  type: "text" | "image" | "video" | "tip" | "question";
  title: string;
  body: string;
  mediaUri?: string | null;
}

export const guideTutorialsTable = pgTable("guide_tutorials", {
  id: uuid("id").primaryKey().defaultRandom(),
  guideId: text("guide_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  topic: text("topic"),
  visibility: text("visibility").notNull().default("public"),
  status: text("status").notNull().default("draft"),
  steps: jsonb("steps").$type<GuideTutorialStep[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  guideCreatedIdx: index("guide_tutorials_guide_created_idx").on(table.guideId, table.createdAt),
}));

export const guideSessionAttendeesTutorialColumns = {
  tutorialProgress: integer("tutorial_progress").notNull().default(0),
  tutorialCompletedAt: timestamp("tutorial_completed_at", { withTimezone: true }),
};
