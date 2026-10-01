import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { StorigamFluidBackdrop, StorigamLogo } from './StorigamBrand';
import { STORIGAM_BRAND } from '@/constants/brand';

interface Props {
  onReady: () => void;
  ready?: boolean;
}

export function AppSplashScreen({ onReady, ready = true }: Props) {
  const { width, height } = useWindowDimensions();
  const [artLoaded, setArtLoaded] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const artLoadedAt = useRef<number | null>(null);
  const dismissed = useRef(false);
  const finished = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onReadyRef.current();
  }, []);

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(finish);
  }, [fade, finish]);

  useEffect(() => {
    const maximum = setTimeout(dismiss, 6000);
    // Guarantee unmount even if native animation callbacks are delayed.
    const fallback = setTimeout(finish, 6500);
    return () => { clearTimeout(maximum); clearTimeout(fallback); fade.stopAnimation(); };
  }, [dismiss, finish, fade]);

  useEffect(() => {
    if (!ready || !artLoaded) return;
    const minimum = setTimeout(dismiss, Math.max(0, 1500 - (Date.now() - (artLoadedAt.current ?? Date.now()))));
    return () => clearTimeout(minimum);
  }, [ready, artLoaded, dismiss]);

  return (
    <Animated.View
      style={[styles.root, { opacity: fade }]}
      pointerEvents="none"
      accessible
      accessibilityLabel="Loading Storigam"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <StorigamFluidBackdrop dark />
      <View style={{ marginBottom: height * 0.09 }}>
        <StorigamLogo
        variant="lockup"
        size={Math.min(width * 0.7, height * 0.45, 400)}
        dark
        accessible={false}
          onLoad={() => {
            artLoadedAt.current ??= Date.now();
            setArtLoaded(true);
          }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STORIGAM_BRAND.background,
  },
});