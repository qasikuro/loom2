import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, Text, type ViewStyle } from 'react-native';
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
       <SkyLoadingMark size={48} accessible={false} />
      {!!message && (
        <Text
          style={[styles.message, { color: colors.text || '#EAE6F8' }]}
          accessible={false}
          importantForAccessibility="no"
        >{message}</Text>
      )}
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
  message: {
    fontSize: 15,
    fontFamily: 'Satoshi-Medium',
    letterSpacing: 0.5,
  }
});