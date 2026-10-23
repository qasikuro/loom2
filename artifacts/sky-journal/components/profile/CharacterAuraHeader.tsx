import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { ProfileEffect } from '@/components/ProfileEffect';
import { SecureImage as Image } from '@/components/SecureImage';
import {
  ACCENT_CONFIGS, DEFAULT_AURA, FRAME_CONFIGS, MOOD_AURA, MOOD_ORBS,
  PARTICLE_SIZES, PARTICLE_XS,
} from './profileConstants';

// ── Motion gate: reduced-motion preference + tab focus ─────────────────────

export function useDecorativeMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [focused, setFocused] = useState(true);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => null);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  useFocusEffect(React.useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  return { reduceMotion, animate: focused && !reduceMotion };
}

// ── FrameRing ──────────────────────────────────────────────────────────────────

export function FrameRing({ frameId, size = 76 }: { frameId: string; size?: number }) {
  const cfg     = FRAME_CONFIGS[frameId];
  const pulse   = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const orbit   = useRef(new Animated.Value(0)).current;
  const { animate } = useDecorativeMotion();
  const isMoonlight = frameId === 'frame_moonlight';
  const isFire = frameId === 'frame_fire';

  useEffect(() => {
    if (!cfg || !animate) { pulse.setValue(0.5); shimmer.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse,   { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse,   { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const shimLoop = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    shimLoop.start();
    return () => { loop.stop(); shimLoop.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId, animate]);

  useEffect(() => {
    if ((!isMoonlight && !isFire) || !animate) {
      orbit.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(orbit, {
      toValue: 1,
      duration: isMoonlight ? 18000 : 9500,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [animate, isFire, isMoonlight, orbit]);

  if (!cfg) return null;

  const outerScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const outerOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.50, cfg.dashOpacity, 0.50] });
  const glowOpacity  = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.40, 0.12] });
  const glowScale    = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.20] });
  const orbitRotation = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  if (isMoonlight || isFire) {
    const color = cfg.color;
    const haloSize = size * 1.08;
    const ringStyle = (diameter: number) => ({
      position: 'absolute' as const,
      width: diameter,
      height: diameter,
      left: '50%' as const,
      top: '50%' as const,
      marginLeft: -diameter / 2,
      marginTop: -diameter / 2,
      borderRadius: diameter / 2,
    });
    const accents = isMoonlight
      ? [
          { glyph: '✦', top: size * 0.10, left: size * 0.20, scale: 0.15 },
          { glyph: '✧', top: size * 0.28, left: size * 0.82, scale: 0.12 },
          { glyph: '✦', top: size * 0.78, left: size * 0.70, scale: 0.13 },
          { glyph: '·', top: size * 0.68, left: size * 0.05, scale: 0.11 },
        ]
      : [
          { glyph: '✦', top: size * 0.08, left: size * 0.22, scale: 0.17 },
          { glyph: '✧', top: size * 0.30, left: size * 0.84, scale: 0.12 },
          { glyph: '✦', top: size * 0.78, left: size * 0.72, scale: 0.15 },
          { glyph: '·', top: size * 0.70, left: size * 0.04, scale: 0.13 },
          { glyph: '✧', top: size * 0.56, left: size * 0.10, scale: 0.10 },
        ];

    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'visible' }]}>
        <Animated.View
          style={[
            ringStyle(haloSize),
            {
              borderWidth: Math.max(3, size * 0.05),
              borderColor: cfg.glow,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
              shadowColor: color,
              shadowOpacity: 0.7,
              shadowRadius: size * 0.16,
              elevation: 8,
            },
          ]}
        />
        <Animated.View
          style={[
            ringStyle(size),
            {
              borderWidth: Math.max(1.5, size * 0.018),
              borderColor: color,
              opacity: outerOpacity,
              transform: [{ scale: outerScale }],
              shadowColor: color,
              shadowOpacity: 0.85,
              shadowRadius: size * 0.08,
              elevation: 5,
            },
          ]}
        />
        <Animated.View
          style={[
            ringStyle(size * 0.86),
            {
              borderWidth: Math.max(1, size * 0.012),
              borderColor: isMoonlight ? 'rgba(235,218,255,0.72)' : 'rgba(255,177,95,0.82)',
              borderStyle: 'dashed',
              opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.46, 0.94] }),
              transform: [{ rotate: orbitRotation }],
            },
          ]}
        />
        {isMoonlight && (
          <Animated.View
            style={[
              ringStyle(size * 0.84),
              { transform: [{ rotate: orbitRotation }] },
            ]}
          >
            <Text
              style={{
                position: 'absolute',
                top: -size * 0.12,
                left: '50%',
                marginLeft: -size * 0.12,
                width: size * 0.24,
                textAlign: 'center',
                fontSize: size * 0.22,
                lineHeight: size * 0.27,
                color: '#F2D7FF',
                textShadowColor: '#C778FF',
                textShadowRadius: size * 0.13,
              }}
            >
              ☾
            </Text>
          </Animated.View>
        )}
        {accents.map((accent, index) => (
          <Animated.Text
            key={`${accent.glyph}-${index}`}
            style={[
              {
                position: 'absolute',
                top: accent.top,
                left: accent.left,
                fontSize: size * accent.scale,
                lineHeight: size * accent.scale * 1.2,
                color: isMoonlight ? (index % 2 ? '#DCC5FF' : '#FFFFFF') : (index % 2 ? '#FFB46B' : '#FFE1A3'),
                opacity: shimmer.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.45, index % 2 ? 0.96 : 0.72, 0.45],
                }),
                textShadowColor: color,
                textShadowRadius: size * 0.1,
              },
            ]}
          >
            {accent.glyph}
          </Animated.Text>
        ))}
      </View>
    );
  }

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: -14, left: -14, right: -14, bottom: -14, borderRadius: 56, backgroundColor: cfg.glow, opacity: glowOpacity, transform: [{ scale: glowScale }] }}
      />
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 47, borderWidth: 2.5, borderColor: cfg.color, opacity: outerOpacity, transform: [{ scale: outerScale }] }}
      />
    </>
  );
}

// ── BreathingAvatarRing ────────────────────────────────────────────────────────

export function BreathingAvatarRing({ mood }: { mood: string }) {
  const aura    = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const breathe = useRef(new Animated.Value(0)).current;
  const { animate } = useDecorativeMotion();
  useEffect(() => {
    if (!animate) { breathe.setValue(0.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathe, animate]);
  const scale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.18, 0.80, 0.18] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: -7, left: -7, right: -7, bottom: -7, borderRadius: 48, borderWidth: 2.5, borderColor: aura.accent, transform: [{ scale }], opacity }}
    />
  );
}

// ── MoodOrbPicker ──────────────────────────────────────────────────────────────

export function MoodOrbPicker({ currentMood, onSelect }: {
  currentMood: string;
  onSelect: (m: string) => void;
}) {
  const { t } = useTranslation();
  const scales = useRef(MOOD_ORBS.map(() => new Animated.Value(1))).current;
  function select(key: string, idx: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(scales[idx], { toValue: 1.4, tension: 300, friction: 5, useNativeDriver: true }),
      Animated.spring(scales[idx], { toValue: 1,   tension: 180, friction: 6, useNativeDriver: true }),
    ]).start();
    onSelect(key);
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, marginBottom: 2, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(200,184,232,0.09)' }}>
      <Text style={{ fontSize: 9, color: 'rgba(200,184,232,0.40)', fontFamily: 'Satoshi-Bold', letterSpacing: 1.3, marginRight: 3 }}>{t('profile.mood')}</Text>
      {MOOD_ORBS.map(({ key, accent }, idx) => {
        const sel = currentMood === key;
        return (
          <Animated.View key={key} style={{ transform: [{ scale: scales[idx] }] }}>
            <TouchableOpacity
              style={{ width: sel ? 22 : 17, height: sel ? 22 : 17, borderRadius: 11, backgroundColor: accent, opacity: sel ? 1 : 0.32, borderWidth: sel ? 2 : 0, borderColor: 'rgba(255,255,255,0.80)' }}
              onPress={() => select(key, idx)}
              activeOpacity={0.75}
            />
          </Animated.View>
        );
      })}
      <View style={{ flex: 1 }} />
      <Text style={{ fontSize: 12, color: '#9B78FF', fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 }}>
        {currentMood}
      </Text>
    </View>
  );
}

// ── CharacterAuraHeader ────────────────────────────────────────────────────────

export function CharacterAuraHeader({ mood, paddingTop, activeEffect, coverImageUri, children }: {
  mood: string;
  paddingTop: number;
  activeEffect?: string;
  coverImageUri?: string | null;
  children: React.ReactNode;
}) {
  const aura   = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const { isDark } = useTheme();
  const colors = useColors();
  const heroColors: React.ComponentProps<typeof LinearGradient>['colors'] = isDark
    ? aura.gradient
    : [colors.background, colors.card, `${aura.accent}25`];
  const { width: screenW } = useWindowDimensions();
  const { reduceMotion, animate } = useDecorativeMotion();
  const breatheAnim   = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    PARTICLE_XS.map(() => ({ y: new Animated.Value(0), op: new Animated.Value(0) }))
  ).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breatheAnim, animate]);

  useEffect(() => {
    if (!animate) return;
    const H = 280;
    const loops = particleAnims.slice(0, aura.count).map((p, i) => {
      p.y.setValue(-(i * (H / aura.count)));
      p.op.setValue(0);
      const loop = Animated.loop(Animated.sequence([
        Animated.delay(i * (aura.speed / aura.count)),
        Animated.parallel([
          Animated.timing(p.y,  { toValue: -H - 20, duration: aura.speed * 1.5, easing: Easing.linear, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(p.op, { toValue: 0.70, duration: aura.speed * 0.18, useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0.70, duration: aura.speed * 0.64, useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0,    duration: aura.speed * 0.18, useNativeDriver: true }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(p.y,  { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ]));
      loop.start();
      return loop;
    });
    return () => loops.forEach(l => l.stop());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, animate]);

  const glowOpacity    = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.18, 0.06] });
  const glowScale      = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.80, 1.18] });
  const glow2Opacity   = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.03, 0.12, 0.03] });
  const cornerOpacity  = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.22, 0.08] });
  const corner2Opacity = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.05, 0.15, 0.05] });

  return (
    <View style={[s.header, { paddingTop, overflow: 'hidden', backgroundColor: colors.background }]}>
      <LinearGradient colors={heroColors} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />
      {coverImageUri ? (
        <>
          <Image source={{ uri: coverImageUri }} style={s.coverImage} contentFit="cover" />
          <LinearGradient
            colors={isDark
              ? ['rgba(10,8,24,0.58)', 'rgba(10,8,24,0.76)', colors.background]
              : ['rgba(24,20,38,0.48)', 'rgba(24,20,38,0.70)', colors.background]}
            locations={[0, 0.68, 1]}
            style={s.coverVeil}
          />
        </>
      ) : null}
      {activeEffect && animate && <ProfileEffect effectId={activeEffect} />}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: paddingTop * 0.1, left: -screenW * 0.1, width: screenW * 1.2, height: screenW * 1.2, borderRadius: screenW * 0.6, backgroundColor: aura.accent, opacity: glow2Opacity, transform: [{ scale: glowScale }] }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: paddingTop * 0.4, left: screenW * 0.15, width: screenW * 0.70, height: screenW * 0.70, borderRadius: screenW * 0.35, backgroundColor: aura.accent, opacity: glowOpacity, transform: [{ scale: glowScale }] }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: aura.accent, opacity: cornerOpacity }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: -30, left: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: aura.accent, opacity: corner2Opacity }} />
      {!reduceMotion && particleAnims.slice(0, aura.count).map((p, i) => (
        <Animated.Text
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', bottom: 28, left: PARTICLE_XS[i % PARTICLE_XS.length] * screenW, fontSize: PARTICLE_SIZES[i % PARTICLE_SIZES.length], color: aura.accent, opacity: p.op, transform: [{ translateY: p.y }] }}
        >
          {aura.particle}
        </Animated.Text>
      ))}
      {children}
    </View>
  );
}

export { ACCENT_CONFIGS, FRAME_CONFIGS };

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  coverImage: { position: 'absolute', top: 0, left: 0, right: 0, height: 230, opacity: 0.94 },
  coverVeil: { position: 'absolute', top: 0, left: 0, right: 0, height: 242 },
});
