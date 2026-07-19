import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

// ── Deterministic RNG (stable per seed, no Math.random) ───────────────────────
function rng(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ── Effect catalogue ──────────────────────────────────────────────────────────
export interface EffectDef {
  particles:   string[];
  count:       number;
  mode:        'rise' | 'fall' | 'drift' | 'glow';
  fontSize:    number;
  colors?:     string[];
  speedMs:     [number, number];
  xSwingPct:   number;
  yTravelPct:  number;
  corners?:    { pos: 'tl' | 'tr' | 'bl' | 'br'; emoji: string; size: number }[];
  overlayTint?: string;
}

const EFFECTS: Record<string, EffectDef> = {
  effect_butterfly: {
    particles:  ['🦋', '🦋', '🦋', '🦋'],
    count:      6,
    mode:       'drift',
    fontSize:   26,
    speedMs:    [3000, 5200],
    xSwingPct:  0.14,
    yTravelPct: 0.18,
  },
  effect_hearts: {
    particles:  ['💜', '💗', '🤍', '💙', '🩷', '💜'],
    count:      9,
    mode:       'rise',
    fontSize:   20,
    speedMs:    [2400, 4000],
    xSwingPct:  0.10,
    yTravelPct: 0.65,
  },
  effect_fire: {
    particles:  ['🔥', '✨', '🔥', '💫', '🔥'],
    count:      11,
    mode:       'rise',
    fontSize:   18,
    speedMs:    [1100, 2100],
    xSwingPct:  0.06,
    yTravelPct: 0.55,
  },
  effect_blossom: {
    particles:  ['🌸', '🌺', '🌷', '🌸', '🌼'],
    count:      9,
    mode:       'fall',
    fontSize:   22,
    speedMs:    [3600, 5800],
    xSwingPct:  0.18,
    yTravelPct: 0.90,
  },
  effect_leaves: {
    particles:  ['🍃', '🍂', '🍁', '🌿', '🍃'],
    count:      8,
    mode:       'fall',
    fontSize:   20,
    speedMs:    [4000, 6400],
    xSwingPct:  0.22,
    yTravelPct: 0.95,
  },
  effect_fireflies: {
    particles:  ['✦', '✧', '⋆', '✦', '✧'],
    count:      14,
    mode:       'glow',
    fontSize:   16,
    colors:     ['#E8D44A', '#F0E060', '#D8C840', '#F4EC70', '#C8D860'],
    speedMs:    [2000, 4000],
    xSwingPct:  0.20,
    yTravelPct: 0.22,
  },
};

// ── Register custom effects from DB (called by AppContext) ────────────────────
export function registerCustomEffect(id: string, def: EffectDef) {
  EFFECTS[id] = def;
}

export function registerCustomEffects(map: Record<string, EffectDef>) {
  Object.assign(EFFECTS, map);
}

// ── Corner accent component ───────────────────────────────────────────────────

function CornerAccent({
  pos, emoji, size,
}: {
  pos:    'tl' | 'tr' | 'bl' | 'br';
  emoji:  string;
  size:   number;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0.95, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top    = pos === 'tl' || pos === 'tr' ? -size * 0.12 : undefined;
  const bottom = pos === 'bl' || pos === 'br' ? -size * 0.12 : undefined;
  const left   = pos === 'tl' || pos === 'bl' ? -size * 0.12 : undefined;
  const right  = pos === 'tr' || pos === 'br' ? -size * 0.12 : undefined;

  // Mirror horizontally for right-side corners to look natural
  const scaleX = pos === 'tr' || pos === 'br' ? -1 : 1;
  const scaleY = pos === 'bl' || pos === 'br' ? -1 : 1;

  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        top, bottom, left, right,
        fontSize: size,
        lineHeight: size + 4,
        transform: [{ scale: pulse }, { scaleX }, { scaleY }],
        zIndex: 25,
        opacity: 0.88,
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ── Single particle ────────────────────────────────────────────────────────────

interface ParticleProps {
  def:    EffectDef;
  idx:    number;
  width:  number;
  height: number;
}

function Particle({ def, idx, width, height }: ParticleProps) {
  const s      = (n: number) => rng(idx * 37 + n);
  const speedMs = def.speedMs[0] + s(1) * (def.speedMs[1] - def.speedMs[0]);
  const delay   = idx * 380 + s(2) * 600;

  const startXPct = s(3);
  const startYPct = def.mode === 'rise'  ? 0.55 + s(4) * 0.40 :
                    def.mode === 'fall'  ? s(4) * 0.15 :
                    def.mode === 'glow'  ? s(4) :
                    s(4);

  const startX = startXPct * Math.max(0, width  - 30);
  const startY = startYPct * Math.max(0, height - 30);

  const xSwing  = def.xSwingPct  * width  * (s(5) * 0.6 + 0.7);
  const yTravel = def.yTravelPct * height * (s(6) * 0.4 + 0.8);

  const tx      = useRef(new Animated.Value(0)).current;
  const ty      = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate  = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.85)).current;

  const emoji = def.particles[idx % def.particles.length];
  const color = def.colors ? def.colors[idx % def.colors.length] : undefined;

  useEffect(() => {
    if (width === 0 || height === 0) return;
    let running = true;
    const timer = setTimeout(() => {
      if (!running) return;

      Animated.loop(Animated.sequence([
        Animated.timing(tx, { toValue:  xSwing, duration: speedMs * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(tx, { toValue: -xSwing, duration: speedMs * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();

      if (def.mode === 'rise') {
        Animated.loop(Animated.sequence([
          Animated.timing(ty, { toValue: -yTravel, duration: speedMs, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(ty, { toValue: 0,        duration: 0,        useNativeDriver: false }),
        ])).start();
      } else if (def.mode === 'fall') {
        Animated.loop(Animated.sequence([
          Animated.timing(ty, { toValue: yTravel, duration: speedMs, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(ty, { toValue: 0,       duration: 0,       useNativeDriver: false }),
        ])).start();
      } else if (def.mode === 'glow') {
        Animated.loop(Animated.sequence([
          Animated.timing(ty, { toValue: -yTravel, duration: speedMs * 0.55, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(ty, { toValue:  yTravel, duration: speedMs * 0.55, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])).start();
      } else {
        Animated.loop(Animated.sequence([
          Animated.timing(ty, { toValue: -yTravel, duration: speedMs * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(ty, { toValue:  yTravel, duration: speedMs * 0.5, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])).start();
      }

      const fadeInDur  = speedMs * 0.16;
      const holdDur    = speedMs * 0.58;
      const fadeOutDur = speedMs * 0.26;

      if (def.mode === 'glow') {
        Animated.loop(Animated.sequence([
          Animated.timing(opacity, { toValue: 1.0,  duration: speedMs * 0.40, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0.08, duration: speedMs * 0.60, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])).start();
      } else {
        Animated.loop(Animated.sequence([
          Animated.timing(opacity, { toValue: 0.95, duration: fadeInDur,  useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0.95, duration: holdDur,    useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0,    duration: fadeOutDur, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0,    duration: 0,          useNativeDriver: false }),
        ])).start();
      }

      if (def.mode === 'fall' || def.mode === 'drift') {
        Animated.loop(
          Animated.timing(rotate, { toValue: 1, duration: speedMs * (1 + s(7) * 0.8), easing: Easing.linear, useNativeDriver: false })
        ).start();
      }

      Animated.loop(Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration: speedMs * 0.48, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(scale, { toValue: 0.80, duration: speedMs * 0.52, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
    }, delay);

    return () => { running = false; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  const rotDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: startX, top: startY, opacity, transform: [{ translateX: tx }, { translateY: ty }, { rotate: rotDeg }, { scale }] }}
    >
      <Text style={{ fontSize: def.fontSize, color: color ?? undefined, lineHeight: def.fontSize + 4 }}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

// ── Canvas ─────────────────────────────────────────────────────────────────────

function EffectCanvas({ def, width, height }: { def: EffectDef; width: number; height: number }) {
  return (
    <>
      {/* Overlay tint */}
      {def.overlayTint && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: def.overlayTint, zIndex: 18 }]} />
      )}

      {/* Corner accents */}
      {def.corners?.map((c, i) => (
        <CornerAccent key={i} pos={c.pos} emoji={c.emoji} size={c.size} />
      ))}

      {/* Particles */}
      {Array.from({ length: def.count }, (_, i) => (
        <Particle key={i} def={def} idx={i} width={width} height={height} />
      ))}
    </>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function ProfileEffect({ effectId }: { effectId: string | undefined }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  if (!effectId) return null;
  const def = EFFECTS[effectId];
  if (!def) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.wrap]}
      pointerEvents="none"
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setDims(prev => prev?.w === width && prev?.h === height ? prev : { w: width, h: height });
      }}
    >
      {dims && <EffectCanvas def={def} width={dims.w} height={dims.h} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 20, overflow: 'hidden' },
});
