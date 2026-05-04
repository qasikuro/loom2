import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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
import { useApp } from '@/context/AppContext';
import type { StoryPanel } from '@/context/AppContext';
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
  return { id: Date.now().toString() + Math.random().toString(36).substr(2, 5), imageUri: undefined, text: '' };
}

export default function CreateMemoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLog } = useApp();

  const [chapterTitle, setChapterTitle] = useState('');
  const [selectedMood, setSelectedMood] = useState('Hopeful');
  const [selectedLocation, setSelectedLocation] = useState('Daylight Prairie');
  const [isPublic, setIsPublic] = useState(true);
  const [showLocations, setShowLocations] = useState(false);
  const [showMoods, setShowMoods] = useState(false);
  const [panels, setPanels] = useState<StoryPanel[]>([makePanel()]);
  const [posting, setPosting] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  function updatePanel(index: number, updated: StoryPanel) {
    setPanels(prev => prev.map((p, i) => (i === index ? updated : p)));
  }

  function addPanel() {
    if (panels.length >= 12) { Alert.alert('Max panels reached', 'A chapter can have up to 12 panels.'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPanels(prev => [...prev, makePanel()]);
  }

  function removePanel(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPanels(prev => prev.filter((_, i) => i !== index));
  }

  function handlePost() {
    if (!chapterTitle.trim()) { Alert.alert('Missing title', 'Give your chapter a title.'); return; }
    const filledPanels = panels.filter(p => p.text.trim() || p.imageUri);
    if (filledPanels.length === 0) { Alert.alert('Empty story', 'Add at least one image or narration.'); return; }
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    addLog({
      id, date: new Date().toISOString(),
      chapterTitle: chapterTitle.trim(),
      panels: filledPanels,
      mood: selectedMood, location: selectedLocation,
      isPublic, witnessedCount: 0, savedCount: 0,
      vibeTag: selectedMood, logType: 'memory',
    });
    setPosting(false);
    router.push('/(tabs)/log');
  }

  const currentMood = MOODS.find(m => m.label === selectedMood);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#EDE8F8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 70 }]} />
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.typePill}>
            <Text style={styles.typeEmoji}>📸</Text>
            <Text style={[styles.typePillText, { color: '#7B6BA8' }]}>Memory Log</Text>
          </View>
          <Text style={[styles.panelCount, { color: colors.mutedForeground }]}>{panels.length} panel{panels.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: posting ? colors.muted : colors.primary }]}
          onPress={handlePost} disabled={posting}
        >
          <Text style={[styles.postBtnText, { color: posting ? colors.mutedForeground : '#fff' }]}>
            {posting ? '...' : 'Post'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
        {/* Meta card */}
        <View style={[styles.metaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.titleInput, { color: colors.foreground, borderBottomColor: colors.border }]}
            placeholder="Chapter title..." placeholderTextColor={colors.mutedForeground}
            value={chapterTitle} onChangeText={setChapterTitle} returnKeyType="done"
          />
          <View style={styles.metaRow}>
            <TouchableOpacity
              style={[styles.metaChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => { setShowLocations(!showLocations); setShowMoods(false); }}
            >
              <Feather name="map-pin" size={13} color={colors.primary} />
              <Text style={[styles.metaChipText, { color: colors.foreground }]} numberOfLines={1}>{selectedLocation}</Text>
              <Feather name="chevron-down" size={12} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.metaChip, { backgroundColor: `${currentMood?.color ?? colors.primary}15`, borderColor: `${currentMood?.color ?? colors.primary}30` }]}
              onPress={() => { setShowMoods(!showMoods); setShowLocations(false); }}
            >
              <Feather name={currentMood?.icon ?? 'sun'} size={13} color={currentMood?.color ?? colors.primary} />
              <Text style={[styles.metaChipText, { color: currentMood?.color ?? colors.primary }]}>{selectedMood}</Text>
              <Feather name="chevron-down" size={12} color={currentMood?.color ?? colors.primary} />
            </TouchableOpacity>
          </View>
          {showLocations && (
            <View style={[styles.dropdown, { borderColor: colors.border, backgroundColor: colors.background }]}>
              {LOCATIONS.map(loc => (
                <TouchableOpacity key={loc} style={[styles.dropItem, selectedLocation === loc && { backgroundColor: `${colors.primary}10` }]}
                  onPress={() => { setSelectedLocation(loc); setShowLocations(false); }}>
                  <Feather name="map-pin" size={12} color={selectedLocation === loc ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.dropText, { color: selectedLocation === loc ? colors.primary : colors.foreground }]}>{loc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {showMoods && (
            <View style={styles.moodGrid}>
              {MOODS.map(m => (
                <TouchableOpacity key={m.label}
                  style={[styles.moodChip, { backgroundColor: selectedMood === m.label ? `${m.color}25` : `${m.color}10`, borderColor: selectedMood === m.label ? `${m.color}60` : `${m.color}25`, borderWidth: selectedMood === m.label ? 1.5 : 1 }]}
                  onPress={() => { setSelectedMood(m.label); setShowMoods(false); Haptics.selectionAsync(); }}>
                  <Feather name={m.icon} size={14} color={m.color} />
                  <Text style={[styles.moodChipText, { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.privacyRow}>
            {(['Private', 'Public'] as const).map(opt => {
              const active = opt === 'Public' ? isPublic : !isPublic;
              return (
                <TouchableOpacity key={opt}
                  style={[styles.privBtn, { backgroundColor: active ? `${colors.primary}18` : colors.muted, borderColor: active ? `${colors.primary}40` : colors.border, borderWidth: active ? 1.5 : 1 }]}
                  onPress={() => setIsPublic(opt === 'Public')}>
                  <Feather name={opt === 'Private' ? 'lock' : 'globe'} size={13} color={active ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.privText, { color: active ? colors.primary : colors.mutedForeground }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Panels */}
        <View style={styles.panelsHeader}>
          <Feather name="layers" size={15} color={colors.primary} />
          <Text style={[styles.panelsHeaderText, { color: colors.foreground }]}>Story Panels</Text>
          <Text style={[styles.panelsHint, { color: colors.mutedForeground }]}>Each panel = one manga page</Text>
        </View>

        {panels.map((panel, index) => (
          <MangaPanelEditor key={panel.id} panel={panel} index={index} total={panels.length}
            onChange={updated => updatePanel(index, updated)} onDelete={() => removePanel(index)} />
        ))}

        <TouchableOpacity style={[styles.addPanel, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}08` }]} onPress={addPanel}>
          <View style={[styles.addPanelIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Feather name="plus" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.addPanelText, { color: colors.primary }]}>Add Next Panel</Text>
            <Text style={[styles.addPanelSub, { color: colors.mutedForeground }]}>{panels.length}/12 panels</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.publishBtn} onPress={handlePost} disabled={posting} activeOpacity={0.85}>
          <LinearGradient colors={['#7B6BA8', '#6B5B95', '#5A4A80']} style={styles.publishGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Feather name="send" size={16} color="#fff" />
            <Text style={styles.publishText}>{posting ? 'Posting...' : 'Publish Chapter'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 2 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeEmoji: { fontSize: 14 },
  typePillText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  panelCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  postBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  postBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  metaCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12, marginBottom: 20 },
  titleInput: { fontSize: 20, fontFamily: 'Inter_600SemiBold', paddingBottom: 12, borderBottomWidth: 1 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, flexShrink: 1, maxWidth: '60%' },
  metaChipText: { fontSize: 13, fontFamily: 'Inter_400Regular', flexShrink: 1 },
  dropdown: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11 },
  dropText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  moodChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  privacyRow: { flexDirection: 'row', gap: 8 },
  privBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  privText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  panelsHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  panelsHeaderText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', flex: 1 },
  panelsHint: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  addPanel: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 18, marginBottom: 16 },
  addPanelIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addPanelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  addPanelSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  publishBtn: { borderRadius: 30, overflow: 'hidden', marginBottom: 8 },
  publishGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  publishText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#fff' },
});
