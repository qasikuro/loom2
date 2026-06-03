import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, characterTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

const RegisterBody = z.object({
  token: z.string().min(1),
});

/**
 * POST /push/register
 * Saves the caller's Expo push token to their character row.
 * Called once after sign-in when the OS has granted notification permission.
 */
router.post("/push/register", requireAuth, async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "token is required" });
  }

  const userId = getUserId(req);
  const { token } = parsed.data;

  try {
    await db
      .update(characterTable)
      .set({ pushToken: token, updatedAt: new Date() })
      .where(eq(characterTable.userId, userId));

    req.log.info({ userId }, "Push token registered");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to register push token");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /push/register
 * Clears the push token on sign-out so the user stops receiving notifications.
 */
router.delete("/push/register", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    await db
      .update(characterTable)
      .set({ pushToken: null, updatedAt: new Date() })
      .where(eq(characterTable.userId, userId));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to clear push token");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
