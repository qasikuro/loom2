import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SecureImage } from './SecureImage';
import { Icon } from './Icon';
import { useColors } from '@/hooks/useColors';
import { getMediaAuthScope, resolveMediaReadUrl, subscribeMediaAuthScope } from '@/utils/mediaAccess';

/** Scope the native photo and its retry state to the current reader, never a previous account. */
type PhotoProps = {
  uri: string; width: number; maxHeight?: number;
  onOpen?: () => void; onLongPress?: () => void;
};
export function ChatMessagePhoto(props: PhotoProps) {
  const scope = useSyncExternalStore(subscribeMediaAuthScope, getMediaAuthScope, getMediaAuthScope);
  return <MessagePhoto key={JSON.stringify([scope, props.uri])} {...props} scope={scope} />;
}

function MessagePhoto({ uri, width, maxHeight, onOpen, onLongPress, scope }: PhotoProps & { scope: string | null }) {
  const colors = useColors();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [readUri, setReadUri] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1);
  const mounted = useRef(true);
  const retrying = useRef(false);
  const generation = useRef(0);
  const autoRetried = useRef(false);
  const ready = useRef(false);
  const load = useCallback(async (force: boolean) => {
    const current = ++generation.current;
    setStatus('loading');
    try {
      // Never let the native loader request an unsigned private API path first.
      const next = await resolveMediaReadUrl(uri, force, scope);
      if (!mounted.current || current !== generation.current || getMediaAuthScope() !== scope) return;
      setReadUri(next);
      setAttempt(value => value + 1);
    } catch {
      if (mounted.current && current === generation.current) setStatus('error');
    }
  }, [uri, scope]);
  useEffect(() => {
    mounted.current = true;
    void load(false);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && !ready.current) {
        autoRetried.current = false;
        void load(true);
      }
    });
    return () => {
      mounted.current = false;
      generation.current++;
      subscription.remove();
    };
  }, [load]);
  const retry = async () => {
    if (retrying.current) return;
    retrying.current = true;
    autoRetried.current = false;
    try {
      await load(true);
    } finally {
      retrying.current = false;
    }
  };
  return (
    <View style={[styles.messagePhoto, { width, height: maxHeight ? Math.min(width / aspect, maxHeight) : width, backgroundColor: colors.muted }]}>
      {readUri && <ExpoImage
        key={attempt}
        source={{ uri: readUri, cacheKey: JSON.stringify([scope, uri]) }}
        recyclingKey={JSON.stringify([scope, uri])}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority="high"
        transition={0}
        accessibilityLabel="Shared photo"
        accessible={!onOpen}
        onLoadStart={() => setStatus('loading')}
        onLoad={event => {
          const { width: w, height: h } = event.source;
          // Inline thumbnails reserve a stable footprint before decoding, so
          // images appearing above the viewport cannot move the scroll anchor.
          // The full-screen viewer can still use the image's natural aspect.
          if (maxHeight && w > 0 && h > 0) setAspect(Math.max(0.65, Math.min(1.7, w / h)));
          autoRetried.current = false;
          ready.current = true;
          setStatus('ready');
        }}
        onError={() => {
          ready.current = false;
          if (!autoRetried.current) {
            autoRetried.current = true;
            void load(true);
          } else setStatus('error');
        }}
      />}
      {status === 'ready' && onOpen && (
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onOpen} onLongPress={onLongPress} delayLongPress={350}
          accessibilityRole="imagebutton" accessibilityLabel="View shared photo"
          accessibilityHint="Opens the photo. Hold for message options." />
      )}
      {status === 'loading' && (
        <View style={styles.photoStatus} pointerEvents="none" accessibilityLabel="Loading photo">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {status === 'error' && (
        <TouchableOpacity onPress={() => void retry()} style={[styles.photoStatus, { backgroundColor: colors.muted }]}
          accessibilityRole="button" accessibilityLabel="Photo could not load. Tap to retry">
          <Icon name="refresh-cw" size={23} color={colors.primary} />
          <Text style={[styles.photoStatusText, { color: colors.foreground }]}>Tap to reload photo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ChatPhotoDraft({ uri, busy, onRemove, color }: {
  uri: string; busy: boolean; onRemove: () => void; color: string;
}) {
  return (
    <View style={[styles.draft, { borderColor: color }]}>
      <SecureImage source={{ uri }} style={styles.thumbnail} contentFit="contain" />
      <View style={styles.description}>
        <Text style={[styles.label, { color }]}>{busy ? 'Sending photo…' : 'Photo ready to send'}</Text>
        <Text style={[styles.hint, { color }]}>Add a caption below, or send it as it is.</Text>
      </View>
      <TouchableOpacity onPress={onRemove} disabled={busy} accessibilityLabel="Remove selected photo" style={styles.close}>
        <Icon name="x" size={20} color={color} />
      </TouchableOpacity>
    </View>
  );
}

export function ChatPhotoViewer({ uri, onClose, background, color }: {
  uri: string; onClose: () => void; background: string; color: string;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewer, { backgroundColor: background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity accessibilityLabel="Close photo" onPress={onClose} style={styles.viewerClose}>
          <Icon name="x" size={26} color={color} />
        </TouchableOpacity>
        <View style={styles.fullPhoto}>
          <ChatMessagePhoto uri={uri} width={Math.max(64, width - 24)}
            maxHeight={Math.max(64, height - insets.top - insets.bottom - 76)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  messagePhoto: { borderRadius: 14, overflow: 'hidden' },
  photoStatus: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  photoStatusText: { fontFamily: 'Satoshi-Medium', fontSize: 13, textAlign: 'center' },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderRadius: 16 },
  thumbnail: { width: 64, height: 64, borderRadius: 10 },
  description: { flex: 1, gap: 5 },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
  hint: { fontFamily: 'Satoshi-Regular', fontSize: 12, opacity: 0.65 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  viewer: { flex: 1 },
  viewerClose: { alignSelf: 'flex-end', width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  fullPhoto: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 12 },
});
