import { pool } from "@workspace/db";
import { objectStorageClient } from "../lib/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
const CLEANUP_INTERVAL_MS = 60 * 60_000;

type ExpiredComposition = {
  id: string;
  video_path: string;
  thumbnail_path: string;
};

function storagePathFromApiPath(apiPath: string): string | null {
  if (apiPath.startsWith("/api/videos/")) return `videos/${apiPath.slice("/api/videos/".length)}`;
  if (apiPath.startsWith("/api/images/")) return `images/${apiPath.slice("/api/images/".length)}`;
  return null;
}

export async function cleanupExpiredMediaCompositions(): Promise<void> {
  if (!BUCKET_ID) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<ExpiredComposition>(`
      SELECT id, video_path, thumbnail_path
      FROM media_compositions
      WHERE status = 'pending' AND expires_at <= NOW()
      FOR UPDATE SKIP LOCKED
    `);
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    for (const composition of rows) {
      let deleted = true;
      const storagePaths = [composition.video_path, composition.thumbnail_path]
        .map(storagePathFromApiPath);
      if (storagePaths.some(path => !path)) continue;
      for (const storagePath of storagePaths as string[]) {
        try {
          await bucket.file(storagePath).delete();
        } catch {
          deleted = false;
        }
      }
      if (deleted) {
        await client.query(
          "DELETE FROM media_compositions WHERE id = $1 AND status = 'pending'",
          [composition.id],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

export function startMediaCompositionCleanup(): void {
  const interval = setInterval(() => {
    cleanupExpiredMediaCompositions().catch(() => null);
  }, CLEANUP_INTERVAL_MS);
  if (typeof (interval as NodeJS.Timeout).unref === "function") {
    (interval as NodeJS.Timeout).unref();
  }
}