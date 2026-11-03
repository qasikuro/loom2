import {
  createAudioPlayer,
  setAudioModeAsync as setExpoAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
} from 'expo-audio';

type PlaybackStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  positionMillis: number;
  durationMillis: number;
  didJustFinish: boolean;
  isLooping: boolean;
  isMuted: boolean;
  volume: number;
  error?: string;
};

type InitialPlaybackStatus = {
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  positionMillis?: number;
};

export type AudioSound = {
  playAsync: () => Promise<PlaybackStatus>;
  pauseAsync: () => Promise<PlaybackStatus>;
  stopAsync: () => Promise<PlaybackStatus>;
  unloadAsync: () => Promise<void>;
  setPositionAsync: (positionMillis: number) => Promise<void>;
  setVolumeAsync: (volume: number) => Promise<void>;
  setIsMutedAsync: (muted: boolean) => Promise<void>;
  setOnPlaybackStatusUpdate: (callback: ((status: PlaybackStatus) => void) | null) => void;
  getStatusAsync: () => Promise<PlaybackStatus>;
};

function readStatus(player: AudioPlayer): PlaybackStatus {
  const status = player.currentStatus;
  return {
    isLoaded: player.isLoaded,
    isPlaying: player.playing,
    isBuffering: player.isBuffering,
    positionMillis: Math.max(0, player.currentTime * 1000),
    durationMillis: Math.max(0, player.duration * 1000),
    didJustFinish: status.didJustFinish,
    isLooping: player.loop,
    isMuted: player.muted,
    volume: player.volume,
    ...(status.error ? { error: status.error } : {}),
  };
}

async function createSound(source: AudioSource, initial: InitialPlaybackStatus = {}) {
  const player = createAudioPlayer(source, { updateInterval: 500 });
  if (initial.isLooping !== undefined) player.loop = initial.isLooping;
  if (initial.isMuted !== undefined) player.muted = initial.isMuted;
  if (initial.volume !== undefined) player.volume = initial.volume;

  // Keep an initial seek ahead of an immediate play request, without delaying
  // the UI while the source itself is still buffering.
  let initialSeek = Promise.resolve();
  if (initial.positionMillis && initial.positionMillis > 0) {
    initialSeek = player.seekTo(initial.positionMillis / 1000).catch(() => undefined);
  }

  let statusListener: { remove: () => void } | null = null;
  let removed = false;
  const sound: AudioSound = {
    async playAsync() {
      await initialSeek;
      player.play();
      return readStatus(player);
    },
    async pauseAsync() {
      player.pause();
      return readStatus(player);
    },
    async stopAsync() {
      player.pause();
      await player.seekTo(0).catch(() => undefined);
      return readStatus(player);
    },
    async unloadAsync() {
      if (removed) return;
      removed = true;
      statusListener?.remove();
      statusListener = null;
      player.remove();
    },
    async setPositionAsync(positionMillis) {
      await player.seekTo(Math.max(0, positionMillis) / 1000);
    },
    async setVolumeAsync(volume) {
      player.volume = Math.max(0, Math.min(1, volume));
    },
    async setIsMutedAsync(muted) {
      player.muted = muted;
    },
    setOnPlaybackStatusUpdate(callback) {
      statusListener?.remove();
      statusListener = callback
        ? player.addListener('playbackStatusUpdate', () => callback(readStatus(player)))
        : null;
    },
    async getStatusAsync() {
      return readStatus(player);
    },
  };

  if (initial.shouldPlay) await sound.playAsync();
  return { sound, status: readStatus(player) };
}

type LegacyAudioMode = {
  playsInSilentModeIOS?: boolean;
  shouldDuckAndroid?: boolean;
};

async function setAudioModeAsync(mode: LegacyAudioMode): Promise<void> {
  const { playsInSilentModeIOS, shouldDuckAndroid } = mode;
  await setExpoAudioModeAsync({
    ...(playsInSilentModeIOS !== undefined ? { playsInSilentMode: playsInSilentModeIOS } : {}),
    ...(shouldDuckAndroid !== undefined
      ? { interruptionMode: shouldDuckAndroid ? 'duckOthers' : 'mixWithOthers' }
      : {}),
  });
}

export const Audio = {
  setAudioModeAsync,
  Sound: {
    createAsync: createSound,
  },
};
