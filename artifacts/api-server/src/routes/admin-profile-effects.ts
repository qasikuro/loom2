import { Router, type IRouter, type Request, type Response } from "express";
import { db, profileEffectsTable } from "@workspace/db";
import type { EffectParticleConfig } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireAuth, getUserId } from "../middleware/auth";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey:  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

const CornerSchema = z.object({
  pos:   z.enum(["tl", "tr", "bl", "br"]),
  emoji: z.string(),
  size:  z.number().min(16).max(80),
});

const ConfigSchema = z.object({
  particles:   z.array(z.string()).min(1).max(10),
  count:       z.number().int().min(1).max(20),
  mode:        z.enum(["rise", "fall", "drift", "glow"]),
  fontSize:    z.number().min(10).max(48),
  colors:      z.array(z.string()).optional(),
  speedMs:     z.tuple([z.number(), z.number()]),
  xSwingPct:   z.number().min(0).max(0.5),
  yTravelPct:  z.number().min(0).max(1.2),
  corners:     z.array(CornerSchema).max(4).optional(),
  overlayTint: z.string().optional(),
});

const EffectBodySchema = z.object({
  name:          z.string().min(1).max(80),
  description:   z.string().max(500).default(""),
  icon:          z.string().max(8).default("✨"),
  theme:         z.string().max(40).default("special"),
  rarity:        z.enum(["common", "rare", "legendary"]).default("common"),
  config:        ConfigSchema,
  isActive:      z.boolean().default(true),
  shopCost:      z.object({
    stars:  z.number().int().min(0).optional(),
    aura:   z.number().int().min(0).optional(),
    shards: z.number().int().min(0).optional(),
  }).default({}),
  previewColors: z.array(z.string()).default([]),
});

const GenerateConfigSchema = z.object({
  name:        z.string().min(1),
  description: z.string().default(""),
  theme:       z.string().default("special"),
  extra:       z.string().max(500).default(""),
});

// ── GET /api/effects/catalog — public: all active effects with configs ────────
// Returns DB-created effects so mobile app can register custom configs.

router.get("/effects/catalog", requireAuth, async (req: Request, res: Response) => {
  try {
    const effects = await db
      .select()
      .from(profileEffectsTable)
      .where(eq(profileEffectsTable.isActive, true))
      .orderBy(desc(profileEffectsTable.createdAt));

    return res.json({
      effects: effects.map(e => ({
        id:           `effect_custom_${e.id}`,
        name:         e.name,
        description:  e.description,
        icon:         e.icon,
        theme:        e.theme,
        rarity:       e.rarity,
        config:       e.config,
        shopCost:     e.shopCost,
        previewColors: e.previewColors,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "effects/catalog GET failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/profile-effects ────────────────────────────────────────────

router.get("/admin/profile-effects", requireAdmin, async (req: Request, res: Response) => {
  try {
    const effects = await db
      .select()
      .from(profileEffectsTable)
      .orderBy(desc(profileEffectsTable.createdAt));
    return res.json({ effects });
  } catch (err) {
    req.log.error({ err }, "admin/profile-effects GET failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/profile-effects ───────────────────────────────────────────

router.post("/admin/profile-effects", requireAdmin, async (req: Request, res: Response) => {
  const parsed = EffectBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const userId = getUserId(req);
  const { name, description, icon, theme, rarity, config, isActive, shopCost, previewColors } = parsed.data;

  try {
    const [row] = await db
      .insert(profileEffectsTable)
      .values({
        id: randomUUID(),
        name, description, icon, theme, rarity,
        config: config as EffectParticleConfig,
        isActive, shopCost, previewColors,
        createdBy: userId,
      })
      .returning();

    return res.status(201).json({ effect: row });
  } catch (err) {
    req.log.error({ err }, "admin/profile-effects POST failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/profile-effects/:id ───────────────────────────────────────

router.put("/admin/profile-effects/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const parsed = EffectBodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const [row] = await db
      .update(profileEffectsTable)
      .set({
        ...(parsed.data.name          !== undefined ? { name: parsed.data.name }                             : {}),
        ...(parsed.data.description   !== undefined ? { description: parsed.data.description }               : {}),
        ...(parsed.data.icon          !== undefined ? { icon: parsed.data.icon }                             : {}),
        ...(parsed.data.theme         !== undefined ? { theme: parsed.data.theme }                           : {}),
        ...(parsed.data.rarity        !== undefined ? { rarity: parsed.data.rarity }                         : {}),
        ...(parsed.data.config        !== undefined ? { config: parsed.data.config as EffectParticleConfig } : {}),
        ...(parsed.data.isActive      !== undefined ? { isActive: parsed.data.isActive }                     : {}),
        ...(parsed.data.shopCost      !== undefined ? { shopCost: parsed.data.shopCost }                     : {}),
        ...(parsed.data.previewColors !== undefined ? { previewColors: parsed.data.previewColors }           : {}),
      })
      .where(eq(profileEffectsTable.id, id))
      .returning();

    if (!row) return res.status(404).json({ error: "Effect not found" });
    return res.json({ effect: row });
  } catch (err) {
    req.log.error({ err }, "admin/profile-effects PUT failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/admin/profile-effects/:id ────────────────────────────────────

router.delete("/admin/profile-effects/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(profileEffectsTable).where(eq(profileEffectsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "admin/profile-effects DELETE failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/profile-effects/generate-config ──────────────────────────

const GENERATE_SYSTEM = `You are the creative director for Sky Journal, a dreamy mobile app inspired by Sky: Children of the Light. 
Generate a profile effect animation config JSON for the given theme/name.

Config schema:
{
  "particles": ["🌸","🌺"],    // 2–5 emoji that represent the theme
  "count": 8,                  // 6–14 total particles
  "mode": "fall",              // "rise"(upward), "fall"(downward), "drift"(wave), "glow"(pulse)
  "fontSize": 22,              // 14–32 px
  "colors": ["#F4A0C0"],       // OPTIONAL — only for abstract glyphs like ✦ ⋆ ·, not colored emoji
  "speedMs": [3600, 5800],     // [minCycleMs, maxCycleMs] — slower = dreamier
  "xSwingPct": 0.18,           // 0.05–0.28 horizontal sway (fraction of width)
  "yTravelPct": 0.85,          // 0.40–0.95 vertical travel (fraction of height)
  "corners": [                 // OPTIONAL — 0–4 corner accent elements (like Discord profile frames)
    { "pos": "tl", "emoji": "🌿", "size": 42 },
    { "pos": "tr", "emoji": "🌸", "size": 36 },
    { "pos": "bl", "emoji": "🍃", "size": 32 }
  ],
  "overlayTint": "rgba(200,240,200,0.06)"  // OPTIONAL — very subtle colour wash, max opacity 0.09
}

Mode guide:
- rise: particles float upward (hearts, sparks, lanterns, souls, bubbles)
- fall: particles fall from top (petals, leaves, snow, stars, rain)
- drift: particles move in lazy waves (butterflies, feathers, clouds, jellyfish)
- glow: particles pulse and bob gently in place (fireflies, stars, embers, magic dust)

Rules:
- corners make it look like Discord's profile frames — use them for lush, elaborate effects
- overlayTint should be barely perceptible (max 0.09 opacity), used only for warm/cool washes
- Return ONLY a valid JSON object matching the schema above — no explanation, no markdown, no code fences`;

router.post("/admin/profile-effects/generate-config", requireAdmin, async (req: Request, res: Response) => {
  const parsed = GenerateConfigSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { name, description, theme, extra } = parsed.data;

  const userPrompt = [
    `Effect name: "${name}"`,
    description ? `Description: ${description}` : "",
    `Theme: ${theme}`,
    extra ? `Additional notes: ${extra}` : "",
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic.messages.create({
      model:      "claude-opus-4-5",
      max_tokens: 800,
      system:     GENERATE_SYSTEM,
      messages:   [{ role: "user", content: userPrompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    // Strip markdown fences if Claude added them
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const raw = JSON.parse(jsonText);
    const configParsed = ConfigSchema.safeParse(raw);

    if (!configParsed.success) {
      req.log.warn({ raw, error: configParsed.error }, "AI returned invalid config");
      return res.status(422).json({ error: "AI response did not match expected schema", raw });
    }

    return res.json({ config: configParsed.data });
  } catch (err) {
    req.log.error({ err }, "admin/profile-effects/generate-config failed");
    return res.status(500).json({ error: "AI generation failed" });
  }
});

export default router;
