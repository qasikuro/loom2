import { db, messagesTable, characterTable } from "@workspace/db";
import { and, eq, or, desc, asc, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { z } from "zod";

const router: IRouter = Router();

const VALID_EXPRESSIONS = [
  "bomb", "stone", "mirror", "kiss", "stars", "fire",
  "snow", "confetti", "candle", "spark", "lantern", "hush",
  "donkey", "wolf",
] as const;

const SendMessageSchema = z.object({
  content:    z.string().min(1).max(2000).optional(),
  expression: z.enum(VALID_EXPRESSIONS).optional(),
}).refine(d => d.content || d.expression, { message: "content or expression required" });

// ── GET /api/messages — list conversations (distinct threads) ─────────────────
router.get("/messages", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  try {
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
    const seen       = new Map<string, typeof rows[number]>();
    const partnerIds = new Set<string>();
    for (const row of rows) {
      const partner = row.fromUserId === userId ? row.toUserId : row.fromUserId;
      if (!seen.has(partner)) {
        seen.set(partner, row);
        partnerIds.add(partner);
      }
    }

    // Fetch partner character info in one query
    const partnerArr = Array.from(partnerIds);
    const charMap    = new Map<string, { name: string; username: string | null; avatarUri: string | null }>();
    if (partnerArr.length > 0) {
      const charRows = await db
        .select({ userId: characterTable.userId, name: characterTable.name, username: characterTable.username, avatarUri: characterTable.avatarUri })
        .from(characterTable)
        .where(inArray(characterTable.userId, partnerArr));
      for (const c of charRows) {
        charMap.set(c.userId, { name: c.name, username: c.username ?? null, avatarUri: c.avatarUri ?? null });
      }
    }

    const EXPR_LABELS: Record<string, string> = {
      bomb:     'threw a bomb 💥',
      stone:    'threw a stone 🪨',
      mirror:   'broke the mirror ✦',
      kiss:     'sent you a kiss 💕',
      stars:    'scattered stars ✦',
      fire:     'lit a fire 🔥',
      snow:     'cast a blizzard ❄️',
      confetti: 'celebrated 🎉',
      candle:   'offered a candle 🕯️',
      spark:    'sent a spark ✦',
      lantern:  'lit a lantern 🌙',
      hush:     'fell silent 🤫',
      donkey:   'sent the donkey 🫏',
      wolf:     'howled at the moon 🌕',
    };

    const threads = Array.from(seen.entries()).map(([partner, lastMsg]) => ({
      partnerId:    partner,
      partnerName:  charMap.get(partner)?.name      ?? "Sky Child",
      partnerHandle:charMap.get(partner)?.username  ?? null,
      partnerAvatar:charMap.get(partner)?.avatarUri ?? null,
      lastMessage:  lastMsg.expression
        ? EXPR_LABELS[lastMsg.expression] ?? lastMsg.expression
        : (lastMsg.content ?? ''),
      lastAt:  lastMsg.createdAt,
      unread:  lastMsg.toUserId === userId && !lastMsg.isRead,
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
          and(eq(messagesTable.fromUserId, myId),   eq(messagesTable.toUserId, otherId)),
          and(eq(messagesTable.fromUserId, otherId), eq(messagesTable.toUserId, myId)),
        ),
      )
      .orderBy(asc(messagesTable.createdAt))
      .limit(200);

    // Mark incoming unread messages as read
    const hasUnread = rows.some(r => r.toUserId === myId && !r.isRead);
    if (hasUnread) {
      await db
        .update(messagesTable)
        .set({ isRead: true })
        .where(eq(messagesTable.toUserId, myId));
    }

    return res.json(rows.map(r => ({
      id:         r.id,
      fromUserId: r.fromUserId,
      toUserId:   r.toUserId,
      content:    r.content    ?? null,
      expression: r.expression ?? null,
      isRead:     r.isRead,
      createdAt:  r.createdAt,
      isOwn:      r.fromUserId === myId,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get message thread");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/messages/:userId — send a message or expression ─────────────────
router.post("/messages/:userId", requireAuth, async (req, res) => {
  const fromId = getUserId(req);
  const toId   = String(req.params.userId);

  if (fromId === toId) {
    return res.status(400).json({ error: "Cannot message yourself" });
  }

  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { content, expression } = parsed.data;

  try {
    // Check if this is the first message in this thread (before inserting)
    const existing = await db
      .select({ id: messagesTable.id })
      .from(messagesTable)
      .where(
        or(
          and(eq(messagesTable.fromUserId, fromId), eq(messagesTable.toUserId, toId)),
          and(eq(messagesTable.fromUserId, toId),   eq(messagesTable.toUserId, fromId)),
        ),
      )
      .limit(1);

    const [msg] = await db
      .insert(messagesTable)
      .values({ fromUserId: fromId, toUserId: toId, content: content ?? null, expression: expression ?? null })
      .returning();

    // First contact with a guide → increment their dreamersGuided counter
    if (existing.length === 0) {
      await db
        .update(characterTable)
        .set({ dreamersGuided: sql`${characterTable.dreamersGuided} + 1` })
        .where(and(eq(characterTable.userId, toId), eq(characterTable.isGuide, true)));
    }

    return res.status(201).json({
      id:         msg.id,
      fromUserId: msg.fromUserId,
      toUserId:   msg.toUserId,
      content:    msg.content    ?? null,
      expression: msg.expression ?? null,
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
