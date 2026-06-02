import { Icon } from '@/components/Icon';
import { MoodBadge } from '@/components/MoodBadge';
import { Images } from '@/assets/images';
import type { Character, Outfit } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { fmtDate } from './profileConstants';

interface Props {
  outfit: Outfit | null;
  isActiveOutfit: boolean;
  character: Character;
  deletingConfirm: boolean;
  avatarSource: any;
  onClose: () => void;
  onSetDisplay: () => void;
  onDelete: () => void;
}

export function OutfitDetailModal({
  outfit, isActiveOutfit, character, deletingConfirm, avatarSource,
  onClose, onSetDisplay, onDelete,
}: Props) {
  const colors = useColors();
  const { t }  = useTranslation();

  return (
    <Modal
      visible={!!outfit}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.card }]}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {outfit && (
              <>
                <View style={[s.imageWrap, { backgroundColor: `${colors.primary}14` }]}>
                  {outfit.imageUri ? (
                    <Image source={{ uri: outfit.imageUri }} style={s.image} contentFit="contain" />
                  ) : (
                    <View style={[s.image, { backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
                      <Icon name="camera" size={36} color={`${colors.primary}50`} />
                      <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: `${colors.primary}70`, textAlign: 'center', lineHeight: 20 }}>
                        No photo yet{'\n'}
                        <Text style={{ fontFamily: 'Satoshi-Regular', fontSize: 12, opacity: 0.7 }}>Tap "Edit outfit" below to add one</Text>
                      </Text>
                    </View>
                  )}
                  {isActiveOutfit && (
                    <View style={[s.activePill, { backgroundColor: colors.primary }]}>
                      <Text style={s.activePillText}>{t('profile.displayOutfit')}</Text>
                    </View>
                  )}
                </View>

                <View style={[s.body, { paddingHorizontal: 20 }]}>
                  <View style={s.nameRow}>
                    <Text style={[s.outfitName, { color: colors.foreground }]} numberOfLines={2}>
                      {outfit.name}
                    </Text>
                    <Text style={[s.outfitDate, { color: colors.mutedForeground }]}>
                      {fmtDate(outfit.date)}
                    </Text>
                  </View>

                  {outfit.tags.length > 0 && (
                    <View style={s.tags}>
                      {outfit.tags.map(tag => (
                        <View key={tag} style={[s.tag, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                          <Text style={[s.tagText, { color: colors.primary }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {outfit.description ? (
                    <Text style={[s.desc, { color: colors.mutedForeground }]}>
                      {outfit.description}
                    </Text>
                  ) : null}

                  {!!(outfit as any).story && (
                    <View style={[s.storyCard, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}22` }]}>
                      <View style={s.storyHeader}>
                        <Icon name="book-open" size={13} color={colors.primary} />
                        <Text style={[s.storyLabel, { color: colors.primary }]}>Character Story</Text>
                      </View>
                      <Text style={[s.storyText, { color: colors.foreground }]}>
                        {(outfit as any).story}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[s.actionBtn, {
                      backgroundColor: isActiveOutfit ? `${colors.primary}18` : colors.primary,
                      borderColor: isActiveOutfit ? colors.primary : 'transparent',
                    }]}
                    onPress={onSetDisplay}
                  >
                    <Icon name="star" size={15} color={isActiveOutfit ? colors.primary : '#fff'} />
                    <Text style={[s.actionBtnText, { color: isActiveOutfit ? colors.primary : '#fff' }]}>
                      {isActiveOutfit ? t('profile.removeDisplay') : t('profile.setDisplay')}
                    </Text>
                  </TouchableOpacity>

                  <View style={s.divider}>
                    <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                    <Text style={[s.dividerLabel, { color: colors.mutedForeground }]}>
                      {t('profile.yourCharacter')}
                    </Text>
                    <View style={[s.dividerLine, { backgroundColor: colors.border }]} />
                  </View>

                  <View style={s.charRow}>
                    <View style={[s.charAvatar, { borderColor: colors.primary, backgroundColor: colors.muted }]}>
                      <Image source={avatarSource} style={s.charAvatarImg} contentFit="cover" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[s.charName, { color: colors.foreground }]}>{character.name}</Text>
                      {character.username && (
                        <Text style={[s.charHandle, { color: colors.primary }]}>@{character.username}</Text>
                      )}
                      {character.bio ? (
                        <Text style={[s.charBio, { color: colors.mutedForeground }]} numberOfLines={3}>
                          {character.bio}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {character.traits.length > 0 && (
                    <View style={s.charTraits}>
                      {character.traits.map(tr => (
                        <View key={tr} style={[s.charTraitChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }]}>
                          <Text style={[s.charTraitText, { color: colors.primary }]}>{tr}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {character.mood && (
                    <View style={{ marginTop: 10 }}>
                      <MoodBadge mood={character.mood} />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[s.actionBtn, {
                      backgroundColor: `${colors.primary}12`,
                      borderColor: colors.primary,
                      marginBottom: 8,
                    }]}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: '/create-outfit',
                        params: {
                          editId:          outfit.id,
                          editName:        outfit.name,
                          editDescription: outfit.description ?? '',
                          editStory:       (outfit as any).story ?? '',
                          editImageUri:    outfit.imageUri ?? '',
                          editTags:        JSON.stringify(outfit.tags ?? []),
                          editIsPublic:    outfit.isPublic ? 'true' : 'false',
                        },
                      } as any);
                    }}
                  >
                    <Icon name="edit-2" size={14} color={colors.primary} />
                    <Text style={[s.actionBtnText, { color: colors.primary }]}>Edit outfit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.actionBtn, {
                      backgroundColor: deletingConfirm ? colors.destructive : `${colors.destructive}14`,
                      borderColor: colors.destructive,
                    }]}
                    onPress={onDelete}
                  >
                    <Icon name="trash-2" size={14} color={deletingConfirm ? '#fff' : colors.destructive} />
                    <Text style={[s.actionBtnText, { color: deletingConfirm ? '#fff' : colors.destructive }]}>
                      {deletingConfirm ? 'Tap again to delete' : 'Delete outfit'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ height: 12 }} />
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,86,255,0.25)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  imageWrap:     { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  image:         { width: '100%', height: 220, alignItems: 'center', justifyContent: 'center' },
  activePill:    { position: 'absolute', bottom: 12, left: 16, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  activePillText:{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: 0.2 },
  body:          { paddingVertical: 16, gap: 12 },
  nameRow:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  outfitName:    { flex: 1, fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  outfitDate:    { fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 4, flexShrink: 0 },
  tags:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:           { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  tagText:       { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  desc:          { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },
  storyCard:     { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  storyHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storyLabel:    { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
  storyText:     { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 22 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 16, borderWidth: 1.5 },
  actionBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  divider:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine:   { flex: 1, height: 1 },
  dividerLabel:  { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.5 },
  charRow:       { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  charAvatar:    { width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden', flexShrink: 0 },
  charAvatarImg: { width: '100%', height: '100%' },
  charName:      { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  charHandle:    { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  charBio:       { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, marginTop: 2 },
  charTraits:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  charTraitChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  charTraitText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
});
