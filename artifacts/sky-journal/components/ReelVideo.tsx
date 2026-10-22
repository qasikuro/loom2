import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { canonicalMediaUri } from '@/utils/mediaAccess';
import { Video, ResizeMode } from 'expo-av';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/** A bounded, paused preloader and the visible reel share the same player. */
export function ReelVideo({ uri: originalUri, playing, muted, onPrepared }: {
  uri: string; playing: boolean; muted: boolean; onPrepared: () => void;
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
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const identity = `${uri ?? originalUri}:${attempt}`;
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;

  useEffect(() => {
    setFirstFrame(false);
    setBuffering(false);
    setFailed(false);
  }, [identity]);
  useEffect(() => {
    if (playing && firstFrame && !failed) onPrepared();
  }, [playing, firstFrame, failed, onPrepared]);

  const waiting = playing && (!firstFrame || buffering) && !failed;
  useEffect(() => {
    setShowLoading(false);
    if (!waiting) return;
    // Keep the thumbnail clean through short buffers; only show feedback when
    // the player has genuinely stalled, and never flash a rotating spinner.
    const indicator = setTimeout(() => setShowLoading(true), firstFrame ? 1200 : 900);
    const timeout = setTimeout(() => setFailed(true), 20_000);
    return () => { clearTimeout(indicator); clearTimeout(timeout); };
  }, [waiting, firstFrame, identity]);

  function retry() {
    setFailed(false);
    setFirstFrame(false);
    setBuffering(false);
    setAttempt(value => value + 1);
  }

  const hasError = failed;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {source && !hasError && (
        <Video
          key={identity}
          source={source}
          shouldPlay={playing}
          isMuted={muted || !playing}
          isLooping
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls={false}
          progressUpdateIntervalMillis={500}
          style={[StyleSheet.absoluteFill, { opacity: firstFrame ? 1 : 0 }]}
          pointerEvents="none"
          onReadyForDisplay={() => { if (currentIdentity.current === identity) setFirstFrame(true); }}
          onPlaybackStatusUpdate={status => {
            if (currentIdentity.current !== identity) return;
            if (status.isLoaded) {
              setBuffering(status.isBuffering);
              if (status.isPlaying && status.positionMillis > 0) setFirstFrame(true);
            } else if (status.error) setFailed(true);
          }}
          onError={() => { if (currentIdentity.current === identity) setFailed(true); }}
        />
      )}
      {playing && (hasError || showLoading) && (
        <View style={styles.feedback} pointerEvents="box-none">
          {hasError ? (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('reels.retryVideo', { defaultValue: 'Retry video' })}
              onPress={retry} style={[styles.retry, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="refresh-cw" size={20} color={colors.primary} />
              <Text style={[styles.retryText, { color: colors.foreground }]}>{t('reels.retryVideo', { defaultValue: 'Retry video' })}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.loadingPill} accessibilityRole="progressbar"
              accessibilityLabel={t(firstFrame ? 'reels.reconnecting' : 'reels.loadingVideo', {
                defaultValue: firstFrame ? 'Reconnecting video' : 'Loading video',
              })}>
              <Icon name={firstFrame ? 'refresh-cw' : 'video'} size={14} color="#F4EEFF" />
              <Text style={styles.loadingText}>
                {t(firstFrame ? 'reels.reconnecting' : 'reels.loadingVideo', {
                  defaultValue: firstFrame ? 'Reconnecting video' : 'Loading video',
                })}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: { position: 'absolute', top: '48%', alignSelf: 'center', alignItems: 'center' },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: 'rgba(8,6,24,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  loadingText: { color: '#F4EEFF', fontFamily: 'Satoshi-Medium', fontSize: 12 },
  retry: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  retryText: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
});
