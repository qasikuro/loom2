import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  Stop,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';

// Reuse the app's detailed, transparent feather artwork. Mirroring it keeps
// both wings visually matched without bundling a second large image.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const WING_IMAGE = require('../../assets/angel_wing_right.png');

type FounderProfileIntroProps = {
  title: string;
  closeLabel: string;
  onComplete: () => void;
};

export function FounderProfileIntro({
  title,
  closeLabel,
  onComplete,
}: FounderProfileIntroProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [motionPreferenceResolved, setMotionPreferenceResolved] = useState(false);
  const phase = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
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

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      enabled => {
        setReduceMotion(enabled);
        setMotionPreferenceResolved(true);
      },
    );
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

    const entrance = Animated.sequence([
      Animated.timing(phase, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(250),
      Animated.timing(phase, {
        toValue: 2,
        duration: 900,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const wingFlap = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, {
          toValue: 1,
          duration: 350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flap, {
          toValue: 0,
          duration: 350,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 2 },
    );
    const lightShimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 1 },
    );

    entrance.start(({ finished }) => {
      if (finished) onCompleteRef.current();
    });
    wingFlap.start();
    lightShimmer.start();

    return () => {
      entrance.stop();
      wingFlap.stop();
      lightShimmer.stop();
    };
  }, [flap, motionPreferenceResolved, phase, reduceMotion, shimmer]);

  const skipIntro = useCallback(() => {
    onCompleteRef.current();
  }, []);

  const stageWidth = Math.min(viewportWidth, 720);
  const stageHeight = viewportHeight;
  const centerX = stageWidth / 2;
  const wingSize = Math.min(stageWidth * 0.98, stageHeight * 0.58);
  const wingTop = Math.max(insets.top * 0.32, stageHeight * 0.018);
  const plaqueWidth = stageWidth * 0.88;
  const plaqueTop = Math.min(stageHeight * 0.39, Math.max(stageHeight * 0.32, insets.top + 190));
  const plaqueHeight = Math.min(78, Math.max(64, stageWidth * 0.19));

  const overlayOpacity = phase.interpolate({
    inputRange: [0, 0.86, 1, 1.08, 2],
    outputRange: [0, 1, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const backdropOpacity = phase.interpolate({
    inputRange: [0, 0.86, 1, 1.08, 2],
    outputRange: [0, 0.66, 0.82, 0.82, 0],
    extrapolate: 'clamp',
  });
  const artOpacity = phase.interpolate({
    inputRange: [0, 0.86, 1, 1.08, 2],
    outputRange: [0, 0.9, 1, 1, 0],
    extrapolate: 'clamp',
  });
  const artScale = phase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.58, 1, 1.32],
    extrapolate: 'clamp',
  });
  const artLift = phase.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [stageHeight * 0.12, 0, -stageHeight * 0.035],
    extrapolate: 'clamp',
  });
  const leftWingRotation = flap.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-4deg', '1.4deg', '-4deg'],
  });
  const rightWingRotation = flap.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['4deg', '-1.4deg', '4deg'],
  });
  const wingLift = flap.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -7, 0],
  });
  const gemShimmer = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const titleText = title.toLocaleUpperCase();
  const arcY = plaqueTop + plaqueHeight * 0.36;
  const arcControlY = plaqueTop - Math.min(70, stageWidth * 0.16);
  const wingImageStyle = { width: wingSize, height: wingSize };

  return (
    <View
      pointerEvents="auto"
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
    >
      <Animated.View
        pointerEvents="auto"
        style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}>
          <LinearGradient
            colors={[
              'rgba(9,5,22,0.94)',
              'rgba(23,10,43,0.76)',
              'rgba(7,4,18,0.94)',
            ]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.ambientGlow} />
        </Animated.View>

        <Animated.View
          style={[
            styles.stage,
            { width: stageWidth, height: stageHeight },
            {
              opacity: artOpacity,
              transform: [{ translateY: artLift }, { scale: artScale }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.wing,
              {
                width: wingSize,
                height: wingSize,
                left: centerX - wingSize * 0.86,
                top: wingTop,
                transform: [{ translateY: wingLift }, { rotate: leftWingRotation }],
              },
            ]}
          >
            <Image
              source={WING_IMAGE}
              resizeMode="contain"
              style={[styles.wingImage, wingImageStyle, { transform: [{ scaleX: -1 }] }]}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.wing,
              {
                width: wingSize,
                height: wingSize,
                left: centerX - wingSize * 0.14,
                top: wingTop,
                transform: [{ translateY: wingLift }, { rotate: rightWingRotation }],
              },
            ]}
          >
            <Image
              source={WING_IMAGE}
              resizeMode="contain"
              style={[styles.wingImage, wingImageStyle]}
            />
          </Animated.View>

          <Svg
            pointerEvents="none"
            width={stageWidth}
            height={stageHeight}
            viewBox={`0 0 ${stageWidth} ${stageHeight}`}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <SvgLinearGradient id="founderGem" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#F7D98C" />
                <Stop offset="0.42" stopColor="#A66DFF" />
                <Stop offset="1" stopColor="#4E2B89" />
              </SvgLinearGradient>
            </Defs>
            <Path
              d={`M ${stageWidth * 0.08} ${arcY} Q ${centerX} ${arcControlY} ${stageWidth * 0.92} ${arcY}`}
              fill="none"
              stroke="#F6D789"
              strokeOpacity="0.85"
              strokeWidth="1.5"
            />
            <Path
              d={`M ${stageWidth * 0.13} ${arcY + 8} Q ${centerX} ${arcControlY + 17} ${stageWidth * 0.87} ${arcY + 8}`}
              fill="none"
              stroke="#B891F2"
              strokeOpacity="0.7"
              strokeWidth="1"
            />
            <Circle cx={centerX} cy={plaqueTop - 12} r={30} fill="#A16CFF" opacity="0.16" />
            <Polygon
              points={`${centerX},${plaqueTop - 48} ${centerX + 27},${plaqueTop - 20} ${centerX},${plaqueTop + 8} ${centerX - 27},${plaqueTop - 20}`}
              fill="url(#founderGem)"
              stroke="#F9E5A8"
              strokeWidth="2"
            />
            <Polygon
              points={`${centerX},${plaqueTop - 39} ${centerX + 17},${plaqueTop - 20} ${centerX},${plaqueTop - 1} ${centerX - 17},${plaqueTop - 20}`}
              fill="#8752D8"
              stroke="#FFF0C0"
              strokeOpacity="0.8"
              strokeWidth="1"
            />
            <Path
              d={`M ${centerX} ${plaqueTop - 54} l 3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z`}
              fill="#FFF0B7"
            />
            <Path
              d={`M ${stageWidth * 0.13} ${plaqueTop - 30} l 2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z`}
              fill="#FFE3A0"
            />
            <Path
              d={`M ${stageWidth * 0.87} ${plaqueTop - 30} l 2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z`}
              fill="#D6B4FF"
            />
          </Svg>

          <Animated.View
            style={[
              styles.plaque,
              {
                width: plaqueWidth,
                height: plaqueHeight,
                top: plaqueTop,
                left: (stageWidth - plaqueWidth) / 2,
                opacity: artOpacity,
                transform: [
                  {
                    scale: phase.interpolate({
                      inputRange: [0, 0.5, 1.5, 2],
                      outputRange: [0.88, 1, 1.03, 1.16],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['rgba(46,27,66,0.96)', 'rgba(14,9,29,0.97)', 'rgba(35,20,53,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.plaqueInner} />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.founderTitle,
                { fontSize: Math.min(31, Math.max(22, stageWidth * 0.073)) },
              ]}
            >
              {titleText}
            </Text>
          </Animated.View>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.gemGlow,
              {
                left: centerX - 25,
                top: plaqueTop + plaqueHeight - 7,
                opacity: gemShimmer,
              },
            ]}
          />
        </Animated.View>
      </Animated.View>

      <Pressable
        onPress={skipIntro}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        testID="founder-profile-intro-close"
        style={[styles.closeButton, { top: Math.max(12, insets.top + 8) }]}
        hitSlop={12}
      >
        <Icon name="x" size={19} color="#F7E7B8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    overflow: 'visible',
  },
  ambientGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    top: '24%',
    alignSelf: 'center',
    borderRadius: 140,
    backgroundColor: 'rgba(139,83,220,0.18)',
  },
  wing: {
    position: 'absolute',
    overflow: 'hidden',
  },
  wingImage: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  plaque: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    borderColor: 'rgba(247,211,125,0.94)',
    borderWidth: 1.5,
    borderRadius: 8,
    shadowColor: '#C895FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.58,
    shadowRadius: 18,
    elevation: 16,
  },
  plaqueInner: {
    ...StyleSheet.absoluteFillObject,
    margin: 5,
    borderWidth: 1,
    borderColor: 'rgba(218,178,104,0.45)',
    borderRadius: 4,
  },
  founderTitle: {
    maxWidth: '88%',
    color: '#FFE7A4',
    fontFamily: 'serif',
    fontWeight: '700',
    letterSpacing: 4.2,
    textShadowColor: 'rgba(255,213,128,0.88)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    textAlign: 'center',
  },
  gemGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(179,114,255,0.16)',
    shadowColor: '#E3B7FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
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
