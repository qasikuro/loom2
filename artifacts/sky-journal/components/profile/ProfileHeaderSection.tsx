import { Icon } from '@/components/Icon';
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
  constellation, availableTitles: _availableTitles, setShowTitlePicker: _setShowTitlePicker,
  rewardBalance: _rewardBalance,
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
        <TouchableOpacity style={s.headerIconBtn} onPress={openDrawer}>
          <Icon name="settings" size={14} color="rgba(200,184,232,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Profile row: avatar left + info right */}
      <View style={s.profileRow}>
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

        <View style={s.profileInfo}>
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
              <Icon name="edit-2" size={10} color="rgba(200,184,232,0.4)" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}

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

          {(character.activeTitle || constellation?.activeTitle) && (
            <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: '#C8A84B', fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 }}>
                ✦ {character.activeTitle ?? constellation!.activeTitle}
              </Text>
            </View>
          )}

          {/* Today's Intention */}
          {editingIntention ? (
            <View style={[s.intentionEditWrap, { borderColor: colors.primary, backgroundColor: 'rgba(255,255,255,0.07)' }]}>
              <TextInput
                style={[s.intentionInput, { color: '#FFFFFF' }]}
                value={intentionVal}
                onChangeText={v => setIntentionVal(v.slice(0, 80))}
                placeholder="Set an intention for today…"
                placeholderTextColor="rgba(200,184,232,0.38)"
                autoFocus
                returnKeyType="done"
                maxLength={80}
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
              style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              onPress={() => { setIntentionVal(character.intentionDate === todayISO() ? (character.intention ?? '') : ''); setEditingIntention(true); }}
              activeOpacity={0.75}
            >
              {character.intentionDate === todayISO() && character.intention ? (
                <Text style={s.intentionText} numberOfLines={1}>
                  ◌ {character.intention}
                </Text>
              ) : (
                <Text style={s.intentionPlaceholder}>◌ Set an intention for today…</Text>
              )}
            </TouchableOpacity>
          )}

          {editingBio ? (
            <TextInput
              style={[s.bioInput, { color: '#FFFFFF', borderColor: colors.primary, backgroundColor: 'rgba(255,255,255,0.08)' }]}
              value={bioVal} onChangeText={setBioVal}
              multiline autoFocus returnKeyType="done" onBlur={saveBio}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingBio(true)} activeOpacity={0.75}>
              <View style={activeAccent && ACCENT_CONFIGS[activeAccent] ? {
                borderRadius: 10, backgroundColor: `${ACCENT_CONFIGS[activeAccent].color}14`,
                borderWidth: 1, borderColor: `${ACCENT_CONFIGS[activeAccent].color}45`,
                paddingHorizontal: 10, paddingVertical: 6,
                shadowColor: ACCENT_CONFIGS[activeAccent].shadow, shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
              } : undefined}>
                <Text style={[s.profileBio, { color: character.bio ? 'rgba(200,184,232,0.78)' : 'rgba(200,184,232,0.32)' }]}>
                  {character.bio || t('profile.tapBio')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mood orb picker */}
      <MoodOrbPicker
        currentMood={character.mood || 'Dreamy'}
        onSelect={m => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCharacter({ ...character, mood: m }); }}
      />

      {/* Trait chips */}
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
        <TouchableOpacity
          style={s.traitAddBtn}
          onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
        >
          <Icon name="plus" size={12} color="rgba(200,184,232,0.7)" />
          <Text style={s.traitAddText}>{t('profile.addTrait')}</Text>
        </TouchableOpacity>
      </ScrollView>

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
      <View style={{ marginHorizontal: 16, marginTop: 14, marginBottom: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.3 }}>
            🌙 {profileTitle}
          </Text>
          <View style={{ backgroundColor: 'rgba(200,168,75,0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.5 }}>Lv.{profileLevel}</Text>
          </View>
        </View>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <View style={{ height: 5, borderRadius: 3, backgroundColor: '#C8A84B', width: `${Math.round(profileXpPct * 100)}%` as any }} />
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
  profileRow:       { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 4 },
  avatarWrap:       { width: 82, height: 82, position: 'relative', flexShrink: 0 },
  avatarCircle:     { width: 82, height: 82, borderRadius: 41, borderWidth: 2.5, overflow: 'hidden' },
  avatarEditBtn:    { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  profileInfo:      { flex: 1, gap: 3, paddingTop: 2 },
  nameRow:          { flexDirection: 'row', alignItems: 'center' },
  profileName:      { fontSize: 22, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: -0.4 },
  nameEditWrap:     { borderBottomWidth: 2, paddingBottom: 3 },
  nameEditInput:    { fontSize: 22, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  usernameRow:      { flexDirection: 'row', alignItems: 'center' },
  profileHandle:    { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.65)' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  usernameAt:       { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  usernameEditInput:{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  usernameError:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  profileBio:       { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 17 },
  bioInput:         { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 18, borderWidth: 1, borderRadius: 10, padding: 10 },
  traitScroll:      { marginTop: 12 },
  traitRow:         { flexDirection: 'row', gap: 6, paddingHorizontal: 2 },
  traitChip:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 3, paddingVertical: 4, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(120,86,255,0.18)', borderColor: 'rgba(120,86,255,0.38)' },
  traitText:        { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(210,195,255,0.92)' },
  traitRemove:      { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(120,86,255,0.22)' },
  traitAddBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(120,86,255,0.32)', backgroundColor: 'rgba(120,86,255,0.1)' },
  traitAddText:     { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.7)' },
  traitAddWrap:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  traitInput:       { fontSize: 12, fontFamily: 'Satoshi-Regular', minWidth: 80, maxWidth: 120 },
  suggRow:          { marginTop: 14, gap: 8 },
  suggLabel:        { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(200,184,232,0.55)' },
  suggChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(200,184,232,0.18)' },
  suggText:         { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.5)' },
  intentionEditWrap:{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginTop: 5 },
  intentionInput:   { flex: 1, fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  intentionCharCount:{ fontSize: 9, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.35)', marginLeft: 2 },
  intentionText:    { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.65)', flex: 1 },
  intentionPlaceholder:{ fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.28)' },
});
