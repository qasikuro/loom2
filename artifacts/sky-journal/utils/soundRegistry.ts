/**
 * Coordinated cleanup for audio players created through audioCompat.
 * Components register players after creation; the app lifecycle and provider
 * cleanup stop and remove them so previews and loops do not outlive their UI.
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
 * Stop and remove every registered player, then clear the registry.
 */
export function unloadAllNativeSounds(): void {
  for (const sound of registry) {
    try { sound?.stopAsync?.(); } catch { /* ignore — sync throw is fine */ }
    sound?.unloadAsync?.().catch(() => null);
  }
  registry.clear();
}
