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

export type DpCompanionFrameId =
  | 'frame_baby_dragon'
  | 'frame_moon_bunny'
  | 'frame_shadow_keeper'
  | 'frame_forest_spirit'
  | 'frame_star_guardian';

/** Includes the full 112px frame artwork plus the longest animated ear tips. */
export const ANIMAL_EAR_FRAME_RENDER_BOUNDS = 204;
/** Full companion illustration is sized to the portrait plus its extended wings and tail. */
export const DP_COMPANION_FRAME_RENDER_BOUNDS = 204;

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

const DP_COMPANION_FRAME_IDS: ReadonlySet<string> = new Set([
  'frame_baby_dragon',
  'frame_moon_bunny',
  'frame_shadow_keeper',
  'frame_forest_spirit',
  'frame_star_guardian',
]);

export function isDpCompanionFrameId(frameId: string): frameId is DpCompanionFrameId {
  return DP_COMPANION_FRAME_IDS.has(frameId);
}

export function isProfileCompanionFrameId(frameId: string): frameId is AnimalEarFrameId | DpCompanionFrameId {
  return isAnimalEarFrameId(frameId) || isDpCompanionFrameId(frameId);
}

export function getProfileCompanionRenderBounds(frameId: string): number | undefined {
  if (isDpCompanionFrameId(frameId)) return DP_COMPANION_FRAME_RENDER_BOUNDS;
  if (isAnimalEarFrameId(frameId)) return ANIMAL_EAR_FRAME_RENDER_BOUNDS;
  return undefined;
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
  const bodyBreath = useSharedValue(0);
  const compact = size <= 64;
  const rootY = size * (compact ? 0.24 : art.rootY);
  const earLength = size * (compact ? 0.48 : art.earLength);
  const earWidth = size * 0.5;
  const ringDiameter = size * (compact ? 1.34 : 1.46);
  const bodyMotionEnabled = motionEnabled && !compact && (layer === 'ornament' || layer === 'all');

  useEffect(() => {
    cancelAnimation(bodyBreath);
    if (!bodyMotionEnabled) {
      bodyBreath.value = 0;
      return;
    }

    bodyBreath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.sin) }),
        withDelay(700, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(bodyBreath);
  }, [bodyBreath, bodyMotionEnabled]);

  const bodyMotionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -bodyBreath.value * size * 0.008 },
      { scale: 1 - bodyBreath.value * 0.008 },
    ],
  }));

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
              centerY={rootY}
              motionEnabled={motionEnabled}
            />
            <AnimatedEar
              side="right"
              source={art.earSource}
              size={size}
              width={earWidth}
              height={earLength}
              centerY={rootY}
              motionEnabled={motionEnabled}
            />
          </>
        )}

        {(layer === 'ornament' || layer === 'all') && art.ringSource && (
          <Animated.View
            style={{
              position: 'absolute',
              width: ringDiameter,
              height: ringDiameter,
              left: (size - ringDiameter) / 2,
              top: (size - ringDiameter) / 2,
            }}
          >
            <Animated.View style={[StyleSheet.absoluteFill, bodyMotionStyle]}>
              <Image
                accessible={false}
                source={art.ringSource}
                resizeMode="contain"
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
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
  centerY: number;
  motionEnabled: boolean;
}

function AnimatedEar({
  side,
  source,
  size,
  width,
  height,
  centerY,
  motionEnabled,
}: AnimatedEarProps) {
  const flick = useSharedValue(0);
  const sway = useSharedValue(0);
  const isLeft = side === 'left';
  const delay = isLeft ? 380 : 1120;
  const rest = isLeft ? 2100 : 2460;
  const centerX = size * (isLeft ? 0.19 : 0.81);
  const split = height * 0.62;
  const overlap = Math.min(size * 0.035, height * 0.06);
  const phaseOffset = isLeft ? 0.4 : 2.15;

  useEffect(() => {
    cancelAnimation(flick);
    cancelAnimation(sway);
    if (!motionEnabled) {
      flick.value = 0;
      sway.value = 0;
      return;
    }

    sway.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 4300, easing: Easing.linear }),
      -1,
      false,
    );
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

    return () => {
      cancelAnimation(flick);
      cancelAnimation(sway);
    };
  }, [delay, flick, motionEnabled, rest, sway]);

  const rootMotionStyle = useAnimatedStyle(() => {
    const amount = flick.value;
    const direction = isLeft ? 1 : -1;
    const wave = Math.sin(sway.value + phaseOffset);
    const baseAngle = isLeft ? -1.1 : 1.1;
    return {
      transform: [
        { translateX: wave * size * 0.002 },
        { translateY: -Math.max(0, wave) * size * 0.004 - Math.sin(amount * Math.PI) * size * 0.008 },
        { rotate: `${baseAngle + wave * 1.2 + direction * amount * 4.2}deg` },
      ],
    };
  });
  const tipMotionStyle = useAnimatedStyle(() => {
    const wave = Math.sin(sway.value + phaseOffset + 0.85);
    const followThrough = Math.sin(sway.value * 1.35 + phaseOffset) * 0.45;
    const direction = isLeft ? 1 : -1;
    return {
      transform: [{ rotate: `${wave * 1.7 + followThrough + direction * flick.value * 4.4}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.earJoint,
        { left: centerX, top: centerY },
        rootMotionStyle,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -width / 2,
          top: -height + split - overlap,
          width,
          height: height - split + overlap,
          overflow: 'hidden',
        }}
      >
        <Image
          accessible={false}
          source={source}
          resizeMode="contain"
          style={[
            styles.earImage,
            { width, height, top: -(split - overlap), transform: [{ scaleX: isLeft ? 1 : -1 }] },
          ]}
        />
      </View>
      <Animated.View
        style={[
          styles.earTipJoint,
          { top: -height + split },
          tipMotionStyle,
        ]}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -width / 2,
            top: -split,
            width,
            height: split + overlap,
            overflow: 'hidden',
          }}
        >
          <Image
            accessible={false}
            source={source}
            resizeMode="contain"
            style={[
              styles.earImage,
              { width, height, transform: [{ scaleX: isLeft ? 1 : -1 }] },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    overflow: 'visible',
  },
  earJoint: {
    position: 'absolute',
    overflow: 'visible',
    width: 1,
    height: 1,
  },
  earTipJoint: {
    position: 'absolute',
    overflow: 'visible',
    width: 1,
    height: 1,
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
