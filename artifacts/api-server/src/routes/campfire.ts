import { Router } from "express";
import { and, asc, desc, eq, gt, ilike, isNull, sql } from "drizzle-orm";

import {
  db,
  campfireRoomsTable,
  campfireMessagesTable,
  characterTable,
  reportsTable,
} from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";
import { emitSSEEvent } from "../lib/sseEmitter";
import { checkMsgRateLimit } from "../middleware/messageLimiter";
import { sendPushNotification } from "../services/pushService";

const router = Router();

// ── Preset campfire rooms (seeded once) ──────────────────────────────────────

const PRESET_ROOMS = [
  { name: "The Dreaming Shore",   mood: "Dreamy"      },
  { name: "Peaceful Meadow",      mood: "Peaceful"    },
  { name: "Midnight Hollow",      mood: "Lonely"      },
  { name: "Soft Ember",           mood: "Soft"        },
  { name: "Starfall Point",       mood: "Romantic"    },
  { name: "Wanderer's Camp",      mood: "Adventurous" },
] as const;

const SYSTEM_USER    = "system";
const MSG_TTL_MS     = 6  * 60 * 60 * 1000; // messages expire after 6 h
const PRESENCE_MS    = 5  * 60 * 1000;       // presence window: 5 min
const MAX_MESSAGES   = 60;

let presetsSeeded = false;

async function ensurePresets() {
  if (presetsSeeded) return;
  const existing = await db
    .select({ id: campfireRoomsTable.id })
    .from(campfireRoomsTable)
    .where(eq(campfireRoomsTable.isPreset, true))
    .limit(1);

  if (existing.length === 0) {
    for (const room of PRESET_ROOMS) {
      await db
        .insert(campfireRoomsTable)
        .values({ name: room.name, mood: room.mood, createdBy: SYSTEM_USER, isPreset: true })
        .onConflictDoNothing();
    }
  }
  presetsSeeded = true;
}

// ── GET /api/campfire — list rooms with presence + last message ───────────────
// Supports optional ?q=<search> and ?mood=<mood> filters

router.get("/campfire", requireAuth, async (req, res) => {
  await ensurePresets();

  const now            = new Date();
  const presenceCutoff = new Date(now.getTime() - PRESENCE_MS);
  const q              = typeof req.query.q    === "string" ? req.query.q.trim()    : "";
  const moodFilter     = typeof req.query.mood === "string" ? req.query.mood.trim() : "";

  let roomQuery = db.select().from(campfireRoomsTable).$dynamic();
  if (q)          roomQuery = roomQuery.where(ilike(campfireRoomsTable.name, `%${q}%`));
  if (moodFilter) roomQuery = roomQuery.where(eq(campfireRoomsTable.mood, moodFilter));

  const rooms = await roomQuery.orderBy(desc(campfireRoomsTable.createdAt));

  const roomsWithMeta = await Promise.all(
    rooms.map(async (room) => {
      const [presenceRow] = await db
        .select({ souls: sql<number>`count(distinct ${campfireMessagesTable.userId})` })
        .from(campfireMessagesTable)
        .where(and(
          eq(campfireMessagesTable.roomId, room.id),
          gt(campfireMessagesTable.createdAt, presenceCutoff),
          gt(campfireMessagesTable.expiresAt, now),
        ));

      const [lastMsg] = await db
        .select()
        .from(campfireMessagesTable)
        .where(and(
          eq(campfireMessagesTable.roomId, room.id),
          gt(campfireMessagesTable.expiresAt, now),
        ))
        .orderBy(desc(campfireMessagesTable.createdAt))
        .limit(1);

      return {
        id:        room.id,
        name:      room.name,
        mood:      room.mood,
        isPreset:  room.isPreset,
        soulCount: Number(presenceRow?.souls ?? 0),
        lastMessage: lastMsg ? {
          authorName: lastMsg.authorName,
          content:    lastMsg.content,
          expression: lastMsg.expression,
          createdAt:  lastMsg.createdAt,
        } : null,
      };
    }),
  );

  // Presets first, then sorted by soul count
  roomsWithMeta.sort((a, b) => {
    if (a.isPreset && !b.isPreset) return -1;
    if (!a.isPreset && b.isPreset) return 1;
    return b.soulCount - a.soulCount;
  });

  return res.json(roomsWithMeta);
});

// ── POST /api/campfire — create a room ────────────────────────────────────────

router.post("/campfire", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { name, mood } = req.body as { name?: string; mood?: string };

  if (!name?.trim())             return res.status(400).json({ error: "name is required" });
  if (name.trim().length > 50)   return res.status(400).json({ error: "name too long" });

  const [room] = await db
    .insert(campfireRoomsTable)
    .values({ name: name.trim(), mood: mood ?? "Dreamy", createdBy: userId, isPreset: false })
    .returning();

  return res.status(201).json(room);
});

// ── GET /api/campfire/:roomId — room + recent messages ────────────────────────

router.get("/campfire/:roomId", requireAuth, async (req, res) => {
  const roomId = req.params.roomId as string;
  const userId = getUserId(req);
  const now        = new Date();

  const [room] = await db
    .select()
    .from(campfireRoomsTable)
    .where(eq(campfireRoomsTable.id, roomId));

  if (!room) return res.status(404).json({ error: "Campfire not found" });

  const messages = await db
    .select({
      id:           campfireMessagesTable.id,
      userId:       campfireMessagesTable.userId,
      authorName:   campfireMessagesTable.authorName,
      content:      campfireMessagesTable.content,
      expression:   campfireMessagesTable.expression,
      createdAt:    campfireMessagesTable.createdAt,
      isFounder:    characterTable.isFounder,
      isBetaTester: characterTable.isBetaTester,
    })
    .from(campfireMessagesTable)
    .leftJoin(characterTable, eq(campfireMessagesTable.userId, characterTable.userId))
    .where(and(
      eq(campfireMessagesTable.roomId, roomId),
      gt(campfireMessagesTable.expiresAt, now),
    ))
    .orderBy(desc(campfireMessagesTable.createdAt))
    .limit(MAX_MESSAGES);

  const presenceCutoff = new Date(now.getTime() - PRESENCE_MS);
  const [presenceRow]  = await db
    .select({ souls: sql<number>`count(distinct ${campfireMessagesTable.userId})` })
    .from(campfireMessagesTable)
    .where(and(
      eq(campfireMessagesTable.roomId, roomId),
      gt(campfireMessagesTable.createdAt, presenceCutoff),
      gt(campfireMessagesTable.expiresAt, now),
    ));

  return res.json({
    room: { id: room.id, name: room.name, mood: room.mood, isPreset: room.isPreset },
    messages: messages.reverse().map(m => ({
      id:           m.id,
      userId:       m.userId,
      authorName:   m.authorName,
      content:      m.content,
      expression:   m.expression,
      createdAt:    m.createdAt,
      isMine:       m.userId === userId,
      isFounder:    m.isFounder ?? false,
      isBetaTester: m.isBetaTester ?? false,
    })),
    soulCount: Number(presenceRow?.souls ?? 0),
  });
});

// ── GET /api/campfire/:roomId/presence — who's here (active ≤ 5 min) ─────────

router.get("/campfire/:roomId/presence", requireAuth, async (req, res) => {
  const roomId = req.params.roomId as string;
  const now    = new Date();
  const cutoff = new Date(now.getTime() - PRESENCE_MS);

  try {
    // Get distinct users who sent a message in the last 5 minutes
    const recentRows = await db
      .select({ userId: campfireMessagesTable.userId })
      .from(campfireMessagesTable)
      .where(and(
        eq(campfireMessagesTable.roomId, roomId),
        gt(campfireMessagesTable.createdAt, cutoff),
        gt(campfireMessagesTable.expiresAt, now),
      ))
      .orderBy(asc(campfireMessagesTable.createdAt));

    // De-duplicate (Drizzle doesn't have DISTINCT SELECT shorthand easily across all adapters)
    const seenIds   = new Set<string>();
    const userIds: string[] = [];
    for (const r of recentRows) {
      if (!seenIds.has(r.userId)) { seenIds.add(r.userId); userIds.push(r.userId); }
    }

    if (userIds.length === 0) return res.json([]);

    const chars = await db
      .select({
        userId:    characterTable.userId,
        name:      characterTable.name,
        username:  characterTable.username,
        avatarUri: characterTable.avatarUri,
        mood:      characterTable.mood,
      })
      .from(characterTable)
      .where(sql`${characterTable.userId} = ANY(${userIds})`);

    const charMap = new Map(chars.map(c => [c.userId, c]));

    const participants = userIds.map(uid => {
      const c = charMap.get(uid);
      return {
        userId:    uid,
        name:      c?.name      ?? "Wanderer",
        username:  c?.username  ?? null,
        avatarUri: c?.avatarUri ?? null,
        mood:      c?.mood      ?? null,
      };
    });

    return res.json(participants);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch campfire presence");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/campfire/:roomId/messages — send message or expression ──────────

const VALID_EXPRESSIONS = ["candle", "spark", "lantern", "hush"] as const;

// Parse @username mentions from text content, return array of mentions
function parseMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

router.post("/campfire/:roomId/messages", requireAuth, async (req, res) => {
  const roomId = req.params.roomId as string;
  const userId = getUserId(req);
  const { content, expression, authorName } = req.body as {
    content?:    string;
    expression?: string;
    authorName?: string;
  };

  if (!content?.trim() && !expression)
    return res.status(400).json({ error: "content or expression required" });
  if (content && content.trim().length > 500)
    return res.status(400).json({ error: "Message too long (max 500 chars)" });
  if (expression && !(VALID_EXPRESSIONS as readonly string[]).includes(expression))
    return res.status(400).json({ error: "Invalid expression" });

  // Rate limiting: 20 campfire messages per minute per room
  const rl = checkMsgRateLimit(userId, roomId);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    return res.status(429).json({ error: "Sending too fast — slow down a little" });
  }

  const [room] = await db
    .select({ id: campfireRoomsTable.id })
    .from(campfireRoomsTable)
    .where(eq(campfireRoomsTable.id, roomId));

  if (!room) return res.status(404).json({ error: "Campfire not found" });

  // Resolve author name + badge flags from character table
  let resolvedName  = authorName?.trim() || "Wanderer";
  let isFounder     = false;
  let isBetaTester  = false;
  {
    const [char] = await db
      .select({
        name:         characterTable.name,
        username:     characterTable.username,
        isFounder:    characterTable.isFounder,
        isBetaTester: characterTable.isBetaTester,
      })
      .from(characterTable)
      .where(eq(characterTable.userId, userId));
    if (char) {
      if (!authorName && char.name) resolvedName = char.name;
      isFounder    = char.isFounder    ?? false;
      isBetaTester = char.isBetaTester ?? false;
    }
  }

  const now       = new Date();
  const expiresAt = new Date(now.getTime() + MSG_TTL_MS);

  const [msg] = await db
    .insert(campfireMessagesTable)
    .values({
      roomId,
      userId,
      authorName: resolvedName,
      content:    content?.trim() ?? null,
      expression: expression ?? null,
      expiresAt,
    })
    .returning();

  const payload = {
    id:           msg.id,
    userId:       msg.userId,
    authorName:   msg.authorName,
    content:      msg.content,
    expression:   msg.expression,
    createdAt:    msg.createdAt,
    isFounder,
    isBetaTester,
  };

  // Notify all SSE clients watching this campfire room
  emitSSEEvent(`campfire:${roomId}`, { type: "new_message", message: payload });

  // ── @mention push notifications (fire-and-forget) ──────────────────────────
  if (content?.trim()) {
    const handles = parseMentions(content);
    if (handles.length > 0) {
      sendMentionNotifications(handles, userId, resolvedName, content, roomId).catch(() => null);
    }
  }

  return res.status(201).json({ ...payload, isMine: true });
});

// ── POST /api/campfire/:roomId/messages/:messageId/report ─────────────────────

router.post("/campfire/:roomId/messages/:messageId/report", requireAuth, async (req, res) => {
  const reporterId = getUserId(req);
  const messageId  = String(req.params.messageId);
  const reason     = String(req.body?.reason ?? "").slice(0, 500);

  if (!reason) return res.status(400).json({ error: "reason is required" });

  try {
    await db.insert(reportsTable).values({
      reporterId,
      targetType: "campfire_message",
      targetId:   messageId,
      reason,
      details:    "",
      status:     "pending",
    });
    return res.json({ reported: true });
  } catch (err) {
    req.log.error({ err }, "Failed to submit campfire report");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function sendMentionNotifications(
  handles:      string[],
  fromUserId:   string,
  fromName:     string,
  content:      string,
  roomId:       string,
): Promise<void> {
  for (const handle of handles.slice(0, 5)) { // cap at 5 mentions per message
    const [user] = await db
      .select({ userId: characterTable.userId })
      .from(characterTable)
      .where(sql`LOWER(${characterTable.username}) = ${handle}`)
      .limit(1);

    if (!user || user.userId === fromUserId) continue;

    const body = content.length > 80 ? content.slice(0, 77) + "…" : content;
    await sendPushNotification(user.userId, {
      title: `${fromName} mentioned you 🔥`,
      body,
      data: { type: "campfire_mention", refId: roomId },
    }).catch(() => null);
  }
}

export default router;
