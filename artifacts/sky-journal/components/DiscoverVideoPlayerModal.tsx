import { Icon } from '@/components/Icon';
import { useSecureMediaUri } from '@/hooks/useSecureMediaUri';
import type { DiscoverPost } from '@/context/AppContext';
import { Video, ResizeMode } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerNativeSound, unregisterNativeSound } from '@/utils/soundRegistry';
import { useTranslation } from 'react-i18next';

type NativeSound = {
  setIsMutedAsync: (muted: boolean) => Promise<void>;
  playAsync: () => Promise<void>;
  stopAsync: () => Promise<void>;
  unloadAsync: () => Promise<void>;
};

interface Props {
  post:    DiscoverPost | null;
  onClose: () => void;
}

export function DiscoverVideoPlayerModal({ post, onClose }: Props) {
  const insets              = useSafeAreaInsets();
  const { t } = useTranslation();
  const { uri: videoUri, renew: renewVideoUri } = useSecureMediaUri(post?.videoUri);
  const { width: W, height: H } = useWindowDimensions();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const [videoMuted, setVideoMuted] = useState(false);
  const [soundtrackMuted, setSoundtrackMuted] = useState(false);
  const [soundtrackStarted, setSoundtrackStarted] = useState(false);
  const soundtrackMutedRef = useRef(false);
  const nativeSoundRef = useRef<NativeSound | null>(null);
  const webAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackGenerationRef = useRef(0);
  const lifecycleRef = useRef(0);
  const hasExternalSoundtrack = !!post?.music && !post.music.embedded;

  const stopSoundtrack = useCallback(async () => {
    playbackGenerationRef.current += 1;
    setSoundtrackStarted(false);

    const nativeSound = nativeSoundRef.current;
    nativeSoundRef.current = null;
    if (nativeSound) {
      unregisterNativeSound(nativeSound);
      await nativeSound.stopAsync().catch(() => null);
      await nativeSound.unloadAsync().catch(() => null);
    }

    const webAudio = webAudioRef.current;
    webAudioRef.current = null;
    if (webAudio) {
      webAudio.onended = null;
      webAudio.pause();
      webAudio.currentTime = 0;
    }
  }, []);

  const startSoundtrack = useCallback(async (lifecycleId?: number) => {
    const streamUrl = hasExternalSoundtrack ? post?.music?.streamUrl : undefined;
    if (!streamUrl) {
      setSoundtrackStarted(false);
      return;
    }

    await stopSoundtrack();
    if (lifecycleId !== undefined && lifecycleRef.current !== lifecycleId) return;
    const generation = playbackGenerationRef.current;
    const isCurrent = () =>
      playbackGenerationRef.current === generation
      && (lifecycleId === undefined || lifecycleRef.current === lifecycleId);

    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.Audio === 'function') {
      const audio = new window.Audio(streamUrl);
      audio.loop = true;
      audio.volume = 0.55;
      audio.muted = soundtrackMutedRef.current;
      webAudioRef.current = audio;
      try {
        await audio.play();
        if (!isCurrent()) {
          audio.pause();
          audio.currentTime = 0;
          if (webAudioRef.current === audio) webAudioRef.current = null;
          return;
        }
        setSoundtrackStarted(true);
      } catch {
        audio.pause();
        audio.currentTime = 0;
        if (webAudioRef.current === audio) webAudioRef.current = null;
        if (isCurrent()) setSoundtrackStarted(false);
        // Browser autoplay policies may require the user to tap Music.
      }
      return;
    }

    try {
      const { Audio } = await import('expo-av');
      const result = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: false, isLooping: true, volume: 0.55, isMuted: soundtrackMutedRef.current },
      );
      const sound = result.sound as unknown as NativeSound;
      nativeSoundRef.current = sound;
      registerNativeSound(sound);

      if (!isCurrent()) {
        unregisterNativeSound(sound);
        await sound.stopAsync().catch(() => null);
        await sound.unloadAsync().catch(() => null);
        return;
      }

      await sound.playAsync();
      if (!isCurrent()) {
        unregisterNativeSound(sound);
        await sound.stopAsync().catch(() => null);
        await sound.unloadAsync().catch(() => null);
        return;
      }
      setSoundtrackStarted(true);
    } catch {
      if (!isCurrent()) return;
      setSoundtrackStarted(false);
      const sound = nativeSoundRef.current;
      nativeSoundRef.current = null;
      if (sound) {
        unregisterNativeSound(sound);
        await sound.stopAsync().catch(() => null);
        await sound.unloadAsync().catch(() => null);
      }
      // A later tap on Music retries creation and playback.
    }
  }, [hasExternalSoundtrack, post?.music?.streamUrl, stopSoundtrack]);

  const toggleSoundtrack = useCallback(async () => {
    if (soundtrackStarted) {
      setSoundtrackMuted(muted => {
        soundtrackMutedRef.current = !muted;
        return !muted;
      });
      return;
    }

    const webAudio = webAudioRef.current;
    if (webAudio) {
      try {
        webAudio.muted = soundtrackMutedRef.current;
        await webAudio.play();
        setSoundtrackStarted(true);
        return;
      } catch {
        // Fall through to a fresh native/web setup attempt.
      }
    }
    await startSoundtrack();
  }, [soundtrackMuted, soundtrackStarted, startSoundtrack]);

  const handleClose = useCallback(() => {
    void stopSoundtrack();
    onClose();
  }, [onClose, stopSoundtrack]);

  // Reset independent audio controls whenever the modal opens a new post.
  useEffect(() => {
    setVideoMuted(!!post?.music && !post.music.embedded);
    soundtrackMutedRef.current = false;
    setSoundtrackMuted(false);
    setSoundtrackStarted(false);
  }, [post?.id, post?.music?.streamUrl, post?.music?.embedded]);

  // Start the soundtrack automatically when possible and clean it up whenever
  // the post changes or the modal unmounts.
  useEffect(() => {
    const lifecycleId = ++lifecycleRef.current;
    void startSoundtrack(lifecycleId);
    return () => {
      if (lifecycleRef.current === lifecycleId) lifecycleRef.current += 1;
      void stopSoundtrack();
    };
  }, [hasExternalSoundtrack, post?.id, post?.music?.streamUrl, startSoundtrack, stopSoundtrack]);

  useEffect(() => {
    soundtrackMutedRef.current = soundtrackMuted;
    const nativeSound = nativeSoundRef.current;
    if (nativeSound) void nativeSound.setIsMutedAsync(soundtrackMuted).catch(() => null);
    if (webAudioRef.current) webAudioRef.current.muted = soundtrackMuted;
  }, [soundtrackMuted]);

  if (!post || post.contentType !== 'video' || !post.videoUri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[vp.backdrop, { width: W, height: H }]}>
        {/* Video */}
        <Video
          source={{ uri: videoUri ?? post.videoUri }}
          onError={renewVideoUri}
          shouldPlay
          isLooping
          isMuted={videoMuted}
          resizeMode={ResizeMode.CONTAIN}
          style={StyleSheet.absoluteFill}
          useNativeControls={false}
        />

        {/* Top bar */}
        <View style={[vp.topBar, { paddingTop: topInset + 8 }]}>
          <TouchableOpacity
            style={vp.iconBtn}
            onPress={handleClose}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('discoverLog.close')}
          >
            <Icon name="x" size={18} color="#fff" />
          </TouchableOpacity>

          <View style={vp.audioControls}>
            {hasExternalSoundtrack && (
              <TouchableOpacity
                style={vp.audioBtn}
                onPress={() => { void toggleSoundtrack(); }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={
                  soundtrackStarted
                    ? (soundtrackMuted ? t('discoverLog.unmuteSoundtrack') : t('discoverLog.muteSoundtrack'))
                    : t('discoverLog.playSoundtrack')
                }
              >
                <Icon
                  name={soundtrackStarted ? (soundtrackMuted ? 'volume-x' : 'volume-2') : 'play'}
                  size={16}
                  color="#fff"
                />
                <Text style={vp.audioLabel}>{soundtrackStarted ? t('discoverLog.music') : t('discoverLog.play')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={vp.audioBtn}
              onPress={() => setVideoMuted(m => !m)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={videoMuted ? t('discoverLog.enableVideoAudio') : t('discoverLog.muteVideoAudio')}
            >
              <Icon name={videoMuted ? 'volume-x' : 'volume-2'} size={16} color="#fff" />
              <Text style={vp.audioLabel}>{t('discoverLog.video')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom info */}
        <View style={[vp.bottomBar, { paddingBottom: bottomInset + 16 }]}>
          {/* Author */}
          <Text style={vp.author} numberOfLines={1}>
            {post.authorHandle || post.authorName}
          </Text>

          {/* Caption / title */}
          <Text style={vp.title} numberOfLines={2}>{post.chapterTitle}</Text>
          {!!post.music && (
            <Text style={vp.musicLabel} numberOfLines={1}>
              ♫ {post.music.title} · {post.music.artist}
            </Text>
          )}

          {/* Description / pull quote */}
          {!!post.description && (
            <Text style={vp.desc} numberOfLines={3}>{post.description}</Text>
          )}

          {/* Mood pill */}
          <View style={vp.moodPill}>
            <Text style={vp.moodText}>{t(`moods.${post.mood}`, { defaultValue: post.mood })}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const vp = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, zIndex: 10,
  },
  audioControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioBtn: {
    minWidth: 54, height: 38, borderRadius: 19,
    paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  audioLabel: { color: '#fff', fontSize: 10, fontFamily: 'Satoshi-Bold' },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16, gap: 5,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  author: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(220,210,255,0.70)',
  },
  title: {
    fontSize: 18, fontFamily: 'Satoshi-Bold',
    color: '#fff', lineHeight: 24, flexShrink: 1,
  },
  musicLabel: {
    fontSize: 11, fontFamily: 'Satoshi-Medium',
    color: 'rgba(245,211,104,0.92)', marginTop: 2,
  },
  desc: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    color: 'rgba(240,234,255,0.75)', lineHeight: 18, flexShrink: 1,
  },
  moodPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107,91,149,0.55)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    marginTop: 2,
  },
  moodText: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.95)',
  },
});
