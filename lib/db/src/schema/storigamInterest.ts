import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, primaryKey, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const storigamInterestSignupTable = pgTable("storigam_interest_signups", {
  email: text("email").primaryKey(),
  name: text("name").notNull().default(""),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  interests: text("interests").array().notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  unsubscribeToken: text("unsubscribe_token"),
  welcomeEmailStatus: text("welcome_email_status").notNull().default("legacy"),
  welcomeEmailId: text("welcome_email_id"),
  welcomeEmailSentAt: timestamp("welcome_email_sent_at", { withTimezone: true }),
  betaBadgeEmailStatus: text("beta_badge_email_status").notNull().default("not_applicable"),
  betaBadgeEmailId: text("beta_badge_email_id"),
  betaBadgeEmailSentAt: timestamp("beta_badge_email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("storigam_interest_unsubscribe_token_idx").on(table.unsubscribeToken)]);

export const storigamEmailCampaignTable = pgTable("storigam_email_campaigns", {
  id: uuid("id").primaryKey(),
  audience: text("audience").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storigamEmailRecipientTable = pgTable("storigam_email_recipients", {
  campaignId: uuid("campaign_id").notNull().references(() => storigamEmailCampaignTable.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"),
  providerId: text("provider_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (table) => [
  primaryKey({ columns: [table.campaignId, table.email] }),
  index("storigam_email_recipients_status_idx").on(table.campaignId, table.status),
]);

export const insertStorigamInterestSignupSchema = createInsertSchema(
  storigamInterestSignupTable,
).omit({ createdAt: true, updatedAt: true });

export type InsertStorigamInterestSignup = z.infer<
  typeof insertStorigamInterestSignupSchema
>;
export type StorigamInterestSignup =
  typeof storigamInterestSignupTable.$inferSelect;