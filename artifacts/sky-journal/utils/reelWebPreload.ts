/**
 * Use browser-native preload hints on expo-av's existing <video>.
 * They are advisory: browsers, not JS, ultimately choose the transfer budget.
 * Never change src or call load(), which would discard a prepared buffer.
 */
export function hintReelWebPreload(video: HTMLVideoElement, playing: boolean): () => void {
  video.preload = 'auto';
  if (playing) return () => {};

  const updateBudget = () => {
    for (let index = 0; index < video.buffered.length; index++) {
      if (video.buffered.start(index) > video.currentTime || video.buffered.end(index) < video.currentTime) continue;
      const bufferedEnd = video.buffered.end(index);
      if (bufferedEnd - video.currentTime >= 3
        || (Number.isFinite(video.duration) && bufferedEnd >= video.duration - 0.1)) {
        video.preload = 'metadata';
      }
      break;
    }
  };
  video.addEventListener('progress', updateBudget);
  video.addEventListener('loadedmetadata', updateBudget);
  updateBudget();
  return () => {
    video.removeEventListener('progress', updateBudget);
    video.removeEventListener('loadedmetadata', updateBudget);
  };
}
