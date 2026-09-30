import { createHmac, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import { objectStorageClient } from "./objectStorage";

const TICKET_TTL_SECONDS = 15 * 60;
const OWNER_METADATA_KEY = "ownerUserId";

export class MediaOwnershipError extends Error {
  readonly status = 403;

  constructor(message = "Media is not owned by this user") {
    super(message);
    this.name = "MediaOwnershipError";
  }
}

function getUrlPathname(uri: string): string | null {
  try {
    if (/^https?:\/\//i.test(uri)) return new URL(uri).pathname;
    if (uri.startsWith("/") && !uri.startsWith("//")) {
      return new URL(uri, "https://media.invalid").pathname;
    }
    return null;
  } catch {
    return null;
  }
}

function looksLikeInternalMediaReference(uri: string): boolean {
  if (uri.startsWith("//")) return false;
  const pathname = getUrlPathname(uri) ??
    uri.split(/[?#]/, 1)[0];
  return /(?:^|\/)api\/(?:images|videos)(?:\/|$)/i.test(pathname);
}

export function normalizeManagedMediaPath(uri: string): string | null {
  if (typeof uri !== "string" || !uri) return null;
  const pathname = getUrlPathname(uri);
  if (!pathname) return null;
  const match = pathname.match(/^\/api\/(images|videos)\/([^/]+)\/?$/i);
  if (!match) return null;
  let filename: string;
  try {
    filename = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!/^[\w.-]+$/.test(filename) || filename === "." || filename === "..") return null;
  return `/api/${match[1].toLowerCase()}/${filename}`;
}

export function normalizeMediaReference(uri: string): string {
  const path = normalizeManagedMediaPath(uri);
  if (path) return path;
  if (looksLikeInternalMediaReference(uri)) {
    throw new MediaOwnershipError("Managed media reference is malformed");
  }
  return uri;
}

function signingSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret || null;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signOwnerMediaUrl(uri: string, userId: string): string {
  const path = normalizeManagedMediaPath(uri);
  const secret = signingSecret();
  if (!path) return uri;
  if (!secret || !userId) throw new Error("Media signing is not configured");
  const payload = Buffer.from(JSON.stringify({
    path,
    userId,
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
  })).toString("base64url");
  return `${path}?ticket=${payload}.${signature(payload, secret)}`;
}

export function validateOwnerMediaTicket(ticket: unknown, path: string): string | null {
  const secret = signingSecret();
  if (!secret || typeof ticket !== "string") return null;
  const [payload, supplied, ...extra] = ticket.split(".");
  if (!payload || !supplied || extra.length) return null;
  const expected = signature(payload, secret);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      path?: unknown; userId?: unknown; exp?: unknown;
    };
    if (decoded.path !== path || typeof decoded.userId !== "string" ||
        typeof decoded.exp !== "number" || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

async function getRegisteredOwnerCandidates(path: string): Promise<string[]> {
  const result = await pool.query(
    `SELECT user_id AS owner FROM uploaded_images WHERE path=$1
     UNION ALL
     SELECT user_id AS owner FROM media_compositions
       WHERE video_path=$1 OR thumbnail_path=$1
     UNION ALL
     SELECT user_id AS owner FROM manga_generations WHERE image_uri=$1`,
    [path],
  );
  return result.rows.map(row => row.owner).filter((owner): owner is string =>
    typeof owner === "string" && owner.length > 0
  );
}

async function getStorageOwner(path: string): Promise<string | null> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) return null;
  const objectPath = path.replace(/^\/api\/(images|videos)\//, "$1/");
  try {
    const [metadata] = await objectStorageClient.bucket(bucketId).file(objectPath).getMetadata();
    const custom = metadata.metadata as Record<string, unknown> | undefined;
    const owner = custom?.[OWNER_METADATA_KEY] ??
      (metadata as Record<string, unknown>)[OWNER_METADATA_KEY];
    return typeof owner === "string" && owner.length > 0 ? owner : null;
  } catch (error) {
    // Legacy locally stored assets have no GCS metadata. Treat metadata lookup
    // 404 as absence, but do not fall back to potentially stale references if
    // an existing object could not be inspected.
    if ((error as { code?: number | string })?.code === 404 ||
        (error as { code?: number | string })?.code === "404") return null;
    throw error;
  }
}

function filenameFor(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

async function getLegacyOwnerCandidates(path: string): Promise<string[]> {
  const filename = filenameFor(path);
  const contains = `%${filename}%`;
  const [stories, outfits, avatars, books, journals, gallery] = await Promise.all([
    pool.query(
      `SELECT s.user_id, s.panels, s.pages, s.video_uri, s.thumbnail_uri FROM stories s
       WHERE s.video_uri LIKE $1 OR s.thumbnail_uri LIKE $1
         OR s.panels::text LIKE $1 OR s.pages::text LIKE $1`,
      [contains],
    ),
    pool.query("SELECT user_id, image_uri FROM outfits WHERE image_uri LIKE $1", [contains]),
    pool.query(
      "SELECT user_id, avatar_uri FROM character WHERE avatar_uri IS NOT NULL AND avatar_uri LIKE $1",
      [contains],
    ),
    pool.query(
      `SELECT b.user_id, b.cover_image_uri, ch.pages FROM books b
       LEFT JOIN chapters ch ON ch.book_id=b.id
       WHERE b.cover_image_uri LIKE $1 OR ch.pages::text LIKE $1`,
      [contains],
    ),
    pool.query("SELECT user_id, image_uri FROM journal_entries WHERE image_uri LIKE $1", [contains]),
    pool.query("SELECT user_id, image_uri FROM gallery WHERE image_uri LIKE $1", [contains]),
  ]);
  const owners: string[] = [];
  for (const row of stories.rows) if (storyReferencesPath(row, path)) owners.push(row.user_id);
  for (const row of outfits.rows) if (samePath(row.image_uri, path)) owners.push(row.user_id);
  for (const row of avatars.rows) if (samePath(row.avatar_uri, path)) owners.push(row.user_id);
  for (const row of books.rows) {
    if (samePath(row.cover_image_uri, path) || pagesReferencePath(row.pages, path)) owners.push(row.user_id);
  }
  for (const row of journals.rows) if (samePath(row.image_uri, path)) owners.push(row.user_id);
  for (const row of gallery.rows) if (samePath(row.image_uri, path)) owners.push(row.user_id);
  return owners.filter((owner): owner is string => typeof owner === "string" && owner.length > 0);
}

function samePath(uri: unknown, path: string): boolean {
  return typeof uri === "string" && normalizeManagedMediaPath(uri) === path;
}

function panelsReferencePath(panels: unknown, path: string): boolean {
  return Array.isArray(panels) && panels.some(panel =>
    !!panel && typeof panel === "object" && samePath((panel as Record<string, unknown>).imageUri, path)
  );
}

function pagesReferencePath(pages: unknown, path: string): boolean {
  return Array.isArray(pages) && pages.some(page =>
    !!page && typeof page === "object" &&
      panelsReferencePath((page as Record<string, unknown>).panels, path)
  );
}

function storyReferencesPath(row: Record<string, unknown>, path: string): boolean {
  return samePath(row.video_uri, path) || samePath(row.thumbnail_uri, path) ||
    panelsReferencePath(row.panels, path) || pagesReferencePath(row.pages, path);
}

export async function getMediaOwner(path: string, storageOwner?: string | null): Promise<string | null> {
  const registered = await getRegisteredOwnerCandidates(path);
  const authoritative = [...registered];
  const resolvedStorageOwner = storageOwner === undefined ? await getStorageOwner(path) : storageOwner;
  if (resolvedStorageOwner) authoritative.push(resolvedStorageOwner);
  const authoritativeOwners = [...new Set(authoritative)];
  if (authoritativeOwners.length > 1) return null;
  if (authoritativeOwners.length === 1) return authoritativeOwners[0];

  const legacyOwners = [...new Set(await getLegacyOwnerCandidates(path))];
  return legacyOwners.length === 1 ? legacyOwners[0] : null;
}

async function hasLivePublicReference(path: string, assetOwner: string): Promise<boolean> {
  const [storyRows, outfitRows, profileRows, bookRows] = await Promise.all([
    pool.query(
      `SELECT s.user_id, s.panels, s.pages, s.video_uri, s.thumbnail_uri
       FROM stories s JOIN character c ON c.user_id=s.user_id
       WHERE s.user_id=$1 AND s.is_public=true AND s.is_hidden=false
         AND c.is_public=true AND c.is_banned=false`,
      [assetOwner],
    ),
    pool.query(
      `SELECT o.user_id, o.image_uri FROM outfits o
       JOIN character c ON c.user_id=o.user_id
       WHERE o.user_id=$1 AND o.is_public=true AND o.is_hidden=false
         AND c.is_public=true AND c.is_banned=false`,
      [assetOwner],
    ),
    pool.query(
      `SELECT user_id, avatar_uri FROM character
       WHERE user_id=$1 AND is_public=true AND is_banned=false AND avatar_uri IS NOT NULL`,
      [assetOwner],
    ),
    pool.query(
      `SELECT b.user_id, b.cover_image_uri,
              CASE WHEN ch.status='published' THEN ch.pages ELSE NULL END AS pages
       FROM books b JOIN character c ON c.user_id=b.user_id
       LEFT JOIN chapters ch ON ch.book_id=b.id AND ch.status='published'
       WHERE b.user_id=$1 AND b.visibility='public' AND c.is_public=true AND c.is_banned=false`,
      [assetOwner],
    ),
  ]);
  return storyRows.rows.some(row => row.user_id === assetOwner && storyReferencesPath(row, path)) ||
    outfitRows.rows.some(row => row.user_id === assetOwner && samePath(row.image_uri, path)) ||
    profileRows.rows.some(row => row.user_id === assetOwner && samePath(row.avatar_uri, path)) ||
    bookRows.rows.some(row => row.user_id === assetOwner &&
      (samePath(row.cover_image_uri, path) || pagesReferencePath(row.pages, path)));
}

export async function isPubliclyReadableMedia(path: string, owner: string): Promise<boolean> {
  return hasLivePublicReference(path, owner);
}

export async function assertOwnedMediaReferences(
  userId: string,
  uris: (string | null | undefined)[],
): Promise<void> {
  const paths = new Set<string>();
  for (const uri of uris) {
    if (!uri) continue;
    const path = normalizeManagedMediaPath(uri);
    if (!path) {
      if (looksLikeInternalMediaReference(uri)) {
        throw new MediaOwnershipError("Managed media reference is malformed");
      }
      continue;
    }
    paths.add(path);
  }
  for (const path of paths) {
    const owner = await getMediaOwner(path);
    if (owner !== userId) throw new MediaOwnershipError();
  }
}

export function withOwnerMediaUrls<T>(data: T, userId: string): T {
  const mediaFields = new Set([
    "imageUri", "videoUri", "thumbnailUri", "avatarUri", "coverImageUri", "artworkUrl",
    "image_uri", "video_uri", "thumbnail_uri", "avatar_uri", "cover_image_uri",
  ]);
  const walk = (value: unknown, key?: string): unknown => {
    if (typeof value === "string" && key && mediaFields.has(key)) {
      const path = normalizeManagedMediaPath(value);
      return path ? signOwnerMediaUrl(path, userId) : value;
    }
    if (Array.isArray(value)) return value.map(child => walk(child));
    if (value && typeof value === "object") {
      if (value instanceof Date) return value;
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, walk(child, childKey)]));
    }
    return value;
  };
  return walk(data) as T;
}

export function mediaOwnerMetadata(userId: string): Record<string, string> {
  return { [OWNER_METADATA_KEY]: userId };
}