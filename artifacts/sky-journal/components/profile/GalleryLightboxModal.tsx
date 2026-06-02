import { Icon } from '@/components/Icon';
import type { GalleryPhoto } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Image } from 'expo-image';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  photo: GalleryPhoto | null;
  deletingConfirm: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export function GalleryLightboxModal({ photo, deletingConfirm, onClose, onDelete }: Props) {
  const colors = useColors();
  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          <View style={s.handle} />
          {photo && (
            <>
              <View style={[s.imageWrap, { backgroundColor: '#0A0820' }]}>
                <Image source={{ uri: photo.imageUri }} style={s.image} contentFit="contain" cachePolicy="memory-disk" />
              </View>
              <View style={[s.body, { paddingHorizontal: 20 }]}>
                <Text style={[s.date, { color: colors.mutedForeground }]}>
                  {new Date(photo.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                {photo.caption ? <Text style={[s.caption, { color: colors.foreground }]}>{photo.caption}</Text> : null}
                <TouchableOpacity
                  style={[s.deleteBtn, { backgroundColor: deletingConfirm ? colors.destructive : `${colors.destructive}14`, borderColor: colors.destructive, marginTop: 8 }]}
                  onPress={onDelete}
                >
                  <Icon name="trash-2" size={14} color={deletingConfirm ? '#fff' : colors.destructive} />
                  <Text style={[s.deleteBtnText, { color: deletingConfirm ? '#fff' : colors.destructive }]}>
                    {deletingConfirm ? 'Tap again to delete' : 'Delete photo'}
                  </Text>
                </TouchableOpacity>
                <View style={{ height: 12 }} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,86,255,0.25)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  imageWrap:     { width: '100%', aspectRatio: 1, overflow: 'hidden' },
  image:         { width: '100%', height: '100%' },
  body:          { paddingVertical: 16, gap: 10 },
  date:          { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  caption:       { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  deleteBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
});
