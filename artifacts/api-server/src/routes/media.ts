import { Router, type IRouter, type Request, type Response as ExpressResponse } from "express";
import multer from "multer";
import { lookup } from "node:dns/promises";
import { createWriteStream } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { z } from "zod";
import { db, mediaCompositionsTable } from "@workspace/db";
import { requireAuth, getUserId } from "../middleware/auth";
import { objectStorageClient } from "../lib/objectStorage";
import { audiusStreamUrl } from "../services/audius";
import {
  composeVideo,
  MAX_OUTPUT_BYTES,
  VideoCompositionError,
} from "../services/videoCompositionService";

const router: IRouter = Router();
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const MAX_SOURCE_BYTES = 500 * 1024 * 1024;
const MAX_MUSIC_BYTES = 250 * 1024 * 1024;
const AUDIO_TIMEOUT_MS = 90_000;

const ComposeMusicSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  artist: z.string().min(1).max(300),
  artworkUrl: z.string().url().max(2000).nullable(),
  duration: z.number().int().min(1).max(3600),
  genre: z.string().max(100).nullable(),
  mood: z.string().max(100).nullable(),
  streamUrl: z.string().url().max(2000).optional(),
  embedded: z.boolean().optional(),
  baked: z.boolean().optional(),
  segmentStartSeconds: z.number().min(0).optional(),
  segmentDurationSeconds: z.number().positive().max(60).optional(),
  originalVolume: z.number().min(0).max(1).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
});

const ComposeFieldsSchema = z.object({
  videoStartSeconds: z.coerce.number().finite().min(0),
  videoDurationSeconds: z.coerce.number().finite().positive().max(60),
  music: z.string().optional(),
  musicStartSeconds: z.coerce.number().finite().min(0).optional().default(0),
  originalVolume: z.coerce.number().finite().min(0).max(1).optional().default(1),
  musicVolume: z.coerce.number().finite().min(0).max(1).optional().default(1),
});

const composeRate = new Map<string, number[]>();
function allowCompose(userId: string): boolean {
  const now = Date.now();
  const recent = (composeRate.get(userId) ?? []).filter(time => time > now - 60_000);
  if (recent.length >= 5) {
    composeRate.set(userId, recent);
    return false;
  }
  recent.push(now);
  composeRate.set(userId, recent);
  return true;
}

async function hasVideoMagic(filePath: string): Promise<boolean> {
  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(32);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 12 || header.toString("ascii", 4, 8) !== "ftyp") return false;
    const brand = header.toString("ascii", 8, 12);
    return ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "qt  "].includes(brand);
  } finally {
    await handle.close();
  }
}

function isPublicIp(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const [a, b] = octets;
    return a !== 0 && a !== 10 && a !== 127 && a !== 169 &&
      !(a === 100 && b >= 64 && b <= 127) &&
      !(a === 172 && b >= 16 && b <= 31) &&
      !(a === 192 && (b === 0 || b === 168)) &&
      !(a === 198 && b >= 18 && b <= 19) &&
      !(a >= 224);
  }
  if (isIP(normalized) === 6) {
    if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
        normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
        normalized.startsWith("fea") || normalized.startsWith("feb")) return false;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+)$/);
    return !mapped || isPublicIp(mapped[1]);
  }
  return false;
}

async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new VideoCompositionError("The selected music redirect is not secure.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(address => !isPublicIp(address.address))) {
    throw new VideoCompositionError("The selected music redirect points to a private or local address.");
  }
  return url;
}

async function downloadMusic(trackId: string, destination: string, signal: AbortSignal): Promise<void> {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (signal.aborted) controller.abort();
  signal.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), AUDIO_TIMEOUT_MS);
  try {
    let url = await assertPublicHttpsUrl(audiusStreamUrl(trackId));
    let response: Response | undefined;
    for (let redirect = 0; redirect <= 4; redirect += 1) {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "audio/*", "User-Agent": "SkyJournalMediaProcessor/1.0" },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirect === 4) {
        throw new VideoCompositionError("The selected music has too many redirects.");
      }
      url = await assertPublicHttpsUrl(new URL(location, url).toString());
    }
    if (!response?.ok || !response.body) {
      throw new VideoCompositionError("The selected music could not be downloaded.");
    }
    const contentType = response.headers.get("content-type") ?? "";
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_MUSIC_BYTES) {
      throw new VideoCompositionError("The selected music file is too large.");
    }
    if (contentType && !contentType.startsWith("audio/") && !contentType.includes("octet-stream")) {
      throw new VideoCompositionError("The selected music stream is not an audio file.");
    }
    let bytes = 0;
    const bounded = async function* () {
      for await (const chunk of Readable.fromWeb(response!.body as unknown as globalThis.ReadableStream)) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
        bytes += buffer.length;
        if (bytes > MAX_MUSIC_BYTES) throw new VideoCompositionError("The selected music file is too large.");
        yield buffer;
      }
    };
    await pipeline(Readable.from(bounded()), createWriteStream(destination, { flags: "wx" }));
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", forwardAbort);
  }
}

function parseMusic(value: string | undefined) {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new VideoCompositionError("Music must be valid JSON.");
  }
  const result = ComposeMusicSchema.safeParse(parsed);
  if (!result.success) throw new VideoCompositionError("Selected music metadata is invalid.");
  return result.data;
}

router.post(
  "/media/compose-video",
  requireAuth,
  (req, res, next) => {
    if (!allowCompose(getUserId(req))) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json({ error: "Too many video processing requests. Please try again shortly." });
    }
    return next();
  },
  (req, res, next) => {
    const upload = multer({
      dest: tmpdir(),
      limits: { fileSize: MAX_SOURCE_BYTES, files: 1, fields: 8 },
    });
    upload.single("file")(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Video source must be 500 MB or smaller." });
      }
      if (error) return next(error);
      return next();
    });
  },
  async (req: Request, res: ExpressResponse) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) return res.status(400).json({ error: "A video file is required." });
    if (!BUCKET_ID) {
      await rm(file.path, { force: true }).catch(() => null);
      return res.status(503).json({ error: "Storage is not configured." });
    }

    const abortController = new AbortController();
    let closed = false;
    const abort = () => {
      if (!res.headersSent) abortController.abort();
    };
    req.once("aborted", abort);
    res.once("close", abort);
    const workDir = await mkdtemp(join(tmpdir(), "sky-compose-"));
    const uploadedPaths: string[] = [];
    try {
      if (!hasVideoMime(file.mimetype) || !(await hasVideoMagic(file.path))) {
        return res.status(400).json({ error: "Unsupported video format. Upload an MP4, MOV, or M4V file." });
      }
      const fields = ComposeFieldsSchema.safeParse(req.body);
      if (!fields.success) return res.status(400).json({ error: "Invalid video composition fields.", details: fields.error.flatten() });
       const music = parseMusic(fields.data.music);
      let musicPath: string | undefined;
      if (music) {
        musicPath = join(workDir, "music");
         await downloadMusic(music.id, musicPath, abortController.signal);
      }
      const result = await composeVideo({
        sourcePath: file.path,
        videoStartSeconds: fields.data.videoStartSeconds,
        videoDurationSeconds: fields.data.videoDurationSeconds,
        musicPath,
        musicStartSeconds: fields.data.musicStartSeconds,
        originalVolume: fields.data.originalVolume,
        musicVolume: fields.data.musicVolume,
        workDir,
        signal: abortController.signal,
      });

      const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const videoPath = `videos/${token}.mp4`;
      const thumbPath = `images/${token}.jpg`;
      await objectStorageClient.bucket(BUCKET_ID).file(videoPath).save(await readFile(result.outputPath), {
        metadata: { contentType: "video/mp4" }, resumable: false,
      });
      uploadedPaths.push(videoPath);
      await objectStorageClient.bucket(BUCKET_ID).file(thumbPath).save(await readFile(result.thumbnailPath), {
        metadata: { contentType: "image/jpeg" }, resumable: false,
      });
      uploadedPaths.push(thumbPath);
      const [composition] = await db.insert(mediaCompositionsTable).values({
        userId: getUserId(req),
        videoPath: `/api/videos/${token}.mp4`,
        thumbnailPath: `/api/images/${token}.jpg`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      }).returning({ id: mediaCompositionsTable.id });
      if (!composition) throw new VideoCompositionError("The media composition could not be registered.", "output");
      closed = true;
      return res.status(201).json({
        compositionId: composition.id,
        path: `/api/videos/${token}.mp4`,
        thumbnailPath: `/api/images/${token}.jpg`,
        duration: result.duration,
        width: result.width,
        height: result.height,
        fileSize: Math.min(result.fileSize, MAX_OUTPUT_BYTES),
      });
    } catch (error) {
      if (error instanceof VideoCompositionError) {
        const status = error.code === "output" ? 422 : 400;
        return res.status(status).json({ error: error.message });
      }
      req.log.error({ err: error }, "Video composition failed");
      return res.status(500).json({ error: "Video processing failed. Please retry." });
    } finally {
      req.off("aborted", abort);
      res.off("close", abort);
      await rm(file.path, { force: true }).catch(() => null);
      await rm(workDir, { recursive: true, force: true }).catch(() => null);
      if (!closed && uploadedPaths.length) {
        await Promise.all(uploadedPaths.map(path => objectStorageClient.bucket(BUCKET_ID).file(path).delete().catch(() => null)));
      }
    }
  },
);

function hasVideoMime(mime: string): boolean {
  return ["video/mp4", "video/quicktime", "video/x-m4v", "application/mp4"].includes(mime) || mime === "application/octet-stream";
}

export default router;