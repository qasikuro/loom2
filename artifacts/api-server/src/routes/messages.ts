import { db, messagesTable, characterTable } from "@workspace/db";
import { and, eq, or, desc, asc, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { z } from "zod";

const router: IRouter = Router();

const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

// ── GET /api/messages — list conversations (distinct threads) ─────────────────
router.get("/messages", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
    // Get all messages involving me
    const rows = await db
      .select()
      .from(messagesTable)
      .where(
        or(
          eq(messagesTable.fromUserId, userId),
          eq(messagesTable.toUserId,   userId),
        ),
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(500);

    // Build threads: last message per conversation partner
    const seen    = new Map<string, typeof rows[number]>();
    const partnerIds = new Set<string>();
    for (const row of rows) {
      const partner = row.fromUserId === userId ? row.toUserId : row.fromUserId;
      if (!seen.has(partner)) {
        seen.set(partner, row);
        partnerIds.add(partner);
      }
    }

    // Fetch partner names
    const partnerArr = Array.from(partnerIds);
    const chars = partnerArr.length > 0
      ? await db
          .select({ userId: characterTable.userId, name: characterTable.name, username: characterTable.username, avatarUri: characterTable.avatarUri })
          .from(characterTable)
          .where(eq(characterTable.userId, partnerArr[0])) // quick — refine below
      : [];

    // Fetch only the specific partners
    const charMap = new Map<string, { name: string; username: string | null; avatarUri: string | null }>();
    if (partnerArr.length > 0) {
      const charRows = await db
        .select({ userId: characterTable.userId, name: characterTable.name, username: characterTable.username, avatarUri: characterTable.avatarUri })
        .from(characterTable)
        .where(inArray(characterTable.userId, partnerArr));
      for (const c of charRows) {
        charMap.set(c.userId, { name: c.name, username: c.username ?? null, avatarUri: c.avatarUri ?? null });
      }
    }

    const threads = Array.from(seen.entries()).map(([partner, lastMsg]) => ({
      partnerId:    partner,
      partnerName:  charMap.get(partner)?.name   ?? "Sky Child",
      partnerHandle:charMap.get(partner)?.username ?? null,
      partnerAvatar:charMap.get(partner)?.avatarUri ?? null,
      lastMessage:  lastMsg.content,
      lastAt:       lastMsg.createdAt,
      unread:       lastMsg.toUserId === userId && !lastMsg.isRead,
    }));

    return res.json(threads);
  } catch (err) {
    req.log.error({ err }, "Failed to list message threads");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/messages/:userId — get thread with a user ────────────────────────
router.get("/messages/:userId", requireAuth, async (req, res) => {
  const myId    = getUserId(req);
  const otherId = String(req.params.userId);

  try {
    const rows = await db
      .select()
      .from(messagesTable)
      .where(
        or(
          and(eq(messagesTable.fromUserId, myId),    eq(messagesTable.toUserId, otherId)),
          and(eq(messagesTable.fromUserId, otherId),  eq(messagesTable.toUserId, myId)),
        ),
      )
      .orderBy(asc(messagesTable.createdAt))
      .limit(200);

    // Mark unread messages as read
    const unreadIds = rows.filter(r => r.toUserId === myId && !r.isRead).map(r => r.id);
    if (unreadIds.length > 0) {
      await db
        .update(messagesTable)
        .set({ isRead: true })
        .where(eq(messagesTable.toUserId, myId));
    }

    return res.json(rows.map(r => ({
      id:         r.id,
      fromUserId: r.fromUserId,
      toUserId:   r.toUserId,
      content:    r.content,
      isRead:     r.isRead,
      createdAt:  r.createdAt,
      isOwn:      r.fromUserId === myId,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get message thread");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/messages/:userId — send a message ───────────────────────────────
router.post("/messages/:userId", requireAuth, async (req, res) => {
  const fromId  = getUserId(req);
  const toId    = String(req.params.userId);

  if (fromId === toId) {
    return res.status(400).json({ error: "Cannot message yourself" });
  }

  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const [msg] = await db
      .insert(messagesTable)
      .values({ fromUserId: fromId, toUserId: toId, content: parsed.data.content })
      .returning();

    return res.status(201).json({
      id:         msg.id,
      fromUserId: msg.fromUserId,
      toUserId:   msg.toUserId,
      content:    msg.content,
      isRead:     msg.isRead,
      createdAt:  msg.createdAt,
      isOwn:      true,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
