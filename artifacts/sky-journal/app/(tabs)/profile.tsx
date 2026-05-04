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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const ATTRIBUTE_SUGGESTIONS = [
  'Dreamer', 'Curious', 'Kind', 'Loner', 'Brave', 'Gentle',
  'Wanderer', 'Silent', 'Joyful', 'Nostalgic', 'Hopeful', 'Mystic',
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
    setNewTrait('');
    setAddingTrait(false);
    setShowSuggestions(false);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* Banner */}
        <View style={[styles.banner, { height: topPad + 180 }]}>
          <LinearGradient colors={['#C8B8E8', '#B0C8E8', '#E0D8F4']} style={StyleSheet.absoluteFill} />
          <View style={[styles.orb, { top: -30, right: -30 }]} />
          <View style={[styles.orb2, { bottom: 10, left: -20 }]} />

          {/* Visibility toggle */}
          <View style={[styles.bannerTop, { paddingTop: topPad + 10 }]}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.visToggle, { backgroundColor: character.isPublic ? 'rgba(255,255,255,0.75)' : 'rgba(26,22,48,0.35)' }]}
              onPress={toggleVisibility}
            >
              <Feather name={character.isPublic ? 'globe' : 'lock'} size={13} color={character.isPublic ? colors.primary : 'rgba(200,184,232,0.85)'} />
              <Text style={[styles.visToggleText, { color: character.isPublic ? colors.primary : 'rgba(200,184,232,0.85)' }]}>
                {character.isPublic ? 'Public profile' : 'Private profile'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.body, { backgroundColor: colors.background }]}>
          {/* Avatar */}
          <View style={styles.avatarRow}>
            <View style={[styles.avatarGlow, { backgroundColor: `${colors.primary}20` }]} />
            <View style={[styles.avatarWrap, { borderColor: colors.background }]}>
              <Image source={Images.character_default} style={styles.avatarImg} resizeMode="cover" />
            </View>
          </View>

          {/* Name */}
          <View style={styles.nameSection}>
            {editingName ? (
              <View style={styles.inlineEdit}>
                <TextInput
                  style={[styles.nameEditInput, { color: colors.foreground, borderBottomColor: colors.primary }]}
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
                <Feather name="edit-2" size={14} color={colors.mutedForeground} />
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
              <TouchableOpacity onPress={() => setEditingBio(true)} style={styles.bioRow}>
                <Text style={[styles.bio, { color: colors.mutedForeground }]}>
                  {character.bio || 'Tap to add a bio...'}
                </Text>
                <Feather name="edit-2" size={12} color={`${colors.mutedForeground}70`} />
              </TouchableOpacity>
            )}
          </View>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
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
              <Text style={[styles.statNum, { color: colors.foreground }]}>{character.traits.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Traits</Text>
            </View>
          </View>

          {/* ── Attributes ─────────────────────────────────────────── */}
          <View style={[styles.section, { borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Attributes</Text>
              <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>What defines your character?</Text>
            </View>
            <View style={styles.traitsWrap}>
              {character.traits.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.traitChip, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}30` }]}
                  onLongPress={() => removeTrait(t)}
                >
                  <Text style={[styles.traitText, { color: colors.primary }]}>{t}</Text>
                  <TouchableOpacity onPress={() => removeTrait(t)} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                    <Feather name="x" size={11} color={`${colors.primary}80`} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              {/* Add trait */}
              {addingTrait ? (
                <View style={[styles.traitAddWrap, { borderColor: colors.primary, backgroundColor: `${colors.primary}08` }]}>
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
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.traitAddBtn, { borderColor: `${colors.primary}30`, backgroundColor: `${colors.primary}08` }]}
                  onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
                >
                  <Feather name="plus" size={13} color={colors.primary} />
                  <Text style={[styles.traitAddText, { color: colors.primary }]}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggRow}>
                {suggestions.slice(0, 6).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.suggChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={() => addTrait(s)}
                  >
                    <Text style={[styles.suggText, { color: colors.mutedForeground }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── Outfit Log ─────────────────────────────────────────── */}
          <View style={[styles.section, { borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Outfit Log</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Daily style — public or private
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.sectionBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/create-outfit')}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.sectionBtnText}>Log Outfit</Text>
              </TouchableOpacity>
            </View>

            {outfits.length === 0 ? (
              <TouchableOpacity
                style={[styles.outfitEmpty, { borderColor: colors.border, backgroundColor: colors.muted }]}
                onPress={() => router.push('/create-outfit')}
              >
                <Feather name="star" size={20} color={colors.mutedForeground} />
                <Text style={[styles.outfitEmptyText, { color: colors.mutedForeground }]}>
                  Log your first outfit
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.outfitGrid}>
                {outfits.map(outfit => (
                  <View key={outfit.id} style={[styles.outfitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {outfit.imageUri ? (
                      <Image source={{ uri: outfit.imageUri }} style={styles.outfitThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.outfitThumbPlaceholder, { backgroundColor: `${colors.primary}12` }]}>
                        <Feather name="star" size={22} color={`${colors.primary}60`} />
                      </View>
                    )}
                    <View style={styles.outfitInfo}>
                      <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
                        {outfit.name}
                      </Text>
                      <Text style={[styles.outfitDate, { color: colors.mutedForeground }]}>
                        {fmtDate(outfit.date)}
                      </Text>
                      <View style={styles.outfitMeta}>
                        {outfit.tags.slice(0, 2).map(tag => (
                          <View key={tag} style={[styles.outfitTag, { backgroundColor: `${colors.primary}10` }]}>
                            <Text style={[styles.outfitTagText, { color: colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                        <View style={[styles.outfitVisibility, { backgroundColor: outfit.isPublic ? 'rgba(96,168,120,0.12)' : `${colors.primary}10` }]}>
                          <Feather name={outfit.isPublic ? 'globe' : 'lock'} size={9} color={outfit.isPublic ? '#60A878' : colors.primary} />
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.outfitDelete}
                      onPress={() => handleDeleteOutfit(outfit.id)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Feather name="trash-2" size={13} color={`${colors.mutedForeground}70`} />
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
  orb: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.22)' },
  orb2: { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(200,168,75,0.15)' },
  bannerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  visToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  visToggleText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  body: { paddingHorizontal: 20 },
  avatarRow: { marginTop: -52, alignSelf: 'flex-start', position: 'relative', marginBottom: 10 },
  avatarGlow: { position: 'absolute', width: 108, height: 108, borderRadius: 54, top: -6, left: -6 },
  avatarWrap: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  nameSection: { gap: 6, marginBottom: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  inlineEdit: { paddingVertical: 2 },
  nameEditInput: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, borderBottomWidth: 2, paddingBottom: 2 },
  bioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bio: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 21 },
  bioInput: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 21, borderWidth: 1, borderRadius: 10, padding: 10 },
  statsRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, paddingVertical: 14, marginBottom: 20 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  statDivider: { width: 1, alignSelf: 'stretch' },
  section: { borderTopWidth: 1, paddingTop: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginTop: 2 },
  sectionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  sectionBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  traitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  traitText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  traitAddWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  traitInput: { fontSize: 13, fontFamily: 'Inter_400Regular', minWidth: 80, maxWidth: 120 },
  traitAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  traitAddText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  suggRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  suggChip: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  suggText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  // Outfits
  outfitEmpty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 20 },
  outfitEmptyText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  outfitGrid: { gap: 10 },
  outfitCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  outfitThumb: { width: 72, height: 90, flexShrink: 0 },
  outfitThumbPlaceholder: { width: 72, height: 90, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  outfitInfo: { flex: 1, gap: 5, paddingVertical: 10 },
  outfitName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  outfitDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  outfitMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  outfitTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  outfitTagText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  outfitVisibility: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  outfitDelete: { padding: 14 },
});
