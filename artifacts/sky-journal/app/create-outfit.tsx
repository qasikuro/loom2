import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import CropImageModal from '@/components/CropImageModal';
import { ImageSourceSheet } from '@/components/ImageSourceSheet';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { persistImageUri, ImageUploadError } from '@/utils/persistImage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const VIBE_TAGS = [
  { label: 'Casual',    color: '#78A8C8' },
  { label: 'Formal',    color: '#6B5B95' },
  { label: 'Dreamy',    color: '#9888C0' },
  { label: 'Adventure', color: '#60A878' },
  { label: 'Cozy',      color: '#C8A84B' },
  { label: 'Dark',      color: '#504070' },
  { label: 'Soft',      color: '#C870A0' },
  { label: 'Ethereal',  color: '#78C8C8' },
];

const VIBES = [
  { id: 'romantic',    label: 'Romantic',    symbol: '♡', color: '#FF89B0', desc: 'Hearts drift above your look' },
  { id: 'happy',       label: 'Happy',       symbol: '✦', color: '#FFD86F', desc: 'Sparkles burst around you' },
  { id: 'dark',        label: 'Dark',        symbol: '◉', color: '#9070C8', desc: 'Shadows drift and linger' },
  { id: 'mythical',    label: 'Mythical',    symbol: '✧', color: '#B090FF', desc: 'Constellation stars appear' },
  { id: 'dreamy',      label: 'Dreamy',      symbol: '○', color: '#80C8FF', desc: 'Soft orbs float through' },
  { id: 'ethereal',    label: 'Ethereal',    symbol: '◇', color: '#50EED0', desc: 'Light wisps shimmer' },
  { id: 'cozy',        label: 'Cozy',        symbol: '·', color: '#FFB840', desc: 'Warm embers glow' },
  { id: 'adventurous', label: 'Adventurous', symbol: '◈', color: '#60D888', desc: 'Wind-caught symbols drift' },
];

export default function CreateOutfitScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t: tr } = useTranslation();
  const { addOutfit, updateOutfit } = useApp();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const params = useLocalSearchParams<{
    editId?:          string;
    editName?:        string;
    editDescription?: string;
    editStory?:       string;
    editImageUri?:    string;
    editTags?:        string;
    editIsPublic?:    string;
  }>();

  const editId = params.editId;
  const isEditing = !!editId;

  const [name, setName]               = useState(params.editName ?? '');
  const [description, setDescription] = useState(params.editDescription ?? '');
  const [story, setStory]             = useState(params.editStory ?? '');
  const [imageUri, setImageUri]       = useState<string | undefined>(params.editImageUri || undefined);
  const [pendingUri, setPendingUri]   = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      const all = params.editTags ? (JSON.parse(params.editTags) as string[]) : [];
      return all.filter(t => !t.startsWith('vibe:'));
    }
    catch { return []; }
  });
  const [selectedVibe, setSelectedVibe] = useState<string | null>(() => {
    try {
      const all = params.editTags ? (JSON.parse(params.editTags) as string[]) : [];
      const vt = all.find(t => t.startsWith('vibe:'));
      return vt ? vt.slice(5) : null;
    }
    catch { return null; }
  });
  const [isPublic, setIsPublic]       = useState(params.editIsPublic !== 'false');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showSheet, setShowSheet]     = useState(false);
  const uploadProgress                = useRef(new Animated.Value(0)).current;
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  useEffect(() => {
    if (isEditing) {
      setName(params.editName ?? '');
      setDescription(params.editDescription ?? '');
      setStory(params.editStory ?? '');
      setImageUri(params.editImageUri || undefined);
      try {
        const all = params.editTags ? (JSON.parse(params.editTags) as string[]) : [];
        setSelectedTags(all.filter(t => !t.startsWith('vibe:')));
        const vt = all.find(t => t.startsWith('vibe:'));
        setSelectedVibe(vt ? vt.slice(5) : null);
      } catch { setSelectedTags([]); setSelectedVibe(null); }
      setIsPublic(params.editIsPublic !== 'false');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingUri(result.assets[0].uri);
    }
  }

  async function handleSheetCamera() {
    setShowSheet(false);
    try {
      if (!cameraPermission?.granted) {
        const perm = await requestCameraPermission();
        if (!perm.granted) return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], allowsEditing: false, quality: 1,
      });
      if (!result.canceled && result.assets[0]) {
        setPendingUri(result.assets[0].uri);
      }
    } catch { /* camera unavailable on web */ }
  }

  function handleSheetLibrary() {
    setShowSheet(false);
    // iOS requires the sheet modal to fully finish dismissing before a new
    // system modal (photo library) can be presented — otherwise the app stalls.
    setTimeout(() => pickImage(), Platform.OS === 'ios' ? 400 : 50);
  }

  async function handleCropDone(croppedUri: string, _aspectRatio?: number) {
    setPendingUri(null);
    setUploading(true);
    uploadProgress.setValue(0);
    Animated.timing(uploadProgress, {
      toValue: 0.85, duration: 2400,
      easing: Easing.out(Easing.quad), useNativeDriver: false,
    }).start();
    try {
      const persisted = await persistImageUri(croppedUri);
      Animated.timing(uploadProgress, {
        toValue: 1, duration: 300, useNativeDriver: false,
      }).start(() => setTimeout(() => uploadProgress.setValue(0), 500));
      setImageUri(persisted);
      setError(null);
    } catch (err: unknown) {
      uploadProgress.setValue(0);
      const msg = err instanceof ImageUploadError ? err.userMessage : 'Photo upload failed — try again.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  function toggleTag(tag: string) {
    Haptics.selectionAsync();
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function handleSave() {
    if (!name.trim()) { setError(tr('outfit.needName')); return; }
    if (!imageUri)    { setError('Add a photo — every outfit deserves to be seen ✦'); return; }
    setError(null);
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const allTags = [
      ...selectedTags,
      ...(selectedVibe ? [`vibe:${selectedVibe}`] : []),
    ];
    if (isEditing && editId) {
      updateOutfit(editId, {
        name:        name.trim(),
        description: description.trim(),
        story:       story.trim(),
        imageUri,
        tags:        allTags,
        isPublic,
      });
    } else {
      addOutfit({
        id:          crypto.randomUUID(),
        date:        new Date().toISOString(),
        name:        name.trim(),
        description: description.trim(),
        story:       story.trim(),
        imageUri,
        tags:        allTags,
        isPublic,
      });
    }
    setSaving(false);
    router.back();
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={['#E8E0F4', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 70 }]} />

        <View style={[styles.header, { paddingTop: topPad + 10 }]}>
          <BackButton style={[styles.iconBtn, { backgroundColor: colors.muted }]} iconName="x" size={18} color={colors.foreground} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{isEditing ? tr('outfit.editTitle') : tr('outfit.logTitle')}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={[styles.saveBtnText, { color: saving ? colors.mutedForeground : '#fff' }]}>
              {saving ? '...' : tr('outfit.saveOutfit')}
            </Text>
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          bottomOffset={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        >
          {/* Image picker — tall portrait */}
          <TouchableOpacity
            style={[styles.imagePicker, {
              backgroundColor: imageUri ? 'transparent' : colors.muted,
              borderColor: imageUri ? 'transparent' : error && !imageUri ? '#DC2626' : colors.border,
              borderWidth: error && !imageUri ? 2 : 1.5,
            }]}
            onPress={() => !uploading && setShowSheet(true)}
            activeOpacity={0.8}
            disabled={uploading}
          >
            {uploading ? (
              <View style={styles.imagePlaceholder}>
                <View style={[styles.cameraCircle, { backgroundColor: 'rgba(107,91,149,0.18)' }]}>
                  <ActivityIndicator color="#C8B8E8" size="large" />
                </View>
                <Text style={[styles.imagePlaceholderTitle, { color: 'rgba(200,184,232,0.72)', fontSize: 14 }]}>
                  Uploading…
                </Text>
                <View style={styles.uploadBarTrack}>
                  <Animated.View
                    style={[styles.uploadBarFill, {
                      width: uploadProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    }]}
                  />
                </View>
              </View>
            ) : imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.outfitImage} contentFit="contain" />
                <View style={styles.changeOverlay}>
                  <View style={[styles.changeChip, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                    <Icon name="camera" size={13} color={colors.foreground} />
                    <Text style={[styles.changeChipText, { color: colors.foreground }]}>{tr('outfit.changePhoto')}</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={[styles.cameraCircle, { backgroundColor: `${colors.primary}15` }]}>
                  <Icon name="camera" size={28} color={`${colors.primary}80`} />
                </View>
                <Text style={[styles.imagePlaceholderTitle, { color: colors.mutedForeground }]}>{tr('outfit.addPhoto')}</Text>
                <Text style={[styles.imagePlaceholderSub, { color: `${colors.mutedForeground}70` }]}>{tr('outfit.photoHint')}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{tr('outfit.name')}</Text>
            <TextInput
              style={[styles.nameInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder={tr('outfit.namePlaceholder')}
              placeholderTextColor={`${colors.mutedForeground}80`}
              value={name}
              onChangeText={t => { setName(t); if (error) setError(null); }}
              returnKeyType="done"
            />
          </View>

          {/* Description / notes */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{tr('outfit.notes')}</Text>
            <TextInput
              style={[styles.descInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder={tr('outfit.notesPlaceholder')}
              placeholderTextColor={`${colors.mutedForeground}70`}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Character story — visible to other users */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Character Story</Text>
            <Text style={[styles.storyHint, { color: `${colors.mutedForeground}80` }]}>
              A moment or memory linked to this outfit — visible on your public profile
            </Text>
            <TextInput
              style={[styles.storyInput, { color: colors.foreground, borderColor: colors.primary + '50', backgroundColor: colors.card }]}
              placeholder="Write the story behind this outfit…"
              placeholderTextColor={`${colors.mutedForeground}60`}
              value={story}
              onChangeText={setStory}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Style Tags */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{tr('outfit.vibeTags')}</Text>
            <View style={styles.tagsGrid}>
              {VIBE_TAGS.map(t => {
                const active = selectedTags.includes(t.label);
                return (
                  <TouchableOpacity key={t.label}
                    style={[styles.tagChip, {
                      backgroundColor: active ? `${t.color}22` : `${t.color}0E`,
                      borderColor:     active ? `${t.color}65` : `${t.color}22`,
                      borderWidth:     active ? 1.5 : 1,
                    }]}
                    onPress={() => toggleTag(t.label)}
                  >
                    <Text style={[styles.tagText, { color: t.color }]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Vibe Animation */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Vibe Animation</Text>
            <Text style={[styles.vibeHint, { color: `${colors.mutedForeground}80` }]}>
              Choose an animated effect that plays over your outfit when others view it
            </Text>
            <View style={styles.vibeGrid}>
              {VIBES.map(v => {
                const active = selectedVibe === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.vibeChip, {
                      backgroundColor: active ? `${v.color}20` : `${v.color}0A`,
                      borderColor:     active ? `${v.color}70` : `${v.color}20`,
                      borderWidth:     active ? 2 : 1,
                    }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedVibe(prev => prev === v.id ? null : v.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.vibeSymbol, { color: v.color }]}>{v.symbol}</Text>
                    <View style={styles.vibeTextWrap}>
                      <Text style={[styles.vibeLabel, { color: active ? v.color : colors.foreground }]}>{v.label}</Text>
                      <Text style={[styles.vibeDesc,  { color: `${colors.mutedForeground}80` }]} numberOfLines={1}>{v.desc}</Text>
                    </View>
                    {active && (
                      <View style={[styles.vibeCheck, { backgroundColor: v.color }]}>
                        <Text style={styles.vibeCheckMark}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Inline validation error */}
          {error && (
            <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
              <Icon name="alert-circle" size={14} color="#DC2626" />
              <Text style={[styles.errorText, { color: '#DC2626' }]}>{error}</Text>
            </View>
          )}

          {/* Visibility */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{tr('common.visibility')}</Text>
            <View style={styles.privacyRow}>
              {(['Private', 'Public'] as const).map(opt => {
                const active = opt === 'Private' ? !isPublic : isPublic;
                return (
                  <TouchableOpacity key={opt}
                    style={[styles.privBtn, {
                      backgroundColor: active ? `${colors.primary}15` : colors.muted,
                      borderColor:     active ? `${colors.primary}40` : colors.border,
                      borderWidth:     active ? 1.5 : 1,
                    }]}
                    onPress={() => setIsPublic(opt === 'Public')}
                  >
                    <Icon name={opt === 'Private' ? 'lock' : 'globe'} size={13} color={active ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.privText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt === 'Private' ? tr('common.private') : tr('common.public')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>

      <ImageSourceSheet
        visible={showSheet}
        hasPhoto={!!imageUri}
        onCamera={handleSheetCamera}
        onLibrary={handleSheetLibrary}
        onRemove={() => { setShowSheet(false); setImageUri(undefined); }}
        onCancel={() => setShowSheet(false)}
      />

      {pendingUri && (
        <CropImageModal
          visible
          uri={pendingUri}
          onDone={handleCropDone}
          onCancel={() => setPendingUri(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Satoshi-Bold' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  scroll: { paddingHorizontal: 18, paddingTop: 0, gap: 0 },
  imagePicker: { width: '100%', aspectRatio: 3 / 4, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden', marginBottom: 20 },
  outfitImage: { width: '100%', height: '100%' },
  changeOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 16 },
  changeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  changeChipText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  cameraCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  uploadBarTrack: {
    width: '60%', height: 3, borderRadius: 2,
    backgroundColor: 'rgba(200,184,232,0.12)',
    overflow: 'hidden', marginTop: 8,
  },
  uploadBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#8B7AB5' },
  imagePlaceholderTitle: { fontSize: 15, fontFamily: 'Satoshi-Medium' },
  imagePlaceholderSub: { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 8 },
  nameInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: 'Satoshi-Regular' },
  descInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 22, minHeight: 90 },
  storyHint: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginBottom: 8, marginTop: -2, lineHeight: 17 },
  storyInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 22, minHeight: 120, fontStyle: 'italic' },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tagText: { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  vibeHint: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginBottom: 12, marginTop: -4, lineHeight: 17 },
  vibeGrid: { gap: 8 },
  vibeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16,
  },
  vibeSymbol:  { fontSize: 22, width: 28, textAlign: 'center' },
  vibeTextWrap:{ flex: 1, gap: 2 },
  vibeLabel:   { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  vibeDesc:    { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  vibeCheck: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  vibeCheckMark: { fontSize: 12, color: '#fff', fontFamily: 'Satoshi-Bold' },
  privacyRow: { flexDirection: 'row', gap: 10 },
  privBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  privText: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Medium' },
});
