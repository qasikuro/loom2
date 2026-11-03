import { Icon } from '@/components/Icon';
import { SecureImage } from '@/components/SecureImage';
import { resolveMediaReadUrl, getMediaAuthScope, subscribeMediaAuthScope } from '@/utils/mediaAccess';
import { useTheme } from '@/context/ThemeContext';
import { useColors as useDesignColors } from '@workspace/storigam-kindness/hooks/use-colors';
import { ResizeMode, VideoSurface as Video } from '@/components/VideoSurface';
import { Image as ExpoImage } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ChatVideoPoster({ thumbnailUri, width, height, testID }: {
  thumbnailUri?: string | null;
  width: number;
  height: number;
  testID?: string;
}) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  const [loadedThumbnail, setLoadedThumbnail] = useState<string | null>(null);
  return (
    <View testID={testID} style={[styles.poster, { width, height, backgroundColor: colors.muted }]}>
      {thumbnailUri
        ? <SecureImage
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            testID={loadedThumbnail === thumbnailUri ? 'chat-video-thumbnail-ready' : undefined}
            accessibilityLabel={loadedThumbnail === thumbnailUri ? 'Video thumbnail loaded' : undefined}
            accessible={loadedThumbnail === thumbnailUri}
            onLoad={() => setLoadedThumbnail(thumbnailUri)}
          />
        : <Icon name="video" size={28} color={colors.foreground} />}
      <View pointerEvents="none" style={[styles.playDisc, { backgroundColor: colors.background }]}>
        <Icon name="play" size={18} color={colors.primary} />
      </View>
    </View>
  );
}

export function ChatMessageVideo(props: {
  thumbnailUri?: string | null;
  width: number;
  height: number;
}) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  const scope = useSyncExternalStore(subscribeMediaAuthScope, getMediaAuthScope, getMediaAuthScope);
  const uri = props.thumbnailUri ?? null;
  const identity = JSON.stringify([scope, uri]);
  const generation = useRef(0);
  const currentIdentity = useRef(identity);
  const mounted = useRef(true);
  const autoRetried = useRef(false);
  const [imageState, setImageState] = useState<{
    identity: string;
    status: 'loading' | 'ready' | 'error';
    readUri: string | null;
    attempt: number;
  }>({ identity, status: 'loading', readUri: null, attempt: 0 });

  if (currentIdentity.current !== identity) {
    currentIdentity.current = identity;
    generation.current++;
    autoRetried.current = false;
  }

  const load = useCallback(async (force: boolean) => {
    if (!uri) return;
    const request = ++generation.current;
    const requestIdentity = identity;
    setImageState(current => ({ identity: requestIdentity, status: 'loading', readUri: null, attempt: current.attempt + 1 }));
    try {
      const readUri = await resolveMediaReadUrl(uri, force, scope);
      if (
        !mounted.current
        || request !== generation.current
        || currentIdentity.current !== requestIdentity
        || getMediaAuthScope() !== scope
      ) return;
      setImageState(current => ({ identity: requestIdentity, status: 'loading', readUri, attempt: current.attempt }));
    } catch {
      if (
        mounted.current
        && request === generation.current
        && currentIdentity.current === requestIdentity
        && getMediaAuthScope() === scope
      ) setImageState(current => ({ identity: requestIdentity, status: 'error', readUri: null, attempt: current.attempt }));
    }
  }, [uri, identity, scope]);

  useEffect(() => {
    mounted.current = true;
    if (uri) void load(false);
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, [load, uri]);

  const currentState = imageState.identity === identity
    ? imageState
    : { identity, status: 'loading' as const, readUri: null, attempt: 0 };
  const retry = async () => {
    if (currentState.status === 'loading') return;
    autoRetried.current = false;
    await load(true);
  };
  const retryImageAfterFailure = () => {
    if (!autoRetried.current) {
      autoRetried.current = true;
      void load(true);
    } else {
      setImageState(current => current.identity === identity
        ? { ...current, status: 'error', readUri: null }
        : current);
    }
  };

  return (
    <View
      testID="chat-video-row"
      style={[styles.poster, { width: props.width, height: props.height, backgroundColor: colors.muted }]}
    >
      {uri
        ? currentState.readUri && currentState.status !== 'error'
          ? <ExpoImage
              key={`${identity}:${currentState.attempt}`}
              source={{ uri: currentState.readUri, cacheKey: identity }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              recyclingKey={identity}
              testID={currentState.status === 'ready' ? 'chat-video-thumbnail-ready' : undefined}
              accessibilityLabel={currentState.status === 'ready' ? 'Video thumbnail loaded' : undefined}
              accessible={currentState.status === 'ready'}
              onLoad={() => {
                autoRetried.current = false;
                setImageState(current => current.identity === identity
                  ? { ...current, status: 'ready' }
                  : current);
              }}
              onError={retryImageAfterFailure}
            />
          : null
        : <Icon name="video" size={28} color={colors.foreground} />}
      {uri && currentState.status === 'loading' && (
        <View pointerEvents="none" style={styles.thumbnailStatus} accessibilityLabel="Loading video thumbnail">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {uri && currentState.status === 'error' && (
        <TouchableOpacity
          style={styles.thumbnailStatus}
          onPress={() => void retry()}
          accessibilityRole="button"
          accessibilityLabel="Video thumbnail could not load. Tap to retry"
          accessibilityState={{ disabled: false, busy: false }}
          testID="retry-chat-video-thumbnail"
        >
          <Icon name="refresh-cw" size={23} color={colors.primary} />
          <Text style={[styles.thumbnailRetryLabel, { color: colors.foreground, fontFamily: colors.fontFamily.medium }]}>
            Tap to reload thumbnail
          </Text>
        </TouchableOpacity>
      )}
      {(!uri || currentState.status === 'ready') && (
        <View pointerEvents="none" style={[styles.playDisc, { backgroundColor: colors.background }]}>
          <Icon name="play" size={18} color={colors.primary} />
        </View>
      )}
    </View>
  );
}

export function ChatVideoDraft({ thumbnailUri, busy, progress, onRemove }: {
  thumbnailUri?: string | null;
  busy: boolean;
  progress?: number | null;
  onRemove: () => void;
}) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  return (
    <View style={[styles.draft, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <ChatVideoPoster thumbnailUri={thumbnailUri} width={64} height={64} />
      <View style={styles.draftCopy}>
        <Text style={[styles.draftTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
          {busy ? `Uploading video${progress != null ? ` · ${Math.round(progress * 100)}%` : '…'}` : 'Video ready to send'}
        </Text>
        <Text style={[styles.draftHint, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
          {busy ? 'You can cancel before it is sent.' : 'Add a caption below, or send it as it is.'}
        </Text>
        {busy && progress != null && (
          <View
            testID="chat-video-upload-progress"
            accessibilityRole="progressbar"
            accessibilityLabel="Video upload progress"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
            style={[styles.progressTrack, { backgroundColor: colors.border }]}
          >
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
      </View>
      <TouchableOpacity
        onPress={onRemove}
        testID={busy ? 'cancel-chat-video-upload' : 'remove-chat-video-draft'}
        disabled={busy && progress == null}
        accessibilityRole="button"
        accessibilityLabel={busy ? 'Cancel video upload' : 'Remove selected video'}
        accessibilityState={{ disabled: busy && progress == null, busy }}
        style={styles.remove}
      >
        <Icon name="x" size={20} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );
}

export function ChatVideoViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  const insets = useSafeAreaInsets();
  const scope = useSyncExternalStore(subscribeMediaAuthScope, getMediaAuthScope, getMediaAuthScope);
  const [readUri, setReadUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);

  const resolve = useCallback(async (force: boolean) => {
    const request = ++generation.current;
    setLoading(true);
    setFailed(false);
    setReadUri(null);
    try {
      const next = await resolveMediaReadUrl(uri, force, scope);
      if (request !== generation.current || getMediaAuthScope() !== scope) return;
      setReadUri(next);
    } catch {
      if (request === generation.current) setFailed(true);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [uri, scope]);

  useEffect(() => {
    void resolve(attempt > 0);
    return () => { generation.current++; };
  }, [resolve, attempt]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.viewer, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.viewerHeader}>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close video"
            style={styles.viewerClose}
          >
            <Icon name="x" size={25} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.viewerMedia}>
          {readUri && !failed ? (
            <Video
              key={`${scope}:${uri}:${attempt}`}
              source={{ uri: readUri }}
              style={styles.player}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              onError={() => setFailed(true)}
            />
          ) : loading ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : (
            <View style={styles.failure}>
              <Text style={[styles.failureText, { color: colors.foreground, fontFamily: colors.fontFamily.medium }]}>This video couldn’t be opened.</Text>
              <TouchableOpacity
                onPress={() => setAttempt(value => value + 1)}
                accessibilityRole="button"
                accessibilityLabel="Retry loading video"
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.retryLabel, { color: colors.primaryForeground, fontFamily: colors.fontFamily.bold }]}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  poster: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12 },
  thumbnailStatus: {
    ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12,
  },
  thumbnailRetryLabel: { fontSize: 12, textAlign: 'center' },
  playDisc: {
    position: 'absolute', width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', opacity: 0.94,
  },
  draft: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderRadius: 16,
  },
  draftCopy: { flex: 1, gap: 5 },
  draftTitle: { fontSize: 13 },
  draftHint: { fontSize: 12 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 2 },
  progressFill: { height: 4, borderRadius: 2 },
  remove: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  viewer: { flex: 1 },
  viewerHeader: { height: 52, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 10 },
  viewerClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  viewerMedia: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  player: { width: '100%', height: '100%' },
  failure: { alignItems: 'center', gap: 16, padding: 20 },
  failureText: { fontSize: 15, textAlign: 'center' },
  retryButton: { minWidth: 120, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16, alignItems: 'center' },
  retryLabel: { fontSize: 14 },
});
