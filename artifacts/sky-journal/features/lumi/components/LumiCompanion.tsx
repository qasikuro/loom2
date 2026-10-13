import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useLumiConversation } from '../hooks/useLumiConversation';
import { LumiMessage, LumiRecType, MAX_MESSAGE } from '../types';
import { RecommendationCard } from './RecommendationCard';
import { LumiSettingsSheet } from './LumiSettingsSheet';
import { Skeleton } from './DiscoveryCards';
import { LumiChatCharacter } from './LumiChatCharacter';
import { GuidedSession, SessionSummary } from './GuidedSession';
import { LumiMoodSession, LumiSessionWelcome, MoodSessionResult } from './LumiMoodSession';
import { LumiChatContext, LumiChatActions } from './LumiChatContext';
import { ActiveSession, ChatCue, LumiMood, SessionMinutes, cueForReply, musicQueryForMood, readChatContext } from '../logic';

const MOOD_CHIPS: LumiMood[] = ['happy', 'calm', 'sad', 'tired', 'stressed', 'lonely', 'excited'];

const QUICK: { type: LumiRecType | 'guided'; icon: IconName }[] = [
  { type: 'music', icon: 'volume-2' },
  { type: 'guides', icon: 'compass' },
  { type: 'outfit', icon: 'layers' },
  { type: 'friends', icon: 'users' },
  { type: 'campfire', icon: 'sunrise' },
  { type: 'journal', icon: 'feather' },
  { type: 'guided', icon: 'clock' },
];

export function LumiCompanion({ userId, name, activeSession, onStartSession, onFinishSession }: {
  userId: string | null | undefined;
  name: string | null;
  /** Account-scoped saved session owned by the drift screen (single source of truth). */
  activeSession: ActiveSession | null;
  onStartSession: (minutes: SessionMinutes) => void;
  onFinishSession: () => void;
}) {
  const c = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  const lumi = useLumiConversation(userId, locale);
  const [text, setText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatFocusTick, setChatFocusTick] = useState(0);
  const [localCue, setLocalCue] = useState<{ n: number; reaction: ChatCue } | null>(null);
  const [sessionOpening, setSessionOpening] = useState<'welcome' | 'checkin' | 'chat'>('welcome');
  const [checkInMood, setCheckInMood] = useState<LumiMood>();
  const [checkInIntent, setCheckInIntent] = useState<MoodSessionResult['intent']>();
  const completingCheckIn = useRef(false);
  const mood = checkInMood ?? lumi.mood;

  // A restored timer must not be replaced by another check-in.
  useEffect(() => {
    if (activeSession) setSessionOpening('chat');
  }, [activeSession]);

  function openCheckIn() {
    completingCheckIn.current = false;
    if (activeSession || lumi.sending || lumi.hydrating || !userId) return;
    setSessionOpening('checkin');
  }

  function stayInChat() {
    setSessionOpening('chat');
    lumi.addLocal({ role: 'note', content: t('lumi.checkin.skipped', 'Of course. Let’s stay here and chat. You can start a mood session later with the Session button.') });
    setLocalCue(c0 => ({ n: (c0?.n ?? 0) + 1, reaction: 'tapAffectionate' }));
  }

  function completeCheckIn(result: MoodSessionResult) {
    if (sessionOpening !== 'checkin' || completingCheckIn.current || lumi.sending || lumi.hydrating || !userId) return;
    completingCheckIn.current = true;
    setCheckInMood(result.mood);
    setCheckInIntent(result.intent);
    setSessionOpening('chat');
    if (result.minutes !== null) startSession(result.minutes);
    // One normal chat message: existing consent, retention, failure and retry
    // rules apply. Nothing is posted, joined or saved elsewhere by the check-in.
    const needs: Record<MoodSessionResult['intent'], string> = {
      company: t('lumi.checkin.need.companyText', 'I would like some company.'),
      quiet: t('lumi.checkin.need.quietText', 'I would like some quiet time.'),
      creative: t('lumi.checkin.need.creativeText', 'I would like to make something.'),
      focus: t('lumi.checkin.need.focusText', 'I would like help focusing on one small goal.'),
      unspecified: t('lumi.checkin.need.chatText', 'I would like to stay here and chat.'),
    };
    lumi.send([
      moodText[result.mood] ?? t('lumi.checkin.neutralText', 'I am not sure how I feel right now.'),
      needs[result.intent],
      result.minutes !== null
        ? t('lumi.checkin.sessionText', 'I chose a {{n}} minute session. Keep any tasks easy and optional, and stay here with me.', { n: result.minutes })
        : t('lumi.checkin.chatText', 'Let’s keep talking here. No timed session for now.'),
    ].join(' '));
  }

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    const who = name ? `, ${name}` : '';
    const opts = [
      t('lumi.greet1', 'Hey{{who}}. How is your day going? Want to talk, make something, or find something fun?', { who }),
      t('lumi.greet2', 'Hi{{who}}. What are you in the mood for right now?', { who }),
      h >= 21 || h < 5
        ? t('lumi.greetNight', 'Evening{{who}}. Something cozy, or just a little chat?', { who })
        : t('lumi.greet3', 'Hello{{who}}. Tell me what you feel like doing and I will help you pick.', { who }),
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, userId]);

  const quickLabel: Record<string, string> = {
    music: t('lumi.q.music', 'Music'), guides: t('lumi.q.guides', 'Guides'), outfit: t('lumi.q.create', 'Create'),
    friends: t('lumi.q.friends', 'Friends'), campfire: t('lumi.q.campfire', 'Campfires'),
    journal: t('lumi.q.journal', 'Journal'), guided: t('lumi.q.guided', 'Guided session'),
  };

  function quick(qt: LumiRecType | 'guided') {
    if (qt === 'guided' && !activeSession) { openCheckIn(); return; }
    setSessionOpening('chat');
    const type: LumiRecType = qt === 'guided' ? 'session' : qt;
    // Local, no AI call: open the real capability card directly.
    const titles: Partial<Record<LumiRecType, string>> = {
      music: t('lumi.qt.music', 'Something to listen to'),
      guides: t('lumi.qt.guides', 'Mentor guides in the community'),
      outfit: t('lumi.qt.outfit', 'Make an outfit'),
      friends: t('lumi.qt.friends', 'Say hi to a friend'),
      campfire: t('lumi.qt.campfire', 'Open campfires'),
      journal: t('lumi.qt.journal', 'A quick journal note'),
      session: t('lumi.qt.session', 'A short game session'),
    };
    lumi.addLocal({
      role: 'note', content: '',
      recommendations: [{
        type, title: titles[type] ?? '', reason: '',
        duration: type === 'session' ? lumi.preferences.duration : undefined,
        query: type === 'music' ? musicQueryForMood(mood, lumi.preferences.musicStyle || 'cozy') : (type === 'guides' ? lumi.preferences.game : undefined),
      }],
    });
  }

  function submit() {
    if (!text.trim() || lumi.sending || lumi.hydrating || !userId) return;
    setSessionOpening('chat');
    lumi.send(text);
    setText('');
  }

  function startSession(minutes: SessionMinutes) {
    if (activeSession) return; // never restart over a running session
    onStartSession(minutes);
    lumi.addLocal({ role: 'note', content: t('lumi.gs.started', 'Started a {{n}} minute guided session. I am still here to chat.', { n: minutes }) });
  }

  function finishSession(sm: SessionSummary) {
    onFinishSession();
    lumi.addLocal({
      role: 'note',
      content: t('lumi.gs.finished', 'Session finished: {{m}} min, {{d}} of {{tot}} ideas ticked.', { m: sm.minutes, d: sm.done, tot: sm.total })
        + (sm.feeling ? ` ${sm.feeling}.` : ''),
    });
    setLocalCue(c0 => ({ n: (c0?.n ?? 0) + 1, reaction: 'celebrate' }));
  }

  function moodReply(m: LumiMood) {
    setCheckInMood(m);
    if (lumi.sending || !userId) return;
    lumi.send(moodText[m] ?? '');
  }

  function wrapUp() {
    lumi.addLocal({ role: 'note', content: t('lumi.wrap', 'Taking a break here. Your chat stays open whenever you want to come back.') });
  }

  const moodText: Partial<Record<LumiMood, string>> = {
    happy: t('lumi.mood.happyText', 'I am feeling pretty good today.'),
    calm: t('lumi.mood.calmText', 'I feel calm right now.'),
    sad: t('lumi.mood.sadText', 'I am feeling sad today.'),
    tired: t('lumi.mood.tiredText', 'I am a bit tired.'),
    stressed: t('lumi.mood.stressedText', 'I feel a little stressed.'),
    lonely: t('lumi.mood.lonelyText', 'I feel a bit lonely today.'),
    excited: t('lumi.mood.excitedText', 'I am excited and full of energy.'),
  };
  const moodLabel: Partial<Record<LumiMood, string>> = {
    happy: t('lumi.mood.happy', 'Good'), calm: t('lumi.mood.calm', 'Calm'), sad: t('lumi.mood.sad', 'Sad'), tired: t('lumi.mood.tired', 'Tired'),
    stressed: t('lumi.mood.stressed', 'Stressed'), lonely: t('lumi.mood.lonely', 'Lonely'), excited: t('lumi.mood.excited', 'Excited'),
  };
  const lastMsg = lumi.messages[lumi.messages.length - 1];
  const userSpoke = lumi.messages.some(m => m.role === 'user');
  const showMoods = sessionOpening === 'chat' && !lumi.sending && !!userId && (!userSpoke || (lastMsg?.role === 'assistant' && lastMsg.phase === 'check_in'));
  // One cue stream for the single chat character: replies/errors from the hook, celebrations locally.
  const lastReply = lumi.lastReply;
  useEffect(() => {
    if (!lastReply) return;
    const reaction: ChatCue = lastReply.error ? 'tapShy' : cueForReply(lastReply.meta);
    if (lastReply.meta.mood && lastReply.meta.mood !== 'unknown') setCheckInMood(undefined);
    if (lastReply.meta.intent && lastReply.meta.intent !== 'unspecified') setCheckInIntent(undefined);
    setLocalCue(c0 => ({ n: (c0?.n ?? 0) + 1, reaction }));
  }, [lastReply]);
  const cue = localCue;
  const chatActions = useMemo<LumiChatActions>(() => ({
    ask: (q: string) => { if (!lumi.sending) { setSessionOpening('chat'); lumi.send(q); } },
    mood,
    activeSession,
    startSession,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lumi.send, lumi.sending, mood, activeSession]);
  const compact = lumi.messages.length > 0;
  const character = <LumiChatCharacter size={compact ? 40 : 96} thinking={lumi.sending} cue={cue} />;
  const data = useMemo(() => [...lumi.messages].reverse(), [lumi.messages]);
  const bg: readonly [string, string] = isDark ? [c.night, c.background] : [c.background, c.card];
  const sessionPrompt = !activeSession && !lumi.hydrating && !lumi.hydrateError && userId ? (
    sessionOpening === 'welcome'
      ? <LumiSessionWelcome name={name} onStart={openCheckIn} onSkip={stayInChat} />
      : sessionOpening === 'checkin'
        ? <LumiMoodSession onComplete={completeCheckIn} onCancel={stayInChat} />
        : null
  ) : null;

  const header = (
    <View style={s.hero}>
      {!compact && character}
      {sessionOpening === 'chat' && !compact && <View style={[s.bubble, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[s.bubbleText, { color: c.foreground }]}>{greeting}</Text>
      </View>}
      {showMoods && !userSpoke && <MoodChips />}
    </View>
  );

  function MoodChips() {
    return (
      <View style={s.moods}>
        <Text style={[s.meta, { color: c.mutedForeground, width: '100%', textAlign: 'center' }]}>
          {t('lumi.mood.ask', 'If you like, tell me how you feel. You can also just ask for something.')}
        </Text>
        {MOOD_CHIPS.map(m => (
          <TouchableOpacity key={m} onPress={() => moodReply(m)} style={[s.chip, { borderColor: c.border, backgroundColor: c.card }]} accessibilityRole="button">
            <Text style={[s.chipText, { color: c.foreground }]}>{moodLabel[m]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <LumiChatContext.Provider value={chatActions}>
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={bg} style={StyleSheet.absoluteFill} />
      <View style={[s.top, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {compact && <View style={{ width: 40, height: 40 }}>{character}</View>}
          <Text style={[s.brand, { color: c.foreground }]}>Lumi</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {lumi.messages.length > 0 && (
            <TouchableOpacity onPress={wrapUp} style={[s.iconBtn, { borderColor: c.border }]} accessibilityLabel={t('lumi.wrapA11y', 'Wrap up')}>
              <Icon name="moon" size={16} color={c.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setSettingsOpen(true)} style={[s.iconBtn, { borderColor: c.border }]} accessibilityLabel={t('lumi.settings', 'Lumi and your privacy')}>
            <Icon name="shield" size={16} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        {lumi.hydrating ? (
          <View style={{ padding: 20, gap: 14 }}>{header}<Skeleton c={c} rows={3} /></View>
        ) : lumi.hydrateError ? (
          <View style={{ padding: 20, gap: 14, flex: 1 }}>
            {header}
            <View style={[s.err, { borderColor: c.border, backgroundColor: c.card }]}>
              <Text style={[s.msgText, { color: c.text }]}>{t('lumi.hydrateError', 'Lumi could not load right now.')}</Text>
              <TouchableOpacity onPress={() => { void lumi.rehydrate(); }} style={[s.chip, { borderColor: c.tint }]}>
                <Text style={[s.chipText, { color: c.tint }]}>{t('lumi.retry', 'Try again')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            inverted
            data={data}
            keyExtractor={m => m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            ListFooterComponent={header}
            ListHeaderComponent={<View style={{ gap: 12 }}>{sessionPrompt}{lumi.sending ? (
              <View style={[s.typing, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[s.meta, { color: c.mutedForeground }]}>{t('lumi.thinking', 'Lumi is thinking...')}</Text>
              </View>
            ) : (showMoods && userSpoke ? <MoodChips /> : null)}</View>}
            renderItem={({ item }) => (
              <MessageRow m={item} c={c} onRetry={lumi.retry} onFeedback={lumi.setFeedback} onSession={startSession} onCheckIn={openCheckIn} />
            )}
          />
        )}

        {activeSession && (
          <GuidedSession session={activeSession} mood={mood}
            chatFocusTick={chatFocusTick}
            context={readChatContext(lumi.messages.filter(m => m.role === 'user').map(m => m.content), checkInIntent ?? lumi.lastReply?.meta.intent)}
            onFinish={finishSession}
            onShare={txt => { if (!lumi.sending) lumi.send(txt); }} />
        )}
        <View style={[s.dock, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 8) }]}>
          <FlatList
            horizontal
            data={QUICK}
            keyExtractor={q => q.type}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => quick(item.type)} style={[s.chip, { borderColor: c.border, backgroundColor: c.card }]}>
                <Icon name={item.icon} size={13} color={c.tint} />
                <Text style={[s.chipText, { color: c.foreground }]}>{quickLabel[item.type]}</Text>
              </TouchableOpacity>
            )}
          />
          <View style={[s.inputRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <TextInput
              value={text}
              onFocus={() => setChatFocusTick(n => n + 1)}
              onChangeText={v => setText(v.slice(0, MAX_MESSAGE))}
              placeholder={t('lumi.placeholder', 'Tell Lumi what you feel like...')}
              placeholderTextColor={c.mutedForeground}
              style={[s.input, { color: c.foreground }]}
              multiline
              maxLength={MAX_MESSAGE}
              editable={!!userId}
              onSubmitEditing={submit}
            />
            <TouchableOpacity onPress={submit} disabled={!text.trim() || lumi.sending}
              style={[s.send, { backgroundColor: c.secondary, opacity: !text.trim() || lumi.sending ? 0.45 : 1 }]}
              accessibilityLabel={t('lumi.send', 'Send to Lumi')}>
              <Icon name="send" size={16} color={c.secondaryForeground} />
            </TouchableOpacity>
          </View>
          {text.length > MAX_MESSAGE - 100 && (
            <Text style={[s.meta, { color: c.mutedForeground, textAlign: 'right', paddingHorizontal: 20 }]}>{text.length}/{MAX_MESSAGE}</Text>
          )}
        </View>
      </KeyboardAvoidingView>

      <LumiSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        remember={lumi.remember}
        preferences={lumi.preferences}
        saving={lumi.savingSettings}
        onSave={lumi.saveSettings}
        onClear={async () => {
          const cleared = await lumi.clearHistory();
          if (cleared) {
            setCheckInMood(undefined);
            setCheckInIntent(undefined);
            completingCheckIn.current = false;
            setSessionOpening(activeSession ? 'chat' : 'welcome');
          }
          return cleared;
        }}
      />
    </View>
    </LumiChatContext.Provider>
  );
}

function MessageRow({ m, c, onRetry, onFeedback, onSession, onCheckIn }: {
  m: LumiMessage;
  c: ReturnType<typeof useColors>;
  onRetry: (id: string) => void;
  onFeedback: (id: string, fb: 'up' | 'down') => void;
  onSession: (minutes: 5 | 15 | 30) => void;
  onCheckIn: () => void;
}) {
  const { t } = useTranslation();
  const mine = m.role === 'user';
  return (
    <View style={{ marginBottom: 12, alignItems: mine ? 'flex-end' : 'stretch' }}>
      {!!m.content && (
        <View style={[
          s.msg,
          mine
            ? { backgroundColor: c.secondary, alignSelf: 'flex-end', borderBottomRightRadius: 6 }
            : m.role === 'note'
              ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignSelf: 'center' }
              : { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
        ]}>
          <Text style={[s.msgText, { color: mine ? c.secondaryForeground : c.foreground }]}>{m.content}</Text>
        </View>
      )}
      {mine && m.status === 'failed' && (
        <TouchableOpacity onPress={() => onRetry(m.id)} style={s.failRow} accessibilityRole="button">
          <Icon name="alert-circle" size={12} color={c.destructive} />
          <Text style={[s.meta, { color: c.destructive }]}>{t('lumi.notDelivered', 'Lumi did not get this. Tap to retry.')}</Text>
        </TouchableOpacity>
      )}
      {m.role === 'assistant' && m.fallback && (
        <Text style={[s.meta, { color: c.mutedForeground, marginTop: 4 }]}>{t('lumi.fallback', 'Lumi is in simple mode right now, so replies may be shorter.')}</Text>
      )}
      {m.recommendations?.map((r, i) => (
        <RecommendationCard key={`${m.id}-${i}`} rec={r} onStartSession={onSession} onCheckIn={onCheckIn} />
      ))}
      {m.role === 'assistant' && !!m.recommendations?.length && (
        <View style={s.fbRow}>
          <Text style={[s.meta, { color: c.mutedForeground }]}>{t('lumi.fbAsk', 'Helpful?')}</Text>
          {(['up', 'down'] as const).map(fb => (
            <TouchableOpacity key={fb} onPress={() => onFeedback(m.id, fb)}
              style={[s.fb, { borderColor: m.feedback === fb ? c.tint : c.border }]}>
              <Text style={[s.meta, { color: m.feedback === fb ? c.tint : c.text }]}>
                {fb === 'up' ? t('lumi.fbUp', 'Yes') : t('lumi.fbDown', 'Not quite')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 6 },
  brand: { fontFamily: 'Satoshi-Bold', fontSize: 22, letterSpacing: -0.4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 14, paddingTop: 18, paddingBottom: 20 },
  bubble: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 320 },
  bubbleText: { fontFamily: 'Satoshi-Medium', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  moods: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 340, alignSelf: 'center', marginBottom: 8 },
  msg: { maxWidth: '86%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  msgText: { fontFamily: 'Satoshi-Regular', fontSize: 14.5, lineHeight: 21 },
  meta: { fontFamily: 'Satoshi-Regular', fontSize: 11.5 },
  failRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  typing: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  fbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  fb: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  err: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10, alignItems: 'flex-start' },
  dock: { paddingTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginHorizontal: 14, borderWidth: 1, borderRadius: 24, paddingLeft: 14, paddingRight: 5, paddingVertical: 5 },
  input: { flex: 1, fontFamily: 'Satoshi-Regular', fontSize: 15, maxHeight: 110, paddingVertical: 8 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
