import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

type VibeMode = 'float' | 'twinkle' | 'sparkle';

interface VibeDef {
  symbol:        string;
  color:         string;
  count:         number;
  minSize:       number;
  maxSize:       number;
  durationRange: [number, number];
  mode:          VibeMode;
  maxOpacity:    number;
  label:         string;
  desc:          string;
}

export const VIBE_DEFS: Record<string, VibeDef> = {
  romantic:    { symbol: '♡', color: '#FF89B0', count: 10, minSize: 13, maxSize: 27, durationRange: [3500, 5500],  mode: 'float',   maxOpacity: 0.88, label: 'Romantic',    desc: 'Hearts drift above your look' },
  happy:       { symbol: '✦', color: '#FFD86F', count: 14, minSize: 8,  maxSize: 18, durationRange: [1200, 2800],  mode: 'sparkle', maxOpacity: 0.95, label: 'Happy',       desc: 'Sparkles burst around you' },
  dark:        { symbol: '◉', color: '#7050A8', count: 8,  minSize: 22, maxSize: 44, durationRange: [7000, 11000], mode: 'float',   maxOpacity: 0.22, label: 'Dark',        desc: 'Shadows drift and linger' },
  mythical:    { symbol: '✧', color: '#B090FF', count: 12, minSize: 8,  maxSize: 22, durationRange: [1800, 3800],  mode: 'twinkle', maxOpacity: 0.90, label: 'Mythical',    desc: 'Constellation stars appear' },
  dreamy:      { symbol: '○', color: '#B0D8FF', count: 9,  minSize: 14, maxSize: 30, durationRange: [5000, 8000],  mode: 'float',   maxOpacity: 0.52, label: 'Dreamy',      desc: 'Soft orbs float through' },
  ethereal:    { symbol: '◇', color: '#70FFE0', count: 10, minSize: 9,  maxSize: 20, durationRange: [2000, 4200],  mode: 'twinkle', maxOpacity: 0.85, label: 'Ethereal',    desc: 'Light wisps shimmer' },
  cozy:        { symbol: '·', color: '#FFB840', count: 18, minSize: 6,  maxSize: 15, durationRange: [1600, 3400],  mode: 'sparkle', maxOpacity: 0.90, label: 'Cozy',        desc: 'Warm embers glow' },
  adventurous: { symbol: '◈', color: '#70D090', count: 8,  minSize: 11, maxSize: 23, durationRange: [3200, 5500],  mode: 'float',   maxOpacity: 0.82, label: 'Adventurous', desc: 'Wind-caught symbols drift' },
};

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

interface Particle {
  id:          number;
  x:           number;
  startY:      number;
  yAnim:       Animated.Value;
  opacityAnim: Animated.Value;
  scaleAnim:   Animated.Value;
  delay:       number;
  duration:    number;
  def:         VibeDef;
  size:        number;
}

function buildParticles(def: VibeDef): Particle[] {
  return Array.from({ length: def.count }, (_, i) => ({
    id:          i,
    x:           rnd(0.04, 0.90) * SW,
    startY:      rnd(0.15, 0.85) * SH,
    yAnim:       new Animated.Value(0),
    opacityAnim: new Animated.Value(0),
    scaleAnim:   new Animated.Value(rnd(0.6, 1.2)),
    delay:       Math.floor(rnd(0, 4500)),
    duration:    rnd(def.durationRange[0], def.durationRange[1]),
    def,
    size:        rnd(def.minSize, def.maxSize),
  }));
}

function startFloat(p: Particle) {
  const travel = rnd(90, 230);
  const loop = () => {
    p.yAnim.setValue(0);
    p.opacityAnim.setValue(0);
    Animated.sequence([
      Animated.delay(p.delay),
      Animated.parallel([
        Animated.timing(p.yAnim, {
          toValue: -travel, duration: p.duration, useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(p.opacityAnim, { toValue: p.def.maxOpacity, duration: p.duration * 0.12, useNativeDriver: true }),
          Animated.timing(p.opacityAnim, { toValue: p.def.maxOpacity, duration: p.duration * 0.68, useNativeDriver: true }),
          Animated.timing(p.opacityAnim, { toValue: 0,                duration: p.duration * 0.20, useNativeDriver: true }),
        ]),
      ]),
    ]).start(({ finished }) => { if (finished) loop(); });
  };
  loop();
}

function startTwinkle(p: Particle) {
  const loop = () => {
    Animated.sequence([
      Animated.delay(p.delay),
      Animated.timing(p.opacityAnim, { toValue: rnd(0.5, p.def.maxOpacity), duration: p.duration * 0.35, useNativeDriver: true }),
      Animated.timing(p.opacityAnim, { toValue: rnd(0.04, 0.22),            duration: p.duration * 0.30, useNativeDriver: true }),
      Animated.timing(p.opacityAnim, { toValue: rnd(0.5, p.def.maxOpacity), duration: p.duration * 0.35, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) loop(); });
  };
  const scaleLoop = () => {
    Animated.sequence([
      Animated.timing(p.scaleAnim, { toValue: rnd(0.7, 1.6), duration: p.duration * 0.5, useNativeDriver: true }),
      Animated.timing(p.scaleAnim, { toValue: rnd(0.4, 0.9), duration: p.duration * 0.5, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) scaleLoop(); });
  };
  loop();
  scaleLoop();
}

function startSparkle(p: Particle) {
  const loop = () => {
    Animated.sequence([
      Animated.delay(p.delay),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(p.opacityAnim, { toValue: p.def.maxOpacity, duration: 190, useNativeDriver: true }),
          Animated.timing(p.opacityAnim, { toValue: 0,                 duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(p.scaleAnim, { toValue: rnd(1.1, 1.9), duration: 190, useNativeDriver: true }),
          Animated.timing(p.scaleAnim, { toValue: 0.2,            duration: 300, useNativeDriver: true }),
        ]),
      ]),
      Animated.delay(p.duration),
    ]).start(({ finished }) => { if (finished) loop(); });
  };
  loop();
}

export function VibeOverlay({ vibe }: { vibe: string }) {
  const def = VIBE_DEFS[vibe];
  const particlesRef = useRef<Particle[]>([]);

  if (def && particlesRef.current.length === 0) {
    particlesRef.current = buildParticles(def);
  }

  useEffect(() => {
    const particles = particlesRef.current;
    particles.forEach(p => {
      if (p.def.mode === 'float')   startFloat(p);
      if (p.def.mode === 'twinkle') startTwinkle(p);
      if (p.def.mode === 'sparkle') startSparkle(p);
    });
    return () => {
      particles.forEach(p => {
        p.yAnim.stopAnimation();
        p.opacityAnim.stopAnimation();
        p.scaleAnim.stopAnimation();
      });
    };
  }, []);

  if (!def) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      {particlesRef.current.map(p => (
        <Animated.Text
          key={p.id}
          style={{
            position: 'absolute',
            left:     p.x,
            top:      p.startY,
            fontSize: p.size,
            color:    p.def.color,
            opacity:  p.opacityAnim,
            transform: [
              { translateY: p.yAnim },
              { scale:      p.scaleAnim },
            ],
          }}
        >
          {p.def.symbol}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    overflow: 'hidden',
    pointerEvents: 'none',
  } as any,
});
