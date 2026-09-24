import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, useWindowDimensions, View } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SPLASH_IMAGE = require('../assets/images/ximo_splash.jpg');

interface Props {
  onReady: () => void;
  ready?: boolean;
}

export function AppSplashScreen({ onReady, ready = true }: Props) {
  const { width, height } = useWindowDimensions();
  const [imageLoaded, setImageLoaded] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const startedAt = Date.now();
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true })
        .start(() => onReadyRef.current());
    };
    const minimumTimer = setTimeout(() => {
      if (ready && imageLoaded) dismiss();
    }, Math.max(0, 1200 - (Date.now() - startedAt)));
    const maximumTimer = setTimeout(dismiss, 6000);
    return () => {
      clearTimeout(minimumTimer);
      clearTimeout(maximumTimer);
      fade.stopAnimation();
    };
  }, [ready, imageLoaded, fade]);

  return (
    <Animated.View
      style={[styles.root, { opacity: fade }]}
      pointerEvents="none"
      accessible
      accessibilityViewIsModal
      accessibilityLabel="Loading Ximo"
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
    >
      <Image
        source={SPLASH_IMAGE}
        style={{ width, height }}
        resizeMode="cover"
        fadeDuration={0}
        onLoad={() => setImageLoaded(true)}
        onError={error => console.warn('[Ximo splash] Image failed to load', error.nativeEvent)}
      />
      <View style={[styles.loading, { bottom: Math.max(32, height * 0.055) }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, alignItems: 'center', backgroundColor: '#D7D8FC' },
  loading: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(28, 18, 66, 0.44)',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});