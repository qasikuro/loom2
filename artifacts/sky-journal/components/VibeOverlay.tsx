import React, { useEffect } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

type VibeMode = 'float' | 'twinkle' | 'sparkle';
type PhotoMotion =
  | 'zoom'
  | 'float'
  | 'pulse'
  | 'focus'
  | 'pan'
  | 'flash'
  | 'shake'
  | 'snap'
  | 'slide'
  | 'tilt'
  | 'bounce'
  | 'wiggle'
  | 'fade'
  | 'quickZoom'
  | 'speedRamp';

interface VibeEffect {
  label: string;
  motion: PhotoMotion;
}

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
  effects:       readonly VibeEffect[];
}

export const VIBE_DEFS: Record<string, VibeDef> = {
  romantic: {
    symbol: '♡', color: '#FF89B0', count: 10, minSize: 13, maxSize: 27, durationRange: [3500, 5500], mode: 'float', maxOpacity: 0.88, label: 'Romantic', desc: 'Hearts drift above your look',
    effects: [{ label: 'Zoom', motion: 'zoom' }, { label: 'Float', motion: 'float' }, { label: 'Heartbeat', motion: 'pulse' }, { label: 'Focus fade', motion: 'focus' }, { label: 'Parallax', motion: 'pan' }, { label: 'Sparkles', motion: 'fade' }],
  },
  happy: {
    symbol: '✦', color: '#FFD86F', count: 14, minSize: 8, maxSize: 18, durationRange: [1200, 2800], mode: 'sparkle', maxOpacity: 0.95, label: 'Happy', desc: 'Sparkles burst around you',
    effects: [{ label: 'Quick zoom', motion: 'quickZoom' }, { label: 'White flash', motion: 'flash' }, { label: 'Shake', motion: 'shake' }, { label: 'Beat pulse', motion: 'pulse' }, { label: 'Speed ramp', motion: 'speedRamp' }],
  },
  dark: {
    symbol: '◉', color: '#7050A8', count: 8, minSize: 22, maxSize: 44, durationRange: [7000, 11000], mode: 'float', maxOpacity: 0.22, label: 'Dark', desc: 'Shadows drift and linger',
    effects: [{ label: 'Ken Burns', motion: 'pan' }, { label: 'Fade', motion: 'fade' }, { label: 'Shadow drift', motion: 'float' }, { label: 'Slow zoom', motion: 'zoom' }],
  },
  mythical: {
    symbol: '✧', color: '#B090FF', count: 12, minSize: 8, maxSize: 22, durationRange: [1800, 3800], mode: 'twinkle', maxOpacity: 0.90, label: 'Mythical', desc: 'Constellation stars appear',
    effects: [{ label: 'Star sparkle', motion: 'fade' }, { label: 'Shimmer', motion: 'focus' }, { label: 'Star float', motion: 'float' }, { label: 'Cinematic zoom', motion: 'zoom' }],
  },
  dreamy: {
    symbol: '○', color: '#B0D8FF', count: 9, minSize: 14, maxSize: 30, durationRange: [5000, 8000], mode: 'float', maxOpacity: 0.52, label: 'Dreamy', desc: 'Soft orbs float through',
    effects: [{ label: 'Float', motion: 'float' }, { label: 'Soft zoom', motion: 'zoom' }, { label: 'Focus fade', motion: 'focus' }, { label: 'Parallax', motion: 'pan' }],
  },
  ethereal: {
    symbol: '◇', color: '#70FFE0', count: 10, minSize: 9, maxSize: 20, durationRange: [2000, 4200], mode: 'twinkle', maxOpacity: 0.85, label: 'Ethereal', desc: 'Light wisps shimmer',
    effects: [{ label: 'Shimmer', motion: 'focus' }, { label: 'Glow', motion: 'pulse' }, { label: 'Light float', motion: 'float' }, { label: 'Fade', motion: 'fade' }],
  },
  cozy: {
    symbol: '·', color: '#FFB840', count: 18, minSize: 6, maxSize: 15, durationRange: [1600, 3400], mode: 'sparkle', maxOpacity: 0.90, label: 'Cozy', desc: 'Warm embers glow',
    effects: [{ label: 'Warm pulse', motion: 'pulse' }, { label: 'Ember drift', motion: 'float' }, { label: 'Ember sparkle', motion: 'fade' }, { label: 'Soft zoom', motion: 'zoom' }],
  },
  adventurous: {
    symbol: '◈', color: '#70D090', count: 8, minSize: 11, maxSize: 23, durationRange: [3200, 5500], mode: 'float', maxOpacity: 0.82, label: 'Adventurous', desc: 'Wind-caught symbols drift',
    effects: [{ label: 'Pan', motion: 'pan' }, { label: 'Side slide', motion: 'slide' }, { label: 'Ken Burns', motion: 'zoom' }, { label: 'Wind float', motion: 'float' }],
  },
  magical: {
    symbol: '✧', color: '#C49BFF', count: 15, minSize: 8, maxSize: 23, durationRange: [1400, 3300], mode: 'twinkle', maxOpacity: 0.92, label: 'Magical', desc: 'Shimmering lights orbit your look',
    effects: [{ label: 'Sparkle', motion: 'fade' }, { label: 'Shimmer', motion: 'focus' }, { label: 'Glow', motion: 'pulse' }, { label: 'Star float', motion: 'float' }, { label: 'Cinematic zoom', motion: 'zoom' }],
  },
  energetic: {
    symbol: '✦', color: '#FF9B61', count: 13, minSize: 9, maxSize: 22, durationRange: [900, 2200], mode: 'sparkle', maxOpacity: 0.96, label: 'Energetic', desc: 'Fast, punchy movement and bright flashes',
    effects: [{ label: 'Quick zoom', motion: 'quickZoom' }, { label: 'White flash', motion: 'flash' }, { label: 'Shake', motion: 'shake' }, { label: 'Snap', motion: 'snap' }, { label: 'Beat pulse', motion: 'pulse' }, { label: 'Speed ramp', motion: 'speedRamp' }],
  },
  cool: {
    symbol: '◇', color: '#78C9F5', count: 9, minSize: 8, maxSize: 18, durationRange: [2400, 4300], mode: 'twinkle', maxOpacity: 0.82, label: 'Cool', desc: 'Smooth camera moves with a crisp finish',
    effects: [{ label: 'Ken Burns', motion: 'pan' }, { label: 'Side slide', motion: 'slide' }, { label: 'Photo tilt', motion: 'tilt' }, { label: 'Slow zoom', motion: 'zoom' }],
  },
  glitch: {
    symbol: '╱', color: '#FF6DB3', count: 10, minSize: 10, maxSize: 23, durationRange: [1100, 2400], mode: 'sparkle', maxOpacity: 0.90, label: 'Glitch', desc: 'Sharp cuts, flickers and playful shake',
    effects: [{ label: 'Glitch shake', motion: 'shake' }, { label: 'White flash', motion: 'flash' }, { label: 'Snap zoom', motion: 'snap' }, { label: 'Wiggle', motion: 'wiggle' }],
  },
  cute: {
    symbol: '♡', color: '#FF91C7', count: 16, minSize: 9, maxSize: 22, durationRange: [1300, 3000], mode: 'sparkle', maxOpacity: 0.94, label: 'Cute', desc: 'Bouncy motion with hearts and soft zooms',
    effects: [{ label: 'Bounce', motion: 'bounce' }, { label: 'Wiggle', motion: 'wiggle' }, { label: 'Heart pop', motion: 'snap' }, { label: 'Soft zoom', motion: 'zoom' }, { label: 'Shake', motion: 'shake' }],
  },
  emotional: {
    symbol: '☾', color: '#95A9E8', count: 9, minSize: 10, maxSize: 24, durationRange: [4200, 7200], mode: 'float', maxOpacity: 0.72, label: 'Emotional', desc: 'A reflective, slow-moving portrait',
    effects: [{ label: 'Push in', motion: 'zoom' }, { label: 'Fade', motion: 'fade' }, { label: 'Focus fade', motion: 'focus' }, { label: 'Slow pan', motion: 'pan' }, { label: 'Gentle float', motion: 'float' }],
  },
};

interface MotionFrame {
  duration: number;
  scale?: number;
  x?: number;
  y?: number;
  rotation?: number;
  opacity?: number;
  flashOverlay?: number;
}

const frame = (duration: number, pose: Omit<MotionFrame, 'duration'> = {}): MotionFrame => ({
  duration,
  ...pose,
});

const PHOTO_MOTIONS: Record<PhotoMotion, readonly MotionFrame[]> = {
  zoom:      [frame(2400, { scale: 1.035 }), frame(1000, { scale: 1.008 })],
  float:     [frame(1600, { scale: 1.014, x: -8, y: -12 }), frame(1600, { scale: 1.014, x: 8, y: -3 })],
  pulse:     [frame(180, { scale: 1.04 }), frame(180, { scale: 1.006 }), frame(210, { scale: 1.032 }), frame(350, { scale: 1 }), frame(1500)],
  focus:     [frame(500, { opacity: 0.82 }), frame(850, { opacity: 1 }), frame(1000)],
  pan:       [frame(1800, { scale: 1.025, x: 12, y: -8 }), frame(1800, { scale: 1.025, x: -12, y: 8 })],
  flash:     [frame(90, { flashOverlay: 0.42 }), frame(120, { flashOverlay: 0 }), frame(1400)],
  shake:     [frame(80, { x: -9, rotation: -0.5 }), frame(80, { x: 9, rotation: 0.5 }), frame(80, { x: -6, rotation: -0.3 }), frame(80, { x: 6, rotation: 0.3 }), frame(180)],
  snap:      [frame(150, { scale: 1.05 }), frame(180, { scale: 1.006 }), frame(180, { scale: 1.03 }), frame(220)],
  slide:     [frame(1500, { scale: 1.02, x: 16 }), frame(1500, { scale: 1.02, x: -16 })],
  tilt:      [frame(1200, { scale: 1.02, rotation: -0.7 }), frame(1200, { scale: 1.02, rotation: 0.7 }), frame(500)],
  bounce:    [frame(140, { scale: 1.04, y: -5 }), frame(180, { scale: 0.995, y: 1 }), frame(240, { scale: 1.026 }), frame(260)],
  wiggle:    [frame(120, { rotation: 0.7 }), frame(120, { rotation: -0.7 }), frame(120, { rotation: 0.5 }), frame(120, { rotation: -0.5 }), frame(300)],
  fade:      [frame(650, { opacity: 0.86 }), frame(900, { opacity: 1 }), frame(900)],
  quickZoom: [frame(300, { scale: 1.05 }), frame(180, { scale: 1.004 }), frame(280, { scale: 1.026 }), frame(300)],
  speedRamp: [frame(1500, { scale: 1.018 }), frame(220, { scale: 1.05 }), frame(350, { scale: 1.006 }), frame(600)],
};

export function VibeMotion({ vibe, children }: { vibe: string; children: React.ReactNode }) {
  const def = VIBE_DEFS[vibe];
  const scale = React.useRef(new Animated.Value(1)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(0)).current;
  const rotation = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;
  const flashOverlay = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!def) return;
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    let effectIndex = 0;

    const playNext = () => {
      if (!active) return;
      const effect = def.effects[effectIndex % def.effects.length];
      effectIndex += 1;
      const sequence = Animated.sequence([
        ...PHOTO_MOTIONS[effect.motion].map(({ duration, scale: nextScale, x, y, rotation: nextRotation, opacity: nextOpacity, flashOverlay: nextFlash }) => {
          const easing = duration < 500 ? Easing.out(Easing.cubic) : Easing.inOut(Easing.ease);
          return Animated.parallel([
            Animated.timing(scale, { toValue: nextScale ?? 1, duration, easing, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: x ?? 0, duration, easing, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: y ?? 0, duration, easing, useNativeDriver: true }),
            Animated.timing(rotation, { toValue: nextRotation ?? 0, duration, easing, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: nextOpacity ?? 1, duration, easing, useNativeDriver: true }),
            Animated.timing(flashOverlay, { toValue: nextFlash ?? 0, duration, easing, useNativeDriver: true }),
          ]);
        }),
      ]);
      animation = sequence;
      sequence.start(({ finished }) => {
        if (!finished || !active) return;
        playNext();
      });
    };

    playNext();
    return () => {
      active = false;
      animation?.stop();
      scale.stopAnimation();
      translateX.stopAnimation();
      translateY.stopAnimation();
      rotation.stopAnimation();
      opacity.stopAnimation();
      flashOverlay.stopAnimation();
    };
  }, [def, flashOverlay, opacity, rotation, scale, translateX, translateY]);

  if (!def) return <>{children}</>;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          opacity,
          transform: [
            { translateX },
            { translateY },
            { scale },
            { rotate: rotation.interpolate({ inputRange: [-1, 1], outputRange: ['-2deg', '2deg'] }) },
          ],
        },
      ]}
    >
      {children}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#FFFFFF', opacity: flashOverlay, pointerEvents: 'none' },
        ]}
      />
    </Animated.View>
  );
}

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

function buildParticles(def: VibeDef, width: number, height: number): Particle[] {
  return Array.from({ length: def.count }, (_, i) => ({
    id:          i,
    x:           rnd(0.04, 0.90) * width,
    startY:      rnd(0.15, 0.85) * height,
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
  const window = useWindowDimensions();
  const [bounds, setBounds] = React.useState<{ width: number; height: number } | null>(null);
  const { width, height } = bounds ?? window;
  const particles = React.useMemo(
    () => def ? buildParticles(def, width, height) : [],
    [def, width, height],
  );

  useEffect(() => {
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
  }, [particles]);

  if (!def) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay]}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width > 0 && layout.height > 0) {
          setBounds(previous => previous?.width === layout.width && previous?.height === layout.height
            ? previous
            : { width: layout.width, height: layout.height });
        }
      }}
    >
      {particles.map(p => (
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
});
