import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { SkyIcon } from '@/components/SkyIcon';
import { SkeletonCard } from '@/components/Skeleton';

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReducedMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

/**
 * SkyLoadingMark: A small, ambient pulsing star for inline and button loading states.
 */
export function SkyLoadingMark({ 
  size = 32, 
  color,
  accessible = true,
}: { 
  size?: number; 
  color?: string;
  accessible?: boolean;
}) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      scale.setValue(1);
      opacity.setValue(1);
      rotation.setValue(0);
      return;
    }
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.05, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.85, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ])
    );
    
    // Slow, subtle rotation
    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    pulse.start();
    spin.start();
    
    return () => {
      pulse.stop();
      spin.stop();
    };
  }, [scale, opacity, rotation, reducedMotion]);

  const starColor = color || colors.gold || '#C8A84B';
  const spinInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <Animated.View 
      style={reducedMotion ? { opacity: 1 } : { transform: [{ scale }, { rotate: spinInterpolate }], opacity }} 
      accessible={accessible}
      accessibilityLabel={accessible ? 'Loading…' : undefined}
      accessibilityRole={accessible ? 'progressbar' : undefined}
      importantForAccessibility={accessible ? 'auto' : 'no'}
    >
      <SkyIcon name="sky-star" size={size} color={starColor} accentColor={starColor} strokeWidth={1.5} />
    </Animated.View>
  );
}

/**
 * SkyLoadingOverlay: A full-screen or absolute-fill ambient loading overlay.
 */
export function SkyLoadingOverlay({ 
  message, 
  transparent = false 
}: { 
  message?: string; 
  transparent?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const label = message || 'Loading…';
  const reducedMotion = useReducedMotion();
  const glowScale = useRef(new Animated.Value(0.82)).current;
  const glowOpacity = useRef(new Animated.Value(0.28)).current;
  const outerRingScale = useRef(new Animated.Value(0.76)).current;
  const outerRingOpacity = useRef(new Animated.Value(0.12)).current;
  const orbitRotation = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0.28)),
  ).current;

  useEffect(() => {
    if (reducedMotion) {
      glowScale.setValue(1);
      glowOpacity.setValue(0.42);
      outerRingScale.setValue(1);
      outerRingOpacity.setValue(0.22);
      orbitRotation.setValue(0);
      dotOpacity.forEach(dot => dot.setValue(0.7));
      return;
    }

    const glowPulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.12, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 0.82, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.58, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.28, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ]),
    );
    const ringPulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(outerRingScale, { toValue: 1.18, duration: 3300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(outerRingScale, { toValue: 0.76, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(outerRingOpacity, { toValue: 0, duration: 3300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(outerRingOpacity, { toValue: 0.12, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    const orbit = Animated.loop(
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 15000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const dots = dotOpacity.map((dot, index) => Animated.loop(
      Animated.sequence([
        Animated.delay(index * 180),
        Animated.timing(dot, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.28, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ));

    glowPulse.start();
    ringPulse.start();
    orbit.start();
    dots.forEach(dot => dot.start());

    return () => {
      glowPulse.stop();
      ringPulse.stop();
      orbit.stop();
      dots.forEach(dot => dot.stop());
    };
  }, [dotOpacity, glowOpacity, glowScale, orbitRotation, outerRingOpacity, outerRingScale, reducedMotion]);

  const orbitRotate = orbitRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View 
      style={[
        styles.overlay, 
        transparent ? styles.overlayTransparent : { backgroundColor: colors.background || '#1A1630' },
        { 
          paddingBottom: insets.bottom,
          paddingTop: insets.top,
        }
      ]}
      accessible={true}
      accessibilityViewIsModal={true}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      {!transparent && (
        <LinearGradient
          colors={[colors.background || '#0A0818', colors.night || '#04030C', colors.background || '#0A0818']}
          locations={[0, 0.52, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View style={styles.dust} pointerEvents="none">
        <View style={[styles.dustPoint, styles.dustPointOne, { backgroundColor: colors.lavender }]} />
        <View style={[styles.dustPoint, styles.dustPointTwo, { backgroundColor: colors.gold }]} />
        <View style={[styles.dustPoint, styles.dustPointThree, { backgroundColor: colors.skyBlue }]} />
        <View style={[styles.dustPoint, styles.dustPointFour, { backgroundColor: colors.lavender }]} />
        <View style={[styles.dustPoint, styles.dustPointFive, { backgroundColor: colors.gold }]} />
      </View>
      <View style={styles.content}>
        <View style={styles.starScene} accessible={false}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ambientGlow,
              {
                backgroundColor: colors.glowPurple || 'rgba(155,120,255,0.22)',
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.outerRing,
              {
                borderColor: colors.primary || '#9B78FF',
                opacity: outerRingOpacity,
                transform: [{ scale: outerRingScale }],
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[styles.innerRing, { borderColor: colors.glowPurple || 'rgba(155,120,255,0.22)' }]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.orbit, { transform: [{ rotate: orbitRotate }] }]}
          >
            <View style={[styles.orbitDot, { backgroundColor: colors.gold || '#E8B830' }]} />
            <View style={[styles.orbitDot, styles.orbitDotSecondary, { backgroundColor: colors.skyBlue || '#B8D4F0' }]} />
          </Animated.View>
          <View style={[styles.markPlate, { borderColor: colors.glowGold || 'rgba(232,184,48,0.22)' }]}>
            <SkyLoadingMark size={54} color={colors.gold || '#E8B830'} accessible={false} />
          </View>
        </View>
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground || 'rgba(210,196,240,0.62)' }]}>
            SKY JOURNAL
          </Text>
          {!!message && (
            <Text
              style={[styles.message, { color: colors.foreground || '#EDE8FF' }]}
              accessible={false}
              importantForAccessibility="no"
            >{message}</Text>
          )}
          <View style={styles.progressRow} accessible={false}>
            {dotOpacity.map((dot, index) => (
              <Animated.View
                key={index}
                style={[styles.progressDot, { backgroundColor: colors.primary || '#9B78FF', opacity: dot }]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * LoadingCard: A drop-in list item skeleton wrapper.
 */
export function LoadingCard({ style }: { style?: ViewStyle }) {
  return <SkeletonCard style={style} />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  overlayTransparent: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 22, 48, 0.75)',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100%',
  },
  starScene: {
    width: 164,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  outerRing: {
    position: 'absolute',
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 1,
  },
  innerRing: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1,
  },
  orbit: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  orbitDot: {
    position: 'absolute',
    top: 4,
    left: 73,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  orbitDotSecondary: {
    top: 141,
    left: 76,
    width: 3,
    height: 3,
  },
  markPlate: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(10,8,24,0.44)',
  },
  dust: {
    ...StyleSheet.absoluteFillObject,
  },
  dustPoint: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.42,
  },
  dustPointOne: { top: '24%', left: '18%' },
  dustPointTwo: { top: '31%', right: '16%', width: 2, height: 2 },
  dustPointThree: { top: '68%', left: '12%', width: 2, height: 2 },
  dustPointFour: { top: '76%', right: '20%' },
  dustPointFive: { top: '15%', right: '34%', width: 2, height: 2 },
  copy: {
    alignItems: 'center',
    marginTop: 18,
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 3,
    marginBottom: 12,
  },
  message: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Satoshi-Medium',
    letterSpacing: 0.15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 20,
    height: 8,
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  }
});