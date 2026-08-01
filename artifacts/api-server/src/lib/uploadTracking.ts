/**
 * L-3: Orphaned-upload tracking.
 *
 * Files are written to object storage before the story/outfit/journal create
 * call that references them.  If that call fails, the file is never claimed
 * and would accumulate indefinitely.
 *
 * Pattern:
 *   1. Upload route calls registerPendingUpload() on success.
 *   2. Story/outfit/journal create routes call claimUpload() on success.
 *   3. startOrphanCleanup() runs a 1-hour interval; any entry not claimed
 *      after 24 hours is deleted from object storage.
 *
 * Single-process caveat: in-memory state is lost on server restart.  Uploads
 * made just before a restart are re-tracked only on the next upload, so they
 * may survive a bit longer than 24 h.  Move to a DB-backed table when scaling
 * horizontally.
 */

const ORPHAN_TTL_MS = 24 * 60 * 60_000; // 24 hours

interface PendingEntry {
  /** Raw GCS path, e.g. "images/1234_abc.jpeg" */
  storagePath: string;
  uploadedAt:  number;
}

// Keyed by the /api/images/... path returned to the client.
const pending = new Map<string, PendingEntry>();

/** Called by the upload route immediately after a successful file save. */
export function registerPendingUpload(apiPath: string, storagePath: string): void {
  pending.set(apiPath, { storagePath, uploadedAt: Date.now() });
}

/**
 * Call in story/outfit/journal create routes on success to prevent the file
 * from being deleted as an orphan.  Safe to call with any value — non-upload
 * paths and nulls are silently ignored.
 */
export function claimUpload(apiPath: string | null | undefined): void {
  if (apiPath) pending.delete(apiPath);
}

/**
 * Start the periodic orphan-cleanup interval.  The caller provides the delete
 * callback to keep this module free of storage-client dependencies.
 *
 * @param deleteFile  Async function that deletes the file at `storagePath`.
 *                    Errors are swallowed — the entry is removed regardless.
 */
export function startOrphanCleanup(
  deleteFile: (storagePath: string) => Promise<void>,
): void {
  const interval = setInterval(async () => {
    const cutoff = Date.now() - ORPHAN_TTL_MS;
    for (const [apiPath, { storagePath, uploadedAt }] of pending) {
      if (uploadedAt > cutoff) continue;
      try { await deleteFile(storagePath); } catch { /* already gone */ }
      pending.delete(apiPath);
    }
  }, 60 * 60_000);
  // Don't block graceful Node shutdown (only meaningful for real NodeJS.Timeout)
  if (interval && typeof (interval as NodeJS.Timeout).unref === 'function') {
    (interval as NodeJS.Timeout).unref();
  }
}
