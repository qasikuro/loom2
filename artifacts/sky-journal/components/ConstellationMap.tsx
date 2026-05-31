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
}

const STARS: StarDef[] = [
  { key: 'social',   label: 'Social',   icon: 'users',    color: '#78C8A8', xPct: 20, yPct: 16, criterion: 'Follow 5 · Receive 5 stickers' },
  { key: 'memory',   label: 'Memory',   icon: 'bookmark', color: '#9878C8', xPct: 78, yPct: 16, criterion: '10 journal entries · 5 saves received' },
  { key: 'quiet',    label: 'Quiet',    icon: 'moon',     color: '#7890C8', xPct: 11, yPct: 60, criterion: '7-day journal streak' },
  { key: 'creative', label: 'Creative', icon: 'feather',  color: '#C87AA8', xPct: 86, yPct: 60, criterion: '5 stories · 1 witnessed ×3' },
  { key: 'helping',  label: 'Helping',  icon: 'star',     color: '#C8A84B', xPct: 48, yPct: 84, criterion: 'Send 20 stickers' },
  { key: 'seasonal', label: 'Seasonal', icon: 'wind',     color: '#68B8B0', xPct: 48, yPct: 40, criterion: 'Unlock 3 other stars' },
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
  star:      StarDef;
  unlocked:  boolean;
  count:     number;
  threshold: number;
  onPress:   () => void;
  cW:        number;
  cH:        number;
}

function StarNode({ star, unlocked, count, threshold, onPress, cW, cH }: StarNodeProps) {
  const cx = (star.xPct / 100) * cW;
  const cy = (star.yPct / 100) * cH;
  const progress = Math.min(1, count / threshold);

  return (
    <View style={{ position: 'absolute', left: cx - 18, top: cy - 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
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
    </View>
  );
}

interface ConstellationMapProps {
  state:        ConstellationState | null;
  onStarPress?: (key: string) => void;
}

export function ConstellationMap({ state, onStarPress }: ConstellationMapProps) {
  const [dims, setDims]           = useState({ w: 0, h: 0 });
  const [tooltip, setTooltip]     = useState<StarDef | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  }

  function handleStarPress(star: StarDef) {
    setTooltip(prev => prev?.key === star.key ? null : star);
    onStarPress?.(star.key);
  }

  const unlockedSet = new Set(state?.unlockedStars ?? []);

  // Count for each star type
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

  // Draw connector lines between two star positions
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

  return (
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
        {dims.w > 0 && STARS.map(star => (
          <StarNode
            key={star.key}
            star={star}
            unlocked={unlockedSet.has(star.key)}
            count={countFor(star.key)}
            threshold={thresholdFor(star.key)}
            onPress={() => handleStarPress(star)}
            cW={dims.w}
            cH={dims.h}
          />
        ))}
      </View>

      {/* Tooltip */}
      {tooltipStar && (
        <View style={[styles.tooltip, { borderColor: `${tooltipStar.color}35`, backgroundColor: 'rgba(8,6,20,0.92)' }]}>
          <View style={styles.tooltipHeader}>
            <Icon name={tooltipStar.icon as any} size={14} color={tooltipStar.color} />
            <Text style={[styles.tooltipTitle, { color: tooltipStar.color }]}>{tooltipStar.label} Star</Text>
            <View style={[styles.tooltipBadge, unlockedSet.has(tooltipStar.key) && { backgroundColor: `${tooltipStar.color}22`, borderColor: `${tooltipStar.color}40` }]}>
              <Text style={[styles.tooltipBadgeText, { color: unlockedSet.has(tooltipStar.key) ? tooltipStar.color : 'rgba(200,184,232,0.40)' }]}>
                {unlockedSet.has(tooltipStar.key) ? '✦ Unlocked' : 'Locked'}
              </Text>
            </View>
          </View>
          <Text style={styles.tooltipCrit}>{tooltipStar.criterion}</Text>
          <Text style={styles.tooltipProgress}>
            {countFor(tooltipStar.key)} / {thresholdFor(tooltipStar.key)}
          </Text>
        </View>
      )}
    </View>
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
  tooltip: {
    position: 'absolute', bottom: 10, left: 12, right: 12,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    gap: 4,
  },
  tooltipHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tooltipTitle: { fontSize: 13, fontFamily: 'Satoshi-Bold', flex: 1 },
  tooltipBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tooltipBadgeText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  tooltipCrit:      { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)', fontStyle: 'italic' },
  tooltipProgress:  { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.70)' },
});
