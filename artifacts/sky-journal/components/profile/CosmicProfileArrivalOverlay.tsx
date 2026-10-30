import React, { Component, type ErrorInfo, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

// Metro needs a static require to bundle the local .riv asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const COSMIC_ARRIVAL_FILE = require('../../assets/rive/profile_cosmic_arrival.riv');

type RiveRuntimeModule = typeof import('@rive-app/react-native');
let riveRuntime: RiveRuntimeModule | null = null;
try {
  // Expo Go does not include Nitro's native module. The production/custom build
  // uses the same Rive runtime as the other in-app Rive components.
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    riveRuntime = require('@rive-app/react-native') as RiveRuntimeModule;
  }
} catch {
  riveRuntime = null;
}

const ARRIVAL_DURATION_MS = 5_000; // Rive source: 300 frames at 60 fps.

interface Props {
  onComplete: () => void;
}

interface BoundaryProps {
  children: ReactNode;
  onFailure: () => void;
}

interface BoundaryState {
  failed: boolean;
}

class RiveErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function NativeArrival({ onComplete }: Props) {
  const { riveFile, error } = riveRuntime!.useRiveFile(COSMIC_ARRIVAL_FILE);
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (error) {
      finish();
      return;
    }
    if (!riveFile) return;

    const timer = setTimeout(finish, ARRIVAL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [error, finish, riveFile]);

  if (!riveFile) return null;
  const RiveView = riveRuntime!.RiveView;

  return (
    <RiveView
      file={riveFile}
      artboardName="Cosmic Profile Arrival"
      stateMachineName="ProfileArrival"
      fit={riveRuntime!.Fit.Contain}
      alignment={riveRuntime!.Alignment.Center}
      autoPlay
      onError={finish}
      style={styles.rive}
    />
  );
}

export function CosmicProfileArrivalOverlay({ onComplete }: Props) {
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  const [motionAllowed, setMotionAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduceMotion => {
        if (mounted) setMotionAllowed(!reduceMotion);
      })
      .catch(() => {
        if (mounted) setMotionAllowed(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (motionAllowed === false || !riveRuntime) finish();
  }, [finish, motionAllowed]);

  if (motionAllowed !== true || !riveRuntime) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <RiveErrorBoundary onFailure={finish}>
        <NativeArrival onComplete={finish} />
      </RiveErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
  },
  rive: {
    width: '100%',
    height: '100%',
  },
});
