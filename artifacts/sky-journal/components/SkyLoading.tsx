import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions, type ActivityIndicatorProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import themeColors from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { SkeletonCard } from '@/components/Skeleton';
import { StorigamFluidBackdrop, StorigamLogo, useBrandReducedMotion } from '@/components/StorigamBrand';

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

/** Compact black loader for opening a conversation. */
export function ConversationLoadingOverlay() {
  const { t } = useTranslation();
  const reduceMotion = useBrandReducedMotion();
  const position = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      position.setValue(0);
      return;
    }

    const movement = Animated.loop(
      Animated.sequence([
        Animated.timing(position, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(position, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    movement.start();
    return () => {
      movement.stop();
      position.stopAnimation();
    };
  }, [position, reduceMotion]);

  const translateX = position.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] });
  const label = t('common.loading');

  return (
    <View
      style={[styles.conversationLoading, { backgroundColor: themeColors.dark.night }]}
      accessible
      accessibilityViewIsModal
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <StorigamLogo size={38} animated={false} accessible={false} />
      </Animated.View>
      <Text style={styles.conversationLoadingLabel}>{label}</Text>
    </View>
  );
}

export function StorigamLoadingOverlay({
  message, transparent = false,
}: { message?: string; transparent?: boolean }) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const label = message || t('common.loading');
  const transparentOverlay = isDark ? colors.overlay : 'rgba(252,251,248,0.96)';
  return (
    <View
      style={[
        styles.overlay,
        { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
        transparent && [StyleSheet.absoluteFillObject, { backgroundColor: transparentOverlay, zIndex: 9999 }],
      ]}
      accessible
      accessibilityViewIsModal
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      {!transparent && <StorigamFluidBackdrop dark={isDark} />}
      <StorigamLogo size={Math.min(width * 0.68, height * 0.4, 320)} variant="lockup" dark={isDark} accessible={false} />
      <Text style={[styles.message, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

/** Compact animated loader for in-app screens while navigation data loads. */
export function StorigamScreenLoadingOverlay({
  message, transparent = false,
}: { message?: string; transparent?: boolean }) {
  const colors = useColors();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const transparentOverlay = isDark ? colors.overlay : 'rgba(252,251,248,0.96)';

  return (
    <View
      style={[
        styles.screenOverlay,
        { backgroundColor: colors.background },
        transparent && [
          StyleSheet.absoluteFillObject,
          { backgroundColor: transparentOverlay, zIndex: 9999 },
        ],
      ]}
      accessible
      accessibilityViewIsModal
      accessibilityRole="progressbar"
      accessibilityLabel={message || t('common.loading')}
      accessibilityState={{ busy: true }}
    >
      <StorigamActivityIndicator
        size={36}
        color={colors.primary}
        accessible={false}
      />
    </View>
  );
}

// Keep existing screen imports compact; app startup uses the full brand overlay.
export const SkyLoadingMark = StorigamLoadingMark;
export const SkyLoadingOverlay = StorigamScreenLoadingOverlay;

export function LoadingCard({ style }: { style?: ViewStyle }) {
  return <SkeletonCard style={style} />;
}

const styles = StyleSheet.create({
  indicator: { alignItems: 'center', justifyContent: 'center' },
  screenOverlay: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 24 },
  conversationLoading: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 10 },
  conversationLoadingLabel: { color: themeColors.dark.foreground, fontSize: 12, lineHeight: 18, fontFamily: 'Satoshi-Medium', letterSpacing: 0.4 },
  message: { zIndex: 1, fontSize: 14, lineHeight: 21, fontFamily: 'Satoshi-Medium', textAlign: 'center', paddingHorizontal: 24 },
});