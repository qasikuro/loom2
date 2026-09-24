import { Router } from "express";
import { and, asc, count, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  campfireRoomsTable,
  characterTable,
  db,
  guideSessionAttendeesTable,
  guideSessionsTable,
} from "@workspace/db";
import { getUserId, requireAuth } from "../middleware/auth";

const router = Router();

const CreateSessionSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(1200),
  topic: z.string().trim().max(80).optional().nullable(),
  startsAt: z.coerce.date(),
  durationMinutes: z.number().int().min(15).max(240),
  capacity: z.number().int().min(2).max(100).default(30),
});

async function serializeSessions(rows: (typeof guideSessionsTable.$inferSelect)[], viewerId: string) {
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const [counts, mine] = await Promise.all([
    db.select({ sessionId: guideSessionAttendeesTable.sessionId, attendeeCount: count() })
      .from(guideSessionAttendeesTable)
      .where(inArray(guideSessionAttendeesTable.sessionId, ids))
      .groupBy(guideSessionAttendeesTable.sessionId),
    db.select({ sessionId: guideSessionAttendeesTable.sessionId })
      .from(guideSessionAttendeesTable)
      .where(and(
        inArray(guideSessionAttendeesTable.sessionId, ids),
        eq(guideSessionAttendeesTable.userId, viewerId),
      )),
  ]);
  const countById = new Map(counts.map(row => [row.sessionId, Number(row.attendeeCount)]));
  const joined = new Set(mine.map(row => row.sessionId));
  return rows.map(row => ({
    ...row,
    attendeeCount: countById.get(row.id) ?? 0,
    isJoined: joined.has(row.id) || row.guideId === viewerId,
  }));
}

router.get("/guide-sessions", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const guideId = typeof req.query.guideId === "string" ? req.query.guideId : null;
  const now = new Date();
  const rows = await db.select().from(guideSessionsTable)
    .where(and(
      eq(guideSessionsTable.status, "scheduled"),
      gt(guideSessionsTable.endsAt, now),
      ...(guideId ? [eq(guideSessionsTable.guideId, guideId)] : []),
    ))
    .orderBy(asc(guideSessionsTable.startsAt))
    .limit(100);
  return res.json(await serializeSessions(rows, viewerId));
});

router.get("/guide-sessions/:sessionId", requireAuth, async (req, res) => {
  const viewerId = getUserId(req);
  const [row] = await db.select().from(guideSessionsTable)
    .where(eq(guideSessionsTable.id, req.params.sessionId as string)).limit(1);
  if (!row) return res.status(404).json({ error: "Session not found" });
  const [session] = await serializeSessions([row], viewerId);
  return res.json(session);
});

router.post("/guide-sessions", requireAuth, async (req, res) => {
  const guideId = getUserId(req);
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid session" });
  const [guide] = await db.select({ isGuide: characterTable.isGuide }).from(characterTable)
    .where(eq(characterTable.userId, guideId)).limit(1);
  if (!guide?.isGuide) return res.status(403).json({ error: "Only guides can create sessions" });
  const { title, description, topic, startsAt, durationMinutes, capacity } = parsed.data;
  if (startsAt.getTime() < Date.now() + 5 * 60_000) {
    return res.status(400).json({ error: "Session must start at least 5 minutes from now" });
  }
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const result = await db.transaction(async tx => {
    const [room] = await tx.insert(campfireRoomsTable)
      .values({ name: title, mood: "Peaceful", createdBy: guideId, isPreset: false }).returning();
    const [session] = await tx.insert(guideSessionsTable).values({
      guideId, roomId: room.id, title, description, topic: topic || null, startsAt, endsAt, capacity,
    }).returning();
    await tx.insert(guideSessionAttendeesTable).values({ sessionId: session.id, userId: guideId });
    return session;
  });
  return res.status(201).json({ ...(await serializeSessions([result], guideId))[0] });
});

router.post("/guide-sessions/:sessionId/join", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const sessionId = req.params.sessionId as string;
  const [session] = await db.select().from(guideSessionsTable)
    .where(eq(guideSessionsTable.id, sessionId)).limit(1);
  if (!session || session.status !== "scheduled" || session.endsAt <= new Date()) {
    return res.status(404).json({ error: "Session is no longer available" });
  }
  const [existing] = await db.select({ userId: guideSessionAttendeesTable.userId })
    .from(guideSessionAttendeesTable)
    .where(and(
      eq(guideSessionAttendeesTable.sessionId, sessionId),
      eq(guideSessionAttendeesTable.userId, userId),
    ))
    .limit(1);
  if (existing) return res.json({ ...(await serializeSessions([session], userId))[0] });
  const [capacity] = await db.select({ value: count() }).from(guideSessionAttendeesTable)
    .where(eq(guideSessionAttendeesTable.sessionId, sessionId));
  if (Number(capacity?.value ?? 0) >= session.capacity) return res.status(409).json({ error: "Session is full" });
  await db.insert(guideSessionAttendeesTable).values({ sessionId, userId }).onConflictDoNothing();
  return res.json({ ...(await serializeSessions([session], userId))[0] });
});

router.delete("/guide-sessions/:sessionId", requireAuth, async (req, res) => {
  const guideId = getUserId(req);
  const [session] = await db.update(guideSessionsTable).set({ status: "cancelled" })
    .where(and(eq(guideSessionsTable.id, req.params.sessionId as string), eq(guideSessionsTable.guideId, guideId)))
    .returning();
  if (!session) return res.status(404).json({ error: "Session not found" });
  return res.json({ ok: true });
});

export default router;