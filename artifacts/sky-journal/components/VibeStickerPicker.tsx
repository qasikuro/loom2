import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSound } from '@/context/SoundContext';

// ── Sticker catalogue ──────────────────────────────────────────────────────────

export const STICKERS = [
  { type: 'Hopeful',     emoji: '☀️', color: '#C8A84B', bg: '#2A1E00' },
  { type: 'Peaceful',    emoji: '🌊', color: '#58A0B8', bg: '#0A1E28' },
  { type: 'Lonely',      emoji: '🌙', color: '#6B8EC8', bg: '#0E1A30' },
  { type: 'Romantic',    emoji: '💕', color: '#C87AA8', bg: '#2A0E1E' },
  { type: 'Chaotic',     emoji: '🌪️', color: '#C87850', bg: '#2A1000' },
  { type: 'Adventurous', emoji: '⚡', color: '#58A878', bg: '#0A2018' },
  { type: 'Dreamy',      emoji: '✨', color: '#9878C8', bg: '#1A0E2E' },
  { type: 'Soft',        emoji: '🌸', color: '#C887A8', bg: '#2A0E20' },
] as const;

export type StickerType = (typeof STICKERS)[number]['type'];

// ── Web Audio fallback for sticker sounds ─────────────────────────────────────

let webCtx: AudioContext | null = null;
function getWebCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!webCtx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WA = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (WA) webCtx = new WA();
  }
  return webCtx;
}

const WEB_STICKER_SOUNDS: Record<StickerType, { freqs: number[]; durs: number[]; vol?: number }> = {
  Hopeful:     { freqs: [523, 659, 784], durs: [0.10, 0.10, 0.12] },
  Peaceful:    { freqs: [392],           durs: [0.30],             vol: 0.18 },
  Lonely:      { freqs: [440, 349],      durs: [0.15, 0.18] },
  Romantic:    { freqs: [494, 659],      durs: [0.16, 0.20] },
  Chaotic:     { freqs: [200, 500, 300, 700, 250], durs: [0.06, 0.05, 0.06, 0.05, 0.07] },
  Adventurous: { freqs: [523, 784, 1047], durs: [0.07, 0.07, 0.10] },
  Dreamy:      { freqs: [523, 587, 659, 784, 1047], durs: [0.14, 0.14, 0.14, 0.14, 0.20] },
  Soft:        { freqs: [392],           durs: [0.12],             vol: 0.15 },
};

function playWebStickerSound(type: StickerType) {
  const ctx = getWebCtx();
  if (!ctx) return;
  const params = WEB_STICKER_SOUNDS[type];
  let startTime = ctx.currentTime;
  params.freqs.forEach((freq, i) => {
    const dur = params.durs[i] ?? 0.12;
    const vol = params.vol ?? 0.22;
    const partials: [number, number, number][] = [
      [1.0, vol, 5.0], [2.756, vol * 0.4, 9.0], [5.404, vol * 0.12, 15.0],
    ];
    partials.forEach(([ratio, amp, _decay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(amp, startTime + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(0.02, dur));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.02);
    });
    startTime += dur * 0.85;
  });
}

// ── Native sound assets ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STICKER_ASSETS: Record<StickerType, any> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Hopeful:     require('../assets/sounds/sticker_hopeful.wav'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Peaceful:    require('../assets/sounds/sticker_peaceful.wav'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Lonely:      require('../assets/sounds/sticker_lonely.wav'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Romantic:    require('../assets/sounds/sticker_romantic.wav'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Chaotic:     require('../assets/sounds/sticker_chaotic.wav'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Adventurous: require('../assets/sounds/sticker_adventurous.wav'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Dreamy:      require('../assets/sounds/sticker_dreamy.wav'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Soft:        require('../assets/sounds/sticker_soft.wav'),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadedSounds: Partial<Record<StickerType, any>> = {};

async function ensureLoaded(type: StickerType) {
  if (loadedSounds[type]) return loadedSounds[type];
  try {
    const { Audio } = await import('expo-av');
    const { sound } = await Audio.Sound.createAsync(STICKER_ASSETS[type], { volume: 0.55 });
    loadedSounds[type] = sound;
    return sound;
  } catch { return null; }
}

// ── Individual sticker button ─────────────────────────────────────────────────

function StickerBtn({
  sticker, onSelect,
}: {
  sticker: (typeof STICKERS)[number];
  onSelect: (type: StickerType) => void;
}) {
  const scale  = useRef(new Animated.Value(1)).current;
  const flyY   = useRef(new Animated.Value(0)).current;
  const flyOp  = useRef(new Animated.Value(0)).current;

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flyY.setValue(0);
    flyOp.setValue(1);
    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.55, tension: 320, friction: 5, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(flyY, { toValue: -36, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(flyOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
    onSelect(sticker.type as StickerType);
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.stickerBtn}>
      <View style={styles.stickerOrbWrap}>
        {/* Fly-up ghost emoji */}
        <Animated.Text
          style={[styles.stickerEmoji, styles.stickerGhost, { transform: [{ translateY: flyY }], opacity: flyOp }]}
          pointerEvents="none"
        >
          {sticker.emoji}
        </Animated.Text>
        {/* Main emoji */}
        <Animated.View style={[
          styles.stickerOrb,
          { borderColor: sticker.color + '55', backgroundColor: sticker.bg + 'CC' },
          { transform: [{ scale }] },
        ]}>
          <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
        </Animated.View>
      </View>
      <Text style={[styles.stickerLabel, { color: sticker.color }]} numberOfLines={1}>
        {sticker.type}
      </Text>
    </TouchableOpacity>
  );
}

// ── Picker component ───────────────────────────────────────────────────────────

interface VibeStickerPickerProps {
  visible:  boolean;
  onSelect: (stickerType: StickerType) => void;
  onClose:  () => void;
}

export function VibeStickerPicker({ visible, onSelect, onClose }: VibeStickerPickerProps) {
  const slideAnim    = useRef(new Animated.Value(0)).current;
  const [sent, setSent]         = useState<StickerType | null>(null);
  const { soundEnabled }        = useSound();
  const sentTimeoutRef          = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setSent(null);
      Animated.spring(slideAnim, {
        toValue: 1, tension: 75, friction: 9, useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true,
      }).start(() => setSent(null));
    }
    return () => { if (sentTimeoutRef.current) clearTimeout(sentTimeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSelect = useCallback((type: StickerType) => {
    setSent(type);

    // Play sound
    if (soundEnabled) {
      if (Platform.OS === 'web') {
        playWebStickerSound(type);
      } else {
        ensureLoaded(type).then(sound => {
          sound?.setPositionAsync(0).then(() => sound.playAsync()).catch(() => null);
        });
      }
    }

    onSelect(type);
    sentTimeoutRef.current = setTimeout(onClose, 1600);
  }, [soundEnabled, onSelect, onClose]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const opacity    = slideAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 1] });

  return (
    <Animated.View style={[styles.picker, { opacity, transform: [{ translateY }] }]}>
      {/* Header */}
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Send a vibe ✦</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={14}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {sent ? (
        /* Confirmation state */
        <View style={styles.sentRow}>
          <Text style={styles.sentEmoji}>{STICKERS.find(s => s.type === sent)?.emoji}</Text>
          <View>
            <Text style={styles.sentTitle}>{sent} vibe sent!</Text>
            <Text style={styles.sentSub}>They'll feel it ✦</Text>
          </View>
        </View>
      ) : (
        /* Sticker grid */
        <View style={styles.stickerGrid}>
          {STICKERS.map(s => (
            <StickerBtn key={s.type} sticker={s} onSelect={handleSelect} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  picker: {
    borderTopWidth:    1,
    borderTopColor:    'rgba(107,91,149,0.25)',
    backgroundColor:   'rgba(14,10,28,0.96)',
    paddingTop:        10,
    paddingBottom:     14,
    paddingHorizontal: 10,
  },

  pickerHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   10,
    paddingHorizontal: 4,
  },
  pickerTitle: {
    fontSize:      11,
    fontFamily:    'Satoshi-Bold',
    color:         'rgba(200,184,232,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 22, height: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: {
    fontSize:   12,
    color:      'rgba(200,184,232,0.4)',
    fontFamily: 'Satoshi-Bold',
  },

  stickerGrid: {
    flexDirection:  'row',
    justifyContent: 'space-around',
    paddingHorizontal: 2,
  },

  stickerBtn: {
    alignItems: 'center',
    gap:         3,
    minWidth:    36,
  },
  stickerOrbWrap: {
    width:          44,
    height:         52,
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  stickerGhost: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    textAlign: 'center',
    fontSize:  26,
    opacity:   0,
  },
  stickerOrb: {
    width:          40,
    height:         40,
    borderRadius:   20,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stickerEmoji: {
    fontSize: 22,
    textAlign: 'center',
  },
  stickerLabel: {
    fontSize:      8.5,
    fontFamily:    'Satoshi-Bold',
    letterSpacing: 0.3,
    textAlign:     'center',
  },

  sentRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            14,
    paddingVertical: 10,
  },
  sentEmoji: {
    fontSize: 36,
  },
  sentTitle: {
    fontSize:   14,
    fontFamily: 'Satoshi-Bold',
    color:      '#E8E0FF',
  },
  sentSub: {
    fontSize:   11,
    fontFamily: 'Satoshi-Regular',
    color:      'rgba(200,184,232,0.5)',
    marginTop:   2,
  },
});
