import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { LumiIntent, LumiMood, SessionMinutes } from '../logic';

export type MoodSessionResult = { mood: LumiMood; intent: LumiIntent; minutes: SessionMinutes | null };

type C = ReturnType<typeof useColors>;

const MOODS: { id: LumiMood; icon: IconName }[] = [
  { id: 'happy', icon: 'smile' }, { id: 'calm', icon: 'feather' }, { id: 'sad', icon: 'cloud' },
  { id: 'tired', icon: 'moon' }, { id: 'stressed', icon: 'wind' }, { id: 'lonely', icon: 'heart' },
  { id: 'excited', icon: 'zap' }, { id: 'neutral', icon: 'circle' },
];
const INTENTS: { id: LumiIntent; icon: IconName }[] = [
  { id: 'company', icon: 'users' }, { id: 'quiet', icon: 'moon' }, { id: 'creative', icon: 'edit-2' },
  { id: 'focus', icon: 'flag' }, { id: 'unspecified', icon: 'message-circle' },
];
const TIMES: { id: SessionMinutes | null; icon: IconName }[] = [
  { id: 5, icon: 'clock' }, { id: 15, icon: 'clock' }, { id: 30, icon: 'clock' }, { id: null, icon: 'message-circle' },
];

function Medallion({ icon, c, on, size = 34 }: { icon: IconName; c: C; on?: boolean; size?: number }) {
  return (
    <View style={[s.medal, { width: size, height: size, borderRadius: size / 2, borderColor: on ? c.tint : c.glowGold, backgroundColor: on ? c.glowPurple : 'transparent' }]}>
      <Icon name={icon} size={Math.round(size * 0.45)} color={on ? c.tint : c.gold} />
    </View>
  );
}

/** Small optional welcome shown when chat opens. */
export function LumiSessionWelcome({ name, onStart, onSkip }: { name: string | null; onStart: () => void; onSkip: () => void }) {
  const c = useColors();
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(260)} style={[s.card, { backgroundColor: c.card, borderColor: c.border }]} testID="lumi-session-welcome">
      <View style={s.headRow}>
        <Medallion icon="sunrise" c={c} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: c.foreground }]}>
            {name ? t('lumi.checkin.welcomeName', 'Welcome back, {{name}}', { name }) : t('lumi.checkin.welcome', 'Welcome back')}
          </Text>
          <Text style={[s.body, { color: c.mutedForeground }]}>
            {t('lumi.checkin.welcomeAsk', 'Want a quick mood session first? Or save it for later and just chat with me.')}
          </Text>
        </View>
      </View>
      <View style={s.actions}>
        <TouchableOpacity onPress={onStart} style={[s.solid, { backgroundColor: c.secondary }]} accessibilityRole="button">
          <Icon name="smile" size={15} color={c.secondaryForeground} />
          <Text style={[s.solidText, { color: c.secondaryForeground }]}>{t('lumi.checkin.start', 'Start mood session')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={[s.ghost, { borderColor: c.border }]} accessibilityRole="button">
          <Icon name="message-circle" size={15} color={c.tint} />
          <Text style={[s.ghostText, { color: c.tint }]}>{t('lumi.checkin.later', 'Later, let\u2019s chat')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/** Compact three-step in-chat mood session. Purely local until the user finishes. */
export function LumiMoodSession({ onComplete, onCancel }: { onComplete: (r: MoodSessionResult) => void; onCancel: () => void }) {
  const c = useColors();
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<LumiMood | null>(null);
  const [intent, setIntent] = useState<LumiIntent | null>(null);
  const [minutes, setMinutes] = useState<SessionMinutes | null | undefined>(undefined);

  const moodLabel: Record<string, string> = {
    happy: t('lumi.mood.happy', 'Good'), calm: t('lumi.mood.calm', 'Calm'), sad: t('lumi.mood.sad', 'Sad'),
    tired: t('lumi.mood.tired', 'Tired'), stressed: t('lumi.mood.stressed', 'Stressed'), lonely: t('lumi.mood.lonely', 'Lonely'),
    excited: t('lumi.mood.excited', 'Excited'), neutral: t('lumi.checkin.neutral', 'Not sure'),
  };
  const intentLabel: Record<LumiIntent, string> = {
    company: t('lumi.checkin.company', 'Some company'), quiet: t('lumi.checkin.quiet', 'Quiet time'),
    creative: t('lumi.checkin.creative', 'Make something'), focus: t('lumi.checkin.focus', 'Focus on a goal'),
    unspecified: t('lumi.checkin.justChatNeed', 'Just chat'),
  };
  const timeLabel = (m: SessionMinutes | null) => (m === null ? t('lumi.checkin.justChat', 'Just chat') : t('lumi.checkin.min', '{{n}} min', { n: m }));
  const questions = [
    t('lumi.checkin.q1', 'How do you feel right now?'),
    t('lumi.checkin.q2', 'What would help most?'),
    t('lumi.checkin.q3', 'Want a short guided session? Tasks are optional.'),
  ];
  const canNext = step === 0 ? !!mood : step === 1 ? !!intent : minutes !== undefined;

  function next() {
    if (!canNext) return;
    if (step < 2) setStep(step + 1);
    else onComplete({ mood: mood!, intent: intent!, minutes: minutes ?? null });
  }

  const Choice = ({ icon, label, on, onPress }: { icon: IconName; label: string; on: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label}
      style={[s.choice, { borderColor: on ? c.tint : c.border, backgroundColor: on ? c.glowPurple : c.background }]}>
      <Medallion icon={icon} c={c} on={on} size={28} />
      <Text style={[s.choiceText, { color: on ? c.foreground : c.text }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]} testID="lumi-mood-session">
      <View style={s.topRow}>
        <View style={s.dots} accessibilityLabel={t('lumi.checkin.step', 'Step {{n}} of 3', { n: step + 1 })}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.dot, { backgroundColor: i <= step ? c.gold : c.muted, width: i === step ? 18 : 6 }]} />
          ))}
        </View>
        <TouchableOpacity onPress={onCancel} style={s.close} accessibilityRole="button" accessibilityLabel={t('lumi.checkin.cancel', 'Back to chat')}>
          <Icon name="x" size={16} color={c.mutedForeground} />
          <Text style={[s.meta, { color: c.mutedForeground }]}>{t('lumi.checkin.cancelShort', 'Back to chat')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View key={step} entering={reduce ? undefined : FadeIn.duration(220)} exiting={reduce ? undefined : FadeOut.duration(120)}>
        <Text style={[s.title, { color: c.foreground, marginBottom: 10 }]}>{questions[step]}</Text>
        <View style={s.grid}>
          {step === 0 && MOODS.map(m => <Choice key={m.id} icon={m.icon} label={moodLabel[m.id]} on={mood === m.id} onPress={() => setMood(m.id)} />)}
          {step === 1 && INTENTS.map(m => <Choice key={m.id} icon={m.icon} label={intentLabel[m.id]} on={intent === m.id} onPress={() => setIntent(m.id)} />)}
          {step === 2 && TIMES.map(m => <Choice key={String(m.id)} icon={m.icon} label={timeLabel(m.id)} on={minutes === m.id} onPress={() => setMinutes(m.id)} />)}
        </View>
        {step === 2 && <Text style={[s.meta, { color: c.mutedForeground, marginTop: 12 }]}>
          {t('lumi.checkin.dataNotice', 'When you continue, your mood and choices are sent to Lumi’s AI service. They are not shared with other players.')}
        </Text>}
      </Animated.View>

      <View style={[s.actions, { justifyContent: 'space-between' }]}>
        <TouchableOpacity onPress={() => (step === 0 ? onCancel() : setStep(step - 1))} style={[s.ghost, { borderColor: c.border }]} accessibilityRole="button">
          <Icon name="chevron-left" size={15} color={c.text} />
          <Text style={[s.ghostText, { color: c.text }]}>{step === 0 ? t('lumi.checkin.notNow', 'Not now') : t('lumi.checkin.back', 'Back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={next} disabled={!canNext} accessibilityState={{ disabled: !canNext }} accessibilityRole="button"
          style={[s.solid, { backgroundColor: c.secondary, opacity: canNext ? 1 : 0.45 }]}>
          <Text style={[s.solidText, { color: c.secondaryForeground }]}>{step < 2 ? t('lumi.checkin.next', 'Next') : minutes === null ? t('lumi.checkin.finishChat', 'Back to chat') : t('lumi.checkin.finishSession', 'Start with Lumi')}</Text>
          <Icon name={step < 2 ? 'chevron-right' : 'check'} size={15} color={c.secondaryForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 14, gap: 12, marginBottom: 12, width: '100%', maxWidth: 420, alignSelf: 'center' },
  headRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  medal: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 15, lineHeight: 21 },
  body: { fontFamily: 'Satoshi-Regular', fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  meta: { fontFamily: 'Satoshi-Medium', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  solid: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 16 },
  solidText: { fontFamily: 'Satoshi-Bold', fontSize: 13.5 },
  ghost: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14 },
  ghostText: { fontFamily: 'Satoshi-Bold', fontSize: 13.5 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { height: 6, borderRadius: 3 },
  close: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 48, flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, paddingHorizontal: 8 },
  choiceText: { fontFamily: 'Satoshi-Bold', fontSize: 13.5, flex: 1 },
});
