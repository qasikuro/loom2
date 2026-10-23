import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// React Native bundles local image assets through require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AURORA_CLOUDS = require('../../assets/images/profile_aurora_clouds.jpg');

/**
 * Atmospheric profile backdrop. Place inside a positioned, clipped container;
 * it expands to fill that parent and never intercepts touches.
 */
export default function AuroraCloudBackdrop() {
  const drift = useRef(new Animated.Value(0)).current;
  const veil = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => null);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      drift.stopAnimation();
      veil.stopAnimation();
      drift.setValue(0.5);
      veil.setValue(0.5);
      return;
    }

    const useNativeDriver = Platform.OS !== 'web';
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 38000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 38000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
      ]),
    );
    const veilLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(veil, {
          toValue: 1,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
        Animated.timing(veil, {
          toValue: 0,
          duration: 26000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver,
        }),
      ]),
    );

    driftLoop.start();
    veilLoop.start();
    return () => {
      driftLoop.stop();
      veilLoop.stop();
    };
  }, [drift, reduceMotion, veil]);

  const imageTransform = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-7, 7],
  });
  const auroraOpacity = veil.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.24],
  });

  return (
    <View pointerEvents="none" accessible={false} style={styles.backdrop}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.artwork,
          { transform: [{ translateX: imageTransform }, { translateY: imageTransform.interpolate({
            inputRange: [-7, 7],
            outputRange: [2, -2],
          }) }] },
        ]}
      >
        <Image
          source={AURORA_CLOUDS}
          resizeMode="cover"
          fadeDuration={0}
          style={styles.image}
        />
      </Animated.View>

      {/* A restrained cool veil keeps the profile's center readable. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(5, 7, 25, 0.18)',
          'rgba(5, 8, 26, 0.58)',
          'rgba(6, 8, 27, 0.48)',
          'rgba(5, 7, 25, 0.18)',
        ]}
        locations={[0, 0.34, 0.68, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(5, 7, 24, 0.08)', 'transparent', 'rgba(5, 7, 24, 0.62)']}
        locations={[0, 0.52, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: auroraOpacity }]}>
        <LinearGradient
          colors={['transparent', 'rgba(114, 91, 220, 0.16)', 'rgba(48, 150, 224, 0.12)', 'transparent']}
          locations={[0.04, 0.36, 0.73, 1]}
          start={{ x: 0.08, y: 0.18 }}
          end={{ x: 0.92, y: 0.84 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  artwork: {
    position: 'absolute',
    top: -5,
    bottom: -5,
    left: -8,
    right: -8,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
