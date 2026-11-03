import { db, messages as messagesTable, characterTable } from "@workspace/db";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth, getUserId } from "../middleware/auth";
import { z } from "zod";
import { sendPushNotification } from "../services/pushService";
import { emitSSEEvent } from "../lib/sseEmitter";
import { checkMsgRateLimit } from "../middleware/messageLimiter";
import { isBlocked } from "./blocks";
import { normalizePublicMediaFields } from "../lib/publicMediaUri";
import { assertOwnedMediaReferences, MediaOwnershipError } from "../lib/mediaAccess";
import { claimUpload } from "../lib/uploadTracking";

const router: IRouter = Router();
const DEFAULT_CHAT_PAGE_SIZE = 50;
const MAX_CHAT_PAGE_SIZE = 100;

const VALID_EXPRESSIONS = [
  "bomb", "stone", "mirror", "kiss", "stars", "fire",
  "snow", "confetti", "candle", "spark", "lantern", "hush",
  "donkey", "wolf",
] as const;

const SendMessageSchema = z.object({
  clientMessageId: z.string().uuid().optional(),
  content:    z.string().min(1).max(2000).optional(),
  expression: z.enum(VALID_EXPRESSIONS).optional(),
  imageUri: z.string().max(2048).regex(/^\/api\/images\/[\w.-]+$/).optional(),
  videoUri: z.string().max(2048).regex(/^\/api\/videos\/[\w.-]+$/).optional(),
  thumbnailUri: z.string().max(2048).regex(/^\/api\/images\/[\w.-]+$/).optional(),
}).refine(d => d.content || d.expression || d.imageUri || d.videoUri, { message: "Message or media required" })
  .refine(d => !(d.imageUri && d.videoUri), { message: "Send one media attachment at a time" })
  .refine(d => !d.thumbnailUri || !!d.videoUri, { message: "A video thumbnail requires a video" })
  .refine(d => !d.expression || (!d.imageUri && !d.videoUri && !d.thumbnailUri), { message: "Send expressions and media separately" });

// ── GET /api/messages — list conversations (distinct threads) ─────────────────
router.get("/messages", requireAuth, async (req, res) => {
  res.set({ "Cache-Control": "private, no-store", ETag: `W/"messages-${randomUUID()}"` });
  const userId = getUserId(req);
  try {
    const rows = await db
      .select({
        fromUserId: messagesTable.fromUserId,
        toUserId: messagesTable.toUserId,
        content: messagesTable.content,
        imageUri: messagesTable.imageUri,
        videoUri: messagesTable.videoUri,
        expression: messagesTable.expression,
        isRead: messagesTable.isRead,
        deletedAt: messagesTable.deletedAt,
        deletedFor: messagesTable.deletedFor,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(
        and(
          or(
            eq(messagesTable.fromUserId, userId),
            eq(messagesTable.toUserId,   userId),
          ),
          // Clearing a conversation is per-account; blocking does not erase
          // either participant's existing history.
          sql`NOT (${messagesTable.hiddenForUserIds} @> ARRAY[${userId}]::text[])`,
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
    const unavailable = new Set<string>();
    if (partnerArr.length > 0) {
      const charRows = await db
        .select({ userId: characterTable.userId, name: characterTable.name, username: characterTable.username, avatarUri: characterTable.avatarUri, isBanned: characterTable.isBanned, suspendedUntil: characterTable.suspendedUntil })
        .from(characterTable)
        .where(inArray(characterTable.userId, partnerArr));
      for (const c of charRows) {
        if (c.isBanned || (c.suspendedUntil && c.suspendedUntil > new Date())) {
          unavailable.add(c.userId);
          continue;
        }
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

    const threads = Array.from(seen.entries()).filter(([partner]) => !unavailable.has(partner)).map(([partner, lastMsg]) => ({
      partnerId:    partner,
      partnerName:  charMap.get(partner)?.name      ?? "Deleted account",
      partnerHandle:charMap.get(partner)?.username  ?? null,
      partnerAvatar:charMap.get(partner)?.avatarUri ?? null,
      partnerDeleted: !charMap.has(partner),
      lastMessage:  lastMsg.imageUri ? (lastMsg.content || "Photo") : lastMsg.videoUri ? (lastMsg.content || "Video") : lastMsg.expression
        ? EXPR_LABELS[lastMsg.expression] ?? lastMsg.expression
        : (lastMsg.content ?? ''),
      lastAt:  lastMsg.createdAt,
      unread:  lastMsg.toUserId === userId && !lastMsg.isRead,
    }));

    return res.json(normalizePublicMediaFields(threads));
  } catch (err) {
    req.log.error({ err }, "Failed to list message threads");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/messages/:userId — get thread with a user ────────────────────────
router.get("/messages/:userId", requireAuth, async (req, res) => {
  res.set({ "Cache-Control": "private, no-store", ETag: `W/"conversation-${randomUUID()}"` });
  const myId    = getUserId(req);
  const otherId = String(req.params.userId);
  const requestedLimit = req.query.limit === undefined ? DEFAULT_CHAT_PAGE_SIZE : Number(req.query.limit);
  const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
  const beforeId = typeof req.query.beforeId === "string" ? req.query.beforeId : null;
  if (
    !Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_CHAT_PAGE_SIZE
    || ((before === null) !== (beforeId === null))
    || (before && !Number.isFinite(before.getTime()))
    || (beforeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(beforeId))
  ) {
    return res.status(400).json({ error: "Invalid conversation page cursor" });
  }

  try {
    const visibleToUser = and(
      or(
        and(eq(messagesTable.fromUserId, myId), eq(messagesTable.toUserId, otherId)),
        and(eq(messagesTable.fromUserId, otherId), eq(messagesTable.toUserId, myId)),
      ),
      sql`NOT (${messagesTable.hiddenForUserIds} @> ARRAY[${myId}]::text[])`,
      or(
        isNull(messagesTable.deletedAt),
        and(eq(messagesTable.deletedFor, "sender"), eq(messagesTable.toUserId, myId)),
        and(eq(messagesTable.deletedFor, "recipient"), eq(messagesTable.fromUserId, myId)),
      ),
    );
    const cursor = before && beforeId
      ? sql`(${messagesTable.createdAt}, ${messagesTable.id}) < (${before}, ${beforeId}::uuid)`
      : undefined;
    const rows = await db
      .select({
        id: messagesTable.id,
        fromUserId: messagesTable.fromUserId,
        toUserId: messagesTable.toUserId,
        content: messagesTable.content,
        imageUri: messagesTable.imageUri,
        videoUri: messagesTable.videoUri,
        thumbnailUri: messagesTable.thumbnailUri,
        expression: messagesTable.expression,
        isRead: messagesTable.isRead,
        deletedAt: messagesTable.deletedAt,
        deletedFor: messagesTable.deletedFor,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(cursor ? and(visibleToUser, cursor) : visibleToUser)
      .orderBy(desc(messagesTable.createdAt), desc(messagesTable.id))
      .limit(requestedLimit);
    rows.reverse();

    // Start the read receipt after the bounded message query; never hold first
    // paint open for a secondary write.
    if (before === null && rows.some(r => r.toUserId === myId && !r.isRead)) {
      void db
        .update(messagesTable)
        .set({ isRead: true })
        .where(and(
          eq(messagesTable.toUserId, myId),
          eq(messagesTable.fromUserId, otherId),
          eq(messagesTable.isRead, false),
          sql`NOT (${messagesTable.hiddenForUserIds} @> ARRAY[${myId}]::text[])`,
        ))
        .catch(error => req.log.warn({ error }, "Failed to mark conversation as read"));
    }

    return res.json(rows.map(r => ({
      id:         r.id,
      fromUserId: r.fromUserId,
      toUserId:   r.toUserId,
      content:    r.content    ?? null,
      imageUri:   r.imageUri   ?? null,
      videoUri:   r.videoUri   ?? null,
      thumbnailUri: r.thumbnailUri ?? null,
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
router.post(["/messages/:userId", "/messages/:userId/photos", "/messages/:userId/videos"], requireAuth, async (req, res) => {
  const fromId = getUserId(req);
  const toId   = String(req.params.userId);

  if (fromId === toId) {
    return res.status(400).json({ error: "Cannot message yourself" });
  }

  // Block check
  if (await isBlocked(fromId, toId)) {
    return res.status(403).json({ error: "Cannot send message to this user" });
  }
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
  }

  const { clientMessageId, content, expression, imageUri, videoUri, thumbnailUri } = parsed.data;
  if (req.path.endsWith("/photos") && !imageUri) {
    return res.status(400).json({ error: "A photo is required" });
  }
  if (req.path.endsWith("/videos") && !videoUri) {
    return res.status(400).json({ error: "A video is required" });
  }

  try {
    const result = await db.transaction(async tx => {
      // Lock both live profiles in stable order until the message commits.
      // Account deletion removes its profile in its own transaction, so it
      // either wins first (and the send is rejected) or waits for this send.
      const participants = await tx.select({ userId: characterTable.userId })
        .from(characterTable)
        .where(or(eq(characterTable.userId, fromId), eq(characterTable.userId, toId)))
        .orderBy(asc(characterTable.userId))
        .for("key share");
      if (participants.length !== 2) return { kind: "unavailable" as const };

      // A retry with the same client UUID returns the committed row rather
      // than creating a duplicate. The primary key arbitrates simultaneous
      // requests that arrive while both hold a compatible recipient lock.
      if (clientMessageId) {
        const [previous] = await tx.select()
          .from(messagesTable)
          .where(eq(messagesTable.id, clientMessageId))
          .limit(1);
        if (previous) {
          const sameRequest = previous.fromUserId === fromId
            && previous.toUserId === toId
            && previous.content === (content ?? null)
            && previous.expression === (expression ?? null)
            && previous.imageUri === (imageUri ?? null)
            && previous.videoUri === (videoUri ?? null)
            && previous.thumbnailUri === (thumbnailUri ?? null);
          if (!sameRequest) return { kind: "conflict" as const };
          if (previous.hiddenForUserIds.includes(fromId)
            || (previous.deletedAt && previous.deletedFor !== "recipient")) {
            return { kind: "deleted" as const };
          }
          return { kind: "replay" as const, message: previous };
        }
      }

      // Rate limiting applies to new IDs, not idempotent retries.
      const rl = checkMsgRateLimit(fromId, toId);
      if (!rl.ok) return { kind: "rate-limited" as const, retryAfter: rl.retryAfter };
      if (imageUri || videoUri || thumbnailUri) {
        await assertOwnedMediaReferences(fromId, [imageUri, videoUri, thumbnailUri]);
      }

      const existing = await tx.select({ id: messagesTable.id })
        .from(messagesTable)
        .where(or(
          and(eq(messagesTable.fromUserId, fromId), eq(messagesTable.toUserId, toId)),
          and(eq(messagesTable.fromUserId, toId), eq(messagesTable.toUserId, fromId)),
        ))
        .limit(1);

      const [message] = await tx.insert(messagesTable)
        .values({
          ...(clientMessageId ? { id: clientMessageId } : {}),
          fromUserId: fromId,
          toUserId: toId,
          content: content ?? null,
          expression: expression ?? null,
          imageUri: imageUri ?? null,
          videoUri: videoUri ?? null,
          thumbnailUri: thumbnailUri ?? null,
        })
        .onConflictDoNothing({ target: messagesTable.id })
        .returning();

      if (!message && clientMessageId) {
        const [previous] = await tx.select()
          .from(messagesTable)
          .where(eq(messagesTable.id, clientMessageId))
          .limit(1);
        const sameRequest = previous?.fromUserId === fromId
          && previous.toUserId === toId
          && previous.content === (content ?? null)
          && previous.expression === (expression ?? null)
          && previous.imageUri === (imageUri ?? null)
          && previous.videoUri === (videoUri ?? null)
          && previous.thumbnailUri === (thumbnailUri ?? null);
        if (!sameRequest || !previous) return { kind: "conflict" as const };
        if (previous.hiddenForUserIds.includes(fromId)
          || (previous.deletedAt && previous.deletedFor !== "recipient")) {
          return { kind: "deleted" as const };
        }
        return { kind: "replay" as const, message: previous };
      }
      if (!message) throw new Error("Message insert returned no row");

      // First contact with a guide → increment their dreamersGuided counter.
      if (existing.length === 0) {
        await tx.update(characterTable)
          .set({ dreamersGuided: sql`${characterTable.dreamersGuided} + 1` })
          .where(and(eq(characterTable.userId, toId), eq(characterTable.isGuide, true)));
      }
      return { kind: "created" as const, message };
    });

    if (result.kind === "unavailable") {
      return res.status(404).json({ error: "This account is no longer available" });
    }
    if (result.kind === "conflict") {
      return res.status(409).json({ error: "Client message ID was already used" });
    }
    if (result.kind === "deleted") {
      return res.status(410).json({ error: "This message was deleted" });
    }
    if (result.kind === "rate-limited") {
      res.setHeader("Retry-After", String(result.retryAfter));
      return res.status(429).json({ error: "Sending too fast — slow down a little" });
    }
    if (result.kind === "replay") {
      const previous = result.message;
      claimUpload(previous.imageUri);
      claimUpload(previous.videoUri);
      claimUpload(previous.thumbnailUri);
      return res.status(200).json({
        id: previous.id,
        fromUserId: previous.fromUserId,
        toUserId: previous.toUserId,
        content: previous.content ?? null,
        imageUri: previous.imageUri ?? null,
        videoUri: previous.videoUri ?? null,
        thumbnailUri: previous.thumbnailUri ?? null,
        expression: previous.expression ?? null,
        isRead: previous.isRead,
        createdAt: previous.createdAt,
        isOwn: true,
      });
    }
    const msg = result.message;
    claimUpload(msg.imageUri);
    claimUpload(msg.videoUri);
    claimUpload(msg.thumbnailUri);

    // Fire-and-forget: push notification to recipient
    sendPushForMessage(fromId, toId, expression ?? null).catch(() => null);

    // Emit SSE event to the recipient's message channel so their open chat updates live
    emitSSEEvent(`messages:${toId}`, {
      type:       "new_message",
      id:         msg.id,
      fromUserId: msg.fromUserId,
      toUserId:   msg.toUserId,
      content:    msg.content    ?? null,
      imageUri:   msg.imageUri   ?? null,
      videoUri:   msg.videoUri   ?? null,
      thumbnailUri: msg.thumbnailUri ?? null,
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
      imageUri:   msg.imageUri   ?? null,
      videoUri:   msg.videoUri   ?? null,
      thumbnailUri: msg.thumbnailUri ?? null,
      expression: msg.expression ?? null,
      isRead:     msg.isRead,
      createdAt:  msg.createdAt,
      isOwn:      true,
    });
  } catch (err) {
    if (err instanceof MediaOwnershipError) return res.status(403).json({ error: err.message });
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
        deletedFor: forEveryone || msg.deletedFor === "both" ? "both" : "sender",
      })
      .where(eq(messagesTable.id, messageId));

    // A sender-only deletion must not remove the recipient's retained copy.
    const payload = { type: "message_deleted", messageId, forEveryone };
    emitSSEEvent(`messages:${msg.fromUserId}`, payload);
    if (forEveryone) emitSSEEvent(`messages:${msg.toUserId}`, payload);

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
    await db
      .update(messagesTable)
      .set({
        hiddenForUserIds: sql`
          CASE WHEN ${messagesTable.hiddenForUserIds} @> ARRAY[${userId}]::text[]
               THEN ${messagesTable.hiddenForUserIds}
               ELSE array_append(${messagesTable.hiddenForUserIds}, ${userId})
          END
        `,
      })
      .where(
        and(
          or(
            and(eq(messagesTable.fromUserId, userId), eq(messagesTable.toUserId, partnerId)),
            and(eq(messagesTable.fromUserId, partnerId), eq(messagesTable.toUserId, userId)),
          ),
          sql`NOT (${messagesTable.hiddenForUserIds} @> ARRAY[${userId}]::text[])`,
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

  if (fromId === toId) return res.status(204).end();
  if (await isBlocked(fromId, toId)) return res.status(403).json({ error: "Conversation unavailable" });
  const [recipient] = await db.select({ userId: characterTable.userId })
    .from(characterTable)
    .where(eq(characterTable.userId, toId))
    .limit(1);
  if (!recipient) return res.status(404).json({ error: "This account is unavailable" });
  emitSSEEvent(`messages:${toId}`, { type: "typing", fromUserId: fromId });
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
    : "Sent you a message";
  await sendPushNotification(toId, {
    title: senderName,
    body,
    data:  { type: "message", refId: fromId },
  });
}

export default router;
