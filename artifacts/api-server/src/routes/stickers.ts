import {
  db,
  storiesTable,
  stickerReactionsTable,
  notificationsTable,
  characterTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { grantReward } from "../services/rewardService";
import { syncConstellation } from "../services/constellationService";

const router: IRouter = Router();

const VALID_TYPES = new Set([
  "Hopeful", "Peaceful", "Lonely", "Romantic",
  "Chaotic", "Adventurous", "Dreamy", "Soft",
]);

// ── POST /api/stickers — send a vibe sticker ──────────────────────────────────
router.post("/stickers", requireAuth, async (req, res) => {
  const fromUserId = getUserId(req);
  const { storyId, stickerType } = req.body as { storyId?: string; stickerType?: string };

  if (!storyId || !stickerType) {
    return res.status(400).json({ error: "storyId and stickerType are required" });
  }
  if (!VALID_TYPES.has(stickerType)) {
    return res.status(400).json({ error: "Invalid stickerType" });
  }

  try {
    // Resolve story owner
    const [story] = await db
      .select({ userId: storiesTable.userId, title: storiesTable.chapterTitle })
      .from(storiesTable)
      .where(eq(storiesTable.id, storyId))
      .limit(1);

    if (!story) return res.status(404).json({ error: "Story not found" });
    if (story.userId === fromUserId) {
      return res.status(400).json({ error: "Cannot send a sticker to your own story" });
    }

    // Insert (unique constraint prevents duplicate same-type sticker per story)
    await db
      .insert(stickerReactionsTable)
      .values({ fromUserId, toUserId: story.userId, storyId, stickerType })
      .onConflictDoNothing();

    // Notify story owner
    const [sender] = await db
      .select({ name: characterTable.name, username: characterTable.username })
      .from(characterTable)
      .where(eq(characterTable.userId, fromUserId))
      .limit(1);

    const actorName = sender?.username
      ? `@${sender.username}`
      : sender?.name ?? "Someone";

    await db.insert(notificationsTable).values({
      userId:    story.userId,
      actorId:   fromUserId,
      actorName,
      type:      "sticker",
      refId:     storyId,
      title:     `sent you a ${stickerType} sticker on "${story.title}"`,
    });

    // Reward sender for sending (aura energy) — await for client feedback
    const refKey = `${storyId}:${stickerType}`;
    const { granted: rewardGranted, amounts: rewardAmounts } =
      await grantReward(db as any, fromUserId, "sticker_sent", refKey);
    syncConstellation(db as any, fromUserId).catch(() => null);
    // Reward story owner for receiving (fire-and-forget — different user)
    grantReward(db as any, story.userId, "sticker_received", refKey).catch(() => null);
    syncConstellation(db as any, story.userId).catch(() => null);

    return res.json({ ok: true, rewardGranted, rewardAmounts });
  } catch (err) {
    req.log.error({ err }, "Failed to send sticker");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/stickers/story/:storyId — sticker counts for a story ─────────────
router.get("/stickers/story/:storyId", requireAuth, async (req, res) => {
  const storyId = String(req.params.storyId ?? "");

  try {
    const rows = await db
      .select({
        stickerType: stickerReactionsTable.stickerType,
        count:       sql<number>`cast(count(*) as int)`,
      })
      .from(stickerReactionsTable)
      .where(eq(stickerReactionsTable.storyId, storyId))
      .groupBy(stickerReactionsTable.stickerType);

    return res.json(rows.map(r => ({ type: r.stickerType, count: r.count })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sticker counts");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/stickers/received — stickers sent to the current user ────────────
router.get("/stickers/received", requireAuth, async (req, res) => {
  const userId = getUserId(req);

  try {
    const rows = await db
      .select({
        id:          stickerReactionsTable.id,
        fromUserId:  stickerReactionsTable.fromUserId,
        storyId:     stickerReactionsTable.storyId,
        stickerType: stickerReactionsTable.stickerType,
        createdAt:   stickerReactionsTable.createdAt,
      })
      .from(stickerReactionsTable)
      .where(eq(stickerReactionsTable.toUserId, userId))
      .orderBy(sql`${stickerReactionsTable.createdAt} desc`)
      .limit(50);

    return res.json(rows.map(r => ({
      id:          r.id,
      fromUserId:  r.fromUserId,
      storyId:     r.storyId,
      stickerType: r.stickerType,
      createdAt:   r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch received stickers");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
