/** Keep chat history rendering bounded on slower Android devices. */
export const CHAT_HISTORY_LIST_CONFIG = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 8,
  updateCellsBatchingPeriod: 40,
  windowSize: 7,
} as const;

export type DmUploadProgressCheckpoint = {
  percent: number;
  updatedAt: number;
};

export type DmUploadProgressUpdate = {
  percent: number;
  fraction: number;
};

/** Keep progress-driven screen updates readable without publishing every native callback. */
export function getDmUploadProgressUpdate(
  fraction: number,
  now: number,
  checkpoint: DmUploadProgressCheckpoint,
  minIntervalMs = 150,
): DmUploadProgressUpdate | null {
  const bounded = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;
  const percent = Math.round(bounded * 100);
  if (percent === checkpoint.percent || (percent < 100 && now - checkpoint.updatedAt < minIntervalMs)) {
    return null;
  }
  return { percent, fraction: percent / 100 };
}
