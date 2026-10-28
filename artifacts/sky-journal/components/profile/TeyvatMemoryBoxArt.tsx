import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// Metro requires a statically analyzable asset require for nonstandard extensions.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TEYVAT_MEMORY_FILE = require('../../assets/rive/teyvat_memory_box.riv');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOSED_BOX_IMAGE = require('../../assets/teyvat/memory_box_closed.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OPEN_BOX_IMAGE = require('../../assets/teyvat/memory_box_open.png');
type RiveRuntimeModule = typeof import('@rive-app/react-native');
let riveRuntime: RiveRuntimeModule | null = null;
try {
  // Expo Go does not include Nitro's native module. Keep the profile usable
  // there with the artwork fallback; custom development/production builds use Rive.
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    riveRuntime = require('@rive-app/react-native') as RiveRuntimeModule;
  }
} catch {
  riveRuntime = null;
}

type BoxMode = 'closed' | 'open';

interface Props {
  mode: BoxMode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

class RiveErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function RiveBox({ mode, testID }: Props) {
  const { riveFile } = riveRuntime!.useRiveFile(TEYVAT_MEMORY_FILE);
  if (!riveFile) return <FallbackBox mode={mode} testID={testID} />;
  const RiveView = riveRuntime!.RiveView;
  return (
    <RiveView
      file={riveFile}
      artboardName={mode === 'closed' ? 'BoxClosed' : 'BoxOpen'}
      stateMachineName={mode === 'closed' ? 'MemoryIdle' : 'MemoryReveal'}
      fit={mode === 'closed' ? riveRuntime!.Fit.Cover : riveRuntime!.Fit.Contain}
      autoPlay
      style={styles.rive}
      testID={testID}
    />
  );
}

function FallbackBox({ mode, testID }: Props) {
  return (
    <ExpoImage
      source={
        mode === 'closed'
          ? CLOSED_BOX_IMAGE
          : OPEN_BOX_IMAGE
      }
      style={styles.fallback}
      contentFit="contain"
      cachePolicy="memory-disk"
      accessibilityLabel={mode === 'closed' ? 'Closed Teyvat memory box' : 'Open Teyvat memory box'}
      testID={testID}
    />
  );
}

export function TeyvatMemoryBoxArt(props: Props) {
  if (!riveRuntime) return <FallbackBox {...props} />;
  return (
    <View style={[styles.container, props.style]}>
      <RiveErrorBoundary fallback={<FallbackBox {...props} />}>
        <RiveBox {...props} />
      </RiveErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rive: { width: '100%', height: '100%' },
  fallback: { width: '100%', height: '100%' },
});
