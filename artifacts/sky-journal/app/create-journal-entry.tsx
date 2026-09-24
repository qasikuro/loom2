import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { ResumeDraftBanner } from '@/components/ResumeDraftBanner';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { persistImageUri, ImageUploadError } from '@/utils/persistImage';
import { journalDraft } from '@/utils/entryDraftStore';
import { useJournalDraftLoader } from '@/hooks/useJournalDraftLoader';
import { useLocalSearchParams } from 'expo-router';
import { safeBack } from '@/utils/navigation';
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
  useWindowDimensions,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CompletionMoment } from '@/components/CompletionMoment';
import { useApp, type JournalEntryType } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useSound } from '@/context/SoundContext';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import { SkyLoadingMark } from '@/components/SkyLoading';

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

function formatFull(d: Date, locale?: string) {
  return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatShort(d: Date, locale?: string) {
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
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
  const { width: windowWidth } = useWindowDimensions();
  const { t: tr, i18n } = useTranslation();
  const { addJournalEntry, character } = useApp();
  const { type: typeParam, initialPrompt, initialMood } = useLocalSearchParams<{ type?: string; initialPrompt?: string; initialMood?: string }>();

  const entryType: JournalEntryType =
    typeParam === 'friend' ? 'friend' : typeParam === 'moment' ? 'moment' : 'diary';

  const cfg       = TYPE_CFG[entryType];
  const inputRef  = useRef<TextInput>(null);
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;
  const contentWidth = Math.min(windowWidth, 720);

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

  // ── Draft auto-save ────────────────────────────────────────────────────────
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the screen was launched with pre-filled content (initialPrompt),
  // suppress the restore banner — restoring would silently overwrite the prompt.
  const hasPrefilledContent = typeof initialPrompt === 'string' && initialPrompt.trim().length > 0;

  // Load any saved draft when the screen opens (skipped when hasPrefilledContent).
  const [pendingDraft, setPendingDraft] = useJournalDraftLoader(entryType, hasPrefilledContent);

  // Debounced auto-save whenever content changes
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    // Don't persist an empty draft
    if (!text.trim() && !friendName.trim()) return;
    draftTimerRef.current = setTimeout(() => {
      journalDraft.save(entryType, {
        text, friendName, mood,
        entryDate: entryDate.toISOString(),
        imageUri, fontSize,
      });
    }, 800);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, friendName, mood, entryDate, imageUri, fontSize]);

  // Capture the mood that was in effect when the screen opened so that a
  // pre-filled initialMood param counts as the baseline, not a dirty change.
  const [moodBaseline] = useState(resolvedInitialMood ?? 'Peaceful');
  const isDirty =
    !!(text.trim() || imageUri || (entryType === 'friend' && friendName.trim()))
    || mood !== moodBaseline
    || !isSameDay(entryDate, today);
  const markSaved = useNavigationGuard(isDirty, () => journalDraft.clear(entryType));

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
  const moodPrompt   = moodPrompts.length > 0
    ? i18n.resolvedLanguage?.split('-')[0] === 'en'
      ? moodPrompts[today.getDate() % moodPrompts.length]
      : tr(`journal.prompts_${today.getDate() % 6}` as any)
    : null;
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
    journalDraft.clear(entryType);
    setSaving(false);
    setShowCompletion(true);
  }

  const isToday     = isSameDay(entryDate, today);
  const isYesterday = isSameDay(entryDate, addDays(today, -1));
  const dateLabel   = isToday
    ? formatFull(entryDate, i18n.resolvedLanguage)
    : isYesterday
      ? `${tr('common.yesterday')} · ${formatShort(entryDate, i18n.resolvedLanguage)}`
      : formatFull(entryDate, i18n.resolvedLanguage);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.background, colors.background]}
        style={[styles.headerGrad, { height: topPad + 76 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, maxWidth: 800, width: '100%', alignSelf: 'center' }]}>
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
          <View style={[styles.privatePill, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}24` }]}>
            <Icon name="lock" size={10} color={colors.primary} />
            <Text style={[styles.privatePillText, { color: colors.primary }]}>{tr('journal.private')}</Text>
          </View>
        </View>

        <View style={styles.headerBalance} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
         contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad, width: contentWidth, maxWidth: '100%', alignSelf: 'center' }]}
      >
        {/* ── Resume draft banner ─────────────────────────────── */}
        {pendingDraft && (
          <ResumeDraftBanner
            savedAt={pendingDraft.savedAt}
            accentColor={cfg.accent}
            onResume={() => {
              setText(pendingDraft.text);
              setFriendName(pendingDraft.friendName);
              setMood(pendingDraft.mood);
              if (pendingDraft.entryDate) setEntryDate(new Date(pendingDraft.entryDate));
              if (pendingDraft.imageUri)  setImageUri(pendingDraft.imageUri);
              if (pendingDraft.fontSize)  setFontSize(pendingDraft.fontSize);
              setPendingDraft(null);
            }}
            onDiscard={() => {
              journalDraft.clear(entryType);
              setPendingDraft(null);
            }}
          />
        )}

        {/* ── Date picker row ─────────────────────────────────── */}
        <View style={[styles.dateRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              {tr('feature.journal.pickDay')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChips}>
              {QUICK_OFFSETS.map(({ offset }) => {
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
                      {offset === 0 ? tr('common.today') : offset === -1 ? tr('common.yesterday') : tr('feature.journal.daysAgo', { n: Math.abs(offset) })}
                    </Text>
                    <Text style={[styles.quickChipSub, { color: colors.mutedForeground }]}>
                      {formatShort(d, i18n.resolvedLanguage)}
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
          style={[styles.promptCard, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}20` }]}
          onPress={() => inputRef.current?.focus()}
        >
          <View style={[styles.promptIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Icon name="feather" size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.promptText, { color: colors.foreground }]}>
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

        {/* Writing area */}
        <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: text.length > 0 ? `${colors.primary}90` : colors.border }]}>
          <TextInput
            ref={inputRef}
            style={[styles.textArea, {
              color: colors.foreground,
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
          <View style={styles.editorTools}>
            <View style={[styles.sizeBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Pressable
                style={({ pressed }) => [styles.sizeSideBtn, pressed && { backgroundColor: `${cfg.accent}14` }]}
                onPressIn={holdDecrease}
                onPressOut={stopSize}
              >
                <Text style={[styles.sizeASmall, { color: fontSize <= MIN_FONT ? `${colors.mutedForeground}40` : colors.mutedForeground }]}>A−</Text>
              </Pressable>
              <Text style={[styles.sizeCurrent, { color: colors.foreground }]}>{fontSize}</Text>
              <Pressable
                style={({ pressed }) => [styles.sizeSideBtn, pressed && { backgroundColor: `${cfg.accent}14` }]}
                onPressIn={holdIncrease}
                onPressOut={stopSize}
              >
                <Text style={[styles.sizeALarge, { color: fontSize >= MAX_FONT ? `${colors.mutedForeground}40` : colors.mutedForeground }]}>+A</Text>
              </Pressable>
            </View>
            <Text style={[styles.charCount, { color: `${colors.mutedForeground}80` }]}>{tr('feature.journal.chars', { n: text.length })}</Text>
          </View>
        </View>

        {/* Optional image */}
        {imageUri ? (
          <View style={styles.imagePreviewWrap}>
             <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="contain" />
            <TouchableOpacity
              style={[styles.removeImg, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
              onPress={() => setImageUri(undefined)}
            >
              <Icon name="x" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addImageBtn, { borderColor: `${colors.primary}38`, backgroundColor: `${colors.primary}08` }]}
            onPress={pickImage}
          >
            <View style={[styles.addImageIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Icon name="image" size={21} color={colors.primary} />
            </View>
            <Text style={[styles.addImageText, { color: colors.mutedForeground }]}>
              {tr('journal.addPhoto')}
            </Text>
            <Text style={[styles.addImageHint, { color: `${colors.mutedForeground}9A` }]}>{tr('feature.journal.addImageHint')}</Text>
          </TouchableOpacity>
        )}

        {/* Mood */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{tr('feature.journal.howFeeling')}</Text>
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
              <Text style={[styles.moodChipText, { color: m.color }]}>{tr(`moods.${m.label}`)}</Text>
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

        <TouchableOpacity
          style={[styles.saveBtn, { opacity: (saving || uploadingImage) ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving || uploadingImage}
          activeOpacity={0.86}
        >
          <LinearGradient colors={[colors.primary, '#B66EF4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          {(saving || uploadingImage) ? <SkyLoadingMark size={17} color="#fff" /> : <Icon name="lock" size={15} color="#fff" />}
          <Text style={styles.saveBtnText}>
            {uploadingImage ? tr('common.uploading') : saving ? tr('common.loading') : tr('journal.save')}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      <CompletionMoment visible={showCompletion} variant="journal" onFinish={() => { markSaved(); safeBack(); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  headerGrad:      { position: 'absolute', top: 0, left: 0, right: 0 },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14 },
  iconBtn:         { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerCenter:    { alignItems: 'center', gap: 4, minWidth: 0, flexShrink: 1 },
  headerBalance:   { width: 38, height: 38 },
  headerTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle:     { fontSize: 17, fontFamily: 'Satoshi-Bold', flexShrink: 1 },
  privatePill:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  privatePillText: { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  saveBtn:         { height: 58, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 4 },
  saveBtnText:     { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff' },
  scroll:          { paddingHorizontal: 18, paddingTop: 8, gap: 0 },

  dateRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 4, borderWidth: 1, borderRadius: 16, paddingVertical: 5 },
  dateArrow:       { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  dateLabelBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dateLabel:       { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  quickPicker:     { borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14 },
  quickPickerLabel:{ fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.8, marginBottom: 10 },
  quickChips:      { flexDirection: 'row', gap: 8, paddingRight: 4 },
  quickChip:       { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, minWidth: 90 },
  quickChipTop:    { fontSize: 12, fontFamily: 'Satoshi-Bold', marginBottom: 2 },
  quickChipSub:    { fontSize: 11, fontFamily: 'Satoshi-Regular' },

  friendRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  friendInput:     { flex: 1, fontSize: 15, fontFamily: 'Satoshi-Regular' },
  promptCard:      { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  promptIcon:      { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  promptText:      { fontSize: 14, fontFamily: 'Satoshi-Medium', lineHeight: 20 },
  promptMoodLabel: { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 3 },
  editorCard:      { borderWidth: 1.5, borderRadius: 18, overflow: 'hidden', marginBottom: 14 },
  textArea:        { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 8, fontFamily: 'Satoshi-Regular', minHeight: 180 },
  editorTools:     { minHeight: 48, paddingHorizontal: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sizeBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 20, paddingVertical: 2, paddingHorizontal: 3 },
  sizeSideBtn:     { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  sizeASmall:      { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  sizeALarge:      { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  sizeCurrent:     { fontSize: 13, fontFamily: 'Satoshi-Bold', minWidth: 28, textAlign: 'center' },
  charCount:       { fontSize: 11, fontFamily: 'Satoshi-Regular', textAlign: 'right' },
  imagePreviewWrap:{ width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 14, position: 'relative' },
  imagePreview:    { width: '100%', height: 200 },
  removeImg:       { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addImageBtn:     { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 17, marginBottom: 20 },
  addImageIcon:    { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  addImageText:    { fontSize: 14, fontFamily: 'Satoshi-Medium' },
  addImageHint:    { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 4, textAlign: 'center' },
  sectionLabel:    { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  moodGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  moodChip:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, minWidth: 96, flexGrow: 1 },
  moodChipText:    { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  privateNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  privateNoteText: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular', lineHeight: 18, fontStyle: 'italic' },
  errorBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4 },
  errorText:       { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Medium' },
});
