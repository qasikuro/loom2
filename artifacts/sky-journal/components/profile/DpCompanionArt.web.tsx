import React, { useEffect, useRef, useState } from 'react';
import { Alignment, Fit, Layout, Rive } from '@rive-app/canvas';
import { Asset } from 'expo-asset';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import type { DpCompanionFrameId } from './AnimalEarFrameArt';

/* eslint-disable @typescript-eslint/no-require-imports -- Metro needs static local asset references. */
const PROFILE_COMPANIONS_FILE = require('../../assets/rive/profile_companions.riv');
const STATIC_ART: Record<DpCompanionFrameId, ImageSourcePropType> = {
  frame_baby_dragon: require('../../assets/images/dp-companions/baby-dragon.png'),
  frame_moon_bunny: require('../../assets/images/dp-companions/moon-bunny.png'),
  frame_shadow_keeper: require('../../assets/images/dp-companions/shadow-keeper.png'),
  frame_forest_spirit: require('../../assets/images/dp-companions/forest-spirit.png'),
  frame_star_guardian: require('../../assets/images/dp-companions/star-guardian.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

type Props = {
  frameId: DpCompanionFrameId;
  size: number;
  layer: 'wings' | 'ornament' | 'all';
  motionEnabled: boolean;
};

const ART_DIAMETER = 1.82;
const ART_OFFSET_Y = -0.139;

export function DpCompanionArt({ frameId, size, layer, motionEnabled }: Props) {
  if (layer === 'wings') return null;
  if (!motionEnabled || size <= 64) return <StaticCompanionArt frameId={frameId} size={size} />;
  return (
    <RiveCompanionCanvas
      key={frameId}
      frameId={frameId}
      size={size}
      motionEnabled={motionEnabled}
    />
  );
}

function StaticCompanionArt({ frameId, size }: { frameId: DpCompanionFrameId; size: number }) {
  const artDiameter = size * ART_DIAMETER;
  const artOffset = size * ART_OFFSET_Y;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        accessible={false}
        source={STATIC_ART[frameId]}
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

function RiveCompanionCanvas({
  frameId,
  size,
  motionEnabled,
}: {
  frameId: DpCompanionFrameId;
  size: number;
  motionEnabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = Asset.fromModule(PROFILE_COMPANIONS_FILE).uri;
  const artDiameter = size * ART_DIAMETER;
  const artOffset = size * ART_OFFSET_Y;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) {
      setFailed(true);
      return;
    }

    let instance: Rive | null = null;
    let mounted = true;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    try {
      setLoaded(false);
      setFailed(false);
      instance = new Rive({
        src: source,
        canvas,
        artboard: frameId === 'frame_baby_dragon'
          ? 'Baby Dragon'
          : frameId === 'frame_moon_bunny'
            ? 'Moon Bunny'
            : frameId === 'frame_shadow_keeper'
              ? 'Shadow Keeper'
              : frameId === 'frame_forest_spirit'
                ? 'Forest Spirit'
                : 'Star Guardian',
        stateMachines: 'CompanionLoop',
        autoplay: motionEnabled && !reducedMotion,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        enableRiveAssetCDN: false,
        shouldDisableRiveListeners: true,
        onLoad: () => {
          if (!mounted) return;
          instance?.resizeDrawingSurfaceToCanvas();
          setLoaded(true);
        },
        onLoadError: () => {
          if (!mounted) return;
          setFailed(true);
          setLoaded(false);
          console.warn('[DpCompanionArt] Browser Rive file could not load:', frameId);
        },
      });
    } catch {
      setFailed(true);
    }

    const resize = () => instance?.resizeDrawingSurfaceToCanvas();
    window.addEventListener('resize', resize);
    return () => {
      mounted = false;
      window.removeEventListener('resize', resize);
      instance?.cleanup();
    };
  }, [frameId, motionEnabled, source]);

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
        {(!loaded || failed) && (
          <Image
            accessible={false}
            source={STATIC_ART[frameId]}
            resizeMode="contain"
            style={{
              position: 'absolute',
              width: artDiameter,
              height: artDiameter,
              left: (size - artDiameter) / 2,
              top: (size - artDiameter) / 2 + artOffset,
            }}
          />
        )}
        {React.createElement('canvas', {
          ref: canvasRef,
          'aria-hidden': true,
          style: {
            position: 'absolute',
            width: artDiameter,
            height: artDiameter,
            left: (size - artDiameter) / 2,
            top: (size - artDiameter) / 2 + artOffset,
            display: 'block',
            opacity: loaded && !failed ? 1 : 0,
            pointerEvents: 'none',
          },
        })}
      </View>
    </View>
  );
}
