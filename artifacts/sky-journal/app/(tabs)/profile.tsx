import { Icon } from '@/components/Icon';
import { MoodBadge } from '@/components/MoodBadge';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { persistImageUri } from '@/utils/persistImage';

import { Images } from '@/assets/images';
import { apiFetch, useApp, type GalleryPhoto, type Outfit, type Story } from '@/context/AppContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import { useTranslation } from 'react-i18next';

// ── Helpers ────────────────────────────────────────────────────────────────────

const BG_MAP: Record<string, any> = {
  bg1: Images.story_bg1, bg2: Images.story_bg2,
  bg3: Images.story_bg3, char: Images.character_default,
};
function getCover(story: Story) {
  const p = story.panels[0];
  if (!p) return null;
  if (p.imageUri) return { uri: p.imageUri };
  if (p.bgPreset && BG_MAP[p.bgPreset]) return BG_MAP[p.bgPreset];
  return null;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const ATTRIBUTE_SUGGESTIONS = [
  'Dreamer', 'Curious', 'Kind', 'Loner', 'Brave', 'Gentle',
  'Wanderer', 'Silent', 'Joyful', 'Nostalgic', 'Hopeful', 'Mystic',
  'Observer', 'Poet', 'Seeker', 'Free Spirit',
];

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#5B9BB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
  Romantic: '#B86098', Chaotic: '#B85830', Soft: '#7B6BAA',
  Adventurous: '#3A9060',
};

// ── Outfit grid card (individual, animated) ────────────────────────────────────

function OutfitGridCard({
  outfit,
  isActive,
  cardW,
  onPress,
}: {
  outfit:   Outfit;
  isActive: boolean;
  cardW:    number;
  onPress:  () => void;
}) {
  const colors = useColors();
  const scale  = useRef(new Animated.Value(1)).current;
  const cardH  = Math.round(cardW * 1.25);

  return (
    <TouchableOpacity
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 8 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }).start()}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.outfitGridCard,
          { width: cardW, height: cardH, borderColor: isActive ? colors.primary : colors.border },
          isActive && { borderWidth: 2 },
          { transform: [{ scale }] },
          SHADOW.xs,
        ]}
      >
        {outfit.imageUri ? (
          <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[`${colors.primary}55`, `${colors.primary}18`]}
            style={StyleSheet.absoluteFill}
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.outfitGridGrad}
        />
        {isActive && (
          <View style={[styles.outfitActiveBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.outfitActiveBadgeText}>✦</Text>
          </View>
        )}
        <Text style={styles.outfitGridName} numberOfLines={1}>{outfit.name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Theme toggle ───────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();
  const colors = useColors();

  const OPTIONS: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'light',  icon: 'sun',     label: 'Light' },
    { mode: 'system', icon: 'monitor', label: 'Auto'  },
    { mode: 'dark',   icon: 'moon',    label: 'Dark'  },
  ];

  return (
    <View style={[styles.themeToggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {OPTIONS.map(opt => {
        const active = themeMode === opt.mode;
        return (
          <TouchableOpacity
            key={opt.mode}
            style={[
              styles.themeOption,
              active && { backgroundColor: colors.card, borderColor: `${colors.primary}40` },
              !active && { borderColor: 'transparent' },
            ]}
            onPress={() => { Haptics.selectionAsync(); setThemeMode(opt.mode); }}
            activeOpacity={0.75}
          >
            <Icon name={opt.icon as any} size={14} color={active ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.themeOptionText, { color: active ? colors.primary : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

export default function CharacterScreen() {
  const colors  = useColors();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const insets  = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { character, setCharacter, outfits, stories, activeOutfitId, setActiveOutfitId, deleteOutfit,
          gallery, galleryUsage, addGalleryPhoto, deleteGalleryPhoto } = useApp();
  const { signOut } = useAuth();
  const { user }    = useUser();

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 120;

  // Outfit grid card width: 2 cols, 20px side padding, 10px gap
  const gridGap  = 10;
  const gridPad  = 20;
  const cardW    = Math.floor((screenW - gridPad * 2 - gridGap) / 2);

  // ── Avatar glow animation ──────────────────────────────────────────────────
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(glowAnim, { toValue: 0, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0,  1.14] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });

  // ── Gallery state ──────────────────────────────────────────────────────────
  const galCols  = 3;
  const galGap   = 4;
  const galCardW = Math.floor((screenW - gridPad * 2 - galGap * (galCols - 1)) / galCols);

  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryError,     setGalleryError]     = useState<string | null>(null);
  const [selectedPhoto,    setSelectedPhoto]    = useState<GalleryPhoto | null>(null);
  const [deletingPhoto,    setDeletingPhoto]    = useState(false);
  const deletePhotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleAddGalleryPhoto() {
    if (galleryUsage.count >= galleryUsage.limit) {
      setGalleryError(`Gallery full (${galleryUsage.limit} photos max)`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setGalleryUploading(true);
    setGalleryError(null);
    try {
      const uri = await persistImageUri(result.assets[0].uri);
      await addGalleryPhoto(uri, '');
    } catch (err: any) {
      setGalleryError(err?.message ?? 'Upload failed');
    } finally {
      setGalleryUploading(false);
    }
  }

  function openPhoto(photo: GalleryPhoto) {
    setSelectedPhoto(photo);
    setDeletingPhoto(false);
  }
  function closePhoto() {
    setSelectedPhoto(null);
    setDeletingPhoto(false);
  }
  function handleDeletePhoto() {
    if (!selectedPhoto) return;
    if (deletingPhoto) {
      if (deletePhotoTimer.current) clearTimeout(deletePhotoTimer.current);
      deleteGalleryPhoto(selectedPhoto.id);
      closePhoto();
    } else {
      setDeletingPhoto(true);
      deletePhotoTimer.current = setTimeout(() => setDeletingPhoto(false), 3000);
    }
  }

  // ── Outfit modal state ─────────────────────────────────────────────────────
  const [selectedOutfitId,       setSelectedOutfitId]       = useState<string | null>(null);
  const [deletingOutfitInModal,  setDeletingOutfitInModal]  = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedOutfit = outfits.find(o => o.id === selectedOutfitId) ?? null;

  function openOutfit(id: string) {
    setSelectedOutfitId(id);
    setDeletingOutfitInModal(false);
  }
  function closeOutfit() {
    setSelectedOutfitId(null);
    setDeletingOutfitInModal(false);
  }
  function handleModalDelete() {
    if (!selectedOutfit) return;
    if (deletingOutfitInModal) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      deleteOutfit(selectedOutfit.id);
      if (activeOutfitId === selectedOutfit.id) setActiveOutfitId(null);
      closeOutfit();
    } else {
      setDeletingOutfitInModal(true);
      deleteTimer.current = setTimeout(() => setDeletingOutfitInModal(false), 3000);
    }
  }
  function handleSetDisplay() {
    if (!selectedOutfit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeOutfitId === selectedOutfit.id) {
      setActiveOutfitId(null);
    } else {
      setActiveOutfitId(selectedOutfit.id);
    }
  }

  // ── Profile editing state ──────────────────────────────────────────────────
  const [confirmingSignOut,   setConfirmingSignOut]   = useState(false);
  const signOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleSignOut() {
    if (confirmingSignOut) {
      if (signOutTimer.current) clearTimeout(signOutTimer.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
      router.replace('/(auth)/sign-in' as any);
    } else {
      setConfirmingSignOut(true);
      signOutTimer.current = setTimeout(() => setConfirmingSignOut(false), 3000);
    }
  }

  const [editingName,      setEditingName]      = useState(false);
  const [editingBio,       setEditingBio]        = useState(false);
  const [editingUsername,  setEditingUsername]   = useState(false);
  const [nameVal,          setNameVal]           = useState(character.name);
  const [bioVal,           setBioVal]            = useState(character.bio);
  const [usernameVal,      setUsernameVal]       = useState(character.username ?? '');
  const [usernameError,    setUsernameError]     = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking]  = useState(false);
  const [addingTrait,      setAddingTrait]       = useState(false);
  const [newTrait,         setNewTrait]          = useState('');
  const [showSuggestions,  setShowSuggestions]  = useState(false);
  const [showMoodPicker,   setShowMoodPicker]   = useState(false);
  const [avatarUploading,  setAvatarUploading]  = useState(false);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true);
    try {
      const uri = await persistImageUri(result.assets[0].uri);
      setCharacter({ ...character, avatarUri: uri });
    } finally {
      setAvatarUploading(false);
    }
  }

  function saveName() {
    if (nameVal.trim()) setCharacter({ ...character, name: nameVal.trim() });
    setEditingName(false);
  }
  function saveBio() {
    setCharacter({ ...character, bio: bioVal.trim() });
    setEditingBio(false);
  }
  async function saveUsername() {
    const val = usernameVal.trim().toLowerCase();
    setUsernameError(null);
    if (!val) {
      setCharacter({ ...character, username: undefined });
      setEditingUsername(false);
      return;
    }
    if (!USERNAME_REGEX.test(val)) {
      setUsernameError('3–20 chars, lowercase letters, numbers and _ only');
      return;
    }
    if (val === character.username) { setEditingUsername(false); return; }
    setUsernameChecking(true);
    try {
      const result = await apiFetch<{ available: boolean }>(`/users/check-username?username=${encodeURIComponent(val)}`);
      if (!result.available) { setUsernameError('That handle is already taken'); return; }
    } catch { /* ignore */ } finally { setUsernameChecking(false); }
    setCharacter({ ...character, username: val });
    setEditingUsername(false);
  }
  function addTrait(t: string) {
    const trimmed = t.trim();
    if (!trimmed || character.traits.includes(trimmed)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCharacter({ ...character, traits: [...character.traits, trimmed] });
    setNewTrait(''); setAddingTrait(false); setShowSuggestions(false);
  }
  function removeTrait(t: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCharacter({ ...character, traits: character.traits.filter(tr => tr !== t) });
  }
  function toggleVisibility() {
    Haptics.selectionAsync();
    setCharacter({ ...character, isPublic: !character.isPublic });
  }
  const suggestions = ATTRIBUTE_SUGGESTIONS.filter(
    s => !character.traits.includes(s) && s.toLowerCase().includes(newTrait.toLowerCase()),
  );

  const totalWitnessed = stories.reduce((sum, s) => sum + s.witnessedCount, 0);

  const bannerColors = isDark
    ? (['#281868', '#4228A8', '#5E44BC'] as const)
    : (['#DDD2FF', '#C8B4F8', '#B4A4EC'] as const);

  const activeOutfit = activeOutfitId ? outfits.find(o => o.id === activeOutfitId) : null;
  const avatarSource = character.avatarUri
    ? { uri: character.avatarUri }
    : activeOutfit?.imageUri
      ? { uri: activeOutfit.imageUri }
      : Images.character_default;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* ── Banner ──────────────────────────────────────────────── */}
        <View style={[styles.banner, { height: topPad + 110 }]}>
          <LinearGradient colors={bannerColors} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />
          <View style={[styles.orbA, { backgroundColor: `${colors.primary}22` }]} />
          <View style={[styles.orbB, { backgroundColor: `${colors.gold}18` }]} />
          <View style={[styles.orbC, { backgroundColor: `${colors.primary}14` }]} />

          <View style={[styles.bannerTop, { paddingTop: topPad + 10 }]}>
            <View style={[styles.bannerChip, { backgroundColor: `${colors.primary}30`, borderColor: `${colors.primary}40` }]}>
              <Icon name="user" size={10} color={isDark ? 'rgba(220,210,255,0.9)' : colors.primary} />
              <Text style={[styles.bannerLabel, { color: isDark ? 'rgba(220,210,255,0.9)' : colors.primary }]}>CHARACTER</Text>
            </View>
            <TouchableOpacity
              style={[styles.visToggle, {
                backgroundColor: character.isPublic ? `${colors.primary}20` : colors.muted,
                borderColor:     character.isPublic ? `${colors.primary}40` : colors.border,
              }]}
              onPress={toggleVisibility}
            >
              <Icon name={character.isPublic ? 'globe' : 'lock'} size={12} color={colors.primary} />
              <Text style={[styles.visToggleText, { color: colors.primary }]}>
                {character.isPublic ? 'Public' : 'Private'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Avatar — centered, glowing ───────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCenter}>
            {/* Animated outer glow */}
            <Animated.View style={[
              styles.avatarGlow,
              { backgroundColor: colors.glowPurple },
              { transform: [{ scale: glowScale }], opacity: glowOpacity },
            ]} />
            {/* Gradient ring */}
            <View style={[styles.avatarRingOuter, { borderColor: colors.primary }]}>
              <View style={[styles.avatarRingInner, { borderColor: `${colors.primary}40`, backgroundColor: colors.card }]}>
                <Image source={avatarSource} style={styles.avatarImg} contentFit="cover" />
              </View>
            </View>
            {/* Sparkle decorations */}
            <Text style={[styles.sparkle, styles.sparkleA, { color: colors.gold, opacity: 0.7 }]}>✦</Text>
            <Text style={[styles.sparkle, styles.sparkleB, { color: colors.primary, opacity: 0.55 }]}>✧</Text>
            <Text style={[styles.sparkle, styles.sparkleC, { color: colors.gold, opacity: 0.5 }]}>✶</Text>
            {/* Camera badge */}
            <TouchableOpacity
              style={[styles.avatarEditBadge, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}
              onPress={pickAvatar}
              activeOpacity={0.75}
            >
              {avatarUploading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Icon name="camera" size={11} color={colors.primary} />
              }
            </TouchableOpacity>
          </View>

          {/* Name + username + bio — centered */}
          <View style={styles.nameSection}>
            {editingName ? (
              <View style={[styles.nameEditWrap, { borderBottomColor: colors.primary }]}>
                <TextInput
                  style={[styles.nameEditInput, { color: colors.foreground }]}
                  value={nameVal} onChangeText={setNameVal}
                  autoFocus returnKeyType="done"
                  onSubmitEditing={saveName} onBlur={saveName}
                />
              </View>
            ) : (
              <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
                <Text style={[styles.name, { color: colors.foreground }]}>{character.name}</Text>
                <View style={[styles.editHint, { backgroundColor: colors.muted }]}>
                  <Icon name="edit-2" size={11} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            )}

            {editingUsername ? (
              <View style={[styles.usernameEditWrap, { borderColor: usernameError ? colors.destructive : colors.primary, backgroundColor: colors.muted }]}>
                <Text style={[styles.usernameAt, { color: usernameError ? colors.destructive : colors.primary }]}>@</Text>
                <TextInput
                  style={[styles.usernameEditInput, { color: colors.foreground }]}
                  value={usernameVal}
                  onChangeText={v => { setUsernameVal(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(null); }}
                  autoFocus autoCapitalize="none" autoCorrect={false}
                  returnKeyType="done" onSubmitEditing={saveUsername} onBlur={saveUsername}
                  placeholder="your_handle" placeholderTextColor={colors.mutedForeground}
                  maxLength={20}
                />
                {usernameChecking && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.usernameRow}
                onPress={() => { setUsernameVal(character.username ?? ''); setEditingUsername(true); setUsernameError(null); }}
              >
                {character.username ? (
                  <Text style={[styles.usernameText, { color: colors.primary }]}>@{character.username}</Text>
                ) : (
                  <Text style={[styles.usernamePlaceholder, { color: `${colors.mutedForeground}70` }]}>{t('profile.setUsername')}</Text>
                )}
                <Icon name="edit-2" size={10} color={`${colors.mutedForeground}55`} style={{ marginTop: 1 }} />
              </TouchableOpacity>
            )}
            {usernameError && (
              <Text style={[styles.usernameError, { color: colors.destructive }]}>{usernameError}</Text>
            )}

            {editingBio ? (
              <TextInput
                style={[styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={bioVal} onChangeText={setBioVal}
                multiline autoFocus returnKeyType="done" onBlur={saveBio}
              />
            ) : (
              <TouchableOpacity style={styles.bioRow} onPress={() => setEditingBio(true)}>
                <Text style={[styles.bio, { color: character.bio ? colors.mutedForeground : `${colors.mutedForeground}60` }]}>
                  {character.bio || t('profile.tapBio')}
                </Text>
                <Icon name="edit-2" size={11} color={`${colors.mutedForeground}55`} style={{ marginTop: 2 }} />
              </TouchableOpacity>
            )}

            {/* Mood badge — tap to change */}
            <TouchableOpacity
              style={styles.moodRow}
              onPress={() => { Haptics.selectionAsync(); setShowMoodPicker(true); }}
              activeOpacity={0.75}
            >
              <MoodBadge mood={character.mood || 'Hopeful'} />
              <Icon name="edit-2" size={10} color={`${colors.mutedForeground}55`} style={{ marginLeft: 4, marginTop: 1 }} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.body, { paddingHorizontal: gridPad }]}>

          {/* ── Stats card ──────────────────────────────────────── */}
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-stories' as any)} activeOpacity={0.7}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{stories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t('profile.stories')}</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.gold }]}>{outfits.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t('profile.outfits')}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#6BA57A' }]}>{totalWitnessed}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t('discover.witnessed')}</Text>
            </View>
          </View>

          {/* ── My Stories card ──────────────────────────────── */}
          <TouchableOpacity
            style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: `${colors.primary}28` }, SHADOW.sm]}
            onPress={() => { Haptics.selectionAsync(); router.push('/my-stories' as any); }}
            activeOpacity={0.86}
          >
            <View style={styles.sectionCardHeader}>
              <View style={styles.sectionCardLeft}>
                <View style={[styles.sectionCardIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <Icon name="book-open" size={15} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>{t('profile.myStories')}</Text>
                  <Text style={[styles.sectionCardSub, { color: colors.mutedForeground }]}>
                    {stories.length === 0 ? t('profile.writeFirstChapter') : stories.length === 1 ? t('profile.storyChapters', { n: 1 }) : t('profile.storyChaptersPlural', { n: stories.length })}
                  </Text>
                </View>
              </View>
              <View style={[styles.arrowCircle, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
                <Icon name="arrow-right" size={14} color={colors.primary} />
              </View>
            </View>
            {stories.length > 0 ? (
              <View style={styles.thumbsRow}>
                {stories.slice(0, 4).map((story, i) => {
                  const cover      = getCover(story);
                  const moodColor  = MOOD_COLORS[story.mood] ?? colors.primary;
                  return (
                    <View key={story.id} style={[styles.storyThumb, { marginLeft: i > 0 ? 8 : 0 }, i === 0 && { flex: 1.4 }]}>
                      {cover ? (
                        <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={[`${moodColor}55`, `${moodColor}18`]} style={StyleSheet.absoluteFill} />
                      )}
                      <LinearGradient colors={['transparent', 'rgba(8,6,22,0.82)']} style={styles.thumbGrad} />
                      <Text style={styles.thumbTitle} numberOfLines={2}>{story.chapterTitle}</Text>
                    </View>
                  );
                })}
                {stories.length > 4 && (
                  <View style={[styles.thumbMore, { backgroundColor: `${colors.primary}14`, marginLeft: 8 }]}>
                    <Text style={[styles.thumbMoreText, { color: colors.primary }]}>+{stories.length - 4}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.emptyHint, { borderColor: `${colors.primary}18` }]}>
                <Icon name="star" size={20} color={`${colors.primary}40`} />
                <Text style={[styles.emptyHintText, { color: colors.mutedForeground }]}>{t('profile.emptyStories')}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Outfit grid ───────────────────────────────────── */}
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t('profile.wardrobe')}</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  {outfits.length === 0 ? t('profile.logFirstOutfit') : outfits.length === 1 ? t('profile.outfitsTapView', { n: 1 }) : t('profile.outfitsTapViewPlural', { n: outfits.length })}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
                onPress={() => { Haptics.selectionAsync(); router.push('/create-outfit' as any); }}
              >
                <Icon name="plus" size={13} color="#fff" />
                <Text style={styles.addBtnText}>{t('profile.add')}</Text>
              </TouchableOpacity>
            </View>

            {outfits.length === 0 ? (
              <TouchableOpacity
                style={[styles.emptyOutfitCard, { borderColor: `${colors.primary}20`, backgroundColor: `${colors.primary}06` }]}
                onPress={() => router.push('/create-outfit' as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.emptyOutfitIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <Icon name="wind" size={22} color={`${colors.primary}80`} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.emptyOutfitTitle, { color: colors.foreground }]}>{t('profile.emptyOutfitTitle')}</Text>
                  <Text style={[styles.emptyOutfitSub, { color: colors.mutedForeground }]}>
                    {t('profile.emptyOutfitSub')}
                  </Text>
                </View>
                <Icon name="arrow-right" size={14} color={`${colors.primary}60`} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.outfitGrid, { gap: gridGap }]}>
                {outfits.map(outfit => (
                  <OutfitGridCard
                    key={outfit.id}
                    outfit={outfit}
                    isActive={outfit.id === activeOutfitId}
                    cardW={cardW}
                    onPress={() => openOutfit(outfit.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── My Gallery ──────────────────────────────────────── */}
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Gallery</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  {galleryUsage.count} / {galleryUsage.limit} photos
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, {
                  backgroundColor: galleryUsage.count >= galleryUsage.limit || galleryUploading
                    ? colors.muted : colors.primary,
                }]}
                onPress={handleAddGalleryPhoto}
                disabled={galleryUsage.count >= galleryUsage.limit || galleryUploading}
                activeOpacity={0.8}
              >
                {galleryUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Icon name="image" size={13} color={galleryUsage.count >= galleryUsage.limit ? colors.mutedForeground : '#fff'} />
                }
                <Text style={[styles.addBtnText, {
                  color: galleryUsage.count >= galleryUsage.limit ? colors.mutedForeground : '#fff',
                }]}>Add</Text>
              </TouchableOpacity>
            </View>

            {galleryError && (
              <Text style={[styles.galError, { color: colors.destructive }]}>{galleryError}</Text>
            )}

            {gallery.length === 0 ? (
              <TouchableOpacity
                style={[styles.emptyOutfitCard, { borderColor: `${colors.primary}20`, backgroundColor: `${colors.primary}06` }]}
                onPress={handleAddGalleryPhoto}
                activeOpacity={0.8}
              >
                <View style={[styles.emptyOutfitIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <Icon name="image" size={22} color={`${colors.primary}80`} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.emptyOutfitTitle, { color: colors.foreground }]}>Your personal gallery</Text>
                  <Text style={[styles.emptyOutfitSub, { color: colors.mutedForeground }]}>
                    Save up to {galleryUsage.limit} photos — only you can see them
                  </Text>
                </View>
                <Icon name="arrow-right" size={14} color={`${colors.primary}60`} />
              </TouchableOpacity>
            ) : (
              <View style={styles.galGrid}>
                {gallery.map(photo => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => openPhoto(photo)}
                    activeOpacity={0.88}
                    style={[styles.galThumb, { width: galCardW, height: galCardW }]}
                  >
                    <Image
                      source={{ uri: photo.imageUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Attributes ────────────────────────────────────── */}
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t('profile.traits')}</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{t('profile.defineCharacter')}</Text>
              </View>
            </View>

            <View style={styles.traitsWrap}>
              {character.traits.map(t => (
                <View key={t} style={[styles.traitChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}28` }]}>
                  <Text style={[styles.traitText, { color: colors.primary }]}>{t}</Text>
                  <TouchableOpacity
                    onPress={() => removeTrait(t)}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    style={[styles.traitRemove, { backgroundColor: `${colors.primary}18` }]}
                  >
                    <Icon name="x" size={9} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
              {addingTrait ? (
                <View style={[styles.traitAddWrap, { borderColor: colors.primary, backgroundColor: `${colors.primary}06` }]}>
                  <TextInput
                    style={[styles.traitInput, { color: colors.foreground }]}
                    value={newTrait}
                    onChangeText={t => { setNewTrait(t); setShowSuggestions(true); }}
                    placeholder={t('profile.traitPlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus returnKeyType="done"
                    onSubmitEditing={() => addTrait(newTrait)}
                    onBlur={() => setTimeout(() => { if (!newTrait.trim()) { setAddingTrait(false); setShowSuggestions(false); } }, 200)}
                  />
                  <TouchableOpacity onPress={() => { setAddingTrait(false); setNewTrait(''); setShowSuggestions(false); }}>
                    <Icon name="x" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.traitAddBtn, { borderColor: `${colors.primary}28`, backgroundColor: `${colors.primary}06` }]}
                  onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
                >
                  <Icon name="plus" size={12} color={colors.primary} />
                  <Text style={[styles.traitAddText, { color: colors.primary }]}>{t('profile.addTrait')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggRow}>
                <Text style={[styles.suggLabel, { color: colors.mutedForeground }]}>{t('profile.suggestions')}</Text>
                <View style={styles.suggChips}>
                  {suggestions.slice(0, 8).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.suggChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      onPress={() => addTrait(s)}
                    >
                      <Icon name="plus" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.suggText, { color: colors.mutedForeground }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* ── Account section ──────────────────────────────────── */}
          <View style={[styles.section, { borderTopColor: colors.border }]}>
            <Text style={[styles.accountSectionLabel, { color: colors.mutedForeground }]}>{t('profile.appearance')}</Text>
            <ThemeToggle />
          </View>

          <View style={[styles.accountCardWrap, { borderTopColor: colors.border }]}>
            <Text style={[styles.accountSectionLabel, { color: colors.mutedForeground }]}>{t('profile.account')}</Text>
            <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <View style={styles.accountRow}>
                <View style={[styles.accountIconWrap, { backgroundColor: `${colors.primary}10` }]}>
                  <Icon name="mail" size={14} color={colors.primary} />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={[styles.accountInfoLabel, { color: colors.mutedForeground }]}>{t('profile.signedInAs')}</Text>
                  <Text style={[styles.accountInfoVal, { color: colors.foreground }]} numberOfLines={1}>
                    {user?.primaryEmailAddress?.emailAddress ?? '—'}
                  </Text>
                </View>
              </View>

              <View style={[styles.accountDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={[styles.signOutRow, confirmingSignOut && { backgroundColor: colors.destructive }]}
                onPress={handleSignOut}
                activeOpacity={0.75}
              >
                <View style={[styles.accountIconWrap, { backgroundColor: confirmingSignOut ? 'rgba(255,255,255,0.2)' : `${colors.destructive}18` }]}>
                  <Icon name="log-out" size={14} color={confirmingSignOut ? '#fff' : colors.destructive} />
                </View>
                <Text style={[styles.signOutText, { color: confirmingSignOut ? '#fff' : colors.destructive }]}>
                  {confirmingSignOut ? t('profile.confirmSignOut') : t('profile.signOut')}
                </Text>
                <Icon name="chevron-right" size={14} color={confirmingSignOut ? 'rgba(255,255,255,0.6)' : `${colors.destructive}60`} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* ── Outfit Detail Modal ───────────────────────────────────── */}
      <Modal
        visible={!!selectedOutfit}
        transparent
        animationType="slide"
        onRequestClose={closeOutfit}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOutfit} />
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {selectedOutfit && (
                <>
                  {/* Outfit image */}
                  <View style={[styles.modalImageWrap, { backgroundColor: `${colors.primary}14` }]}>
                    {selectedOutfit.imageUri ? (
                      <Image source={{ uri: selectedOutfit.imageUri }} style={styles.modalImage} contentFit="contain" />
                    ) : (
                      <LinearGradient
                        colors={[`${colors.primary}55`, `${colors.primary}1A`]}
                        style={styles.modalImage}
                      >
                        <Icon name="wind" size={42} color={`${colors.primary}60`} />
                      </LinearGradient>
                    )}
                    {selectedOutfit.id === activeOutfitId && (
                      <View style={[styles.modalActivePill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.modalActivePillText}>{t('profile.displayOutfit')}</Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.modalBody, { paddingHorizontal: 20 }]}>
                    {/* Name + date */}
                    <View style={styles.modalNameRow}>
                      <Text style={[styles.modalOutfitName, { color: colors.foreground }]} numberOfLines={2}>
                        {selectedOutfit.name}
                      </Text>
                      <Text style={[styles.modalOutfitDate, { color: colors.mutedForeground }]}>
                        {fmtDate(selectedOutfit.date)}
                      </Text>
                    </View>

                    {/* Tags */}
                    {selectedOutfit.tags.length > 0 && (
                      <View style={styles.modalTags}>
                        {selectedOutfit.tags.map(tag => (
                          <View key={tag} style={[styles.modalTag, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                            <Text style={[styles.modalTagText, { color: colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Description */}
                    {selectedOutfit.description ? (
                      <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
                        {selectedOutfit.description}
                      </Text>
                    ) : null}

                    {/* Set display button */}
                    <TouchableOpacity
                      style={[styles.setDisplayBtn, {
                        backgroundColor: selectedOutfit.id === activeOutfitId ? `${colors.primary}18` : colors.primary,
                        borderColor:     selectedOutfit.id === activeOutfitId ? colors.primary : 'transparent',
                      }]}
                      onPress={handleSetDisplay}
                    >
                      <Icon
                        name={selectedOutfit.id === activeOutfitId ? 'star' : 'star'}
                        size={15}
                        color={selectedOutfit.id === activeOutfitId ? colors.primary : '#fff'}
                      />
                      <Text style={[styles.setDisplayBtnText, { color: selectedOutfit.id === activeOutfitId ? colors.primary : '#fff' }]}>
                        {selectedOutfit.id === activeOutfitId ? t('profile.removeDisplay') : t('profile.setDisplay')}
                      </Text>
                    </TouchableOpacity>

                    {/* Divider — Your Character */}
                    <View style={styles.charDivider}>
                      <View style={[styles.charDividerLine, { backgroundColor: colors.border }]} />
                      <Text style={[styles.charDividerLabel, { color: colors.mutedForeground }]}>{t('profile.yourCharacter')}</Text>
                      <View style={[styles.charDividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Character info */}
                    <View style={styles.charRow}>
                      <View style={[styles.charAvatar, { borderColor: colors.primary, backgroundColor: colors.muted }]}>
                        <Image source={Images.character_default} style={styles.charAvatarImg} contentFit="cover" />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.charName, { color: colors.foreground }]}>{character.name}</Text>
                        {character.username && (
                          <Text style={[styles.charHandle, { color: colors.primary }]}>@{character.username}</Text>
                        )}
                        {character.bio ? (
                          <Text style={[styles.charBio, { color: colors.mutedForeground }]} numberOfLines={3}>
                            {character.bio}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Traits */}
                    {character.traits.length > 0 && (
                      <View style={styles.charTraits}>
                        {character.traits.map(t => (
                          <View key={t} style={[styles.charTraitChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }]}>
                            <Text style={[styles.charTraitText, { color: colors.primary }]}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Mood */}
                    {character.mood && (
                      <View style={{ marginTop: 10 }}>
                        <MoodBadge mood={character.mood} />
                      </View>
                    )}

                    {/* Delete */}
                    <TouchableOpacity
                      style={[styles.deleteBtn, {
                        backgroundColor: deletingOutfitInModal ? colors.destructive : `${colors.destructive}14`,
                        borderColor:     colors.destructive,
                      }]}
                      onPress={handleModalDelete}
                    >
                      <Icon name="trash-2" size={14} color={deletingOutfitInModal ? '#fff' : colors.destructive} />
                      <Text style={[styles.deleteBtnText, { color: deletingOutfitInModal ? '#fff' : colors.destructive }]}>
                        {deletingOutfitInModal ? 'Tap again to delete' : 'Delete outfit'}
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

      {/* ── Gallery photo lightbox ───────────────────────────── */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={closePhoto}
      >
        <View style={styles.galModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePhoto} />
          <View style={[styles.galModalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />

            {selectedPhoto && (
              <>
                <View style={[styles.galModalImageWrap, { backgroundColor: '#0A0820' }]}>
                  <Image
                    source={{ uri: selectedPhoto.imageUri }}
                    style={styles.galModalImage}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                </View>

                <View style={[styles.galModalBody, { paddingHorizontal: 20 }]}>
                  <Text style={[styles.galModalDate, { color: colors.mutedForeground }]}>
                    {new Date(selectedPhoto.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </Text>

                  {selectedPhoto.caption ? (
                    <Text style={[styles.galModalCaption, { color: colors.foreground }]}>
                      {selectedPhoto.caption}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.deleteBtn, {
                      backgroundColor: deletingPhoto ? colors.destructive : `${colors.destructive}14`,
                      borderColor: colors.destructive,
                      marginTop: 8,
                    }]}
                    onPress={handleDeletePhoto}
                  >
                    <Icon name="trash-2" size={14} color={deletingPhoto ? '#fff' : colors.destructive} />
                    <Text style={[styles.deleteBtnText, { color: deletingPhoto ? '#fff' : colors.destructive }]}>
                      {deletingPhoto ? 'Tap again to delete' : 'Delete photo'}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ height: 12 }} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Mood picker modal ────────────────────────────────── */}
      <Modal visible={showMoodPicker} transparent animationType="slide" onRequestClose={() => setShowMoodPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMoodPicker(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 4 }]}>Choose your mood</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: colors.mutedForeground, fontStyle: 'italic', marginBottom: 16 }}>
                How are you feeling in the sky today?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 }}>
                {Object.keys(MOOD_COLORS).map(mood => {
                  const isSelected = character.mood === mood;
                  const moodColor  = MOOD_COLORS[mood];
                  return (
                    <TouchableOpacity
                      key={mood}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 7,
                        paddingHorizontal: 14, paddingVertical: 9,
                        borderRadius: 20, borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? moodColor : `${moodColor}45`,
                        backgroundColor: isSelected ? `${moodColor}20` : `${moodColor}0A`,
                      }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCharacter({ ...character, mood });
                        setShowMoodPicker(false);
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: moodColor }} />
                      <Text style={{ fontSize: 14, fontFamily: isSelected ? 'Satoshi-Bold' : 'Satoshi-Regular', color: moodColor }}>
                        {mood}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Banner
  banner:   { position: 'relative', overflow: 'hidden' },
  orbA:     { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -50, right: -50 },
  orbB:     { position: 'absolute', width: 140, height: 140, borderRadius: 70,  bottom: -20, left: -40 },
  orbC:     { position: 'absolute', width: 80,  height: 80,  borderRadius: 40,  top: 30, left: '50%' },
  bannerTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  bannerChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  bannerLabel: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 2 },
  visToggle:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  visToggleText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },

  // Avatar
  avatarSection: { alignItems: 'center', marginTop: -60, paddingBottom: 8 },
  avatarCenter:  { position: 'relative', width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  avatarGlow:    { position: 'absolute', width: 128, height: 128, borderRadius: 64 },
  avatarRingOuter: { width: 116, height: 116, borderRadius: 58, borderWidth: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarRingInner: { width: 108, height: 108, borderRadius: 54, borderWidth: 2, overflow: 'hidden' },
  avatarImg:     { width: '100%', height: '100%' },
  avatarEditBadge: { position: 'absolute', bottom: 4, right: 2, width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sparkle:  { position: 'absolute', fontFamily: 'Satoshi-Bold' },
  sparkleA: { fontSize: 14, top: 2,   right: -2  },
  sparkleB: { fontSize: 10, bottom: 8, left: -2   },
  sparkleC: { fontSize: 12, top: 18,  left: -8   },

  // Name / Bio
  nameSection:     { alignItems: 'center', gap: 5, paddingHorizontal: 24, marginTop: 10, marginBottom: 4 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:            { fontSize: 22, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  editHint:        { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  nameEditWrap:    { borderBottomWidth: 2, paddingBottom: 3, alignSelf: 'stretch', alignItems: 'center' },
  nameEditInput:   { fontSize: 22, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4, textAlign: 'center' },
  usernameRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  usernameText:    { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  usernamePlaceholder: { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  usernameAt:      { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  usernameEditInput: { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  usernameError:   { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  bioRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bio:             { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 19, textAlign: 'center' },
  bioInput:        { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 19, borderWidth: 1, borderRadius: 12, padding: 10, alignSelf: 'stretch' },
  moodRow:         { marginTop: 4 },

  // Body
  body: {},

  // Stats
  statsCard:   { flexDirection: 'row', borderWidth: 1, borderRadius: 18, paddingVertical: 18, marginBottom: 14, marginTop: 14 },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statNum:     { fontSize: 18, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  statLabel:   { fontSize: 10, fontFamily: 'Satoshi-Medium', letterSpacing: 0.2, textTransform: 'uppercase' },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },

  // Section card (stories / wardrobe nav)
  sectionCard:       { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 20, gap: 12 },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionCardIcon:   { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sectionCardTitle:  { fontSize: 13, fontFamily: 'Satoshi-Bold', marginBottom: 1 },
  sectionCardSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  arrowCircle:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  thumbsRow:         { flexDirection: 'row', height: 96 },
  storyThumb:        { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1C1840', position: 'relative' },
  thumbGrad:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  thumbTitle:        { position: 'absolute', bottom: 6, left: 6, right: 6, fontSize: 9, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.92)', lineHeight: 12 },
  thumbMore:         { width: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thumbMoreText:     { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  emptyHint:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 18 },
  emptyHintText:     { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  // Sections
  section:       { borderTopWidth: 1, paddingTop: 22, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  sectionSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', marginTop: 2 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20 },
  addBtnText:    { color: '#fff', fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Outfit empty state
  emptyOutfitCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 16 },
  emptyOutfitIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emptyOutfitTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  emptyOutfitSub:   { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Outfit grid
  outfitGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  outfitGridCard:  { borderRadius: 16, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  outfitGridGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  outfitActiveBadge:     { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outfitActiveBadgeText: { fontSize: 12, color: '#fff' },
  outfitGridName:  { position: 'absolute', bottom: 8, left: 8, right: 8, fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)' },

  // Traits
  traitsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 5, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  traitText:   { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  traitRemove: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  traitAddWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  traitInput:  { fontSize: 13, fontFamily: 'Satoshi-Regular', minWidth: 80, maxWidth: 120 },
  traitAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  traitAddText: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  suggRow:     { marginTop: 14, gap: 8 },
  suggLabel:   { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  suggChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  suggText:    { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Theme toggle
  themeToggleRow: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, gap: 4, marginBottom: 4 },
  themeOption:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  themeOptionText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Account
  accountCardWrap:      { paddingTop: 22, marginBottom: 8 },
  accountSectionLabel:  { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  accountCard:     { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  accountRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  accountIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accountInfo:     { flex: 1 },
  accountInfoLabel: { fontSize: 10, fontFamily: 'Satoshi-Regular', marginBottom: 2 },
  accountInfoVal:  { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  accountDivider:  { height: 1, marginHorizontal: 14 },
  signOutRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  signOutText:     { fontSize: 14, fontFamily: 'Satoshi-Bold', flex: 1 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', overflow: 'hidden' },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,86,255,0.3)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalImageWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  modalImage:     { width: '100%', height: 220, alignItems: 'center', justifyContent: 'center' },
  modalActivePill: { position: 'absolute', bottom: 12, left: 16, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  modalActivePillText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: 0.2 },
  modalBody:    { paddingVertical: 16, gap: 12 },
  modalNameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  modalOutfitName: { flex: 1, fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  modalOutfitDate: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 4, flexShrink: 0 },
  modalTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalTag:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  modalTagText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  modalDesc:    { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },
  setDisplayBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 16, borderWidth: 1.5 },
  setDisplayBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  charDivider:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  charDividerLine:  { flex: 1, height: 1 },
  charDividerLabel: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.5 },
  charRow:          { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  charAvatar:       { width: 52, height: 52, borderRadius: 26, borderWidth: 2, overflow: 'hidden', flexShrink: 0 },
  charAvatarImg:    { width: '100%', height: '100%' },
  charName:         { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  charHandle:       { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  charBio:          { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, marginTop: 2 },
  charTraits:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  charTraitChip:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  charTraitText:    { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  deleteBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  deleteBtnText:    { fontSize: 14, fontFamily: 'Satoshi-Bold' },

  // Gallery
  galGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  galThumb: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1630' },
  galError: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginBottom: 8 },

  // Gallery lightbox modal
  galModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  galModalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', overflow: 'hidden' },
  galModalImageWrap: { width: '100%', aspectRatio: 1, overflow: 'hidden' },
  galModalImage:   { width: '100%', height: '100%' },
  galModalBody:    { paddingVertical: 16, gap: 10 },
  galModalDate:    { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  galModalCaption: { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },
});
