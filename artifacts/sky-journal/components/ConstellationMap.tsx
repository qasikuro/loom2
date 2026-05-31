import { Icon } from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ConstellationState {
  socialCount:     number;
  memoryCount:     number;
  quietStreak:     number;
  helpingCount:    number;
  creativeCount:   number;
  seasonalCount:   number;
  unlockedStars:   string[];
  starUnlockDates: Record<string, string>;
  activeTitle:     string | null;
  newlyUnlocked?:  string[];
}

export interface StarDef {
  key:         string;
  label:       string;
  icon:        string;
  color:       string;
  xPct:        number;
  yPct:        number;
  criterion:   string;
  unit:        string;
  description: string;
}

export const CONSTELLATION_STARS: StarDef[] = [
  { key: 'social',   label: 'Social',   icon: 'users',    color: '#78C8A8', xPct: 20, yPct: 16, criterion: 'Follow 5 · Receive 5 stickers',       unit: 'follows',  description: 'Build connections with fellow dreamers of the sky.' },
  { key: 'memory',   label: 'Memory',   icon: 'bookmark', color: '#9878C8', xPct: 78, yPct: 16, criterion: '10 journal entries · 5 saves received', unit: 'entries',  description: 'Preserve your memories and let others hold them.' },
  { key: 'quiet',    label: 'Quiet',    icon: 'moon',     color: '#7890C8', xPct: 11, yPct: 60, criterion: '7-day journal streak',                  unit: 'days',     description: 'Show up every day, even when the words are few.' },
  { key: 'creative', label: 'Creative', icon: 'feather',  color: '#C87AA8', xPct: 86, yPct: 60, criterion: '5 stories · 1 witnessed ×3',            unit: 'stories',  description: 'Tell your story. Let the sky be your canvas.' },
  { key: 'helping',  label: 'Helping',  icon: 'star',     color: '#C8A84B', xPct: 48, yPct: 84, criterion: 'Send 20 stickers',                      unit: 'stickers', description: 'Scatter light across the stories of others.' },
  { key: 'seasonal', label: 'Seasonal', icon: 'wind',     color: '#68B8B0', xPct: 48, yPct: 40, criterion: 'Unlock 3 other stars',                  unit: 'stars',    description: 'A rare star that blooms when your constellation grows.' },
];

export const STAR_THRESHOLDS: Record<string, number> = {
  social: 5, memory: 10, quiet: 7, creative: 5, helping: 20, seasonal: 3,
};

export function countForStar(key: string, state: ConstellationState): number {
  switch (key) {
    case 'social':   return state.socialCount;
    case 'memory':   return state.memoryCount;
    case 'quiet':    return state.quietStreak;
    case 'creative': return state.creativeCount;
    case 'helping':  return state.helpingCount;
    case 'seasonal': return state.seasonalCount;
    default: return 0;
  }
}

const LINES: [string, string][] = [
  ['social',   'seasonal'],
  ['memory',   'seasonal'],
  ['quiet',    'seasonal'],
  ['creative', 'seasonal'],
  ['helping',  'seasonal'],
  ['social',   'memory'],
];

function PulseRing({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', inset: -7, borderRadius: 22,
      borderWidth: 1.5, borderColor: color,
      opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.55, 0.10] }),
      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
    }} />
  );
}

interface StarNodeProps {
  star:       StarDef;
  unlocked:   boolean;
  count:      number;
  threshold:  number;
  onPress:    () => void;
  cW:         number;
  cH:         number;
  enterDelay: number;
}

function StarNode({ star, unlocked, count, threshold, onPress, cW, cH, enterDelay }: StarNodeProps) {
  const cx = (star.xPct / 100) * cW;
  const cy = (star.yPct / 100) * cH;
  const progress = Math.min(1, count / threshold);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: enterDelay,
      tension: 90,
      friction: 11,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      left: cx - 18, top: cy - 18,
      width: 36, height: 36,
      alignItems: 'center', justifyContent: 'center',
      transform: [{ scale: scaleAnim }],
      opacity: scaleAnim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.7, 1] }),
    }}>
      {unlocked && <PulseRing color={star.color} />}
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.starBtn,
          unlocked
            ? { backgroundColor: `${star.color}22`, borderColor: `${star.color}70` }
            : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' },
        ]}
        activeOpacity={0.8}
      >
        <Icon
          name={star.icon as any}
          size={13}
          color={unlocked ? star.color : 'rgba(255,255,255,0.20)'}
        />
      </TouchableOpacity>

      {!unlocked && progress > 0 && (
        <View pointerEvents="none" style={{
          position: 'absolute', inset: -3, borderRadius: 21,
          borderWidth: 1.5, borderColor: `${star.color}45`,
          borderTopColor: star.color,
          transform: [{ rotate: `${-90 + progress * 360}deg` }],
        }} />
      )}

      <Text style={[
        styles.starLabel,
        { color: unlocked ? star.color : 'rgba(200,184,232,0.30)' },
      ]}>{star.label}</Text>
    </Animated.View>
  );
}

interface ConstellationMapProps {
  state:        ConstellationState | null;
  onStarPress?: (key: string) => void;
  animKey?:     number;
}

export function ConstellationMap({ state, onStarPress, animKey }: ConstellationMapProps) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const enterAnim       = useRef(new Animated.Value(0)).current;
  const lineAnim        = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset before replaying so tab-return triggers the full entrance again
    enterAnim.setValue(0);
    lineAnim.setValue(0);
    // Last star delay: 180 + (6-1)*85 = 605 ms; spring settles ~400 ms later → lines at ~950 ms
    Animated.sequence([
      Animated.timing(enterAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(250),
      Animated.timing(lineAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);

  function onLayout(e: LayoutChangeEvent) {
    setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  }

  const unlockedSet = new Set(state?.unlockedStars ?? []);

  function countFor(key: string): number {
    if (!state) return 0;
    return Math.min(countForStar(key, state), STAR_THRESHOLDS[key] ?? 1);
  }

  function renderLine(a: StarDef, b: StarDef, key: string) {
    if (dims.w === 0 || dims.h === 0) return null;
    if (!unlockedSet.has(a.key) || !unlockedSet.has(b.key)) return null;

    const ax = (a.xPct / 100) * dims.w;
    const ay = (a.yPct / 100) * dims.h;
    const bx = (b.xPct / 100) * dims.w;
    const by = (b.yPct / 100) * dims.h;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle  = Math.atan2(dy, dx) * 180 / Math.PI;

    return (
      <Animated.View
        key={key}
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: length,
          height: 1,
          left: ax,
          top:  ay,
          backgroundColor: 'rgba(200,184,232,0.22)',
          transformOrigin: '0 0',
          transform: [{ rotate: `${angle}deg` }],
          opacity: lineAnim,
        }}
      />
    );
  }

  const slideY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={{ opacity: enterAnim, transform: [{ translateY: slideY }] }}>
    <View style={styles.container}>
      <LinearGradient
        colors={['#08061A', '#0E0824', '#06040E']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      {[
        { x: 8,  y: 12, s: 1.5, o: 0.35 },
        { x: 35, y: 8,  s: 1,   o: 0.25 },
        { x: 60, y: 5,  s: 2,   o: 0.30 },
        { x: 92, y: 10, s: 1.5, o: 0.28 },
        { x: 5,  y: 35, s: 1,   o: 0.20 },
        { x: 68, y: 30, s: 1,   o: 0.22 },
        { x: 94, y: 35, s: 2,   o: 0.25 },
        { x: 28, y: 72, s: 1.5, o: 0.18 },
        { x: 72, y: 68, s: 1,   o: 0.20 },
        { x: 90, y: 78, s: 1.5, o: 0.22 },
      ].map((dot, i) => (
        <View key={i} pointerEvents="none" style={{
          position: 'absolute',
          left: `${dot.x}%` as any,
          top:  `${dot.y}%` as any,
          width: dot.s, height: dot.s, borderRadius: dot.s,
          backgroundColor: '#C8B8E8', opacity: dot.o,
        }} />
      ))}

      <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
        {dims.w > 0 && LINES.map(([ak, bk]) => {
          const a = CONSTELLATION_STARS.find(s => s.key === ak)!;
          const b = CONSTELLATION_STARS.find(s => s.key === bk)!;
          return renderLine(a, b, `${ak}-${bk}`);
        })}
        {dims.w > 0 && CONSTELLATION_STARS.map((star, idx) => (
          <StarNode
            key={star.key}
            star={star}
            unlocked={unlockedSet.has(star.key)}
            count={countFor(star.key)}
            threshold={STAR_THRESHOLDS[star.key] ?? 1}
            onPress={() => onStarPress?.(star.key)}
            cW={dims.w}
            cH={dims.h}
            enterDelay={180 + idx * 85}
          />
        ))}
      </View>
    </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(107,91,149,0.20)',
  },
  starBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  starLabel: {
    position: 'absolute',
    top: 38,
    fontSize: 8,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.3,
    textAlign: 'center',
    width: 52,
    left: -8,
  },
});
