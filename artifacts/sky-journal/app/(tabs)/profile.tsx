import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const ATTRIBUTE_SUGGESTIONS = [
  'Dreamer', 'Curious', 'Kind', 'Loner', 'Brave', 'Gentle',
  'Wanderer', 'Silent', 'Joyful', 'Nostalgic', 'Hopeful', 'Mystic',
  'Observer', 'Poet', 'Seeker', 'Free Spirit',
];

export default function CharacterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { character, setCharacter, outfits, deleteOutfit, stories } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [editingName, setEditingName] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [nameVal, setNameVal] = useState(character.name);
  const [bioVal, setBioVal] = useState(character.bio);
  const [addingTrait, setAddingTrait] = useState(false);
  const [newTrait, setNewTrait] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  function saveName() {
    if (nameVal.trim()) setCharacter({ ...character, name: nameVal.trim() });
    setEditingName(false);
  }
  function saveBio() {
    setCharacter({ ...character, bio: bioVal.trim() });
    setEditingBio(false);
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
  function handleDeleteOutfit(id: string) {
    Alert.alert('Remove Outfit', 'Remove this outfit from your log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteOutfit(id) },
    ]);
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
          <LinearGradient colors={['#B8A8D8', '#A4B8D8', '#D4C8F0']} style={StyleSheet.absoluteFill} />
          <View style={[styles.orbA, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
          <View style={[styles.orbB, { backgroundColor: 'rgba(200,168,75,0.12)' }]} />

          <View style={[styles.bannerTop, { paddingTop: topPad + 12 }]}>
            <Text style={styles.bannerLabel}>CHARACTER</Text>
            <TouchableOpacity
              style={[styles.visToggle, {
                backgroundColor: character.isPublic ? 'rgba(255,255,255,0.72)' : 'rgba(26,22,48,0.38)',
                borderColor: character.isPublic ? 'rgba(107,91,149,0.25)' : 'rgba(200,184,232,0.2)',
              }]}
              onPress={toggleVisibility}
            >
              <Feather
                name={character.isPublic ? 'globe' : 'lock'}
                size={12}
                color={character.isPublic ? colors.primary : 'rgba(200,184,232,0.85)'}
              />
              <Text style={[styles.visToggleText, {
                color: character.isPublic ? colors.primary : 'rgba(200,184,232,0.85)',
              }]}>
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
              <Image source={Images.character_default} style={styles.avatarImg} resizeMode="cover" />
            </View>
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <Feather name="camera" size={11} color={colors.mutedForeground} />
            </View>
          </View>

          {/* Name + Bio */}
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
                  <Feather name="edit-2" size={11} color={colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            )}

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
                <Feather name="edit-2" size={11} color={`${colors.mutedForeground}55`} style={{ marginTop: 2 }} />
              </TouchableOpacity>
            )}
          </View>

          {/* Stats row */}
          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{stories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Stories</Text>
            </View>
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
                    <Feather name="x" size={9} color={colors.primary} />
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
                    <Feather name="x" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.traitAddBtn, { borderColor: `${colors.primary}28`, backgroundColor: `${colors.primary}06` }]}
                  onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
                >
                  <Feather name="plus" size={12} color={colors.primary} />
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
                      <Feather name="plus" size={10} color={colors.mutedForeground} />
                      <Text style={[styles.suggText, { color: colors.mutedForeground }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* ── Outfit Log ──────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Outfit Log</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Daily style · public or private</Text>
              </View>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primary }, SHADOW.sm]}
                onPress={() => router.push('/create-outfit')}
              >
                <Feather name="plus" size={13} color="#fff" />
                <Text style={styles.addBtnText}>Log Outfit</Text>
              </TouchableOpacity>
            </View>

            {outfits.length === 0 ? (
              <TouchableOpacity
                style={[styles.outfitEmpty, { borderColor: colors.border, backgroundColor: colors.muted }]}
                onPress={() => router.push('/create-outfit')}
                activeOpacity={0.8}
              >
                <View style={[styles.outfitEmptyIcon, { backgroundColor: `${colors.primary}10` }]}>
                  <Feather name="star" size={22} color={`${colors.primary}70`} />
                </View>
                <View>
                  <Text style={[styles.outfitEmptyTitle, { color: colors.foreground }]}>Log your first outfit</Text>
                  <Text style={[styles.outfitEmptyText, { color: colors.mutedForeground }]}>Track your daily sky look</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : (
              <View style={styles.outfitList}>
                {outfits.map(outfit => (
                  <View
                    key={outfit.id}
                    style={[styles.outfitCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}
                  >
                    {outfit.imageUri ? (
                      <Image source={{ uri: outfit.imageUri }} style={styles.outfitThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.outfitThumbPlaceholder, { backgroundColor: `${colors.primary}10` }]}>
                        <Feather name="star" size={20} color={`${colors.primary}55`} />
                      </View>
                    )}
                    <View style={styles.outfitInfo}>
                      <View style={styles.outfitTop}>
                        <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>{outfit.name}</Text>
                        <Text style={[styles.outfitDate, { color: colors.mutedForeground }]}>{fmtDate(outfit.date)}</Text>
                      </View>
                      <View style={styles.outfitMeta}>
                        {outfit.tags.slice(0, 2).map(tag => (
                          <View key={tag} style={[styles.outfitTag, { backgroundColor: `${colors.primary}0F` }]}>
                            <Text style={[styles.outfitTagText, { color: colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                        <View style={[styles.visChip, {
                          backgroundColor: outfit.isPublic ? 'rgba(96,168,120,0.1)' : `${colors.primary}0F`,
                        }]}>
                          <Feather name={outfit.isPublic ? 'globe' : 'lock'} size={9} color={outfit.isPublic ? '#60A878' : colors.primary} />
                          <Text style={[styles.visChipText, { color: outfit.isPublic ? '#60A878' : colors.primary }]}>
                            {outfit.isPublic ? 'Public' : 'Private'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.outfitDeleteBtn, { backgroundColor: colors.muted }]}
                      onPress={() => handleDeleteOutfit(outfit.id)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Feather name="trash-2" size={12} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
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
  bannerLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 2.2, color: 'rgba(60,44,100,0.5)' },
  visToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  visToggleText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  body: { paddingHorizontal: 20 },
  avatarArea: { marginTop: -56, alignSelf: 'flex-start', position: 'relative', marginBottom: 12 },
  avatarGlow: { position: 'absolute', width: 116, height: 116, borderRadius: 58, top: -6, left: -6 },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 4, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarEditBadge: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nameSection: { gap: 7, marginBottom: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  name: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  editHint: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  nameEditWrap: { borderBottomWidth: 2, paddingBottom: 3 },
  nameEditInput: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  bioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bio: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 22 },
  bioInput: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 22, borderWidth: 1, borderRadius: 12, padding: 12 },
  statsCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 18, paddingVertical: 16, marginBottom: 24 },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, alignSelf: 'stretch', marginVertical: 4 },
  section: { borderTopWidth: 1, borderTopColor: '#E2D9EE', paddingTop: 22, marginBottom: 26 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitleRow: { gap: 3 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  // Traits
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
  // Outfits
  outfitEmpty: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 16 },
  outfitEmptyIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  outfitEmptyTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  outfitEmptyText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  outfitList: { gap: 10 },
  outfitCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  outfitThumb: { width: 76, height: 96, flexShrink: 0 },
  outfitThumbPlaceholder: { width: 76, height: 96, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  outfitInfo: { flex: 1, gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  outfitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  outfitName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1 },
  outfitDate: { fontSize: 10, fontFamily: 'Inter_400Regular', flexShrink: 0 },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  outfitTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  outfitTagText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  visChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  visChipText: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  outfitDeleteBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 },
});
