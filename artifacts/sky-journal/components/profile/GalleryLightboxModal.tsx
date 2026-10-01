import { Icon } from '@/components/Icon';
import type { GalleryPhoto } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SecureImage as Image } from '@/components/SecureImage';
import { saveGalleryPhotoToDevice, shareGalleryPhoto } from '@/utils/galleryPhotoActions';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Props {
  photo: GalleryPhoto | null;
  deletingConfirm: boolean;
  onClose: () => void;
  onDelete: () => void;
  onUseAsOutfit: (photo: GalleryPhoto) => void;
}

type PhotoAction = 'save' | 'share' | null;

export function GalleryLightboxModal({
  photo,
  deletingConfirm,
  onClose,
  onDelete,
  onUseAsOutfit,
}: Props) {
  const colors = useColors();
  const [photoAction, setPhotoAction] = useState<PhotoAction>(null);
  const [feedback, setFeedback] = useState<{
    photoId: string;
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const currentFeedback = photo && feedback?.photoId === photo.id ? feedback : null;

  async function handleSaveToDevice() {
    if (!photo || photoAction) return;
    const selectedPhoto = photo;
    setPhotoAction('save');
    setFeedback(null);
    try {
      const result = await saveGalleryPhotoToDevice(selectedPhoto.imageUri);
      if (!result.granted) {
        setFeedback({
          photoId: selectedPhoto.id,
          kind: 'error',
          text: 'Photo-library permission is needed to save this picture.',
        });
        if (Platform.OS !== 'web' && !result.canAskAgain) {
          Alert.alert(
            'Photo access is off',
            'Allow Storigam to save gallery photos in your device settings.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => { void Linking.openSettings().catch(() => {}); },
              },
            ],
          );
        }
        return;
      }
      setFeedback({ photoId: selectedPhoto.id, kind: 'success', text: 'Saved to your device.' });
    } catch {
      setFeedback({
        photoId: selectedPhoto.id,
        kind: 'error',
        text: 'Could not save this photo. Please try again.',
      });
    } finally {
      setPhotoAction(null);
    }
  }

  async function handleShare() {
    if (!photo || photoAction) return;
    const selectedPhoto = photo;
    setPhotoAction('share');
    setFeedback(null);
    try {
      await shareGalleryPhoto(selectedPhoto.imageUri);
    } catch {
      setFeedback({
        photoId: selectedPhoto.id,
        kind: 'error',
        text: 'Could not share this photo. Please try again.',
      });
    } finally {
      setPhotoAction(null);
    }
  }

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
                <View style={s.actions}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={handleSaveToDevice}
                    disabled={photoAction !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Save photo to device"
                    testID="gallery-save-photo"
                  >
                    {photoAction === 'save'
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Icon name="download" size={16} color={colors.primary} />}
                    <Text style={[s.actionText, { color: colors.foreground }]}>
                      {photoAction === 'save' ? 'Saving…' : 'Save to device'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => onUseAsOutfit(photo)}
                    disabled={photoAction !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Use photo as an outfit"
                    testID="gallery-use-as-outfit"
                  >
                    <Icon name="user" size={16} color={colors.primary} />
                    <Text style={[s.actionText, { color: colors.foreground }]}>Use as outfit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={handleShare}
                    disabled={photoAction !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Share photo"
                    testID="gallery-share-photo"
                  >
                    {photoAction === 'share'
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Icon name="share-2" size={16} color={colors.primary} />}
                    <Text style={[s.actionText, { color: colors.foreground }]}>
                      {photoAction === 'share' ? 'Sharing…' : 'Share'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {currentFeedback && (
                  <Text
                    style={[
                      s.feedback,
                      { color: currentFeedback.kind === 'error' ? colors.destructive : colors.mutedForeground },
                    ]}
                    accessibilityLiveRegion="polite"
                  >
                    {currentFeedback.text}
                  </Text>
                )}
                <TouchableOpacity
                  style={[s.deleteBtn, { backgroundColor: deletingConfirm ? colors.destructive : `${colors.destructive}14`, borderColor: colors.destructive, marginTop: 8 }]}
                  onPress={onDelete}
                  accessibilityRole="button"
                  testID="gallery-delete-photo"
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
  actions:       { gap: 8 },
  actionBtn:     { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  actionText:    { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Bold' },
  feedback:      { fontSize: 12, fontFamily: 'Satoshi-Regular', lineHeight: 17 },
  date:          { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  caption:       { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  deleteBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
});
