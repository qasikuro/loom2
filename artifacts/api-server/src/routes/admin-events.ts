import { Router, type IRouter, type Request, type Response } from "express";
import { db, characterTable, userRewardsTable, userPurchasesTable, eventsTable } from "@workspace/db";
import type { EventInventoryItem } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin, getUserId } from "../middleware/auth";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey:  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

const InventoryItemSchema = z.union([
  z.object({ type: z.enum(["stars", "aura", "shards"]), amount: z.number().int().positive(), label: z.string() }),
  z.object({ type: z.literal("item"), itemId: z.string(), itemName: z.string(), label: z.string() }),
]);

const EventBodySchema = z.object({
  title:       z.string().min(1).max(120),
  description: z.string().max(1000).default(""),
  theme:       z.enum(["spring", "summer", "autumn", "winter", "special"]).default("special"),
  status:      z.enum(["draft", "active", "ended"]).default("draft"),
  startsAt:    z.string().datetime().optional().nullable(),
  endsAt:      z.string().datetime().optional().nullable(),
  inventory:   z.array(InventoryItemSchema).default([]),
  aiPrompt:    z.string().max(2000).default(""),
});

const GenerateBodySchema = z.object({
  title:       z.string().min(1),
  description: z.string().default(""),
  theme:       z.string().default("special"),
  extra:       z.string().max(500).default(""),
});

// ── List all events ───────────────────────────────────────────────────────────

router.get("/admin/events", requireAdmin, async (req: Request, res: Response) => {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.createdAt));
    return res.json({ events });
  } catch (err) {
    req.log.error({ err }, "admin/events GET failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create event ──────────────────────────────────────────────────────────────

router.post("/admin/events", requireAdmin, async (req: Request, res: Response) => {
  const parsed = EventBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const userId = getUserId(req);
  const { title, description, theme, status, startsAt, endsAt, inventory, aiPrompt } = parsed.data;

  try {
    const [event] = await db
      .insert(eventsTable)
      .values({
        title,
        description,
        theme,
        status,
        startsAt:  startsAt ? new Date(startsAt) : null,
        endsAt:    endsAt   ? new Date(endsAt)   : null,
        inventory: inventory as EventInventoryItem[],
        aiPrompt,
        createdBy: userId,
      })
      .returning();

    return res.status(201).json(event);
  } catch (err) {
    req.log.error({ err }, "admin/events POST failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Update event ──────────────────────────────────────────────────────────────

router.put("/admin/events/:id", requireAdmin, async (req: Request, res: Response) => {
  const parsed = EventBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const { title, description, theme, status, startsAt, endsAt, inventory, aiPrompt } = parsed.data;

  try {
    const [event] = await db
      .update(eventsTable)
      .set({
        title,
        description,
        theme,
        status,
        startsAt:  startsAt ? new Date(startsAt) : null,
        endsAt:    endsAt   ? new Date(endsAt)   : null,
        inventory: inventory as EventInventoryItem[],
        aiPrompt,
      })
      .where(eq(eventsTable.id, String(req.params.id)))
      .returning();

    if (!event) return res.status(404).json({ error: "Event not found" });
    return res.json(event);
  } catch (err) {
    req.log.error({ err }, "admin/events PUT failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Delete event ──────────────────────────────────────────────────────────────

router.delete("/admin/events/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.delete(eventsTable).where(eq(eventsTable.id, String(req.params.id)));
    return res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "admin/events DELETE failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── AI inventory generation ────────────────────────────────────────────────────

const AI_SYSTEM = `You are the content designer for Sky Journal — a dreamy, Sky: Children of the Light-inspired mobile app with a soft aesthetic. You design reward inventories for in-game events.

Respond ONLY with valid JSON: an array of inventory items. No markdown fences. No explanation. Just the array.

Each item must be one of:
- { "type": "stars",  "amount": <int 50-500>,  "label": "<N> Stars" }
- { "type": "aura",   "amount": <int 50-500>,  "label": "<N> Aura Energy" }
- { "type": "shards", "amount": <int 10-200>,  "label": "<N> Memory Shards" }
- { "type": "item",   "itemId": "<snake_case_id>", "itemName": "<Name>", "label": "<Name>" }

Cosmetic items should have thematic itemIds like "frame_blossom", "accent_aurora", "theme_moonveil".
Return 4–7 items total. Make the inventory feel generous but balanced. Match the event's mood and season.`;

router.post("/admin/events/generate-inventory", requireAdmin, async (req: Request, res: Response) => {
  const parsed = GenerateBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.issues });

  const { title, description, theme, extra } = parsed.data;

  const userPrompt = `Design a reward inventory for this Sky Journal event:

Title: ${title}
Theme: ${theme}
Description: ${description}${extra ? `\nExtra context: ${extra}` : ""}

Return 4–7 inventory items as a JSON array.`;

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      system:     AI_SYSTEM,
      messages:   [{ role: "user", content: userPrompt }],
    });

    const rawText = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const match   = rawText.match(/\[[\s\S]*\]/);
    if (!match) {
      req.log.warn({ rawText }, "AI returned no JSON array for event inventory");
      return res.status(502).json({ error: "AI returned no inventory" });
    }

    const inventory = JSON.parse(match[0]) as EventInventoryItem[];
    return res.json({ inventory, prompt: userPrompt });
  } catch (err: any) {
    req.log.error({ err }, "admin/events/generate-inventory failed");
    return res.status(500).json({ error: "AI generation failed", message: err?.message });
  }
});

// ── Grant event inventory to all users ───────────────────────────────────────

router.post("/admin/events/:id/grant", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, String(req.params.id))).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const inventory = (event.inventory ?? []) as EventInventoryItem[];
    if (!inventory.length) return res.status(400).json({ error: "Event has no inventory to grant" });

    // Sum up currency totals
    let totalStars  = 0;
    let totalAura   = 0;
    let totalShards = 0;
    const items: Array<{ itemId: string; itemName: string }> = [];

    for (const item of inventory) {
      if (item.type === "stars")  totalStars  += item.amount ?? 0;
      if (item.type === "aura")   totalAura   += item.amount ?? 0;
      if (item.type === "shards") totalShards += item.amount ?? 0;
      if (item.type === "item" && item.itemId)
        items.push({ itemId: item.itemId, itemName: item.itemName ?? item.label });
    }

    // Get all registered users
    const allUsers = await db.select({ userId: characterTable.userId }).from(characterTable);
    if (!allUsers.length) return res.json({ granted: 0, message: "No users to grant to" });

    const userIds = allUsers.map((u) => u.userId);

    // Grant currency — upsert each user's rewards row
    if (totalStars > 0 || totalAura > 0 || totalShards > 0) {
      for (const userId of userIds) {
        await db
          .insert(userRewardsTable)
          .values({
            userId,
            stars:         totalStars,
            auraEnergy:    totalAura,
            memoryShards:  totalShards,
            lifetimeStars: totalStars,
          })
          .onConflictDoUpdate({
            target: userRewardsTable.userId,
            set: {
              stars:         sql`${userRewardsTable.stars} + ${totalStars}`,
              auraEnergy:    sql`${userRewardsTable.auraEnergy} + ${totalAura}`,
              memoryShards:  sql`${userRewardsTable.memoryShards} + ${totalShards}`,
              lifetimeStars: sql`${userRewardsTable.lifetimeStars} + ${totalStars}`,
              updatedAt:     sql`now()`,
            },
          });
      }
    }

    // Grant cosmetic items — insert into user_purchases, skip duplicates
    let itemsGranted = 0;
    if (items.length) {
      for (const userId of userIds) {
        for (const it of items) {
          try {
            await db
              .insert(userPurchasesTable)
              .values({
                userId,
                itemId:      it.itemId,
                itemName:    it.itemName,
                starsSpent:  0,
                auraSpent:   0,
                shardsSpent: 0,
              })
              .onConflictDoNothing();
            itemsGranted++;
          } catch { /* skip duplicates */ }
        }
      }
    }

    req.log.info({ eventId: event.id, userCount: userIds.length, totalStars, totalAura, totalShards, itemsGranted }, "Event inventory granted");
    return res.json({
      granted:    userIds.length,
      stars:      totalStars,
      aura:       totalAura,
      shards:     totalShards,
      itemsGranted,
      message:    `Granted to ${userIds.length} users`,
    });
  } catch (err) {
    req.log.error({ err }, "admin/events grant failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
