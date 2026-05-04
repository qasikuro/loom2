import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
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

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const MOODS = [
  { label: 'Hopeful', icon: 'sun' as const, color: '#C8A84B' },
  { label: 'Lonely', icon: 'moon' as const, color: '#7090C0' },
  { label: 'Peaceful', icon: 'cloud' as const, color: '#78A8C8' },
  { label: 'Romantic', icon: 'heart' as const, color: '#C870A0' },
  { label: 'Dreamy', icon: 'star' as const, color: '#8B6BA8' },
  { label: 'Soft', icon: 'feather' as const, color: '#9888C0' },
  { label: 'Chaotic', icon: 'zap' as const, color: '#D0784A' },
  { label: 'Grateful', icon: 'smile' as const, color: '#60A878' },
];

const PROMPTS = [
  'What are you feeling right now?',
  'Something you noticed today that stayed with you...',
  'A thought too small to share, but too real to forget.',
  'If the sky could speak today, what would it say?',
  'What made your heart heavy — or light?',
];

export default function CreateMomentLogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLog } = useApp();

  const [text, setText] = useState('');
  const [selectedMood, setSelectedMood] = useState('Peaceful');
  const [isPublic, setIsPublic] = useState(false);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const currentMood = MOODS.find(m => m.label === selectedMood);
  const prompt = PROMPTS[new Date().getDay() % PROMPTS.length];

  function handlePost() {
    if (!text.trim()) { Alert.alert('Empty reflection', 'Write something — even a single line.'); return; }
    setPosting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const title = text.trim().split(' ').slice(0, 5).join(' ') + (text.trim().split(' ').length > 5 ? '...' : '');

    addLog({
      id,
      date: new Date().toISOString(),
      chapterTitle: title,
      panels: [{ id: id + '_p', text: text.trim() }],
      mood: selectedMood,
      location: 'Sky',
      isPublic,
      witnessedCount: 0,
      savedCount: 0,
      logType: 'moment',
    });

    setPosting(false);
    router.push('/(tabs)/log');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.night }]}>
      {/* Night sky gradient background */}
      <LinearGradient
        colors={['#1A1630', '#2A1E50', '#1E2E4A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      {/* Decorative stars */}
      {[{ top: 80, left: 40, size: 3 }, { top: 120, right: 60, size: 2 }, { top: 60, right: 100, size: 4 },
        { top: 200, left: 80, size: 2 }, { top: 160, right: 30, size: 3 }].map((s, i) => (
        <View key={i} style={[styles.star, { top: s.top, left: (s as any).left, right: (s as any).right, width: s.size, height: s.size, backgroundColor: `rgba(240,208,128,${0.4 + i * 0.08})` }]} />
      ))}

      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color="rgba(240,234,248,0.8)" />
        </TouchableOpacity>
        <View style={styles.typePill}>
          <Text style={styles.typeEmoji}>🌙</Text>
          <Text style={styles.typeTitle}>Moment Log</Text>
        </View>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: posting ? 'rgba(255,255,255,0.1)' : `${colors.lavender}40`, borderColor: `${colors.lavender}60` }]}
          onPress={handlePost} disabled={posting}
        >
          <Text style={[styles.postBtnText, { color: posting ? 'rgba(240,234,248,0.4)' : colors.lavender }]}>
            {posting ? '...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>

        {/* Prompt */}
        <TouchableOpacity style={[styles.promptCard, { borderColor: 'rgba(200,184,232,0.2)', backgroundColor: 'rgba(200,184,232,0.07)' }]}
          onPress={() => inputRef.current?.focus()}>
          <Feather name="feather" size={14} color="rgba(200,184,232,0.6)" />
          <Text style={styles.promptText}>{prompt}</Text>
        </TouchableOpacity>

        {/* Text area */}
        <TextInput
          ref={inputRef}
          style={[styles.textArea, { color: 'rgba(240,234,248,0.9)', borderColor: 'rgba(200,184,232,0.18)', backgroundColor: 'rgba(255,255,255,0.04)' }]}
          placeholder="Let it out..."
          placeholderTextColor="rgba(200,184,232,0.3)"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          autoFocus
        />
        <Text style={styles.charCount}>{text.length} characters</Text>

        {/* Mood selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How are you feeling?</Text>
          <View style={styles.moodGrid}>
            {MOODS.map(m => (
              <TouchableOpacity key={m.label}
                style={[styles.moodChip, {
                  backgroundColor: selectedMood === m.label ? `${m.color}30` : `${m.color}12`,
                  borderColor: selectedMood === m.label ? `${m.color}70` : `${m.color}25`,
                  borderWidth: selectedMood === m.label ? 1.5 : 1,
                }]}
                onPress={() => { setSelectedMood(m.label); Haptics.selectionAsync(); }}>
                <Feather name={m.icon} size={14} color={m.color} />
                <Text style={[styles.moodChipText, { color: m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Visibility</Text>
          <View style={styles.privacyRow}>
            {(['Private', 'Public'] as const).map(opt => {
              const active = opt === 'Private' ? !isPublic : isPublic;
              return (
                <TouchableOpacity key={opt}
                  style={[styles.privBtn, {
                    backgroundColor: active ? 'rgba(200,184,232,0.15)' : 'rgba(255,255,255,0.05)',
                    borderColor: active ? 'rgba(200,184,232,0.5)' : 'rgba(255,255,255,0.12)',
                    borderWidth: active ? 1.5 : 1,
                  }]}
                  onPress={() => setIsPublic(opt === 'Public')}>
                  <Feather name={opt === 'Private' ? 'lock' : 'globe'} size={13} color={active ? colors.lavender : 'rgba(200,184,232,0.4)'} />
                  <Text style={[styles.privText, { color: active ? colors.lavender : 'rgba(200,184,232,0.5)' }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity style={[styles.submitBtn, { opacity: posting ? 0.7 : 1 }]} onPress={handlePost} disabled={posting}>
          <LinearGradient colors={['#4A3878', '#3A2860', '#2A1840']} style={styles.submitGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Feather name="moon" size={16} color={colors.lavender} />
            <Text style={[styles.submitText, { color: colors.lavender }]}>{posting ? 'Saving...' : 'Save This Moment'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  star: { position: 'absolute', borderRadius: 99 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeEmoji: { fontSize: 18 },
  typeTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: 'rgba(200,184,232,0.9)' },
  postBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  postBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  scroll: { paddingHorizontal: 18, paddingTop: 4, gap: 0 },
  promptCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  promptText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.6)', lineHeight: 20 },
  textArea: { borderWidth: 1, borderRadius: 16, padding: 18, fontSize: 17, fontFamily: 'Inter_400Regular', lineHeight: 28, minHeight: 180, fontStyle: 'italic', marginBottom: 6 },
  charCount: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.35)', textAlign: 'right', marginBottom: 20 },
  section: { marginBottom: 20, gap: 10 },
  sectionLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(200,184,232,0.5)', letterSpacing: 0.4, textTransform: 'uppercase' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  moodChipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  privacyRow: { flexDirection: 'row', gap: 10 },
  privBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  privText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  submitBtn: { borderRadius: 30, overflow: 'hidden', marginBottom: 8 },
  submitGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 30 },
  submitText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
