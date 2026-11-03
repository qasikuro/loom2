import { Router, type IRouter, type Request, type Response } from "express";
import { requireAdmin } from "../middleware/auth";
import {
  FEATURE_DEFINITIONS,
  getFeatureUsageOverview,
  isFeatureUsageKey,
  saveFeatureUsagePolicy,
} from "../lib/featureUsage";
import { z } from "zod";

const router: IRouter = Router();

const DaysSchema = z.coerce.number().int().min(1).max(90).default(30);
const PolicySchema = z.object({
  enabled: z.boolean(),
  hourlyLimit: z.number().int().min(1).max(100_000).nullable(),
  dailyLimit: z.number().int().min(1).max(1_000_000).nullable(),
  dailyBudgetMicros: z.number().int().min(1).max(1_000_000_000_000).nullable(),
  costPerActionMicros: z.number().int().min(0).max(10_000_000_000).nullable(),
}).strict();

router.get("/admin/feature-usage", requireAdmin, async (req: Request, res: Response) => {
  const parsedDays = DaysSchema.safeParse(req.query.days);
  if (!parsedDays.success) {
    return res.status(400).json({ error: "days must be between 1 and 90" });
  }

  try {
    const overview = await getFeatureUsageOverview(parsedDays.data);
    return res.json(overview);
  } catch (error) {
    req.log.error({ err: error }, "admin feature usage GET failed");
    return res.status(500).json({ error: "Could not load feature usage" });
  }
});

router.put("/admin/feature-usage/:featureKey", requireAdmin, async (req: Request, res: Response) => {
  const { featureKey } = req.params as { featureKey: string };
  if (!isFeatureUsageKey(featureKey)) {
    return res.status(400).json({ error: "Unknown feature" });
  }

  const parsed = PolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid feature controls", details: parsed.error.flatten() });
  }
  const definition = FEATURE_DEFINITIONS.find((item) => item.key === featureKey)!;
  if (definition.costSource === "recorded" && parsed.data.costPerActionMicros !== null) {
    return res.status(400).json({ error: "This feature's cost estimate is recorded by the server." });
  }
  if (
    parsed.data.dailyBudgetMicros !== null &&
    definition.costSource === "configurable" &&
    parsed.data.costPerActionMicros === null
  ) {
    return res.status(400).json({ error: "Set a cost per action before enabling a daily cost budget." });
  }

  try {
    await saveFeatureUsagePolicy(featureKey, parsed.data);
    return res.json(parsed.data);
  } catch (error) {
    req.log.error({ err: error, featureKey }, "admin feature usage PUT failed");
    return res.status(500).json({ error: "Could not save feature controls" });
  }
});

export default router;