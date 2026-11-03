import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { db, characterTable, messages as messagesTable } from "@workspace/db";
import { and, count, eq, max, or, sql } from "drizzle-orm";
import sharp from "sharp";
import { Router, type IRouter } from "express";
import { getUserId, requireAuth } from "../middleware/auth";
import { mediaToolPath } from "../lib/mediaTools";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const execFileAsync = promisify(execFile);
const MESSAGE_COUNT = 440;
const MEDIA_COUNT = 20;
export const CHAT_FIXTURE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60_000;
const CLEANUP_INTERVAL_MS = 60 * 60_000;
const MEDIA_BUCKET = () => process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let cleanupRunning = false;
const COLOR_PALETTE = ["#5967a8", "#347b83", "#a55c72", "#bb8050", "#536f4d", "#745d9f"];

type FixtureUpload = {
  objectPath: string;
  contentType: string;
  bytes: Buffer;
};

function fixtureOwnerHash(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 16);
}

function parseOwnedFixturePartnerId(partnerId: string, userId: string): string | null {
  const match = partnerId.match(/^storigam-chat-perf-([a-f0-9]{16})-([a-f0-9-]{36})$/);
  if (!match || match[1] !== fixtureOwnerHash(userId)) return null;
  return match[2];
}

function parseFixtureUuid(partnerId: string): string | null {
  const match = partnerId.match(/^storigam-chat-perf-[a-f0-9]{16}-([a-f0-9-]{36})$/);
  return match?.[1] ?? null;
}

function fixtureImage(label: string, index: number): Promise<Buffer> {
  const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="405">
    <rect width="720" height="405" fill="${color}"/>
    <circle cx="575" cy="100" r="150" fill="#ffffff" fill-opacity=".11"/>
    <circle cx="145" cy="350" r="180" fill="#ffffff" fill-opacity=".08"/>
    <text x="42" y="205" fill="#ffffff" font-family="sans-serif" font-size="42" font-weight="600">${label}</text>
    <text x="44" y="250" fill="#ffffff" fill-opacity=".8" font-family="sans-serif" font-size="22">Storigam chat performance fixture</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 78 }).toBuffer();
}

async function fixtureVideo(): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), "storigam-chat-fixture-"));
  const path = join(tempDir, "performance-fixture.mp4");
  try {
    await execFileAsync(mediaToolPath("ffmpeg"), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=0x28334a:s=640x360:r=24:d=2",
      "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart", path,
    ], { timeout: 20_000, maxBuffer: 1024 * 1024 });
    return await readFile(path);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function uploadFixtureObjects(
  bucketId: string,
  ownerUserId: string,
  files: FixtureUpload[],
): Promise<void> {
  const bucket = objectStorageClient.bucket(bucketId);
  for (let offset = 0; offset < files.length; offset += 8) {
    const results = await Promise.allSettled(files.slice(offset, offset + 8).map(file =>
      bucket.file(file.objectPath).save(file.bytes, {
        metadata: {
          contentType: file.contentType,
          metadata: { ownerUserId },
        },
        resumable: false,
      }),
    ));
    const failedUpload = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failedUpload) throw failedUpload.reason;
  }
}

async function deleteFixtureObjects(bucketId: string, files: FixtureUpload[]): Promise<void> {
  const bucket = objectStorageClient.bucket(bucketId);
  for (let offset = 0; offset < files.length; offset += 8) {
    await Promise.all(files.slice(offset, offset + 8).map(async file => {
      try {
        await bucket.file(file.objectPath).delete();
      } catch (error) {
        const code = (error as { code?: number | string }).code;
        if (code !== 404 && code !== "404") throw error;
      }
    }));
  }
}

function getFixtureFiles(
  fixtureUuid: string,
  photoBuffers: Buffer[],
  posterBuffers: Buffer[],
  videoBuffer: Buffer,
): FixtureUpload[] {
  const prefix = `chat-perf-${fixtureUuid}`;
  return [
    ...photoBuffers.map((bytes, index) => ({
      objectPath: `images/${prefix}-photo-${index + 1}.jpg`,
      contentType: "image/jpeg",
      bytes,
    })),
    ...posterBuffers.map((bytes, index) => ({
      objectPath: `images/${prefix}-video-${index + 1}-poster.jpg`,
      contentType: "image/jpeg",
      bytes,
    })),
    ...Array.from({ length: MEDIA_COUNT }, (_, index) => ({
      objectPath: `videos/${prefix}-video-${index + 1}.mp4`,
      contentType: "video/mp4",
      bytes: videoBuffer,
    })),
  ];
}

function getFixtureDeletionFiles(fixtureUuid: string): FixtureUpload[] {
  const prefix = `chat-perf-${fixtureUuid}`;
  return [
    ...Array.from({ length: MEDIA_COUNT }, (_, index) => ({
      objectPath: `images/${prefix}-photo-${index + 1}.jpg`,
      contentType: "image/jpeg",
      bytes: Buffer.alloc(0),
    })),
    ...Array.from({ length: MEDIA_COUNT }, (_, index) => ({
      objectPath: `images/${prefix}-video-${index + 1}-poster.jpg`,
      contentType: "image/jpeg",
      bytes: Buffer.alloc(0),
    })),
    ...Array.from({ length: MEDIA_COUNT }, (_, index) => ({
      objectPath: `videos/${prefix}-video-${index + 1}.mp4`,
      contentType: "video/mp4",
      bytes: Buffer.alloc(0),
    })),
  ];
}

async function removeFixtureData(
  partnerId: string,
  ownerUserId: string,
  fixtureUuid: string,
): Promise<void> {
  const bucketId = MEDIA_BUCKET();
  if (!bucketId) throw new Error("Object storage is not configured for chat fixtures.");
  await deleteFixtureObjects(bucketId, getFixtureDeletionFiles(fixtureUuid));
  await db.transaction(async tx => {
    await tx.delete(messagesTable).where(or(
      and(eq(messagesTable.fromUserId, ownerUserId), eq(messagesTable.toUserId, partnerId)),
      and(eq(messagesTable.fromUserId, partnerId), eq(messagesTable.toUserId, ownerUserId)),
    ));
    await tx.delete(characterTable).where(eq(characterTable.userId, partnerId));
  });
}

function fixtureMediaUri(fixtureUuid: string, kind: "photo" | "video" | "poster", index: number): string {
  const prefix = `chat-perf-${fixtureUuid}`;
  if (kind === "photo") return `/api/images/${prefix}-photo-${index + 1}.jpg`;
  if (kind === "poster") return `/api/images/${prefix}-video-${index + 1}-poster.jpg`;
  return `/api/videos/${prefix}-video-${index + 1}.mp4`;
}

router.post("/test-fixtures/chat-long-media", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "Not found" });
  const bucketId = MEDIA_BUCKET();
  if (!bucketId) {
    return res.status(503).json({ error: "Object storage is not configured for chat fixtures." });
  }

  const ownerUserId = getUserId(req);
  const fixtureUuid = randomUUID();
  const partnerId = `storigam-chat-perf-${fixtureOwnerHash(ownerUserId)}-${fixtureUuid}`;
  let files: FixtureUpload[] = [];

  try {
    const photoBuffers = await Promise.all(Array.from({ length: MEDIA_COUNT }, (_, index) =>
      fixtureImage(`PHOTO ${String(index + 1).padStart(2, "0")}`, index),
    ));
    const posterBuffers = await Promise.all(Array.from({ length: MEDIA_COUNT }, (_, index) =>
      fixtureImage(`VIDEO ${String(index + 1).padStart(2, "0")}`, index + MEDIA_COUNT),
    ));
    files = getFixtureFiles(fixtureUuid, photoBuffers, posterBuffers, await fixtureVideo());
    await uploadFixtureObjects(bucketId, ownerUserId, files);

    const createdAt = Date.now();
    const anchorIndex = 180;
    let olderMessageId = "";
    const seededMessages = Array.from({ length: MESSAGE_COUNT }, (_, index) => {
      const id = randomUUID();
      const mediaIndex = index % MEDIA_COUNT;
      const isPhoto = index % 11 === 0;
      const isVideo = index % 11 === 1;
      const isAnchor = index === anchorIndex;
      if (isAnchor) olderMessageId = id;

      return {
        id,
        fromUserId: isPhoto || isVideo || index % 2 === 0 ? ownerUserId : partnerId,
        toUserId: isPhoto || isVideo || index % 2 === 0 ? partnerId : ownerUserId,
        content: isAnchor
          ? "CHAT_PERFORMANCE_OLDER_ANCHOR"
          : isPhoto
            ? `A test photo from the trail, set ${mediaIndex + 1}.`
            : isVideo
              ? `A two-second fixture video, set ${mediaIndex + 1}.`
              : `Fixture message ${String(index + 1).padStart(3, "0")}: a safe repeatable chat-history sample.`,
        imageUri: isPhoto ? fixtureMediaUri(fixtureUuid, "photo", mediaIndex) : null,
        videoUri: isVideo ? fixtureMediaUri(fixtureUuid, "video", mediaIndex) : null,
        thumbnailUri: isVideo ? fixtureMediaUri(fixtureUuid, "poster", mediaIndex) : null,
        createdAt: new Date(createdAt - (MESSAGE_COUNT - index - 1) * 1_000),
      };
    });

    await db.transaction(async tx => {
      await tx.insert(characterTable).values({
        userId: partnerId,
        name: "Chat performance fixture",
        bio: "Disposable Android chat performance fixture.",
        isPublic: false,
        isHidden: true,
      });
      await tx.insert(messagesTable).values(seededMessages);
    });

    return res.status(201).json({
      partnerId,
      olderMessageId,
      messageCount: MESSAGE_COUNT,
      photoMessageCount: seededMessages.filter(message => message.imageUri).length,
      videoMessageCount: seededMessages.filter(message => message.videoUri).length,
    });
  } catch (error) {
    if (files.length > 0) {
      try {
        await deleteFixtureObjects(bucketId, files);
      } catch {
        req.log.error({ fixtureId: fixtureUuid }, "Failed to remove partially created chat fixture media");
      }
    }
    req.log.error({ err: error }, "Failed to create chat performance fixture");
    return res.status(500).json({ error: "Could not create the chat performance fixture." });
  }
});

router.delete("/test-fixtures/chat-long-media/:partnerId", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "Not found" });
  const ownerUserId = getUserId(req);
  const partnerId = String(req.params.partnerId);
  const fixtureUuid = parseOwnedFixturePartnerId(partnerId, ownerUserId);
  if (!fixtureUuid) return res.status(404).json({ error: "Fixture not found." });

  const [fixtureProfile] = await db.select({ userId: characterTable.userId })
    .from(characterTable)
    .where(and(
      eq(characterTable.userId, partnerId),
      eq(characterTable.name, "Chat performance fixture"),
      eq(characterTable.isHidden, true),
      eq(characterTable.isPublic, false),
    ))
    .limit(1);
  if (!fixtureProfile) return res.status(404).json({ error: "Fixture not found." });

  try {
    await removeFixtureData(partnerId, ownerUserId, fixtureUuid);
    return res.json({ removed: true });
  } catch (error) {
    req.log.error({ err: error, fixtureId: fixtureUuid }, "Failed to remove chat performance fixture");
    return res.status(503).json({ error: "Could not completely remove the chat performance fixture. Retry cleanup." });
  }
});

export default router;

/**
 * Removes only expired, generated chat-performance fixtures. Age is measured
 * from the newest message so activity during the seven-day grace period keeps
 * the fixture available for testing.
 */
export async function cleanupExpiredChatPerformanceFixtures(now = new Date()): Promise<void> {
  if (process.env.NODE_ENV === "production" || !MEDIA_BUCKET() || cleanupRunning) return;
  cleanupRunning = true;
  try {
    const candidates = await db.select({ userId: characterTable.userId })
      .from(characterTable)
      .where(and(
        eq(characterTable.name, "Chat performance fixture"),
        eq(characterTable.bio, "Disposable Android chat performance fixture."),
        eq(characterTable.isHidden, true),
        eq(characterTable.isPublic, false),
      ));

    for (const { userId: partnerId } of candidates) {
      const fixtureUuid = parseFixtureUuid(partnerId);
      if (!fixtureUuid) continue;

      const [summary] = await db.select({
        newestMessageAt: max(messagesTable.createdAt),
        messageCount: count(),
        anchorCount: sql<number>`count(*) filter (where ${messagesTable.content} = 'CHAT_PERFORMANCE_OLDER_ANCHOR')`,
      }).from(messagesTable).where(or(
        eq(messagesTable.fromUserId, partnerId),
        eq(messagesTable.toUserId, partnerId),
      ));
      const newestMessageAt = summary?.newestMessageAt;
      if (
        !newestMessageAt ||
        newestMessageAt.getTime() > now.getTime() - CHAT_FIXTURE_GRACE_PERIOD_MS ||
        Number(summary.messageCount) < MESSAGE_COUNT ||
        Number(summary.anchorCount) !== 1
      ) continue;

      // The hashed ID is intentionally opaque; find the other participant only
      // through messages linked to this validated synthetic profile.
      const [participant] = await db.select({ userId: messagesTable.fromUserId })
        .from(messagesTable)
        .where(and(
          eq(messagesTable.toUserId, partnerId),
          sql`${messagesTable.fromUserId} <> ${partnerId}`,
        ))
        .limit(1);
      const ownerUserId = participant?.userId;
      if (!ownerUserId) continue;

      try {
        await removeFixtureData(partnerId, ownerUserId, fixtureUuid);
        logger.info({ fixtureId: fixtureUuid }, "Removed expired chat performance fixture");
      } catch (error) {
        logger.warn({ err: error, fixtureId: fixtureUuid }, "Expired chat performance fixture cleanup will be retried");
      }
    }
  } finally {
    cleanupRunning = false;
  }
}

export function startChatPerformanceFixtureCleanup(): void {
  if (process.env.NODE_ENV === "production" || cleanupTimer) return;
  void cleanupExpiredChatPerformanceFixtures().catch(error => {
    logger.warn({ err: error }, "Chat performance fixture cleanup check failed");
  });
  cleanupTimer = setInterval(() => {
    void cleanupExpiredChatPerformanceFixtures().catch(error => {
      logger.warn({ err: error }, "Chat performance fixture cleanup check failed");
    });
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();
}
