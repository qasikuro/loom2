import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useSecureMediaUri } from '@/hooks/useSecureMediaUri';
import { Video, ResizeMode } from 'expo-av';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

/** A bounded, paused preloader and the visible reel share the same player. */
export function ReelVideo({ uri: originalUri, playing, muted, onPrepared }: {
  uri: string; playing: boolean; muted: boolean; onPrepared: () => void;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  const { uri, renew, error: authorizationError } = useSecureMediaUri(originalUri, { waitForAuthorization: true });
  const source = useMemo(() => uri ? { uri } : undefined, [uri]);
  const [attempt, setAttempt] = useState(0);
  const [firstFrame, setFirstFrame] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
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
    if (playing && firstFrame && !failed && !authorizationError) onPrepared();
  }, [playing, firstFrame, failed, authorizationError, onPrepared]);

  const waiting = playing && (!firstFrame || buffering || retrying) && !failed && !authorizationError;
  useEffect(() => {
    setShowLoading(false);
    if (!waiting) return;
    // Brief buffers should not flash a spinner; stalled requests must offer a way out.
    const indicator = setTimeout(() => setShowLoading(true), 400);
    const timeout = setTimeout(() => setFailed(true), 20_000);
    return () => { clearTimeout(indicator); clearTimeout(timeout); };
  }, [waiting, identity]);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    await renew();
    setAttempt(value => value + 1);
    setRetrying(false);
  }

  const hasError = failed || authorizationError;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {source && !hasError && !retrying && (
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
              onPress={() => { void retry(); }} style={[styles.retry, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="refresh-cw" size={20} color={colors.primary} />
              <Text style={[styles.retryText, { color: colors.foreground }]}>{t('reels.retryVideo', { defaultValue: 'Retry video' })}</Text>
            </TouchableOpacity>
          ) : <ActivityIndicator size="small" color={colors.primary} accessibilityLabel={t('reels.loadingVideo', { defaultValue: 'Loading video' })} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feedback: { position: 'absolute', top: '48%', alignSelf: 'center', alignItems: 'center' },
  retry: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  retryText: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
});
