export const MAX_VIDEO_DURATION_SECONDS = 60;

export type VideoTrim = {
  startSeconds: number;
  endSeconds: number;
};

export type MusicSegment = {
  startSeconds: number;
  durationSeconds: number;
  endsAtSeconds: number;
};

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeVideoTrim(
  durationSeconds: number,
  startSeconds = 0,
  endSeconds = durationSeconds,
): VideoTrim {
  const sourceDuration = Math.max(0, Number.isFinite(durationSeconds) ? durationSeconds : 0);
  const start = clampNumber(startSeconds, 0, sourceDuration);
  const maxEnd = Math.min(sourceDuration, start + MAX_VIDEO_DURATION_SECONDS);
  let end = clampNumber(endSeconds, start, sourceDuration);
  if (end > maxEnd) end = maxEnd;
  if (end < start) end = start;
  return { startSeconds: start, endSeconds: end };
}

export function selectedVideoDuration(trim: VideoTrim): number {
  return Math.max(0, trim.endSeconds - trim.startSeconds);
}

export function calculateMusicSegment(
  videoDurationSeconds: number,
  trackDurationSeconds: number,
  musicStartSeconds = 0,
): MusicSegment {
  const videoDuration = Math.max(0, Number.isFinite(videoDurationSeconds) ? videoDurationSeconds : 0);
  const trackDuration = Math.max(0, Number.isFinite(trackDurationSeconds) ? trackDurationSeconds : 0);
  const start = clampNumber(musicStartSeconds, 0, trackDuration);
  const duration = Math.min(videoDuration, Math.max(0, trackDuration - start));
  return {
    startSeconds: start,
    durationSeconds: duration,
    endsAtSeconds: start + duration,
  };
}

export function formatVideoTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export function formatVideoRange(trim: VideoTrim): string {
  return `${formatVideoTime(trim.startSeconds)} – ${formatVideoTime(trim.endSeconds)}`;
}
