import { Icon } from '@/components/Icon';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/assets/images';
import { apiFetch, useApp, type Story } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';

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
const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#8B7AB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
};

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

export default function CharacterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { character, setCharacter, outfits, stories, activeOutfitId } = useApp();
  const { signOut } = useAuth();
  const { user } = useUser();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
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

  const [editingName, setEditingName]               = useState(false);
  const [editingBio, setEditingBio]                 = useState(false);
  const [editingUsername, setEditingUsername]       = useState(false);
  const [nameVal, setNameVal]                       = useState(character.name);
  const [bioVal, setBioVal]                         = useState(character.bio);
  const [usernameVal, setUsernameVal]               = useState(character.username ?? '');
  const [usernameError, setUsernameError]           = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking]     = useState(false);
  const [addingTrait, setAddingTrait]               = useState(false);
  const [newTrait, setNewTrait]                     = useState('');
  const [showSuggestions, setShowSuggestions]       = useState(false);

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
    if (val === character.username) {
      setEditingUsername(false);
      return;
    }

    setUsernameChecking(true);
    try {
      const result = await apiFetch<{ available: boolean; reason?: string }>(
        `/users/check-username?username=${encodeURIComponent(val)}`,
      );
      if (!result.available) {
        setUsernameError('That handle is already taken');
        return;
      }
    } catch { /* ignore network error, let server handle it */ } finally {
      setUsernameChecking(false);
    }

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
    s => !character.traits.includes(s) && s.toLowerCase().includes(newTrait.toLowerCase())
  );

  const totalWitnessed = stories.reduce((sum, s) => sum + s.witnessedCount, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* ── Banner ──────────────────────────────────────────────── */}
        <View style={[styles.banner, { height: topPad + 200 }]}>
          <LinearGradient colors={['#2E2260', '#3A2E78', '#4A3888']} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} />
          <View style={[styles.orbA, { backgroundColor: 'rgba(200,168,232,0.14)' }]} />
          <View style={[styles.orbB, { backgroundColor: 'rgba(200,168,75,0.1)' }]} />

          <View style={[styles.bannerTop, { paddingTop: topPad + 12 }]}>
            <Text style={styles.bannerLabel}>CHARACTER</Text>
            <TouchableOpacity
              style={[styles.visToggle, {
                backgroundColor: character.isPublic ? 'rgba(255,255,255,0.18)' : 'rgba(26,22,48,0.38)',
                borderColor: character.isPublic ? 'rgba(200,184,232,0.35)' : 'rgba(200,184,232,0.15)',
              }]}
              onPress={toggleVisibility}
            >
              <Icon
                name={character.isPublic ? 'globe' : 'lock'}
                size={12}
                color="rgba(220,210,255,0.85)"
              />
              <Text style={[styles.visToggleText, { color: 'rgba(220,210,255,0.85)' }]}>
                {character.isPublic ? 'Public profile' : 'Private profile'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Profile body ────────────────────────────────────────── */}
        <View style={[styles.body, { backgroundColor: colors.background }]}>

          {/* Avatar */}
          <View style={styles.avatarArea}>
            <View style={[styles.avatarGlow, { backgroundColor: `${colors.primary}18` }]} />
            <View style={[styles.avatarRing, { borderColor: colors.background }]}>
              {activeOutfitId && outfits.find(o => o.id === activeOutfitId)?.imageUri ? (
                <Image
                  source={{ uri: outfits.find(o => o.id === activeOutfitId)!.imageUri }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
              ) : (
                <Image source={Images.character_default} style={styles.avatarImg} resizeMode="cover" />
              )}
            </View>
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <Icon name="camera" size={11} color={colors.mutedForeground} />
            </View>
          </View>

          {/* Name + Username + Bio */}
          <View style={styles.nameSection}>
            {editingName ? (
              <View style={[styles.nameEditWrap, { borderBottomColor: colors.primary }]}>
                <TextInput
                  style={[styles.nameEditInput, { color: colors.foreground }]}
                  value={nameVal}
                  onChangeText={setNameVal}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveName}
                  onBlur={saveName}
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

            {/* Username row */}
            {editingUsername ? (
              <View style={[styles.usernameEditWrap, { borderColor: usernameError ? '#E04455' : colors.primary, backgroundColor: colors.muted }]}>
                <Text style={[styles.usernameAt, { color: usernameError ? '#E04455' : colors.primary }]}>@</Text>
                <TextInput
                  style={[styles.usernameEditInput, { color: colors.foreground }]}
                  value={usernameVal}
                  onChangeText={v => { setUsernameVal(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(null); }}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={saveUsername}
                  onBlur={saveUsername}
                  placeholder="your_handle"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={20}
                />
                {usernameChecking ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.usernameRow}
                onPress={() => { setUsernameVal(character.username ?? ''); setEditingUsername(true); setUsernameError(null); }}
              >
                {character.username ? (
                  <Text style={[styles.usernameText, { color: colors.primary }]}>@{character.username}</Text>
                ) : (
                  <Text style={[styles.usernamePlaceholder, { color: `${colors.mutedForeground}70` }]}>+ Set a username</Text>
                )}
                <Icon name="edit-2" size={10} color={`${colors.mutedForeground}55`} style={{ marginTop: 1 }} />
              </TouchableOpacity>
            )}
            {usernameError ? (
              <Text style={styles.usernameError}>{usernameError}</Text>
            ) : null}

            {editingBio ? (
              <TextInput
                style={[styles.bioInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={bioVal}
                onChangeText={setBioVal}
                multiline
                autoFocus
                returnKeyType="done"
                onBlur={saveBio}
              />
            ) : (
              <TouchableOpacity style={styles.bioRow} onPress={() => setEditingBio(true)}>
                <Text style={[styles.bio, { color: character.bio ? colors.mutedForeground : `${colors.mutedForeground}70` }]}>
                  {character.bio || 'Tap to add a bio...'}
                </Text>
                <Icon name="edit-2" size={11} color={`${colors.mutedForeground}55`} style={{ marginTop: 2 }} />
              </TouchableOpacity>
            )}
          </View>

          {/* Stats row */}
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
            <TouchableOpacity style={styles.statItem} onPress={() => router.push('/my-stories' as any)} activeOpacity={0.7}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{stories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Stories</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{outfits.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Outfits</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{totalWitnessed}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Witnessed</Text>
            </View>
          </View>

          {/* ── My Stories visual card ──────────────────────── */}
          <TouchableOpacity
            style={[styles.myStoriesCard, { backgroundColor: colors.card, borderColor: `${colors.primary}30` }, SHADOW.sm]}
            onPress={() => { Haptics.selectionAsync(); router.push('/my-stories' as any); }}
            activeOpacity={0.86}
          >
            {/* Header row */}
            <View style={styles.myStoriesHeader}>
              <View style={styles.myStoriesHeaderLeft}>
                <View style={[styles.myStoriesIconWrap, { backgroundColor: `${colors.primary}20` }]}>
                  <Icon name="book-open" size={15} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.myStoriesTitle, { color: colors.foreground }]}>My Stories</Text>
                  <Text style={[styles.myStoriesSub, { color: colors.mutedForeground }]}>
                    {stories.length === 0
                      ? 'Tap to write your first chapter'
                      : `${stories.length} chapter${stories.length !== 1 ? 's' : ''} written`}
                  </Text>
                </View>
              </View>
              <View style={[styles.myStoriesArrow, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
                <Icon name="arrow-right" size={14} color={colors.primary} />
              </View>
            </View>

            {/* Story thumbnails or empty hint */}
            {stories.length > 0 ? (
              <View style={styles.myStoriesThumbs}>
                {stories.slice(0, 4).map((story, i) => {
                  const cover = getCover(story);
                  const moodColor = MOOD_COLORS[story.mood] ?? colors.primary;
                  return (
                    <View
                      key={story.id}
                      style={[
                        styles.storyThumb,
                        { marginLeft: i > 0 ? 8 : 0 },
                        i === 0 && { flex: 1.4 },
                      ]}
                    >
                      {cover ? (
                        <Image source={cover} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <LinearGradient
                          colors={[`${moodColor}55`, `${moodColor}18`]}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(8,6,22,0.82)']}
                        style={styles.storyThumbGrad}
                      />
                      <Text style={styles.storyThumbTitle} numberOfLines={2}>
                        {story.chapterTitle}
                      </Text>
                    </View>
                  );
                })}
                {stories.length > 4 && (
                  <View style={[styles.storyThumbMore, { backgroundColor: `${colors.primary}14`, marginLeft: 8 }]}>
                    <Text style={[styles.storyThumbMoreText, { color: colors.primary }]}>
                      +{stories.length - 4}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.myStoriesEmpty, { borderColor: `${colors.primary}18` }]}>
                <Icon name="star" size={20} color={`${colors.primary}40`} />
                <Text style={[styles.myStoriesEmptyText, { color: `${colors.mutedForeground}` }]}>
                  Your chapters will appear here
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* ── Attributes ───────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Attributes</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Define your character</Text>
              </View>
            </View>

            <View style={styles.traitsWrap}>
              {character.traits.map(t => (
                <View
                  key={t}
                  style={[styles.traitChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}28` }]}
                >
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
                    placeholder="Type trait..."
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => addTrait(newTrait)}
                    onBlur={() => { if (!newTrait.trim()) { setAddingTrait(false); setShowSuggestions(false); } }}
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
                  <Text style={[styles.traitAddText, { color: colors.primary }]}>Add trait</Text>
                </TouchableOpacity>
              )}
            </View>

            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggRow}>
                <Text style={[styles.suggLabel, { color: colors.mutedForeground }]}>SUGGESTIONS</Text>
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

          {/* ── Wardrobe card ────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.myStoriesCard, { backgroundColor: colors.card, borderColor: `${colors.primary}30` }, SHADOW.sm]}
            onPress={() => { Haptics.selectionAsync(); router.push('/wardrobe' as any); }}
            activeOpacity={0.86}
          >
            {/* Header row */}
            <View style={styles.myStoriesHeader}>
              <View style={styles.myStoriesHeaderLeft}>
                <View style={[styles.myStoriesIconWrap, { backgroundColor: `${colors.primary}20` }]}>
                  <Icon name="grid" size={15} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.myStoriesTitle, { color: colors.foreground }]}>My Wardrobe</Text>
                  <Text style={[styles.myStoriesSub, { color: colors.mutedForeground }]}>
                    {outfits.length === 0
                      ? 'Tap to log your first outfit'
                      : `${outfits.length} outfit${outfits.length !== 1 ? 's' : ''} logged`}
                  </Text>
                </View>
              </View>
              <View style={styles.wardrobeHeaderRight}>
                <TouchableOpacity
                  style={[styles.wardrobeLogBtn, { backgroundColor: colors.primary }]}
                  onPress={(e) => { e.stopPropagation?.(); Haptics.selectionAsync(); router.push('/create-outfit' as any); }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Icon name="plus" size={12} color="#fff" />
                </TouchableOpacity>
                <View style={[styles.myStoriesArrow, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
                  <Icon name="arrow-right" size={14} color={colors.primary} />
                </View>
              </View>
            </View>

            {/* Outfit thumbnails or empty hint */}
            {outfits.length > 0 ? (
              <View style={styles.myStoriesThumbs}>
                {outfits.slice(0, 4).map((outfit, i) => (
                  <View
                    key={outfit.id}
                    style={[
                      styles.storyThumb,
                      { marginLeft: i > 0 ? 8 : 0 },
                      i === 0 && { flex: 1.4 },
                    ]}
                  >
                    {outfit.imageUri ? (
                      <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <LinearGradient
                        colors={[`${colors.primary}55`, `${colors.primary}18`]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(8,6,22,0.82)']}
                      style={styles.storyThumbGrad}
                    />
                    <Text style={styles.storyThumbTitle} numberOfLines={2}>{outfit.name}</Text>
                  </View>
                ))}
                {outfits.length > 4 && (
                  <View style={[styles.storyThumbMore, { backgroundColor: `${colors.primary}14`, marginLeft: 8 }]}>
                    <Text style={[styles.storyThumbMoreText, { color: colors.primary }]}>
                      +{outfits.length - 4}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.myStoriesEmpty, { borderColor: `${colors.primary}18` }]}>
                <Icon name="star" size={20} color={`${colors.primary}40`} />
                <Text style={[styles.myStoriesEmptyText, { color: colors.mutedForeground }]}>
                  Your outfits will appear here
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Account section ──────────────────────────────────────── */}
        <View style={styles.accountSection}>
          <Text style={[styles.accountSectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
          <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIconWrap, { backgroundColor: `${colors.primary}10` }]}>
                <Icon name="mail" size={14} color={colors.primary} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={[styles.accountInfoLabel, { color: colors.mutedForeground }]}>Signed in as</Text>
                <Text style={[styles.accountInfoVal, { color: colors.foreground }]} numberOfLines={1}>
                  {user?.primaryEmailAddress?.emailAddress ?? '—'}
                </Text>
              </View>
            </View>

            <View style={[styles.accountDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.signOutRow, confirmingSignOut && { backgroundColor: '#E04455' }]}
              onPress={handleSignOut}
              activeOpacity={0.75}
            >
              <View style={[styles.accountIconWrap, { backgroundColor: confirmingSignOut ? 'rgba(255,255,255,0.2)' : 'rgba(224,68,85,0.1)' }]}>
                <Icon name="log-out" size={14} color={confirmingSignOut ? '#fff' : '#E04455'} />
              </View>
              <Text style={[styles.signOutText, confirmingSignOut && { color: '#fff' }]}>
                {confirmingSignOut ? 'Tap again to confirm' : 'Sign Out'}
              </Text>
              <Icon name="chevron-right" size={14} color={confirmingSignOut ? 'rgba(255,255,255,0.6)' : 'rgba(224,68,85,0.5)'} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: { position: 'relative', overflow: 'hidden' },
  orbA: { position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -40, right: -40 },
  orbB: { position: 'absolute', width: 120, height: 120, borderRadius: 60, bottom: 0, left: -30 },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  bannerLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.2, color: 'rgba(220,210,255,0.55)' },
  visToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  visToggleText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  body: { paddingHorizontal: 20 },
  avatarArea: { marginTop: -56, alignSelf: 'flex-start', position: 'relative', marginBottom: 12 },
  avatarGlow: { position: 'absolute', width: 116, height: 116, borderRadius: 58, top: -6, left: -6 },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 4, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarEditBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nameSection: { gap: 6, marginBottom: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  name: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  editHint: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  nameEditWrap: { borderBottomWidth: 2, paddingBottom: 3 },
  nameEditInput: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  usernameText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  usernamePlaceholder: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  usernameEditWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  usernameAt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  usernameEditInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  usernameError: { fontSize: 11, fontFamily: 'Inter_400Regular', color: '#E04455', fontStyle: 'italic' },
  bioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bio: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 22 },
  bioInput: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 22, borderWidth: 1, borderRadius: 12, padding: 12 },
  myStoriesCard: {
    borderWidth: 1, borderRadius: 20, padding: 14,
    marginBottom: 26, gap: 12,
  },
  myStoriesHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myStoriesHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myStoriesIconWrap:   { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  myStoriesArrow: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  myStoriesTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 1 },
  myStoriesSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  myStoriesThumbs: { flexDirection: 'row', height: 100 },
  storyThumb: {
    flex: 1, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#1C1840', position: 'relative',
  },
  storyThumbGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  storyThumbTitle: {
    position: 'absolute', bottom: 6, left: 6, right: 6,
    fontSize: 9, fontFamily: 'Inter_600SemiBold',
    color: 'rgba(240,234,255,0.92)', lineHeight: 12,
  },
  storyThumbMore: {
    width: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  storyThumbMoreText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  myStoriesEmpty: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 18,
  },
  myStoriesEmptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  statsCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 18, paddingVertical: 18, marginBottom: 14 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statNum: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.2, textTransform: 'uppercase' },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  section: { borderTopWidth: 1, borderTopColor: 'rgba(200,184,232,0.12)', paddingTop: 22, marginBottom: 26 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitleRow: { gap: 3 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.55)', fontStyle: 'italic' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  outfitHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wardrobeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  wardrobeBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  wardrobeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wardrobeLogBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  traitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 12, paddingRight: 6, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  traitText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  traitRemove: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  traitAddWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  traitInput: { fontSize: 13, fontFamily: 'Inter_400Regular', minWidth: 80, maxWidth: 120 },
  traitAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  traitAddText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  suggRow: { marginTop: 14, gap: 8 },
  suggLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, textTransform: 'uppercase' },
  suggChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  suggText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  outfitEmpty: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 16 },
  outfitEmptyIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  outfitEmptyTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  outfitEmptyText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  outfitList: { gap: 10 },
  outfitCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  outfitThumb: { width: 76, height: 108, flexShrink: 0 },
  outfitThumbPlaceholder: { width: 76, height: 108, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activeThumbBadge: {
    position: 'absolute', top: 6, left: 6,
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: '#6B5B95', alignItems: 'center', justifyContent: 'center',
  },
  outfitInfo: { flex: 1, gap: 5, paddingHorizontal: 12, paddingVertical: 10 },
  outfitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  outfitName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  outfitDate: { fontSize: 10, fontFamily: 'Inter_400Regular', flexShrink: 0 },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  outfitTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  outfitTagText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  visChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  visChipText: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  outfitDeleteConfirmText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  outfitDeleteBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 },
  setDisplayBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
  setDisplayText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  accountSection: { paddingHorizontal: 20, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#E2D9EE', paddingTop: 22, marginBottom: 8 },
  accountSectionLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  accountCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  accountIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  accountInfo: { flex: 1 },
  accountInfoLabel: { fontSize: 10, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  accountInfoVal: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  accountDivider: { height: 1, marginHorizontal: 14 },
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  signOutText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#E04455', flex: 1 },
});
