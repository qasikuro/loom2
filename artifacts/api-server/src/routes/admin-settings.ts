import { Router, type IRouter, type Request, type Response } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";
import { z } from "zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const KNOWN_KEYS = ["maintenance_mode", "min_app_version", "features"] as const;
const DEFAULT_FEATURES: Record<string, boolean> = {
  ai: true,
  stories: true,
  music: true,
  shop: true,
  season: true,
  shop_button: false,
  season_button: false,
  campfire: true,
  guides: true,
  notifications: true,
};

function normalizeFeatures(value: unknown): Record<string, boolean> {
  const saved = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_FEATURES).map(([key, fallback]) => [
      key,
      typeof saved[key] === "boolean" ? saved[key] : fallback,
    ]),
  );
}

// ── GET /admin/settings ───────────────────────────────────────────────────────

router.get("/admin/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const rows = await db.select().from(appSettingsTable);
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    // Ensure all known keys exist with defaults
    if (!("maintenance_mode" in settings)) settings.maintenance_mode = false;
    if (!("min_app_version"  in settings)) settings.min_app_version  = "1.0.0";
    settings.features = normalizeFeatures(settings.features);
    return res.json({ settings });
  } catch (err) {
    req.log.error({ err }, "admin/settings GET failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /admin/settings/:key ──────────────────────────────────────────────────

const PutBody = z.object({ value: z.unknown() });

router.put("/admin/settings/:key", requireAdmin, async (req: Request, res: Response) => {
  const { key } = req.params as { key: string };
  if (!KNOWN_KEYS.includes(key as typeof KNOWN_KEYS[number])) {
    return res.status(400).json({ error: `Unknown setting key: ${key}` });
  }

  const parsed = PutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "value is required" });
  const value = parsed.data.value;
  if (key === "features") {
    const result = z.record(z.boolean()).safeParse(value);
    if (!result.success || Object.keys(result.data).some(k => !(k in DEFAULT_FEATURES))) {
      return res.status(400).json({ error: "Features must contain known boolean flags." });
    }
  } else if (key === "maintenance_mode" && typeof value !== "boolean") {
    return res.status(400).json({ error: "Maintenance mode must be a boolean." });
  } else if (key === "min_app_version" && (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value))) {
    return res.status(400).json({ error: "App version must have the format 1.0.0." });
  }

  try {
    const [saved] = await db
      .insert(appSettingsTable)
      .values({ key, value: parsed.data.value as never, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: {
          value: key === "features"
            ? sql`coalesce(${appSettingsTable.value}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`
            : value as never,
          updatedAt: new Date(),
        },
      }).returning();
    return res.json({ ok: true, key, value: key === "features" ? normalizeFeatures(saved.value) : saved.value });
  } catch (err) {
    req.log.error({ err }, "admin/settings PUT failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
