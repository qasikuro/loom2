import { Icon } from '@/components/Icon';
import { BadgeTray } from '@/components/profile/BadgeTray';
import { Images } from '@/assets/images';
import type { ConstellationState } from '@/components/ConstellationMap';
import { apiFetch, type Character, type Outfit } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { persistImageUri, ImageUploadError } from '@/utils/persistImage';
import {
  BreathingAvatarRing, FrameRing, MoodOrbPicker,
  ACCENT_CONFIGS, FRAME_CONFIGS,
} from './CharacterAuraHeader';
import { ATTRIBUTE_SUGGESTIONS, USERNAME_REGEX } from './profileConstants';

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
  activeAccent?: string;
  activeOutfit: Outfit | null;
  openDrawer: () => void;
  toggleVisibility: () => void;
  profileTitle: string;
  profileLevel: number;
  profileXpPct: number;
}

export function ProfileHeaderSection({
  character, setCharacter,
  constellation, availableTitles: _availableTitles, setShowTitlePicker,
  rewardBalance,
  activeFrame, activeAccent,
  activeOutfit,
  openDrawer, toggleVisibility,
  profileTitle, profileLevel, profileXpPct,
}: Props) {
  const colors = useColors();
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
  const [avatarUploading,   setAvatarUploading]   = useState(false);
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
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true); setAvatarError(null);
    try {
      const uri = await persistImageUri(result.assets[0].uri);
      setCharacter({ ...character, avatarUri: uri });
    } catch (err: unknown) {
      const msg = err instanceof ImageUploadError ? err.userMessage : 'Upload failed — check your connection.';
      setAvatarError(msg);
    } finally { setAvatarUploading(false); }
  }

  const hasTitle = !!(character.activeTitle || constellation?.activeTitle);
  const currentTitle = character.activeTitle ?? constellation?.activeTitle ?? null;

  return (
    <>
      {/* Top controls */}
      <View style={s.headerTopRow}>
        <TouchableOpacity
          style={[s.visPill, {
            backgroundColor: character.isPublic ? `${colors.primary}22` : 'rgba(255,255,255,0.08)',
            borderColor: character.isPublic ? `${colors.primary}45` : 'rgba(255,255,255,0.14)',
          }]}
          onPress={toggleVisibility}
        >
          <Icon name={character.isPublic ? 'globe' : 'lock'} size={11} color={character.isPublic ? colors.primary : 'rgba(200,184,232,0.7)'} />
          <Text style={[s.visPillText, { color: character.isPublic ? colors.primary : 'rgba(200,184,232,0.7)' }]}>
            {character.isPublic ? 'Public' : 'Private'}
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.headerIconBtn, { marginRight: 8 }]} onPress={() => {/* share — future */}} activeOpacity={0.75}>
          <Icon name="share-2" size={14} color="rgba(200,184,232,0.7)" />
        </TouchableOpacity>
        <TouchableOpacity style={s.headerIconBtn} onPress={openDrawer} activeOpacity={0.75}>
          <Icon name="settings" size={14} color="rgba(200,184,232,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Profile row: avatar left + info right */}
      <View style={s.profileRow}>
        {/* Avatar */}
        <View style={s.avatarWrap}>
          <View style={[s.avatarCircle, {
            borderColor: (activeFrame && FRAME_CONFIGS[activeFrame])
              ? FRAME_CONFIGS[activeFrame].color
              : `${colors.primary}70`,
          }]}>
            <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
          <BreathingAvatarRing mood={character.mood || 'Dreamy'} />
          {activeFrame && <FrameRing frameId={activeFrame} />}
          <TouchableOpacity
            style={[s.avatarEditBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={pickAvatar}
            activeOpacity={0.75}
          >
            {avatarUploading
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Icon name="camera" size={10} color={colors.primary} />
            }
          </TouchableOpacity>
        </View>

        {/* Name / username / title / badges */}
        <View style={s.profileInfo}>
          {/* Display name */}
          {editingName ? (
            <View style={[s.nameEditWrap, { borderBottomColor: colors.primary }]}>
              <TextInput
                style={[s.nameEditInput, { color: '#FFFFFF' }]}
                value={nameVal} onChangeText={setNameVal}
                autoFocus returnKeyType="done"
                onSubmitEditing={saveName} onBlur={saveName}
              />
            </View>
          ) : (
            <TouchableOpacity style={s.nameRow} onPress={() => setEditingName(true)}>
              <Text style={s.profileName}>{character.name}</Text>
              <Icon name="edit-2" size={11} color="rgba(200,184,232,0.35)" style={{ marginLeft: 5 }} />
            </TouchableOpacity>
          )}

          {/* Username */}
          {character.username ? (
            <View style={s.usernameRow}>
              <Text style={s.profileHandle}>@{character.username}</Text>
              <Icon name="lock" size={9} color="rgba(200,184,232,0.35)" style={{ marginLeft: 4 }} />
            </View>
          ) : editingUsername ? (
            <View style={[s.usernameEditWrap, { borderColor: usernameError ? colors.destructive : colors.primary, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[s.usernameAt, { color: usernameError ? colors.destructive : colors.primary }]}>@</Text>
              <TextInput
                style={[s.usernameEditInput, { color: '#FFFFFF' }]}
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
              style={s.usernameRow}
              onPress={() => { setUsernameVal(''); setEditingUsername(true); setUsernameError(null); }}
            >
              <Text style={[s.profileHandle, { color: 'rgba(200,184,232,0.38)', fontStyle: 'italic' }]}>{t('profile.setUsername')}</Text>
              <Icon name="edit-2" size={9} color="rgba(200,184,232,0.35)" style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          )}
          {usernameError && <Text style={[s.usernameError, { color: colors.destructive }]}>{usernameError}</Text>}

          {/* Role / Title row with + add button */}
          <View style={s.titleRow}>
            {hasTitle ? (
              <TouchableOpacity onPress={() => setShowTitlePicker(true)} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={s.titleStar}>✦</Text>
                <Text style={s.titleText}>{currentTitle}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setShowTitlePicker(true)} activeOpacity={0.75} style={s.titleAddBtn}>
                <Icon name="plus" size={10} color="rgba(200,184,232,0.50)" />
                <Text style={s.titleAddText}>Add title</Text>
              </TouchableOpacity>
            )}
            {hasTitle && (
              <TouchableOpacity
                onPress={() => setShowTitlePicker(true)}
                activeOpacity={0.75}
                style={s.titlePlusBtn}
              >
                <Icon name="plus" size={10} color="rgba(200,184,232,0.50)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Achievement badges */}
          {(character.badges ?? []).length > 0 && (
            <View style={{ marginTop: 5 }}>
              <BadgeTray badges={character.badges ?? []} />
            </View>
          )}
        </View>
      </View>

      {/* Intention + Bio — shared full-width card */}
      <View style={[
        s.intentionBioCard,
        activeAccent && ACCENT_CONFIGS[activeAccent]
          ? { borderColor: `${ACCENT_CONFIGS[activeAccent].color}38`, backgroundColor: `${ACCENT_CONFIGS[activeAccent].color}0E` }
          : { borderColor: 'rgba(200,184,232,0.12)', backgroundColor: 'rgba(255,255,255,0.04)' },
      ]}>
        {/* Intention row */}
        {editingIntention ? (
          <View style={s.intentionEditRow}>
            <Text style={s.intentionIcon}>✦</Text>
            <TextInput
              style={[s.intentionInput, { color: '#FFFFFF', flex: 1 }]}
              value={intentionVal}
              onChangeText={v => setIntentionVal(v.slice(0, 80))}
              placeholder="Set an intention for today…"
              placeholderTextColor="rgba(200,184,232,0.35)"
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
            <Text style={s.intentionCharCount}>{80 - intentionVal.length}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={s.intentionRow}
            onPress={() => { setIntentionVal(character.intentionDate === todayISO() ? (character.intention ?? '') : ''); setEditingIntention(true); }}
            activeOpacity={0.75}
          >
            <Text style={s.intentionIcon}>✦</Text>
            {character.intentionDate === todayISO() && character.intention ? (
              <Text style={s.intentionText} numberOfLines={2}>{character.intention}</Text>
            ) : (
              <Text style={s.intentionPlaceholder}>Set an intention for today…</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Divider */}
        <View style={s.cardDivider} />

        {/* Bio row */}
        {editingBio ? (
          <TextInput
            style={[s.bioInput, { color: '#FFFFFF', borderColor: colors.primary }]}
            value={bioVal} onChangeText={setBioVal}
            multiline autoFocus returnKeyType="done" onBlur={saveBio}
            placeholder="Write something about yourself…"
            placeholderTextColor="rgba(200,184,232,0.35)"
          />
        ) : (
          <TouchableOpacity
            onPress={() => setEditingBio(true)}
            activeOpacity={0.75}
            style={s.bioRow}
          >
            <Text style={[s.profileBio, { flex: 1, color: character.bio ? 'rgba(200,184,232,0.78)' : 'rgba(200,184,232,0.30)' }]}>
              {character.bio || t('profile.tapBio')}
            </Text>
            <Icon name="edit-2" size={13} color="rgba(200,184,232,0.28)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Mood orb picker */}
      <MoodOrbPicker
        currentMood={character.mood || 'Dreamy'}
        onSelect={m => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCharacter({ ...character, mood: m }); }}
      />

      {/* Existing trait chips (only if user has traits) */}
      {character.traits.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.traitScroll} contentContainerStyle={s.traitRow}>
          {character.traits.map(tr => (
            <View key={tr} style={s.traitChip}>
              <Text style={s.traitText}>{tr}</Text>
              <Text style={{ fontSize: 8, color: 'rgba(200,184,232,0.45)', marginLeft: 1 }}>✦</Text>
              <TouchableOpacity
                onPress={() => removeTrait(tr)}
                hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                style={s.traitRemove}
              >
                <Icon name="x" size={9} color="rgba(200,184,232,0.7)" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* + Add trait pill — standalone below VIBE / traits */}
      <View style={s.addTraitWrap}>
        <TouchableOpacity
          style={s.addTraitPill}
          onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
          activeOpacity={0.75}
        >
          <Icon name="plus" size={13} color="rgba(200,184,232,0.65)" />
          <Text style={s.addTraitText}>{t('profile.addTrait')}</Text>
        </TouchableOpacity>
      </View>

      {addingTrait && (
        <View style={[s.traitAddWrap, { borderColor: colors.primary, backgroundColor: 'rgba(120,86,255,0.1)', marginTop: 8 }]}>
          <TextInput
            style={[s.traitInput, { color: '#FFFFFF' }]}
            value={newTrait}
            onChangeText={v => { setNewTrait(v); setShowSuggestions(true); }}
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
        <View style={s.suggRow}>
          <Text style={s.suggLabel}>{t('profile.suggestions')}</Text>
          <View style={s.suggChips}>
            {suggestions.slice(0, 8).map(sg => (
              <TouchableOpacity key={sg} style={s.suggChip} onPress={() => addTrait(sg)}>
                <Icon name="plus" size={10} color="rgba(200,184,232,0.5)" />
                <Text style={s.suggText}>{sg}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {avatarError && (
        <Text style={{ color: '#DC2626', fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 6 }}>
          {avatarError}
        </Text>
      )}

      {/* Level / XP bar */}
      <View style={s.xpSection}>
        <View style={s.xpTopRow}>
          <Text style={s.xpTitle}>🌙 {profileTitle}</Text>
          <View style={s.xpLevelBadge}>
            <Text style={s.xpLevelText}>Lv. {profileLevel}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={s.xpNumbers}>
            {((rewardBalance?.stars ?? 0) % 300).toLocaleString()} / 300 XP
          </Text>
        </View>
        <View style={s.xpBarTrack}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <View style={[s.xpBarFill, { width: `${Math.round(profileXpPct * 100)}%` as any }]} />
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  headerTopRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  headerIconBtn:    { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  visPill:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  visPillText:      { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },

  profileRow:       { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 14 },
  avatarWrap:       { width: 90, height: 90, position: 'relative', flexShrink: 0 },
  avatarCircle:     { width: 90, height: 90, borderRadius: 45, borderWidth: 2.5, overflow: 'hidden' },
  avatarEditBtn:    { position: 'absolute', bottom: 1, right: 1, width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  profileInfo:      { flex: 1, gap: 2, paddingTop: 2 },
  nameRow:          { flexDirection: 'row', alignItems: 'center' },
  profileName:      { fontSize: 26, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: -0.5 },
  nameEditWrap:     { borderBottomWidth: 2, paddingBottom: 3 },
  nameEditInput:    { fontSize: 26, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  usernameRow:      { flexDirection: 'row', alignItems: 'center' },
  profileHandle:    { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.65)' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  usernameAt:       { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  usernameEditInput:{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  usernameError:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  titleRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  titleStar:        { fontSize: 11, color: '#C8A84B' },
  titleText:        { fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.2 },
  titlePlusBtn:     { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,184,232,0.30)', backgroundColor: 'rgba(200,184,232,0.06)' },
  titleAddBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(200,184,232,0.25)', backgroundColor: 'rgba(200,184,232,0.05)' },
  titleAddText:     { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.50)', letterSpacing: 0.1 },

  // Shared intention + bio card
  intentionBioCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 2 },
  intentionRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  intentionEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  intentionIcon:    { fontSize: 12, color: 'rgba(200,184,232,0.38)' },
  intentionText:    { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.78)' },
  intentionPlaceholder:{ flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.30)' },
  intentionInput:   { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  intentionCharCount:{ fontSize: 9, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.35)' },
  cardDivider:      { height: 1, backgroundColor: 'rgba(200,184,232,0.08)', marginHorizontal: 14 },
  bioRow:           { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  profileBio:       { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18 },
  bioInput:         { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, borderWidth: 1, borderRadius: 0, padding: 14 },

  traitScroll:      { marginTop: 10 },
  traitRow:         { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  traitChip:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 3, paddingVertical: 4, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(120,86,255,0.18)', borderColor: 'rgba(120,86,255,0.38)' },
  traitText:        { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(210,195,255,0.92)' },
  traitRemove:      { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(120,86,255,0.22)' },

  addTraitWrap:     { marginHorizontal: 16, marginTop: 10, alignItems: 'flex-start' },
  addTraitPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(120,86,255,0.40)', backgroundColor: 'rgba(120,86,255,0.08)' },
  addTraitText:     { fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.70)' },
  traitAddWrap:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, marginHorizontal: 16 },
  traitInput:       { fontSize: 12, fontFamily: 'Satoshi-Regular', minWidth: 80, maxWidth: 120 },
  suggRow:          { marginTop: 14, gap: 8 },
  suggLabel:        { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(200,184,232,0.55)' },
  suggChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(200,184,232,0.18)' },
  suggText:         { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.5)' },

  xpSection:        { marginHorizontal: 16, marginTop: 14, marginBottom: 2 },
  xpTopRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  xpTitle:          { fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.2 },
  xpLevelBadge:     { backgroundColor: 'rgba(200,168,75,0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  xpLevelText:      { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.5 },
  xpNumbers:        { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,168,75,0.55)', letterSpacing: 0.2 },
  xpBarTrack:       { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  xpBarFill:        { height: 5, borderRadius: 3, backgroundColor: '#C8A84B' },
});
