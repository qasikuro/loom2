import { normalizeManagedMediaPath } from "./mediaAccess";

const MEDIA_FIELDS = new Set([
  "imageUri", "videoUri", "thumbnailUri", "avatarUri", "authorAvatarUri", "partnerAvatar",
  "coverImageUri", "artworkUrl", "image_uri", "video_uri", "thumbnail_uri", "avatar_uri",
  "cover_image_uri",
]);

/** Normalize public DTO references, without issuing another user's owner ticket. */
export function publicMediaUri(uri: string | null | undefined): string | null {
  if (!uri || /^(file|data|blob):/i.test(uri)) return null;
  if (uri.startsWith("/") && !uri.startsWith("//")) {
    return normalizeManagedMediaPath(uri) ?? uri;
  }
  try {
    const source = new URL(uri);
    // Already-installed native clients may treat these obsolete hosts as
    // external. Canonical paths still undergo live public-reference checks.
    if (source.protocol === "https:" && source.hostname.toLowerCase().endsWith(".replit.dev")) {
      return normalizeManagedMediaPath(uri) ?? uri;
    }
  } catch {
    // Do not reinterpret unrelated external or non-managed values.
  }
  return uri;
}

/** Normalize only fields that represent media; leave story text and metadata intact. */
export function normalizePublicMediaFields<T>(value: T): T {
  const walk = (entry: unknown, key?: string): unknown => {
    if (typeof entry === "string" && key && MEDIA_FIELDS.has(key)) {
      return publicMediaUri(entry);
    }
    if (Array.isArray(entry)) return entry.map(child => walk(child));
    if (entry && typeof entry === "object") {
      if (entry instanceof Date) return entry;
      return Object.fromEntries(
        Object.entries(entry).map(([childKey, child]) => [childKey, walk(child, childKey)]),
      );
    }
    return entry;
  };
  return walk(value) as T;
}