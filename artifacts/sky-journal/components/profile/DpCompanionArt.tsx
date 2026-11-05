import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { DpCompanionFrameId } from './AnimalEarFrameArt';

type RiveRuntimeModule = typeof import('@rive-app/react-native');
let riveRuntime: RiveRuntimeModule | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    riveRuntime = require('@rive-app/react-native') as RiveRuntimeModule;
  } catch {
    // Expo Go does not include the native Rive module; keep the existing fallback.
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PROFILE_COMPANIONS_FILE = require('../../assets/rive/profile_companions.riv');

type MotionStyle = 'dragon' | 'bunny' | 'shadow' | 'forest' | 'star';
type MotionPartStyle = 'flap' | 'ear' | 'hug' | 'halo';

type CompanionMotionPart = {
  source: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  side: 'left' | 'right' | 'center';
  layer: 'wings' | 'ornament';
  motion: MotionPartStyle;
  amplitude: number;
  phaseOffset: number;
};

type CompanionArt = {
  source: number;
  parts: CompanionMotionPart[];
  motion: MotionStyle;
  eyeX: [number, number];
  eyeY: number;
  lidColor: string;
  lidStroke: string;
  eyeGlow?: string;
};

const COMPANION_ART: Record<DpCompanionFrameId, CompanionArt> = {
  frame_baby_dragon: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require('../../assets/images/dp-companions/rig/baby-dragon-base.png'),
    parts: [
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/dragon-wing-left.png'),
        x: 20, y: 108, width: 205, height: 246, pivotX: 204, pivotY: 148,
        side: 'left', layer: 'wings', motion: 'flap', amplitude: 3.4, phaseOffset: 0,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/dragon-wing-right.png'),
        x: 543, y: 108, width: 205, height: 246, pivotX: 564, pivotY: 148,
        side: 'right', layer: 'wings', motion: 'flap', amplitude: 3.4, phaseOffset: 0.72,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/dragon-paw-left.png'),
        x: 176, y: 364, width: 82, height: 100, pivotX: 239, pivotY: 394,
        side: 'left', layer: 'ornament', motion: 'hug', amplitude: 1.15, phaseOffset: 0,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/dragon-paw-right.png'),
        x: 510, y: 364, width: 82, height: 100, pivotX: 529, pivotY: 394,
        side: 'right', layer: 'ornament', motion: 'hug', amplitude: 1.15, phaseOffset: 0.35,
      },
    ],
    motion: 'dragon',
    eyeX: [0.42, 0.58],
    eyeY: 0.245,
    lidColor: '#B48BCC',
    lidStroke: '#714A84',
  },
  frame_moon_bunny: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require('../../assets/images/dp-companions/rig/moon-bunny-base.png'),
    parts: [
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/bunny-ear-left.png'),
        x: 24, y: 14, width: 203, height: 518, pivotX: 218, pivotY: 83,
        side: 'left', layer: 'wings', motion: 'ear', amplitude: 2.1, phaseOffset: 0,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/bunny-ear-right.png'),
        x: 541, y: 14, width: 203, height: 518, pivotX: 550, pivotY: 83,
        side: 'right', layer: 'wings', motion: 'ear', amplitude: 2.1, phaseOffset: 1.08,
      },
    ],
    motion: 'bunny',
    eyeX: [0.445, 0.555],
    eyeY: 0.265,
    lidColor: '#F2DEE5',
    lidStroke: '#9B697E',
  },
  frame_shadow_keeper: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require('../../assets/images/dp-companions/rig/shadow-keeper-base.png'),
    parts: [
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/shadow-ear-left.png'),
        x: 148, y: 2, width: 132, height: 170, pivotX: 270, pivotY: 148,
        side: 'left', layer: 'wings', motion: 'ear', amplitude: 2.8, phaseOffset: 0.4,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/shadow-ear-right.png'),
        x: 488, y: 2, width: 132, height: 170, pivotX: 498, pivotY: 148,
        side: 'right', layer: 'wings', motion: 'ear', amplitude: 2.8, phaseOffset: 1.55,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/shadow-paw-left.png'),
        x: 176, y: 394, width: 78, height: 84, pivotX: 244, pivotY: 421,
        side: 'left', layer: 'ornament', motion: 'hug', amplitude: 1.1, phaseOffset: 0.15,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/shadow-paw-right.png'),
        x: 514, y: 394, width: 78, height: 84, pivotX: 524, pivotY: 421,
        side: 'right', layer: 'ornament', motion: 'hug', amplitude: 1.1, phaseOffset: 0.5,
      },
    ],
    motion: 'shadow',
    eyeX: [0.42, 0.58],
    eyeY: 0.29,
    lidColor: '#251432',
    lidStroke: '#B66AFF',
    eyeGlow: '#C879FF',
  },
  frame_forest_spirit: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require('../../assets/images/dp-companions/rig/forest-spirit-base.png'),
    parts: [
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/forest-hand-left.png'),
        x: 184, y: 389, width: 76, height: 74, pivotX: 246, pivotY: 414,
        side: 'left', layer: 'ornament', motion: 'hug', amplitude: 1, phaseOffset: 0,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/forest-hand-right.png'),
        x: 508, y: 389, width: 76, height: 74, pivotX: 522, pivotY: 414,
        side: 'right', layer: 'ornament', motion: 'hug', amplitude: 1, phaseOffset: 0.4,
      },
    ],
    motion: 'forest',
    eyeX: [0.44, 0.56],
    eyeY: 0.27,
    lidColor: '#C3D0A8',
    lidStroke: '#61754F',
  },
  frame_star_guardian: {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    source: require('../../assets/images/dp-companions/rig/star-guardian-base.png'),
    parts: [
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/star-wing-left.png'),
        x: 4, y: 34, width: 264, height: 464, pivotX: 252, pivotY: 328,
        side: 'left', layer: 'wings', motion: 'flap', amplitude: 2.3, phaseOffset: 0.25,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/star-wing-right.png'),
        x: 500, y: 34, width: 264, height: 464, pivotX: 516, pivotY: 328,
        side: 'right', layer: 'wings', motion: 'flap', amplitude: 2.3, phaseOffset: 0.88,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/star-paw-left.png'),
        x: 230, y: 344, width: 62, height: 72, pivotX: 280, pivotY: 372,
        side: 'left', layer: 'ornament', motion: 'hug', amplitude: 1, phaseOffset: 0.1,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/star-paw-right.png'),
        x: 476, y: 344, width: 62, height: 72, pivotX: 488, pivotY: 372,
        side: 'right', layer: 'ornament', motion: 'hug', amplitude: 1, phaseOffset: 0.45,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source: require('../../assets/images/dp-companions/rig/star-halo.png'),
        x: 286, y: 0, width: 196, height: 100, pivotX: 384, pivotY: 50,
        side: 'center', layer: 'ornament', motion: 'halo', amplitude: 1.4, phaseOffset: 0,
      },
    ],
    motion: 'star',
    eyeX: [0.43, 0.57],
    eyeY: 0.275,
    lidColor: '#E6F0FC',
    lidStroke: '#6479A2',
  },
};

/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static image asset paths. */
const FULL_COMPANION_ART: Record<DpCompanionFrameId, number> = {
  frame_baby_dragon: require('../../assets/images/dp-companions/baby-dragon.png'),
  frame_moon_bunny: require('../../assets/images/dp-companions/moon-bunny.png'),
  frame_shadow_keeper: require('../../assets/images/dp-companions/shadow-keeper.png'),
  frame_forest_spirit: require('../../assets/images/dp-companions/forest-spirit.png'),
  frame_star_guardian: require('../../assets/images/dp-companions/star-guardian.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const ART_DIAMETER = 1.82;
const ART_SOURCE_SIZE = 768;
// The illustration's transparent portrait aperture is centered slightly low in
// the source artwork. This offset aligns it to the fixed avatar circle.
const ART_OFFSET_Y = -0.139;
const LOOP_DURATION = 3800;

const RIVE_ARTBOARDS: Record<DpCompanionFrameId, string> = {
  frame_baby_dragon: 'Baby Dragon',
  frame_moon_bunny: 'Moon Bunny',
  frame_shadow_keeper: 'Shadow Keeper',
  frame_forest_spirit: 'Forest Spirit',
  frame_star_guardian: 'Star Guardian',
};

type DpCompanionArtProps = {
  frameId: DpCompanionFrameId;
  size: number;
  layer: 'wings' | 'ornament' | 'all';
  motionEnabled: boolean;
};

export function DpCompanionArt(props: DpCompanionArtProps) {
  if (Platform.OS !== 'web' && riveRuntime && props.layer === 'wings') return null;
  if (Platform.OS !== 'web' && riveRuntime && props.motionEnabled && props.size > 64) {
    return <RiveDpCompanionArt {...props} />;
  }
  if (Platform.OS !== 'web' && (riveRuntime || !props.motionEnabled)) {
    return <StaticDpCompanionArt {...props} />;
  }
  return <DpCompanionArtFallback {...props} />;
}

function StaticDpCompanionArt({
  frameId,
  size,
  layer,
}: Pick<DpCompanionArtProps, 'frameId' | 'size' | 'layer'>) {
  if (layer === 'wings') return null;
  const artDiameter = size * ART_DIAMETER;
  const artOffset = size * ART_OFFSET_Y;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        accessible={false}
        source={FULL_COMPANION_ART[frameId]}
        resizeMode="contain"
        style={{
          position: 'absolute',
          width: artDiameter,
          height: artDiameter,
          left: '50%',
          top: '50%',
          marginLeft: -artDiameter / 2,
          marginTop: -artDiameter / 2 + artOffset,
        }}
      />
    </View>
  );
}

function RiveDpCompanionArt({
  frameId,
  size,
  layer,
  motionEnabled,
}: DpCompanionArtProps) {
  const { riveFile, error } = riveRuntime!.useRiveFile(PROFILE_COMPANIONS_FILE);
  const [viewFailed, setViewFailed] = useState(false);
  if (viewFailed || error || !riveFile) {
    return <StaticDpCompanionArt frameId={frameId} size={size} layer={layer} />;
  }

  const RiveView = riveRuntime!.RiveView;
  const art = COMPANION_ART[frameId];
  const artDiameter = size * ART_DIAMETER;
  const artOffset = size * ART_OFFSET_Y;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          left: '50%',
          top: '50%',
          marginLeft: -size / 2,
          marginTop: -size / 2,
          overflow: 'visible',
        }}
      >
        <RiveView
          file={riveFile}
          artboardName={RIVE_ARTBOARDS[frameId]}
          stateMachineName="CompanionLoop"
          autoPlay={motionEnabled}
          frameRate={60}
          fit={riveRuntime!.Fit.Contain}
          onError={() => setViewFailed(true)}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: artDiameter,
            height: artDiameter,
            left: (size - artDiameter) / 2,
            top: (size - artDiameter) / 2 + artOffset,
          }}
        />
        <CompanionFaceEffects
          frameId={frameId}
          art={art}
          size={size}
          artDiameter={artDiameter}
          artOffset={artOffset}
          layer={layer}
          motionEnabled={motionEnabled}
        />
      </View>
    </View>
  );
}

function CompanionFaceEffects({
  frameId,
  art,
  size,
  artDiameter,
  artOffset,
  layer,
  motionEnabled,
}: {
  frameId: DpCompanionFrameId;
  art: CompanionArt;
  size: number;
  artDiameter: number;
  artOffset: number;
  layer: DpCompanionArtProps['layer'];
  motionEnabled: boolean;
}) {
  const phase = useSharedValue(0);
  const blink = useSharedValue(0);
  const faceMotion = motionEnabled && layer !== 'wings';
  const eyePatchWidth = size * 0.18;
  const eyePatchHeight = size * 0.088;

  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(blink);
    if (!motionEnabled || size <= 0) {
      phase.value = 0;
      blink.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: LOOP_DURATION, easing: Easing.linear }),
      -1,
      false,
    );
    if (!faceMotion) {
      blink.value = 0;
      return;
    }
    blink.value = withRepeat(
      art.motion === 'bunny'
        ? withSequence(
            withDelay(1450, withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) })),
            withDelay(450, withTiming(1, { duration: 1 })),
            withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) }),
            withDelay(1449, withTiming(0, { duration: 1 })),
          )
        : withSequence(
            withDelay(1800, withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) })),
            withTiming(0, { duration: 130, easing: Easing.inOut(Easing.quad) }),
            withDelay(1779, withTiming(0, { duration: 1 })),
          ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(phase);
      cancelAnimation(blink);
    };
  }, [art.motion, blink, faceMotion, motionEnabled, phase, size]);

  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const noseStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(phase.value) * size * 0.004 }],
  }));
  const eyeGlowStyle = useAnimatedStyle(() => ({
    opacity: faceMotion ? 0.42 + (Math.sin(phase.value) + 1) * 0.2 : 0.42,
    transform: [{ scale: 0.9 + (Math.sin(phase.value) + 1) * 0.09 }],
  }));
  const eyeCenters = art.eyeX.map(x => ({
    left: size / 2 + (x - 0.5) * artDiameter - eyePatchWidth / 2,
    top: size / 2 - artDiameter / 2 + art.eyeY * artDiameter + artOffset - eyePatchHeight / 2,
  }));

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {eyeCenters.map((center, index) => (
        <React.Fragment key={`${frameId}-eye-${index}`}>
          <Animated.View
            style={[
              styles.closedEye,
              { left: center.left, top: center.top, width: eyePatchWidth, height: eyePatchHeight },
              blinkStyle,
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 48" preserveAspectRatio="none">
              <Path d="M5 25 C24 5 76 5 95 25 C77 37 23 37 5 25Z" fill={art.lidColor} />
              <Path d="M5 25 C26 42 74 42 95 25" fill="none" stroke={art.lidStroke} strokeWidth={5} strokeLinecap="round" />
              <Path d="M12 24 C32 13 68 13 88 24" fill="none" stroke={art.lidStroke} strokeOpacity={0.5} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </Animated.View>
          {art.eyeGlow && (
            <Animated.View
              style={[
                styles.eyeGlow,
                {
                  left: center.left + eyePatchWidth * 0.32,
                  top: center.top + eyePatchHeight * 0.2,
                  width: eyePatchWidth * 0.36,
                  height: eyePatchHeight * 0.58,
                  backgroundColor: art.eyeGlow,
                  shadowColor: art.eyeGlow,
                },
                eyeGlowStyle,
              ]}
            />
          )}
        </React.Fragment>
      ))}

      {art.motion === 'bunny' && (
        <Animated.View
          style={[
            styles.nose,
            {
              left: size / 2 - size * 0.012,
              top: size / 2 - artDiameter / 2 + artDiameter * 0.292 + artOffset,
              width: size * 0.024,
              height: size * 0.018,
            },
            noseStyle,
          ]}
        />
      )}

      {getParticleSpecs(art.motion).map((particle, index) => (
        <CompanionParticle
          key={`${frameId}-particle-${index}`}
          phase={phase}
          enabled={faceMotion}
          kind={particle.kind}
          color={particle.color}
          size={size * particle.size}
          left={size / 2 + (particle.x - 0.5) * artDiameter - size * particle.size / 2}
          top={size / 2 - artDiameter / 2 + particle.y * artDiameter + artOffset - size * particle.size / 2}
          phaseOffset={particle.phaseOffset}
        />
      ))}
    </Animated.View>
  );
}

function DpCompanionArtFallback({
  frameId,
  size,
  layer,
  motionEnabled,
}: {
  frameId: DpCompanionFrameId;
  size: number;
  layer: 'wings' | 'ornament' | 'all';
  motionEnabled: boolean;
}) {
  const art = COMPANION_ART[frameId];
  const phase = useSharedValue(0);
  const blink = useSharedValue(0);
  const faceMotion = motionEnabled && layer !== 'wings';
  const artDiameter = size * ART_DIAMETER;
  const artOffset = size * ART_OFFSET_Y;
  const eyePatchWidth = size * 0.18;
  const eyePatchHeight = size * 0.088;

  useEffect(() => {
    cancelAnimation(phase);
    cancelAnimation(blink);
    if (!motionEnabled || size <= 0) {
      phase.value = 0;
      blink.value = 0;
      return;
    }

    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: LOOP_DURATION, easing: Easing.linear }),
      -1,
      false,
    );
    if (faceMotion) {
      blink.value = withRepeat(
        art.motion === 'bunny'
          ? withSequence(
              withDelay(1450, withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) })),
              withDelay(450, withTiming(1, { duration: 1 })),
              withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) }),
              withDelay(1449, withTiming(0, { duration: 1 })),
            )
          : withSequence(
              withDelay(1800, withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) })),
              withTiming(0, { duration: 130, easing: Easing.inOut(Easing.quad) }),
              withDelay(1779, withTiming(0, { duration: 1 })),
            ),
        -1,
        false,
      );
    } else {
      blink.value = 0;
    }
    return () => {
      cancelAnimation(phase);
      cancelAnimation(blink);
    };
  }, [art.motion, blink, faceMotion, motionEnabled, phase, size]);

  const bodyStyle = useAnimatedStyle(() => {
    const breath = (1 - Math.cos(phase.value)) / 2;
    const sway = Math.sin(phase.value);
    const scaleX = art.motion === 'dragon' || art.motion === 'star' ? 1 + sway * 0.008 : 1;
    const rotate =
      art.motion === 'bunny' ? sway * 0.75 :
        art.motion === 'forest' ? sway * 0.65 :
          art.motion === 'star' ? sway * 0.45 : 0;
    return {
      transform: [
        { translateY: -breath * size * 0.009 },
        { scale: 1 - breath * 0.007 },
        { scaleX },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
  const noseStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.sin(phase.value) * size * 0.004 }],
  }));
  const eyeGlowStyle = useAnimatedStyle(() => ({
    opacity: faceMotion ? 0.42 + (Math.sin(phase.value) + 1) * 0.2 : 0.42,
    transform: [{ scale: 0.9 + (Math.sin(phase.value) + 1) * 0.09 }],
  }));

  if (layer === 'wings') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
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
              bodyStyle,
          ]}
        >
          {art.parts.filter(part => part.layer === 'wings').map(part => (
            <CompanionMotionPartView
              key={`${frameId}-${part.motion}-${part.side}`}
              part={part}
              phase={phase}
              size={size}
              artDiameter={artDiameter}
              artOffset={artOffset}
            />
          ))}
          </Animated.View>
      </View>
    );
  }

  const eyeCenters = art.eyeX.map(x => ({
    left: size / 2 + (x - 0.5) * artDiameter - eyePatchWidth / 2,
    top: size / 2 - artDiameter / 2 + art.eyeY * artDiameter + artOffset - eyePatchHeight / 2,
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
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
          bodyStyle,
        ]}
      >
        <View
          style={[
            styles.artwork,
            {
              width: artDiameter,
              height: artDiameter,
              left: (size - artDiameter) / 2,
              top: (size - artDiameter) / 2 + artOffset,
            },
          ]}
        >
          <Image accessible={false} source={art.source} resizeMode="contain" style={StyleSheet.absoluteFill} />
        </View>

        {art.parts
          .filter(part => layer === 'all' || part.layer === 'ornament')
          .map(part => (
            <CompanionMotionPartView
              key={`${frameId}-${part.motion}-${part.side}`}
              part={part}
              phase={phase}
              size={size}
              artDiameter={artDiameter}
              artOffset={artOffset}
            />
          ))}

        {eyeCenters.map((center, index) => (
          <React.Fragment key={`${frameId}-eye-${index}`}>
            <Animated.View
              style={[
                styles.closedEye,
                {
                  left: center.left,
                  top: center.top,
                  width: eyePatchWidth,
                  height: eyePatchHeight,
                },
                blinkStyle,
              ]}
            >
              <Svg width="100%" height="100%" viewBox="0 0 100 48" preserveAspectRatio="none">
                <Path
                  d="M5 25 C24 5 76 5 95 25 C77 37 23 37 5 25Z"
                  fill={art.lidColor}
                />
                <Path
                  d="M5 25 C26 42 74 42 95 25"
                  fill="none"
                  stroke={art.lidStroke}
                  strokeWidth={5}
                  strokeLinecap="round"
                />
                <Path
                  d="M12 24 C32 13 68 13 88 24"
                  fill="none"
                  stroke={art.lidStroke}
                  strokeOpacity={0.5}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            </Animated.View>
            {art.eyeGlow && (
              <Animated.View
                style={[
                  styles.eyeGlow,
                  {
                    left: center.left + eyePatchWidth * 0.32,
                    top: center.top + eyePatchHeight * 0.2,
                    width: eyePatchWidth * 0.36,
                    height: eyePatchHeight * 0.58,
                    backgroundColor: art.eyeGlow,
                    shadowColor: art.eyeGlow,
                  },
                  eyeGlowStyle,
                ]}
              />
            )}
          </React.Fragment>
        ))}

        {art.motion === 'bunny' && (
          <Animated.View
            style={[
              styles.nose,
              {
                left: size / 2 - size * 0.012,
                top: size / 2 - artDiameter / 2 + artDiameter * 0.292 + artOffset,
                width: size * 0.024,
                height: size * 0.018,
              },
              noseStyle,
            ]}
          />
        )}

        {getParticleSpecs(art.motion).map((particle, index) => (
          <CompanionParticle
            key={`${frameId}-particle-${index}`}
            phase={phase}
            enabled={faceMotion}
            kind={particle.kind}
            color={particle.color}
            size={size * particle.size}
            left={size / 2 + (particle.x - 0.5) * artDiameter - size * particle.size / 2}
            top={size / 2 - artDiameter / 2 + particle.y * artDiameter + artOffset - size * particle.size / 2}
            phaseOffset={particle.phaseOffset}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function CompanionMotionPartView({
  part,
  phase,
  size,
  artDiameter,
  artOffset,
}: {
  part: CompanionMotionPart;
  phase: SharedValue<number>;
  size: number;
  artDiameter: number;
  artOffset: number;
}) {
  const artworkLeft = (size - artDiameter) / 2;
  const artworkTop = artworkLeft + artOffset;
  const pivotLeft = artworkLeft + (part.pivotX / ART_SOURCE_SIZE) * artDiameter;
  const pivotTop = artworkTop + (part.pivotY / ART_SOURCE_SIZE) * artDiameter;
  const motionStyle = useAnimatedStyle(() => {
    const wave = Math.sin(phase.value + part.phaseOffset);
    const sideSign = part.side === 'left' ? -1 : 1;

    if (part.motion === 'hug') {
      const squeeze = (1 - Math.cos(phase.value + part.phaseOffset)) / 2;
      const inward = (part.side === 'left' ? 1 : -1) * squeeze * size * 0.014 * part.amplitude;
      return { transform: [{ translateX: inward }] };
    }

    const rotate =
      part.motion === 'flap' ? wave * part.amplitude * sideSign :
        part.motion === 'ear' ? wave * part.amplitude * sideSign :
          wave * part.amplitude;
    const lift = part.motion === 'ear' ? -Math.max(0, wave) * size * 0.006 : 0;
    const flapScale = part.motion === 'flap' ? 1 + wave * 0.018 : 1;
    const inward = part.motion === 'flap'
      ? (part.side === 'left' ? 1 : -1) * Math.max(0, wave) * size * 0.004
      : 0;

    return {
      transform: [
        { translateX: inward },
        { translateY: lift },
        { rotate: `${rotate}deg` },
        { scaleY: flapScale },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.partPivot,
        { left: pivotLeft, top: pivotTop },
        motionStyle,
      ]}
    >
      <Image
        accessible={false}
        source={part.source}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          left: ((part.x - part.pivotX) / ART_SOURCE_SIZE) * artDiameter,
          top: ((part.y - part.pivotY) / ART_SOURCE_SIZE) * artDiameter,
          width: (part.width / ART_SOURCE_SIZE) * artDiameter,
          height: (part.height / ART_SOURCE_SIZE) * artDiameter,
        }}
      />
    </Animated.View>
  );
}

type ParticleKind = 'smoke' | 'leaf' | 'flower' | 'star' | 'sparkle';

type ParticleSpec = {
  kind: ParticleKind;
  color: string;
  size: number;
  x: number;
  y: number;
  phaseOffset: number;
};

function getParticleSpecs(motion: MotionStyle): ParticleSpec[] {
  if (motion === 'dragon') {
    return [
      { kind: 'smoke', color: '#D8A7FF', size: 0.075, x: 0.12, y: 0.44, phaseOffset: 0.5 },
      { kind: 'smoke', color: '#B995EE', size: 0.052, x: 0.18, y: 0.38, phaseOffset: 1.3 },
    ];
  }
  if (motion === 'shadow') {
    return [
      { kind: 'sparkle', color: '#B884FF', size: 0.05, x: 0.13, y: 0.48, phaseOffset: 0.2 },
      { kind: 'sparkle', color: '#8E5CD8', size: 0.045, x: 0.86, y: 0.38, phaseOffset: 2.1 },
      { kind: 'sparkle', color: '#C17BFF', size: 0.04, x: 0.83, y: 0.63, phaseOffset: 3.4 },
    ];
  }
  if (motion === 'forest') {
    return [
      { kind: 'leaf', color: '#92B96D', size: 0.065, x: 0.15, y: 0.56, phaseOffset: 0.4 },
      { kind: 'flower', color: '#F3D7A5', size: 0.055, x: 0.85, y: 0.48, phaseOffset: 2.2 },
      { kind: 'leaf', color: '#7A9E5D', size: 0.052, x: 0.82, y: 0.68, phaseOffset: 3.1 },
    ];
  }
  if (motion === 'star') {
    return [
      { kind: 'star', color: '#F5D27F', size: 0.055, x: 0.15, y: 0.48, phaseOffset: 0.4 },
      { kind: 'star', color: '#FFE6A8', size: 0.045, x: 0.84, y: 0.40, phaseOffset: 1.8 },
      { kind: 'star', color: '#EFC86F', size: 0.04, x: 0.81, y: 0.68, phaseOffset: 3.0 },
    ];
  }
  return [];
}

function CompanionParticle({
  phase,
  enabled,
  kind,
  color,
  size,
  left,
  top,
  phaseOffset,
}: {
  phase: SharedValue<number>;
  enabled: boolean;
  kind: ParticleKind;
  color: string;
  size: number;
  left: number;
  top: number;
  phaseOffset: number;
}) {
  const motionStyle = useAnimatedStyle(() => {
    const wave = (Math.sin(phase.value + phaseOffset) + 1) / 2;
    const visibility = kind === 'smoke' ? wave * wave : Math.max(0, Math.sin(phase.value + phaseOffset));
    return {
      opacity: enabled ? visibility * (kind === 'smoke' ? 0.62 : 0.58) : 0,
      transform: [
        { translateY: -wave * size * 0.24 },
        { translateX: Math.cos(phase.value + phaseOffset) * size * 0.08 },
        { scale: 0.72 + wave * 0.3 },
        { rotate: `${Math.sin(phase.value + phaseOffset) * 8}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { left, top, width: size, height: size },
        kind === 'smoke' && styles.smokeParticle,
        motionStyle,
      ]}
    >
      {kind === 'leaf' && (
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Path d="M20.5 3.5C12 3.7 5.1 6.5 4.1 12.3c-.5 3.1 1.7 5.5 4.8 5.1 5.9-.8 9.3-7.3 11.6-13.9Z" fill={color} />
          <Path d="M3.8 20.2c3.7-4.1 7.1-7.3 12.2-10.7" fill="none" stroke="#F1F3D9" strokeOpacity={0.68} strokeWidth={1.1} />
        </Svg>
      )}
      {kind === 'flower' && (
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Circle cx={12} cy={5} r={3.1} fill={color} />
          <Circle cx={18} cy={10} r={3.1} fill={color} />
          <Circle cx={15.5} cy={17} r={3.1} fill={color} />
          <Circle cx={8} cy={17} r={3.1} fill={color} />
          <Circle cx={5.5} cy={10} r={3.1} fill={color} />
          <Circle cx={12} cy={11} r={2.2} fill="#F5C977" />
        </Svg>
      )}
      {kind === 'star' && (
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Path d="M12 1.5 14.8 9.2 22.5 12l-7.7 2.8L12 22.5l-2.8-7.7L1.5 12l7.7-2.8L12 1.5Z" fill={color} />
          <Circle cx={12} cy={12} r={1.5} fill="#FFF8E8" />
        </Svg>
      )}
      {(kind === 'smoke' || kind === 'sparkle') && (
        <View
          style={[
            styles.particleShape,
            { backgroundColor: color },
            kind === 'smoke' ? styles.smokeShape : styles.sparkleShape,
          ]}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    overflow: 'visible',
  },
  artwork: {
    position: 'absolute',
    overflow: 'visible',
  },
  partPivot: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'visible',
  },
  closedEye: {
    position: 'absolute',
    overflow: 'visible',
  },
  eyeGlow: {
    position: 'absolute',
    borderRadius: 999,
    shadowOpacity: 0.84,
    shadowRadius: 5,
    elevation: 3,
  },
  nose: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#EBAFC1',
  },
  particle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smokeParticle: {
    borderRadius: 999,
  },
  particleShape: {
    width: '100%',
    height: '100%',
    opacity: 0.85,
  },
  smokeShape: {
    borderRadius: 999,
  },
  sparkleShape: {
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
