type NativeAudio = typeof import('expo-av')['Audio'];

let audioModulePromise: Promise<NativeAudio> | null = null;
let audioModePromise: Promise<void> | null = null;

/**
 * Load the native player and prepare its audio session before an outfit is
 * opened. Profile screens call this in the background; the outfit screen calls
 * it again and reuses the same in-flight work.
 */
export function prepareNativeOutfitAudio(): Promise<NativeAudio> {
  if (!audioModulePromise) {
    audioModulePromise = import('expo-av')
      .then(({ Audio }) => Audio)
      .catch((error) => {
        audioModulePromise = null;
        throw error;
      });
  }

  return audioModulePromise.then(async (Audio) => {
    if (!audioModePromise) {
      audioModePromise = Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    }

    try {
      await audioModePromise;
    } catch {
      // Match the existing player behavior: still attempt playback if the
      // platform rejects an audio-mode change, and allow the next call to retry.
      audioModePromise = null;
    }

    return Audio;
  });
}
