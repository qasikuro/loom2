import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import CropImageModal from '@/components/CropImageModal';
import { ImageSourceSheet } from '@/components/ImageSourceSheet';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { persistImageUri } from '@/utils/persistImage';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { SecureImage as Image } from '@/components/SecureImage';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { SkyLoadingMark } from '@/components/SkyLoading';
import { AudiusMusicPicker } from '@/features/story-studio/components/AudiusMusicPicker';
import type { StoryMusic } from '@/context/mappers';

const VIBE_TAGS = [
  { label: 'Casual',    color: '#B48AFF', icon: 'star' },
  { label: 'Formal',    color: '#D6B3FF', icon: 'star' },
  { label: 'Dreamy',    color: '#A5A3FF', icon: 'moon' },
  { label: 'Adventure', color: '#70DAAB', icon: 'compass' },
  { label: 'Cozy',      color: '#FFB36B', icon: 'sun' },
  { label: 'Dark',      color: '#AF94EB', icon: 'circle' },
  { label: 'Soft',      color: '#F38CCA', icon: 'heart' },
  { label: 'Ethereal',  color: '#77DDF6', icon: 'zap' },
];

const LIGHT_TAG_COLORS: Record<string, string> = {
  Casual: '#7044AF',
  Formal: '#6847A2',
  Dreamy: '#504A9C',
  Adventure: '#1D7450',
  Cozy: '#895000',
  Dark: '#64499B',
  Soft: '#A3346A',
  Ethereal: '#126E83',
};

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
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { t: tr } = useTranslation();
  const { addOutfit, updateOutfit } = useApp();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = 24;
  const contentWidth = Math.min(windowWidth, 720);
  const actionTextColor = isDark ? '#211342' : '#FFFFFF';
  const headerButtonSurface = isDark ? '#201838' : colors.card;
  const headerButtonBorder = isDark ? '#514073' : colors.border;
  const photoCardSurface = isDark ? '#17132D' : colors.card;
  const photoCardBorder = isDark ? '#453A64' : colors.border;
  const pickerSurface = isDark ? '#1B1633' : colors.card;
  const pickerBorder = isDark ? '#8F79BA' : colors.border;
  const inputSurface = isDark ? '#1B1934' : colors.card;
  const inputBorder = isDark ? '#493D66' : colors.border;
  const headerGradient: [string, string, string] = isDark
    ? ['#26164D', '#121027', colors.background]
    : ['#EEE8FB', '#F5F1FC', colors.background];

  const params = useLocalSearchParams<{
    editId?:          string;
    editName?:        string;
    editDescription?: string;
    editStory?:       string;
    editImageUri?:    string;
    editTags?:        string;
    editIsPublic?:    string;
    editMusic?:       string;
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
  const [music, setMusic] = useState<StoryMusic | null>(() => {
    try { return params.editMusic ? JSON.parse(params.editMusic) as StoryMusic : null; }
    catch { return null; }
  });
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showSheet, setShowSheet]     = useState(false);
  const uploadProgress                = useRef(new Animated.Value(0)).current;
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  // Use the local navigator so BackButton routes through the same navigator
  // that usePreventRemove is registered on.
  const navigation = useNavigation();

  // Capture initial field values at mount so we can detect unsaved edits.
  // For new outfits every field starts blank/default.  For edits we use the
  // params that were passed in — changes from those values are "dirty".
  const [initBaseline] = useState(() => ({
    name:         params.editName        ?? '',
    description:  params.editDescription ?? '',
    story:        params.editStory       ?? '',
    imageUri:     params.editImageUri    || undefined as string | undefined,
    tags:         (() => {
      try {
        const all = params.editTags ? (JSON.parse(params.editTags) as string[]) : [];
        return all.filter((t: string) => !t.startsWith('vibe:')).sort().join(',');
      } catch { return ''; }
    })(),
    vibe: (() => {
      try {
        const all = params.editTags ? (JSON.parse(params.editTags) as string[]) : [];
        const vt = all.find((t: string) => t.startsWith('vibe:'));
        return vt ? vt.slice(5) : null as string | null;
      } catch { return null; }
    })(),
    isPublic:     params.editIsPublic !== 'false',
    music: (() => {
      try { return JSON.stringify(params.editMusic ? JSON.parse(params.editMusic) : null); }
      catch { return 'null'; }
    })(),
  }));

  const isDirty =
    name        !== initBaseline.name         ||
    description !== initBaseline.description  ||
    story       !== initBaseline.story        ||
    imageUri    !== initBaseline.imageUri     ||
    selectedTags.slice().sort().join(',') !== initBaseline.tags ||
    selectedVibe !== initBaseline.vibe        ||
    isPublic    !== initBaseline.isPublic ||
    JSON.stringify(music) !== initBaseline.music;

  const markSaved = useNavigationGuard(isDirty);

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
      try { setMusic(params.editMusic ? JSON.parse(params.editMusic) as StoryMusic : null); }
      catch { setMusic(null); }
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
      const msg = tr('outfitJournal.uploadFailed');
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  function toggleTag(tag: string) {
    Haptics.selectionAsync();
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 3 ? [...prev, tag] : prev);
  }

  function handleSave() {
    if (uploading) return; // guard against the save button tap racing the upload
    if (!name.trim()) { setError(tr('outfit.needName')); return; }
    if (!imageUri)    { setError(tr('outfitJournal.photoRequiredError')); return; }
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
        music,
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
        music,
      });
    }
    setSaving(false);
    markSaved();
    safeBack();
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={['#26164D', '#121027', '#0A0818']} style={[styles.headerGrad, { height: topPad + 118 }]} />

        <View style={[styles.header, { paddingTop: topPad + 8, maxWidth: 720, width: '100%', alignSelf: 'center' }]}>
          <BackButton
            style={[styles.iconBtn, { backgroundColor: headerButtonSurface, borderColor: headerButtonBorder }]}
            iconName="arrow-left" size={21} color={colors.foreground} onPress={() => navigation.goBack()}
          />
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{isEditing ? tr('outfit.editTitle') : tr('outfit.logTitle')} <Text style={{ color: colors.primary }}>✦</Text></Text>
            <Text style={[styles.headerSubtitle, { color: colors.text }]}>{tr('outfitJournal.createSubtitle')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
            onPress={handleSave} disabled={saving || uploading}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? tr('outfitJournal.saveChanges') : tr('outfitJournal.saveOutfit')}
          >
            {saving && <SkyLoadingMark size={16} color={colors.mutedForeground} />}
            <Text style={[styles.saveBtnText, { color: saving ? colors.mutedForeground : actionTextColor }]}>{saving ? tr('outfitJournal.saving') : tr('outfitJournal.save')}</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          bottomOffset={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad, width: contentWidth, maxWidth: '100%', alignSelf: 'center' }]}
        >
          <View style={styles.photoRow}>
            <TouchableOpacity
              style={[styles.imagePicker, {
                backgroundColor: pickerSurface,
                borderColor: error && !imageUri ? colors.destructive : pickerBorder,
              }]}
              onPress={() => !uploading && setShowSheet(true)}
              activeOpacity={0.8}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel={imageUri ? tr('outfitJournal.changePhoto') : tr('outfitJournal.addPhotoRequired')}
            >
              {uploading ? (
                <View style={styles.imagePlaceholder}>
                  <SkyLoadingMark color={colors.lavender} size={32} />
                  <Text style={[styles.imagePlaceholderTitle, { color: colors.foreground }]}>{tr('outfitJournal.uploading')}</Text>
                  <View style={[styles.uploadBarTrack, { backgroundColor: colors.border }]}>
                    <Animated.View
                      style={[styles.uploadBarFill, { backgroundColor: colors.primary }, {
                        width: uploadProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                      }]}
                    />
                  </View>
                </View>
              ) : imageUri ? (
                <>
                  <Image source={{ uri: imageUri }} style={styles.outfitImage} contentFit="contain" />
                  <View style={styles.changeOverlay}>
                    <View style={styles.changeChip}>
                      <Icon name="camera" size={13} color="#fff" />
                      <Text style={styles.changeChipText}>{tr('outfit.changePhoto')}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <View style={[styles.cameraCircle, { backgroundColor: colors.muted }]}><Icon name="camera" size={24} color={colors.lavender} /></View>
                  <Text style={[styles.imagePlaceholderTitle, { color: colors.foreground }]}>{tr('outfit.addPhoto')}</Text>
                  <Text style={[styles.imagePlaceholderSub, { color: colors.mutedForeground }]}>{tr('outfitJournal.tapUploadRequired')}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={[styles.photoTips, { backgroundColor: photoCardSurface, borderColor: photoCardBorder }]}>
              <View style={styles.tipsHeader}><Icon name="sun" size={16} color={colors.gold} /><Text style={[styles.tipsTitle, { color: colors.foreground }]}>{tr('outfitJournal.photoTips')}</Text></View>
              <View style={styles.tipRow}><Icon name="check-circle" size={14} color={isDark ? '#70DAAB' : '#18774C'} /><Text style={[styles.tipText, { color: colors.text }]}>{tr('outfitJournal.fullOutfit')}</Text></View>
              <View style={styles.tipRow}><Icon name="check-circle" size={14} color={isDark ? '#70DAAB' : '#18774C'} /><Text style={[styles.tipText, { color: colors.text }]}>{tr('outfitJournal.goodLighting')}</Text></View>
              <View style={styles.tipRow}><Icon name="alert-circle" size={14} color={colors.destructive} /><Text style={[styles.tipText, { color: colors.text }]}>{tr('outfitJournal.avoidBlurry')}</Text></View>
            </View>
          </View>

          {/* Name */}
          <View style={styles.field}>
            <View style={styles.fieldHeading}><Icon name="edit-2" size={17} color={colors.lavender} /><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr('outfit.name')}</Text><Text style={[styles.counter, { color: colors.mutedForeground }]}>{name.length}/50</Text></View>
            <TextInput
              style={[styles.nameInput, { backgroundColor: inputSurface, borderColor: inputBorder, color: colors.foreground }]}
              placeholder={tr('outfit.namePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={t => { setName(t); if (error) setError(null); }}
              maxLength={50}
              returnKeyType="done"
            />
          </View>

          {/* Description / notes */}
          <View style={styles.field}>
            <View style={styles.fieldHeading}><Icon name="file-text" size={17} color={colors.lavender} /><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr('outfit.notes')} <Text style={[styles.optional, { color: colors.mutedForeground }]}>({tr('outfitJournal.optional')})</Text></Text><Text style={[styles.counter, { color: colors.mutedForeground }]}>{description.length}/200</Text></View>
            <TextInput
              style={[styles.descInput, { backgroundColor: inputSurface, borderColor: inputBorder, color: colors.foreground }]}
              placeholder={tr('outfit.notesPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Character story — visible to other users */}
          <View style={styles.field}>
            <View style={styles.fieldHeading}><Icon name="star" size={17} color={colors.lavender} /><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr('outfitJournal.characterStory')}</Text><Text style={[styles.counter, { color: colors.mutedForeground }]}>{story.length}/300</Text></View>
            <Text style={[styles.storyHint, { color: colors.text }]}>{tr(isPublic ? 'outfitJournal.storyHintPublic' : 'outfitJournal.storyHintPrivate')}</Text>
            <TextInput
              style={[styles.storyInput, { backgroundColor: inputSurface, borderColor: inputBorder, color: colors.foreground }]}
              placeholder={tr('outfitJournal.storyPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              value={story}
              onChangeText={setStory}
              maxLength={300}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Style Tags */}
          <View style={styles.field}>
            <View style={styles.fieldHeading}><Icon name="heart" size={17} color={colors.blush} /><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr('outfit.vibeTags')}</Text><Text style={[styles.counter, { color: colors.mutedForeground }]}>{tr('outfitJournal.selectedCount', { count: selectedTags.length })}</Text></View>
            <Text style={[styles.storyHint, { color: colors.text }]}>{tr('outfitJournal.chooseThree')}</Text>
            <View style={styles.tagsGrid}>
              {VIBE_TAGS.map(t => {
                const active = selectedTags.includes(t.label);
                const tagColor = isDark ? t.color : LIGHT_TAG_COLORS[t.label];
                return (
                  <TouchableOpacity key={t.label}
                    style={[styles.tagChip, {
                      backgroundColor: active ? `${tagColor}20` : colors.card,
                      borderColor: active ? tagColor : (isDark ? '#493D66' : colors.border),
                    }]}
                    onPress={() => toggleTag(t.label)}
                    disabled={!active && selectedTags.length >= 3}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active, disabled: !active && selectedTags.length >= 3 }}
                  >
                    <Icon name={t.icon} size={15} color={tagColor} />
                    <Text style={[styles.tagText, { color: colors.foreground }]}>{tr(`outfitJournal.tag${t.label}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Vibe Animation */}
          <View style={styles.field}>
            <View style={styles.fieldHeading}><Icon name="volume-2" size={17} color={colors.lavender} /><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr('outfitJournal.outfitMusic')}</Text></View>
            <Text style={[styles.storyHint, { color: colors.text }]}>{tr('outfitJournal.musicOptional')}</Text>
            <AudiusMusicPicker value={music} mood={selectedVibe ?? undefined} onChange={setMusic} context="outfit" />
          </View>

          {/* Vibe Animation */}
          <View style={styles.field}>
            <View style={styles.fieldHeading}><Icon name="star" size={17} color={colors.lavender} /><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr('outfitJournal.vibeAnimation')}</Text></View>
            <Text style={[styles.storyHint, { color: colors.text }]}>{tr('outfitJournal.animationOptional')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibeGrid}>
              <TouchableOpacity
                style={[styles.vibeChip, {
                  backgroundColor: isDark ? '#18142F' : colors.card,
                  borderColor: !selectedVibe ? colors.tint : (isDark ? '#493D66' : colors.border),
                  borderWidth: !selectedVibe ? 2 : 1,
                }]}
                onPress={() => setSelectedVibe(null)}
                accessibilityRole="radio"
                accessibilityState={{ selected: !selectedVibe }}
              >
                <View style={[styles.vibePreview, { backgroundColor: isDark ? '#30204F' : colors.muted }]}><Icon name="slash" size={30} color={colors.lavender} /></View>
                <Text style={[styles.vibeLabel, { color: colors.foreground }]}>{tr('outfitJournal.none')}</Text>
              </TouchableOpacity>
              {VIBES.map(v => {
                const active = selectedVibe === v.id;
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.vibeChip, {
                      backgroundColor: isDark ? '#18142F' : colors.card,
                      borderColor: active ? v.color : colors.border,
                    }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelectedVibe(v.id);
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityLabel={`${tr(`outfitJournal.vibe${v.label}`)}: ${tr(`outfitJournal.vibeDesc${v.label}`)}`}
                    accessibilityState={{ selected: active }}
                  >
                    <LinearGradient colors={[`${v.color}68`, '#21163B', '#111025']} style={styles.vibePreview}><Text style={[styles.vibeSymbol, { color: v.color }]}>{v.symbol}</Text></LinearGradient>
                    <Text style={[styles.vibeLabel, { color: colors.foreground }]}>{tr(`outfitJournal.vibe${v.label}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Visibility */}
          <View style={styles.field}>
            <View style={styles.fieldHeading}><Icon name="lock" size={17} color={colors.lavender} /><Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr('common.visibility')}</Text></View>
            <Text style={[styles.storyHint, { color: colors.text }]}>{tr('outfitJournal.visibilityHint')}</Text>
            <View style={styles.privacyRow}>
              {(['Private', 'Public'] as const).map(opt => {
                const active = opt === 'Private' ? !isPublic : isPublic;
                return (
                  <TouchableOpacity key={opt}
                    style={[styles.privBtn, {
                      backgroundColor: active ? `${colors.primary}15` : colors.muted,
                      borderColor:     active ? colors.primary : colors.border,
                      borderWidth:     active ? 1.5 : 1,
                    }]}
                    onPress={() => setIsPublic(opt === 'Public')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Icon name={opt === 'Private' ? 'lock' : 'globe'} size={20} color={active ? colors.primary : colors.mutedForeground} />
                    <View><Text style={[styles.privText, { color: active ? colors.foreground : colors.mutedForeground }]}>{opt === 'Private' ? tr('common.private') : tr('common.public')}</Text><Text style={[styles.privSub, { color: colors.mutedForeground }]}>{opt === 'Private' ? tr('outfitJournal.onlyYou') : tr('outfitJournal.visibleProfile')}</Text></View>
                    {active && <Icon name="check-circle" size={17} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </KeyboardAwareScrollView>
        <View style={[styles.footer, {
          backgroundColor: isDark ? '#100C23' : colors.background,
          borderTopColor: isDark ? '#3C3156' : colors.border,
          paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 12),
        }]}>
          {error && (
            <View style={[styles.errorBanner, { borderColor: colors.destructive, backgroundColor: `${colors.destructive}14` }]}>
              <Icon name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}
          <TouchableOpacity style={[styles.footerButton, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving || uploading} accessibilityRole="button" accessibilityLabel={isEditing ? tr('outfitJournal.saveChanges') : tr('outfitJournal.saveOutfit')}>
            {saving ? <SkyLoadingMark size={20} color={actionTextColor} /> : <Icon name="star" size={19} color={actionTextColor} />}
            <Text style={[styles.footerText, { color: actionTextColor }]}>{saving ? tr('outfitJournal.saving') : tr('outfit.saveOutfit')}</Text>
          </TouchableOpacity>
        </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 18 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#201838', borderWidth: 1, borderColor: '#514073' },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 25, fontFamily: 'Satoshi-Black', color: '#F5F0FF', lineHeight: 29 },
  headerSubtitle: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: '#C6BADF', marginTop: 2 },
  saveBtn: { paddingHorizontal: 20, height: 38, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },
  scroll: { paddingHorizontal: 18, paddingTop: 4 },
  photoRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  imagePicker: { flex: 1.05, height: 154, borderRadius: 15, borderWidth: 1.5, borderStyle: 'dashed', overflow: 'hidden', backgroundColor: '#1B1633' },
  photoTips: { flex: 1, height: 154, borderRadius: 15, borderWidth: 1, borderColor: '#453A64', backgroundColor: '#17132D', padding: 11, justifyContent: 'space-around' },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipsTitle: { color: '#F4ECFF', fontSize: 13, fontFamily: 'Satoshi-Bold' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipText: { color: '#D2C8E6', fontSize: 11, fontFamily: 'Satoshi-Medium', flexShrink: 1 },
  outfitImage: { width: '100%', height: '100%' },
  changeOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
  changeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#24173F' },
  changeChipText: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: '#fff' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8 },
  cameraCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#37265C', marginBottom: 5 },
  uploadBarTrack: {
    width: '70%', height: 3, borderRadius: 2, backgroundColor: '#4A3A69', overflow: 'hidden', marginTop: 8,
  },
  uploadBarFill: { height: '100%', borderRadius: 2, backgroundColor: '#9B78FF' },
  imagePlaceholderTitle: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#F4EEFF', textAlign: 'center' },
  imagePlaceholderSub: { fontSize: 10, fontFamily: 'Satoshi-Regular', color: '#C5B6E4', textAlign: 'center' },
  field: { marginBottom: 16 },
  fieldHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6 },
  fieldLabel: { flex: 1, color: '#F4EEFF', fontSize: 14, fontFamily: 'Satoshi-Bold' },
  optional: { color: '#BCB0D4', fontFamily: 'Satoshi-Regular', fontSize: 12 },
  counter: { fontSize: 10, color: '#ACA0C6', fontFamily: 'Satoshi-Medium' },
  nameInput: { borderWidth: 1, borderColor: '#493D66', backgroundColor: '#1B1934', color: '#F4EEFF', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  descInput: { borderWidth: 1, borderColor: '#493D66', backgroundColor: '#1B1934', color: '#F4EEFF', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10, fontSize: 13, fontFamily: 'Satoshi-Regular', minHeight: 58 },
  storyHint: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: '#B9ACD0', marginBottom: 7 },
  storyInput: { borderWidth: 1, borderColor: '#493D66', backgroundColor: '#1B1934', color: '#F4EEFF', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10, fontSize: 13, fontFamily: 'Satoshi-Regular', minHeight: 62 },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tagChip: { width: '48.5%', height: 34, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#F4EEFF' },
  vibeGrid: { gap: 8, paddingVertical: 2, paddingRight: 12 },
  vibeChip: { width: 84, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#493D66', backgroundColor: '#18142F', paddingBottom: 5, overflow: 'hidden' },
  vibeChipActive: { borderColor: '#9B78FF', borderWidth: 2 },
  vibePreview: { width: '100%', height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#30204F' },
  vibeSymbol: { fontSize: 33, fontFamily: 'Satoshi-Black', textAlign: 'center' },
  vibeLabel: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#F4EEFF', marginTop: 3 },
  privacyRow: { flexDirection: 'row', gap: 8 },
  privBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 57, borderRadius: 11, paddingHorizontal: 8 },
  privText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  privSub: { fontSize: 9, fontFamily: 'Satoshi-Regular', color: '#B9ACD0', marginTop: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E05568', backgroundColor: '#341A31', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#FFC5CD' },
  footer: { borderTopWidth: 1, borderTopColor: '#3C3156', backgroundColor: '#100C23', paddingTop: 10, paddingHorizontal: 22 },
  footerButton: { height: 48, borderRadius: 25, backgroundColor: '#8D5EF1', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Satoshi-Bold' },
});
