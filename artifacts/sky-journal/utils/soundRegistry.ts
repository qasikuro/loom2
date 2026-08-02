/**
 * soundRegistry — coordinated cleanup for all native Audio.Sound instances.
 *
 * Problem: expo-av's AVManager.onHostDestroy() calls ExoPlayer.release() from
 * a ThreadPoolExecutor thread during React Native (0.81 new-arch) bridge
 * teardown. ExoPlayer.verifyApplicationThread() then throws:
 *   "Player is accessed on the wrong thread."
 *
 * Root cause: any Audio.Sound that is still alive when the bridge tears down
 * will be released by AVManager on the wrong thread.
 *
 * Fix: every component that creates a native Audio.Sound calls
 * `registerNativeSound(sound)` immediately after creation.  Before and during
 * cleanup, `unloadAllNativeSounds()` stops + unloads every registered instance
 * so AVManager finds nothing left to release when onHostDestroy fires.
 *
 * SoundContext calls this in its AppState-inactive handler (covers manual
 * shake-menu reloads and fast-refresh pushes from Metro) and again in its
 * useEffect cleanup (covers normal component teardown).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Set<any>();

/** Register a newly created Audio.Sound so it can be cleaned up globally. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerNativeSound(sound: any): void {
  if (sound) registry.add(sound);
}

/** Remove a sound from the registry (e.g. after explicit unloadAsync). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unregisterNativeSound(sound: any): void {
  registry.delete(sound);
}

/**
 * Stop and unload every registered sound, then clear the registry.
 *
 * Calling stop() before unload() moves ExoPlayer to STATE_IDLE first, which
 * makes the subsequent release() a no-op in AVManager — reducing the window
 * where the wrong-thread crash can fire.
 */
export function unloadAllNativeSounds(): void {
  for (const sound of registry) {
    try { sound?.stopAsync?.(); } catch { /* ignore — sync throw is fine */ }
    sound?.unloadAsync?.().catch(() => null);
  }
  registry.clear();
}
