import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, characterTable, pushDevicesTable } from "@workspace/db";
import { and, desc, eq, ne } from "drizzle-orm";
import { requireAuth, getUserId } from "../middleware/auth";

const router: IRouter = Router();

const ExpoToken = z.string().min(1).max(500).regex(/^(?:Exponent|Expo)PushToken\[[^\]]+\]$/);
const RegisterBody = z.object({
  token: ExpoToken,
  platform: z.enum(["ios", "android", "unknown"]).default("unknown"),
});
const UnregisterBody = z.object({ token: ExpoToken }).optional();

/**
 * POST /push/register
 * Saves this app installation's Expo token. The legacy character token is
 * retained as a compatibility pointer until older app versions age out.
 */
router.post("/push/register", requireAuth, async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "token is required" });
  }

  const userId = getUserId(req);
  const { token, platform } = parsed.data;
  const now = new Date();

  try {
    await db.transaction(async tx => {
      // A token identifies one installation. If the same installation changes
      // accounts, move it instead of leaving the previous account subscribed.
      await tx.update(characterTable)
        .set({ pushToken: null, updatedAt: now })
        .where(and(eq(characterTable.pushToken, token), ne(characterTable.userId, userId)));

      await tx.insert(pushDevicesTable).values({
        token,
        userId,
        platform,
        lastSeenAt: now,
      }).onConflictDoUpdate({
        target: pushDevicesTable.token,
        set: { userId, platform, lastSeenAt: now },
      });

      await tx.update(characterTable)
        .set({ pushToken: token, updatedAt: now })
        .where(eq(characterTable.userId, userId));
    });

    req.log.info({ userId }, "Push token registered");
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to register push token");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /push/register
 * Removes one installation on sign-out. Older clients without a token body
 * retain the previous behavior and unregister every installation for the user.
 */
router.delete("/push/register", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const parsed = UnregisterBody.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid push token" });
  const token = parsed.data?.token;
  const now = new Date();
  try {
    await db.transaction(async tx => {
      if (token) {
        await tx.delete(pushDevicesTable)
          .where(and(eq(pushDevicesTable.userId, userId), eq(pushDevicesTable.token, token)));
      } else {
        await tx.delete(pushDevicesTable).where(eq(pushDevicesTable.userId, userId));
      }

      const [remaining] = await tx.select({ token: pushDevicesTable.token })
        .from(pushDevicesTable)
        .where(eq(pushDevicesTable.userId, userId))
        .orderBy(desc(pushDevicesTable.lastSeenAt))
        .limit(1);

      await tx.update(characterTable)
        .set({ pushToken: remaining?.token ?? null, updatedAt: now })
        .where(eq(characterTable.userId, userId));
    });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to clear push token");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
