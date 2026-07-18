import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { persistImageUri, ImageUploadError } from '@/utils/persistImage';
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
  ScrollView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompletionMoment } from '@/components/CompletionMoment';
import { useApp, type JournalEntryType } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSound } from '@/context/SoundContext';

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

const TYPE_CFG = {
  diary:  { title: 'Journal',      icon: 'feather' as const, accent: '#6B5B95', label: 'Diary Entry',   placeholder: 'Write freely...' },
  friend: { title: 'Friend Log',   icon: 'users'   as const, accent: '#4A6898', label: 'Friend Memory', placeholder: 'What happened with them...' },
  moment: { title: 'Quick Moment', icon: 'moon'    as const, accent: '#5848A8', label: 'Moment',        placeholder: 'Capture this feeling...' },
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function formatFull(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatShort(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const QUICK_OFFSETS = [
  { label: 'Today',       offset: 0 },
  { label: 'Yesterday',   offset: -1 },
  { label: '2 days ago',  offset: -2 },
  { label: '3 days ago',  offset: -3 },
  { label: '4 days ago',  offset: -4 },
  { label: '5 days ago',  offset: -5 },
  { label: '6 days ago',  offset: -6 },
];

export default function CreateJournalEntryScreen() {
  const colors  = useColors();
  const { playSound } = useSound();
  const insets  = useSafeAreaInsets();
  const { t: tr } = useTranslation();
  const { addJournalEntry, character } = useApp();
  const { type: typeParam, initialPrompt, initialMood } = useLocalSearchParams<{ type?: string; initialPrompt?: string; initialMood?: string }>();

  const entryType: JournalEntryType =
    typeParam === 'friend' ? 'friend' : typeParam === 'moment' ? 'moment' : 'diary';

  const cfg       = TYPE_CFG[entryType];
  const inputRef  = useRef<TextInput>(null);
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const today = startOfDay(new Date());

  const validMoods = MOODS.map(m => m.label);
  const resolvedInitialMood = initialMood && validMoods.includes(initialMood) ? initialMood : null;

  const [text,            setText]            = useState(typeof initialPrompt === 'string' ? initialPrompt : '');
  const [friendName,      setFriendName]      = useState('');
  const [mood,            setMood]            = useState(resolvedInitialMood ?? 'Peaceful');
  const [imageUri,        setImageUri]        = useState<string | undefined>();
  const [saving,          setSaving]          = useState(false);
  const [showCompletion,  setShowCompletion]  = useState(false);
  const [uploadingImage,  setUploadingImage]  = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [fontSize,        setFontSize]        = useState(16);
  const [entryDate,       setEntryDate]       = useState<Date>(today);
  const [showDatePicker,  setShowDatePicker]  = useState(false);

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

  function nudgeDate(delta: number) {
    const next = addDays(entryDate, delta);
    if (next > today) return;
    Haptics.selectionAsync();
    setEntryDate(next);
  }

  function pickQuickDate(offset: number) {
    Haptics.selectionAsync();
    setEntryDate(addDays(today, offset));
    setShowDatePicker(false);
  }

  const MOOD_PROMPTS: Record<string, string[]> = {
    Hopeful:     [
      'What are you looking forward to?',
      'What small thing made today feel possible?',
      'Where is your light right now?',
    ],
    Peaceful:    [
      'What brought you stillness today?',
      'Describe a quiet moment you held onto.',
      'What are you grateful for in the silence?',
    ],
    Lonely:      [
      'Who do you wish was here right now?',
      'Write to the version of you that felt less alone.',
      'What would comfort you tonight?',
    ],
    Dreamy:      [
      'Describe a world you visited in your imagination.',
      'What have you been daydreaming about lately?',
      'If today were a chapter, what would it be called?',
    ],
    Chaotic:     [
      'What is spinning the fastest right now?',
      'Write out everything in your head without stopping.',
      'What do you most need to let go of?',
    ],
    Soft:        [
      'What gentle thing happened today?',
      'What are you being tender with?',
      "Describe a small comfort you've found.",
    ],
    Joyful:      [
      'What made you laugh or smile today?',
      'How does this feeling live in your body?',
      'What do you want to remember about right now?',
    ],
    Grateful:    [
      "Write about someone you're quietly thankful for.",
      'What unexpected thing brought you gratitude today?',
      'What would you miss if it were gone?',
    ],
    Romantic:    [
      'Write about longing — for a place, a person, a feeling.',
      'What makes your heart catch?',
      'Describe something beautiful you noticed today.',
    ],
    Adventurous: [
      'What risk are you considering?',
      'Where do you want to go next?',
      "What would you do if you weren't afraid?",
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dayPrompt = tr(`journal.prompts_${today.getDate() % 6}` as any);
  const moodPrompts  = character.mood ? (MOOD_PROMPTS[character.mood] ?? []) : [];
  const moodPrompt   = moodPrompts.length > 0 ? moodPrompts[today.getDate() % moodPrompts.length] : null;
  const activePrompt = entryType === 'diary' && moodPrompt ? moodPrompt : dayPrompt;
  const isMoodPrompt = entryType === 'diary' && !!moodPrompt;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadingImage(true);
      try {
        const persisted = await persistImageUri(result.assets[0].uri);
        setImageUri(persisted);
        setError(null);
      } catch (err: unknown) {
        const msg = err instanceof ImageUploadError ? err.userMessage : 'Photo upload failed — try again.';
        setError(msg);
      } finally {
        setUploadingImage(false);
      }
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
    playSound('save');
    addJournalEntry({
      id:         crypto.randomUUID(),
      date:       entryDate.toISOString(),
      type:       entryType,
      text:       text.trim(),
      mood,
      imageUri,
      friendName: entryType === 'friend' ? friendName.trim() : undefined,
    });
    setSaving(false);
    setShowCompletion(true);
  }

  const isToday     = isSameDay(entryDate, today);
  const isYesterday = isSameDay(entryDate, addDays(today, -1));
  const dateLabel   = isToday
    ? formatFull(entryDate)
    : isYesterday
      ? `Yesterday · ${formatShort(entryDate)}`
      : formatFull(entryDate);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#EDE0F8', '#F8F4EE']}
        style={[styles.headerGrad, { height: topPad + 70 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <BackButton
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
          iconName="x"
          size={18}
          color={colors.foreground}
        />

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
          style={[styles.saveBtn, { backgroundColor: (saving || uploadingImage) ? colors.muted : cfg.accent }]}
          onPress={handleSave}
          disabled={saving || uploadingImage}
        >
          <Text style={[styles.saveBtnText, { color: (saving || uploadingImage) ? colors.mutedForeground : '#fff' }]}>
            {uploadingImage ? '↑' : saving ? '...' : tr('journal.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* ── Date picker row ─────────────────────────────────── */}
        <View style={styles.dateRow}>
          {/* Prev day */}
          <TouchableOpacity
            style={[styles.dateArrow, { opacity: 1 }]}
            onPress={() => nudgeDate(-1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
          >
            <Icon name="chevron-left" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Date label — tap to open picker */}
          <TouchableOpacity
            style={styles.dateLabelBtn}
            onPress={() => { Haptics.selectionAsync(); setShowDatePicker(v => !v); }}
          >
            <Icon name="calendar" size={12} color={`${cfg.accent}90`} />
            <Text style={[styles.dateLabel, { color: isToday ? colors.mutedForeground : cfg.accent }]}>
              {dateLabel}
            </Text>
            <Icon
              name={showDatePicker ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={`${cfg.accent}70`}
            />
          </TouchableOpacity>

          {/* Next day — disabled if already today */}
          <TouchableOpacity
            style={[styles.dateArrow, { opacity: isToday ? 0.25 : 1 }]}
            onPress={() => nudgeDate(+1)}
            disabled={isToday}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 10 }}
          >
            <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Quick-pick chips */}
        {showDatePicker && (
          <View style={[styles.quickPicker, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.quickPickerLabel, { color: `${colors.mutedForeground}80` }]}>
              PICK A DAY
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChips}>
              {QUICK_OFFSETS.map(({ label, offset }) => {
                const d   = addDays(today, offset);
                const sel = isSameDay(entryDate, d);
                return (
                  <TouchableOpacity
                    key={offset}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: sel ? `${cfg.accent}20` : `${colors.muted}`,
                        borderColor:     sel ? `${cfg.accent}60` : colors.border,
                        borderWidth:     sel ? 1.5 : 1,
                      },
                    ]}
                    onPress={() => pickQuickDate(offset)}
                  >
                    <Text style={[styles.quickChipTop, { color: sel ? cfg.accent : colors.foreground }]}>
                      {label}
                    </Text>
                    <Text style={[styles.quickChipSub, { color: colors.mutedForeground }]}>
                      {formatShort(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
          <View style={{ flex: 1 }}>
            <Text style={[styles.promptText, { color: colors.mutedForeground }]}>
              {entryType === 'friend'  ? tr('journal.friendPrompt') :
               entryType === 'moment'  ? tr('journal.momentPrompt') :
               activePrompt}
            </Text>
            {isMoodPrompt && (
              <Text style={[styles.promptMoodLabel, { color: `${cfg.accent}70` }]}>
                · matching your {character.mood} mood
              </Text>
            )}
          </View>
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
      <CompletionMoment visible={showCompletion} variant="journal" onFinish={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  headerGrad:      { position: 'absolute', top: 0, left: 0, right: 0 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn:         { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter:    { alignItems: 'center', gap: 4 },
  headerTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle:     { fontSize: 17, fontFamily: 'Satoshi-Bold' },
  privatePill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  privatePillText: { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  saveBtn:         { paddingHorizontal: 22, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  saveBtnText:     { fontSize: 15, fontFamily: 'Satoshi-Bold' },
  scroll:          { paddingHorizontal: 18, paddingTop: 4, gap: 0 },

  dateRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 4 },
  dateArrow:       { padding: 6 },
  dateLabelBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dateLabel:       { fontSize: 13, fontFamily: 'Satoshi-Medium', fontStyle: 'italic' },

  quickPicker:     { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 },
  quickPickerLabel:{ fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.8, marginBottom: 10 },
  quickChips:      { flexDirection: 'row', gap: 8, paddingRight: 4 },
  quickChip:       { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, minWidth: 90 },
  quickChipTop:    { fontSize: 12, fontFamily: 'Satoshi-Bold', marginBottom: 2 },
  quickChipSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular' },

  friendRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  friendInput:     { flex: 1, fontSize: 15, fontFamily: 'Satoshi-Regular' },
  promptCard:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  promptText:      { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 19 },
  promptMoodLabel: { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 4, fontStyle: 'italic' },
  textArea:        { borderWidth: 1, borderRadius: 14, padding: 16, fontFamily: 'Satoshi-Regular', minHeight: 180, marginBottom: 0 },
  sizeBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 22, paddingVertical: 2, paddingHorizontal: 4, marginTop: 10, marginBottom: 6, alignSelf: 'center' },
  sizeSideBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  sizeASmall:      { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  sizeALarge:      { fontSize: 18, fontFamily: 'Satoshi-Bold' },
  sizeCurrent:     { fontSize: 13, fontFamily: 'Satoshi-Bold', minWidth: 28, textAlign: 'center' },
  charCount:       { fontSize: 11, fontFamily: 'Satoshi-Regular', textAlign: 'right', marginBottom: 14 },
  imagePreviewWrap:{ width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 14, position: 'relative' },
  imagePreview:    { width: '100%', height: 200 },
  removeImg:       { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addImageBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 14, marginBottom: 18 },
  addImageText:    { fontSize: 14, fontFamily: 'Satoshi-Regular' },
  sectionLabel:    { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  moodGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  moodChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  moodChipText:    { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  privateNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  privateNoteText: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular', lineHeight: 18, fontStyle: 'italic' },
  errorBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  errorText:       { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Medium' },
});
