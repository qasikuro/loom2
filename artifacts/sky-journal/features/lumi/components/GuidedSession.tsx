import React, { useEffect, useState } from 'react';
import { AppState, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { ActiveSession, ChatContext, LumiMood, SessionIdea, formatClock, sessionIdeas, sessionProgress } from '../logic';

type Activity = SessionIdea;
const FEELINGS = ['fun', 'relaxing', 'okay', 'hard'] as const;
const IDEA_ICON: Record<Activity, IconName> = {
  pick: 'gamepad-2', water: 'droplet', stretch: 'sun', hello: 'users', enjoy: 'star',
  breathe: 'wind', quietSpot: 'moon', create: 'edit-2', goal: 'flag', music: 'volume-2',
};
const FEEL_ICON: Record<string, IconName> = { fun: 'smile', relaxing: 'feather', okay: 'circle', hard: 'cloud' };

export interface SessionSummary { minutes: number; done: number; total: number; feeling?: string; note?: string }

/** Inline guided session docked in the Lumi chat. Timer state lives in the parent (drift saved session). */
export function GuidedSession({ session, mood, context, onFinish, onShare, onOpenDetailed, chatFocusTick = 0 }: {
  session: ActiveSession;
  mood?: LumiMood;
  context: ChatContext;
  onFinish: (summary: SessionSummary) => void;
  onShare: (text: string) => void;
  onOpenDetailed?: () => void;
  chatFocusTick?: number;
}) {
  const c = useColors();
  const { t } = useTranslation();
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [checked, setChecked] = useState<Activity[]>([]);
  // Ideas are chosen once per session so ticks never shift when the chat moves on.
  const [ideas, setIdeas] = useState<Activity[]>(() => sessionIdeas(mood, context));
  const [reflecting, setReflecting] = useState(false);
  const [feeling, setFeeling] = useState<string | undefined>();
  const [note, setNote] = useState('');

  // Reset local checklist when a different session starts.
  useEffect(() => { setIdeas(sessionIdeas(mood, context)); setChecked([]); setReflecting(false); setFeeling(undefined); setNote(''); setOpen(false); setMinimized(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.start]);

  useEffect(() => {
    if (chatFocusTick > 0) setMinimized(true);
  }, [chatFocusTick]);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const run = () => { if (!id) id = setInterval(() => setNow(Date.now()), 1000); setNow(Date.now()); };
    const halt = () => { if (id) clearInterval(id); id = null; };
    run();
    const sub = AppState.addEventListener('change', st => (st === 'active' ? run() : halt()));
    return () => { halt(); sub.remove(); };
  }, []);

  const p = sessionProgress(session, now);
  const expanded = !minimized && (open || p.done || reflecting);
  const minutes = Math.round(session.duration / 60);
  const label: Record<Activity, string> = {
    pick: t('lumi.gs.pick', 'Pick one small thing to try in your game'),
    water: t('lumi.gs.water', 'Have some water'),
    stretch: t('lumi.gs.stretch', 'Stretch your hands and shoulders'),
    hello: t('lumi.gs.hello', 'Say hi to a friend or in a Campfire'),
    enjoy: t('lumi.gs.enjoy', 'Notice one thing you enjoyed'),
    breathe: t('lumi.gs.breathe', 'Take three slow breaths'),
    quietSpot: t('lumi.gs.quietSpot', 'Find a calm corner of your game to just hang out'),
    create: t('lumi.gs.create', 'Sketch an outfit or a journal line about it'),
    goal: t('lumi.gs.goal', 'Choose one goal for this session'),
    music: t('lumi.gs.music', 'Put on some soft music'),
  };
  const feel: Record<string, string> = {
    fun: t('lumi.gs.fun', 'Fun'), relaxing: t('lumi.gs.relaxing', 'Relaxing'),
    okay: t('lumi.gs.okay', 'Just okay'), hard: t('lumi.gs.hard', 'A bit hard'),
  };
  const toggle = (a: Activity) => setChecked(cs => (cs.includes(a) ? cs.filter(x => x !== a) : [...cs, a]));
  const summary = (): SessionSummary => ({ minutes: Math.max(1, Math.round(p.elapsed / 60)), done: checked.length, total: ideas.length, feeling: feeling ? feel[feeling] : undefined, note: note.trim() || undefined });

  return (
    <View style={[s.wrap, { backgroundColor: c.card, borderColor: p.done ? c.gold : c.border }]} testID="lumi-guided-session">
      <TouchableOpacity onPress={() => {
        if (expanded) { setMinimized(true); setOpen(false); }
        else { Keyboard.dismiss(); setMinimized(false); setOpen(true); }
      }} style={s.head} accessibilityRole="button" accessibilityState={{ expanded }}
        accessibilityLabel={t('lumi.gs.toggle', 'Show guided session')}>
        <View style={[s.ring, { borderColor: c.glowGold }]}>
          <Icon name={p.done ? 'check' : 'clock'} size={14} color={c.gold} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.title, { color: c.foreground }]} numberOfLines={1}>
            {p.done ? t('lumi.gs.timeUp', 'Time is up. How did it go?') : t('lumi.gs.running', 'Guided session · {{n}} min', { n: minutes })}
          </Text>
          <View style={[s.track, { backgroundColor: c.muted }]}>
            <View style={[s.fill, { backgroundColor: c.gold, width: `${Math.round(Math.max(0.02, p.ratio) * 100)}%` }]} />
          </View>
        </View>
        <Text style={[s.clock, { color: c.foreground }]}>{formatClock(p.remaining)}</Text>
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={15} color={c.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 4 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {!reflecting && (
        <View style={{ gap: 6, marginTop: 10 }}>
          <Text style={[s.meta, { color: c.mutedForeground }]}>{t('lumi.gs.optional', 'Optional ideas. Tick what you did, skip the rest.')}</Text>
          {ideas.map(a => {
            const on = checked.includes(a);
            return (
              <TouchableOpacity key={a} onPress={() => toggle(a)} style={s.item} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={[s.medal, { borderColor: on ? c.tint : c.glowGold, backgroundColor: on ? c.glowPurple : 'transparent' }]}>
                  <Icon name={IDEA_ICON[a] ?? 'star'} size={14} color={on ? c.tint : c.gold} />
                </View>
                <Text style={[s.itemText, { color: on ? c.foreground : c.text }]}>{label[a]}</Text>
                <View style={[s.box, { borderColor: on ? c.tint : c.border, backgroundColor: on ? c.glowPurple : 'transparent' }]}>
                  {on && <Icon name="check" size={12} color={c.tint} />}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={s.row}>
            <TouchableOpacity onPress={() => setReflecting(true)} style={[s.solid, { backgroundColor: c.secondary }]} accessibilityRole="button">
              <Icon name="check-circle" size={14} color={c.secondaryForeground} />
              <Text style={[s.solidText, { color: c.secondaryForeground }]}>{p.done ? t('lumi.gs.reflect', 'Wrap up') : t('lumi.gs.endNow', 'Finish now')}</Text>
            </TouchableOpacity>
              <TouchableOpacity onPress={() => { setOpen(false); setMinimized(true); }} style={[s.ghost, { borderColor: c.border }]} accessibilityRole="button">
                <Icon name="message-circle" size={14} color={c.text} />
                <Text style={[s.ghostText, { color: c.text }]}>{t('lumi.gs.backToChat', 'Back to chat')}</Text>
              </TouchableOpacity>
            {onOpenDetailed && (
              <TouchableOpacity onPress={onOpenDetailed} style={[s.ghost, { borderColor: c.border }]} accessibilityRole="button">
                <Text style={[s.ghostText, { color: c.tint }]}>{t('lumi.gs.detailed', 'Check-in view')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {reflecting && (
        <View style={{ gap: 8, marginTop: 10 }}>
          <Text style={[s.itemText, { color: c.foreground }]}>{t('lumi.gs.how', 'How did that feel? Totally optional.')}</Text>
          <View style={s.row}>
            {FEELINGS.map(f => (
              <TouchableOpacity key={f} onPress={() => setFeeling(x => (x === f ? undefined : f))}
                accessibilityRole="radio" accessibilityState={{ selected: feeling === f }}
                style={[s.ghost, { borderColor: feeling === f ? c.tint : c.border, backgroundColor: feeling === f ? c.glowPurple : 'transparent' }]}>
                <Icon name={FEEL_ICON[f]} size={14} color={feeling === f ? c.tint : c.mutedForeground} />
                <Text style={[s.ghostText, { color: feeling === f ? c.tint : c.text }]}>{feel[f]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={note} onChangeText={v => setNote(v.slice(0, 280))} placeholder={t('lumi.gs.notePh', 'Anything you want to remember?')}
            placeholderTextColor={c.mutedForeground} style={[s.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]} multiline />
          <View style={s.row}>
            <TouchableOpacity onPress={() => onFinish(summary())} style={[s.solid, { backgroundColor: c.secondary }]} accessibilityRole="button">
              <Icon name="check" size={14} color={c.secondaryForeground} />
              <Text style={[s.solidText, { color: c.secondaryForeground }]}>{t('lumi.gs.done', 'Done')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const sm = summary();
              onShare(t('lumi.gs.shareText', 'I just finished a {{n}} minute session.', { n: sm.minutes }) + (sm.feeling ? ` ${sm.feeling}.` : '') + (sm.note ? ` ${sm.note}` : ''));
              onFinish(sm);
            }} style={[s.ghost, { borderColor: c.tint }]} accessibilityRole="button">
              <Icon name="message-circle" size={12} color={c.tint} />
              <Text style={[s.ghostText, { color: c.tint }]}>{t('lumi.gs.share', 'Done and tell Lumi')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReflecting(false)} style={[s.ghost, { borderColor: c.border }]} accessibilityRole="button">
              <Text style={[s.ghostText, { color: c.text }]}>{t('lumi.gs.keepGoing', 'Keep going')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 14, marginBottom: 8, borderWidth: 1, borderRadius: 20, padding: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  scroll: { maxHeight: 260 },
  medal: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
  track: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  clock: { fontFamily: 'Satoshi-Bold', fontSize: 15, fontVariant: ['tabular-nums'] },
  meta: { fontFamily: 'Satoshi-Regular', fontSize: 11.5 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 4 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: 'Satoshi-Medium', fontSize: 13, flex: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  solid: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, borderRadius: 999, paddingHorizontal: 16 },
  solidText: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  ghostText: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
  input: { minHeight: 56, maxHeight: 96, borderWidth: 1, borderRadius: 12, padding: 10, fontFamily: 'Satoshi-Regular', fontSize: 13, textAlignVertical: 'top' },
});
