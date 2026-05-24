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

// ── Social platforms ────────────────────────────────────────────────────────────
interface SocialPlatform {
  key:    string;
  label:  string;
  icon:   string;
  color:  string;
  prefix: string;
  placeholder: string;
}
const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'instagram', label: 'Instagram', icon: '📸', color: '#E1306C', prefix: 'https://instagram.com/',       placeholder: 'your_handle' },
  { key: 'tiktok',    label: 'TikTok',    icon: '🎵', color: '#010101', prefix: 'https://tiktok.com/@',        placeholder: 'yourhandle' },
  { key: 'twitter',   label: 'X / Twitter', icon: '✕', color: '#1A8CD8', prefix: 'https://x.com/',            placeholder: 'yourhandle' },
  { key: 'youtube',   label: 'YouTube',   icon: '▶',  color: '#FF0000', prefix: 'https://youtube.com/@',      placeholder: 'yourchannel' },
  { key: 'pinterest', label: 'Pinterest', icon: '📌', color: '#E60023', prefix: 'https://pinterest.com/',      placeholder: 'yourprofile' },
  { key: 'twitch',    label: 'Twitch',    icon: '🎮', color: '#9146FF', prefix: 'https://twitch.tv/',         placeholder: 'yourchannel' },
  { key: 'spotify',   label: 'Spotify',   icon: '🎧', color: '#1DB954', prefix: 'https://open.spotify.com/user/', placeholder: 'userid' },
  { key: 'snapchat',  label: 'Snapchat',  icon: '👻', color: '#FFCC00', prefix: 'https://snapchat.com/add/',  placeholder: 'yourhandle' },
  { key: 'discord',   label: 'Discord',   icon: '💬', color: '#5865F2', prefix: 'https://discord.gg/',        placeholder: 'invite-code' },
  { key: 'bereal',    label: 'BeReal',    icon: '📷', color: '#3D3D3D', prefix: 'https://bere.al/',           placeholder: 'yourhandle' },
  { key: 'other',     label: 'Other',     icon: '🔗', color: '#6B5B95', prefix: '',                           placeholder: 'https://...' },
];

function getPlatform(key: string | undefined) {
  return SOCIAL_PLATFORMS.find(p => p.key === key) ?? null;
}
function extractHandle(url: string, prefix: string): string {
  if (!prefix || !url.startsWith(prefix)) return url;
  return url.slice(prefix.length).replace(/^@/, '').replace(/\/$/, '');
}

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
    const remaining = galleryUsage.limit - galleryUsage.count;
    if (remaining <= 0) {
      setGalleryError(`Gallery full (${galleryUsage.limit} photos max)`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // 'limited' on iOS 14+ means user granted access to specific photos — picker still works
    if (perm.status === 'denied' || perm.status === 'restricted') {
      setGalleryError('Photo access denied — enable it in Settings to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    setGalleryUploading(true);
    setGalleryError(null);
    try {
      const results = await Promise.allSettled(
        result.assets.map(async (asset) => {
          const uri = await persistImageUri(asset.uri);
          if (!uri) throw new Error('Photo upload failed — check your connection and try again.');
          await addGalleryPhoto(uri, '');
        }),
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        setGalleryError(`${failed} photo${failed > 1 ? 's' : ''} failed to upload — check your connection.`);
      }
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
  const [avatarError,      setAvatarError]      = useState<string | null>(null);

  // Birthday / country / links
  const [editingBirthday,  setEditingBirthday]  = useState(false);
  const [editingCountry,   setEditingCountry]   = useState(false);
  const [birthdayVal,      setBirthdayVal]      = useState(character.birthday ?? '');
  const [countryVal,       setCountryVal]       = useState(character.country ?? '');

  // Social links state
  const [linkMode,         setLinkMode]         = useState<'none' | 'picking' | 'entering'>('none');
  const [linkPlatform,     setLinkPlatform]     = useState<SocialPlatform | null>(null);
  const [linkHandle,       setLinkHandle]       = useState('');
  const [linkOtherLabel,   setLinkOtherLabel]   = useState('');
  const [linkEditIdx,      setLinkEditIdx]      = useState<number | null>(null);

  function saveBirthday() {
    setCharacter({ ...character, birthday: birthdayVal.trim() || undefined });
    setEditingBirthday(false);
  }
  function saveCountry() {
    setCharacter({ ...character, country: countryVal.trim() || undefined });
    setEditingCountry(false);
  }
  function openAddLink() {
    setLinkEditIdx(null);
    setLinkHandle('');
    setLinkOtherLabel('');
    setLinkPlatform(null);
    setLinkMode('picking');
  }
  function openEditLink(idx: number) {
    const link = (character.links ?? [])[idx];
    if (!link) return;
    const plat = getPlatform(link.platform) ?? SOCIAL_PLATFORMS.find(p => link.url.startsWith(p.prefix) && p.key !== 'other') ?? getPlatform('other')!;
    const handle = extractHandle(link.url, plat.prefix);
    setLinkEditIdx(idx);
    setLinkPlatform(plat);
    setLinkHandle(handle);
    setLinkOtherLabel(plat.key === 'other' ? link.label : '');
    setLinkMode('entering');
  }
  function selectPlatform(p: SocialPlatform) {
    setLinkPlatform(p);
    setLinkHandle('');
    setLinkOtherLabel('');
    setLinkMode('entering');
  }
  function saveLink() {
    if (!linkPlatform) return;
    const handle = linkHandle.trim().replace(/^@/, '');
    if (!handle) { cancelLink(); return; }
    const url   = linkPlatform.key === 'other' ? handle : `${linkPlatform.prefix}${handle}`;
    const label = linkPlatform.key === 'other' ? (linkOtherLabel.trim() || 'Link') : linkPlatform.label;
    const links = [...(character.links ?? [])];
    const newLink = { label, url, platform: linkPlatform.key };
    if (linkEditIdx !== null) {
      links[linkEditIdx] = newLink;
    } else {
      links.push(newLink);
    }
    setCharacter({ ...character, links });
    cancelLink();
  }
  function cancelLink() {
    setLinkMode('none');
    setLinkPlatform(null);
    setLinkHandle('');
    setLinkEditIdx(null);
  }
  function removeLink(idx: number) {
    const links = (character.links ?? []).filter((_, i) => i !== idx);
    setCharacter({ ...character, links });
    cancelLink();
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    // allow 'limited' (iOS 14+ selective access); only block if explicitly denied
    if (perm.status === 'denied' || perm.status === 'restricted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const uri = await persistImageUri(result.assets[0].uri);
      if (uri) {
        setCharacter({ ...character, avatarUri: uri });
      } else {
        setAvatarError('Upload failed — check your connection');
      }
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

        {/* ── Profile header ──────────────────────────────────────── */}
        <LinearGradient
          colors={['#1D1A2E', '#272450', '#2E2A58']}
          style={[styles.profileHeader, { paddingTop: topPad + 8 }]}
          start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        >
          {/* Floating sparkles */}
          <Text style={[styles.deco, { top: topPad + 16, right: 28 }]}>✦</Text>
          <Text style={[styles.decoSm, { top: topPad + 56, left: 22 }]}>✦</Text>
          <Text style={[styles.decoXs, { top: topPad + 90, right: 60 }]}>✦</Text>

          {/* Top controls: vis toggle left, settings + bell right */}
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={[styles.visPill, {
                backgroundColor: character.isPublic ? `${colors.primary}22` : 'rgba(255,255,255,0.08)',
                borderColor: character.isPublic ? `${colors.primary}45` : 'rgba(255,255,255,0.14)',
              }]}
              onPress={toggleVisibility}
            >
              <Icon name={character.isPublic ? 'globe' : 'lock'} size={11} color={character.isPublic ? colors.primary : 'rgba(200,184,232,0.7)'} />
              <Text style={[styles.visPillText, { color: character.isPublic ? colors.primary : 'rgba(200,184,232,0.7)' }]}>
                {character.isPublic ? 'Public' : 'Private'}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.headerIconBtn}>
              <Icon name="settings" size={14} color="rgba(200,184,232,0.7)" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerIconBtn, { marginLeft: 6 }]}>
              <Icon name="bell" size={14} color="rgba(200,184,232,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Profile row: avatar left + info right */}
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatarCircle, { borderColor: `${colors.primary}70` }]}>
                <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              <TouchableOpacity
                style={[styles.avatarEditBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={pickAvatar}
                activeOpacity={0.75}
              >
                {avatarUploading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Icon name="camera" size={10} color={colors.primary} />
                }
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              {editingName ? (
                <View style={[styles.nameEditWrap, { borderBottomColor: colors.primary }]}>
                  <TextInput
                    style={[styles.nameEditInput, { color: '#FFFFFF' }]}
                    value={nameVal} onChangeText={setNameVal}
                    autoFocus returnKeyType="done"
                    onSubmitEditing={saveName} onBlur={saveName}
                  />
                </View>
              ) : (
                <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
                  <Text style={styles.profileName}>{character.name}</Text>
                  <Icon name="edit-2" size={10} color="rgba(200,184,232,0.4)" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}

              {editingUsername ? (
                <View style={[styles.usernameEditWrap, { borderColor: usernameError ? colors.destructive : colors.primary, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <Text style={[styles.usernameAt, { color: usernameError ? colors.destructive : colors.primary }]}>@</Text>
                  <TextInput
                    style={[styles.usernameEditInput, { color: '#FFFFFF' }]}
                    value={usernameVal}
                    onChangeText={v => { setUsernameVal(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(null); }}
                    autoFocus autoCapitalize="none" autoCorrect={false}
                    returnKeyType="done" onSubmitEditing={saveUsername} onBlur={saveUsername}
                    placeholder="your_handle" placeholderTextColor="rgba(200,184,232,0.4)"
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
                    <Text style={styles.profileHandle}>@{character.username}</Text>
                  ) : (
                    <Text style={[styles.profileHandle, { color: 'rgba(200,184,232,0.38)', fontStyle: 'italic' }]}>{t('profile.setUsername')}</Text>
                  )}
                  <Icon name="edit-2" size={9} color="rgba(200,184,232,0.35)" style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              )}
              {usernameError && (
                <Text style={[styles.usernameError, { color: colors.destructive }]}>{usernameError}</Text>
              )}

              {editingBio ? (
                <TextInput
                  style={[styles.bioInput, { color: '#FFFFFF', borderColor: colors.primary, backgroundColor: 'rgba(255,255,255,0.08)' }]}
                  value={bioVal} onChangeText={setBioVal}
                  multiline autoFocus returnKeyType="done" onBlur={saveBio}
                />
              ) : (
                <TouchableOpacity onPress={() => setEditingBio(true)} activeOpacity={0.75}>
                  <Text style={[styles.profileBio, { color: character.bio ? 'rgba(200,184,232,0.78)' : 'rgba(200,184,232,0.32)' }]}>
                    {character.bio || t('profile.tapBio')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Mood badge */}
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setShowMoodPicker(true); }}
            activeOpacity={0.75}
            style={[styles.moodRow, { marginTop: 12, marginBottom: 6 }]}
          >
            <MoodBadge mood={character.mood || 'Hopeful'} size="sm" />
            <Icon name="edit-2" size={9} color="rgba(200,184,232,0.35)" style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {/* Trait chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.traitChipsScroll} contentContainerStyle={styles.traitChipsRow}>
            {character.traits.map(tr => (
              <View key={tr} style={[styles.traitChip, { backgroundColor: 'rgba(120,86,255,0.18)', borderColor: 'rgba(120,86,255,0.38)' }]}>
                <Text style={[styles.traitText, { color: 'rgba(210,195,255,0.92)' }]}>{tr}</Text>
                <Text style={{ fontSize: 8, color: 'rgba(200,184,232,0.45)', marginLeft: 1 }}>✦</Text>
                <TouchableOpacity
                  onPress={() => removeTrait(tr)}
                  hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  style={[styles.traitRemove, { backgroundColor: 'rgba(120,86,255,0.22)' }]}
                >
                  <Icon name="x" size={9} color="rgba(200,184,232,0.7)" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.traitAddBtn, { borderColor: 'rgba(120,86,255,0.32)', backgroundColor: 'rgba(120,86,255,0.1)' }]}
              onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
            >
              <Icon name="plus" size={12} color="rgba(200,184,232,0.7)" />
              <Text style={[styles.traitAddText, { color: 'rgba(200,184,232,0.7)' }]}>{t('profile.addTrait')}</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Trait add input */}
          {addingTrait && (
            <View style={[styles.traitAddWrap, { borderColor: colors.primary, backgroundColor: 'rgba(120,86,255,0.1)', marginTop: 8 }]}>
              <TextInput
                style={[styles.traitInput, { color: '#FFFFFF' }]}
                value={newTrait}
                onChangeText={tr => { setNewTrait(tr); setShowSuggestions(true); }}
                placeholder={t('profile.traitPlaceholder')}
                placeholderTextColor="rgba(200,184,232,0.4)"
                autoFocus returnKeyType="done"
                onSubmitEditing={() => addTrait(newTrait)}
                onBlur={() => setTimeout(() => { if (!newTrait.trim()) { setAddingTrait(false); setShowSuggestions(false); } }, 200)}
              />
              <TouchableOpacity onPress={() => { setAddingTrait(false); setNewTrait(''); setShowSuggestions(false); }}>
                <Icon name="x" size={13} color="rgba(200,184,232,0.5)" />
              </TouchableOpacity>
            </View>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggRow}>
              <Text style={[styles.suggLabel, { color: 'rgba(200,184,232,0.55)' }]}>{t('profile.suggestions')}</Text>
              <View style={styles.suggChips}>
                {suggestions.slice(0, 8).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.suggChip, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(200,184,232,0.18)' }]}
                    onPress={() => addTrait(s)}
                  >
                    <Icon name="plus" size={10} color="rgba(200,184,232,0.5)" />
                    <Text style={[styles.suggText, { color: 'rgba(200,184,232,0.5)' }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {avatarError ? (
            <Text style={{ color: '#DC2626', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 6 }}>
              {avatarError}
            </Text>
          ) : null}
        </LinearGradient>

        {/* ── Stats card ──────────────────────────── */}
        <View style={[styles.statsLightCard, SHADOW.sm]}>
          <View style={styles.statsDataRow}>
            <TouchableOpacity style={styles.statLightItem} onPress={() => router.push('/my-stories' as any)} activeOpacity={0.7}>
              <Text style={styles.statLightNum}>{stories.length}</Text>
              <Text style={styles.statLightLabel}>{t('profile.stories')}</Text>
            </TouchableOpacity>
            <View style={styles.statLightDivider} />
            <View style={styles.statLightItem}>
              <Text style={styles.statLightNum}>{outfits.length}</Text>
              <Text style={styles.statLightLabel}>{t('profile.outfits')}</Text>
            </View>
            <View style={styles.statLightDivider} />
            <View style={styles.statLightItem}>
              <Text style={styles.statLightNum}>{totalWitnessed}</Text>
              <Text style={styles.statLightLabel}>{t('discover.witnessed')}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.body, { paddingHorizontal: 16, paddingTop: 16 }]}>

          {/* ── About me card (birthday / country / links) ────── */}
          <View style={[styles.sectionCard, { backgroundColor: '#27243E', borderColor: 'rgba(155,120,255,0.14)' }, SHADOW.sm]}>
            <View style={styles.sectionCardHeader}>
              <View style={styles.sectionCardLeft}>
                <View style={[styles.sectionCardIcon, { backgroundColor: 'rgba(155,120,255,0.16)' }]}>
                  <Icon name="user" size={15} color="rgba(190,165,255,0.90)" />
                </View>
                <Text style={[styles.sectionCardTitle, { color: '#EDE8FF' }]}>About Me</Text>
              </View>
            </View>

            {/* Birthday */}
            <View style={[styles.aboutRow, { borderTopColor: 'rgba(155,120,255,0.15)' }]}>
              <View style={[styles.aboutIconWrap, { backgroundColor: 'rgba(155,120,255,0.18)' }]}>
                <Icon name="gift" size={13} color="rgba(190,160,255,0.90)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.aboutLabel, { color: 'rgba(200,180,255,0.55)' }]}>Birthday</Text>
                {editingBirthday ? (
                  <TextInput
                    style={[styles.aboutInput, { color: '#EDE8FF', borderColor: 'rgba(155,120,255,0.55)', backgroundColor: 'rgba(155,120,255,0.10)' }]}
                    value={birthdayVal}
                    onChangeText={setBirthdayVal}
                    placeholder="e.g. 1998-03-15 or March 15"
                    placeholderTextColor="rgba(200,180,255,0.35)"
                    autoFocus returnKeyType="done"
                    onSubmitEditing={saveBirthday} onBlur={saveBirthday}
                  />
                ) : (
                  <TouchableOpacity onPress={() => { setBirthdayVal(character.birthday ?? ''); setEditingBirthday(true); }} activeOpacity={0.7}>
                    <Text style={[styles.aboutValue, { color: character.birthday ? '#EDE8FF' : 'rgba(200,180,255,0.38)' }]}>
                      {character.birthday || 'Add birthday'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Icon name="edit-2" size={11} color="rgba(180,150,255,0.50)" />
            </View>

            {/* Country */}
            <View style={[styles.aboutRow, { borderTopColor: 'rgba(155,120,255,0.15)', borderTopWidth: 0.75 }]}>
              <View style={[styles.aboutIconWrap, { backgroundColor: 'rgba(155,120,255,0.18)' }]}>
                <Icon name="map-pin" size={13} color="rgba(190,160,255,0.90)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.aboutLabel, { color: 'rgba(200,180,255,0.55)' }]}>Country</Text>
                {editingCountry ? (
                  <TextInput
                    style={[styles.aboutInput, { color: '#EDE8FF', borderColor: 'rgba(155,120,255,0.55)', backgroundColor: 'rgba(155,120,255,0.10)' }]}
                    value={countryVal}
                    onChangeText={setCountryVal}
                    placeholder="e.g. Japan"
                    placeholderTextColor="rgba(200,180,255,0.35)"
                    autoFocus returnKeyType="done"
                    onSubmitEditing={saveCountry} onBlur={saveCountry}
                  />
                ) : (
                  <TouchableOpacity onPress={() => { setCountryVal(character.country ?? ''); setEditingCountry(true); }} activeOpacity={0.7}>
                    <Text style={[styles.aboutValue, { color: character.country ? '#EDE8FF' : 'rgba(200,180,255,0.38)' }]}>
                      {character.country || 'Add country'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Icon name="edit-2" size={11} color="rgba(180,150,255,0.50)" />
            </View>

            {/* Links */}
            <View style={[styles.aboutRow, { borderTopColor: 'rgba(155,120,255,0.15)', borderTopWidth: 0.75, flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>

              {/* Row header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.aboutIconWrap, { backgroundColor: 'rgba(155,120,255,0.18)' }]}>
                  <Icon name="link" size={13} color="rgba(190,160,255,0.90)" />
                </View>
                <Text style={[styles.aboutLabel, { color: 'rgba(200,180,255,0.55)', flex: 1 }]}>Socials</Text>
                {linkMode === 'none' && (character.links ?? []).length < 6 && (
                  <TouchableOpacity
                    style={[styles.linkAddBtn, { backgroundColor: 'rgba(155,120,255,0.16)', borderColor: 'rgba(155,120,255,0.36)' }]}
                    onPress={openAddLink}
                  >
                    <Icon name="plus" size={11} color="rgba(190,160,255,0.90)" />
                    <Text style={[styles.linkAddText, { color: 'rgba(190,160,255,0.90)' }]}>Add</Text>
                  </TouchableOpacity>
                )}
                {linkMode !== 'none' && (
                  <TouchableOpacity onPress={cancelLink} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.60)' }}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Existing links */}
              {(character.links ?? []).map((link, idx) => {
                const plat = getPlatform(link.platform) ?? SOCIAL_PLATFORMS.find(p => link.url.startsWith(p.prefix) && p.key !== 'other');
                const handle = plat ? extractHandle(link.url, plat.prefix) : link.url;
                const isEditing = linkMode === 'entering' && linkEditIdx === idx;
                return (
                  <View key={idx} style={[styles.socialLinkRow, { borderColor: isEditing ? (plat?.color ?? 'rgba(155,120,255,0.55)') + '80' : 'rgba(155,120,255,0.18)' }]}>
                    {/* Platform badge */}
                    <View style={[styles.socialBadge, { backgroundColor: (plat?.color ?? '#6B5B95') + '22' }]}>
                      <Text style={styles.socialIcon}>{plat?.icon ?? '🔗'}</Text>
                    </View>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => openEditLink(idx)} activeOpacity={0.75}>
                      <Text style={styles.socialPlatformName}>{plat?.label ?? link.label}</Text>
                      <Text style={styles.socialHandle} numberOfLines={1}>
                        {plat && plat.key !== 'other' ? `@${handle}` : handle}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeLink(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="x" size={14} color="rgba(180,150,255,0.50)" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Platform picker grid */}
              {linkMode === 'picking' && (
                <View style={styles.platformGrid}>
                  {SOCIAL_PLATFORMS.map(p => (
                    <TouchableOpacity
                      key={p.key}
                      style={[styles.platformChip, { borderColor: p.color + '55' }]}
                      onPress={() => selectPlatform(p)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.platformChipIcon, { backgroundColor: p.color + '22' }]}>
                        <Text style={{ fontSize: 16 }}>{p.icon}</Text>
                      </View>
                      <Text style={styles.platformChipLabel}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Handle input */}
              {linkMode === 'entering' && linkPlatform && (
                <View style={[styles.handleInputCard, { borderColor: (linkPlatform.color) + '55' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <View style={[styles.socialBadge, { backgroundColor: linkPlatform.color + '22' }]}>
                      <Text style={styles.socialIcon}>{linkPlatform.icon}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#EDE8FF' }}>{linkPlatform.label}</Text>
                    {linkPlatform.key !== 'other' && (
                      <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.45)', flex: 1 }} numberOfLines={1}>
                        {linkPlatform.prefix}
                      </Text>
                    )}
                  </View>
                  {linkPlatform.key === 'other' && (
                    <TextInput
                      style={[styles.handleInput, { marginBottom: 6 }]}
                      value={linkOtherLabel}
                      onChangeText={setLinkOtherLabel}
                      placeholder="Label (e.g. My Blog)"
                      placeholderTextColor="rgba(200,180,255,0.35)"
                      returnKeyType="next"
                    />
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {linkPlatform.key !== 'other' && (
                      <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,180,255,0.55)' }}>@</Text>
                    )}
                    <TextInput
                      style={[styles.handleInput, { flex: 1 }]}
                      value={linkHandle}
                      onChangeText={setLinkHandle}
                      placeholder={linkPlatform.placeholder}
                      placeholderTextColor="rgba(200,180,255,0.35)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={linkPlatform.key === 'other' ? 'url' : 'default'}
                      returnKeyType="done"
                      onSubmitEditing={saveLink}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.saveLinkBtn, { backgroundColor: linkPlatform.color + 'CC' }]}
                      onPress={saveLink}
                    >
                      <Icon name="check" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* ── Current Outfit spotlight ──────────────────────────── */}
          {activeOutfit && (
            <View style={[styles.spotlightCard, { backgroundColor: '#27243E', borderColor: 'rgba(155,120,255,0.14)' }, SHADOW.sm]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                <Text style={{ fontSize: 16 }}>🪡</Text>
                <Text style={[styles.spotlightLabel, { color: '#EDE8FF', textTransform: 'none', letterSpacing: 0, fontSize: 13, fontFamily: 'Satoshi-Bold' }]}>Current Outfit</Text>
              </View>
              <View style={styles.spotlightRow}>
                {/* Left: outfit image */}
                <TouchableOpacity
                  style={styles.spotlightImageWrap}
                  onPress={() => openOutfit(activeOutfit.id)}
                  activeOpacity={0.88}
                >
                  {activeOutfit.imageUri ? (
                    <Image source={{ uri: activeOutfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={[`${colors.primary}55`, `${colors.primary}1A`]} style={StyleSheet.absoluteFill} />
                  )}
                  <LinearGradient colors={['transparent', 'rgba(8,6,22,0.85)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                    <Text style={styles.spotlightName} numberOfLines={2}>{activeOutfit.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                {/* Right: info */}
                <View style={styles.spotlightInfo}>
                  <Text style={[styles.spotlightAboutLabel, { color: 'rgba(200,180,255,0.55)' }]}>About this look</Text>
                  <Text style={[styles.spotlightDesc, { color: 'rgba(210,196,240,0.90)' }]} numberOfLines={3}>
                    {activeOutfit.description || activeOutfit.name}
                  </Text>
                  <View style={styles.spotlightTags}>
                    {(activeOutfit.tags ?? []).slice(0, 3).map(tag => (
                      <View key={tag} style={[styles.spotlightTag, { backgroundColor: 'rgba(155,120,255,0.18)', borderColor: 'rgba(155,120,255,0.36)' }]}>
                        <Text style={[styles.spotlightTagText, { color: 'rgba(190,165,255,0.95)' }]}>{tag}</Text>
                      </View>
                    ))}
                    {(activeOutfit.tags ?? []).length === 0 && (
                      <View style={[styles.spotlightTag, { backgroundColor: 'rgba(232,184,48,0.16)', borderColor: 'rgba(232,184,48,0.36)' }]}>
                        <Text style={[styles.spotlightTagText, { color: 'rgba(232,184,48,0.95)' }]}>Displayed</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* ── Other Outfits horizontal row ─────────────────────── */}
          {outfits.length > 0 && (
            <View style={styles.hSection}>
              <View style={styles.hSectionHeader}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>{t('profile.wardrobe')}</Text>
                <TouchableOpacity onPress={() => router.push('/wardrobe' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.hSectionLink, { color: colors.primary }]}>View all ›</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollPad}>
                {outfits.slice(0, 8).map(outfit => {
                  const isActive = outfit.id === activeOutfitId;
                  return (
                    <TouchableOpacity
                      key={outfit.id}
                      style={[styles.hOutfitCard, { backgroundColor: colors.card, borderColor: isActive ? colors.primary : colors.border }]}
                      onPress={() => openOutfit(outfit.id)}
                      activeOpacity={0.85}
                    >
                      {outfit.imageUri ? (
                        <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={[`${colors.primary}50`, `${colors.primary}18`]} style={StyleSheet.absoluteFill} />
                      )}
                      <LinearGradient colors={['transparent', 'rgba(8,6,22,0.90)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                        <Text style={styles.hOutfitName} numberOfLines={2}>{outfit.name}</Text>
                        {isActive && (
                          <View style={[styles.hActivePill, { backgroundColor: colors.primary }]}>
                            <Text style={styles.hActivePillText}>Worn</Text>
                          </View>
                        )}
                      </LinearGradient>
                      {(outfit.tags ?? []).length > 0 && (
                        <View style={[styles.hRarityPill, { backgroundColor: 'rgba(8,6,22,0.75)', top: 7, left: 7 }]}>
                          <Text style={[styles.hRarityText, { color: 'rgba(220,200,255,0.9)' }]}>{outfit.tags[0]}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.hAddCard, { backgroundColor: `${colors.primary}0A`, borderColor: `${colors.primary}28` }]}
                  onPress={() => router.push('/create-outfit' as any)}
                  activeOpacity={0.8}
                >
                  <Icon name="plus" size={22} color={`${colors.primary}70`} />
                  <Text style={[styles.hAddText, { color: `${colors.primary}70` }]}>Add</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
          {outfits.length === 0 && (
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
                <Text style={[styles.emptyOutfitSub, { color: colors.mutedForeground }]}>{t('profile.emptyOutfitSub')}</Text>
              </View>
              <Icon name="arrow-right" size={14} color={`${colors.primary}60`} />
            </TouchableOpacity>
          )}

          {/* ── Stories horizontal row ───────────────────────────── */}
          {stories.length > 0 && (
            <View style={styles.hSection}>
              <View style={styles.hSectionHeader}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>{t('profile.stories')}</Text>
                <TouchableOpacity onPress={() => router.push('/my-stories' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.hSectionLink, { color: colors.primary }]}>View all ›</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollPad}>
                {stories.slice(0, 8).map(story => {
                  const cover     = getCover(story);
                  const moodColor = MOOD_COLORS[story.mood] ?? colors.primary;
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={[styles.hStoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id } } as any)}
                      activeOpacity={0.88}
                    >
                      {cover ? (
                        <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <LinearGradient colors={[`${moodColor}55`, `${moodColor}18`]} style={StyleSheet.absoluteFill} />
                      )}
                      <LinearGradient colors={['transparent', 'rgba(8,6,22,0.88)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                        <Text style={styles.hStoryTitle} numberOfLines={2}>{story.chapterTitle}</Text>
                      </LinearGradient>
                      <View style={[styles.hViewCount, { backgroundColor: 'rgba(8,6,22,0.65)' }]}>
                        <Icon name="eye" size={10} color="rgba(220,200,255,0.85)" />
                        <Text style={styles.hViewCountText}>{story.witnessedCount}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

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

  // Profile header (replaces banner + floating card)
  profileHeader: { paddingHorizontal: 20, paddingBottom: 24, overflow: 'hidden' },
  deco:   { position: 'absolute', fontSize: 13, color: 'rgba(200,184,232,0.42)', fontFamily: 'Satoshi-Bold' },
  decoSm: { position: 'absolute', fontSize: 8,  color: 'rgba(200,184,232,0.28)', fontFamily: 'Satoshi-Bold' },
  decoXs: { position: 'absolute', fontSize: 7,  color: 'rgba(200,184,232,0.20)', fontFamily: 'Satoshi-Bold' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerIconBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  visPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  visPillText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },

  // Profile row (avatar left + info right)
  profileRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 4 },
  avatarWrap:   { position: 'relative', width: 82, height: 82 },
  avatarCircle: { width: 82, height: 82, borderRadius: 41, borderWidth: 2.5, overflow: 'hidden' },
  avatarEditBtn: { position: 'absolute', bottom: 1, right: 1, width: 22, height: 22, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileInfo:  { flex: 1, paddingTop: 3, gap: 3 },
  profileName:  { fontSize: 22, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: -0.4, lineHeight: 27 },
  profileHandle:{ fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.72)' },
  profileBio:   { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 17 },

  // Stats card
  statsLightCard: {
    backgroundColor: '#27243E',
    borderRadius: 18,
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(155,120,255,0.13)',
    overflow: 'hidden',
  },
  statsDataRow:     { flexDirection: 'row', paddingHorizontal: 8 },
  statLightItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statLightNum:     { fontSize: 22, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.5 },
  statLightLabel:   { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,180,255,0.55)', letterSpacing: 0.5, textTransform: 'uppercase' },
  statLightDivider: { width: 1, backgroundColor: 'rgba(155,120,255,0.20)', marginVertical: 6 },

  // Trait chips scroll (used inside header)
  traitChipsScroll: { marginTop: 4, marginHorizontal: -20, marginBottom: 2 },
  traitChipsRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 6 },

  // Spotlight card (current outfit)
  spotlightCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  spotlightLabel: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  spotlightRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  spotlightImageWrap: {
    width: 120,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(120,86,255,0.22)',
  },
  spotlightName: {
    fontSize: 11,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)',
    lineHeight: 14,
  },
  spotlightInfo: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
  },
  spotlightAboutLabel: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  spotlightDesc: {
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  spotlightTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 2,
  },
  spotlightTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
    borderWidth: 1,
  },
  spotlightTagText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
  },

  // Horizontal section (outfits/stories rows)
  hSection: {
    marginBottom: 16,
  },
  hSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  hSectionTitle: {
    fontSize: 15,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.2,
  },
  hSectionLink: {
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
  },
  hScrollPad: {
    paddingRight: 16,
    gap: 10,
  },
  hOutfitCard: {
    width: 100,
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  hOutfitName: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)',
    lineHeight: 13,
  },
  hActivePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  hActivePillText: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },
  hRarityPill: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hRarityText: {
    fontSize: 9,
    fontFamily: 'Satoshi-Bold',
  },
  hAddCard: {
    width: 80,
    height: 130,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  hAddText: {
    fontSize: 11,
    fontFamily: 'Satoshi-Medium',
  },
  hStoryCard: {
    width: 110,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  hStoryTitle: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)',
    lineHeight: 13,
  },
  hViewCount: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hViewCountText: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,200,255,0.9)',
  },

  // Name / Bio
  nameSection:     { alignItems: 'center', gap: 5, paddingHorizontal: 24, marginTop: 10, marginBottom: 4 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name:            { fontSize: 24, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  editHint:        { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  nameEditWrap:    { borderBottomWidth: 2, paddingBottom: 3, alignSelf: 'stretch', alignItems: 'center' },
  nameEditInput:   { fontSize: 22, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4, textAlign: 'center' },
  usernameRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  usernameText:    { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  usernamePlaceholder: { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  usernameAt:      { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  usernameEditInput: { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  usernameError:   { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  bioRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bio:             { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, textAlign: 'center' },
  bioInput:        { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, borderWidth: 1, borderRadius: 10, padding: 10, alignSelf: 'stretch' },
  moodRow:         { marginTop: 4 },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 16 },

  // Stats
  statsCard:   { flexDirection: 'row', borderWidth: 1, borderRadius: 16, paddingVertical: 16, marginBottom: 12, marginTop: 14 },
  statItem:    { flex: 1, alignItems: 'center', gap: 4 },
  statNum:     { fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  statLabel:   { fontSize: 10, fontFamily: 'Satoshi-Medium', letterSpacing: 0.4, textTransform: 'uppercase' },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },

  // Section card (stories / wardrobe nav)
  sectionCard:       { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 16, gap: 12 },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionCardIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionCardTitle:  { fontSize: 13, fontFamily: 'Satoshi-Bold', marginBottom: 1 },
  sectionCardSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  arrowCircle:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  thumbsRow:         { flexDirection: 'row', height: 96 },
  storyThumb:        { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1C1840', position: 'relative' },
  thumbGrad:         { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  thumbTitle:        { position: 'absolute', bottom: 6, left: 6, right: 6, fontSize: 9, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.92)', lineHeight: 12 },
  thumbMore:         { width: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  thumbMoreText:     { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  emptyHint:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 18 },
  emptyHintText:     { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  // Sections
  section:       { borderTopWidth: 1, paddingTop: 20, marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:  { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  sectionSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', marginTop: 2 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  addBtnText:    { color: '#fff', fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Outfit empty state
  emptyOutfitCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 16 },
  emptyOutfitIcon:  { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emptyOutfitTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  emptyOutfitSub:   { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Outfit grid
  outfitGrid:      { flexDirection: 'row', flexWrap: 'wrap' },
  outfitGridCard:  { borderRadius: 14, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  outfitGridGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  outfitActiveBadge:     { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outfitActiveBadgeText: { fontSize: 12, color: '#fff' },
  outfitGridName:  { position: 'absolute', bottom: 8, left: 8, right: 8, fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)' },

  // Traits
  traitsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitChip:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 3, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  traitText:   { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  traitRemove: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  traitAddWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  traitInput:  { fontSize: 12, fontFamily: 'Satoshi-Regular', minWidth: 80, maxWidth: 120 },
  traitAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  traitAddText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  suggRow:     { marginTop: 14, gap: 8 },
  suggLabel:   { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase' },
  suggChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  suggText:    { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Theme toggle
  themeToggleRow: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 4 },
  themeOption:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  themeOptionText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Account
  accountCardWrap:      { paddingTop: 22, marginBottom: 8 },
  accountSectionLabel:  { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  accountCard:     { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  accountRow:      { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  accountIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accountInfo:     { flex: 1 },
  accountInfoLabel: { fontSize: 10, fontFamily: 'Satoshi-Regular', marginBottom: 2 },
  accountInfoVal:  { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  accountDivider:  { height: 1, marginHorizontal: 14 },
  signOutRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  signOutText:     { fontSize: 14, fontFamily: 'Satoshi-Bold', flex: 1 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', overflow: 'hidden' },
  modalHandle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(120,86,255,0.25)', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
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

  // About me card
  aboutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: 10, marginTop: 2,
  },
  aboutIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  aboutLabel: { fontSize: 10, fontFamily: 'Satoshi-Medium', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1 },
  aboutValue: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  aboutInput: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    borderWidth: 1.5, borderRadius: 9,
    paddingHorizontal: 10, paddingVertical: 6,
    marginTop: 2,
  },
  linkAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
  },
  linkAddText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  linkItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 0.75,
    paddingHorizontal: 10, paddingVertical: 8,
  },

  // Social links
  socialLinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 0.75,
    backgroundColor: 'rgba(155,120,255,0.07)',
    paddingHorizontal: 10, paddingVertical: 9,
  },
  socialBadge: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  socialIcon: { fontSize: 17, lineHeight: 20 },
  socialPlatformName: {
    fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', lineHeight: 16,
  },
  socialHandle: {
    fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.55)', marginTop: 1,
  },
  platformGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingTop: 2,
  },
  platformChip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderRadius: 12,
    backgroundColor: 'rgba(155,120,255,0.06)',
    paddingHorizontal: 10, paddingVertical: 7,
    minWidth: '43%', flexGrow: 1,
  },
  platformChipIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  platformChipLabel: {
    fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#EDE8FF',
  },
  handleInputCard: {
    borderWidth: 1, borderRadius: 14,
    backgroundColor: 'rgba(155,120,255,0.07)',
    paddingHorizontal: 12, paddingVertical: 12,
  },
  handleInput: {
    fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#EDE8FF',
    backgroundColor: 'rgba(155,120,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(155,120,255,0.28)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  saveLinkBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Gallery
  galGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  galThumb: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1A1630' },
  galError: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginBottom: 8 },

  // Gallery lightbox modal
  galModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  galModalSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', overflow: 'hidden' },
  galModalImageWrap: { width: '100%', aspectRatio: 1, overflow: 'hidden' },
  galModalImage:   { width: '100%', height: '100%' },
  galModalBody:    { paddingVertical: 16, gap: 10 },
  galModalDate:    { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  galModalCaption: { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 21 },
});
