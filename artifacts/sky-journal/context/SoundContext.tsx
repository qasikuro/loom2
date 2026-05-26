import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SoundName = 'tap' | 'chime' | 'save' | 'star' | 'navigate' | 'whoosh';

interface SoundContextValue {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  playSound: (name: SoundName) => void;
}

const SoundContext = createContext<SoundContextValue>({
  soundEnabled: true,
  setSoundEnabled: () => {},
  playSound: () => {},
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

// ── Sound asset map ────────────────────────────────────────────────────────────

const SOUND_ASSETS: Record<SoundName, any> = {
  tap:      require('../assets/sounds/tap.wav'),
  chime:    require('../assets/sounds/chime.wav'),
  save:     require('../assets/sounds/save.wav'),
  star:     require('../assets/sounds/star.wav'),
  navigate: require('../assets/sounds/navigate.wav'),
  whoosh:   require('../assets/sounds/whoosh.wav'),
};

// ── Provider ───────────────────────────────────────────────────────────────────

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const soundsRef = useRef<Partial<Record<SoundName, any>>>({});
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
          } catch { /* skip this sound silently */ }
        }
        loadedRef.current = true;
      } catch { /* expo-av unavailable, will fall back to haptics */ }
    }

    load();

    return () => {
      cancelled = true;
      Object.values(soundsRef.current).forEach((s: any) =>
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

    if (Platform.OS === 'web') {
      playWebSound(name);
      return;
    }

    const sound = soundsRef.current[name];
    if (!sound) return;
    sound.setPositionAsync(0)
      .then(() => sound.playAsync())
      .catch(() => null);
  }, [soundEnabled]);

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}
