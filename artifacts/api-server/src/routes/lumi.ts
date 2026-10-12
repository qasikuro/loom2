import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db, lumiStateTable } from "@workspace/db";
import { getUserId, requireAuth } from "../middleware/auth";
import { requireAiAccess } from "../middleware/ai-access";
import {
  LUMI_COMPANION_SYSTEM, isImmediateCrisis, lumiFallback, lumiInputSchema,
  lumiMessageSchema, lumiOutputSchema, lumiPreferencesSchema, type LumiMessage,
} from "../lib/lumiCompanion";

const router = Router();
const ai = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
  timeout: 25_000,
  maxRetries: 0,
});

function publicState(row?: typeof lumiStateTable.$inferSelect) {
  const messages = z.array(lumiMessageSchema).max(40).safeParse(row?.messages);
  const preferences = lumiPreferencesSchema.safeParse(row?.preferences ?? {});
  return {
    remember: row?.remember ?? false,
    messages: row?.remember && messages.success ? messages.data : [],
    preferences: preferences.success ? preferences.data : {},
  };
}

router.get("/drift/companion-state", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const [row] = await db.select().from(lumiStateTable).where(eq(lumiStateTable.userId, getUserId(req)));
    return res.json(publicState(row));
  } catch (err) {
    req.log.error({ err }, "Lumi state unavailable");
    return res.status(503).json({ error: "Lumi history is temporarily unavailable." });
  }
});

const preferencesInput = z.object({
  remember: z.boolean(),
  preferences: lumiPreferencesSchema.optional(),
}).strict();

router.put("/drift/companion-state", requireAuth, async (req, res) => {
  const input = preferencesInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid Lumi preferences." });
  const userId = getUserId(req);
  try {
    const row = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('lumi-state'), hashtext(${userId}))`);
      const [existing] = await tx.select().from(lumiStateTable).where(eq(lumiStateTable.userId, userId));
      const [updated] = await tx.insert(lumiStateTable).values({
        userId, remember: input.data.remember, preferences: input.data.preferences ?? {},
      }).onConflictDoUpdate({
        target: lumiStateTable.userId,
        set: {
          remember: input.data.remember,
          preferences: input.data.preferences ?? existing?.preferences ?? {},
          messages: input.data.remember ? existing?.messages ?? [] : [],
          revision: (existing?.revision ?? 0) + 1,
          updatedAt: new Date(),
        },
      }).returning();
      return updated;
    });
    return res.json(publicState(row));
  } catch (err) {
    req.log.error({ err }, "Lumi preferences failed");
    return res.status(503).json({ error: "Your Lumi settings could not be saved." });
  }
});

router.delete("/drift/companion-state", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('lumi-state'), hashtext(${userId}))`);
      // Retain a privacy revision tombstone: in-flight requests cannot recreate deleted history.
      await tx.insert(lumiStateTable).values({ userId }).onConflictDoUpdate({
        target: lumiStateTable.userId,
        set: { remember: false, messages: [], preferences: {}, revision: sql`${lumiStateTable.revision} + 1`, updatedAt: new Date() },
      });
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Lumi history deletion failed");
    res.status(503).json({ error: "Your Lumi data could not be cleared. Please try again." });
  }
});

router.post("/drift/companion", requireAuth, requireAiAccess, async (req, res) => {
  const input = lumiInputSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "Invalid Lumi message or conversation history." });
  const userId = getUserId(req);
  const { message, history, locale, game } = input.data;
  try {
    const [state] = await db.select().from(lumiStateTable).where(eq(lumiStateTable.userId, userId));
    const preferences = publicState(state).preferences;
    const response = await ai.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: LUMI_COMPANION_SYSTEM,
      messages: [{
        role: "user",
        content: JSON.stringify({ locale, game, preferences, history, message }),
      }],
    });
    const raw = response.content.filter(block => block.type === "text").map(block => block.text).join("");
    const body = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const output = lumiOutputSchema.safeParse(JSON.parse(body));
    if (!output.success) throw new Error("Invalid Lumi response structure");
    const result = { ...output.data, recommendations: isImmediateCrisis(message) ? [] : output.data.recommendations, fallback: false };
    if (state?.remember) {
      await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('lumi-state'), hashtext(${userId}))`);
        const [current] = await tx.select().from(lumiStateTable).where(eq(lumiStateTable.userId, userId));
        if (!current?.remember || current.revision !== state.revision) return;
        const additions: LumiMessage[] = [
          { role: "user", content: message },
          { role: "assistant", content: result.reply },
        ];
        await tx.update(lumiStateTable).set({
          messages: [...publicState(current).messages, ...additions].slice(-40),
          updatedAt: new Date(),
        }).where(and(eq(lumiStateTable.userId, userId), eq(lumiStateTable.revision, state.revision)));
      });
    }
    return res.json(result);
  } catch (err) {
    // Do not log private messages, raw model responses, or return provider exceptions.
    req.log.warn({ errorType: err instanceof Error ? err.name : "unknown" }, "Lumi companion unavailable");
    if (isImmediateCrisis(message)) {
      return res.json({
        reply: "If you might hurt yourself or someone else, contact your local emergency service now. Reach out to someone you trust who can stay with you. I'm a gaming companion, not emergency support.",
        recommendations: [], fallback: true,
      });
    }
    return res.json(lumiFallback(locale));
  }
});

export default router;
