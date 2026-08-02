---
name: ExoPlayer wrong-thread crash on Metro reload
description: "Player is accessed on the wrong thread" crash in RN 0.81 new-arch; fix via soundRegistry coordinated cleanup.
---

## The rule
All `expo-av` `Audio.Sound` instances must be registered in `utils/soundRegistry.ts` immediately after `Audio.Sound.createAsync(...)`.  The `SoundProvider` cleanup calls `unloadAllNativeSounds()` which covers both its own sounds and any module-level caches elsewhere (e.g. `VibeStickerPicker`).

**Why:** React Native 0.81 (new architecture) runs the reload task on a `ThreadPoolExecutor` thread.  When `ReactInstance.destroy()` is called, `AVManager.onHostDestroy()` tries to release every live `ExoPlayer` instance from that thread.  `ExoPlayer.verifyApplicationThread()` throws "Player is accessed on the wrong thread", crashing the dev build with "There was a problem loading the project."

**How to apply:**
- Any component that calls `Audio.Sound.createAsync()` must immediately call `registerNativeSound(sound)`.
- Module-level sound caches (like `VibeStickerPicker`'s `loadedSounds`) are the highest-risk pattern — they are never cleaned up by component lifecycle alone.
- Do NOT add an `AppState inactive/background` listener that calls `unloadAllNativeSounds()` — it breaks sounds for the rest of the session after any phone call or app switch (sounds are unloaded but the `soundsRef` entries are not reloaded).
- The registry only helps if `SoundProvider` cleanup fires before `AVManager.onHostDestroy`. In RN 0.81 this is true for normal fast-refresh reloads; force-kill+reopen is always safe.

## Files
- `artifacts/sky-journal/utils/soundRegistry.ts` — registry (registerNativeSound, unregisterNativeSound, unloadAllNativeSounds)
- `artifacts/sky-journal/context/SoundContext.tsx` — registers all sounds; calls unloadAllNativeSounds() in cleanup
- `artifacts/sky-journal/components/VibeStickerPicker.tsx` — registers module-level cached sounds
