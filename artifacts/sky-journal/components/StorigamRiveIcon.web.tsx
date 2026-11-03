import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { Alignment, Fit, Layout, Rive } from '@rive-app/canvas';
import { Asset } from 'expo-asset';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export type StorigamRiveIconName =
  | 'back'
  | 'settings'
  | 'home'
  | 'reels'
  | 'create'
  | 'discover'
  | 'profile';

// Metro needs a static require to bundle the local Rive asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RIVE_ICON_FILE = require('../assets/rive/storigam_ui_icons.riv');
/* eslint-disable @typescript-eslint/no-require-imports -- Bundled static icon artwork. */
const ARTWORK = {
  back: { file: require('../rive/storigam-ui-icons/assets/Back.png'), width: 59, height: 56 },
  settings: { file: require('../rive/storigam-ui-icons/assets/Settings.png'), width: 67, height: 69 },
  home: { file: require('../rive/storigam-ui-icons/assets/Home.png'), width: 62, height: 66 },
  reels: { file: require('../rive/storigam-ui-icons/assets/Reels.png'), width: 65, height: 67 },
  create: { file: require('../rive/storigam-ui-icons/assets/Create.png'), width: 73, height: 74 },
  discover: { file: require('../rive/storigam-ui-icons/assets/Discover.png'), width: 70, height: 71 },
  profile: { file: require('../rive/storigam-ui-icons/assets/Profile.png'), width: 64, height: 69 },
};
/* eslint-enable @typescript-eslint/no-require-imports */
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

function IconArtwork({ name, size }: Pick<Props, 'name' | 'size'>) {
  const image = ARTWORK[name];
  // Match the image's intrinsic dimensions and scale on the 64px Rive artboard.
  return React.createElement('img', {
    src: Asset.fromModule(image.file).uri,
    alt: '',
    'aria-hidden': true,
    draggable: false,
    style: {
      display: 'block',
      width: image.width * size * 0.84 / 64,
      height: image.height * size * 0.84 / 64,
      pointerEvents: 'none',
    },
  });
}

function AnimatedWebIcon({ name, size, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = Asset.fromModule(RIVE_ICON_FILE).uri;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;

    let mounted = true;
    let instance: Rive | null = null;
    let frameConfirmed = false;
    setRendered(false);
    setFailed(false);
    const confirmFrame = () => {
      if (!mounted || frameConfirmed || !canvas.width || !canvas.height) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < pixels.length; index += 4) {
        if (pixels[index] > 0) {
          frameConfirmed = true;
          setRendered(true);
          break;
        }
      }
    };

    try {
      instance = new Rive({
        src: source,
        canvas,
        artboard: ARTBOARDS[name],
        stateMachines: 'IconSweep',
        autoplay: true,
        layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
        enableRiveAssetCDN: false,
        shouldDisableRiveListeners: true,
        onAdvance: confirmFrame,
        onLoad: () => {
          if (!mounted || !instance) return;
          instance.resizeDrawingSurfaceToCanvas();
        },
        onLoadError: () => {
          if (!mounted) return;
          setFailed(true);
          console.warn('[StorigamRiveIcon] Browser Rive asset could not load:', name);
        },
      });
    } catch {
      setFailed(true);
      console.warn('[StorigamRiveIcon] Browser Rive runtime could not initialize:', name);
    }

    const resize = () => instance?.resizeDrawingSurfaceToCanvas();
    window.addEventListener('resize', resize);
    return () => {
      mounted = false;
      window.removeEventListener('resize', resize);
      instance?.cleanup();
    };
  }, [name, source]);

  return (
    <View
      style={[{ width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, style]}
      pointerEvents="none"
    >
      {(!rendered || failed) && <IconArtwork name={name} size={size} />}
      {React.createElement('canvas', {
        ref: canvasRef,
        'aria-hidden': true,
        style: {
          position: 'absolute',
          inset: 0,
          display: 'block',
          width: '100%',
          height: '100%',
          opacity: rendered && !failed ? 1 : 0,
          pointerEvents: 'none',
        },
      })}
    </View>
  );
}

/** Idle icons use the same artwork; only active icons allocate a Rive player. */
export function StorigamRiveIcon({ active = true, ...props }: Props) {
  const { isDark } = useTheme();
  if (!isDark) return <View style={props.style}>{props.fallback}</View>;
  if (active) return <AnimatedWebIcon key={props.name} {...props} />;
  return (
    <View
      style={[{ width: props.size, height: props.size, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, props.style]}
      pointerEvents="none"
    >
      <IconArtwork name={props.name} size={props.size} />
    </View>
  );
}
