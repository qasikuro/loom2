import React, { type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
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

interface Props {
  name: StorigamRiveIconName;
  size: number;
  active?: boolean;
  fallback: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function NativeRiveIcon({ name, size, active, style, fallback }: Props) {
  const { riveFile, error } = riveRuntime!.useRiveFile(RIVE_ICON_FILE);
  if (!riveFile || error) return <View style={style}>{fallback}</View>;

  const RiveView = riveRuntime!.RiveView;
  const fit = riveRuntime!.Fit.Contain;
  return (
    <RiveView
      file={riveFile}
      artboardName={ARTBOARDS[name]}
      stateMachineName="IconSweep"
      autoPlay={active}
      frameRate={30}
      fit={fit}
      pointerEvents="none"
      style={[{ width: size, height: size, flexShrink: 0 }, style]}
    />
  );
}

/**
 * Rive motion is a brief, low-cost sweep around the icon; inactive tab icons
 * remain still. The web implementation uses the Canvas runtime; light mode
 * and Expo Go retain the existing vector icon for correct contrast.
 */
export function StorigamRiveIcon({
  name,
  size,
  active = true,
  fallback,
  style,
}: Props) {
  const { isDark } = useTheme();
  if (!isDark || Platform.OS === 'web' || !riveRuntime) return <View style={style}>{fallback}</View>;

  return (
    <NativeRiveIcon
      key={`${name}-${active ? 'active' : 'still'}`}
      name={name}
      size={size}
      active={active}
      fallback={fallback}
      style={style}
    />
  );
}
