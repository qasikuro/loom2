import { Router, type IRouter, type Request, type Response } from "express";
import { access, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { pool } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { ObjectNotFoundError, ObjectStorageService, objectStorageClient } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";
import { isPendingBadgeUploadOwner } from "../lib/badgeUploadRegistry";
import {
  getMediaOwner,
  isPubliclyReadableMedia,
  normalizeManagedMediaPath,
  signOwnerMediaUrl,
  validateOwnerMediaTicket,
} from "../lib/mediaAccess";
import type { File } from "@google-cloud/storage";

const router: IRouter = Router();
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const UPLOAD_DIR = join(process.cwd(), "uploads");
const ReadUrlsSchema = z.object({ paths: z.array(z.string().min(1).max(2048)).max(100) });

function currentUserId(req: Request): string | undefined {
  try {
    return getAuth(req).userId ?? undefined;
  } catch {
    return undefined;
  }
}

async function storageOwner(path: string, tolerateNotFound = true): Promise<string | null> {
  if (!BUCKET_ID) return null;
  const filePath = path.replace(/^\/api\/(images|videos)\//, "$1/");
  try {
    const [metadata] = await objectStorageClient.bucket(BUCKET_ID).file(filePath).getMetadata();
    const custom = metadata.metadata as Record<string, string> | undefined;
    return custom?.ownerUserId ?? (metadata as Record<string, unknown>).ownerUserId as string | undefined ?? null;
  } catch (error) {
    // An absent GCS object is expected for legacy files stored on local disk.
    if (tolerateNotFound && ((error as { code?: number | string })?.code === 404 ||
        (error as { code?: number | string })?.code === "404")) return null;
    throw error;
  }
}

async function hasLocalImage(path: string): Promise<boolean> {
  const filename = path.slice(path.lastIndexOf("/") + 1);
  try {
    const localPath = join(UPLOAD_DIR, filename);
    await access(localPath);
    return (await stat(localPath)).isFile();
  } catch {
    return false;
  }
}

function errorStatus(error: unknown): number | undefined {
  const failure = error as { code?: number | string; status?: number; statusCode?: number };
  const status = failure?.status ?? failure?.statusCode ?? failure?.code;
  return status === 403 || status === "403" ? 403
    : status === 404 || status === "404" ? 404
    : undefined;
}

async function authorizeMedia(req: Request, path: string): Promise<{ owner: string; public: boolean } | null> {
  const actualOwner = await getMediaOwner(path, await storageOwner(path));
  if (!actualOwner) return null;
  const userId = currentUserId(req);
  const ticketUserId = validateOwnerMediaTicket(req.query.ticket, path);
  if (userId === actualOwner || ticketUserId === actualOwner) {
    if (ticketUserId === actualOwner || userId === actualOwner) {
      const ownerProfile = await pool.query(
        "SELECT is_banned FROM character WHERE user_id=$1 LIMIT 1",
        [actualOwner],
      );
      if (ownerProfile.rows[0]?.is_banned) return null;
    }
    return { owner: actualOwner, public: false };
  }
  if (await isPubliclyReadableMedia(path, actualOwner)) return { owner: actualOwner, public: true };
  return null;
}

function applyPrivateHeaders(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vary", "Cookie, Authorization");
}

function parseByteRange(header: string | undefined, size: number): { start: number; end: number } | null | false {
  if (!header) return null;
  // Single-range streaming is supported. For a valid multipart request, ignore
  // the Range header instead of incorrectly claiming that every range is unsatisfiable.
  if (/^bytes=\d*-\d*(,\s*\d*-\d*)+$/.test(header)) return null;
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return false;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) return false;
  return { start, end: Math.min(end, size - 1) };
}

async function streamUploadedMedia(req: Request, res: Response, kind: "images" | "videos"): Promise<void> {
  applyPrivateHeaders(res);
  const filename = String(req.params.filename ?? "");
  if (!/^[\w.-]+$/.test(filename)) {
    res.status(400).end();
    return;
  }
  const path = `/api/${kind}/${filename}`;
  try {
    const authorization = await authorizeMedia(req, path);
    if (!authorization) {
      res.status(404).end();
      return;
    }

    let file: File | null = null;
    let metadata: Record<string, unknown> | null = null;
    if (BUCKET_ID) {
      file = objectStorageClient.bucket(BUCKET_ID).file(`${kind}/${filename}`);
      try {
        const [objectMetadata] = await file.getMetadata();
        metadata = objectMetadata as Record<string, unknown>;
      } catch (error) {
        if ((error as { code?: number | string })?.code !== 404 && (error as { code?: number | string })?.code !== "404") throw error;
      }
    }

    let localPath: string | null = null;
    let localEtag: string | undefined;
    let localLastModified: Date | undefined;
    let size = Number(metadata?.size ?? 0);
    if (!metadata) {
      if (kind === "images") {
        const candidate = join(UPLOAD_DIR, filename);
        try {
          await access(candidate);
          const localStat = await stat(candidate);
          if (localStat.isFile()) {
            localPath = candidate;
            size = localStat.size;
            localEtag = `W/"${localStat.size}-${Math.floor(localStat.mtimeMs)}"`;
            localLastModified = localStat.mtime;
          }
        } catch { /* local legacy file does not exist */ }
      }
      if (!localPath) {
        res.status(404).end();
        return;
      }
    }

    const etag = typeof metadata?.etag === "string" ? `"${metadata.etag}"` : localEtag;
    if (etag) res.setHeader("ETag", etag);
    if (localLastModified) res.setHeader("Last-Modified", localLastModified.toUTCString());
    const ifNoneMatch = req.headers["if-none-match"]?.split(",").map(value => value.trim()) ?? [];
    if (etag && (ifNoneMatch.includes("*") || ifNoneMatch.includes(etag))) {
      res.status(304).end();
      return;
    }
    const contentType = String(metadata?.contentType ?? (kind === "images" ? "image/jpeg" : "video/mp4"));
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", String(size));

    const rawIfRange = req.headers["if-range"];
    const ifRange = Array.isArray(rawIfRange) ? rawIfRange[0] : rawIfRange;
    const ifRangeDate = ifRange ? Date.parse(ifRange) : Number.NaN;
    const ifRangeMatches = !ifRange || ifRange === etag ||
      (!!localLastModified && Number.isFinite(ifRangeDate) &&
        ifRangeDate >= Math.floor(localLastModified.getTime() / 1000) * 1000);
    const range = ifRangeMatches ? parseByteRange(req.headers.range, size) : null;
    if (range === false) {
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416).end();
      return;
    }
    const options = range ? { start: range.start, end: range.end } : undefined;
    if (range) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
      res.setHeader("Content-Length", String(range.end - range.start + 1));
    }
    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = localPath
      ? createReadStream(localPath, options)
      : file!.createReadStream(options);
    stream.on("error", error => {
      req.log.error({ err: error, path }, "Uploaded media stream failed");
      if (!res.headersSent) res.status(404).end();
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    req.log.error({ err: error, path }, "Uploaded media request failed");
    if (!res.headersSent) res.status(404).end();
    else res.destroy(error as Error);
  }
}

router.get("/images/:filename", (req, res) => void streamUploadedMedia(req, res, "images"));
router.head("/images/:filename", (req, res) => void streamUploadedMedia(req, res, "images"));
router.get("/videos/:filename", (req, res) => void streamUploadedMedia(req, res, "videos"));
router.head("/videos/:filename", (req, res) => void streamUploadedMedia(req, res, "videos"));

router.post("/media/read-urls", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const userId = currentUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const parsed = ReadUrlsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid paths", details: parsed.error.flatten() });
  const paths = parsed.data.paths.map(normalizeManagedMediaPath);
  if (paths.some(path => !path)) {
    return res.status(400).json({ error: "Each path must identify managed media." });
  }
  const urls: Record<string, string> = {};
  for (const path of paths as string[]) {
    try {
      let directOwner: string | null = null;
      try {
        directOwner = await storageOwner(path, false);
      } catch (error) {
        const status = errorStatus(error);
        if (status === 403) continue;
        if (status === 404) {
          if (!path.startsWith("/api/images/") || !(await hasLocalImage(path))) continue;
        } else {
          req.log.error("Could not resolve media URLs");
          return res.status(500).json({ error: "Could not resolve media URLs." });
        }
      }
      const owner = await getMediaOwner(path, directOwner);
      if (!owner) continue;
      if (owner === userId) {
        try {
          urls[path] = signOwnerMediaUrl(path, userId);
        } catch {
          // Missing signing configuration is a deny for this path; never log
          // secret/configuration exceptions or return an unsigned private URL.
        }
      } else if (await isPubliclyReadableMedia(path, owner)) {
        urls[path] = path;
      }
    } catch (error) {
      if (errorStatus(error)) continue;
      req.log.error("Could not resolve media URLs");
      return res.status(500).json({ error: "Could not resolve media URLs." });
    }
  }
  return res.json({ urls });
});

router.get("/storage/objects/uploads/:uuid", async (req, res) => {
  const uuid = String(req.params.uuid ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    return res.status(404).end();
  }
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const entityPath = `/objects/uploads/${uuid}`;
    const service = new ObjectStorageService();
    const file = await service.getObjectEntityFile(entityPath);
    const [metadata] = await file.getMetadata();
    let aclMissing = false;
    let aclMalformed = false;
    try {
      aclMissing = (await getObjectAclPolicy(file)) === null;
    } catch {
      aclMalformed = true;
    }
    let allowed = false;
    try {
      allowed = await service.canAccessObjectEntity({
        userId: currentUserId(req),
        objectFile: file,
      });
    } catch {
      allowed = false;
    }
    if (!allowed) {
      // The exact badge row is a narrowly-scoped legacy public exception for
      // older badge objects with no ACL metadata. Never override an explicit
      // private policy or malformed ACL.
      if (!aclMissing || aclMalformed) return res.status(404).end();
      const userId = currentUserId(req);
      const pendingOwner = !!userId && isPendingBadgeUploadOwner(entityPath, userId);
      if (!pendingOwner) {
        const badge = await pool.query("SELECT 1 FROM badges WHERE image_url=$1 LIMIT 1", [entityPath]);
        if (!badge.rowCount) return res.status(404).end();
      }
    }
    res.setHeader("Content-Type", String(metadata.contentType ?? "application/octet-stream"));
    const size = Number(metadata.size ?? 0);
    res.setHeader("Content-Length", String(size));
    res.setHeader("Accept-Ranges", "bytes");
    if (req.method === "HEAD") return res.end();
    file.createReadStream().on("error", error => {
      req.log.error({ err: error }, "Object storage stream failed");
      if (!res.headersSent) res.status(404).end();
      else res.destroy(error);
    }).pipe(res);
    return;
  } catch (error) {
    if (error instanceof ObjectNotFoundError || (error as { code?: number | string })?.code === 404) {
      return res.status(404).end();
    }
    req.log.error({ err: error }, "Storage object request failed");
    return res.status(404).end();
  }
});

export default router;