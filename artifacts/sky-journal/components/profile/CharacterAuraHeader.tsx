import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
  Animated, Easing, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { ProfileEffect } from '@/components/ProfileEffect';
import {
  ACCENT_CONFIGS, DEFAULT_AURA, FRAME_CONFIGS, MOOD_AURA, MOOD_ORBS,
  PARTICLE_SIZES, PARTICLE_XS,
} from './profileConstants';

// ── FrameRing ──────────────────────────────────────────────────────────────────

export function FrameRing({ frameId }: { frameId: string }) {
  const cfg     = FRAME_CONFIGS[frameId];
  const pulse   = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!cfg) return;
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
  }, [frameId]);

  if (!cfg) return null;

  const outerScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const outerOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.50, cfg.dashOpacity, 0.50] });
  const glowOpacity  = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.40, 0.12] });
  const glowScale    = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.20] });

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
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathe]);
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 2, flexWrap: 'wrap' }}>
      <Text style={{ fontSize: 9, color: 'rgba(200,184,232,0.40)', fontFamily: 'Satoshi-Bold', letterSpacing: 1.3, marginRight: 1 }}>VIBE</Text>
      {MOOD_ORBS.map(({ key, accent }, idx) => {
        const sel = currentMood === key;
        return (
          <Animated.View key={key} style={{ transform: [{ scale: scales[idx] }] }}>
            <TouchableOpacity
              style={{ width: sel ? 26 : 20, height: sel ? 26 : 20, borderRadius: 13, backgroundColor: accent, opacity: sel ? 1 : 0.30, borderWidth: sel ? 2 : 0, borderColor: 'rgba(255,255,255,0.80)' }}
              onPress={() => select(key, idx)}
              activeOpacity={0.75}
            />
          </Animated.View>
        );
      })}
      <Text style={{ fontSize: 11, color: 'rgba(200,184,232,0.65)', fontFamily: 'Satoshi-Medium', marginLeft: 2, fontStyle: 'italic' }}>
        {currentMood}
      </Text>
    </View>
  );
}

// ── CharacterAuraHeader ────────────────────────────────────────────────────────

export function CharacterAuraHeader({ mood, paddingTop, activeEffect, children }: {
  mood: string;
  paddingTop: number;
  activeEffect?: string;
  children: React.ReactNode;
}) {
  const aura   = MOOD_AURA[mood] ?? DEFAULT_AURA;
  const { width: screenW } = useWindowDimensions();
  const breatheAnim   = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    PARTICLE_XS.map(() => ({ y: new Animated.Value(0), op: new Animated.Value(0) }))
  ).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breatheAnim, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breatheAnim, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breatheAnim]);

  useEffect(() => {
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
  }, [mood]);

  const glowOpacity    = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.18, 0.06] });
  const glowScale      = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.80, 1.18] });
  const glow2Opacity   = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.03, 0.12, 0.03] });
  const cornerOpacity  = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.22, 0.08] });
  const corner2Opacity = breatheAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.05, 0.15, 0.05] });

  return (
    <View style={[s.header, { paddingTop, overflow: 'hidden' }]}>
      <LinearGradient colors={aura.gradient} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />
      {activeEffect && <ProfileEffect effectId={activeEffect} />}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: paddingTop * 0.1, left: -screenW * 0.1, width: screenW * 1.2, height: screenW * 1.2, borderRadius: screenW * 0.6, backgroundColor: aura.accent, opacity: glow2Opacity, transform: [{ scale: glowScale }] }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: paddingTop * 0.4, left: screenW * 0.15, width: screenW * 0.70, height: screenW * 0.70, borderRadius: screenW * 0.35, backgroundColor: aura.accent, opacity: glowOpacity, transform: [{ scale: glowScale }] }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: aura.accent, opacity: cornerOpacity }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: -30, left: -30, width: 130, height: 130, borderRadius: 65, backgroundColor: aura.accent, opacity: corner2Opacity }} />
      {particleAnims.slice(0, aura.count).map((p, i) => (
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
  header: { paddingHorizontal: 20, paddingBottom: 24 },
});
