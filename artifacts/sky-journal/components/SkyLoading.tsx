import React from 'react';
import { StyleSheet, Text, View, type ActivityIndicatorProps, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { SkeletonCard } from '@/components/Skeleton';
import { StorigamAnimatedMark } from '@/components/StorigamAnimatedMark';

/** The supplied Storigam symbol, animated in place. */
export function StorigamLoadingMark({
  size = 32, color, accessible = true,
}: { size?: number; color?: string; accessible?: boolean }) {
  const { t } = useTranslation();
  return (
    <View accessible={accessible} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} accessibilityState={{ busy: true }}>
      <StorigamAnimatedMark size={size} color={color} accessible={false} />
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
      <StorigamAnimatedMark
        size={size === 'large' ? 36 : size === 'small' ? 20 : size}
        color={color}
        animated={animating}
        accessible={false}
      />
    </View>
  );
}

/**
 * Shared compact waiting mark: the supplied red-outline S/play symbol animates
 * in place. Reduced motion keeps it fully visible and still.
 */
export function StorigamTravelMark({ size = 34 }: { size?: number }) {
  return <StorigamAnimatedMark size={size} accessible={false} />;
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
      pointerEvents={transparent ? 'none' : 'auto'}
      accessible
      accessibilityViewIsModal={!transparent}
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
