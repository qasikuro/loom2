import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type AnimalEarFrameId =
  | 'frame_ember_fox_ears'
  | 'frame_moonhare_ears'
  | 'frame_frost_lynx_ears';

/** Includes the full 112px frame artwork plus the longest animated ear tips. */
export const ANIMAL_EAR_FRAME_RENDER_BOUNDS = 204;

type FrameLayer = 'wings' | 'ornament' | 'all';

const ANIMAL_FRAME_ART: Record<AnimalEarFrameId, {
  earSource: number;
  ringSource?: number;
  earLength: number;
  rootY: number;
}> = {
  frame_ember_fox_ears: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    earSource: require('../../assets/images/animal-ears/ember-fox-ear.png'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ringSource: require('../../assets/images/animal-ears/fox-hug-frame.png'),
    earLength: 0.48,
    rootY: 0.16,
  },
  frame_moonhare_ears: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    earSource: require('../../assets/images/animal-ears/rabbit-ear.png'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ringSource: require('../../assets/images/animal-ears/hare-hug-frame.png'),
    earLength: 0.68,
    rootY: 0.16,
  },
  frame_frost_lynx_ears: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    earSource: require('../../assets/images/animal-ears/lynx-ear.png'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ringSource: require('../../assets/images/animal-ears/lynx-hug-frame.png'),
    earLength: 0.5,
    rootY: 0.16,
  },
};

export function isAnimalEarFrameId(frameId: string): frameId is AnimalEarFrameId {
  return frameId in ANIMAL_FRAME_ART;
}

interface AnimalEarFrameArtProps {
  frameId: AnimalEarFrameId;
  size: number;
  layer: FrameLayer;
  motionEnabled: boolean;
  ringColor: string;
  ringGlow: string;
}

export function AnimalEarFrameArt({
  frameId,
  size,
  layer,
  motionEnabled,
  ringColor,
  ringGlow,
}: AnimalEarFrameArtProps) {
  const art = ANIMAL_FRAME_ART[frameId];
  const compact = size <= 64;
  const rootY = size * (compact ? 0.24 : art.rootY);
  const earLength = size * (compact ? 0.48 : art.earLength);
  const earWidth = size * 0.5;
  const pivotHeight = size * 0.82;
  const ringDiameter = size * (compact ? 1.34 : 1.46);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.stage,
          {
            width: size,
            height: size,
            left: '50%',
            top: '50%',
            marginLeft: -size / 2,
            marginTop: -size / 2,
          },
        ]}
      >
        {(layer === 'wings' || layer === 'all') && (
          <>
            <AnimatedEar
              side="left"
              source={art.earSource}
              size={size}
              width={earWidth}
              height={earLength}
              pivotHeight={pivotHeight}
              centerY={rootY}
              motionEnabled={motionEnabled}
            />
            <AnimatedEar
              side="right"
              source={art.earSource}
              size={size}
              width={earWidth}
              height={earLength}
              pivotHeight={pivotHeight}
              centerY={rootY}
              motionEnabled={motionEnabled}
            />
          </>
        )}

        {(layer === 'ornament' || layer === 'all') && art.ringSource && (
          <Image
            accessible={false}
            source={art.ringSource}
            resizeMode="contain"
            style={{
              position: 'absolute',
              width: ringDiameter,
              height: ringDiameter,
              left: (size - ringDiameter) / 2,
              top: (size - ringDiameter) / 2,
            }}
          />
        )}

        {(layer === 'ornament' || layer === 'all') && !art.ringSource && (
          <View
            style={[
              styles.tuftedHalo,
              {
                width: ringDiameter,
                height: ringDiameter,
                left: (size - ringDiameter) / 2,
                top: (size - ringDiameter) / 2,
                borderColor: ringColor,
                shadowColor: ringGlow,
                borderRadius: ringDiameter / 2,
                borderWidth: Math.max(1.5, size * 0.022),
                shadowRadius: size * 0.12,
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

interface AnimatedEarProps {
  side: 'left' | 'right';
  source: number;
  size: number;
  width: number;
  height: number;
  pivotHeight: number;
  centerY: number;
  motionEnabled: boolean;
}

function AnimatedEar({
  side,
  source,
  size,
  width,
  height,
  pivotHeight,
  centerY,
  motionEnabled,
}: AnimatedEarProps) {
  const flick = useSharedValue(0);
  const isLeft = side === 'left';
  const delay = isLeft ? 380 : 1120;
  const rest = isLeft ? 2100 : 2460;
  const centerX = size * (isLeft ? 0.19 : 0.81);

  useEffect(() => {
    cancelAnimation(flick);
    if (!motionEnabled) {
      flick.value = 0;
      return;
    }

    flick.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 170, easing: Easing.out(Easing.quad) }),
          withTiming(0.16, { duration: 300, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 390, easing: Easing.inOut(Easing.quad) }),
          withDelay(rest, withTiming(0, { duration: 1 })),
        ),
        -1,
        false,
      ),
    );

    return () => cancelAnimation(flick);
  }, [delay, flick, motionEnabled, rest]);

  const motionStyle = useAnimatedStyle(() => {
    const amount = flick.value;
    const direction = isLeft ? 1 : -1;
    const baseAngle = isLeft ? -2 : 2;
    return {
      transform: [
        { translateY: -Math.sin(amount * Math.PI) * size * 0.018 },
          { rotate: `${baseAngle + direction * amount * 10}deg` },
      ],
    };
  });

  return (
    <View
      style={[
        styles.earPivot,
        {
          width,
          height: pivotHeight,
          left: centerX - width / 2,
          top: centerY - pivotHeight / 2,
        },
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, motionStyle]}>
        <Image
          accessible={false}
          source={source}
          resizeMode="contain"
          style={[
            styles.earImage,
            {
              width,
              height,
              bottom: pivotHeight / 2,
              transform: [{ scaleX: isLeft ? 1 : -1 }],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    overflow: 'visible',
  },
  earPivot: {
    position: 'absolute',
    overflow: 'visible',
  },
  earImage: {
    position: 'absolute',
    left: 0,
  },
  tuftedHalo: {
    position: 'absolute',
    backgroundColor: 'transparent',
    opacity: 0.86,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
});
