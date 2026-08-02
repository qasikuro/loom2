import { Router, type IRouter, type Request, type Response } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { z } from "zod";

const router: IRouter = Router();

const KNOWN_KEYS = ["maintenance_mode", "min_app_version", "features"] as const;

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
    if (!("features"         in settings)) settings.features = {
      stories: true, music: true, shop: true, campfire: true, guides: true, notifications: true,
    };
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

  try {
    await db
      .insert(appSettingsTable)
      .values({ key, value: parsed.data.value as never, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettingsTable.key,
        set: { value: parsed.data.value as never, updatedAt: new Date() },
      });
    return res.json({ ok: true, key, value: parsed.data.value });
  } catch (err) {
    req.log.error({ err }, "admin/settings PUT failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
