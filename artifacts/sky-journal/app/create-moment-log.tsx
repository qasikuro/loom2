import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import React, { useRef, useState } from 'react';
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

import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const MOODS = [
  { label: 'Hopeful',  icon: 'sun'     as const, color: '#C8A84B' },
  { label: 'Lonely',   icon: 'moon'    as const, color: '#7090C0' },
  { label: 'Peaceful', icon: 'cloud'   as const, color: '#78A8C8' },
  { label: 'Dreamy',   icon: 'star'    as const, color: '#8B6BA8' },
  { label: 'Soft',     icon: 'feather' as const, color: '#9888C0' },
  { label: 'Chaotic',  icon: 'zap'     as const, color: '#D0784A' },
  { label: 'Grateful', icon: 'heart'   as const, color: '#C870A0' },
  { label: 'Joyful',   icon: 'smile'   as const, color: '#60A878' },
];

const PROMPTS = [
  'What are you feeling right now?',
  'Something you noticed today that stayed with you...',
  'A thought too small to share, but too real to forget.',
  'If the sky could speak today, what would it say?',
  'What made your heart heavy — or light?',
  'One small, honest thing.',
];

export default function CreateMomentLogScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { addJournalEntry } = useApp();
  const inputRef = useRef<TextInput>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [text, setText] = useState('');
  const [mood, setMood] = useState('Peaceful');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  function handleSave() {
    if (!text.trim()) { setError('Write something — even a single line.'); return; }
    setError(null);
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addJournalEntry({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: 'moment',
      text: text.trim(),
      mood,
    });
    setSaving(false);
    router.back();
  }

  return (
    <View style={styles.container}>
      {/* Night sky background */}
      <LinearGradient colors={['#1A1630', '#231A48', '#1E2848']} style={StyleSheet.absoluteFill} />
      {/* Stars */}
      {[{ t: 70, l: 50, s: 3 }, { t: 110, r: 70, s: 2 }, { t: 50, r: 120, s: 4 },
        { t: 160, l: 100, s: 2 }, { t: 90, r: 40, s: 3 }, { t: 140, l: 40, s: 2 }].map((star, i) => (
        <View key={i} style={[styles.star, {
          top: star.t, left: (star as any).l, right: (star as any).r,
          width: star.s, height: star.s,
          backgroundColor: `rgba(240,210,130,${0.4 + i * 0.07})`,
        }]} />
      ))}

      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <BackButton style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.09)' }]} iconName="x" size={18} color="rgba(240,234,248,0.75)" />
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🌙</Text>
          <Text style={styles.headerTitle}>{t('journal.quickMomentTitle')}</Text>
          <View style={styles.privatePill}>
            <Icon name="lock" size={10} color="rgba(200,184,232,0.7)" />
            <Text style={styles.privatePillText}>{t('common.private')}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? 'rgba(255,255,255,0.08)' : 'rgba(200,184,232,0.22)', borderColor: 'rgba(200,184,232,0.4)', borderWidth: 1 }]}
          onPress={handleSave} disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: saving ? 'rgba(200,184,232,0.4)' : 'rgba(200,184,232,0.9)' }]}>
            {saving ? '...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20} keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Prompt */}
        <TouchableOpacity
          style={[styles.promptCard, { borderColor: 'rgba(200,184,232,0.18)', backgroundColor: 'rgba(200,184,232,0.06)' }]}
          onPress={() => inputRef.current?.focus()}
        >
          <Icon name="feather" size={13} color="rgba(200,184,232,0.5)" />
          <Text style={styles.promptText}>{prompt}</Text>
        </TouchableOpacity>

        {/* Text area */}
        <TextInput
          ref={inputRef}
          style={styles.textArea}
          placeholder="Let it out..."
          placeholderTextColor="rgba(200,184,232,0.28)"
          value={text}
          onChangeText={t => { setText(t); if (error) setError(null); }}
          multiline
          textAlignVertical="top"
          autoFocus
        />
        <Text style={styles.charCount}>{text.length} characters</Text>

        {/* Mood */}
        <Text style={styles.moodLabel}>{t('journal.moodPlaceholder')}</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity key={m.label}
              style={[styles.moodChip, {
                backgroundColor: mood === m.label ? `${m.color}30` : `${m.color}12`,
                borderColor: mood === m.label ? `${m.color}70` : `${m.color}25`,
                borderWidth: mood === m.label ? 1.5 : 1,
              }]}
              onPress={() => { setMood(m.label); Haptics.selectionAsync(); }}
            >
              <Icon name={m.icon} size={14} color={m.color} />
              <Text style={[styles.moodChipText, { color: m.color }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inline validation error */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon name="alert-circle" size={14} color="#F87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.privateNote}>
          <Icon name="lock" size={12} color="rgba(200,184,232,0.4)" />
          <Text style={styles.privateNoteText}>
            Moments are always private — only visible to you.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  star: { position: 'absolute', borderRadius: 99 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.9)' },
  privatePill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(200,184,232,0.1)' },
  privatePillText: { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.7)' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  scroll: { paddingHorizontal: 18, paddingTop: 4 },
  promptCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14 },
  promptText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.55)', lineHeight: 19 },
  textArea: {
    borderWidth: 1, borderRadius: 16, padding: 18,
    fontSize: 17, fontFamily: 'Satoshi-Regular', lineHeight: 28, minHeight: 180,
    fontStyle: 'italic', marginBottom: 6,
    color: 'rgba(240,234,248,0.9)',
    borderColor: 'rgba(200,184,232,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  charCount: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.3)', textAlign: 'right', marginBottom: 18 },
  moodLabel: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.45)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  moodChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  moodChipText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  privateNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, borderColor: 'rgba(200,184,232,0.12)', backgroundColor: 'rgba(200,184,232,0.04)' },
  privateNoteText: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular', lineHeight: 18, fontStyle: 'italic', color: 'rgba(200,184,232,0.45)' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.12)' },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Medium', color: '#F87171' },
});
