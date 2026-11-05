import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  VideoView,
  useVideoPlayer,
  type VideoPlayer,
  type VideoSource,
} from 'expo-video';
import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export const ResizeMode = {
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'fill',
} as const;

export type VideoPlaybackStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  positionMillis: number;
  durationMillis: number;
  didJustFinish: boolean;
  error?: string;
};

export type VideoSurfaceHandle = {
  getStatusAsync: () => Promise<VideoPlaybackStatus>;
  playAsync: () => Promise<VideoPlaybackStatus>;
  pauseAsync: () => Promise<VideoPlaybackStatus>;
  setPositionAsync: (positionMillis: number) => Promise<void>;
  setVolumeAsync: (volume: number) => Promise<void>;
};

type Props = {
  source: VideoSource;
  posterSource?: ImageSource;
  usePoster?: boolean;
  style?: StyleProp<ViewStyle>;
  resizeMode?: typeof ResizeMode[keyof typeof ResizeMode];
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  useNativeControls?: boolean;
  progressUpdateIntervalMillis?: number;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  onLoadStart?: () => void;
  onLoad?: (status: VideoPlaybackStatus) => void;
  onReadyForDisplay?: (event: {
    naturalSize?: { width?: number; height?: number };
  }) => void;
  onPlaybackStatusUpdate?: (status: VideoPlaybackStatus) => void;
  onError?: (error?: unknown) => void;
  accessibilityLabel?: string;
};

function getStatus(player: VideoPlayer, didJustFinish: boolean): VideoPlaybackStatus {
  return {
    isLoaded: player.status === 'readyToPlay',
    isPlaying: player.playing,
    isBuffering: player.status === 'loading',
    positionMillis: Math.max(0, player.currentTime * 1000),
    durationMillis: Math.max(0, player.duration * 1000),
    didJustFinish,
    ...(player.status === 'error' ? { error: 'Video playback failed' } : {}),
  };
}

export const VideoSurface = forwardRef<VideoSurfaceHandle, Props>(function VideoSurface(
  {
    source,
    posterSource,
    usePoster = false,
    style,
    resizeMode = ResizeMode.CONTAIN,
    shouldPlay = false,
    isLooping = false,
    isMuted = false,
    volume = 1,
    useNativeControls = false,
    progressUpdateIntervalMillis = 500,
    pointerEvents,
    onLoadStart,
    onLoad,
    onReadyForDisplay,
    onPlaybackStatusUpdate,
    onError,
    accessibilityLabel,
  },
  forwardedRef,
) {
  // Expo Video can replace the source without creating a new player object.
  const sourceIdentity = JSON.stringify(source);
  const player = useVideoPlayer(source, nativePlayer => {
    nativePlayer.loop = isLooping;
    nativePlayer.muted = isMuted;
    nativePlayer.volume = volume;
    nativePlayer.timeUpdateEventInterval = Math.max(0, progressUpdateIntervalMillis) / 1000;
  });
  const playerRef = useRef(player);
  playerRef.current = player;
  const propsRef = useRef({
    onLoadStart,
    onLoad,
    onReadyForDisplay,
    onPlaybackStatusUpdate,
    onError,
  });
  propsRef.current = {
    onLoadStart,
    onLoad,
    onReadyForDisplay,
    onPlaybackStatusUpdate,
    onError,
  };
  const didJustFinishRef = useRef(false);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);

  const readCurrentStatus = () => getStatus(playerRef.current, didJustFinishRef.current);

  useImperativeHandle(forwardedRef, () => ({
    getStatusAsync: async () => readCurrentStatus(),
    playAsync: async () => {
      didJustFinishRef.current = false;
      playerRef.current.play();
      return readCurrentStatus();
    },
    pauseAsync: async () => {
      playerRef.current.pause();
      return readCurrentStatus();
    },
    setPositionAsync: async positionMillis => {
      playerRef.current.currentTime = Math.max(0, positionMillis) / 1000;
    },
    setVolumeAsync: async nextVolume => {
      playerRef.current.volume = Math.max(0, Math.min(1, nextVolume));
    },
  }), []);

  useEffect(() => {
    setHasRenderedFrame(false);
  }, [player, sourceIdentity]);

  useEffect(() => {
    player.loop = isLooping;
    player.muted = isMuted;
    player.volume = Math.max(0, Math.min(1, volume));
    player.timeUpdateEventInterval = Math.max(0, progressUpdateIntervalMillis) / 1000;
    if (shouldPlay) {
      didJustFinishRef.current = false;
      player.play();
    } else {
      player.pause();
    }
  }, [player, sourceIdentity, isLooping, isMuted, volume, progressUpdateIntervalMillis, shouldPlay]);

  useEffect(() => {
    let loadNotified = false;
    const notifyStatus = () => propsRef.current.onPlaybackStatusUpdate?.(readCurrentStatus());
    const notifyLoaded = () => {
      if (loadNotified) return;
      loadNotified = true;
      propsRef.current.onLoad?.(readCurrentStatus());
    };

    const subscriptions = [
      player.addListener('statusChange', ({ status, error }) => {
        if (status === 'loading') propsRef.current.onLoadStart?.();
        if (status === 'readyToPlay') notifyLoaded();
        if (status === 'error') propsRef.current.onError?.(error);
        notifyStatus();
      }),
      player.addListener('sourceLoad', notifyLoaded),
      player.addListener('playingChange', ({ isPlaying }) => {
        if (isPlaying) didJustFinishRef.current = false;
        notifyStatus();
      }),
      player.addListener('timeUpdate', notifyStatus),
      player.addListener('playToEnd', () => {
        didJustFinishRef.current = true;
        notifyStatus();
      }),
    ];

    if (player.status === 'loading') propsRef.current.onLoadStart?.();
    if (player.status === 'readyToPlay') notifyLoaded();
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [player, sourceIdentity]);

  return (
    <View
      // Keep absolute-fill positioning supplied by Reels. Overriding it with
      // relative positioning collapses wrappers with only absolute children.
      style={[{ position: 'relative' }, style, { overflow: 'hidden' }]}
      pointerEvents={pointerEvents}
      accessibilityLabel={accessibilityLabel}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={resizeMode}
        nativeControls={useNativeControls}
        onFirstFrameRender={() => {
          setHasRenderedFrame(true);
          const size = player.videoTrack?.size;
          propsRef.current.onReadyForDisplay?.({
            naturalSize: size ? { width: size.width, height: size.height } : undefined,
          });
        }}
      />
      {usePoster && posterSource && !hasRenderedFrame ? (
        <Image
          source={posterSource}
          style={StyleSheet.absoluteFill}
          contentFit={resizeMode === ResizeMode.STRETCH ? 'fill' : resizeMode}
          pointerEvents="none"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
});
