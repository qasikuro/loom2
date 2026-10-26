import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { canonicalMediaUri } from '@/utils/mediaAccess';
import { canWarmNextReel } from '@/utils/reelBuffer';
import { hintReelWebPreload } from '@/utils/reelWebPreload';
import { Video, ResizeMode } from 'expo-av';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/** A bounded, paused preloader and the visible reel share the same player. */
export function ReelVideo({ uri: originalUri, playing, muted, onPrepared }: {
  uri: string; playing: boolean; muted: boolean; onPrepared: (allowed: boolean) => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  // Reels come from the public discovery feed. Start against its canonical API
  // path immediately; the media route still checks live public visibility.
  // Avoid waiting for a read-URL request that returns this same public path.
  const uri = useMemo(() => canonicalMediaUri(originalUri), [originalUri]);
  const source = useMemo(() => uri ? { uri } : undefined, [uri]);
  const [attempt, setAttempt] = useState(0);
  const [firstFrame, setFirstFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const identity = `${uri ?? originalUri}:${attempt}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const hostRef = useRef<View>(null);
  const firstFrameRef = useRef(false);
  const preloadAllowed = useRef(false);
  const wasPlaying = useRef(playing);
  const preparedCallback = useRef(onPrepared);
  preparedCallback.current = onPrepared;

  useEffect(() => {
    firstFrameRef.current = false;
    setFirstFrame(false);
    setFailed(false);
    if (preloadAllowed.current) preparedCallback.current(false);
    preloadAllowed.current = false;
  }, [identity]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // expo-av's web backend leaves preload to browser defaults (often only
    // metadata). Use the standard DOM hint on its existing video element,
    // without resetting src/load() when this paused player becomes visible.
    const host = hostRef.current as unknown as HTMLElement | null;
    const video = host?.querySelector?.('video');
    if (video) return hintReelWebPreload(video, playing);
  }, [identity, failed, playing]);

  useEffect(() => {
    if (failed && preloadAllowed.current) {
      preloadAllowed.current = false;
      preparedCallback.current(false);
    }
  }, [failed]);

  useEffect(() => {
    const promoted = playing && !wasPlaying.current;
    wasPlaying.current = playing;
    // A speculative load can fail on a brief network interruption. Retry once
    // when promoted, rather than presenting a stale preloader error to viewers.
    // Failures during visible playback still require the explicit Retry button.
    if (promoted && failed) {
      setAttempt(value => value + 1);
    }
  }, [playing, failed]);

  function revealFirstFrame() {
    if (firstFrameRef.current) return;
    firstFrameRef.current = true;
    setFirstFrame(true);
  }

  // A mid-playback buffer should not cover the reel with a reconnect message.
  // Keep feedback only until the first actual video frame is available.
  const waiting = playing && !firstFrame && !failed;
  useEffect(() => {
    setShowLoading(false);
    if (!waiting) return;
    // Keep the thumbnail clean through short buffers; only show feedback when
    // the player has genuinely stalled, and never flash a rotating spinner.
    const indicator = setTimeout(() => setShowLoading(true), 1500);
    const timeout = setTimeout(() => setFailed(true), 20_000);
    return () => { clearTimeout(indicator); clearTimeout(timeout); };
  }, [waiting, firstFrame, identity]);

  function retry() {
    setFailed(false);
    setFirstFrame(false);
    setAttempt(value => value + 1);
  }

  const hasError = failed;
  return (
    <View ref={hostRef} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {source && !hasError && (
        <Video
          // The key/source deliberately do not depend on playing: promotion
          // reuses the paused player's native buffer. expo-av unloads this
          // player on unmount when it leaves the bounded preparation window.
          key={identity}
          source={source}
          shouldPlay={playing}
          isMuted={muted || !playing}
          isLooping
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          progressUpdateIntervalMillis={playing ? 500 : 1500}
          style={[StyleSheet.absoluteFill, { opacity: firstFrame ? 1 : 0 }]}
          pointerEvents="none"
          onReadyForDisplay={() => { if (currentIdentity.current === identity) revealFirstFrame(); }}
          onPlaybackStatusUpdate={status => {
            if (currentIdentity.current !== identity) return;
            if (status.isLoaded) {
              if (status.isPlaying && status.positionMillis > 0) revealFirstFrame();
              if (playing) {
                const allowed = canWarmNextReel(status, preloadAllowed.current);
                if (allowed !== preloadAllowed.current) {
                  preloadAllowed.current = allowed;
                  preparedCallback.current(allowed);
                }
              }
            } else if (status.error) setFailed(true);
          }}
          onError={() => { if (currentIdentity.current === identity) setFailed(true); }}
        />
      )}
      {playing && (hasError || (showLoading && !firstFrame)) && (
        <View style={hasError ? styles.feedback : styles.loadingRail} pointerEvents="box-none">
          {hasError ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('reels.retryVideo', { defaultValue: 'Retry video' })}
              onPress={retry} style={[styles.retry, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="refresh-cw" size={20} color={colors.primary} />
              <Text style={[styles.retryText, { color: colors.foreground }]}>{t('reels.retryVideo', { defaultValue: 'Retry video' })}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.loadingTrack} accessibilityRole="progressbar"
              accessibilityLabel={t('reels.loadingVideo', { defaultValue: 'Loading video' })}>
              <View style={styles.loadingFill} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: { position: 'absolute', top: '48%', alignSelf: 'center', alignItems: 'center' },
  loadingRail: { position: 'absolute', bottom: 108, left: 24, right: 24 },
  loadingTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  loadingFill: { height: 2, width: '28%', backgroundColor: 'rgba(255,255,255,0.6)' },
  retry: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  retryText: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
});
