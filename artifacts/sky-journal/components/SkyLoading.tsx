import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ActivityIndicatorProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { SkeletonCard } from '@/components/Skeleton';
import { StorigamFluidBackdrop, StorigamLogo } from '@/components/StorigamBrand';

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

// Keep existing imports compatible; these names are not displayed in the app.
export const SkyLoadingMark = StorigamLoadingMark;
export const SkyLoadingOverlay = StorigamLoadingOverlay;

export function LoadingCard({ style }: { style?: ViewStyle }) {
  return <SkeletonCard style={style} />;
}

const styles = StyleSheet.create({
  indicator: { alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 24 },
  message: { zIndex: 1, fontSize: 14, lineHeight: 21, fontFamily: 'Satoshi-Medium', textAlign: 'center', paddingHorizontal: 24 },
});