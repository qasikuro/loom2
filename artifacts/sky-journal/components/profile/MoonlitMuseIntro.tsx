import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MOONLIT_MUSE_IMAGE = require('../../assets/moonlit_muse.png');
const ANIMATION_DURATION_MS = 1300;

type MoonlitMuseIntroProps = {
  closeLabel: string;
  onComplete: () => void;
};

const SPARKS = [
  { x: 0.14, y: 0.31, size: 18, glyph: '✦' },
  { x: 0.83, y: 0.25, size: 15, glyph: '✧' },
  { x: 0.09, y: 0.57, size: 13, glyph: '✧' },
  { x: 0.88, y: 0.55, size: 20, glyph: '✦' },
  { x: 0.24, y: 0.77, size: 12, glyph: '·' },
  { x: 0.76, y: 0.78, size: 12, glyph: '·' },
];

export function MoonlitMuseIntro({ closeLabel, onComplete }: MoonlitMuseIntroProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [motionPreferenceResolved, setMotionPreferenceResolved] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        if (!mounted) return;
        setReduceMotion(enabled);
        setMotionPreferenceResolved(true);
      })
      .catch(() => {
        if (mounted) setMotionPreferenceResolved(true);
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      setReduceMotion(enabled);
      setMotionPreferenceResolved(true);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!motionPreferenceResolved) return;
    if (reduceMotion) {
      onCompleteRef.current();
      return;
    }

    const entrance = Animated.timing(progress, {
      toValue: 1,
      duration: ANIMATION_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    entrance.start(({ finished }) => {
      if (finished) onCompleteRef.current();
    });
    return () => entrance.stop();
  }, [motionPreferenceResolved, progress, reduceMotion]);

  const stageSize = Math.min(width * 0.94, height * 0.62, 520);
  const stageLeft = (width - stageSize) / 2;
  const stageTop = Math.max(insets.top + 36, (height - stageSize) * 0.37);

  const veilOpacity = progress.interpolate({
    inputRange: [0, 0.18, 0.78, 1],
    outputRange: [0, 0.88, 0.88, 0],
    extrapolate: 'clamp',
  });
  const artworkOpacity = progress.interpolate({
    inputRange: [0, 0.15, 0.72, 1],
    outputRange: [0, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const artworkScale = progress.interpolate({
    inputRange: [0, 0.28, 0.76, 1],
    outputRange: [0.44, 1.02, 1.12, 1.36],
    extrapolate: 'clamp',
  });
  const artworkLift = progress.interpolate({
    inputRange: [0, 0.28, 0.76, 1],
    outputRange: [stageSize * 0.09, 0, -stageSize * 0.015, -stageSize * 0.07],
    extrapolate: 'clamp',
  });
  const orbitRotation = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['-18deg', '22deg'],
  });
  const orbitScale = progress.interpolate({
    inputRange: [0, 0.28, 0.76, 1],
    outputRange: [0.76, 1, 1.04, 1.16],
    extrapolate: 'clamp',
  });
  const heartScale = progress.interpolate({
    inputRange: [0, 0.42, 0.58, 0.74, 1],
    outputRange: [0.1, 0.1, 1.14, 0.9, 1.45],
    extrapolate: 'clamp',
  });
  const heartOpacity = progress.interpolate({
    inputRange: [0, 0.42, 0.52, 0.78, 1],
    outputRange: [0, 0, 1, 0.8, 0],
    extrapolate: 'clamp',
  });
  const skipIntro = useCallback(() => onCompleteRef.current(), []);

  return (
    <View
      pointerEvents="auto"
      accessibilityViewIsModal
      style={StyleSheet.absoluteFill}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: veilOpacity }]}
      >
        <LinearGradient
          colors={[
            'rgba(11,5,22,0.90)',
            'rgba(28,10,45,0.76)',
            'rgba(10,5,20,0.90)',
          ]}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.ambientGlow, { width: stageSize * 1.18, height: stageSize * 1.18, borderRadius: stageSize * 0.59, top: stageTop + stageSize * 0.16, left: (width - stageSize * 1.18) / 2 }]} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.stage,
          {
            width: stageSize,
            height: stageSize,
            left: stageLeft,
            top: stageTop,
            opacity: artworkOpacity,
            transform: [{ translateY: artworkLift }, { scale: artworkScale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.orbit,
            {
              width: stageSize * 0.9,
              height: stageSize * 0.9,
              left: stageSize * 0.05,
              top: stageSize * 0.05,
              opacity: artworkOpacity,
              transform: [{ rotate: orbitRotation }, { scale: orbitScale }],
            },
          ]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Ellipse
              cx="50"
              cy="50"
              rx="44"
              ry="25"
              fill="none"
              stroke="#D5A8FF"
              strokeOpacity="0.66"
              strokeWidth="0.8"
            />
            <Ellipse
              cx="50"
              cy="50"
              rx="35"
              ry="43"
              fill="none"
              stroke="#F2C9FF"
              strokeOpacity="0.36"
              strokeWidth="0.55"
            />
            <Path
              d="M8 58 C22 17 73 10 94 44"
              fill="none"
              stroke="#EBAAFF"
              strokeOpacity="0.8"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <Circle cx="8" cy="58" r="2.2" fill="#FFE1F7" />
            <Circle cx="94" cy="44" r="1.7" fill="#E4C0FF" />
          </Svg>
        </Animated.View>

        <Image
          source={MOONLIT_MUSE_IMAGE}
          resizeMode="contain"
          style={styles.character}
        />

        <Animated.Text
          style={[
            styles.heart,
            {
              left: stageSize * 0.70,
              top: stageSize * 0.28,
              opacity: heartOpacity,
              transform: [{ scale: heartScale }, { rotate: '12deg' }],
            },
          ]}
        >
          ♡
        </Animated.Text>
      </Animated.View>

      {SPARKS.map((spark, index) => {
        const start = 0.08 + index * 0.035;
        const middle = 0.42 + index * 0.025;
        const end = 0.82 + index * 0.018;
        const opacity = progress.interpolate({
          inputRange: [0, start, middle, end, 1],
          outputRange: [0, 0, 0.92, 0.42, 0],
          extrapolate: 'clamp',
        });
        const lift = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -stageSize * (0.055 + index * 0.006)],
        });
        const scale = progress.interpolate({
          inputRange: [0, middle, end, 1],
          outputRange: [0.45, 1.1, 0.82, 1.25],
          extrapolate: 'clamp',
        });
        return (
          <Animated.Text
            key={`moonlit-spark-${index}`}
            pointerEvents="none"
            style={[
              styles.spark,
              {
                left: width * spark.x,
                top: stageTop + stageSize * spark.y,
                fontSize: spark.size,
                color: index % 2 === 0 ? '#F5BFFF' : '#C6A5FF',
                opacity,
                transform: [{ translateY: lift }, { scale }],
              },
            ]}
          >
            {spark.glyph}
          </Animated.Text>
        );
      })}

      <Pressable
        onPress={skipIntro}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        testID="moonlit-muse-intro-close"
        hitSlop={12}
        style={[styles.closeButton, { top: Math.max(12, insets.top + 8) }]}
      >
        <Icon name="x" size={19} color="#F3D9FF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ambientGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(151,74,225,0.15)',
  },
  orbit: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  character: {
    width: '100%',
    height: '100%',
  },
  heart: {
    position: 'absolute',
    fontSize: 44,
    lineHeight: 50,
    color: '#FF9DEB',
    textShadowColor: 'rgba(242,127,255,0.9)',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  spark: {
    position: 'absolute',
    fontWeight: '700',
    textShadowColor: 'rgba(212,145,255,0.9)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  closeButton: {
    position: 'absolute',
    right: 18,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
