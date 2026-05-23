import { Icon } from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { persistImageUri } from '@/utils/persistImage';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp, type JournalEntryType } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const MOODS = [
  { label: 'Hopeful',  icon: 'sun'     as const, color: '#C8A84B' },
  { label: 'Peaceful', icon: 'cloud'   as const, color: '#78A8C8' },
  { label: 'Lonely',   icon: 'moon'    as const, color: '#7090C0' },
  { label: 'Grateful', icon: 'heart'   as const, color: '#C870A0' },
  { label: 'Dreamy',   icon: 'star'    as const, color: '#8B6BA8' },
  { label: 'Soft',     icon: 'feather' as const, color: '#9888C0' },
  { label: 'Chaotic',  icon: 'zap'     as const, color: '#D0784A' },
  { label: 'Joyful',   icon: 'smile'   as const, color: '#60A878' },
];

const PROMPTS = [
  'What stayed with you today?',
  'Something small that mattered...',
  'A feeling too real to forget.',
  'If the sky could speak today, what would it say?',
  'What made your heart lighter — or heavier?',
  'One moment you want to remember.',
];

const TYPE_CFG = {
  diary:  { title: 'Journal',      icon: 'feather' as const, accent: '#6B5B95', label: 'Diary Entry',   placeholder: 'Write freely...' },
  friend: { title: 'Friend Log',   icon: 'users'   as const, accent: '#4A6898', label: 'Friend Memory', placeholder: 'What happened with them...' },
  moment: { title: 'Quick Moment', icon: 'moon'    as const, accent: '#5848A8', label: 'Moment',        placeholder: 'Capture this feeling...' },
};

export default function CreateJournalEntryScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t: tr } = useTranslation();
  const { addJournalEntry } = useApp();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();

  const entryType: JournalEntryType =
    typeParam === 'friend' ? 'friend' : typeParam === 'moment' ? 'moment' : 'diary';

  const cfg       = TYPE_CFG[entryType];
  const inputRef  = useRef<TextInput>(null);
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [text,       setText]       = useState('');
  const [friendName, setFriendName] = useState('');
  const [mood,       setMood]       = useState('Peaceful');
  const [imageUri,   setImageUri]   = useState<string | undefined>();
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [fontSize,   setFontSize]   = useState(16);

  const MIN_FONT = 12, MAX_FONT = 28;
  const sizeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (sizeRef.current) clearInterval(sizeRef.current); }, []);

  function holdDecrease() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFontSize(s => Math.max(MIN_FONT, s - 1));
    sizeRef.current = setInterval(() => setFontSize(s => Math.max(MIN_FONT, s - 1)), 80);
  }
  function holdIncrease() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFontSize(s => Math.min(MAX_FONT, s + 1));
    sizeRef.current = setInterval(() => setFontSize(s => Math.min(MAX_FONT, s + 1)), 80);
  }
  function stopSize() {
    if (sizeRef.current) { clearInterval(sizeRef.current); sizeRef.current = null; }
  }

  const today     = new Date();
  const dateLabel = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const dayPrompt = tr(`journal.prompts_${today.getDate() % 6}` as any);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const persisted = await persistImageUri(result.assets[0].uri);
      setImageUri(persisted);
    }
  }

  function handleSave() {
    if (!text.trim()) { setError(tr('journal.writeSomethingFirst')); return; }
    if (entryType === 'friend' && !friendName.trim()) {
      setError(tr('journal.whoWereYouWith')); return;
    }
    setError(null);
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addJournalEntry({
      id:         crypto.randomUUID(),
      date:       new Date().toISOString(),
      type:       entryType,
      text:       text.trim(),
      mood,
      imageUri,
      friendName: entryType === 'friend' ? friendName.trim() : undefined,
    });
    setSaving(false);
    router.back();
  }

  const currentMood = MOODS.find(m => m.label === mood);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#EDE0F8', '#F8F4EE']}
        style={[styles.headerGrad, { height: topPad + 70 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.back()}
        >
          <Icon name="x" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Icon name={cfg.icon} size={14} color={cfg.accent} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              {entryType === 'diary' ? tr('journal.journalTitle') : entryType === 'friend' ? tr('journal.friendTitle') : tr('journal.momentTitle')}
            </Text>
          </View>
          <View style={[styles.privatePill, { backgroundColor: `${colors.primary}12` }]}>
            <Icon name="lock" size={10} color={colors.primary} />
            <Text style={[styles.privatePillText, { color: colors.primary }]}>{tr('journal.private')}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : cfg.accent }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: saving ? colors.mutedForeground : '#fff' }]}>
            {saving ? '...' : tr('journal.save')}
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

        {/* Friend name input (friend type only) */}
        {entryType === 'friend' && (
          <View style={[styles.friendRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Icon name="users" size={15} color="#4A6898" />
            <TextInput
              style={[styles.friendInput, { color: colors.foreground }]}
              placeholder={tr('journal.friendNamePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              value={friendName}
              onChangeText={t => { setFriendName(t); if (error) setError(null); }}
              returnKeyType="next"
              onSubmitEditing={() => inputRef.current?.focus()}
            />
          </View>
        )}

        {/* Prompt */}
        <TouchableOpacity
          style={[styles.promptCard, { backgroundColor: `${cfg.accent}08`, borderColor: `${cfg.accent}18` }]}
          onPress={() => inputRef.current?.focus()}
        >
          <Icon name="feather" size={13} color={`${cfg.accent}80`} />
          <Text style={[styles.promptText, { color: colors.mutedForeground }]}>
            {entryType === 'friend'  ? tr('journal.friendPrompt') :
             entryType === 'moment'  ? tr('journal.momentPrompt') :
             dayPrompt}
          </Text>
        </TouchableOpacity>

        {/* Text area */}
        <TextInput
          ref={inputRef}
          style={[styles.textArea, {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.card,
            fontSize,
            lineHeight: Math.round(fontSize * 1.625),
          }]}
          placeholder={entryType === 'diary' ? tr('journal.placeholder') : entryType === 'friend' ? tr('journal.friendPlaceholder') : tr('journal.momentPlaceholder')}
          placeholderTextColor={`${colors.mutedForeground}70`}
          value={text}
          onChangeText={t => { setText(t); if (error) setError(null); }}
          multiline
          textAlignVertical="top"
          autoFocus={entryType !== 'friend'}
        />

        {/* Font size control */}
        <View style={[styles.sizeBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [styles.sizeSideBtn, pressed && { backgroundColor: `${cfg.accent}14` }]}
            onPressIn={holdDecrease}
            onPressOut={stopSize}
            hitSlop={{ top: 8, bottom: 8, left: 12, right: 6 }}
          >
            <Text style={[styles.sizeASmall, { color: fontSize <= MIN_FONT ? `${colors.mutedForeground}40` : colors.mutedForeground }]}>A</Text>
            <Icon name="minus" size={10} color={fontSize <= MIN_FONT ? `${colors.mutedForeground}40` : colors.mutedForeground} />
          </Pressable>
          <Text style={[styles.sizeCurrent, { color: colors.foreground }]}>{fontSize}</Text>
          <Pressable
            style={({ pressed }) => [styles.sizeSideBtn, pressed && { backgroundColor: `${cfg.accent}14` }]}
            onPressIn={holdIncrease}
            onPressOut={stopSize}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 12 }}
          >
            <Icon name="plus" size={10} color={fontSize >= MAX_FONT ? `${colors.mutedForeground}40` : colors.mutedForeground} />
            <Text style={[styles.sizeALarge, { color: fontSize >= MAX_FONT ? `${colors.mutedForeground}40` : colors.mutedForeground }]}>A</Text>
          </Pressable>
        </View>

        <Text style={[styles.charCount, { color: `${colors.mutedForeground}60` }]}>
          {text.length} chars
        </Text>

        {/* Optional image */}
        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
            <TouchableOpacity
              style={[styles.removeImg, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
              onPress={() => setImageUri(undefined)}
            >
              <Icon name="x" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addImageBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
            onPress={pickImage}
          >
            <Icon name="image" size={16} color={colors.mutedForeground} />
            <Text style={[styles.addImageText, { color: colors.mutedForeground }]}>
              Add a photo (optional)
            </Text>
          </TouchableOpacity>
        )}

        {/* Mood */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>How are you feeling?</Text>
        <View style={styles.moodGrid}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m.label}
              style={[styles.moodChip, {
                backgroundColor: mood === m.label ? `${m.color}22` : `${m.color}0E`,
                borderColor:     mood === m.label ? `${m.color}65` : `${m.color}22`,
                borderWidth:     mood === m.label ? 1.5 : 1,
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
          <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
            <Icon name="alert-circle" size={14} color="#DC2626" />
            <Text style={[styles.errorText, { color: '#DC2626' }]}>{error}</Text>
          </View>
        )}

        {/* Private note */}
        <View style={[styles.privateNote, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}15` }]}>
          <Icon name="lock" size={12} color={`${colors.primary}70`} />
          <Text style={[styles.privateNoteText, { color: colors.mutedForeground }]}>
            Journal entries are always private — only visible to you.
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  headerGrad:     { position: 'absolute', top: 0, left: 0, right: 0 },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter:   { alignItems: 'center', gap: 4 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle:    { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  privatePill:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  privatePillText:{ fontSize: 10, fontFamily: 'Inter_500Medium' },
  saveBtn:        { paddingHorizontal: 22, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  saveBtnText:    { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  scroll:         { paddingHorizontal: 18, paddingTop: 4, gap: 0 },
  dateLabel:      { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginBottom: 10 },
  friendRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  friendInput:    { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  promptCard:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  promptText:     { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 19 },
  textArea:       { borderWidth: 1, borderRadius: 14, padding: 16, fontFamily: 'Inter_400Regular', minHeight: 180, marginBottom: 0 },
  sizeBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 22, paddingVertical: 2, paddingHorizontal: 4, marginTop: 10, marginBottom: 6, alignSelf: 'center' },
  sizeSideBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  sizeASmall:     { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  sizeALarge:     { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sizeCurrent:    { fontSize: 13, fontFamily: 'Inter_600SemiBold', minWidth: 28, textAlign: 'center' },
  charCount:      { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'right', marginBottom: 14 },
  imagePreviewWrap:{ width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 14, position: 'relative' },
  imagePreview:   { width: '100%', height: 200 },
  removeImg:      { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addImageBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 14, marginBottom: 18 },
  addImageText:   { fontSize: 14, fontFamily: 'Inter_400Regular' },
  sectionLabel:   { fontSize: 11, fontFamily: 'Inter_500Medium', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  moodGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  moodChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  moodChipText:   { fontSize: 12, fontFamily: 'Inter_500Medium' },
  privateNote:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  privateNoteText:{ flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 18, fontStyle: 'italic' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  errorText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
});
