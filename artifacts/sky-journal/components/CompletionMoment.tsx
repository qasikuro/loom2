import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type CompletionVariant = 'journal' | 'story' | 'witness';

interface Props {
  visible:  boolean;
  variant:  CompletionVariant;
  onFinish: () => void;
}

const COPY: Record<CompletionVariant, { headline: string; sub: string; icon: string; gradA: string; gradB: string }> = {
  journal:  { headline: 'Written to the Stars', sub: 'Your thoughts drift gently into the night sky',    icon: '✦', gradA: '#1A1240', gradB: '#2A1A52' },
  story:    { headline: 'Chapter Released',      sub: 'Your story floats out to find its readers',        icon: '◈', gradA: '#180A30', gradB: '#2A1450' },
  witness:  { headline: 'Your Light Reached Them', sub: 'A quiet warmth passes between kindred souls',   icon: '◉', gradA: '#1A1000', gradB: '#28180A' },
};

const STAR_COUNT = 7;
const DISPLAY_MS = 2000;

export function CompletionMoment({ visible, variant, onFinish }: Props) {
  const insets  = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.88)).current;
  const starAnims = useRef(
    Array.from({ length: STAR_COUNT }, () => ({
      opacity: new Animated.Value(0),
      y:       new Animated.Value(8),
    })),
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset
    opacity.setValue(0);
    scale.setValue(0.88);
    starAnims.forEach(s => { s.opacity.setValue(0); s.y.setValue(8); });

    // Fade-in + scale-up
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1,    duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1,    tension: 160, friction: 7, useNativeDriver: true }),
    ]).start();

    // Stagger star sparkles
    starAnims.forEach((s, i) => {
      const delay = 180 + i * 80;
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(s.opacity, { toValue: 0.7, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(s.y,       { toValue: 0,   duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.delay(300),
        Animated.timing(s.opacity, { toValue: 0, duration: 500, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    });

    // Auto-dismiss
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scale,   { toValue: 0.92, duration: 400, useNativeDriver: true }),
      ]).start(() => onFinish());
    }, DISPLAY_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const { headline, sub, icon, gradA, gradB } = COPY[variant];

  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={[gradA, gradB, '#040210']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
      />

      {/* Floating star sparkles */}
      {starAnims.map((s, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.sparkle,
            {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              left:    `${12 + i * 12}%` as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              top:     `${18 + (i % 3) * 14}%` as any,
              opacity: s.opacity,
              transform: [{ translateY: s.y }],
              fontSize: i % 2 === 0 ? 10 : 7,
            },
          ]}
        >
          ✦
        </Animated.Text>
      ))}

      <Animated.View style={[styles.card, { transform: [{ scale }], paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.iconGlyph}>{icon}</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.sub}>{sub}</Text>

        {/* Shimmer bar */}
        <View style={styles.shimmerWrap}>
          <View style={styles.shimmerLine} />
          <Text style={styles.shimmerDot}>✦</Text>
          <View style={styles.shimmerLine} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, zIndex: 999, justifyContent: 'center', alignItems: 'center' },
  sparkle:     { position: 'absolute', color: 'rgba(200,184,232,0.9)', fontFamily: Platform.OS === 'ios' ? 'System' : undefined },
  card:        { alignItems: 'center', paddingHorizontal: 32, paddingTop: 16 },
  iconGlyph:   { fontSize: 36, color: 'rgba(200,184,232,0.85)', marginBottom: 18, letterSpacing: 2 },
  headline:    { fontSize: 22, fontFamily: 'Satoshi-Bold', color: '#EEE8FF', letterSpacing: 0.3, textAlign: 'center', marginBottom: 10 },
  sub:         { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.65)', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  shimmerWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shimmerLine: { flex: 1, height: 1, backgroundColor: 'rgba(200,184,232,0.20)', maxWidth: 80 },
  shimmerDot:  { fontSize: 9, color: 'rgba(200,184,232,0.45)' },
});
