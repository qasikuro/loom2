/**
 * Layer D + orchestration — the living Lumi in the upper home dashboard.
 * Context (A) emits candidates -> pure manager (B) picks -> rig (C) plays ->
 * this component shows the speech bubble and at most two real actions.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { LumiRigView } from './LumiCharacter';
import { useLumiRig } from './useLumiRig';
import { useLumiHomeContext } from './useLumiHomeContext';
import {
  complete, drop, enqueue, initialManagerState, requestTap, startNext,
  type Candidate, type LumiReaction, type Playing,
} from './reactionManager';
import type { LumiCreationKind } from './events';

const LINGER_MS = 6500;
const GAP_MS = 700;

// Lumi's own colours (cream body, eye brown, sprout red) frame her dialogue.
const INK = {
  bubble: '#FFF6E6', bubbleBorder: '#F1D3BE', text: '#4C1F16', sub: '#8D382B', sprout: '#E8334E',
};

const DEFAULT_TEXT: Record<LumiReaction | 'idle', string> = {
  idle: 'I am right here. Tap me, or let us chat.',
  welcomeNew: "Oh! A new face! Hi, I'm Lumi. Want me to show you around?",
  returnSameDay: "You're back! Hehe, what shall we do today?",
  returnSleepy: "Mmm… you're here! Want to spend a little time together?",
  suggestCreate: "Psst… shall we make our first little memory? I'll help!",
  celebrate: "YOU MADE SOMETHING! I'm so proud of you!",
  tapShy: 'Eep! You caught me being cute.',
  tapDramatic: 'Hmph! …okay, okay, I forgive you.',
  tapExcited: 'Hehe! Did you need me, or did you just want to squish my cheeks?',
  tapAffectionate: "Aww, come here. I'm really glad you're here.",
};

function creationRoute(kind?: LumiCreationKind, id?: string): string | null {
  if (!kind) return null;
  if (kind === 'outfit') return '/wardrobe';
  if (!id) return null;
  if (kind === 'journal') return `/journal-entry?id=${encodeURIComponent(id)}`;
  return `/story/${encodeURIComponent(id)}`;
}

export function LumiHomeCard(props: {
  userId: string | null | undefined;
  accountReady: boolean;
  accountCreatedAt: number | null;
  dataReady: boolean;
  storyCount: number;
  journalCount: number;
  outfitCount: number;
  inView: boolean;
  accent: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const managerRef = useRef(initialManagerState());
  const [dialog, setDialog] = useState<Playing | null>(null);
  const lingerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pumpRef = useRef<() => void>(() => {});

  const onCandidate = useCallback((c: Candidate) => {
    managerRef.current = enqueue(managerRef.current, c).state;
    pumpRef.current();
  }, []);

  const ctx = useLumiHomeContext({ ...props, onCandidate });
  const rig = useLumiRig({ active: ctx.visible, reducedMotion: ctx.reducedMotion });
  const visibleRef = useRef(ctx.visible);
  visibleRef.current = ctx.visible;

  const clearTimers = useCallback(() => {
    if (lingerRef.current) clearTimeout(lingerRef.current);
    if (gapRef.current) clearTimeout(gapRef.current);
    lingerRef.current = gapRef.current = null;
  }, []);

  const playOne = useCallback((p: Playing) => {
    clearTimers();
    setDialog(p);
    rig.play(p.reaction, () => {
      managerRef.current = complete(managerRef.current, p.key);
      const lingering = p.reaction === 'suggestCreate' || p.reaction === 'celebrate' || p.reaction === 'welcomeNew';
      lingerRef.current = setTimeout(() => setDialog(d => (d?.key === p.key ? null : d)), lingering ? LINGER_MS * 1.6 : LINGER_MS);
      gapRef.current = setTimeout(() => pumpRef.current(), GAP_MS);
    });
  }, [rig, clearTimers]);

  pumpRef.current = () => {
    if (!visibleRef.current) return;
    const r = startNext(managerRef.current, Date.now());
    managerRef.current = r.state;
    if (r.started) playOne(r.started);
  };

  // Pause: stop the one-shot cleanly (manager marks it done) — never left mid-pose.
  useEffect(() => {
    if (ctx.visible) { pumpRef.current(); return; }
    const cur = managerRef.current.current;
    if (cur) {
      rig.stop();
      managerRef.current = complete(managerRef.current, cur.key);
    }
    clearTimers();
    setDialog(null);
  }, [ctx.visible, rig, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const onTap = () => {
    const r = requestTap(managerRef.current, Date.now());
    managerRef.current = r.state;
    if (!r.started) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    playOne(r.started);
  };

  const dismiss = () => {
    const cur = managerRef.current.current;
    if (cur && cur.key === dialog?.key) {
      rig.stop();
      managerRef.current = complete(managerRef.current, cur.key);
    }
    if (dialog?.reaction === 'suggestCreate') {
      ctx.dismissSuggestion();
      managerRef.current = drop(managerRef.current, 'suggestCreate');
    }
    clearTimers();
    setDialog(null);
    pumpRef.current();
  };

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(path as never);
  };

  const reaction = dialog?.reaction ?? 'idle';
  const line = t(`lumiHome.${reaction}`, DEFAULT_TEXT[reaction]);
  let action: { label: string; onPress: () => void } | null = null;
  if (reaction === 'welcomeNew') action = { label: t('lumiHome.explore', "Let's explore"), onPress: () => go('/(tabs)/discover') };
  if (reaction === 'suggestCreate') action = { label: t('lumiHome.create', 'Create something'), onPress: () => go('/(tabs)/create') };
  if (reaction === 'celebrate') {
    const route = creationRoute(dialog?.creationKind, dialog?.contentId);
    if (route) action = { label: t('lumiHome.view', 'Take a look'), onPress: () => go(route) };
  }

  const size = props.compact ? 112 : 136;
  const bg: readonly [string, string, string] = isDark ? ['#241058', '#37157A', '#180A42'] : ['#EBDDFF', '#F6ECFF', '#FFE9E4'];

  return (
    <View style={[s.card, { minHeight: size + 24, borderColor: isDark ? 'rgba(190,142,255,0.24)' : 'rgba(150,100,220,0.22)' }]}>
      <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[s.glow, { backgroundColor: props.accent }]} />
      <Pressable
        onPress={onTap}
        style={[s.stage, { width: size, height: size }]}
        accessibilityRole="button"
        accessibilityLabel={t('lumiHome.a11yLumi', 'Lumi. Tap to play with her.')}
        testID="lumi-home-character"
      >
        <LumiRigView v={rig.values} size={size} />
      </Pressable>

      <View style={s.right}>
        <Text style={[s.eyebrow, { color: props.accent }]}>{t('lumiHome.eyebrow', 'LUMI')}</Text>
        <Animated.View key={dialog?.key ?? 'idle'} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={s.bubble}>
          <View style={s.tail} />
          <Text style={s.line} numberOfLines={props.compact ? 3 : 4} testID="lumi-home-line">{line}</Text>
          {dialog && (
            <TouchableOpacity onPress={dismiss} hitSlop={10} style={s.close} accessibilityLabel={t('lumiHome.notNow', 'Not now')}>
              <Icon name="x" size={12} color={INK.sub} />
            </TouchableOpacity>
          )}
        </Animated.View>
        <View style={s.actions}>
          {action && (
            <TouchableOpacity onPress={action.onPress} style={[s.btn, { backgroundColor: INK.sprout }]} activeOpacity={0.8} testID="lumi-home-action">
              <Text style={s.btnText} numberOfLines={1}>{action.label}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => go('/(tabs)/drift')}
            style={[s.btn, action ? s.btnGhost : { backgroundColor: props.accent }, action && { borderColor: props.accent }]}
            activeOpacity={0.8}
            testID="lumi-home-chat"
          >
            <Icon name="message-circle" size={12} color={action ? props.accent : '#FFFFFF'} />
            <Text style={[s.btnText, action && { color: props.accent }]} numberOfLines={1}>{t('lumiHome.chat', 'Chat with Lumi')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 4, paddingRight: 12 },
  glow: { position: 'absolute', left: -30, bottom: -60, width: 190, height: 190, borderRadius: 95, opacity: 0.16 },
  stage: { alignItems: 'center', justifyContent: 'center' },
  right: { flex: 1, minWidth: 0, gap: 6, paddingLeft: 6 },
  eyebrow: { fontSize: 10.5, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4 },
  bubble: { backgroundColor: INK.bubble, borderColor: INK.bubbleBorder, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 6, paddingVertical: 9, paddingLeft: 12, paddingRight: 24 },
  tail: { position: 'absolute', left: -5, top: 10, width: 10, height: 10, backgroundColor: INK.bubble, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: INK.bubbleBorder, transform: [{ rotate: '45deg' }] },
  line: { fontFamily: 'Satoshi-Medium', fontSize: 13.5, lineHeight: 19, color: INK.text },
  close: { position: 'absolute', right: 7, top: 7, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { height: 30, borderRadius: 15, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  btnGhost: { borderWidth: 1, backgroundColor: 'transparent' },
  btnText: { fontFamily: 'Satoshi-Bold', fontSize: 11.5, color: '#FFFFFF' },
});
