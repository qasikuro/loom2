/**
 * Layer D + orchestration — the living Lumi in the upper home dashboard.
 * Context (A) emits candidates -> pure manager (B) picks -> rig (C) plays ->
 * this component shows the speech bubble and at most two real actions.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, TouchableOpacity, View, type DimensionValue, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeOut, interpolate, useAnimatedStyle,
  useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
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

const FAIRY_LIGHTS = [
  { x: '13%', y: '29%', kind: 'firefly' },
  { x: '32%', y: '17%', kind: 'dust' },
  { x: '61%', y: '42%', kind: 'firefly' },
  { x: '84%', y: '24%', kind: 'dust' },
  { x: '51%', y: '74%', kind: 'firefly' },
  { x: '26%', y: '59%', kind: 'dust' },
] as const;

function FairyLight({
  x, y, index, kind, active, reducedMotion,
}: {
  x: string;
  y: string;
  index: number;
  kind: 'firefly' | 'dust';
  active: boolean;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    if (!active) {
      progress.value = 0;
    } else if (reducedMotion) {
      progress.value = 0.45;
    } else {
      progress.value = withDelay(index * 520, withRepeat(
        withTiming(1, { duration: 3400 + index * 290, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ));
    }

    return () => cancelAnimation(progress);
  }, [active, index, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion
      ? (kind === 'firefly' ? 0.7 : 0.38)
      : interpolate(progress.value, [0, 0.45, 1], [0.12, 0.96, 0.24]),
    transform: [
      { translateX: reducedMotion ? 0 : interpolate(progress.value, [0, 1], [-7, 7]) },
      { translateY: reducedMotion ? 0 : interpolate(progress.value, [0, 1], [8, -11]) },
      { scale: reducedMotion ? 1 : interpolate(progress.value, [0, 0.45, 1], [0.72, 1.16, 0.78]) },
    ],
  }));

  return (
    <Animated.View
      accessible={false}
      pointerEvents="none"
      style={[s.fairyLight, { left: x as DimensionValue, top: y as DimensionValue }, animatedStyle]}
    >
      {kind === 'firefly' && <View style={s.fireflyHalo} />}
      <View style={kind === 'firefly' ? s.fireflyCore : s.dustCore} />
    </Animated.View>
  );
}

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
  const { width: screenWidth } = useWindowDimensions();
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

  const size = Math.max(128, Math.min(props.compact ? 148 : 184, (screenWidth - 80) * 0.52));
  const cardHeight = props.compact ? 218 : 246;
  const bg: readonly [string, string, string] = isDark ? ['#241058', '#37157A', '#180A42'] : ['#EBDDFF', '#F6ECFF', '#FFE9E4'];

  return (
    <ImageBackground
      source={require('./lumi-fairy-garden.jpg')}
      resizeMode="cover"
      imageStyle={[s.sceneImage, { opacity: isDark ? 0.93 : 0.36 }]}
      style={[
        s.card,
        { height: cardHeight, borderColor: isDark ? 'rgba(190,142,255,0.34)' : 'rgba(150,100,220,0.30)' },
      ]}
      testID="lumi-fairy-scene"
    >
      <LinearGradient
        colors={isDark
          ? ['rgba(8,7,23,0.14)', 'rgba(14,8,32,0.22)', 'rgba(10,6,25,0.74)']
          : ['rgba(255,247,252,0.32)', 'rgba(247,236,255,0.28)', 'rgba(42,22,57,0.64)']}
        locations={[0, 0.48, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[s.avatarAura, { backgroundColor: isDark ? '#FFD794' : '#F1C5FF' }]} pointerEvents="none" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {FAIRY_LIGHTS.map((light, index) => (
          <FairyLight
            key={`${light.kind}-${index}`}
            {...light}
            index={index}
            active={ctx.visible}
            reducedMotion={ctx.reducedMotion}
          />
        ))}
      </View>
      <Pressable
        onPress={onTap}
        style={[s.stage, { width: size, height: size, left: -size * 0.025, bottom: -size * 0.035 }]}
        accessibilityRole="button"
        accessibilityLabel={t('lumiHome.a11yLumi', 'Lumi. Tap to play with her.')}
        testID="lumi-home-character"
      >
        <LumiRigView v={rig.values} size={size} />
      </Pressable>

      <View style={s.dialogueArea}>
        <Text style={s.eyebrow}>{t('lumiHome.eyebrow', 'LUMI · YOUR COMPANION')}</Text>
        <Animated.View key={dialog?.key ?? 'idle'} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={s.bubble}>
          <View style={s.tail} />
          <Text style={s.line} numberOfLines={3} testID="lumi-home-line">{line}</Text>
          {dialog && (
            <TouchableOpacity onPress={dismiss} hitSlop={10} style={s.close} accessibilityLabel={t('lumiHome.notNow', 'Not now')}>
              <Icon name="x" size={12} color={INK.sub} />
            </TouchableOpacity>
          )}
        </Animated.View>
        {action && (
          <TouchableOpacity
            onPress={action.onPress}
            style={[s.actionBtn, { backgroundColor: INK.sprout }]}
            activeOpacity={0.8}
            testID="lumi-home-action"
          >
            <Text style={s.btnText} numberOfLines={1}>{action.label}</Text>
            <Icon name="arrow-right" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => go('/(tabs)/drift')}
          style={[s.chatBtn, { backgroundColor: props.accent }]}
          activeOpacity={0.8}
          testID="lumi-home-chat"
          accessibilityRole="button"
        >
          <Icon name="message-circle" size={15} color="#FFFFFF" />
          <Text style={s.btnText} numberOfLines={1}>{t('lumiHome.chat', 'Talk to Lumi')}</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, position: 'relative', backgroundColor: '#16102C' },
  sceneImage: { borderRadius: 22 },
  avatarAura: { position: 'absolute', left: '17%', bottom: -46, width: 174, height: 108, borderRadius: 100, opacity: 0.24 },
  stage: { position: 'absolute', zIndex: 2, alignItems: 'center', justifyContent: 'center' },
  fairyLight: { position: 'absolute', width: 16, height: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  fireflyHalo: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFE7AD', opacity: 0.26, shadowColor: '#FFCB70', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 8, elevation: 5 },
  fireflyCore: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF5C9', shadowColor: '#FFD783', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.95, shadowRadius: 6, elevation: 4 },
  dustCore: { width: 2, height: 2, borderRadius: 1, backgroundColor: '#F5D5FF', shadowColor: '#EBCBFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 3, elevation: 2 },
  dialogueArea: { position: 'absolute', top: 26, right: 14, left: '39%', zIndex: 3, gap: 9, alignItems: 'flex-start' },
  eyebrow: { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.3, color: '#F2D7FF', textShadowColor: 'rgba(20,8,34,0.82)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  bubble: { backgroundColor: INK.bubble, borderColor: INK.bubbleBorder, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 6, paddingVertical: 9, paddingLeft: 12, paddingRight: 24 },
  tail: { position: 'absolute', left: -5, top: 10, width: 10, height: 10, backgroundColor: INK.bubble, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: INK.bubbleBorder, transform: [{ rotate: '45deg' }], zIndex: -1 },
  line: { fontFamily: 'Satoshi-Medium', fontSize: 12.5, lineHeight: 17, color: INK.text },
  close: { position: 'absolute', right: 7, top: 7, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  actionBtn: { minHeight: 29, maxWidth: '100%', borderRadius: 15, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chatBtn: { minHeight: 34, maxWidth: '100%', borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  btnText: { flexShrink: 1, fontFamily: 'Satoshi-Bold', fontSize: 10.5, color: '#FFFFFF' },
});
