import { Icon } from '@/components/Icon';
import CropImageModal from '@/components/CropImageModal';
import { BadgeTray } from '@/components/profile/BadgeTray';
import { Images } from '@/assets/images';
import type { ConstellationState } from '@/components/ConstellationMap';
import { apiFetch, type Character, type Outfit } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { persistImageUri, ImageUploadError } from '@/utils/persistImage';
import {
  BreathingAvatarRing, FrameRing,
  FRAME_CONFIGS,
} from './CharacterAuraHeader';
import { ATTRIBUTE_SUGGESTIONS, USERNAME_REGEX, MOOD_ORBS } from './profileConstants';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const { isDark } = useTheme();
  const { t }  = useTranslation();

  const [editingName,       setEditingName]       = useState(false);
  const [nameVal,           setNameVal]           = useState(character.name);
  const [editingIntention,  setEditingIntention]  = useState(false);
  const [intentionVal,      setIntentionVal]      = useState('');
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
  const [newTrait,          setNewTrait]          = useState('');
  const [addingTrait,       setAddingTrait]       = useState(false);
  const [showSuggestions,   setShowSuggestions]   = useState(false);

  const avatarSource = character.avatarUri
    ? { uri: character.avatarUri }
    : activeOutfit?.imageUri
      ? { uri: activeOutfit.imageUri }
      : Images.character_default;

  const suggestions = ATTRIBUTE_SUGGESTIONS.filter(
    s => !character.traits.includes(s) && s.toLowerCase().includes(newTrait.toLowerCase()),
  );

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
  function addTrait(tr: string) {
    const trimmed = tr.trim();
    if (!trimmed || character.traits.includes(trimmed)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCharacter({ ...character, traits: [...character.traits, trimmed] });
    setNewTrait(''); setAddingTrait(false); setShowSuggestions(false);
  }
  function removeTrait(tr: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCharacter({ ...character, traits: character.traits.filter(x => x !== tr) });
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
  async function shareProfile() {
    await Share.share({
      title: `${character.name} on Ximo`,
      message: `Meet ${character.name} on Ximo${currentTitle ? ` — ${currentTitle}` : ''}.`,
    });
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
            backgroundColor: character.isPublic ? `${colors.primary}18` : colors.muted,
            borderColor: character.isPublic ? `${colors.primary}40` : colors.border,
          }]}
          onPress={toggleVisibility}
        >
          <Icon name={character.isPublic ? 'globe' : 'lock'} size={11} color={character.isPublic ? colors.primary : colors.mutedForeground} />
          <Text style={[s.visPillText, { color: character.isPublic ? colors.primary : colors.mutedForeground }]}>
            {character.isPublic ? 'Public' : 'Private'}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[s.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={shareProfile} activeOpacity={0.75}>
            <Icon name="share-2" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.headerIconBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={openDrawer} activeOpacity={0.75}>
            <Icon name="settings" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile row: avatar left + info right */}
      <View style={s.profileRow}>
        {/* Avatar */}
        <View style={s.avatarWrap}>
          <View style={[s.avatarCircle, {
            borderColor: (activeFrame && FRAME_CONFIGS[activeFrame])
              ? FRAME_CONFIGS[activeFrame].color
              : `${currentMoodData.accent}70`,
          }]}>
            <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit={character.avatarUri ? 'contain' : 'cover'} />
          </View>
          <BreathingAvatarRing mood={currentMood} />
          {activeFrame && <FrameRing frameId={activeFrame} />}
          <TouchableOpacity
            style={[s.avatarEditBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={pickAvatar}
            activeOpacity={0.75}
          >
            {avatarUploading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Icon name="camera" size={11} color={colors.foreground} />
            }
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={s.profileInfo}>
          {/* Display name */}
          {editingName ? (
            <View style={[s.nameEditWrap, { borderBottomColor: colors.primary }]}>
                <TextInput
                style={[s.nameEditInput, { color: colors.foreground }]}
                value={nameVal} onChangeText={setNameVal}
                autoFocus returnKeyType="done"
                onSubmitEditing={saveName} onBlur={saveName}
              />
            </View>
          ) : (
            <TouchableOpacity style={s.nameRow} onPress={() => setEditingName(true)}>
              <Text style={[s.profileName, { color: colors.foreground }]}>{character.name}</Text>
              <Icon name="edit-2" size={12} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}

          {/* Username */}
          {character.username ? (
            <View style={s.usernameRow}>
              <Text style={[s.profileHandle, { color: colors.mutedForeground }]}>@{character.username}</Text>
              <Icon name="lock" size={10} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
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
              <Text style={[s.profileHandle, { color: colors.mutedForeground, fontStyle: 'italic' }]}>{t('profile.setUsername')}</Text>
              <Icon name="edit-2" size={10} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
          {usernameError && <Text style={[s.usernameError, { color: colors.destructive }]}>{usernameError}</Text>}

          {/* Role / Title row */}
          <View style={s.titleRow}>
            {hasTitle ? (
              <TouchableOpacity onPress={() => setShowTitlePicker(true)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[s.titleStar, { color: colors.gold }]}>✦</Text>
                <Text style={[s.titleText, { color: colors.gold }]}>{currentTitle}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setShowTitlePicker(true)} activeOpacity={0.75} style={s.titleAddBtn}>
                <Icon name="plus" size={10} color={colors.mutedForeground} />
                <Text style={[s.titleAddText, { color: colors.mutedForeground }]}>Add title</Text>
              </TouchableOpacity>
            )}
            {hasTitle && (
              <TouchableOpacity onPress={() => setShowTitlePicker(true)} activeOpacity={0.75} style={s.titlePlusBtn}>
                <Icon name="plus" size={10} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Level / XP inline */}
          <View style={s.levelXpRow}>
             <View style={s.xpLevelBadge}>
                 <Icon name="moon" size={10} color={colors.gold} />
                 <Text style={[s.xpLevelText, { color: colors.gold }]}>Level {profileLevel}</Text>
             </View>
             <View style={s.xpContainer}>
                 <Text style={[s.xpNumbers, { color: colors.mutedForeground }]}>
                  {((rewardBalance?.stars ?? 0) % 300).toLocaleString()} / 300 XP
                </Text>
                 <View style={[s.xpBarTrack, { backgroundColor: colors.muted }]}>
                   {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <View style={[s.xpBarFill, { width: `${Math.round(profileXpPct * 100)}%` as any, backgroundColor: colors.gold }]} />
                </View>
             </View>
          </View>

          {/* Achievement badges */}
          {(character.badges ?? []).length > 0 && (
            <View style={{ marginTop: 5 }}>
              <BadgeTray badges={character.badges ?? []} />
            </View>
          )}
        </View>
      </View>

      {/* Row 3: Bento layout for Intention/Bio and Vibe */}
      <View style={s.bentoRow}>
        {/* Intention / Bio Box */}
        <View style={[s.intentionBioBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isDark && <Image source={Images.story_bg3} style={StyleSheet.absoluteFill} contentFit="cover" />}
          {isDark && <LinearGradient colors={['rgba(15,10,30,0.4)', 'rgba(15,10,30,0.8)']} style={StyleSheet.absoluteFill} />}

          <View style={s.ibInner}>
             {/* Intention */}
             {editingIntention ? (
               <View style={s.intentionEditRow}>
                  <Text style={[s.intentionIcon, { color: colors.gold }]}>✦</Text>
                 <TextInput
                    style={[s.intentionInput, { color: colors.foreground, flex: 1 }]}
                   value={intentionVal}
                   onChangeText={v => setIntentionVal(v.slice(0, 80))}
                   placeholder="Set an intention for today…"
                    placeholderTextColor={colors.mutedForeground}
                   autoFocus returnKeyType="done" maxLength={80}
                   onSubmitEditing={() => {
                     setCharacter({ ...character, intention: intentionVal.trim() || null, intentionDate: intentionVal.trim() ? todayISO() : null });
                     setEditingIntention(false);
                   }}
                   onBlur={() => {
                     setCharacter({ ...character, intention: intentionVal.trim() || null, intentionDate: intentionVal.trim() ? todayISO() : null });
                     setEditingIntention(false);
                   }}
                 />
               </View>
             ) : (
               <TouchableOpacity
                 style={s.intentionRow}
                 onPress={() => { setIntentionVal(character.intentionDate === todayISO() ? (character.intention ?? '') : ''); setEditingIntention(true); }}
                 activeOpacity={0.75}
               >
                  <Text style={[s.intentionIcon, { color: colors.gold }]}>✦</Text>
                 {character.intentionDate === todayISO() && character.intention ? (
                    <Text style={[s.intentionText, { color: colors.foreground }]} numberOfLines={2}>{character.intention}</Text>
                 ) : (
                    <Text style={[s.intentionPlaceholder, { color: colors.mutedForeground }]}>Set an intention for today...</Text>
                 )}
               </TouchableOpacity>
             )}

             {/* Bio */}
             {editingBio ? (
               <TextInput
                  style={[s.bioInput, { color: colors.foreground }]}
                 value={bioVal} onChangeText={setBioVal}
                 multiline autoFocus returnKeyType="done" onBlur={saveBio}
                 placeholder="Tap to add a bio..."
                  placeholderTextColor={colors.mutedForeground}
               />
             ) : (
               <TouchableOpacity
                 onPress={() => setEditingBio(true)}
                 activeOpacity={0.75}
                 style={s.bioRow}
               >
                  <Text style={[s.profileBio, { flex: 1, color: character.bio ? colors.foreground : colors.mutedForeground }]}>
                   {character.bio || 'Tap to add a bio...'}
                 </Text>
                  <Icon name="edit-2" size={13} color={colors.mutedForeground} />
               </TouchableOpacity>
             )}
          </View>
        </View>

        {/* Vibe Box */}
         <View style={[s.vibeBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.vibeLabel, { color: colors.mutedForeground }]}>VIBE</Text>
           <View style={s.orbContainer}>
              {MOOD_ORBS.map((m) => {
                 const sel = m.key === currentMood;
                 return (
                   <TouchableOpacity
                     key={m.key}
                     style={[s.vibeOrb, { backgroundColor: m.accent, opacity: sel ? 1 : 0.4 }]}
                     onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCharacter({ ...character, mood: m.key }); }}
                   >
                      {sel && <View style={[s.vibeOrbRing, { borderColor: colors.foreground }]} />}
                   </TouchableOpacity>
                 );
              })}
           </View>
           <Text style={[s.vibeCurrentText, { color: currentMoodData.accent }]}>{currentMood}</Text>

            <TouchableOpacity style={[s.addTraitBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}>
               <Icon name="plus" size={11} color={colors.mutedForeground} />
               <Text style={[s.addTraitBtnText, { color: colors.mutedForeground }]}>Add trait</Text>
           </TouchableOpacity>
        </View>
      </View>

      {/* Trait suggestions / input inline */}
      {addingTrait && (
        <View style={[s.traitAddWrap, { borderColor: colors.primary, backgroundColor: `${colors.primary}12`, marginTop: 8 }]}>
          <TextInput
            style={[s.traitInput, { color: colors.foreground }]}
            value={newTrait}
            onChangeText={v => { setNewTrait(v); setShowSuggestions(true); }}
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
      )}
      {showSuggestions && suggestions.length > 0 && (
        <View style={s.suggRow}>
          <Text style={[s.suggLabel, { color: colors.mutedForeground }]}>{t('profile.suggestions')}</Text>
          <View style={s.suggChips}>
            {suggestions.slice(0, 8).map(sg => (
              <TouchableOpacity key={sg} style={[s.suggChip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => addTrait(sg)}>
                <Icon name="plus" size={10} color={colors.mutedForeground} />
                <Text style={[s.suggText, { color: colors.mutedForeground }]}>{sg}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Existing trait chips below bento if they exist */}
      {character.traits.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.traitScroll} contentContainerStyle={s.traitRow}>
          {character.traits.map(tr => (
            <View key={tr} style={[s.traitChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
              <Text style={[s.traitText, { color: colors.primary }]}>{tr}</Text>
              <Text style={{ fontSize: 8, color: colors.mutedForeground, marginLeft: 1 }}>✦</Text>
              <TouchableOpacity
                onPress={() => removeTrait(tr)}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                style={[s.traitRemove, { backgroundColor: `${colors.primary}18` }]}
              >
                <Icon name="x" size={9} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

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
  headerTopRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  headerIconBtn:    { width: 30, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  visPill:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 18, borderWidth: 1 },
  visPillText:      { fontSize: 10.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },

  profileRow:       { flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 10 },
  avatarWrap:       { width: 84, height: 84, position: 'relative', flexShrink: 0 },
  avatarCircle:     { width: 84, height: 84, borderRadius: 42, borderWidth: 2.5, overflow: 'hidden' },
  avatarEditBtn:    { position: 'absolute', bottom: 0, right: 0, width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  profileInfo:      { flex: 1, gap: 3 },
  nameRow:          { flexDirection: 'row', alignItems: 'center' },
  profileName:      { fontSize: 21, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  nameEditWrap:     { borderBottomWidth: 2, paddingBottom: 3 },
  nameEditInput:    { fontSize: 21, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  usernameRow:      { flexDirection: 'row', alignItems: 'center', marginTop: -2 },
  profileHandle:    { fontSize: 11.5, fontFamily: 'Satoshi-Medium' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  usernameAt:       { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  usernameEditInput:{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  usernameError:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  titleRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  titleStar:        { fontSize: 12, color: '#C8A84B' },
  titleText:        { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.2 },
  titlePlusBtn:     { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,184,232,0.35)', backgroundColor: 'rgba(200,184,232,0.08)' },
  titleAddBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,184,232,0.25)', backgroundColor: 'rgba(200,184,232,0.05)' },
  titleAddText:     { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.50)', letterSpacing: 0.1 },

  levelXpRow:       { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 },
  xpLevelBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(200,168,75,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  xpLevelText:      { fontSize: 9.5, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.2 },
  xpContainer:      { flex: 1 },
  xpNumbers:        { fontSize: 8.5, fontFamily: 'Satoshi-Medium', color: 'rgba(200,168,75,0.8)', textAlign: 'right', marginBottom: 3 },
  xpBarTrack:       { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  xpBarFill:        { height: 4, borderRadius: 2, backgroundColor: '#C8A84B' },

  bentoRow:         { height: 104, flexDirection: 'row', gap: 10, marginTop: 3, marginBottom: 0 },
  intentionBioBox:  { flex: 1.5, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  ibInner:          { padding: 10, gap: 8, flex: 1, justifyContent: 'center' },
  intentionRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  intentionEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  intentionIcon:    { fontSize: 12, color: '#C8A84B' },
  intentionText:    { flex: 1, fontSize: 10.5, fontFamily: 'Satoshi-Medium', fontStyle: 'italic' },
  intentionPlaceholder:{ flex: 1, fontSize: 10.5, fontFamily: 'Satoshi-Medium', fontStyle: 'italic' },
  intentionInput:   { fontSize: 10.5, fontFamily: 'Satoshi-Medium', fontStyle: 'italic' },
  bioRow:           { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  profileBio:       { fontSize: 10, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  bioInput:         { fontSize: 10, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', padding: 0 },

  vibeBox:          { flex: 1, borderRadius: 16, borderWidth: 1, padding: 10, alignItems: 'center' },
  vibeLabel:        { fontSize: 9, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.5)', letterSpacing: 1.2, alignSelf: 'flex-start' },
  orbContainer:     { flexDirection: 'row', gap: 4, justifyContent: 'center', marginTop: 7 },
  vibeOrb:          { width: 10, height: 10, borderRadius: 5, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  vibeOrbRing:      { position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 12, borderWidth: 1, borderColor: '#FFF' },
  vibeCurrentText:  { fontSize: 11, fontFamily: 'Satoshi-Bold', marginTop: 7, letterSpacing: 0.2 },
  addTraitBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, borderWidth: 1, marginTop: 7 },
  addTraitBtnText:  { fontSize: 9.5, fontFamily: 'Satoshi-Medium' },

  traitScroll:      { marginTop: 10 },
  traitRow:         { flexDirection: 'row', gap: 6 },
  traitChip:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 4, paddingVertical: 4, borderRadius: 16, borderWidth: 1 },
  traitText:        { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  traitRemove:      { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  traitAddWrap:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  traitInput:       { fontSize: 12, fontFamily: 'Satoshi-Regular', minWidth: 80, maxWidth: 120 },
  suggRow:          { marginTop: 14, gap: 8 },
  suggLabel:        { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(200,184,232,0.55)' },
  suggChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  suggText:         { fontSize: 12, fontFamily: 'Satoshi-Regular' },
});
