import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type ActivityIndicatorProps, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { SkeletonCard } from '@/components/Skeleton';
import { StorigamLogo, useBrandReducedMotion } from '@/components/StorigamBrand';

/** The supplied Storigam symbol, animated without changing its orientation. */
export function StorigamLoadingMark({
  size = 32, color, accessible = true,
}: { size?: number; color?: string; accessible?: boolean }) {
  const { t } = useTranslation();
  return (
    <View accessible={accessible} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} accessibilityState={{ busy: true }}>
      <StorigamLogo size={size} color={color} accessible={false} />
    </View>
  );
}

/** Compatible with existing native loading indicators, including button states. */
export function StorigamActivityIndicator({
  size = 'small', color, style, animating = true, hidesWhenStopped = true,
  accessible = true, ...viewProps
}: Omit<ActivityIndicatorProps, 'color'> & { color?: string }) {
  const { t } = useTranslation();
  if (!animating && hidesWhenStopped) return null;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      accessibilityState={{ busy: animating }}
      {...viewProps}
      accessible={accessible}
      style={[styles.indicator, style]}
    >
      <StorigamLogo size={size === 'large' ? 36 : size === 'small' ? 20 : size} color={color} animated={animating} accessible={false} />
    </View>
  );
}

/**
 * Shared compact waiting mark: the bundled Storigam symbol gently travels left
 * and right. Only transform/translateX is animated (no spin/scale), with the
 * native driver on native and JS driver on web, consistently for this view.
 * Reduced motion keeps it centered and still.
 */
export function StorigamTravelMark({ size = 34 }: { size?: number }) {
  const reduceMotion = useBrandReducedMotion();
  const position = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reduceMotion) {
      position.stopAnimation();
      position.setValue(0.5);
      return;
    }
    const useNativeDriver = Platform.OS !== 'web';
    const easing = Easing.inOut(Easing.sin);
    position.setValue(0.5);
    const movement = Animated.loop(
      Animated.sequence([
        Animated.timing(position, { toValue: 1, duration: 520, easing, useNativeDriver }),
        Animated.timing(position, { toValue: 0, duration: 1040, easing, useNativeDriver }),
        Animated.timing(position, { toValue: 0.5, duration: 520, easing, useNativeDriver }),
      ]),
    );
    movement.start();
    return () => {
      movement.stop();
      position.stopAnimation();
    };
  }, [position, reduceMotion]);

  const travel = Math.round(size * 0.32);
  const translateX = position.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });

  return (
    <Animated.View style={{ transform: [{ translateX }] }}>
      <StorigamLogo size={size} animated={false} accessible={false} />
    </Animated.View>
  );
}

/** Theme-aware compact waiting surface used by every in-app loader. */
function CompactWaiting({ message, transparent = false }: { message?: string; transparent?: boolean }) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const transparentOverlay = isDark ? colors.overlay : 'rgba(252,251,248,0.96)';
  return (
    <View
      style={[
        styles.screenOverlay,
        { backgroundColor: colors.background },
        transparent && [StyleSheet.absoluteFillObject, { backgroundColor: transparentOverlay, zIndex: 9999 }],
      ]}
      accessible
      accessibilityViewIsModal
      accessibilityRole="progressbar"
      accessibilityLabel={message || t('common.loading')}
      accessibilityState={{ busy: true }}
    >
      <StorigamTravelMark size={34} />
      {!!message && (
        <Text style={[styles.message, { color: colors.mutedForeground }]} numberOfLines={2}>
          {message}
        </Text>
      )}
    </View>
  );
}

/** Opening a conversation: same compact, theme-aware waiting style. */
export function ConversationLoadingOverlay() {
  return <CompactWaiting />;
}

/**
 * Compact in-app loader. The large lockup + fluid backdrop is reserved for
 * AppSplashScreen only; this export stays compact for compatibility.
 */
export function StorigamLoadingOverlay({
  message, transparent = false,
}: { message?: string; transparent?: boolean }) {
  return <CompactWaiting message={message} transparent={transparent} />;
}

/** Compact animated loader for in-app screens while navigation data loads. */
export function StorigamScreenLoadingOverlay({
  message, transparent = false,
}: { message?: string; transparent?: boolean }) {
  return <CompactWaiting message={message} transparent={transparent} />;
}

// All in-app waiting is compact; only AppSplashScreen shows the full brand.
export const SkyLoadingMark = StorigamLoadingMark;
export const SkyLoadingOverlay = StorigamScreenLoadingOverlay;

export function LoadingCard({ style }: { style?: ViewStyle }) {
  return <SkeletonCard style={style} />;
}

const styles = StyleSheet.create({
  indicator: { alignItems: 'center', justifyContent: 'center' },
  screenOverlay: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 12 },
  message: { fontSize: 12, lineHeight: 17, fontFamily: 'Satoshi-Medium', textAlign: 'center', paddingHorizontal: 32, letterSpacing: 0.2 },
});
