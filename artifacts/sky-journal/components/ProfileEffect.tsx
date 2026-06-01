import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

// ── Types ──────────────────────────────────────────────────────────────────────

type FlyMode = 'drift' | 'rise' | 'fall' | 'glow';

interface ParticleSpec {
  startX:   number;
  startY:   number;
  delay:    number;
  flyMode:  FlyMode;
  xSwing:   number;
  yTravel:  number;
  speed:    number;
  rotSpeed: number;
  scaleMin: number;
  scaleMax: number;
  opacity:  number;
  wingFlap: boolean;
  render:   () => React.ReactElement;
}

// ── Deterministic pseudo-random (stable per index, no Math.random) ─────────────

function rng(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ── SVG shapes ─────────────────────────────────────────────────────────────────

function ButterflyShape({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <Svg width={40} height={34} viewBox="0 0 40 34">
      <Path d="M 20,17 C 16,9 3,6 4,14 C 5,20 14,21 20,17 Z" fill={c1} fillOpacity={0.88} />
      <Path d="M 20,17 C 13,21 8,27 12,31 C 16,33 20,27 20,17 Z" fill={c2} fillOpacity={0.80} />
      <Path d="M 20,17 C 24,9 37,6 36,14 C 35,20 26,21 20,17 Z" fill={c1} fillOpacity={0.88} />
      <Path d="M 20,17 C 27,21 32,27 28,31 C 24,33 20,27 20,17 Z" fill={c2} fillOpacity={0.80} />
      <Ellipse cx={20} cy={17} rx={1.5} ry={7.5} fill="#1A0E30" fillOpacity={0.72} />
      <Path d="M 20,9 L 16,3" stroke="#1A0E30" strokeWidth={0.9} strokeOpacity={0.50} fill="none" />
      <Path d="M 20,9 L 24,3" stroke="#1A0E30" strokeWidth={0.9} strokeOpacity={0.50} fill="none" />
      <Circle cx={16} cy={3} r={1} fill="#1A0E30" fillOpacity={0.40} />
      <Circle cx={24} cy={3} r={1} fill="#1A0E30" fillOpacity={0.40} />
    </Svg>
  );
}

function HeartShape({ color }: { color: string }) {
  return (
    <Svg width={22} height={20} viewBox="0 0 22 20">
      <Path
        d="M 11,18.5 L 2,10 C -0.8,7 -0.2,3 3.5,1.5 C 6,0.5 8.5,2 11,5 C 13.5,2 16,0.5 18.5,1.5 C 22.2,3 22.8,7 20,10 Z"
        fill={color}
        fillOpacity={0.92}
      />
    </Svg>
  );
}

function FlameShape({ c1, c2 }: { c1: string; c2: string }) {
  return (
    <Svg width={14} height={22} viewBox="0 0 14 22">
      <Path d="M 7,21 C 2,15 0,9.5 3.5,5 C 5.5,2 7,0 7,0 C 7,0 8.5,2 10.5,5 C 14,9.5 12,15 7,21 Z" fill={c1} fillOpacity={0.85} />
      <Path d="M 7,17 C 4,13 4,9 6,6 C 6.5,4.5 7,3 7,3 C 7.5,4.5 8.5,7 8,10 C 7.5,13 7,17 7,17 Z" fill={c2} fillOpacity={0.93} />
    </Svg>
  );
}

function BlossomShape({ c1, c2 }: { c1: string; c2: string }) {
  const angles = [0, 72, 144, 216, 288] as const;
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <G transform="translate(14,14)">
        {angles.map((angle, i) => (
          <Path
            key={i}
            transform={`rotate(${angle})`}
            d="M 0,-8 C -4,-5 -4,-1 0,6 C 4,-1 4,-5 0,-8 Z"
            fill={c1}
            fillOpacity={0.88}
          />
        ))}
        <Circle cx={0} cy={0} r={2.8} fill={c2} fillOpacity={0.96} />
        <Circle cx={0} cy={0} r={1.2} fill="#FFC0D8" fillOpacity={0.80} />
      </G>
    </Svg>
  );
}

function LeafShape({ color }: { color: string }) {
  return (
    <Svg width={14} height={24} viewBox="0 0 14 24">
      <Path d="M 7,22 C 2,15 2,8 7,1 C 12,8 12,15 7,22 Z" fill={color} fillOpacity={0.88} />
      <Path d="M 7,22 L 7,1" stroke="#fff" strokeWidth={0.7} strokeOpacity={0.22} fill="none" />
      <Path d="M 7,15 Q 4,12 4,9" stroke="#fff" strokeWidth={0.5} strokeOpacity={0.18} fill="none" />
      <Path d="M 7,15 Q 10,12 10,9" stroke="#fff" strokeWidth={0.5} strokeOpacity={0.18} fill="none" />
    </Svg>
  );
}

function FireflyShape({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Circle cx={9} cy={9} r={8} fill={color} fillOpacity={0.10} />
      <Circle cx={9} cy={9} r={5} fill={color} fillOpacity={0.25} />
      <Circle cx={9} cy={9} r={2.8} fill={color} fillOpacity={0.90} />
    </Svg>
  );
}

// ── Color palettes ─────────────────────────────────────────────────────────────

const BFY = [
  { c1: '#C8B8E8', c2: '#C8A84B' },
  { c1: '#B8D4F0', c2: '#9878C8' },
  { c1: '#F0C8E8', c2: '#C8A84B' },
  { c1: '#D8C0F8', c2: '#A8D4D0' },
  { c1: '#C8D8F0', c2: '#D4A870' },
];
const HRT = ['#F0B8D4', '#D8B0F0', '#F4C4E8', '#C8B0F8', '#F8D0E8', '#E8B8F8', '#F0C0DC', '#D4C0F8'];
const FLM = [
  { c1: '#E88040', c2: '#F0D040' },
  { c1: '#E87030', c2: '#F0AA30' },
  { c1: '#D46030', c2: '#E8C040' },
  { c1: '#F09050', c2: '#F4DC50' },
];
const BLM = [
  { c1: '#F4B8D0', c2: '#FFF0F6' },
  { c1: '#F8C8D8', c2: '#FFF8FA' },
  { c1: '#ECAAC8', c2: '#FFE8F4' },
  { c1: '#F0C0DC', c2: '#FFF4F8' },
];
const LVS = ['#4A9860', '#5AAB6E', '#3D8854', '#72BB8A', '#4E9266', '#5EA870', '#427E52'];
const FFY = ['#E8D44A', '#F0E060', '#D8C840', '#F4EC70', '#E8CC40', '#F8E868'];

// ── Particle generator per effect ─────────────────────────────────────────────

function makeParticles(effectId: string, w: number, h: number): ParticleSpec[] {
  switch (effectId) {
    case 'effect_butterfly':
      return Array.from({ length: 5 }, (_, i) => {
        const col = BFY[i % BFY.length];
        return {
          startX:   rng(i * 11) * Math.max(0, w - 42),
          startY:   rng(i * 17) * Math.max(0, h - 36),
          delay:    i * 700 + rng(i * 23) * 500,
          flyMode:  'drift',
          xSwing:   40 + rng(i * 7) * 35,
          yTravel:  22 + rng(i * 13) * 20,
          speed:    3400 + rng(i * 19) * 1400,
          rotSpeed: 0,
          scaleMin: 0.82,
          scaleMax: 1.06,
          opacity:  0.90,
          wingFlap: true,
          render:   () => <ButterflyShape c1={col.c1} c2={col.c2} />,
        };
      });

    case 'effect_hearts':
      return Array.from({ length: 8 }, (_, i) => ({
        startX:   rng(i * 11) * Math.max(0, w - 24),
        startY:   h * 0.55 + rng(i * 17) * (h * 0.40),
        delay:    i * 500 + rng(i * 23) * 350,
        flyMode:  'rise' as FlyMode,
        xSwing:   16 + rng(i * 7) * 20,
        yTravel:  58 + rng(i * 13) * 55,
        speed:    2800 + rng(i * 19) * 1200,
        rotSpeed: 0,
        scaleMin: 0.78,
        scaleMax: 1.12,
        opacity:  0.90,
        wingFlap: false,
        render:   () => <HeartShape color={HRT[i % HRT.length]} />,
      }));

    case 'effect_fire':
      return Array.from({ length: 10 }, (_, i) => {
        const col = FLM[i % FLM.length];
        return {
          startX:   rng(i * 11) * Math.max(0, w - 16),
          startY:   h * 0.65 + rng(i * 17) * (h * 0.30),
          delay:    i * 320 + rng(i * 23) * 220,
          flyMode:  'rise' as FlyMode,
          xSwing:   7 + rng(i * 7) * 10,
          yTravel:  45 + rng(i * 13) * 45,
          speed:    1500 + rng(i * 19) * 700,
          rotSpeed: 0,
          scaleMin: 0.65,
          scaleMax: 1.25,
          opacity:  0.92,
          wingFlap: false,
          render:   () => <FlameShape c1={col.c1} c2={col.c2} />,
        };
      });

    case 'effect_blossom':
      return Array.from({ length: 8 }, (_, i) => {
        const col = BLM[i % BLM.length];
        return {
          startX:   rng(i * 11) * Math.max(0, w - 28),
          startY:   rng(i * 17) * (h * 0.22) - 12,
          delay:    i * 550 + rng(i * 23) * 450,
          flyMode:  'fall' as FlyMode,
          xSwing:   22 + rng(i * 7) * 22,
          yTravel:  h * 0.85 + rng(i * 13) * (h * 0.12),
          speed:    4000 + rng(i * 19) * 1600,
          rotSpeed: 2800 + rng(i * 29) * 2400,
          scaleMin: 0.78,
          scaleMax: 1.06,
          opacity:  0.88,
          wingFlap: false,
          render:   () => <BlossomShape c1={col.c1} c2={col.c2} />,
        };
      });

    case 'effect_leaves':
      return Array.from({ length: 7 }, (_, i) => ({
        startX:   rng(i * 11) * Math.max(0, w - 16),
        startY:   rng(i * 17) * (h * 0.18) - 14,
        delay:    i * 650 + rng(i * 23) * 500,
        flyMode:  'fall' as FlyMode,
        xSwing:   28 + rng(i * 7) * 28,
        yTravel:  h * 0.88 + rng(i * 13) * (h * 0.09),
        speed:    4400 + rng(i * 19) * 1800,
        rotSpeed: 2400 + rng(i * 29) * 2800,
        scaleMin: 0.78,
        scaleMax: 1.06,
        opacity:  0.86,
        wingFlap: false,
        render:   () => <LeafShape color={LVS[i % LVS.length]} />,
      }));

    case 'effect_fireflies':
      return Array.from({ length: 12 }, (_, i) => ({
        startX:   rng(i * 11) * Math.max(0, w - 18),
        startY:   rng(i * 17) * Math.max(0, h - 18),
        delay:    i * 280 + rng(i * 23) * 450,
        flyMode:  'glow' as FlyMode,
        xSwing:   16 + rng(i * 7) * 20,
        yTravel:  16 + rng(i * 13) * 20,
        speed:    2600 + rng(i * 19) * 1400,
        rotSpeed: 0,
        scaleMin: 0.65,
        scaleMax: 1.30,
        opacity:  0.88,
        wingFlap: false,
        render:   () => <FireflyShape color={FFY[i % FFY.length]} />,
      }));

    default:
      return [];
  }
}

// ── Particle component ─────────────────────────────────────────────────────────

function Particle({ spec }: { spec: ParticleSpec }) {
  const tx      = useRef(new Animated.Value(0)).current;
  const ty      = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(spec.scaleMin)).current;
  const rotate  = useRef(new Animated.Value(0)).current;
  const wingX   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      const { flyMode, xSwing, yTravel, speed, rotSpeed, scaleMin, scaleMax, opacity: maxOp, wingFlap } = spec;

      // Opacity
      let opAnim: Animated.CompositeAnimation;
      if (flyMode === 'glow') {
        opAnim = Animated.loop(Animated.sequence([
          Animated.timing(opacity, { toValue: maxOp, duration: speed * 0.42, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(opacity, { toValue: 0.06, duration: speed * 0.58, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ]));
      } else if (flyMode === 'rise') {
        opAnim = Animated.loop(Animated.sequence([
          Animated.timing(opacity, { toValue: maxOp, duration: speed * 0.18, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: maxOp, duration: speed * 0.58, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: speed * 0.24, useNativeDriver: true }),
        ]));
      } else if (flyMode === 'fall') {
        opAnim = Animated.loop(Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: maxOp, duration: speed * 0.14, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: maxOp, duration: speed * 0.66, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: speed * 0.20, useNativeDriver: true }),
        ]));
      } else {
        opAnim = Animated.loop(Animated.sequence([
          Animated.timing(opacity, { toValue: maxOp, duration: speed * 0.35, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: maxOp * 0.70, duration: speed * 0.30, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: maxOp, duration: speed * 0.35, useNativeDriver: true }),
        ]));
      }

      // Y movement
      let yAnim: Animated.CompositeAnimation;
      if (flyMode === 'rise') {
        yAnim = Animated.loop(Animated.sequence([
          Animated.timing(ty, { toValue: -yTravel, duration: speed, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(ty, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]));
      } else if (flyMode === 'fall') {
        yAnim = Animated.loop(Animated.sequence([
          Animated.timing(ty, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(ty, { toValue: yTravel, duration: speed, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(ty, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]));
      } else {
        yAnim = Animated.loop(Animated.sequence([
          Animated.timing(ty, { toValue: -yTravel, duration: speed / 2, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(ty, { toValue:  yTravel, duration: speed / 2, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        ]));
      }

      // X sway
      const xAnim = Animated.loop(Animated.sequence([
        Animated.timing(tx, { toValue:  xSwing, duration: speed / 2, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(tx, { toValue: -xSwing, duration: speed / 2, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));

      // Scale pulse
      const scaleAnim = Animated.loop(Animated.sequence([
        Animated.timing(scale, { toValue: scaleMax, duration: speed * 0.5, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(scale, { toValue: scaleMin, duration: speed * 0.5, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ]));

      // Rotation (blossoms / leaves)
      const rotAnim = rotSpeed > 0
        ? Animated.loop(Animated.timing(rotate, { toValue: 1, duration: rotSpeed, useNativeDriver: true, easing: Easing.linear }))
        : null;

      // Wing flap (butterflies only) — scaleX oscillation simulates top-down wing fold
      const wingAnim = wingFlap
        ? Animated.loop(Animated.sequence([
            Animated.timing(wingX, { toValue: 0.25, duration: 200, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
            Animated.timing(wingX, { toValue: 1.00, duration: 200, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          ]))
        : null;

      opAnim.start();
      yAnim.start();
      xAnim.start();
      scaleAnim.start();
      rotAnim?.start();
      wingAnim?.start();
    }, spec.delay);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left:    spec.startX,
          top:     spec.startY,
          opacity,
          transform: [
            { translateX: tx },
            { translateY: ty },
            { rotate: rotDeg },
            { scale },
            ...(spec.wingFlap ? [{ scaleX: wingX }] : []),
          ],
        },
      ]}
    >
      {spec.render()}
    </Animated.View>
  );
}

// ── Canvas (deferred until layout is measured) ─────────────────────────────────

function EffectCanvas({ effectId, width, height }: { effectId: string; width: number; height: number }) {
  const particles = useMemo(() => makeParticles(effectId, width, height), [effectId, width, height]);
  return (
    <>
      {particles.map((spec, i) => (
        <Particle key={`${effectId}-${i}`} spec={spec} />
      ))}
    </>
  );
}

// ── Public export ──────────────────────────────────────────────────────────────

export function ProfileEffect({ effectId }: { effectId: string | undefined }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  if (!effectId) return null;

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
      pointerEvents="none"
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setDims(prev => (prev?.w === width && prev?.h === height ? prev : { w: width, h: height }));
      }}
    >
      {dims && <EffectCanvas effectId={effectId} width={dims.w} height={dims.h} />}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute' },
});
