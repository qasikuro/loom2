import { db, messages as messagesTable, characterTable } from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { requireAuth, getUserId } from "../middleware/auth";
import { z } from "zod";
import { sendPushNotification } from "../services/pushService";
import { emitSSEEvent } from "../lib/sseEmitter";
import { checkMsgRateLimit } from "../middleware/messageLimiter";
import { isBlocked } from "./blocks";

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
        and(
          or(
            eq(messagesTable.fromUserId, userId),
            eq(messagesTable.toUserId,   userId),
          ),
          // Show if: not deleted, OR sender-only delete (recipient still sees it),
          // OR recipient-only clear (sender still sees it)
          or(
            isNull(messagesTable.deletedAt),
            and(eq(messagesTable.deletedFor, "sender"),    eq(messagesTable.toUserId,   userId)),
            and(eq(messagesTable.deletedFor, "recipient"), eq(messagesTable.fromUserId, userId)),
          ),
        ),
      )
      .orderBy(desc(messagesTable.createdAt))
      .limit(500);

    // Build threads: last message per conversation partner
    const seen       = new Map<string, typeof rows[number]>();
    const partnerIds = new Set<string>();
    for (const row of rows) {
      const partner = row.fromUserId === userId ? row.toUserId : row.fromUserId;
      // Skip if message was deleted by this user (deleted_for === 'sender' and I'm sender)
      if (row.deletedAt && row.deletedFor === "sender" && row.fromUserId === userId) continue;
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
        and(
          or(
            and(eq(messagesTable.fromUserId, myId),   eq(messagesTable.toUserId, otherId)),
            and(eq(messagesTable.fromUserId, otherId), eq(messagesTable.toUserId, myId)),
          ),
          // Show if: not deleted, OR sender-only delete (recipient still sees it),
          // OR recipient-only clear (sender still sees it)
          or(
            isNull(messagesTable.deletedAt),
            and(eq(messagesTable.deletedFor, "sender"),    eq(messagesTable.toUserId,   myId)),
            and(eq(messagesTable.deletedFor, "recipient"), eq(messagesTable.fromUserId, myId)),
          ),
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

  // Block check
  if (await isBlocked(fromId, toId)) {
    return res.status(403).json({ error: "Cannot send message to this user" });
  }

  // Rate limiting: 20 messages per minute per DM thread
  const rl = checkMsgRateLimit(fromId, toId);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    return res.status(429).json({ error: "Sending too fast — slow down a little" });
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

    // Fire-and-forget: push notification to recipient
    sendPushForMessage(fromId, toId, content ?? null, expression ?? null).catch(() => null);

    // Emit SSE event to the recipient's message channel so their open chat updates live
    emitSSEEvent(`messages:${toId}`, {
      type:       "new_message",
      id:         msg.id,
      fromUserId: msg.fromUserId,
      toUserId:   msg.toUserId,
      content:    msg.content    ?? null,
      expression: msg.expression ?? null,
      isRead:     msg.isRead,
      createdAt:  msg.createdAt,
      isOwn:      false,
    });

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

// ── DELETE /api/messages/:messageId — soft-delete a message ──────────────────
router.delete("/messages/:messageId", requireAuth, async (req, res) => {
  const userId    = getUserId(req);
  const messageId = String(req.params.messageId);
  const forEveryone = req.query.forEveryone === "true";

  try {
    const [msg] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1);

    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.fromUserId !== userId)
      return res.status(403).json({ error: "You can only delete your own messages" });

    await db
      .update(messagesTable)
      .set({
        deletedAt:  new Date(),
        deletedFor: forEveryone ? "both" : "sender",
      })
      .where(eq(messagesTable.id, messageId));

    // Notify both sides via SSE so UI updates immediately
    const payload = { type: "message_deleted", messageId, forEveryone };
    emitSSEEvent(`messages:${msg.fromUserId}`, payload);
    emitSSEEvent(`messages:${msg.toUserId}`,   payload);

    return res.json({ deleted: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete message");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/messages/conversation/:partnerId — clear thread for caller ────
// Soft-deletes all messages in this thread from the caller's side only.
// Partner continues to see the messages; the caller's view is wiped.
router.delete("/messages/conversation/:partnerId", requireAuth, async (req, res) => {
  const userId    = getUserId(req);
  const partnerId = String(req.params.partnerId);
  if (userId === partnerId) return res.status(400).json({ error: "Cannot clear conversation with yourself" });
  try {
    // Messages where I am the SENDER → mark deleted_for = 'sender'
    await db
      .update(messagesTable)
      .set({ deletedAt: new Date(), deletedFor: "sender" })
      .where(
        and(
          eq(messagesTable.fromUserId, userId),
          eq(messagesTable.toUserId,   partnerId),
          isNull(messagesTable.deletedAt),
        ),
      );
    // Messages where I am the RECIPIENT → mark deleted_for = 'recipient'
    await db
      .update(messagesTable)
      .set({ deletedAt: new Date(), deletedFor: "recipient" })
      .where(
        and(
          eq(messagesTable.fromUserId, partnerId),
          eq(messagesTable.toUserId,   userId),
          isNull(messagesTable.deletedAt),
        ),
      );
    // Notify caller's other devices via SSE
    emitSSEEvent(`messages:${userId}`, { type: "conversation_cleared", partnerId });
    return res.json({ cleared: true });
  } catch (err) {
    req.log.error({ err }, "Failed to clear conversation");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/messages/:userId/typing — broadcast typing indicator ────────────
// No DB write — just fan-out SSE to the recipient
router.post("/messages/:userId/typing", requireAuth, async (req, res) => {
  const fromId = getUserId(req);
  const toId   = String(req.params.userId);

  if (fromId !== toId) {
    emitSSEEvent(`messages:${toId}`, { type: "typing", fromUserId: fromId });
  }
  return res.status(204).end();
});

// ─────────────────────────────────────────────────────────────────────────────

const EXPR_PUSH_LABELS: Record<string, string> = {
  bomb:     "threw a bomb 💥",
  stone:    "threw a stone 🪨",
  mirror:   "broke the mirror ✦",
  kiss:     "sent you a kiss 💕",
  stars:    "scattered stars ✦",
  fire:     "lit a fire 🔥",
  snow:     "cast a blizzard ❄️",
  confetti: "celebrated 🎉",
  candle:   "offered a candle 🕯️",
  spark:    "sent a spark ✦",
  lantern:  "lit a lantern 🌙",
  hush:     "fell silent 🤫",
  donkey:   "sent the donkey 🫏",
  wolf:     "howled at the moon 🌕",
};

async function sendPushForMessage(
  fromId:     string,
  toId:       string,
  content:    string | null,
  expression: string | null,
): Promise<void> {
  const [row] = await db
    .select({ name: characterTable.name })
    .from(characterTable)
    .where(eq(characterTable.userId, fromId))
    .limit(1);
  const senderName = row?.name ?? "A sky child";
  const body = expression
    ? (EXPR_PUSH_LABELS[expression] ?? expression)
    : (content ? (content.length > 80 ? content.slice(0, 77) + "…" : content) : "");
  if (!body) return;
  await sendPushNotification(toId, {
    title: senderName,
    body,
    data:  { type: "message", refId: fromId },
  });
}

export default router;
