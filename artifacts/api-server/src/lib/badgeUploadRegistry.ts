const PENDING_TTL_MS = 15 * 60_000;
const MAX_PENDING_UPLOADS = 10_000;

type PendingUpload = { userId: string; expiresAt: number };
const pendingUploads = new Map<string, PendingUpload>();

function normalizeObjectPath(objectPath: string): string | null {
  return /^\/objects\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(objectPath)
    ? objectPath
    : null;
}

function pruneExpired(now: number): void {
  for (const [path, entry] of pendingUploads) {
    if (entry.expiresAt <= now) pendingUploads.delete(path);
  }
}

export function registerPendingBadgeUpload(objectPath: string, userId: string): void {
  const path = normalizeObjectPath(objectPath);
  if (!path || !userId) return;
  const now = Date.now();
  pruneExpired(now);
  if (pendingUploads.size >= MAX_PENDING_UPLOADS && !pendingUploads.has(path)) {
    let earliestPath: string | undefined;
    let earliestExpiry = Infinity;
    for (const [candidate, entry] of pendingUploads) {
      if (entry.expiresAt < earliestExpiry) {
        earliestPath = candidate;
        earliestExpiry = entry.expiresAt;
      }
    }
    if (earliestPath) pendingUploads.delete(earliestPath);
  }
  pendingUploads.set(path, { userId, expiresAt: now + PENDING_TTL_MS });
}

export function isPendingBadgeUploadOwner(objectPath: string, userId: string): boolean {
  const path = normalizeObjectPath(objectPath);
  if (!path || !userId) return false;
  const entry = pendingUploads.get(path);
  if (!entry) return false;
  if (entry.expiresAt <= Date.now()) {
    pendingUploads.delete(path);
    return false;
  }
  return entry.userId === userId;
}

export function consumePendingBadgeUpload(objectPath: string, userId: string): boolean {
  if (!isPendingBadgeUploadOwner(objectPath, userId)) return false;
  pendingUploads.delete(objectPath);
  return true;
}