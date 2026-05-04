import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MangaPanelEditor } from '@/components/MangaPanelEditor';
import { useApp, type StoryPanel } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const LOCATIONS = [
  'Daylight Prairie', 'Hidden Forest', 'Valley of Triumph',
  'Golden Wasteland', 'Isle of Dawn', 'Eye of Eden',
  'Vault of Knowledge', 'Aviary Village',
];

const MOODS = [
  { label: 'Hopeful', icon: 'sun' as const, color: '#C8A84B' },
  { label: 'Lonely', icon: 'moon' as const, color: '#7090C0' },
  { label: 'Peaceful', icon: 'cloud' as const, color: '#78A8C8' },
  { label: 'Romantic', icon: 'heart' as const, color: '#C870A0' },
  { label: 'Chaotic', icon: 'zap' as const, color: '#D0784A' },
  { label: 'Dreamy', icon: 'star' as const, color: '#8B6BA8' },
  { label: 'Soft', icon: 'feather' as const, color: '#9888C0' },
  { label: 'Adventurous', icon: 'wind' as const, color: '#60A878' },
];

function makePanel(): StoryPanel {
  return {
    id: crypto.randomUUID(),
    imageUri: undefined,
    text: '',
  };
}

export default function CreateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addStory } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [chapterTitle, setChapterTitle] = useState('');
  const [mood, setMood] = useState('Hopeful');
  const [location, setLocation] = useState('Daylight Prairie');
  const [isPublic, setIsPublic] = useState(true);
  const [showLocations, setShowLocations] = useState(false);
  const [showMoods, setShowMoods] = useState(false);
  const [panels, setPanels] = useState<StoryPanel[]>([makePanel()]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentMood = MOODS.find(m => m.label === mood);

  function updatePanel(i: number, p: StoryPanel) {
    setPanels(prev => prev.map((old, idx) => idx === i ? p : old));
  }

  function addPanel() {
    if (panels.length >= 12) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPanels(prev => [...prev, makePanel()]);
  }

  function removePanel(i: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPanels(prev => prev.filter((_, idx) => idx !== i));
  }

  function handlePost() {
    if (!chapterTitle.trim()) { setError('Give your chapter a title first.'); return; }
    const filled = panels.filter(p => p.text.trim() || p.imageUri);
    if (!filled.length) { setError('Add at least one image or narration to a panel.'); return; }
    setError(null);
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addStory({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      chapterTitle: chapterTitle.trim(),
      panels: filled,
      mood,
      location,
      isPublic,
      witnessedCount: 0,
      savedCount: 0,
    });
    setPosting(false);
    setChapterTitle('');
    setPanels([makePanel()]);
    router.push('/(tabs)');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#EDE8F8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 70 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Story</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Manga panels · {panels.length}/12
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: posting ? colors.muted : colors.primary }]}
          onPress={handlePost} disabled={posting}
        >
          <Feather name="send" size={14} color={posting ? colors.mutedForeground : '#fff'} />
          <Text style={[styles.postBtnText, { color: posting ? colors.mutedForeground : '#fff' }]}>
            {posting ? '...' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Meta card */}
        <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.titleInput, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Chapter title..."
            placeholderTextColor={colors.mutedForeground}
            value={chapterTitle}
            onChangeText={t => { setChapterTitle(t); if (error) setError(null); }}
            returnKeyType="done"
          />

          {/* Location + Mood row */}
          <View style={styles.metaRow}>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => { setShowLocations(v => !v); setShowMoods(false); }}
            >
              <Feather name="map-pin" size={12} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>{location}</Text>
              <Feather name="chevron-down" size={11} color={colors.mutedForeground} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chip, { backgroundColor: `${currentMood?.color}15`, borderColor: `${currentMood?.color}35` }]}
              onPress={() => { setShowMoods(v => !v); setShowLocations(false); }}
            >
              <Feather name={currentMood?.icon ?? 'sun'} size={12} color={currentMood?.color} />
              <Text style={[styles.chipText, { color: currentMood?.color }]}>{mood}</Text>
              <Feather name="chevron-down" size={11} color={currentMood?.color} />
            </TouchableOpacity>
          </View>

          {showLocations && (
            <View style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity key={loc}
                  style={[styles.dropItem, location === loc && { backgroundColor: `${colors.primary}10` }]}
                  onPress={() => { setLocation(loc); setShowLocations(false); }}
                >
                  <Text style={[styles.dropText, { color: location === loc ? colors.primary : colors.foreground }]}>{loc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {showMoods && (
            <View style={styles.moodGrid}>
              {MOODS.map(m => (
                <TouchableOpacity key={m.label}
                  style={[styles.moodPill, {
                    backgroundColor: mood === m.label ? `${m.color}25` : `${m.color}10`,
                    borderColor: mood === m.label ? `${m.color}65` : `${m.color}25`,
                    borderWidth: mood === m.label ? 1.5 : 1,
                  }]}
                  onPress={() => { setMood(m.label); setShowMoods(false); Haptics.selectionAsync(); }}
                >
                  <Feather name={m.icon} size={13} color={m.color} />
                  <Text style={[styles.moodPillText, { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Public / Private */}
          <View style={styles.privacyRow}>
            {(['Private', 'Public'] as const).map(opt => {
              const active = opt === 'Public' ? isPublic : !isPublic;
              return (
                <TouchableOpacity key={opt}
                  style={[styles.privBtn, {
                    backgroundColor: active ? `${colors.primary}15` : colors.muted,
                    borderColor: active ? `${colors.primary}40` : colors.border,
                    borderWidth: active ? 1.5 : 1,
                  }]}
                  onPress={() => setIsPublic(opt === 'Public')}
                >
                  <Feather name={opt === 'Private' ? 'lock' : 'globe'} size={13} color={active ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.privText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Panels label */}
        <View style={styles.panelsLabel}>
          <Feather name="layers" size={14} color={colors.primary} />
          <Text style={[styles.panelsLabelText, { color: colors.foreground }]}>Story Panels</Text>
          <Text style={[styles.panelsLabelHint, { color: colors.mutedForeground }]}>Each panel = one manga page</Text>
        </View>

        {panels.map((panel, idx) => (
          <MangaPanelEditor key={panel.id} panel={panel} index={idx} total={panels.length}
            onChange={p => updatePanel(idx, p)} onDelete={() => removePanel(idx)} />
        ))}

        {/* Add panel */}
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}07` }]}
          onPress={addPanel}
        >
          <View style={[styles.addBtnIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Feather name="plus" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Next Panel</Text>
            <Text style={[styles.addBtnSub, { color: colors.mutedForeground }]}>{panels.length} / 12</Text>
          </View>
        </TouchableOpacity>

        {/* Inline validation error */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
            <Feather name="alert-circle" size={14} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Publish button */}
        <TouchableOpacity style={styles.publishBtn} onPress={handlePost} disabled={posting} activeOpacity={0.85}>
          <LinearGradient colors={['#7B6BA8', '#6B5B95', '#5A4A80']} style={styles.publishGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Feather name="send" size={15} color="#fff" />
            <Text style={styles.publishText}>{posting ? 'Publishing...' : 'Publish Story'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  postBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  postBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  metaCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12, marginBottom: 20 },
  titleInput: { fontSize: 20, fontFamily: 'Inter_600SemiBold', paddingBottom: 12, borderBottomWidth: 1 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  dropdown: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  moodPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  moodPillText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  privacyRow: { flexDirection: 'row', gap: 8 },
  privBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  privText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  panelsLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  panelsLabelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', flex: 1 },
  panelsLabelHint: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 18, marginBottom: 14 },
  addBtnIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  addBtnSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  publishBtn: { borderRadius: 30, overflow: 'hidden', marginBottom: 8 },
  publishGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  publishText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#DC2626' },
});
