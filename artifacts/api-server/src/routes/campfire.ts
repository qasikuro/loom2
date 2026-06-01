import { Router } from "express";
import { and, desc, eq, gt, sql } from "drizzle-orm";

import {
  db,
  campfireRoomsTable,
  campfireMessagesTable,
  characterTable,
} from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";

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

router.get("/campfire", requireAuth, async (req, res) => {
  await ensurePresets();

  const now          = new Date();
  const presenceCutoff = new Date(now.getTime() - PRESENCE_MS);

  const rooms = await db
    .select()
    .from(campfireRoomsTable)
    .orderBy(desc(campfireRoomsTable.createdAt));

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
    .select()
    .from(campfireMessagesTable)
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
      id:         m.id,
      userId:     m.userId,
      authorName: m.authorName,
      content:    m.content,
      expression: m.expression,
      createdAt:  m.createdAt,
      isMine:     m.userId === userId,
    })),
    soulCount: Number(presenceRow?.souls ?? 0),
  });
});

// ── POST /api/campfire/:roomId/messages — send message or expression ──────────

const VALID_EXPRESSIONS = ["candle", "spark", "lantern", "hush"] as const;

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
  if (expression && !VALID_EXPRESSIONS.includes(expression as any))
    return res.status(400).json({ error: "Invalid expression" });

  const [room] = await db
    .select({ id: campfireRoomsTable.id })
    .from(campfireRoomsTable)
    .where(eq(campfireRoomsTable.id, roomId));

  if (!room) return res.status(404).json({ error: "Campfire not found" });

  // Resolve author name from character table if not provided
  let resolvedName = authorName?.trim() || "Wanderer";
  if (!authorName) {
    const [char] = await db
      .select({ name: characterTable.name, username: characterTable.username })
      .from(characterTable)
      .where(eq(characterTable.userId, userId));
    if (char?.name) resolvedName = char.name;
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

  return res.status(201).json({
    id:         msg.id,
    userId:     msg.userId,
    authorName: msg.authorName,
    content:    msg.content,
    expression: msg.expression,
    createdAt:  msg.createdAt,
    isMine:     true,
  });
});

export default router;
