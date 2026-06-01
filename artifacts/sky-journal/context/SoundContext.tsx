import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SoundName = 'tap' | 'chime' | 'save' | 'star' | 'navigate' | 'whoosh';

interface SoundContextValue {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  playSound: (name: SoundName) => void;
  playStickerSound: (stickerId: string) => void;
}

const SoundContext = createContext<SoundContextValue>({
  soundEnabled: true,
  setSoundEnabled: () => {},
  playSound: () => {},
  playStickerSound: () => {},
});

export function useSound() {
  return useContext(SoundContext);
}

// ── Bell-timbre Web Audio synthesis ───────────────────────────────────────────

let webCtx: AudioContext | null = null;

function getWebCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!webCtx) {
    const WA = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (WA) webCtx = new WA();
  }
  return webCtx;
}

const WEB_PARAMS: Record<SoundName, { partials: [number, number, number][]; dur: number }> = {
  tap:      { partials: [[900,  0.28, 30]], dur: 0.08 },
  chime:    { partials: [[1047, 0.28, 5.0], [2887, 0.12, 9.0], [5654, 0.04, 15.0]], dur: 0.30 },
  save:     { partials: [[880,  0.28, 5.0], [2426, 0.12, 9.0], [4755, 0.04, 15.0]], dur: 0.24 },
  star:     { partials: [[1568, 0.22, 5.0], [4327, 0.10, 9.0], [8467, 0.03, 15.0]], dur: 0.22 },
  navigate: { partials: [[659,  0.22, 7.0], [1817, 0.09, 12.0], [3562, 0.03, 18.0]], dur: 0.14 },
  whoosh:   { partials: [[440,  0.18, 8.0]], dur: 0.16 },
};

function playWebSound(name: SoundName) {
  const ctx = getWebCtx();
  if (!ctx) return;
  const params = WEB_PARAMS[name];
  const now = ctx.currentTime;
  for (const [freq, amp, decay] of params.partials) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.01, params.dur));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + params.dur + 0.02);
  }
}

// ── Sticker-specific Web Audio synthesis ──────────────────────────────────────
// Each sticker type gets a unique synthesised sound on web.

interface WebStickerParams {
  type: 'tone' | 'sweep' | 'heehaw' | 'howl' | 'noise_burst' | 'bell_seq';
  freqs?: number[];
  amp?: number;
  dur?: number;
}

const STICKER_WEB: Record<string, WebStickerParams> = {
  bomb:     { type: 'noise_burst', amp: 0.35, dur: 0.22 },
  stone:    { type: 'sweep', freqs: [320, 80], amp: 0.28, dur: 0.18 },
  mirror:   { type: 'bell_seq', freqs: [1800, 2800, 3600], amp: 0.22, dur: 0.06 },
  kiss:     { type: 'bell_seq', freqs: [880, 1320, 1760], amp: 0.20, dur: 0.08 },
  stars:    { type: 'bell_seq', freqs: [1568, 2349, 3136, 4186], amp: 0.18, dur: 0.07 },
  fire:     { type: 'noise_burst', amp: 0.22, dur: 0.28 },
  snow:     { type: 'bell_seq', freqs: [2093, 2793, 3135], amp: 0.14, dur: 0.10 },
  confetti: { type: 'bell_seq', freqs: [523, 659, 784, 1047], amp: 0.22, dur: 0.07 },
  candle:   { type: 'tone', freqs: [440], amp: 0.14, dur: 0.30 },
  spark:    { type: 'bell_seq', freqs: [1047, 1568, 2093], amp: 0.20, dur: 0.06 },
  lantern:  { type: 'sweep', freqs: [300, 600], amp: 0.16, dur: 0.25 },
  hush:     { type: 'sweep', freqs: [500, 200], amp: 0.12, dur: 0.30 },
  donkey:   { type: 'heehaw', amp: 0.30, dur: 0.85 },
  wolf:     { type: 'howl',   amp: 0.28, dur: 1.20 },
};

function playWebStickerSound(stickerId: string) {
  const ctx = getWebCtx();
  if (!ctx) return;
  const p = STICKER_WEB[stickerId];
  if (!p) { playWebSound('tap'); return; }
  const now = ctx.currentTime;
  const amp = p.amp ?? 0.20;
  const dur = p.dur ?? 0.20;

  switch (p.type) {
    case 'noise_burst': {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 400;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      src.start(now); src.stop(now + dur + 0.02);
      break;
    }
    case 'sweep': {
      const [f0, f1] = p.freqs ?? [440, 220];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + dur + 0.02);
      break;
    }
    case 'bell_seq': {
      (p.freqs ?? [880]).forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + i * (dur);
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(amp, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.28);
      });
      break;
    }
    case 'tone': {
      const freq = p.freqs?.[0] ?? 440;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + dur + 0.02);
      break;
    }
    case 'heehaw': {
      // "HEE" – rising glide
      const osc1 = ctx.createOscillator();
      const g1   = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(300, now);
      osc1.frequency.linearRampToValueAtTime(900, now + 0.30);
      g1.gain.setValueAtTime(0, now);
      g1.gain.linearRampToValueAtTime(amp, now + 0.02);
      g1.gain.setValueAtTime(amp, now + 0.28);
      g1.gain.linearRampToValueAtTime(0, now + 0.34);
      osc1.connect(g1); g1.connect(ctx.destination);
      osc1.start(now); osc1.stop(now + 0.36);
      // "HAW" – falling glide
      const osc2 = ctx.createOscillator();
      const g2   = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(280, now + 0.40);
      osc2.frequency.linearRampToValueAtTime(120, now + 0.78);
      g2.gain.setValueAtTime(0, now + 0.40);
      g2.gain.linearRampToValueAtTime(amp * 0.85, now + 0.42);
      g2.gain.setValueAtTime(amp * 0.85, now + 0.72);
      g2.gain.linearRampToValueAtTime(0, now + 0.82);
      osc2.connect(g2); g2.connect(ctx.destination);
      osc2.start(now + 0.40); osc2.stop(now + 0.85);
      break;
    }
    case 'howl': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(750, now + 0.50);
      osc.frequency.setValueAtTime(750, now + 0.80);
      osc.frequency.linearRampToValueAtTime(380, now + 1.15);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.08);
      gain.gain.setValueAtTime(amp, now + 0.90);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.20);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 1.22);
      break;
    }
  }
}

// ── Sound asset map ────────────────────────────────────────────────────────────

const SOUND_ASSETS: Record<SoundName, any> = {
  tap:      require('../assets/sounds/tap.wav'),
  chime:    require('../assets/sounds/chime.wav'),
  save:     require('../assets/sounds/save.wav'),
  star:     require('../assets/sounds/star.wav'),
  navigate: require('../assets/sounds/navigate.wav'),
  whoosh:   require('../assets/sounds/whoosh.wav'),
};

// Map sticker ID → best native WAV fallback + volume
const STICKER_NATIVE: Record<string, { name: SoundName; volume?: number }> = {
  bomb:     { name: 'whoosh',   volume: 0.60 },
  stone:    { name: 'tap',      volume: 0.55 },
  mirror:   { name: 'chime',    volume: 0.50 },
  kiss:     { name: 'chime',    volume: 0.40 },
  stars:    { name: 'star',     volume: 0.50 },
  fire:     { name: 'whoosh',   volume: 0.45 },
  snow:     { name: 'chime',    volume: 0.40 },
  confetti: { name: 'chime',    volume: 0.55 },
  candle:   { name: 'navigate', volume: 0.35 },
  spark:    { name: 'star',     volume: 0.45 },
  lantern:  { name: 'navigate', volume: 0.38 },
  hush:     { name: 'navigate', volume: 0.28 },
};

// Dedicated WAV assets for donkey + wolf
const STICKER_NATIVE_ASSETS: Record<string, any> = {
  donkey: require('../assets/sounds/sticker_donkey.wav'),
  wolf:   require('../assets/sounds/sticker_wolf.wav'),
};

// ── Provider ───────────────────────────────────────────────────────────────────

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const soundsRef = useRef<Partial<Record<SoundName, any>>>({});
  const stickerSoundsRef = useRef<Record<string, any>>({});
  const loadedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('sound_enabled_v1').then(v => {
      if (v === 'false') setSoundEnabledState(false);
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    async function load() {
      try {
        const { Audio } = await import('expo-av');
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

        for (const [name, asset] of Object.entries(SOUND_ASSETS) as [SoundName, any][]) {
          if (cancelled) break;
          try {
            const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.45 });
            soundsRef.current[name] = sound;
          } catch { /* skip silently */ }
        }

        for (const [id, asset] of Object.entries(STICKER_NATIVE_ASSETS)) {
          if (cancelled) break;
          try {
            const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.50 });
            stickerSoundsRef.current[id] = sound;
          } catch { /* skip silently */ }
        }

        loadedRef.current = true;
      } catch { /* expo-av unavailable */ }
    }

    load();

    return () => {
      cancelled = true;
      Object.values(soundsRef.current).forEach((s: any) =>
        s?.unloadAsync?.().catch(() => null)
      );
      Object.values(stickerSoundsRef.current).forEach((s: any) =>
        s?.unloadAsync?.().catch(() => null)
      );
    };
  }, []);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    AsyncStorage.setItem('sound_enabled_v1', String(v)).catch(() => null);
  }, []);

  const playSound = useCallback((name: SoundName) => {
    if (!soundEnabled) return;
    if (Platform.OS === 'web') { playWebSound(name); return; }
    const sound = soundsRef.current[name];
    if (!sound) return;
    sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => null);
  }, [soundEnabled]);

  const playStickerSound = useCallback((stickerId: string) => {
    if (!soundEnabled) return;

    if (Platform.OS === 'web') {
      playWebStickerSound(stickerId);
      return;
    }

    // Dedicated WAV for donkey/wolf
    const dedicated = stickerSoundsRef.current[stickerId];
    if (dedicated) {
      dedicated.setPositionAsync(0).then(() => dedicated.playAsync()).catch(() => null);
      return;
    }

    // Fallback to mapped general sound
    const mapping = STICKER_NATIVE[stickerId];
    if (mapping) {
      const sound = soundsRef.current[mapping.name];
      if (!sound) return;
      sound.setVolumeAsync(mapping.volume ?? 0.45).catch(() => null);
      sound.setPositionAsync(0).then(() => sound.playAsync()).catch(() => null);
    }
  }, [soundEnabled]);

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playSound, playStickerSound }}>
      {children}
    </SoundContext.Provider>
  );
}
