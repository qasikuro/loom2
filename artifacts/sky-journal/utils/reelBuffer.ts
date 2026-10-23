type ReelBufferStatus = {
  isPlaying: boolean;
  isBuffering: boolean;
  positionMillis: number;
  playableDurationMillis?: number;
  durationMillis?: number;
};

/** A first frame alone isn't enough bandwidth headroom to warm another video. */
export function canWarmNextReel(status: ReelBufferStatus, alreadyWarming = false): boolean {
  if (status.isBuffering) return false;
  // A user pause must not discard the already prepared successor.
  if (!status.isPlaying) return alreadyWarming;
  if (!alreadyWarming && status.positionMillis < 500) return false;
  if (status.playableDurationMillis === undefined) {
    // Some web/native backends don't expose a buffered range.
    return alreadyWarming || status.positionMillis >= 2_000;
  }
  const ahead = status.playableDurationMillis - status.positionMillis;
  const remaining = status.durationMillis === undefined
    ? Infinity : status.durationMillis - status.positionMillis;
  // Hysteresis avoids repeatedly destroying/reloading the successor as the
  // current buffer fluctuates around the initial four-second threshold.
  return ahead >= (alreadyWarming ? 1_500 : 4_000)
    || (remaining > 0 && ahead >= remaining - 100);
}
