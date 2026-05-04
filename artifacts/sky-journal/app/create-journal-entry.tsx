import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const MOODS = [
  { label: 'Hopeful', icon: 'sun' as const, color: '#C8A84B' },
  { label: 'Peaceful', icon: 'cloud' as const, color: '#78A8C8' },
  { label: 'Lonely', icon: 'moon' as const, color: '#7090C0' },
  { label: 'Grateful', icon: 'heart' as const, color: '#C870A0' },
  { label: 'Dreamy', icon: 'star' as const, color: '#8B6BA8' },
  { label: 'Soft', icon: 'feather' as const, color: '#9888C0' },
  { label: 'Chaotic', icon: 'zap' as const, color: '#D0784A' },
  { label: 'Joyful', icon: 'smile' as const, color: '#60A878' },
];

const PROMPTS = [
  'What stayed with you today?',
  'Something small that mattered...',
  'A feeling too real to forget.',
  'If the sky could speak today, what would it say?',
  'What made your heart lighter — or heavier?',
  'One moment you want to remember.',
];

export default function CreateJournalEntryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addJournalEntry } = useApp();
  const inputRef = useRef<TextInput>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [text, setText] = useState('');
  const [mood, setMood] = useState('Peaceful');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const prompt = PROMPTS[today.getDate() % PROMPTS.length];

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  function handleSave() {
    if (!text.trim()) { Alert.alert('Write something first.'); return; }
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addJournalEntry({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
      date: new Date().toISOString(),
      text: text.trim(),
      mood,
      imageUri,
    });
    setSaving(false);
    router.back();
  }

  const currentMood = MOODS.find(m => m.label === mood);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#EDE0F8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 70 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Feather name="x" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Journal</Text>
          <View style={[styles.privatePill, { backgroundColor: `${colors.primary}12` }]}>
            <Feather name="lock" size={10} color={colors.primary} />
            <Text style={[styles.privatePillText, { color: colors.primary }]}>Private</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
          onPress={handleSave} disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: saving ? colors.mutedForeground : '#fff' }]}>
            {saving ? '...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Date */}
        <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>{dateLabel}</Text>

        {/* Prompt */}
        <TouchableOpacity
          style={[styles.promptCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
          onPress={() => inputRef.current?.focus()}
        >
          <Feather name="feather" size={13} color={`${colors.primary}80`} />
          <Text style={[styles.promptText, { color: colors.mutedForeground }]}>{prompt}</Text>
        </TouchableOpacity>

        {/* Text area */}
        <TextInput
          ref={inputRef}
          style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="Write freely..."
          placeholderTextColor={`${colors.mutedForeground}70`}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          autoFocus
        />
        <Text style={[styles.charCount, { color: `${colors.mutedForeground}60` }]}>{text.length} chars</Text>

        {/* Optional image */}
        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={[styles.removeImg, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => setImageUri(undefined)}>
              <Feather name="x" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addImageBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
            onPress={pickImage}
          >
            <Feather name="image" size={16} color={colors.mutedForeground} />
            <Text style={[styles.addImageText, { color: colors.mutedForeground }]}>Add a photo (optional)</Text>
          </TouchableOpacity>
        )}

        {/* Mood */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>How are you feeling?</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity key={m.label}
              style={[styles.moodChip, {
                backgroundColor: mood === m.label ? `${m.color}22` : `${m.color}0E`,
                borderColor: mood === m.label ? `${m.color}65` : `${m.color}22`,
                borderWidth: mood === m.label ? 1.5 : 1,
              }]}
              onPress={() => { setMood(m.label); Haptics.selectionAsync(); }}
            >
              <Feather name={m.icon} size={14} color={m.color} />
              <Text style={[styles.moodChipText, { color: m.color }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <View style={[styles.privateNote, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}15` }]}>
          <Feather name="lock" size={12} color={`${colors.primary}70`} />
          <Text style={[styles.privateNoteText, { color: colors.mutedForeground }]}>
            Journal entries are always private — only visible to you.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  privatePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  privatePillText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 18, paddingTop: 4, gap: 0 },
  dateLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginBottom: 10 },
  promptCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  promptText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 19 },
  textArea: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 26, minHeight: 180, marginBottom: 4 },
  charCount: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'right', marginBottom: 14 },
  imagePreviewWrap: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 14, position: 'relative' },
  imagePreview: { width: '100%', height: 200 },
  removeImg: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addImageBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 14, marginBottom: 18 },
  addImageText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  moodChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  privateNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  privateNoteText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18, fontStyle: 'italic' },
});
