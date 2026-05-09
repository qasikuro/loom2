import { db, reportsTable } from "@workspace/db";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

const VALID_REASONS = [
  "Inappropriate content",
  "Spam or misleading",
  "Harassment or hate speech",
  "Copyright infringement",
  "Other",
] as const;

const ReportSchema = z.object({
  targetType: z.enum(["story", "outfit", "user"]),
  targetId:   z.string().min(1),
  reason:     z.enum(VALID_REASONS),
  details:    z.string().max(500).default(""),
});

router.post("/reports", requireAuth, async (req, res) => {
  const reporterId = getUserId(req);
  const parsed = ReportSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { targetType, targetId, reason, details } = parsed.data;

  // Prevent self-reporting (best-effort guard on user type)
  if (targetType === "user" && targetId === reporterId) {
    return res.status(400).json({ error: "Cannot report yourself" });
  }

  try {
    await db.insert(reportsTable).values({
      reporterId,
      targetType,
      targetId,
      reason,
      details,
    });
    return res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
