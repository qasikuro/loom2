import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';

const { width: SW, height: SH } = Dimensions.get('window');
type FlowStep = 'welcome' | 'survey' | 'analyzing' | 'mode' | 'session' | 'reflection';

// ─── Data ────────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    id: 'session', q: 'How are you stepping in today?', emoji: '🌅',
    opts: [
      { id: 'locked_in',    label: 'Locked In',        desc: "Numbers up, let's achieve goals", em: '⚔️' },
      { id: 'just_existing',label: 'Just Existing',     desc: 'No pressure, just here',          em: '🌙' },
      { id: 'grinding',     label: 'Grinding Again',    desc: "Let's go, no giving up",          em: '🔥' },
      { id: 'escaping',     label: 'Escaping Reality',  desc: "Don't know what I'm doing here",  em: '🌀' },
    ],
  },
  {
    id: 'depth', q: 'How deep did you go recently?', emoji: '⏱️',
    opts: [
      { id: 'quick',      label: 'Just 10 mins',       desc: 'In and out, nice and clean',       em: '⚡' },
      { id: 'one_hour',   label: 'About 1 hour',        desc: 'A proper session',                 em: '🕐' },
      { id: 'two_three',  label: '2 – 3 hours',         desc: 'Deep in it',                       em: '🌊' },
      { id: 'three_plus', label: '3+ hours',            desc: 'I looked outside and it was morning', em: '🌄' },
    ],
  },
  {
    id: 'frequency', q: 'How often do you reopen the game?', emoji: '🔄',
    opts: [
      { id: 'once_week',  label: 'Once a week',         desc: 'Quality over quantity',            em: '📅' },
      { id: 'daily',      label: 'Daily',               desc: "It's part of the routine",         em: '⭐' },
      { id: 'multiple',   label: 'Multiple times daily', desc: 'It keeps calling me back',        em: '🔔' },
      { id: 'instantly',  label: 'Close → reopen instantly', desc: "Can't stop, won't stop",     em: '🌀' },
    ],
  },
  {
    id: 'who', q: 'Who do you usually play with?', emoji: '👥',
    opts: [
      { id: 'friends',  label: 'Friends',               desc: 'The squad shows up',               em: '🤝' },
      { id: 'randoms',  label: 'Randoms',               desc: "Whoever's around",                 em: '🌍' },
      { id: 'solo',     label: 'Solo only',             desc: 'My world, my rules',               em: '🌙' },
      { id: 'menus',    label: 'Just vibing in menus',  desc: 'The vibe is enough',               em: '✨' },
    ],
  },
  {
    id: 'pull', q: 'What keeps pulling you back?', emoji: '🧲',
    opts: [
      { id: 'progress',    label: 'Progress',           desc: 'Gotta see those numbers go up',    em: '📈' },
      { id: 'habit',       label: 'Habit',              desc: "It's just what I do now",          em: '🔁' },
      { id: 'comfort',     label: 'Comfort',            desc: 'It feels safe here',               em: '🏡' },
      { id: 'competition', label: 'Competition',        desc: 'I will not be last',               em: '🏆' },
    ],
  },
  {
    id: 'energy', q: 'How would you describe your energy right now?', emoji: '⚡',
    opts: [
      { id: 'clear',   label: 'Clear and ready',        desc: 'Focused, let\'s go',               em: '☀️' },
      { id: 'calm',    label: 'Calm but here',          desc: 'Peaceful and present',             em: '🌙' },
      { id: 'drained', label: 'Drained but pushing',   desc: 'Running on fumes',                 em: '🌧️' },
      { id: 'wired',   label: 'Wired and intense',     desc: "Brain won't stop, let's use it",   em: '⚡' },
    ],
  },
];

interface ModeConfig {
  name: string; archetype: string; symbol: string; color: string;
  gradient: readonly [string, string, string];
  tagline: string; description: string;
  traits: string[]; perks: string[];
  lumiMessage: string; quest: string;
  events: string[];
}

const MODES: Record<string, ModeConfig> = {
  challenge: {
    name: 'Challenge Mode',  archetype: 'The Locked-In Achiever', symbol: '⚔️', color: '#FF6B6B',
    gradient: ['#2A0808', '#3A1010', '#4A1818'] as const,
    tagline: 'High focus. Hard goals. No ceiling.',
    description: "You're locked in and ready to push. This mode amplifies your drive with harder objectives, achievement tracking, and competitive boosts.",
    traits: ['Goal-driven', 'High intensity', 'Achievement-focused'],
    perks: ['+20% Discovery XP', 'Hard Mode Events', 'Leaderboard Push'],
    lumiMessage: "Let's go. I'll be right there pushing with you. ⚔️",
    quest: 'Complete 3 objectives without stopping',
    events: ['⚔️ Hard Mode activated — objectives scaled up', '🔥 Streak building — keep pushing!', '📊 You\'re in the top zone today', '🏆 Achievement unlocked: Relentless'],
  },
  flow: {
    name: 'Flow Mode',       archetype: 'The Peaceful Drifter',   symbol: '🌊', color: '#6BC5FF',
    gradient: ['#08182A', '#102238', '#183248'] as const,
    tagline: 'Calm, steady, pressure-free.',
    description: "You're in it for the journey. Flow Mode reduces pressure, enhances ambience, and lets the experience wash over you naturally.",
    traits: ['Relaxed focus', 'Journey-minded', 'Pressure-free'],
    perks: ['Reduced Pressure', 'Relaxing Ambience', 'Extra Rewards'],
    lumiMessage: 'No rush. The path will always open for you. 🌊',
    quest: 'Explore one new area without a timer',
    events: ['🌊 Calm zone active — breathe easy', '🌿 A hidden path appears just for you', '🎵 Relaxing ambience enabled', '✦ You discovered something beautiful'],
  },
  echo: {
    name: 'Echo Mode',       archetype: 'The Lone Wanderer',      symbol: '🌙', color: '#B090FF',
    gradient: ['#100828', '#1C1040', '#281850'] as const,
    tagline: 'Explore, reflect, discover.',
    description: "You enjoy solitude and deep exploration. Echo Mode brings guided hints, discovery boosts, and a companion to walk with you quietly.",
    traits: ['Independent', 'Deep Thinker', 'Exploration Seeker'],
    perks: ['Guided Hints', 'Discovery Boost', 'Companion Enabled'],
    lumiMessage: "I'll be here with you. Need anything, just ask. 🌙",
    quest: 'Find 3 hidden places no one talks about',
    events: ['🌙 The old guide whispers a hint...', '✧ A hidden constellation appears', '🔍 Something glowing over there...', '🌙 You discovered a secret path'],
  },
  social: {
    name: 'Social Mode',     archetype: 'The Social Hunter',      symbol: '✨', color: '#6BD48A',
    gradient: ['#08200E', '#102A16', '#183A1E'] as const,
    tagline: 'Connect, level up, vibe.',
    description: "You thrive with others. Social Mode activates group boosts, surfaces nearby players to connect with, and amplifies shared experiences.",
    traits: ['Community-driven', 'Collaborative', 'Socially energized'],
    perks: ['Party Finder Boost', 'Group Rewards', 'Social Events'],
    lumiMessage: 'A kind soul is nearby. Want to join their journey? ✨',
    quest: 'Connect with one new player today',
    events: ['👥 A kind soul is nearby!', '🎉 Group bonus activated!', '🌟 Someone just joined your path', '💫 Community event starting soon'],
  },
  clarity: {
    name: 'Clarity Mode',    archetype: 'The Strategic Mind',     symbol: '🔮', color: '#FFD86F',
    gradient: ['#1A1200', '#2A1E00', '#3A2800'] as const,
    tagline: 'Find direction. No stress.',
    description: "You want to understand your path. Clarity Mode gives you smart quest suggestions, progress insight, and gentle guidance to move forward.",
    traits: ['Strategic', 'Progress-aware', 'Direction-seeking'],
    perks: ['Smart Guidance', 'Quest Suggestions', 'Progress Clarity'],
    lumiMessage: "Let's figure this out together. I see a path forward. 🔮",
    quest: 'Identify your top priority and take one step',
    events: ['🔮 Smart quest suggestion available!', '📍 Priority path identified', '💡 New insight unlocked', '🗺️ Your progress map updated'],
  },
  recovery: {
    name: 'Recovery Mode',   archetype: 'The Burnout Drifter',    symbol: '🌸', color: '#FF89B0',
    gradient: ['#200814', '#301220', '#40182C'] as const,
    tagline: 'You matter. Take it slow.',
    description: "You need rest, not pressure. Recovery Mode gives you easy wins, mood uplift, and a gentle reminder that it's okay to just exist here.",
    traits: ['Burnout-aware', 'Needs gentleness', 'Recovery-focused'],
    perks: ['Burnout Relief', 'Easy Wins', 'Mood Uplift'],
    lumiMessage: 'Hey. You showed up. That\'s already enough. 🌸',
    quest: 'Do one thing that brings you peace today',
    events: ['🌸 Easy win available nearby!', '☕ Take it slow — you\'re doing great', '✨ Mood uplift +10%', '🌷 A peaceful moment found you'],
  },
};

function detectMode(a: Record<string, string>): string {
  const s: Record<string, number> = { challenge: 0, flow: 0, echo: 0, social: 0, clarity: 0, recovery: 0 };
  if (a.session === 'locked_in')    { s.challenge += 3; s.clarity  += 1; }
  if (a.session === 'just_existing'){ s.recovery  += 3; s.flow     += 1; }
  if (a.session === 'grinding')     { s.challenge += 2; s.flow     += 2; }
  if (a.session === 'escaping')     { s.echo      += 3; s.recovery += 1; }
  if (a.depth === 'quick')          { s.recovery  += 2; s.social   += 1; }
  if (a.depth === 'one_hour')       { s.flow      += 2; s.clarity  += 1; }
  if (a.depth === 'two_three')      { s.flow      += 1; s.echo     += 2; }
  if (a.depth === 'three_plus')     { s.challenge += 2; s.echo     += 2; }
  if (a.frequency === 'once_week')  { s.recovery  += 2; s.social   += 1; }
  if (a.frequency === 'daily')      { s.flow      += 2; s.social   += 1; }
  if (a.frequency === 'multiple')   { s.challenge += 2; s.echo     += 1; }
  if (a.frequency === 'instantly')  { s.echo      += 2; s.challenge += 1; }
  if (a.who === 'friends')          { s.social    += 3; }
  if (a.who === 'randoms')          { s.social    += 2; s.challenge += 1; }
  if (a.who === 'solo')             { s.echo      += 2; s.clarity  += 2; }
  if (a.who === 'menus')            { s.recovery  += 3; s.flow     += 1; }
  if (a.pull === 'progress')        { s.challenge += 2; s.clarity  += 2; }
  if (a.pull === 'habit')           { s.flow      += 3; }
  if (a.pull === 'comfort')         { s.recovery  += 3; }
  if (a.pull === 'competition')     { s.challenge += 3; }
  if (a.energy === 'clear')         { s.challenge += 1; s.clarity  += 2; }
  if (a.energy === 'calm')          { s.flow      += 3; s.echo     += 1; }
  if (a.energy === 'drained')       { s.recovery  += 3; }
  if (a.energy === 'wired')         { s.challenge += 2; s.echo     += 1; }
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Deterministic star positions (no Math.random at render) ────────────────
const STARS = Array.from({ length: 42 }, (_, i) => ({
  id: i,
  left: ((i * 37 + 11) % 97) + '%',
  top:  ((i * 53 + 7)  % 95) + '%',
  size: ((i * 13) % 3) + 1,
  dur:  1500 + (i * 211) % 2200,
  delay: (i * 157) % 2000,
}));

function StarField() {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {STARS.map(s => <Star key={s.id} s={s} />)}
    </View>
  );
}

function Star({ s }: { s: typeof STARS[0] }) {
  const op = useRef(new Animated.Value(0.15)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(s.delay),
        Animated.timing(op, { toValue: 0.9,  duration: s.dur, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.08, duration: s.dur, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: s.left as any, top: s.top as any,
      width: s.size, height: s.size, borderRadius: s.size,
      backgroundColor: '#fff', opacity: op,
    }} />
  );
}

// ─── Lumi companion ──────────────────────────────────────────────────────────
function Lumi({ message, color = '#B090FF' }: { message: string; color?: string }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -8, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(bob, { toValue:  0, duration: 1800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();
  }, []);
  return (
    <View style={lumiStyles.wrap}>
      <Animated.View style={[lumiStyles.mascot, { borderColor: `${color}44`, transform: [{ translateY: bob }] }]}>
        <LinearGradient colors={[`${color}30`, `${color}10`]} style={StyleSheet.absoluteFill} />
        <Text style={lumiStyles.mascotEmoji}>✦</Text>
        <Text style={[lumiStyles.mascotName, { color }]}>Lumi</Text>
      </Animated.View>
      <View style={[lumiStyles.bubble, { borderColor: `${color}30`, backgroundColor: `${color}0E` }]}>
        <Text style={lumiStyles.bubbleText}>"{message}"</Text>
      </View>
    </View>
  );
}

const lumiStyles = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  mascot: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  mascotEmoji:  { fontSize: 22 },
  mascotName:   { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1 },
  bubble: {
    flex: 1, borderRadius: 16, borderWidth: 1, padding: 14,
  },
  bubbleText:   { fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 20, color: 'rgba(240,230,255,0.88)', fontStyle: 'italic' },
});

// ─── Option card ─────────────────────────────────────────────────────────────
function OptionCard({
  opt, selected, onPress, color,
}: { opt: typeof QUESTIONS[0]['opts'][0]; selected: boolean; onPress: () => void; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  function press() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.95, duration: 80,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  }
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[
          optStyles.card,
          selected
            ? { backgroundColor: `${color}22`, borderColor: `${color}80`, borderWidth: 2 }
            : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)', borderWidth: 1 },
        ]}
        onPress={press}
        activeOpacity={0.85}
      >
        <Text style={optStyles.em}>{opt.em}</Text>
        <View style={optStyles.textBlock}>
          <Text style={[optStyles.label, selected && { color }]}>{opt.label}</Text>
          <Text style={optStyles.desc}>{opt.desc}</Text>
        </View>
        {selected && <View style={[optStyles.check, { backgroundColor: color }]}><Text style={optStyles.checkMark}>✓</Text></View>}
      </TouchableOpacity>
    </Animated.View>
  );
}
const optStyles = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 15, marginBottom: 10 },
  em:        { fontSize: 26, width: 34, textAlign: 'center' },
  textBlock: { flex: 1, gap: 3 },
  label:     { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#F0E8FF' },
  desc:      { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.60)' },
  check:     { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkMark: { fontSize: 12, color: '#fff', fontFamily: 'Satoshi-Bold' },
});

// ─── Perk chip ───────────────────────────────────────────────────────────────
function PerkChip({ text, color }: { text: string; color: string }) {
  return (
    <View style={[perkStyles.chip, { backgroundColor: `${color}18`, borderColor: `${color}35` }]}>
      <Text style={perkStyles.dot}>✦</Text>
      <Text style={[perkStyles.text, { color }]}>{text}</Text>
    </View>
  );
}
const perkStyles = StyleSheet.create({
  chip:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  dot:   { fontSize: 10, color: 'rgba(200,180,255,0.6)' },
  text:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },
});

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: Welcome
// ═══════════════════════════════════════════════════════════════════════════
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const entry  = useRef(new Animated.Value(0)).current;
  const entryY = entry.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  useEffect(() => {
    Animated.timing(entry, { toValue: 1, duration: 900, delay: 200, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[scr.root, { paddingTop: topPad + 20 }]}>
      <LinearGradient colors={['#0B0818', '#130D28', '#1C1040']} style={StyleSheet.absoluteFill} />
      <StarField />

      <ScrollView contentContainerStyle={scr.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Lumi hero */}
        <Animated.View style={[scr.lumiHero, { opacity: entry, transform: [{ translateY: entryY }] }]}>
          <LinearGradient
            colors={['#B090FF44', '#7040D022', 'transparent']}
            style={scr.lumiGlow}
          />
          <Text style={scr.lumiSymbol}>✦</Text>
          <Text style={scr.lumiSubName}>Lumi is here</Text>
        </Animated.View>

        <Animated.Text style={[scr.welcomeTitle, { opacity: entry, transform: [{ translateY: entryY }] }]}>
          Drift Mode
        </Animated.Text>

        <Animated.Text style={[scr.welcomeSubtitle, { opacity: entry, transform: [{ translateY: entryY }] }]}>
          A short vibe check — 6 questions — personalises your journey. No judgement here. Just stars.
        </Animated.Text>

        <Animated.View style={[scr.transparencyNote, { opacity: entry }]}>
          <Text style={scr.transparencyText}>✦ Your responses personalise your experience. We never store or share them.</Text>
        </Animated.View>

        <Animated.View style={{ opacity: entry, transform: [{ translateY: entryY }] }}>
          <TouchableOpacity style={scr.startBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onStart(); }} activeOpacity={0.88}>
            <LinearGradient colors={['#8060C8', '#6040A8']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Text style={scr.startBtnText}>Start Journey ✦</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={scr.modeCount}>6 drift modes • Lumi companion • Session quests</Text>
      </ScrollView>
    </View>
  );
}

const scr = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 48, alignItems: 'center' },
  lumiHero: { alignItems: 'center', marginBottom: 32, marginTop: 20 },
  lumiGlow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90, top: -20,
  },
  lumiSymbol: { fontSize: 72, marginBottom: 4 },
  lumiSubName: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(176,144,255,0.7)', letterSpacing: 2 },
  welcomeTitle: {
    fontSize: 48, fontFamily: 'Satoshi-Bold', color: '#F0E8FF',
    letterSpacing: -1.5, textAlign: 'center', marginBottom: 16,
  },
  welcomeSubtitle: {
    fontSize: 16, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.72)',
    lineHeight: 26, textAlign: 'center', marginBottom: 28,
  },
  transparencyNote: {
    backgroundColor: 'rgba(176,144,255,0.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(176,144,255,0.18)',
    paddingHorizontal: 18, paddingVertical: 12, marginBottom: 32,
  },
  transparencyText: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(176,144,255,0.7)', textAlign: 'center', lineHeight: 18 },
  startBtn: {
    width: SW - 48, height: 60, borderRadius: 30, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#8060C8', shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  startBtnText: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: 0.5 },
  modeCount: { marginTop: 20, fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(176,144,255,0.45)', letterSpacing: 1 },
});

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: Survey question
// ═══════════════════════════════════════════════════════════════════════════
function SurveyScreen({
  question, qIdx, total, onAnswer, answers,
}: {
  question: typeof QUESTIONS[0];
  qIdx: number; total: number;
  onAnswer: (qId: string, optId: string) => void;
  answers: Record<string, string>;
}) {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;
  const current = answers[question.id] ?? null;
  const progAnim = useRef(new Animated.Value((qIdx) / total)).current;

  useEffect(() => {
    Animated.timing(progAnim, { toValue: (qIdx + 1) / total, duration: 400, useNativeDriver: false }).start();
  }, [qIdx]);

  const progW = progAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad + 12 }]}>
      <LinearGradient colors={['#0B0818', '#130D28', '#1C1040']} style={StyleSheet.absoluteFill} />
      <StarField />

      {/* Progress bar */}
      <View style={surv.progTrack}>
        <Animated.View style={[surv.progFill, { width: progW }]}>
          <LinearGradient colors={['#B090FF', '#7050D0']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        </Animated.View>
      </View>
      <Text style={surv.progLabel}>{qIdx + 1} of {total}</Text>

      <ScrollView contentContainerStyle={surv.scroll} showsVerticalScrollIndicator={false}>
        <Text style={surv.emoji}>{question.emoji}</Text>
        <Text style={surv.question}>{question.q}</Text>

        {question.opts.map(opt => (
          <OptionCard
            key={opt.id}
            opt={opt}
            selected={current === opt.id}
            onPress={() => onAnswer(question.id, opt.id)}
            color="#B090FF"
          />
        ))}
      </ScrollView>
    </View>
  );
}

const surv = StyleSheet.create({
  progTrack: { height: 4, marginHorizontal: 24, backgroundColor: 'rgba(176,144,255,0.12)', borderRadius: 2, overflow: 'hidden' },
  progFill:  { height: 4, borderRadius: 2, overflow: 'hidden' },
  progLabel: { textAlign: 'right', paddingHorizontal: 24, marginTop: 6, fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(176,144,255,0.55)', letterSpacing: 0.5 },
  scroll:    { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 20 },
  emoji:     { fontSize: 40, marginBottom: 14, textAlign: 'center' },
  question:  { fontSize: 26, fontFamily: 'Satoshi-Bold', color: '#F0E8FF', marginBottom: 28, textAlign: 'center', lineHeight: 34 },
});

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: Analyzing
// ═══════════════════════════════════════════════════════════════════════════
function AnalyzingScreen() {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.6)).current;
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin,  { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.linear })
    ).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.85, duration: 1000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(dots, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.timing(dots, { toValue: 2, duration: 600, useNativeDriver: false }),
      Animated.timing(dots, { toValue: 3, duration: 600, useNativeDriver: false }),
      Animated.timing(dots, { toValue: 0, duration: 300, useNativeDriver: false }),
    ])).start();
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[StyleSheet.absoluteFill, anly.root]}>
      <LinearGradient colors={['#0B0818', '#130D28', '#1C1040']} style={StyleSheet.absoluteFill} />
      <StarField />
      <View style={anly.center}>
        {/* Outer ring */}
        <Animated.View style={[anly.ring, anly.ring1, { transform: [{ rotate }] }]} />
        {/* Inner pulse */}
        <Animated.View style={[anly.innerGlow, { transform: [{ scale: pulse }] }]}>
          <LinearGradient colors={['#B090FF66', '#7050D033']} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Text style={anly.symbol}>✦</Text>
        <Text style={anly.label}>Reading your{'\n'}constellation</Text>
        <DotsIndicator dotsAnim={dots} />
      </View>
    </View>
  );
}

function DotsIndicator({ dotsAnim }: { dotsAnim: Animated.Value }) {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setCount(c => (c % 3) + 1), 600);
    return () => clearInterval(id);
  }, []);
  return <Text style={anly.dots}>{'●'.repeat(count)}{'○'.repeat(3 - count)}</Text>;
}

const anly = StyleSheet.create({
  root:   { alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  ring:   { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 2 },
  ring1:  { borderColor: 'transparent', borderTopColor: '#B090FF', borderRightColor: '#B090FF55' },
  innerGlow: { width: 130, height: 130, borderRadius: 65, overflow: 'hidden', marginBottom: -130, opacity: 0.8 },
  symbol: { fontSize: 60, zIndex: 2, marginTop: 60 },
  label:  { fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.85)', textAlign: 'center', lineHeight: 28, marginTop: 28 },
  dots:   { fontSize: 14, color: 'rgba(176,144,255,0.55)', letterSpacing: 4, marginTop: 16 },
});

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: Mode Reveal
// ═══════════════════════════════════════════════════════════════════════════
function ModeRevealScreen({ config, onActivate }: { config: ModeConfig; onActivate: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const entry  = useRef(new Animated.Value(0)).current;
  const entryY = entry.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  useEffect(() => {
    Animated.timing(entry, { toValue: 1, duration: 800, delay: 100, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={config.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      {/* Color glow */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <View style={{ width: 300, height: 300, borderRadius: 150, backgroundColor: `${config.color}18` }} />
      </View>

      <ScrollView contentContainerStyle={rev.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: entry, transform: [{ translateY: entryY }], alignItems: 'center' }}>
          <Text style={rev.archetype}>✦ {config.archetype}</Text>
          <Text style={rev.symbol}>{config.symbol}</Text>
          <Text style={[rev.modeName, { color: config.color }]}>{config.name}</Text>
          <Text style={rev.tagline}>{config.tagline}</Text>
        </Animated.View>

        <Animated.View style={[rev.card, { opacity: entry, borderColor: `${config.color}25` }]}>
          <Text style={rev.desc}>{config.description}</Text>

          <View style={rev.traitsRow}>
            {config.traits.map(tr => (
              <View key={tr} style={[rev.traitChip, { backgroundColor: `${config.color}18`, borderColor: `${config.color}35` }]}>
                <Text style={[rev.traitText, { color: config.color }]}>{tr}</Text>
              </View>
            ))}
          </View>

          <Text style={rev.perksLabel}>WHAT CHANGES</Text>
          <View style={rev.perksRow}>
            {config.perks.map(p => <PerkChip key={p} text={p} color={config.color} />)}
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: entry }}>
          <Lumi message={config.lumiMessage} color={config.color} />
        </Animated.View>

        <Animated.View style={{ opacity: entry, transform: [{ translateY: entryY }] }}>
          <TouchableOpacity
            style={[rev.activateBtn, { backgroundColor: config.color }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onActivate(); }}
            activeOpacity={0.88}
          >
            <Text style={rev.activateBtnText}>Enter {config.name} ✦</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const rev = StyleSheet.create({
  scroll:     { paddingHorizontal: 24, paddingBottom: 60, alignItems: 'center' },
  archetype:  { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  symbol:     { fontSize: 72, marginBottom: 8 },
  modeName:   { fontSize: 36, fontFamily: 'Satoshi-Bold', letterSpacing: -0.8, marginBottom: 6 },
  tagline:    { fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(220,200,255,0.65)', marginBottom: 28 },
  card:       { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 8 },
  desc:       { fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(220,200,255,0.80)', lineHeight: 24, marginBottom: 18 },
  traitsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  traitChip:  { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  traitText:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  perksLabel: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 10 },
  perksRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activateBtn:{
    width: SW - 48, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
    shadowOpacity: 0.60, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 16,
  },
  activateBtnText: { fontSize: 17, fontFamily: 'Satoshi-Bold', color: '#fff' },
});

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: Session
// ═══════════════════════════════════════════════════════════════════════════
function SessionScreen({ config, sessionStart, onEnd }: { config: ModeConfig; sessionStart: number; onEnd: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const btmPad = Platform.OS === 'web' ? 80 : insets.bottom + 24;
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - sessionStart) / 1000));
  const [lumiIdx, setLumiIdx] = useState(0);
  const [eventIdx, setEventIdx] = useState(0);
  const [eventVisible, setEventVisible] = useState(false);
  const questProg = useRef(new Animated.Value(0.15)).current;
  const eventFade = useRef(new Animated.Value(0)).current;

  const lumiMessages = [config.lumiMessage, '✦ You\'re doing great. Keep going.', 'I\'m watching the stars with you.', 'This moment is yours. Breathe.'];

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setLumiIdx(i => (i + 1) % lumiMessages.length), 28000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.timing(questProg, {
      toValue: Math.min(0.15 + elapsed / 1200, 0.95),
      duration: 1200, useNativeDriver: false,
    }).start();
  }, [Math.floor(elapsed / 30)]);

  useEffect(() => {
    const showEvent = () => {
      setEventIdx(i => (i + 1) % config.events.length);
      setEventVisible(true);
      eventFade.setValue(0);
      Animated.sequence([
        Animated.timing(eventFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(6000),
        Animated.timing(eventFade, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setEventVisible(false));
    };
    const id = setInterval(showEvent, 30000);
    const first = setTimeout(showEvent, 5000);
    return () => { clearInterval(id); clearTimeout(first); };
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  const questW = questProg.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={config.gradient} style={StyleSheet.absoluteFill} />
      <StarField />

      {/* Floating event toast */}
      {eventVisible && (
        <Animated.View style={[sess.eventToast, { borderColor: `${config.color}40`, opacity: eventFade }]}>
          <LinearGradient colors={[`${config.color}22`, `${config.color}0A`]} style={StyleSheet.absoluteFill} />
          <Text style={[sess.eventText, { color: config.color }]}>{config.events[eventIdx]}</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={[sess.scroll, { paddingBottom: btmPad + 16 }]} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={sess.header}>
          <View>
            <Text style={sess.modeLabel}>{config.symbol} {config.name}</Text>
            <Text style={sess.timer}>{mm}:{ss}</Text>
          </View>
          <View style={[sess.activeBadge, { borderColor: `${config.color}40`, backgroundColor: `${config.color}15` }]}>
            <View style={[sess.activeDot, { backgroundColor: config.color }]} />
            <Text style={[sess.activeText, { color: config.color }]}>Active</Text>
          </View>
        </View>

        {/* Lumi */}
        <View style={[sess.card, { borderColor: `${config.color}20` }]}>
          <LinearGradient colors={[`${config.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Lumi message={lumiMessages[lumiIdx]} color={config.color} />
        </View>

        {/* Quest */}
        <View style={[sess.card, { borderColor: `${config.color}20`, padding: 20 }]}>
          <LinearGradient colors={[`${config.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={sess.questLabel}>TODAY'S QUEST</Text>
          <Text style={sess.questText}>{config.quest}</Text>
          <View style={sess.questProgTrack}>
            <Animated.View style={[sess.questProgFill, { width: questW }]}>
              <LinearGradient colors={[config.color, `${config.color}88`]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            </Animated.View>
          </View>
          <Text style={[sess.questRewards, { color: config.color }]}>✦ +30 Stars  🌙 +15%  upon completion</Text>
        </View>

        {/* Perks */}
        <View style={[sess.card, { borderColor: `${config.color}20`, padding: 18 }]}>
          <LinearGradient colors={[`${config.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={sess.questLabel}>ACTIVE PERKS</Text>
          <View style={sess.perksWrap}>
            {config.perks.map(p => <PerkChip key={p} text={p} color={config.color} />)}
          </View>
        </View>

        {/* End session */}
        <TouchableOpacity
          style={[sess.endBtn, { borderColor: `${config.color}45` }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onEnd(); }}
          activeOpacity={0.80}
        >
          <Text style={[sess.endBtnText, { color: config.color }]}>End Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const sess = StyleSheet.create({
  scroll:   { paddingHorizontal: 20, paddingTop: 16 },
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modeLabel:{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.7)', letterSpacing: 0.5, marginBottom: 4 },
  timer:    { fontSize: 38, fontFamily: 'Satoshi-Bold', color: '#F0E8FF', letterSpacing: -1 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  activeText: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.4 },
  card:     { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, marginBottom: 14, overflow: 'hidden' },
  questLabel: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 10 },
  questText:  { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#F0E8FF', lineHeight: 24, marginBottom: 14 },
  questProgTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  questProgFill:  { height: 6, borderRadius: 3, overflow: 'hidden' },
  questRewards:   { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  perksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  endBtn:    { borderWidth: 1, borderRadius: 24, paddingVertical: 16, alignItems: 'center', marginTop: 6 },
  endBtnText:{ fontSize: 15, fontFamily: 'Satoshi-Bold' },
  eventToast: {
    position: 'absolute', top: 80, left: 20, right: 20, zIndex: 50,
    borderRadius: 18, borderWidth: 1, overflow: 'hidden',
    paddingHorizontal: 18, paddingVertical: 14,
  },
  eventText: { fontSize: 14, fontFamily: 'Satoshi-Bold', lineHeight: 20 },
});

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: Reflection
// ═══════════════════════════════════════════════════════════════════════════
function ReflectionScreen({ config, sessionStart, onRestart }: { config: ModeConfig; sessionStart: number; onRestart: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const btmPad = Platform.OS === 'web' ? 80 : insets.bottom + 24;
  const entry  = useRef(new Animated.Value(0)).current;
  const entryY = entry.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  const elapsedSec = Math.floor((Date.now() - sessionStart) / 1000);
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');

  useEffect(() => {
    Animated.timing(entry, { toValue: 1, duration: 900, delay: 200, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={config.gradient} style={StyleSheet.absoluteFill} />
      <StarField />

      <ScrollView contentContainerStyle={[refl.scroll, { paddingBottom: btmPad + 24 }]} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: entry, transform: [{ translateY: entryY }], alignItems: 'center' }}>
          <Text style={refl.closingSymbol}>✦</Text>
          <Text style={refl.closingTitle}>Session complete,{'\n'}dreamer.</Text>
          <Text style={refl.closingSubtitle}>See you soon. The stars will be here when you return.</Text>
        </Animated.View>

        {/* Stats card */}
        <Animated.View style={[refl.statsCard, { borderColor: `${config.color}25`, opacity: entry }]}>
          <LinearGradient colors={[`${config.color}18`, 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={refl.statsRow}>
            <View style={refl.statItem}>
              <Text style={[refl.statVal, { color: config.color }]}>{mm}:{ss}</Text>
              <Text style={refl.statLabel}>Time Drifted</Text>
            </View>
            <View style={[refl.statDivider]} />
            <View style={refl.statItem}>
              <Text style={[refl.statVal, { color: config.color }]}>+30</Text>
              <Text style={refl.statLabel}>Stars Earned</Text>
            </View>
            <View style={[refl.statDivider]} />
            <View style={refl.statItem}>
              <Text style={[refl.statVal, { color: config.color }]}>+15%</Text>
              <Text style={refl.statLabel}>Sky Energy</Text>
            </View>
          </View>

          <View style={[refl.modeChip, { backgroundColor: `${config.color}18`, borderColor: `${config.color}35` }]}>
            <Text style={refl.modeChipEm}>{config.symbol}</Text>
            <Text style={[refl.modeChipText, { color: config.color }]}>{config.name} · {config.archetype}</Text>
          </View>
        </Animated.View>

        {/* Achievement */}
        <Animated.View style={[refl.achieveCard, { borderColor: `${config.color}30`, opacity: entry }]}>
          <Text style={refl.achieveLabel}>✦ NEW TITLE UNLOCKED</Text>
          <Text style={[refl.achieveTitle, { color: config.color }]}>Path Seeker</Text>
        </Animated.View>

        {/* Lumi farewell */}
        <Animated.View style={{ opacity: entry }}>
          <Lumi message="You showed up and that's everything. Rest well, dreamer. ✦" color={config.color} />
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[refl.actions, { opacity: entry }]}>
          <TouchableOpacity
            style={[refl.restartBtn, { backgroundColor: config.color }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRestart(); }}
            activeOpacity={0.88}
          >
            <Text style={refl.restartBtnText}>Start New Journey ✦</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[refl.breakBtn, { borderColor: `${config.color}40` }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRestart(); }}
            activeOpacity={0.80}
          >
            <Text style={[refl.breakBtnText, { color: config.color }]}>Take a Break · Save My Progress</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const refl = StyleSheet.create({
  scroll:         { paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  closingSymbol:  { fontSize: 64, marginBottom: 12 },
  closingTitle:   { fontSize: 32, fontFamily: 'Satoshi-Bold', color: '#F0E8FF', textAlign: 'center', lineHeight: 40, marginBottom: 12 },
  closingSubtitle:{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.60)', textAlign: 'center', marginBottom: 28 },
  statsCard:      { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, borderWidth: 1, overflow: 'hidden', padding: 22, marginBottom: 14 },
  statsRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  statItem:       { flex: 1, alignItems: 'center', gap: 4 },
  statVal:        { fontSize: 24, fontFamily: 'Satoshi-Bold' },
  statLabel:      { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,180,255,0.55)', textAlign: 'center' },
  statDivider:    { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
  modeChip:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'center' },
  modeChipEm:     { fontSize: 16 },
  modeChipText:   { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  achieveCard:    { width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 1, paddingVertical: 18, alignItems: 'center', marginBottom: 8 },
  achieveLabel:   { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 8 },
  achieveTitle:   { fontSize: 22, fontFamily: 'Satoshi-Bold' },
  actions:        { width: '100%', gap: 12, marginTop: 8 },
  restartBtn:     { width: '100%', height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 14 },
  restartBtnText: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#fff' },
  breakBtn:       { width: '100%', height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  breakBtnText:   { fontSize: 14, fontFamily: 'Satoshi-Bold' },
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN: DriftScreen
// ═══════════════════════════════════════════════════════════════════════════
export default function DriftScreen() {
  const [step,        setStep]        = useState<FlowStep>('welcome');
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers,     setAnswers]     = useState<Record<string, string>>({});
  const [mode,        setMode]        = useState<string | null>(null);
  const [sessionStart,setSessionStart]= useState<number | null>(null);

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  function go(next: FlowStep, setup?: () => void) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -24, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setup?.();
      setStep(next);
      slideAnim.setValue(24);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  }

  // Restore active session on mount
  useEffect(() => {
    AsyncStorage.getItem('drift_session_v1').then(saved => {
      if (!saved) return;
      try {
        const d = JSON.parse(saved);
        if (d.mode && d.sessionStart && (Date.now() - d.sessionStart) < 8 * 3600 * 1000) {
          setMode(d.mode);
          setAnswers(d.answers ?? {});
          setSessionStart(d.sessionStart);
          setStep('session');
        } else {
          AsyncStorage.removeItem('drift_session_v1');
        }
      } catch {}
    }).catch(() => {});
  }, []);

  function handleAnswer(qId: string, optId: string) {
    Haptics.selectionAsync();
    const newAnswers = { ...answers, [qId]: optId };
    setAnswers(newAnswers);

    setTimeout(() => {
      if (questionIdx < QUESTIONS.length - 1) {
        go('survey', () => setQuestionIdx(i => i + 1));
      } else {
        go('analyzing');
        const detected = detectMode(newAnswers);
        setTimeout(() => {
          setMode(detected);
          go('mode');
        }, 2900);
      }
    }, 320);
  }

  function handleActivate() {
    const start = Date.now();
    setSessionStart(start);
    AsyncStorage.setItem('drift_session_v1', JSON.stringify({ mode, answers, sessionStart: start })).catch(() => {});
    go('session');
  }

  function handleEnd() {
    AsyncStorage.removeItem('drift_session_v1').catch(() => {});
    go('reflection');
  }

  function handleRestart() {
    setQuestionIdx(0);
    setAnswers({});
    setMode(null);
    setSessionStart(null);
    AsyncStorage.removeItem('drift_session_v1').catch(() => {});
    go('welcome');
  }

  const cfg = mode ? MODES[mode] : null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {step === 'welcome'    && <WelcomeScreen  onStart={() => go('survey', () => setQuestionIdx(0))} />}
      {step === 'survey'     && <SurveyScreen   question={QUESTIONS[questionIdx]} qIdx={questionIdx} total={QUESTIONS.length} onAnswer={handleAnswer} answers={answers} />}
      {step === 'analyzing'  && <AnalyzingScreen />}
      {step === 'mode'       && cfg && <ModeRevealScreen config={cfg} onActivate={handleActivate} />}
      {step === 'session'    && cfg && <SessionScreen    config={cfg} sessionStart={sessionStart ?? Date.now()} onEnd={handleEnd} />}
      {step === 'reflection' && cfg && <ReflectionScreen config={cfg} sessionStart={sessionStart ?? Date.now()} onRestart={handleRestart} />}
    </Animated.View>
  );
}
