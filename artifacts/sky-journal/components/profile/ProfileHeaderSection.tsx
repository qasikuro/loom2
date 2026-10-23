import { Icon } from '@/components/Icon';
import CropImageModal from '@/components/CropImageModal';
import { BadgeTray } from '@/components/profile/BadgeTray';
import { ProfileBadges } from '@/components/profile/ProfileBadges';
import { Images } from '@/assets/images';
import type { ConstellationState } from '@/components/ConstellationMap';
import { apiFetch, type Character, type Outfit } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as ImagePicker from 'expo-image-picker';
import { SecureImage as Image } from '@/components/SecureImage';
import { StorigamActivityIndicator as ActivityIndicator } from '@/components/SkyLoading';
import { ShareButton } from '@/components/ShareButton';
import { shareContent } from '@/utils/shareContent';
import React, { useEffect, useState } from 'react';
import {
  Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { persistImageUri, ImageUploadError } from '@/utils/persistImage';
import {
  BreathingAvatarRing, FrameRing,
  FRAME_CONFIGS,
} from './CharacterAuraHeader';
import { USERNAME_REGEX, MOOD_ORBS } from './profileConstants';

interface Props {
  character: Character;
  setCharacter: (c: Character) => void;
  constellation: ConstellationState | null;
  availableTitles: string[];
  setShowTitlePicker: (v: boolean) => void;
  rewardBalance: { stars: number; auraEnergy: number; memoryShards: number } | null;
  activeFrame?: string;
  activeOutfit: Outfit | null;
  openDrawer: () => void;
  toggleVisibility: () => void;
  profileLevel: number;
  profileXpPct: number;
}

export function ProfileHeaderSection({
  character, setCharacter,
  constellation, availableTitles: _availableTitles, setShowTitlePicker,
  rewardBalance,
  activeFrame,
  activeOutfit,
  openDrawer, toggleVisibility,
  profileLevel, profileXpPct,
}: Props) {
  const colors = useColors();
  const { t }  = useTranslation();
  const dynamicBadges = character.badges ?? [];
  const hasDynamicFounderBadge = dynamicBadges.some(badge => badge.slug === 'founder');
  const hasDynamicBetaBadge = dynamicBadges.some(badge => badge.slug === 'beta_tester');
  const showLegacyFounderBadge = Boolean(character.isFounder) && !hasDynamicFounderBadge;
  const showLegacyBetaBadge = Boolean(character.isBetaTester) && !hasDynamicBetaBadge;

  const [editingName,       setEditingName]       = useState(false);
  const [nameVal,           setNameVal]           = useState(character.name);
  const [editingUsername,   setEditingUsername]   = useState(false);
  const [usernameVal,       setUsernameVal]       = useState('');
  const [usernameError,     setUsernameError]     = useState<string | null>(null);
  const [usernameChecking,  setUsernameChecking]  = useState(false);
  const [editingBio,        setEditingBio]        = useState(false);
  const [bioVal,            setBioVal]            = useState(character.bio ?? '');

  useEffect(() => { if (!editingName) setNameVal(character.name); },      [character.name, editingName]);
  useEffect(() => { if (!editingBio)  setBioVal(character.bio ?? ''); },  [character.bio,  editingBio]);
  const [avatarUploading,   setAvatarUploading]   = useState(false);
  const [pendingAvatarUri, setPendingAvatarUri] = useState<string | null>(null);
  const [avatarError,       setAvatarError]       = useState<string | null>(null);

  const avatarSource = character.avatarUri
    ? { uri: character.avatarUri }
    : activeOutfit?.imageUri
      ? { uri: activeOutfit.imageUri }
      : Images.character_default;
  const heroHasArtwork = Boolean(activeOutfit?.imageUri || character.avatarUri);
  const heroForeground = heroHasArtwork ? colors.primaryForeground : colors.foreground;
  const heroMuted = heroHasArtwork ? `${colors.primaryForeground}D0` : colors.mutedForeground;
  const heroGlass = heroHasArtwork ? `${heroForeground}20` : colors.card;
  const heroGlassBorder = heroHasArtwork ? `${heroForeground}45` : colors.border;

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
    if (!val) { setCharacter({ ...character, username: undefined }); setEditingUsername(false); return; }
    if (!USERNAME_REGEX.test(val)) { setUsernameError('3–20 chars, lowercase letters, numbers and _ only'); return; }
    if (val === character.username) { setEditingUsername(false); return; }
    setUsernameChecking(true);
    try {
      const result = await apiFetch<{ available: boolean }>(`/users/check-username?username=${encodeURIComponent(val)}`);
      if (!result.available) { setUsernameError('That handle is already taken'); return; }
    } catch { /* ignore */ } finally { setUsernameChecking(false); }
    setCharacter({ ...character, username: val });
    setEditingUsername(false);
  }
  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if ((perm.status as string) === 'denied' || (perm.status as string) === 'restricted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setPendingAvatarUri(result.assets[0].uri);
  }
  async function handleAvatarCrop(uri: string) {
    setPendingAvatarUri(null);
    setAvatarUploading(true); setAvatarError(null);
    try {
      const persisted = await persistImageUri(uri);
      setCharacter({ ...character, avatarUri: persisted });
    } catch (err: unknown) {
      const msg = err instanceof ImageUploadError ? err.userMessage : 'Upload failed — check your connection.';
      setAvatarError(msg);
    } finally { setAvatarUploading(false); }
  }
  function shareProfile() {
    const username = character.username?.trim();
    const description = `Meet ${character.name}${username ? ` (@${username})` : ''} on Storigam${currentTitle ? ` — ${currentTitle}` : ''}.`;
    const share = () => {
      void shareContent({
        title: `${character.name} on Storigam`,
        description,
      });
    };

    if (!character.isPublic) {
      Alert.alert(
        'Share private profile details?',
        `This shares ${character.name}${username ? ` and @${username}` : ''} as text, without making the profile public.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share', onPress: share },
        ],
      );
      return;
    }
    share();
  }

  const hasTitle = !!(character.activeTitle || constellation?.activeTitle);
  const currentTitle = character.activeTitle ?? constellation?.activeTitle ?? null;
  const currentMood = character.mood || 'Dreamy';
  const currentMoodData = MOOD_ORBS.find(m => m.key === currentMood) || MOOD_ORBS[2];

  return (
    <>
      {/* Top controls */}
      <View style={s.headerTopRow}>
        <TouchableOpacity
          style={[s.visPill, {
            backgroundColor: heroHasArtwork
              ? heroGlass
              : character.isPublic ? `${colors.primary}18` : colors.muted,
            borderColor: heroHasArtwork
              ? heroGlassBorder
              : character.isPublic ? `${colors.primary}40` : colors.border,
          }]}
          onPress={toggleVisibility}
          hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}
        >
          <Icon
            name={character.isPublic ? 'globe' : 'lock'}
            size={11}
            color={heroHasArtwork ? heroForeground : character.isPublic ? colors.primary : colors.mutedForeground}
          />
          <Text style={[s.visPillText, { color: heroHasArtwork ? heroForeground : character.isPublic ? colors.primary : colors.mutedForeground }]}>
            {character.isPublic ? 'Public' : 'Private'}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <ShareButton
            style={[s.headerIconBtn, { backgroundColor: heroGlass, borderColor: heroGlassBorder }]}
            onPress={shareProfile}
            iconColor={heroHasArtwork ? heroForeground : colors.mutedForeground}
            accessibilityLabel="Share profile"
          />
          <TouchableOpacity style={[s.headerIconBtn, { backgroundColor: heroGlass, borderColor: heroGlassBorder }]} onPress={openDrawer} activeOpacity={0.75} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} accessibilityRole="button" accessibilityLabel="Settings">
            <Icon name="settings" size={16} color={heroHasArtwork ? heroForeground : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile row: avatar left + info right */}
      <View style={s.profileRow}>
        {/* Avatar */}
        <View style={s.avatarWrap}>
          {activeFrame && <FrameRing frameId={activeFrame} layer="wings" />}
          <View style={[s.avatarCircle, {
            borderColor: (activeFrame && FRAME_CONFIGS[activeFrame])
              ? FRAME_CONFIGS[activeFrame].color
              : `${currentMoodData.accent}70`,
          }]}>
            <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit={character.avatarUri ? 'contain' : 'cover'} />
          </View>
          <BreathingAvatarRing mood={currentMood} />
          {activeFrame && <FrameRing frameId={activeFrame} layer="ornament" />}
          <TouchableOpacity
            style={[s.avatarEditBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={pickAvatar}
            hitSlop={{ top: 7, bottom: 7, left: 7, right: 7 }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Change profile avatar"
          >
            {avatarUploading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Icon name="camera" size={11} color={colors.foreground} />
            }
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={s.profileInfo}>
          <View style={s.identityLine}>
            {editingName ? (
              <View style={[s.nameEditWrap, { borderBottomColor: colors.primary }]}>
                <TextInput
                  style={[s.nameEditInput, { color: heroForeground }]}
                  value={nameVal} onChangeText={setNameVal}
                  autoFocus returnKeyType="done"
                  onSubmitEditing={saveName} onBlur={saveName}
                />
              </View>
            ) : (
              <TouchableOpacity style={s.nameRow} onPress={() => setEditingName(true)}>
                <Text style={[s.profileName, { color: heroForeground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{character.name}</Text>
                <Icon name="edit-2" size={11} color={heroForeground} style={{ marginLeft: 5 }} />
              </TouchableOpacity>
            )}
            {character.username ? (
              <View style={s.usernameRow}>
                <Text style={[s.profileHandle, { color: heroMuted }]}>@{character.username}</Text>
                <Icon name="lock" size={9} color={heroMuted} style={{ marginLeft: 3 }} />
              </View>
            ) : editingUsername ? (
              <View style={[s.usernameEditWrap, { borderColor: usernameError ? colors.destructive : colors.primary, backgroundColor: colors.card }]}>
                <Text style={[s.usernameAt, { color: usernameError ? colors.destructive : colors.primary }]}>@</Text>
                <TextInput
                  style={[s.usernameEditInput, { color: colors.foreground }]}
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
                style={s.usernameRow}
                onPress={() => { setUsernameVal(''); setEditingUsername(true); setUsernameError(null); }}
              >
                <Text style={[s.profileHandle, { color: heroMuted, fontStyle: 'italic' }]}>{t('profile.setUsername')}</Text>
                <Icon name="edit-2" size={9} color={heroMuted} style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            )}
          </View>
          {usernameError && <Text style={[s.usernameError, { color: colors.destructive }]}>{usernameError}</Text>}

          {/* Role / Title row */}
          <View style={s.titleRow}>
            <View style={{ flexShrink: 1, minWidth: 0 }}>
              {hasTitle ? (
                <TouchableOpacity onPress={() => setShowTitlePicker(true)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[s.titleStar, { color: colors.gold }]}>✦</Text>
                  <Text style={[s.titleText, { color: colors.gold }]} numberOfLines={1}>{currentTitle}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setShowTitlePicker(true)} activeOpacity={0.75} style={s.titleAddBtn}>
                  <Icon name="plus" size={10} color={heroMuted} />
                  <Text style={[s.titleAddText, { color: heroMuted }]}>Add title</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.levelXpRow}>
              <View style={s.xpLevelBadge}>
                <Icon name="moon" size={10} color={colors.gold} />
                <Text style={[s.xpLevelText, { color: colors.gold }]}>Level {profileLevel}</Text>
              </View>
              <View style={s.xpContainer}>
                <Text style={[s.xpNumbers, { color: heroMuted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {((rewardBalance?.stars ?? 0) % 300).toLocaleString()} / 300 XP
                </Text>
                <View style={[s.xpBarTrack, { backgroundColor: colors.muted }]}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <View style={[s.xpBarFill, { width: `${Math.round(profileXpPct * 100)}%` as any, backgroundColor: colors.gold }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Achievement badges */}
          {dynamicBadges.length > 0 && (
            <View style={{ marginTop: 5 }}>
              <BadgeTray badges={dynamicBadges} />
            </View>
          )}
          {(showLegacyFounderBadge || showLegacyBetaBadge) && (
            <View style={{ marginTop: 5 }}>
              <ProfileBadges
                isFounder={showLegacyFounderBadge}
                isBetaTester={showLegacyBetaBadge}
                size={32}
                showLabel
              />
            </View>
          )}
        </View>
      </View>

      {/* Bio */}
      <View style={[s.bioCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {editingBio ? (
          <TextInput
            style={[s.bioInput, { color: colors.foreground }]}
            value={bioVal} onChangeText={setBioVal}
            multiline autoFocus returnKeyType="done" onBlur={saveBio}
            placeholder="Tap to add a bio..."
            placeholderTextColor={colors.mutedForeground}
          />
        ) : (
          <TouchableOpacity onPress={() => setEditingBio(true)} activeOpacity={0.75} style={s.bioRow} accessibilityRole="button" accessibilityLabel="Edit bio">
            <Text style={[s.profileBio, { flex: 1, color: character.bio ? colors.foreground : colors.mutedForeground }]}>
              {character.bio || 'Tap to add a bio...'}
            </Text>
            <Icon name="edit-2" size={15} color={colors.tint} />
          </TouchableOpacity>
        )}
      </View>

      {avatarError && (
        <Text style={{ color: colors.destructive, fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 6 }}>
          {avatarError}
        </Text>
      )}
      {pendingAvatarUri && (
        <CropImageModal
          visible
          uri={pendingAvatarUri}
          aspectRatio={1}
          onDone={handleAvatarCrop}
          onCancel={() => setPendingAvatarUri(null)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  headerTopRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerIconBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  visPill:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 34, borderRadius: 22, borderWidth: 1 },
  visPillText:      { fontSize: 12.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },

  profileRow:       { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12 },
  avatarWrap:       { width: 76, height: 76, position: 'relative', flexShrink: 0 },
  avatarCircle:     { width: 76, height: 76, borderRadius: 38, borderWidth: 2.5, overflow: 'hidden' },
  avatarEditBtn:    { position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  profileInfo:      { flex: 1, minWidth: 0, gap: 4 },
  identityLine:     { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 1 },
  nameRow:          { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
  profileName:      { fontSize: 26, lineHeight: 31, fontFamily: 'Satoshi-Black', letterSpacing: -0.8, flexShrink: 1 },
  nameEditWrap:     { borderBottomWidth: 2, paddingBottom: 3 },
  nameEditInput:    { fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  usernameRow:      { flexDirection: 'row', alignItems: 'center' },
  profileHandle:    { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, minWidth: 110 },
  usernameAt:       { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  usernameEditInput:{ flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular' },
  usernameError:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  titleRow:         { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 6, marginTop: 2 },
  titleStar:        { fontSize: 12, color: '#C8A84B' },
  titleText:        { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.2 },
  titlePlusBtn:     { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,184,232,0.35)', backgroundColor: 'rgba(200,184,232,0.08)' },
  titleAddBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 28, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(120,100,170,0.45)', backgroundColor: 'rgba(200,184,232,0.05)' },
  titleAddText:     { fontSize: 11.5, fontFamily: 'Satoshi-Medium', letterSpacing: 0.1 },

  levelXpRow:       { flexGrow: 1, flexBasis: 150, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 0 },
  xpLevelBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(200,168,75,0.20)', borderWidth: 1, borderColor: 'rgba(200,168,75,0.45)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 13 },
  xpLevelText:      { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  xpContainer:      { flex: 1 },
  xpNumbers:        { fontSize: 11, fontFamily: 'Satoshi-Medium', textAlign: 'right', marginBottom: 3 },
  xpBarTrack:       { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  xpBarFill:        { height: 4, borderRadius: 2, backgroundColor: '#C8A84B' },

  bioCard:          { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, marginTop: 0, marginBottom: 10 },
  bioRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  profileBio:       { fontSize: 14, lineHeight: 19, fontFamily: 'Satoshi-Medium' },
  bioInput:         { fontSize: 14, lineHeight: 19, fontFamily: 'Satoshi-Regular', padding: 0, minHeight: 30 },

});
