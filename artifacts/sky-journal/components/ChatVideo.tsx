import { Icon } from '@/components/Icon';
import { SecureImage } from '@/components/SecureImage';
import { resolveMediaReadUrl, getMediaAuthScope, subscribeMediaAuthScope } from '@/utils/mediaAccess';
import { useTheme } from '@/context/ThemeContext';
import { useColors as useDesignColors } from '@workspace/storigam-kindness/hooks/use-colors';
import { Video, ResizeMode } from 'expo-av';
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

export const ChatMessageVideo = React.memo(function ChatMessageVideo(props: {
  thumbnailUri?: string | null;
  width: number;
  height: number;
}) {
  return <ChatVideoPoster {...props} testID="chat-video-row" />;
});

export function ChatVideoDraft({ thumbnailUri, busy, onRemove }: {
  thumbnailUri?: string | null;
  busy: boolean;
  onRemove: () => void;
}) {
  const { isDark } = useTheme();
  const colors = useDesignColors(isDark ? 'dark' : 'light');
  return (
    <View style={[styles.draft, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <ChatVideoPoster thumbnailUri={thumbnailUri} width={64} height={64} />
      <View style={styles.draftCopy}>
        <Text style={[styles.draftTitle, { color: colors.foreground, fontFamily: colors.fontFamily.bold }]}>
          {busy ? 'Sending video…' : 'Video ready to send'}
        </Text>
        <Text style={[styles.draftHint, { color: colors.mutedForeground, fontFamily: colors.fontFamily.regular }]}>
          Add a caption below, or send it as it is.
        </Text>
      </View>
      <TouchableOpacity
        onPress={onRemove}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Remove selected video"
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
