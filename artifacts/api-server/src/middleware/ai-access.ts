import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";

/**
 * Blocks AI-backed routes when the admin disables the global AI feature flag.
 * Read the setting for each request so changes take effect immediately across
 * API-server instances. Missing legacy values keep the existing enabled default.
 */
export const requireAiAccess: RequestHandler = async (req, res, next) => {
  try {
    const [settings] = await db
      .select({ value: appSettingsTable.value })
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "features"))
      .limit(1);
    const value = settings?.value;
    const features = typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};

    if (features.ai === false) {
      res.status(503).json({
        error: "AI features are currently disabled by an administrator.",
        code: "AI_ACCESS_DISABLED",
      });
      return;
    }

    next();
  } catch (err) {
    req.log.error({ err }, "Failed to read AI access setting");
    res.status(503).json({
      error: "AI access status is temporarily unavailable. Please try again.",
      code: "AI_ACCESS_UNAVAILABLE",
    });
  }
};