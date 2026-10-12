import React, { useMemo, useState } from 'react';
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

export type LumiFace = 'neutral' | 'happy' | 'focused' | 'proud' | 'sleepy' | 'excited';

const QUICK: { type: LumiRecType | 'guided'; icon: IconName }[] = [
  { type: 'music', icon: 'volume-2' },
  { type: 'guides', icon: 'compass' },
  { type: 'outfit', icon: 'layers' },
  { type: 'friends', icon: 'users' },
  { type: 'campfire', icon: 'sunrise' },
  { type: 'journal', icon: 'feather' },
  { type: 'guided', icon: 'clock' },
];

export function LumiCompanion({ userId, name, renderCharacter, hasActiveSession, onResumeSession, onQuickStart, onCheckIn }: {
  userId: string | null | undefined;
  name: string | null;
  renderCharacter: (size: number, emotion: LumiFace) => React.ReactNode;
  hasActiveSession: boolean;
  onResumeSession: () => void;
  onQuickStart: (minutes: 5 | 15 | 30) => void;
  onCheckIn: () => void;
}) {
  const c = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
  const lumi = useLumiConversation(userId, locale);
  const [text, setText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        query: type === 'music' ? (lumi.preferences.musicStyle || 'cozy') : (type === 'guides' ? lumi.preferences.game : undefined),
      }],
    });
  }

  function submit() {
    if (!text.trim() || lumi.sending) return;
    lumi.send(text);
    setText('');
  }

  function wrapUp() {
    lumi.addLocal({ role: 'note', content: t('lumi.wrap', 'Taking a break here. Your chat stays open whenever you want to come back.') });
  }

  const face: LumiFace = lumi.sending ? 'focused' : lumi.messages.length ? 'happy' : 'neutral';
  const data = useMemo(() => [...lumi.messages].reverse(), [lumi.messages]);
  const bg: readonly [string, string] = isDark ? [c.night, c.background] : [c.background, c.card];

  const header = (
    <View style={s.hero}>
      {renderCharacter(lumi.messages.length ? 56 : 92, face)}
      <View style={[s.bubble, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[s.bubbleText, { color: c.foreground }]}>{greeting}</Text>
      </View>
      {hasActiveSession && (
        <TouchableOpacity onPress={onResumeSession} style={[s.resume, { backgroundColor: c.glowGold, borderColor: c.gold }]}>
          <Icon name="play" size={13} color={c.gold} />
          <Text style={[s.resumeText, { color: c.foreground }]}>{t('lumi.resume', 'Resume your guided session')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={bg} style={StyleSheet.absoluteFill} />
      <View style={[s.top, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
        <Text style={[s.brand, { color: c.foreground }]}>Lumi</Text>
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
            ListHeaderComponent={lumi.sending ? (
              <View style={[s.typing, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[s.meta, { color: c.mutedForeground }]}>{t('lumi.thinking', 'Lumi is thinking...')}</Text>
              </View>
            ) : null}
            renderItem={({ item }) => (
              <MessageRow m={item} c={c} onRetry={lumi.retry} onFeedback={lumi.setFeedback} onSession={onQuickStart} onCheckIn={onCheckIn} />
            )}
          />
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
        onClear={lumi.clearHistory}
      />
    </View>
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
  resume: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  resumeText: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
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
