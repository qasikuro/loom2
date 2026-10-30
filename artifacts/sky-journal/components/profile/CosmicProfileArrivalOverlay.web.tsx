import React, { useEffect, useRef } from 'react';
import { Alignment, Fit, Layout, Rive } from '@rive-app/canvas';
import { Asset } from 'expo-asset';
import { StyleSheet, View } from 'react-native';

// Metro needs a static require to bundle the local .riv asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const COSMIC_ARRIVAL_FILE = require('../../assets/rive/profile_cosmic_arrival.riv');
const ARRIVAL_DURATION_MS = 5_000; // Rive source: 300 frames at 60 fps.

interface Props {
  onComplete: () => void;
}

export function CosmicProfileArrivalOverlay({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;
    let instance: Rive | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (!mounted || completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    };

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return () => {
        mounted = false;
      };
    }

    try {
      instance = new Rive({
        src: Asset.fromModule(COSMIC_ARRIVAL_FILE).uri,
        canvas,
        artboard: 'Cosmic Profile Arrival',
        stateMachines: 'ProfileArrival',
        autoplay: true,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        enableRiveAssetCDN: false,
        shouldDisableRiveListeners: true,
        onLoad: () => {
          if (!mounted) return;
          instance?.resizeDrawingSurfaceToCanvas();
          timer = setTimeout(finish, ARRIVAL_DURATION_MS);
        },
        onLoadError: finish,
      });
    } catch {
      finish();
    }

    const resize = () => instance?.resizeDrawingSurfaceToCanvas();
    window.addEventListener('resize', resize);
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', resize);
      instance?.cleanup();
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {React.createElement('canvas', {
        ref: canvasRef,
        'aria-hidden': true,
        style: {
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
  },
});
