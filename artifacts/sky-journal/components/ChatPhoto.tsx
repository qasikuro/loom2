import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SecureImage } from './SecureImage';
import { Icon } from './Icon';

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
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewer, { backgroundColor: background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity accessibilityLabel="Close photo" onPress={onClose} style={styles.viewerClose}>
          <Icon name="x" size={26} color={color} />
        </TouchableOpacity>
        <SecureImage source={{ uri }} style={styles.fullPhoto} contentFit="contain" accessibilityLabel="Chat photo" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  draft: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginHorizontal: 16, marginBottom: 4, borderWidth: 1, borderRadius: 16 },
  thumbnail: { width: 64, height: 64, borderRadius: 10 },
  description: { flex: 1, gap: 5 },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
  hint: { fontFamily: 'Satoshi-Regular', fontSize: 12, opacity: 0.65 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  viewer: { flex: 1 },
  viewerClose: { alignSelf: 'flex-end', width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  fullPhoto: { flex: 1, width: '100%' },
});
