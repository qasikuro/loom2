import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  characterTable,
  db,
  followsTable,
  guideTutorialsTable,
  type GuideTutorialStep,
} from "@workspace/db";
import { getUserId, requireAuth } from "../middleware/auth";
import {
  assertOwnedMediaReferences,
  hasGuideTutorialSchema,
  MediaOwnershipError,
  normalizeManagedMediaPath,
} from "../lib/mediaAccess";
import { claimUpload } from "../lib/uploadTracking";
import { friendsSql, readableProfileSql } from "../lib/contentVisibility";
import { withOwnerMediaUrls } from "../lib/mediaAccess";

const router = Router();
router.use(requireAuth, async (_req, res, next) => {
  try {
    if (!(await hasGuideTutorialSchema())) {
      return res.status(503).json({ error: "Guide tutorials require the database migration before they can be used." });
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

const TutorialStepSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(["text", "image", "video", "tip", "question"]),
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().max(1200).default(""),
  mediaUri: z.string().trim().max(2048).nullish().refine(value =>
    value == null || normalizeManagedMediaPath(value) !== null,
  ),
});

const TutorialInputSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(1200),
  topic: z.string().trim().max(80).nullish(),
  visibility: z.enum(["public", "followers", "friends", "private", "unlisted"]).default("public"),
  status: z.enum(["draft", "published"]).default("draft"),
  steps: z.array(TutorialStepSchema).min(1).max(24),
});

async function serializeTutorials(
  rows: (typeof guideTutorialsTable.$inferSelect)[],
  viewerId: string,
  allowUnlisted = false,
) {
  if (!rows.length) return [];
  const guideIds = [...new Set(rows.map(row => row.guideId))];
  const profiles = await db.select({
    userId: characterTable.userId,
    isHidden: characterTable.isHidden,
    isBanned: characterTable.isBanned,
    name: characterTable.name,
    username: characterTable.username,
    avatarUri: characterTable.avatarUri,
  }).from(characterTable).where(and(inArray(characterTable.userId, guideIds), readableProfileSql(characterTable.userId, viewerId)));
  const profilesById = new Map(profiles.map(profile => [profile.userId, profile]));
  const followerVisibleIds = new Set(
    rows.filter(row => row.guideId === viewerId).map(row => row.guideId),
  );
  const followerAuthors = [...new Set(rows
    .filter(row => row.visibility === "followers" && row.guideId !== viewerId)
    .map(row => row.guideId))];
  if (followerAuthors.length) {
    const follows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(and(
        eq(followsTable.followerId, viewerId),
        inArray(followsTable.followingId, followerAuthors),
      ));
    for (const follow of follows) followerVisibleIds.add(follow.followingId);
  }
  const friends = await db.select({ followingId: followsTable.followingId }).from(followsTable)
    .where(and(eq(followsTable.followerId, viewerId), inArray(followsTable.followingId, guideIds),
      friendsSql(followsTable.followingId, viewerId)));
  const friendIds = new Set(friends.map(row => row.followingId));

  return rows.filter(row => {
    if (row.guideId === viewerId) return true;
    const profile = profilesById.get(row.guideId);
    if (!profile || profile.isHidden || profile.isBanned || row.status !== "published") return false;
    if (row.visibility === "public") return true;
    if (row.visibility === "followers") return followerVisibleIds.has(row.guideId);
    if (row.visibility === "friends") return friendIds.has(row.guideId);
    return row.visibility === "unlisted" && allowUnlisted;
  }).map(row => {
    const profile = profilesById.get(row.guideId);
    return withOwnerMediaUrls({
      ...row,
      guideName: profile?.name ?? "Guide",
      guideUsername: profile?.username ?? null,
      guideAvatarUri: profile?.avatarUri ?? null,
    }, viewerId);
  });
}

function getTutorialMedia(steps: GuideTutorialStep[]) {
  return steps.flatMap(step => step.mediaUri ? [step.mediaUri] : []);
}

router.get("/guide-tutorials", async (req, res) => {
  const viewerId = getUserId(req);
  const mineOnly = req.query.mine === "true";
  const rows = await db.select().from(guideTutorialsTable)
    .where(mineOnly
      ? eq(guideTutorialsTable.guideId, viewerId)
      : eq(guideTutorialsTable.status, "published"))
    .orderBy(desc(guideTutorialsTable.updatedAt))
    .limit(100);
  return res.json(await serializeTutorials(rows, viewerId));
});

router.get("/guide-tutorials/:tutorialId", async (req, res) => {
  const [row] = await db.select().from(guideTutorialsTable)
    .where(eq(guideTutorialsTable.id, req.params.tutorialId as string)).limit(1);
  if (!row) return res.status(404).json({ error: "Tutorial not found" });
  const [tutorial] = await serializeTutorials([row], getUserId(req), true);
  if (!tutorial) return res.status(404).json({ error: "Tutorial not found" });
  return res.json(tutorial);
});

router.post("/guide-tutorials", async (req, res) => {
  const guideId = getUserId(req);
  const parsed = TutorialInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid tutorial" });
  const [profile] = await db.select({ isGuide: characterTable.isGuide }).from(characterTable)
    .where(eq(characterTable.userId, guideId)).limit(1);
  if (!profile?.isGuide) return res.status(403).json({ error: "Only guides can create tutorials" });
  const steps = parsed.data.steps.map(step => ({
    ...step,
    mediaUri: step.mediaUri ? normalizeManagedMediaPath(step.mediaUri) : null,
  }));
  try {
    await assertOwnedMediaReferences(guideId, getTutorialMedia(steps as GuideTutorialStep[]));
  } catch (error) {
    if (error instanceof MediaOwnershipError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
  const [tutorial] = await db.insert(guideTutorialsTable).values({
    guideId,
    title: parsed.data.title,
    description: parsed.data.description,
    topic: parsed.data.topic || null,
    visibility: parsed.data.visibility,
    status: parsed.data.status,
    steps: steps as GuideTutorialStep[],
  }).returning();
  for (const uri of getTutorialMedia(steps as GuideTutorialStep[])) claimUpload(uri);
  const [serialized] = await serializeTutorials([tutorial], guideId);
  return res.status(201).json(serialized);
});

router.patch("/guide-tutorials/:tutorialId", async (req, res) => {
  const guideId = getUserId(req);
  const parsed = TutorialInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid tutorial" });
  const [existing] = await db.select().from(guideTutorialsTable)
    .where(and(
      eq(guideTutorialsTable.id, req.params.tutorialId as string),
      eq(guideTutorialsTable.guideId, guideId),
    )).limit(1);
  if (!existing) return res.status(404).json({ error: "Tutorial not found" });
  const steps = parsed.data.steps.map(step => ({
    ...step,
    mediaUri: step.mediaUri ? normalizeManagedMediaPath(step.mediaUri) : null,
  }));
  try {
    await assertOwnedMediaReferences(guideId, getTutorialMedia(steps as GuideTutorialStep[]));
  } catch (error) {
    if (error instanceof MediaOwnershipError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
  const [updated] = await db.update(guideTutorialsTable).set({
    title: parsed.data.title,
    description: parsed.data.description,
    topic: parsed.data.topic || null,
    visibility: parsed.data.visibility,
    status: parsed.data.status,
    steps: steps as GuideTutorialStep[],
    updatedAt: new Date(),
  }).where(eq(guideTutorialsTable.id, existing.id)).returning();
  for (const uri of getTutorialMedia(steps as GuideTutorialStep[])) claimUpload(uri);
  const [serialized] = await serializeTutorials([updated], guideId);
  return res.json(serialized);
});

export default router;
