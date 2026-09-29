import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const storigamInterestSignupTable = pgTable("storigam_interest_signups", {
  email: text("email").primaryKey(),
  interests: text("interests").array().notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertStorigamInterestSignupSchema = createInsertSchema(
  storigamInterestSignupTable,
).omit({ createdAt: true, updatedAt: true });

export type InsertStorigamInterestSignup = z.infer<
  typeof insertStorigamInterestSignupSchema
>;
export type StorigamInterestSignup =
  typeof storigamInterestSignupTable.$inferSelect;