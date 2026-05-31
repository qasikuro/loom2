import { Icon } from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ConstellationState {
  socialCount:   number;
  memoryCount:   number;
  quietStreak:   number;
  helpingCount:  number;
  creativeCount: number;
  seasonalCount: number;
  unlockedStars: string[];
  activeTitle:   string | null;
}

interface StarDef {
  key:       string;
  label:     string;
  icon:      string;
  color:     string;
  xPct:      number;  // 0–100 of container width
  yPct:      number;  // 0–100 of container height
  criterion: string;
  unit:      string;  // human-readable unit for progress label
  description: string;
}

const STARS: StarDef[] = [
  { key: 'social',   label: 'Social',   icon: 'users',    color: '#78C8A8', xPct: 20, yPct: 16, criterion: 'Follow 5 · Receive 5 stickers',       unit: 'follows',  description: 'Build connections with fellow dreamers of the sky.' },
  { key: 'memory',   label: 'Memory',   icon: 'bookmark', color: '#9878C8', xPct: 78, yPct: 16, criterion: '10 journal entries · 5 saves received', unit: 'entries',  description: 'Preserve your memories and let others hold them.' },
  { key: 'quiet',    label: 'Quiet',    icon: 'moon',     color: '#7890C8', xPct: 11, yPct: 60, criterion: '7-day journal streak',                  unit: 'days',     description: 'Show up every day, even when the words are few.' },
  { key: 'creative', label: 'Creative', icon: 'feather',  color: '#C87AA8', xPct: 86, yPct: 60, criterion: '5 stories · 1 witnessed ×3',            unit: 'stories',  description: 'Tell your story. Let the sky be your canvas.' },
  { key: 'helping',  label: 'Helping',  icon: 'star',     color: '#C8A84B', xPct: 48, yPct: 84, criterion: 'Send 20 stickers',                      unit: 'stickers', description: 'Scatter light across the stories of others.' },
  { key: 'seasonal', label: 'Seasonal', icon: 'wind',     color: '#68B8B0', xPct: 48, yPct: 40, criterion: 'Unlock 3 other stars',                  unit: 'stars',    description: 'A rare star that blooms when your constellation grows.' },
];

// Lines connecting star pairs (drawn when both are unlocked)
const LINES: [string, string][] = [
  ['social',   'seasonal'],
  ['memory',   'seasonal'],
  ['quiet',    'seasonal'],
  ['creative', 'seasonal'],
  ['helping',  'seasonal'],
  ['social',   'memory'],
];

// Pulsing glow ring for unlocked stars
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

  // Per-star entrance animation
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

      {/* Progress ring — thin arc (just a border ring approximation) */}
      {!unlocked && progress > 0 && (
        <View pointerEvents="none" style={{
          position: 'absolute', inset: -3, borderRadius: 21,
          borderWidth: 1.5, borderColor: `${star.color}45`,
          borderTopColor: star.color,
          transform: [{ rotate: `${-90 + progress * 360}deg` }],
        }} />
      )}

      {/* Label below */}
      <Text style={[
        styles.starLabel,
        { color: unlocked ? star.color : 'rgba(200,184,232,0.30)' },
      ]}>{star.label}</Text>
    </Animated.View>
  );
}

// Currency reward earned when each star unlocks
const STAR_UNLOCK_REWARDS: Record<string, string> = {
  social:   '✦ 20 Stars',
  memory:   '◇ 15 Memory Shards',
  quiet:    '◐ 10 Aura Energy',
  creative: '◈ 15 Aura Energy',
  helping:  '✦ 25 Stars',
  seasonal: '✦ 30 Stars',
};

const REWARD_COLORS: Record<string, string> = {
  social:   '#C8A84B',
  memory:   '#78B4DC',
  quiet:    '#9878C8',
  creative: '#9878C8',
  helping:  '#C8A84B',
  seasonal: '#C8A84B',
};

interface ConstellationMapProps {
  state:        ConstellationState | null;
  onStarPress?: (key: string) => void;
}

export function ConstellationMap({ state, onStarPress }: ConstellationMapProps) {
  const [dims, setDims]           = useState({ w: 0, h: 0 });
  const [tooltip, setTooltip]     = useState<StarDef | null>(null);
  const tooltipBarAnim            = useRef(new Animated.Value(0)).current;
  const tooltipSlideAnim          = useRef(new Animated.Value(16)).current;
  const tooltipFadeAnim           = useRef(new Animated.Value(0)).current;
  const enterAnim                 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onLayout(e: LayoutChangeEvent) {
    setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  }

  function handleStarPress(star: StarDef) {
    const closing = tooltip?.key === star.key;
    if (closing) {
      Animated.parallel([
        Animated.timing(tooltipFadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(tooltipSlideAnim, { toValue: 12, duration: 160, useNativeDriver: true }),
      ]).start(() => setTooltip(null));
    } else {
      setTooltip(star);
      tooltipBarAnim.setValue(0);
      tooltipSlideAnim.setValue(16);
      tooltipFadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(tooltipFadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(tooltipSlideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    }
    onStarPress?.(star.key);
  }

  // Animate tooltip bar when tooltip opens or switches star
  useEffect(() => {
    if (!tooltip) return;
    const key = tooltip.key;
    const clampedCur = (() => {
      if (!state) return 0;
      switch (key) {
        case 'social':   return Math.min(state.socialCount,   5);
        case 'memory':   return Math.min(state.memoryCount,   10);
        case 'quiet':    return Math.min(state.quietStreak,   7);
        case 'creative': return Math.min(state.creativeCount, 5);
        case 'helping':  return Math.min(state.helpingCount,  20);
        case 'seasonal': return Math.min(state.seasonalCount, 3);
        default: return 0;
      }
    })();
    const max = (() => {
      switch (key) {
        case 'social': return 5; case 'memory': return 10; case 'quiet': return 7;
        case 'creative': return 5; case 'helping': return 20; case 'seasonal': return 3;
        default: return 1;
      }
    })();
    const pct = Math.min(1, clampedCur / max);
    tooltipBarAnim.setValue(0);
    Animated.timing(tooltipBarAnim, {
      toValue: pct * 100,
      duration: 480,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [tooltip?.key]);

  const unlockedSet = new Set(state?.unlockedStars ?? []);

  function countFor(key: string): number {
    if (!state) return 0;
    switch (key) {
      case 'social':   return Math.min(state.socialCount,   5);
      case 'memory':   return Math.min(state.memoryCount,   10);
      case 'quiet':    return Math.min(state.quietStreak,   7);
      case 'creative': return Math.min(state.creativeCount, 5);
      case 'helping':  return Math.min(state.helpingCount,  20);
      case 'seasonal': return Math.min(state.seasonalCount, 3);
      default: return 0;
    }
  }

  function rawCountFor(key: string): number {
    if (!state) return 0;
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

  function thresholdFor(key: string): number {
    switch (key) {
      case 'social':   return 5;
      case 'memory':   return 10;
      case 'quiet':    return 7;
      case 'creative': return 5;
      case 'helping':  return 20;
      case 'seasonal': return 3;
      default: return 1;
    }
  }

  function renderLine(a: StarDef, b: StarDef, key: string) {
    if (dims.w === 0 || dims.h === 0) return null;
    const aUnlocked = unlockedSet.has(a.key);
    const bUnlocked = unlockedSet.has(b.key);
    if (!aUnlocked || !bUnlocked) return null;

    const ax = (a.xPct / 100) * dims.w;
    const ay = (a.yPct / 100) * dims.h;
    const bx = (b.xPct / 100) * dims.w;
    const by = (b.yPct / 100) * dims.h;
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle  = Math.atan2(dy, dx) * 180 / Math.PI;

    return (
      <View
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
        }}
      />
    );
  }

  const tooltipStar = tooltip ? STARS.find(s => s.key === tooltip.key) : null;
  const slideY = enterAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={{ opacity: enterAnim, transform: [{ translateY: slideY }] }}>
    <View style={styles.container}>
      {/* Night sky background */}
      <LinearGradient
        colors={['#08061A', '#0E0824', '#06040E']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      {/* Starfield dots */}
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

      {/* Connector lines + star nodes */}
      <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
        {dims.w > 0 && LINES.map(([ak, bk]) => {
          const a = STARS.find(s => s.key === ak)!;
          const b = STARS.find(s => s.key === bk)!;
          return renderLine(a, b, `${ak}-${bk}`);
        })}
        {dims.w > 0 && STARS.map((star, idx) => (
          <StarNode
            key={star.key}
            star={star}
            unlocked={unlockedSet.has(star.key)}
            count={countFor(star.key)}
            threshold={thresholdFor(star.key)}
            onPress={() => handleStarPress(star)}
            cW={dims.w}
            cH={dims.h}
            enterDelay={180 + idx * 85}
          />
        ))}
      </View>

      {/* Star detail panel */}
      {tooltipStar && (() => {
        const isUnlocked = unlockedSet.has(tooltipStar.key);
        const rawCur     = rawCountFor(tooltipStar.key);
        const max        = thresholdFor(tooltipStar.key);
        const rewardColor = REWARD_COLORS[tooltipStar.key] ?? '#C8A84B';

        return (
          <Animated.View
            style={[
              styles.detailPanel,
              {
                borderColor: `${tooltipStar.color}40`,
                backgroundColor: 'rgba(6,4,18,0.95)',
                opacity: tooltipFadeAnim,
                transform: [{ translateY: tooltipSlideAnim }],
              },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.panelHandle} />

            {/* Header row */}
            <View style={styles.panelHeader}>
              <View style={[styles.panelIconCircle, { backgroundColor: `${tooltipStar.color}18`, borderColor: `${tooltipStar.color}35` }]}>
                <Icon name={tooltipStar.icon as any} size={15} color={tooltipStar.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.panelTitle, { color: tooltipStar.color }]}>
                  {tooltipStar.label} Star
                </Text>
                <Text style={styles.panelDesc} numberOfLines={2}>
                  {tooltipStar.description}
                </Text>
              </View>
              <View style={[styles.statusBadge, isUnlocked
                ? { backgroundColor: `${tooltipStar.color}18`, borderColor: `${tooltipStar.color}40` }
                : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)' }
              ]}>
                <Text style={[styles.statusBadgeText, { color: isUnlocked ? tooltipStar.color : 'rgba(200,184,232,0.40)' }]}>
                  {isUnlocked ? '✦ Earned' : 'Locked'}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.panelDivider, { backgroundColor: `${tooltipStar.color}20` }]} />

            {/* Criterion */}
            <Text style={styles.panelCriterion}>{tooltipStar.criterion}</Text>

            {/* Reward chip row */}
            <View style={styles.panelRewardRow}>
              <Text style={styles.panelRewardLabel}>{isUnlocked ? 'EARNED' : 'UNLOCKS'}</Text>
              <View style={[styles.panelRewardChip, { backgroundColor: `${rewardColor}14`, borderColor: `${rewardColor}30` }]}>
                <Text style={[styles.panelRewardValue, { color: rewardColor }]}>
                  {STAR_UNLOCK_REWARDS[tooltipStar.key]}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.panelProgressRow}>
              <View style={styles.panelBarTrack}>
                <Animated.View style={[
                  styles.panelBarFill,
                  {
                    width: tooltipBarAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) as any,
                    backgroundColor: tooltipStar.color,
                  },
                  isUnlocked && { opacity: 0.65 },
                ]} />
              </View>
              <Text style={[styles.panelProgressText, { color: isUnlocked ? tooltipStar.color : 'rgba(200,184,232,0.65)' }]}>
                {rawCur} / {max} {tooltipStar.unit}
              </Text>
            </View>
          </Animated.View>
        );
      })()}
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

  // ── Star detail panel ────────────────────────────────────────────────────
  detailPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12,
    gap: 6,
  },
  panelHandle: {
    width: 32, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(200,184,232,0.20)',
    alignSelf: 'center', marginBottom: 4,
  },
  panelHeader:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  panelIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, borderWidth: 1,
  },
  panelTitle:      { fontSize: 13, fontFamily: 'Satoshi-Bold', lineHeight: 18 },
  panelDesc:       { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.45)', lineHeight: 14, marginTop: 1 },
  statusBadge:     {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, flexShrink: 0,
  },
  statusBadgeText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  panelDivider:    { height: 1, marginVertical: 2 },
  panelCriterion:  { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.50)', fontStyle: 'italic', lineHeight: 15 },
  panelRewardRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelRewardLabel:{ fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.7, color: 'rgba(200,184,232,0.32)' },
  panelRewardChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 8, borderWidth: 1,
  },
  panelRewardValue:{ fontSize: 11, fontFamily: 'Satoshi-Bold' },
  panelProgressRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelBarTrack:   { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  panelBarFill:    { height: '100%', borderRadius: 3 },
  panelProgressText: { fontSize: 11, fontFamily: 'Satoshi-Bold', minWidth: 90, textAlign: 'right', color: 'rgba(200,184,232,0.65)' },
});
