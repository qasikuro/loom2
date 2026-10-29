import React, { type ReactNode, useState } from 'react';
import { Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export type StorigamRiveIconName =
  | 'back'
  | 'settings'
  | 'home'
  | 'reels'
  | 'create'
  | 'discover'
  | 'profile';

const RIVE_ICON_FILE = require('../assets/rive/storigam_ui_icons.riv');

type RiveRuntimeModule = typeof import('@rive-app/react-native');
let riveRuntime: RiveRuntimeModule | null = null;

if (Platform.OS !== 'web') {
  try {
    riveRuntime = require('@rive-app/react-native') as RiveRuntimeModule;
  } catch {
    // Expo Go and web preview do not include the native Rive runtime.
  }
}

const ARTBOARDS: Record<StorigamRiveIconName, string> = {
  back: 'Back',
  settings: 'Settings',
  home: 'Home',
  reels: 'Reels',
  create: 'Create',
  discover: 'Discover',
  profile: 'Profile',
};

/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static bundled asset paths. */
const ARTWORK = {
  back: { source: require('../rive/storigam-ui-icons/assets/Back.png'), width: 59, height: 56 },
  settings: { source: require('../rive/storigam-ui-icons/assets/Settings.png'), width: 67, height: 69 },
  home: { source: require('../rive/storigam-ui-icons/assets/Home.png'), width: 62, height: 66 },
  reels: { source: require('../rive/storigam-ui-icons/assets/Reels.png'), width: 65, height: 67 },
  create: { source: require('../rive/storigam-ui-icons/assets/Create.png'), width: 73, height: 74 },
  discover: { source: require('../rive/storigam-ui-icons/assets/Discover.png'), width: 70, height: 71 },
  profile: { source: require('../rive/storigam-ui-icons/assets/Profile.png'), width: 64, height: 69 },
};
/* eslint-enable @typescript-eslint/no-require-imports */

interface Props {
  name: StorigamRiveIconName;
  size: number;
  active?: boolean;
  fallback: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function NativeRiveIcon({ name, size }: Pick<Props, 'name' | 'size'>) {
  const { riveFile, error } = riveRuntime!.useRiveFile(RIVE_ICON_FILE);
  const [failed, setFailed] = useState(false);
  if (!riveFile || error || failed) return null;

  const RiveView = riveRuntime!.RiveView;
  const fit = riveRuntime!.Fit.Contain;
  return (
    <RiveView
      file={riveFile}
      artboardName={ARTBOARDS[name]}
      stateMachineName="IconSweep"
      autoPlay
      frameRate={30}
      fit={fit}
      onError={() => setFailed(true)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { width: size, height: size }]}
    />
  );
}

/**
 * Rive motion is a brief, low-cost sweep around the icon; inactive tab icons
 * remain still. Artwork is never replaced by an unconfirmed native frame:
 * paused, loading, missing, or failed Rive views must not erase navigation.
 */
export function StorigamRiveIcon({
  name,
  size,
  active = true,
  fallback,
  style,
}: Props) {
  const { isDark } = useTheme();
  if (!isDark || Platform.OS === 'web') return <View style={style}>{fallback}</View>;

  const artwork = ARTWORK[name];
  return (
    <View pointerEvents="none" style={[{
      width: size, height: size, flexShrink: 0,
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      {active && riveRuntime && <NativeRiveIcon name={name} size={size} />}
      <Image
        source={artwork.source}
        resizeMode="contain"
        accessible={false}
        style={{
          zIndex: 1,
          width: artwork.width * size * 0.84 / 64,
          height: artwork.height * size * 0.84 / 64,
        }}
      />
    </View>
  );
}
