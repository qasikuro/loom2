import React, { useEffect, useRef, useState } from 'react';
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
import { useApp, apiFetch } from '@/context/AppContext';

const { width: SW } = Dimensions.get('window');

// ─── Flow ────────────────────────────────────────────────────────────────────
type FlowStep =
  | 'welcome' | 'survey' | 'allset'
  | 'analyzing' | 'vibe_reveal'
  | 'mode_cinematic' | 'mode_perks' | 'meet_lumi'
  | 'session' | 'guides'
  | 'summary' | 'reflection' | 'break_prompt' | 'farewell';

type SessionResult = { elapsed: number; questDone: number; momentsFound: number };

// ─── Survey data ─────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'session', q: 'How are you stepping in today?',
    opts: [
      { id: 'locked_in',     label: 'Locked In',           desc: "Numbers up, let's achieve goals",      em: '⚔️' },
      { id: 'just_existing', label: 'Just Existing',        desc: 'No pressure, just here',               em: '🌙' },
      { id: 'grinding',      label: 'Grinding Again',       desc: "Let's go, no giving up",               em: '🔥' },
      { id: 'escaping',      label: 'Escaping Reality',     desc: "Don't know what I'm doing here",       em: '🌀' },
    ],
  },
  {
    id: 'depth', q: 'How deep did you go recently?',
    opts: [
      { id: 'quick',      label: 'Just 10 mins',            desc: 'In and out, nice and clean',            em: '⚡' },
      { id: 'one_hour',   label: 'About 1 hour',             desc: 'A proper session',                     em: '🕐' },
      { id: 'two_three',  label: '2 – 3 hours',              desc: 'Deep in it',                           em: '🌊' },
      { id: 'three_plus', label: '3+ hours',                 desc: 'I looked outside and it was morning',  em: '🌄' },
    ],
  },
  {
    id: 'frequency', q: 'How often do you reopen the game?',
    opts: [
      { id: 'once_week',  label: 'Once a week',             desc: 'Quality over quantity',                em: '📅' },
      { id: 'daily',      label: 'Daily',                   desc: "It's part of the routine",             em: '⭐' },
      { id: 'multiple',   label: 'Multiple times daily',    desc: 'It keeps calling me back',             em: '🔔' },
      { id: 'instantly',  label: 'Close → reopen instantly',desc: "Can't stop, won't stop",               em: '🌀' },
    ],
  },
  {
    id: 'who', q: 'Who do you usually play with?',
    opts: [
      { id: 'friends',  label: 'Friends',                   desc: 'The squad shows up',                   em: '🤝' },
      { id: 'randoms',  label: 'Randoms',                   desc: "Whoever's around",                     em: '🌍' },
      { id: 'solo',     label: 'Solo only',                 desc: 'My world, my rules',                   em: '🌙' },
      { id: 'menus',    label: 'Just vibing in menus',      desc: 'The vibe is enough',                   em: '✨' },
    ],
  },
  {
    id: 'pull', q: 'What keeps pulling you back?',
    opts: [
      { id: 'progress',    label: 'Progress',               desc: 'Gotta see those numbers go up',        em: '📈' },
      { id: 'habit',       label: 'Habit',                  desc: "It's just what I do now",              em: '🔁' },
      { id: 'comfort',     label: 'Comfort',                desc: 'It feels safe here',                   em: '🏡' },
      { id: 'competition', label: 'Competition',            desc: 'I will not be last',                   em: '🏆' },
    ],
  },
  {
    id: 'energy', q: 'How would you describe your energy right now?',
    opts: [
      { id: 'clear',   label: 'Clear and ready',            desc: "Focused, let's go",                    em: '☀️' },
      { id: 'calm',    label: 'Calm but here',              desc: 'Peaceful and present',                 em: '🌙' },
      { id: 'drained', label: 'Drained but pushing',        desc: 'Running on fumes',                     em: '🌧️' },
      { id: 'wired',   label: 'Wired and intense',          desc: "Brain won't stop, let's use it",      em: '⚡' },
    ],
  },
];

// ─── Mode config ──────────────────────────────────────────────────────────────
// ─── AI plan (from /api/drift/analyze) ───────────────────────────────────────
interface DriftQuest { title: string; description: string; type: string; }
interface DriftPlan {
  mode: string; archetype: string; confidence: number;
  intention: string;
  lumiIntro: string; lumiMessages: string[];
  quests: DriftQuest[];
  softRescue: string; reflection: string;
  evolution: [string, string, string]; stability: number;
}

interface ModeConfig {
  name: string; archetype: string; symbol: string; color: string;
  gradient: readonly [string, string, string]; bg: readonly [string, string];
  tagline: string; description: string; traits: string[];
  perks: string[]; whatChanged: string[];
  lumiIntro: string; lumiSession: string;
  lumiMessages?: string[];
  intention?: string;
  quest: string; questTotal: number;
  quests?: DriftQuest[];
  events: string[]; softRescue: string;
  reflection: string;
  evolution: [string, string, string];
  stability: number;
}

const MODES: Record<string, ModeConfig> = {
  challenge: {
    name: 'Challenge Mode', archetype: 'The Locked-In Achiever', symbol: '⚔️',
    color: '#FF7070', gradient: ['#2A0808', '#3E1010', '#4E1818'] as const,
    bg: ['#1A0404', '#2A0808'] as const,
    tagline: 'High focus. Hard goals. No ceiling.',
    description: "You're locked in and ready to push. You discover things through persistence — and right now, that engine is running hot.",
    traits: ['Goal-driven', 'High intensity', 'Achievement-focused'],
    perks: ['Hard Objectives Active', 'Adaptive Events On', 'Streak Tracking'],
    whatChanged: ['Hard objectives are now available', 'Achievement tracking is enabled', 'Competitive events will surface', 'Lumi tracks your milestones'],
    lumiIntro: "I can feel your focus from here. Let's channel it into something real.",
    lumiSession: "Let's go. I'll be right there pushing with you. ⚔️",
    quest: 'Complete 3 objectives without stopping', questTotal: 3,
    events: ['⚔️ Hard Mode engaged — objectives scaled up', '🔥 Streak building — keep the momentum!', '📊 You\'re performing in the top tier today', '🏆 Milestone reached: Relentless'],
    softRescue: 'Try the harder path. It might be what you\'re really looking for.',
    reflection: "You pushed hard, reached further, and didn't stop when it got difficult. That's not just a session — that's character.",
    evolution: ['Locked In', 'Peak Performer', 'Trail Blazer'],
    stability: 88,
  },
  flow: {
    name: 'Flow Mode', archetype: 'The Peaceful Drifter', symbol: '🌊',
    color: '#6BC5FF', gradient: ['#08182A', '#102238', '#183248'] as const,
    bg: ['#040E1A', '#08182A'] as const,
    tagline: 'Calm, steady, pressure-free.',
    description: "You're here for the journey, not the destination. Flow Mode removes pressure and lets beauty surface naturally — because that's how you move.",
    traits: ['Relaxed focus', 'Journey-minded', 'Pressure-free'],
    perks: ['Pressure Removed', 'Ambient Depth +', 'Rare Drops Increased'],
    whatChanged: ['Timers and pressure are off', 'Ambient beauty is amplified', 'Rare moments surface more often', 'Lumi guides without pushing'],
    lumiIntro: "Take your time. I'll walk with you — no rush, no pressure. Just the path.",
    lumiSession: 'No rush. The path will always open for you. 🌊',
    quest: 'Explore one new area without a timer', questTotal: 1,
    events: ['🌊 Calm zone active — breathe easy', '🌿 A hidden path appears...', '🎵 Ambient depth engaged', '✦ Something beautiful found you'],
    softRescue: 'Try the northern bridge. Take your time with it.',
    reflection: "You embraced the calm, explored deeply, and stayed true to your path. That's growth. Keep going.",
    evolution: ['Peaceful Drifter', 'Flow Wanderer', 'Eternal Drifter'],
    stability: 82,
  },
  echo: {
    name: 'Echo Mode', archetype: 'The Lone Wanderer', symbol: '🌙',
    color: '#B090FF', gradient: ['#100828', '#1C1040', '#281850'] as const,
    bg: ['#080418', '#100828'] as const,
    tagline: 'Explore, reflect, discover.',
    description: "You enjoy solitude and exploration. You discover things others miss. Echo Mode gives you space to go deep — with a companion who knows when to stay quiet.",
    traits: ['Independent', 'Deep Thinker', 'Exploration Seeker'],
    perks: ['Guided Hints On', 'Discovery Boost', 'Companion Enabled'],
    whatChanged: ['Cutting guidance in the world', 'Faster resource discovery', 'Calmer overall experience', 'Companion walks with you quietly'],
    lumiIntro: "I'll be here with you. I won't push — just walk alongside.",
    lumiSession: "I'll be here with you. Need anything, just ask. 🌙",
    quest: 'Find 3 hidden places no one talks about', questTotal: 3,
    events: ['🌙 The old guide whispers a hint...', '✧ A hidden constellation appears above you', '🔍 Something glowing just over there...', '🌙 A secret path opened for you'],
    softRescue: 'The old guide whispers: Try the northern bridge. It may help.',
    reflection: "You walked alone and found things others miss. Every quiet step you took was a discovery.",
    evolution: ['Lone Wanderer', 'Path Seeker', 'Trail Blazer'],
    stability: 79,
  },
  social: {
    name: 'Social Mode', archetype: 'The Social Hunter', symbol: '✨',
    color: '#6BD48A', gradient: ['#08200E', '#102A16', '#183A1E'] as const,
    bg: ['#04100A', '#08200E'] as const,
    tagline: 'Connect, level up, vibe.',
    description: "You thrive around others. Social Mode activates party boosts, surfaces nearby players to connect with, and turns shared moments into something lasting.",
    traits: ['Community-driven', 'Collaborative', 'Socially energized'],
    perks: ['Party Finder Active', 'Group Rewards +', 'Social Events On'],
    whatChanged: ['Party finder is now live', 'Group rewards are doubled', 'Social events are surfacing', 'Lumi introduces you to kind souls'],
    lumiIntro: "There are good people out here. Let's find them together.",
    lumiSession: 'A kind soul is nearby. Want to join their journey? ✨',
    quest: 'Connect with one new player today', questTotal: 1,
    events: ['👥 A kind soul is nearby!', '🎉 Group bonus activated', '🌟 Someone just joined your path', '💫 A community moment is forming'],
    softRescue: 'A kind soul spotted something nearby. They thought you should know.',
    reflection: "You reached out, connected, and made this world feel less alone. That energy stays with the people you touched.",
    evolution: ['Social Hunter', 'Community Weaver', 'Soul Connector'],
    stability: 84,
  },
  clarity: {
    name: 'Clarity Mode', archetype: 'The Strategic Mind', symbol: '🔮',
    color: '#FFD86F', gradient: ['#1A1200', '#2A1E00', '#3A2A00'] as const,
    bg: ['#0E0A00', '#1A1200'] as const,
    tagline: 'Find direction. No stress.',
    description: "You want to understand your path before you walk it. Clarity Mode maps the way forward — one intentional step at a time.",
    traits: ['Strategic', 'Progress-aware', 'Direction-seeking'],
    perks: ['Smart Suggestions On', 'Path Mapped', 'Priority Visible'],
    whatChanged: ['Smart quest suggestions are on', 'Your progress is mapped clearly', 'The priority path is highlighted', 'Lumi helps you choose wisely'],
    lumiIntro: "Let's figure this out together. I can see a few paths forward from here.",
    lumiSession: "Let's figure this out together. I see a path forward. 🔮",
    quest: 'Identify your top priority and take one step', questTotal: 1,
    events: ['🔮 Smart suggestion available', '📍 Priority path identified', '💡 New insight unlocked', '🗺️ Your progress map was updated'],
    softRescue: 'Start with the thing that feels most stuck. That\'s usually the right move.',
    reflection: "You chose to understand before you acted. That kind of patience shapes everything that follows.",
    evolution: ['Strategic Mind', 'Pathfinder', 'Visionary'],
    stability: 81,
  },
  recovery: {
    name: 'Recovery Mode', archetype: 'The Burnout Drifter', symbol: '🌸',
    color: '#FF89B0', gradient: ['#200814', '#301220', '#401A2C'] as const,
    bg: ['#100408', '#200814'] as const,
    tagline: 'You matter. Take it slow.',
    description: "You need rest, not pressure. Recovery Mode removes all friction and gives you gentle wins, soft support, and the reminder that just showing up is already enough.",
    traits: ['Burnout-aware', 'Needs gentleness', 'Recovery-focused'],
    perks: ['All Pressure Off', 'Easy Moments Surface', 'Gentle Check-ins'],
    whatChanged: ['All timers and pressure are removed', 'Easy wins will surface for you', 'Mood is gently lifted', 'Lumi checks in softly, without asking too much'],
    lumiIntro: "Hey. You showed up. I know that wasn't easy. I'm proud of you.",
    lumiSession: "Hey. You showed up. That's already enough. 🌸",
    quest: 'Do one thing that brings you peace today', questTotal: 1,
    events: ['🌸 Easy moment available nearby', '☕ Take it slow — you\'re doing great', '✨ A gentle uplift found you', '🌷 A peaceful moment is yours if you want it'],
    softRescue: 'Take it slow. There\'s no rush here. Rest is part of the journey.',
    reflection: "You showed up even when it was hard. That's not weakness — that's the bravest thing there is.",
    evolution: ['Burnout Drifter', 'Gentle Soul', 'Renewed Spirit'],
    stability: 73,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function detectMode(a: Record<string, string>): string {
  const s: Record<string, number> = { challenge: 0, flow: 0, echo: 0, social: 0, clarity: 0, recovery: 0 };
  if (a.session === 'locked_in')     { s.challenge += 3; s.clarity  += 1; }
  if (a.session === 'just_existing') { s.recovery  += 3; s.flow     += 1; }
  if (a.session === 'grinding')      { s.challenge += 2; s.flow     += 2; }
  if (a.session === 'escaping')      { s.echo      += 3; s.recovery += 1; }
  if (a.depth === 'quick')           { s.recovery  += 2; s.social   += 1; }
  if (a.depth === 'one_hour')        { s.flow      += 2; s.clarity  += 1; }
  if (a.depth === 'two_three')       { s.flow      += 1; s.echo     += 2; }
  if (a.depth === 'three_plus')      { s.challenge += 2; s.echo     += 2; }
  if (a.frequency === 'once_week')   { s.recovery  += 2; s.social   += 1; }
  if (a.frequency === 'daily')       { s.flow      += 2; s.social   += 1; }
  if (a.frequency === 'multiple')    { s.challenge += 2; s.echo     += 1; }
  if (a.frequency === 'instantly')   { s.echo      += 2; s.challenge += 1; }
  if (a.who === 'friends')           { s.social    += 3; }
  if (a.who === 'randoms')           { s.social    += 2; s.challenge += 1; }
  if (a.who === 'solo')              { s.echo      += 2; s.clarity  += 2; }
  if (a.who === 'menus')             { s.recovery  += 3; s.flow     += 1; }
  if (a.pull === 'progress')         { s.challenge += 2; s.clarity  += 2; }
  if (a.pull === 'habit')            { s.flow      += 3; }
  if (a.pull === 'comfort')          { s.recovery  += 3; }
  if (a.pull === 'competition')      { s.challenge += 3; }
  if (a.energy === 'clear')          { s.challenge += 1; s.clarity  += 2; }
  if (a.energy === 'calm')           { s.flow      += 3; s.echo     += 1; }
  if (a.energy === 'drained')        { s.recovery  += 3; }
  if (a.energy === 'wired')          { s.challenge += 2; s.echo     += 1; }
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}

function calcConfidence(a: Record<string, string>): number {
  const s: Record<string, number> = { challenge: 0, flow: 0, echo: 0, social: 0, clarity: 0, recovery: 0 };
  detectMode(a); // side-effect free — recalculate inline
  if (a.session === 'locked_in')     { s.challenge += 3; s.clarity  += 1; }
  if (a.session === 'just_existing') { s.recovery  += 3; s.flow     += 1; }
  if (a.session === 'grinding')      { s.challenge += 2; s.flow     += 2; }
  if (a.session === 'escaping')      { s.echo      += 3; s.recovery += 1; }
  if (a.depth === 'quick')           { s.recovery  += 2; s.social   += 1; }
  if (a.depth === 'one_hour')        { s.flow      += 2; s.clarity  += 1; }
  if (a.depth === 'two_three')       { s.flow      += 1; s.echo     += 2; }
  if (a.depth === 'three_plus')      { s.challenge += 2; s.echo     += 2; }
  if (a.frequency === 'once_week')   { s.recovery  += 2; s.social   += 1; }
  if (a.frequency === 'daily')       { s.flow      += 2; s.social   += 1; }
  if (a.frequency === 'multiple')    { s.challenge += 2; s.echo     += 1; }
  if (a.frequency === 'instantly')   { s.echo      += 2; s.challenge += 1; }
  if (a.who === 'friends')           { s.social    += 3; }
  if (a.who === 'randoms')           { s.social    += 2; s.challenge += 1; }
  if (a.who === 'solo')              { s.echo      += 2; s.clarity  += 2; }
  if (a.who === 'menus')             { s.recovery  += 3; s.flow     += 1; }
  if (a.pull === 'progress')         { s.challenge += 2; s.clarity  += 2; }
  if (a.pull === 'habit')            { s.flow      += 3; }
  if (a.pull === 'comfort')          { s.recovery  += 3; }
  if (a.pull === 'competition')      { s.challenge += 3; }
  if (a.energy === 'clear')          { s.challenge += 1; s.clarity  += 2; }
  if (a.energy === 'calm')           { s.flow      += 3; s.echo     += 1; }
  if (a.energy === 'drained')        { s.recovery  += 3; }
  if (a.energy === 'wired')          { s.challenge += 2; s.echo     += 1; }
  const vals = Object.values(s);
  const total = vals.reduce((acc, v) => acc + v, 0);
  const top   = Math.max(...vals);
  return total > 0 ? Math.max(66, Math.min(96, Math.round((top / total) * 100))) : 75;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Stars background ─────────────────────────────────────────────────────────
const STAR_DATA = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  left: ((i * 37 + 11) % 97) + '%',
  top:  ((i * 53 + 7)  % 95) + '%',
  size: ((i * 13) % 3) + 1,
  dur:  1600 + (i * 211) % 2400,
  delay: (i * 157) % 2200,
}));

function StarField() {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {STAR_DATA.map(s => <StarDot key={s.id} s={s} />)}
    </View>
  );
}

function StarDot({ s }: { s: typeof STAR_DATA[0] }) {
  const op = useRef(new Animated.Value(0.08)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(s.delay),
      Animated.timing(op, { toValue: 0.85,  duration: s.dur, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.05, duration: s.dur, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: s.left as any, top: s.top as any,
      width: s.size, height: s.size, borderRadius: s.size,
      backgroundColor: '#ffffff', opacity: op,
    }} />
  );
}

// ─── Constellation (Analyzing screen) ────────────────────────────────────────
const C_SIZE = 200;
const C_PTS  = [
  { x: 0.50, y: 0.08 }, { x: 0.84, y: 0.30 }, { x: 0.75, y: 0.68 },
  { x: 0.50, y: 0.88 }, { x: 0.25, y: 0.68 }, { x: 0.16, y: 0.30 },
];
const C_LINES: [number, number][] = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,3],[1,4],[2,5],
];

function ConstellationLine({ p1, p2, anim }: { p1: typeof C_PTS[0]; p2: typeof C_PTS[0]; anim: Animated.Value }) {
  const cx   = ((p1.x + p2.x) / 2) * C_SIZE;
  const cy   = ((p1.y + p2.y) / 2) * C_SIZE;
  const len  = Math.sqrt(Math.pow((p2.x - p1.x) * C_SIZE, 2) + Math.pow((p2.y - p1.y) * C_SIZE, 2));
  const angle = Math.atan2((p2.y - p1.y) * C_SIZE, (p2.x - p1.x) * C_SIZE) * (180 / Math.PI);
  return (
    <Animated.View style={{
      position: 'absolute', left: cx - len / 2, top: cy - 0.5,
      width: len, height: 1, backgroundColor: 'rgba(176,144,255,0.45)',
      transform: [{ rotate: `${angle}deg` }],
      opacity: anim,
    }} />
  );
}

function Constellation({ color = '#B090FF' }: { color?: string }) {
  const lineAnims = useRef<Animated.Value[]>(C_LINES.map(() => new Animated.Value(0))).current;
  const dotAnims  = useRef<Animated.Value[]>(C_PTS.map(()  => new Animated.Value(0))).current;

  useEffect(() => {
    const seq = C_LINES.map((_, i) =>
      Animated.parallel([
        Animated.timing(lineAnims[i], { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnims[i % C_PTS.length],  { toValue: 1, duration: 250, useNativeDriver: true }),
      ])
    );
    Animated.stagger(280, seq).start();
  }, []);

  return (
    <View style={{ width: C_SIZE, height: C_SIZE }}>
      {C_LINES.map(([a, b], i) => (
        <ConstellationLine key={i} p1={C_PTS[a]} p2={C_PTS[b]} anim={lineAnims[i]} />
      ))}
      {C_PTS.map((pt, i) => (
        <Animated.View key={i} style={{
          position: 'absolute',
          left: pt.x * C_SIZE - 5, top: pt.y * C_SIZE - 5,
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: color,
          opacity: dotAnims[i],
          shadowColor: color, shadowOpacity: 0.9, shadowRadius: 8,
        }} />
      ))}
    </View>
  );
}

// ─── Lumi mascot ──────────────────────────────────────────────────────────────
function LumiCharacter({ color = '#B090FF', size = 80 }: { color?: string; size?: number }) {
  const bob       = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;
  const eyeOp     = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -8, duration: 1900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(bob, { toValue: 0,  duration: 1900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowPulse, { toValue: 1,    duration: 2100, useNativeDriver: true }),
      Animated.timing(glowPulse, { toValue: 0.35, duration: 2100, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(3800),
      Animated.timing(eyeOp, { toValue: 0.05, duration: 75,  useNativeDriver: true }),
      Animated.timing(eyeOp, { toValue: 1,    duration: 75,  useNativeDriver: true }),
      Animated.delay(200),
      Animated.timing(eyeOp, { toValue: 0.05, duration: 75,  useNativeDriver: true }),
      Animated.timing(eyeOp, { toValue: 1,    duration: 75,  useNativeDriver: true }),
    ])).start();
  }, []);

  const bw   = size;
  const bh   = size * 1.15;
  const ew   = size * 0.135;
  const earW = size * 0.22;
  const earH = size * 0.30;

  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ translateY: bob }] }}>
      {/* Outer glow */}
      <Animated.View style={{
        position: 'absolute', width: size * 1.75, height: size * 1.75,
        borderRadius: size * 0.875, backgroundColor: `${color}18`,
        top: -size * 0.16, opacity: glowPulse,
      }} />
      {/* Inner glow ring */}
      <View style={{
        position: 'absolute', width: size * 1.25, height: size * 1.25,
        borderRadius: size * 0.625, borderWidth: 1, borderColor: `${color}28`, top: 0,
      }} />

      {/* Left ear/horn */}
      <View style={{
        position: 'absolute', width: earW, height: earH, borderRadius: earW / 2,
        backgroundColor: color, top: earH * 0.10, left: size * 0.15, zIndex: 1,
        transform: [{ rotate: '-14deg' }],
        shadowColor: color, shadowOpacity: 0.55, shadowRadius: 8,
      }} />
      {/* Right ear/horn */}
      <View style={{
        position: 'absolute', width: earW, height: earH, borderRadius: earW / 2,
        backgroundColor: color, top: earH * 0.10, right: size * 0.15, zIndex: 1,
        transform: [{ rotate: '14deg' }],
        shadowColor: color, shadowOpacity: 0.55, shadowRadius: 8,
      }} />

      {/* Body */}
      <View style={{
        width: bw, height: bh, borderRadius: bw * 0.48, backgroundColor: color,
        overflow: 'hidden', alignItems: 'center', zIndex: 2,
        marginTop: earH * 0.52,
        shadowColor: color, shadowOpacity: 0.65, shadowRadius: 16,
      }}>
        {/* Highlight sheen */}
        <LinearGradient
          colors={['rgba(255,255,255,0.44)', 'rgba(255,255,255,0.07)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: bh * 0.52 }}
        />
        {/* Left eye */}
        <Animated.View style={{
          position: 'absolute', top: bh * 0.27, left: bw * 0.18,
          width: ew * 1.65, height: ew * 1.65, borderRadius: ew * 0.82,
          backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center',
          justifyContent: 'center', opacity: eyeOp,
        }}>
          <View style={{ width: ew * 0.80, height: ew * 0.80, borderRadius: ew * 0.40, backgroundColor: 'rgba(50,15,130,0.92)' }} />
          <View style={{ position: 'absolute', top: ew * 0.08, left: ew * 0.08, width: ew * 0.34, height: ew * 0.34, borderRadius: ew * 0.17, backgroundColor: 'rgba(255,255,255,0.92)' }} />
        </Animated.View>
        {/* Right eye */}
        <Animated.View style={{
          position: 'absolute', top: bh * 0.27, right: bw * 0.18,
          width: ew * 1.65, height: ew * 1.65, borderRadius: ew * 0.82,
          backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center',
          justifyContent: 'center', opacity: eyeOp,
        }}>
          <View style={{ width: ew * 0.80, height: ew * 0.80, borderRadius: ew * 0.40, backgroundColor: 'rgba(50,15,130,0.92)' }} />
          <View style={{ position: 'absolute', top: ew * 0.08, right: ew * 0.08, width: ew * 0.34, height: ew * 0.34, borderRadius: ew * 0.17, backgroundColor: 'rgba(255,255,255,0.92)' }} />
        </Animated.View>
        {/* Blush left */}
        <View style={{ position: 'absolute', top: bh * 0.46, left: bw * 0.09, width: bw * 0.22, height: bh * 0.10, borderRadius: bw * 0.11, backgroundColor: 'rgba(255,150,195,0.38)' }} />
        {/* Blush right */}
        <View style={{ position: 'absolute', top: bh * 0.46, right: bw * 0.09, width: bw * 0.22, height: bh * 0.10, borderRadius: bw * 0.11, backgroundColor: 'rgba(255,150,195,0.38)' }} />
      </View>

      {/* Ghost tail */}
      <View style={{
        width: bw * 0.50, height: bh * 0.18, borderRadius: bw * 0.14,
        backgroundColor: color, opacity: 0.72, marginTop: -bh * 0.04, zIndex: 1,
      }} />

      {/* Sparkles */}
      <View style={{ position: 'absolute', top: -4, right: -4, zIndex: 10 }}>
        <Text style={{ fontSize: 11, color: `${color}CC` }}>✦</Text>
      </View>
      <View style={{ position: 'absolute', top: bh * 0.28, left: -2, zIndex: 10 }}>
        <Text style={{ fontSize: 7, color: `${color}88` }}>✦</Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color, letterSpacing: 1.5, marginTop: 6, opacity: 0.75 }}>LUMI</Text>
    </Animated.View>
  );
}

function LumiChat({ message, color = '#B090FF' }: { message: string; color?: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }).start();
  }, [message]);
  return (
    <Animated.View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, opacity: fade }}>
      <LumiCharacter color={color} size={68} />
      <View style={{
        flex: 1, backgroundColor: `${color}10`, borderRadius: 18, borderTopLeftRadius: 4,
        borderWidth: 1, borderColor: `${color}28`, padding: 14, marginBottom: 16,
      }}>
        <Text style={{ fontSize: 13.5, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.88)', lineHeight: 21, fontStyle: 'italic' }}>
          "{message}"
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Option card ──────────────────────────────────────────────────────────────
type OptItem = { id: string; label: string; desc: string; em: string };
function OptionCard({ opt, selected, onPress, color }: { opt: OptItem; selected: boolean; onPress: () => void; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  function press() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 70,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 130, useNativeDriver: true }),
    ]).start();
    onPress();
  }
  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        style={[
          oc.card,
          selected
            ? { backgroundColor: `${color}1C`, borderColor: `${color}70`, borderWidth: 2 }
            : { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)', borderWidth: 1 },
        ]}
        onPress={press}
        activeOpacity={0.85}
      >
        <Text style={oc.em}>{opt.em}</Text>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[oc.label, selected && { color }]}>{opt.label}</Text>
          <Text style={oc.desc}>{opt.desc}</Text>
        </View>
        {selected && (
          <View style={[oc.check, { backgroundColor: color }]}>
            <Text style={{ fontSize: 11, color: '#fff', fontFamily: 'Satoshi-Bold' }}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
const oc = StyleSheet.create({
  card:  { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 15 },
  em:    { fontSize: 26, width: 36, textAlign: 'center' },
  label: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#EEE4FF' },
  desc:  { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.55)' },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

// ─── Shared buttons ───────────────────────────────────────────────────────────
function PrimaryBtn({ label, onPress, color, muted = false }: { label: string; onPress: () => void; color: string; muted?: boolean }) {
  return (
    <TouchableOpacity
      style={[pb.btn, muted
        ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: `${color}45` }
        : { backgroundColor: color, shadowColor: color, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 }
      ]}
      onPress={() => { Haptics.impactAsync(muted ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium); onPress(); }}
      activeOpacity={0.87}
    >
      <Text style={[pb.text, muted && { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const pb = StyleSheet.create({
  btn:  { width: SW - 48, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { fontSize: 17, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: 0.3 },
});

function TraitPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, backgroundColor: `${color}14`, borderColor: `${color}35` }}>
      <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color }}>{label}</Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREENS
// ════════════════════════════════════════════════════════════════════════════

function WelcomeScreen({ onStart, name }: { onStart: () => void; name: string }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 900, delay: 150, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={['#080614', '#0E0A24', '#160E38']} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, alignItems: 'center', paddingTop: 24 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, transform: [{ translateY: enterY }], alignItems: 'center', marginBottom: 32 }}>
          <LumiCharacter color="#B090FF" size={110} />
        </Animated.View>
        <Animated.View style={{ opacity: enter, transform: [{ translateY: enterY }], alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(176,144,255,0.65)', letterSpacing: 2, marginBottom: 10, textTransform: 'uppercase' }}>
            Welcome to
          </Text>
          <Text style={{ fontSize: 52, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', letterSpacing: -2, textAlign: 'center', lineHeight: 58 }}>
            {name} ✦
          </Text>
        </Animated.View>
        <Animated.Text style={{ opacity: enter, fontSize: 16, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.68)', lineHeight: 26, textAlign: 'center', marginBottom: 28 }}>
          A space for your memories, stories and peaceful moments.
        </Animated.Text>
        <Animated.View style={{ opacity: enter, backgroundColor: 'rgba(176,144,255,0.07)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(176,144,255,0.16)', paddingHorizontal: 20, paddingVertical: 14, marginBottom: 32, width: '100%' }}>
          <Text style={{ fontSize: 12.5, fontFamily: 'Satoshi-Regular', color: 'rgba(190,170,255,0.72)', textAlign: 'center', lineHeight: 20 }}>
            ✦ A quick vibe check — 6 questions — personalises your journey.{'\n'}Your responses stay on your device. Always.
          </Text>
        </Animated.View>
        <Animated.View style={{ opacity: enter, alignItems: 'center', gap: 12, width: '100%' }}>
          <PrimaryBtn label="Start Journey ✦" onPress={onStart} color="#7050C8" />
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(176,144,255,0.45)' }}>
            6 drift modes · Lumi companion · Session quests
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SurveyScreen({ question, qIdx, total, onAnswer, answers }: {
  question: typeof QUESTIONS[0]; qIdx: number; total: number;
  onAnswer: (qId: string, optId: string) => void; answers: Record<string, string>;
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const current = answers[question.id] ?? null;
  const progAnim = useRef(new Animated.Value((qIdx) / total)).current;
  useEffect(() => {
    Animated.timing(progAnim, { toValue: (qIdx + 1) / total, duration: 420, useNativeDriver: false }).start();
  }, [qIdx]);
  const progW = progAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad + 8 }]}>
      <LinearGradient colors={['#080614', '#0E0A24', '#160E38']} style={StyleSheet.absoluteFill} />
      <StarField />
      <View style={{ height: 3, marginHorizontal: 24, backgroundColor: 'rgba(176,144,255,0.10)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        <Animated.View style={{ height: 3, width: progW, borderRadius: 2, overflow: 'hidden' }}>
          <LinearGradient colors={['#9870E8', '#6050C0']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
        </Animated.View>
      </View>
      <Text style={{ textAlign: 'right', paddingHorizontal: 24, marginBottom: 4, fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(176,144,255,0.5)', letterSpacing: 0.5 }}>
        {qIdx + 1} / {total}
      </Text>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 28, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 28, textAlign: 'center', lineHeight: 36 }}>
          {question.q}
        </Text>
        {question.opts.map(opt => (
          <OptionCard key={opt.id} opt={opt} selected={current === opt.id}
            onPress={() => onAnswer(question.id, opt.id)} color="#B090FF" />
        ))}
      </ScrollView>
    </View>
  );
}

function AllSetScreen({ onBegin }: { onBegin: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
  }, []);
  const points = [
    'Your drift mode will be personalised to your vibe',
    'Lumi will adapt to how you\'re feeling today',
    'Session quests match your energy level',
    'No judgement — every mode is the right mode',
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
      <LinearGradient colors={['#080614', '#0E0A24', '#160E38']} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, alignItems: 'center', paddingTop: 40 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <Text style={{ fontSize: 56, marginBottom: 8 }}>✦</Text>
          <Text style={{ fontSize: 38, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 10, letterSpacing: -1 }}>All set!</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.70)', textAlign: 'center', lineHeight: 26, marginBottom: 36 }}>
            We'll personalise your journey just for you.
          </Text>
          <View style={{ width: SW - 56, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(176,144,255,0.20)', padding: 22, marginBottom: 36 }}>
            {points.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: i < points.length - 1 ? 18 : 0 }}>
                <Text style={{ fontSize: 14, color: '#B090FF', marginTop: 2 }}>✦</Text>
                <Text style={{ flex: 1, fontSize: 14, color: '#EDE4FF', lineHeight: 22 }}>{p}</Text>
              </View>
            ))}
          </View>
          <PrimaryBtn label="Let's Begin ✦" onPress={onBegin} color="#7050C8" />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function AnalyzingScreen({ confidence }: { confidence: number }) {
  const spin   = useRef(new Animated.Value(0)).current;
  const [pct, setPct] = useState(0);
  const labels = ['Reading the stars of your answers', 'Mapping your constellation', 'Almost there...'];
  const [labelIdx, setLabelIdx] = useState(0);

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.linear })).start();
    const target  = confidence;
    const steps   = 38;
    const stepMs  = 2600 / steps;
    let current   = 0;
    const id = setInterval(() => {
      current = Math.min(current + target / steps, target);
      setPct(Math.round(current));
      if (current >= target) clearInterval(id);
    }, stepMs);
    const lbl = setInterval(() => setLabelIdx(i => Math.min(i + 1, labels.length - 1)), 1100);
    return () => { clearInterval(id); clearInterval(lbl); };
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <LinearGradient colors={['#080614', '#0E0A24', '#160E38']} style={StyleSheet.absoluteFill} />
      <StarField />
      <Constellation />
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Animated.View style={{ width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: 'transparent', borderTopColor: '#B090FF', borderRightColor: '#B090FF55', transform: [{ rotate }], position: 'absolute' }} />
        <Text style={{ fontSize: 48, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', letterSpacing: -1, marginTop: 220 }}>{pct}%</Text>
        <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.65)', marginTop: 8, textAlign: 'center' }}>
          {labels[labelIdx]}
        </Text>
      </View>
    </View>
  );
}

function VibeRevealScreen({ cfg, confidence, onContinue }: { cfg: ModeConfig; confidence: number; onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const archScale = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(enter,    { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(archScale,{ toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, alignItems: 'center', paddingTop: 28 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
            Your Vibe for Today
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View style={[{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}40` }]}>
              <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: cfg.color }}>
                {confidence}% match
              </Text>
            </View>
          </View>
          <Animated.Text style={{ fontSize: 42, fontFamily: 'Satoshi-Bold', color: cfg.color, textAlign: 'center', letterSpacing: -1, transform: [{ scale: archScale }] }}>
            {cfg.archetype.replace('The ', '')}
          </Animated.Text>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(210,195,255,0.65)', marginTop: 4, letterSpacing: 0.5 }}>
            {cfg.symbol}  {cfg.archetype}
          </Text>
          {cfg.intention ? (
            <View style={{ marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: `${cfg.color}14`, borderWidth: 1, borderColor: `${cfg.color}30` }}>
              <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(230,215,255,0.85)', textAlign: 'center', fontStyle: 'italic', lineHeight: 22 }}>
                {cfg.intention}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View style={{ opacity: enter, width: SW - 56, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 22, marginBottom: 20 }}>
          <LinearGradient colors={[`${cfg.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.85)', lineHeight: 25, marginBottom: 20 }}>
            {cfg.description}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 12 }}>KEY TRAITS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cfg.traits.map(t => <TraitPill key={t} label={t} color={cfg.color} />)}
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: enter, width: '100%', gap: 10 }}>
          <PrimaryBtn label="Continue ✦" onPress={onContinue} color={cfg.color} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ModeCinematicScreen({ cfg, onEnter }: { cfg: ModeConfig; onEnter: () => void }) {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;
  const expand  = useRef(new Animated.Value(0)).current;
  const textIn  = useRef(new Animated.Value(0)).current;
  const symbolP = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(expand,  { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.parallel([
        Animated.timing(textIn,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(symbolP, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  const circleS = expand.interpolate({ inputRange: [0, 1], outputRange: [0.01, 20] });
  const stats   = [
    { label: 'Companion', val: 'Enabled' },
    { label: 'Mode', val: cfg.name.split(' ')[0] },
    { label: 'Lumi', val: 'Active' },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad, overflow: 'hidden' }]}>
      <LinearGradient colors={cfg.bg} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${cfg.color}30`, transform: [{ scale: circleS }] }} />
      </View>
      <StarField />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: `${cfg.color}AA`, letterSpacing: 4, textTransform: 'uppercase', opacity: textIn, marginBottom: 16 }}>
          Activating
        </Animated.Text>
        <Animated.Text style={{ fontSize: 52, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', letterSpacing: -2, textAlign: 'center', opacity: textIn, lineHeight: 58, marginBottom: 6 }}>
          {cfg.name}
        </Animated.Text>
        <Animated.Text style={{ fontSize: 48, opacity: symbolP, marginBottom: 32 }}>
          {cfg.symbol}
        </Animated.Text>
        <Animated.Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: `${cfg.color}CC`, textAlign: 'center', opacity: textIn, marginBottom: 40 }}>
          {cfg.tagline}
        </Animated.Text>
        <Animated.View style={{ flexDirection: 'row', gap: 16, marginBottom: 48, opacity: textIn }}>
          {stats.map(s => (
            <View key={s.label} style={{ alignItems: 'center', backgroundColor: `${cfg.color}12`, borderRadius: 14, borderWidth: 1, borderColor: `${cfg.color}30`, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: cfg.color }}>{s.val}</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.5)', marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>
        <Animated.View style={{ opacity: textIn, width: '100%' }}>
          <PrimaryBtn label={`Enter ${cfg.name} ✦`} onPress={onEnter} color={cfg.color} />
        </Animated.View>
      </View>
    </View>
  );
}

function ModePerksScreen({ cfg, onGotIt }: { cfg: ModeConfig; onGotIt: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={{ opacity: enter, width: '100%', alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${cfg.color}25`, borderWidth: 1.5, borderColor: `${cfg.color}50`, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 28 }}>{cfg.symbol}</Text>
          </View>
          <Text style={{ fontSize: 28, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', textAlign: 'center', marginBottom: 6 }}>Mode Activated.</Text>
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.65)', textAlign: 'center', marginBottom: 32 }}>
            Your journey has shifted.
          </Text>
          <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}22`, padding: 22, marginBottom: 32 }}>
            <LinearGradient colors={[`${cfg.color}10`, 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 16 }}>WHAT'S DIFFERENT</Text>
            {cfg.whatChanged.map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i < cfg.whatChanged.length - 1 ? 14 : 0 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color, marginTop: 7 }} />
                <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22 }}>{w}</Text>
              </View>
            ))}
          </View>
          <PrimaryBtn label="Got it" onPress={onGotIt} color={cfg.color} />
        </Animated.View>
      </View>
    </View>
  );
}

function MeetLumiScreen({ cfg, onContinue }: { cfg: ModeConfig; onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 800, delay: 150, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.55)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>
            Meet Lumi 🌙
          </Text>
          <LumiCharacter color={cfg.color} size={110} />
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.55)', marginTop: 16, letterSpacing: 0.5, textAlign: 'center' }}>
            Your companion for this journey.
          </Text>
          <View style={{ backgroundColor: `${cfg.color}10`, borderRadius: 20, borderWidth: 1, borderColor: `${cfg.color}28`, padding: 22, marginTop: 28, marginBottom: 40, width: '100%' }}>
            <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(230,215,255,0.88)', lineHeight: 24, fontStyle: 'italic', textAlign: 'center' }}>
              "{cfg.lumiIntro}"
            </Text>
          </View>
          <PrimaryBtn label="Continue" onPress={onContinue} color={cfg.color} />
        </Animated.View>
      </View>
    </View>
  );
}

function SessionScreen({ cfg, sessionStart, onEnd, onGuides }: {
  cfg: ModeConfig; sessionStart: number;
  onEnd: (r: SessionResult) => void;
  onGuides: () => void;
}) {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const btmPad    = Platform.OS === 'web' ? 80 : insets.bottom + 20;
  const [elapsed, setElapsed]     = useState(Math.floor((Date.now() - sessionStart) / 1000));
  const [lumiIdx, setLumiIdx]     = useState(0);
  const [eventTxt, setEventTxt]   = useState('');
  const [eventVis, setEventVis]   = useState(false);
  const [moments, setMoments]     = useState(0);
  const [questDone, setQuestDone] = useState(0);
  const [softVis, setSoftVis]     = useState(false);
  const [socialVis, setSocialVis] = useState(false);
  const eventFade = useRef(new Animated.Value(0)).current;
  const softFade  = useRef(new Animated.Value(0)).current;
  const socialFade= useRef(new Animated.Value(0)).current;

  const lumiMessages = cfg.lumiMessages?.length
    ? cfg.lumiMessages
    : [cfg.lumiSession, '✦ You\'re doing great. Keep going.', 'I\'m watching the stars with you.', 'This moment is yours. Breathe.'];

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mins = Math.floor(elapsed / 60);
    setQuestDone(Math.min(cfg.questTotal, mins >= 8 ? cfg.questTotal : mins >= 5 ? Math.max(cfg.questTotal - 1, 1) : mins >= 2 ? 1 : 0));
  }, [elapsed]);

  useEffect(() => {
    const id = setInterval(() => setLumiIdx(i => (i + 1) % lumiMessages.length), 32000);
    return () => clearInterval(id);
  }, []);

  const showEvent = () => {
    const evts = cfg.events;
    setEventTxt(evts[moments % evts.length]);
    setMoments(m => m + 1);
    setEventVis(true);
    eventFade.setValue(0);
    Animated.sequence([
      Animated.timing(eventFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(5000),
      Animated.timing(eventFade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setEventVis(false));
  };

  useEffect(() => {
    const first = setTimeout(showEvent, 6000);
    const repeat = setInterval(showEvent, 35000);
    return () => { clearTimeout(first); clearInterval(repeat); };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSoftVis(true);
      Animated.timing(softFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 15000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setSocialVis(true);
      Animated.timing(socialFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 25000);
    return () => clearTimeout(t);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  function handleEnd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onEnd({ elapsed, questDone, momentsFound: moments });
  }

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />

      {/* Event toast */}
      {eventVis && (
        <Animated.View style={{
          position: 'absolute', top: topPad + 60, left: 20, right: 20, zIndex: 50,
          backgroundColor: `${cfg.color}18`, borderRadius: 18, borderWidth: 1,
          borderColor: `${cfg.color}40`, paddingHorizontal: 18, paddingVertical: 14, opacity: eventFade,
        }}>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: cfg.color, lineHeight: 20 }}>{eventTxt}</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: btmPad + 20 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.6)', letterSpacing: 0.5, marginBottom: 4 }}>{cfg.symbol} {cfg.name}</Text>
            <Text style={{ fontSize: 44, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', letterSpacing: -2 }}>{mm}:{ss}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}14`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cfg.color }} />
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: cfg.color }}>Active</Text>
          </View>
        </View>

        {/* Lumi companion */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 18, marginBottom: 14, overflow: 'hidden' }}>
          <LinearGradient colors={[`${cfg.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <LumiChat message={lumiMessages[lumiIdx]} color={cfg.color} />
        </View>

        {/* Soft Rescue */}
        {softVis && (
          <Animated.View style={{ opacity: softFade, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(200,180,255,0.18)', padding: 18, marginBottom: 14, overflow: 'hidden' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 10 }}>SOFT RESCUE</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.55)', marginBottom: 8 }}>Help when you need it, not when you don't.</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22, fontStyle: 'italic' }}>
              "{cfg.softRescue}"
            </Text>
            <TouchableOpacity
              style={{ marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(176,144,255,0.3)' }}
              onPress={() => { Haptics.selectionAsync(); setSoftVis(false); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(176,144,255,0.8)' }}>Thanks!</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Social Rescue */}
        {socialVis && (
          <Animated.View style={{ opacity: socialFade, backgroundColor: `${cfg.color}0C`, borderRadius: 20, borderWidth: 1, borderColor: `${cfg.color}28`, padding: 18, marginBottom: 14 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 10 }}>SOCIAL RESCUE</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 6 }}>A kind soul is nearby!</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(210,195,255,0.72)', marginBottom: 16 }}>
              You're not alone for long. Join their journey?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: cfg.color, alignItems: 'center' }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setSocialVis(false); onGuides(); }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#fff' }}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: `${cfg.color}35`, alignItems: 'center' }}
                onPress={() => { Haptics.selectionAsync(); setSocialVis(false); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: `${cfg.color}CC` }}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Quest */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 20, marginBottom: 14, overflow: 'hidden' }}>
          <LinearGradient colors={[`${cfg.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 10 }}>TODAY'S QUEST</Text>
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#EEE4FF', lineHeight: 23, marginBottom: 14 }}>{cfg.quest}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ height: 6, flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginRight: 12 }}>
              <View style={{ height: 6, width: `${(questDone / cfg.questTotal) * 100}%`, borderRadius: 3, backgroundColor: cfg.color }} />
            </View>
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: cfg.color, minWidth: 36, textAlign: 'right' }}>
              {questDone}/{cfg.questTotal}
            </Text>
          </View>
        </View>

        {/* Mode Perks */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}18`, padding: 18, marginBottom: 20, overflow: 'hidden' }}>
          <LinearGradient colors={[`${cfg.color}10`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 12 }}>MODE PERKS</Text>
          {cfg.perks.map((p, i) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: i < cfg.perks.length - 1 ? 10 : 0 }}>
              <Text style={{ fontSize: 10, color: cfg.color }}>✦</Text>
              <Text style={{ fontSize: 13.5, fontFamily: 'Satoshi-Bold', color: cfg.color }}>{p}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={{ borderWidth: 1, borderColor: `${cfg.color}40`, borderRadius: 24, paddingVertical: 16, alignItems: 'center' }}
          onPress={handleEnd}
          activeOpacity={0.78}
        >
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: cfg.color }}>End Session</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SummaryScreen({ cfg, result, onReflect }: { cfg: ModeConfig; result: SessionResult; onReflect: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const stabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
    Animated.timing(stabAnim, { toValue: cfg.stability, duration: 1800, delay: 400, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }, []);
  const achievements = [
    `Drifted for ${formatDuration(result.elapsed)}`,
    `${result.momentsFound} moment${result.momentsFound !== 1 ? 's' : ''} discovered`,
    `Quest progress: ${result.questDone}/${cfg.questTotal} completed`,
    `${cfg.name} explored`,
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, paddingTop: 28, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.55)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Session Summary
          </Text>
          <Text style={{ fontSize: 32, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', textAlign: 'center', lineHeight: 40 }}>
            You did amazing today.
          </Text>
        </Animated.View>

        {/* Vibe Stability */}
        <Animated.View style={{ opacity: enter, width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, borderWidth: 1, borderColor: `${cfg.color}25`, padding: 24, marginBottom: 16, overflow: 'hidden', alignItems: 'center' }}>
          <LinearGradient colors={[`${cfg.color}14`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 16 }}>VIBE STABILITY</Text>
          <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: `${cfg.color}35`, alignItems: 'center', justifyContent: 'center', backgroundColor: `${cfg.color}10`, marginBottom: 12 }}>
            <View style={{ position: 'absolute', inset: 0, borderRadius: 60, borderWidth: 3, borderColor: cfg.color, opacity: 0.85, transform: [{ rotate: `${-90 + (cfg.stability / 100) * 360}deg` }] }} />
            <Text style={{ fontSize: 34, fontFamily: 'Satoshi-Bold', color: cfg.color }}>{cfg.stability}%</Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.62)', textAlign: 'center' }}>
            Your vibe was consistent and strong throughout.
          </Text>
        </Animated.View>

        {/* Achievements */}
        <Animated.View style={{ opacity: enter, width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 22, marginBottom: 24 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 16 }}>YOU ACHIEVED</Text>
          {achievements.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i < achievements.length - 1 ? 12 : 0 }}>
              <Text style={{ fontSize: 12, color: cfg.color, marginTop: 2 }}>✦</Text>
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22 }}>{a}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={{ opacity: enter, width: '100%' }}>
          <PrimaryBtn label="View Full Reflection" onPress={onReflect} color={cfg.color} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ReflectionScreen({ cfg, onContinue }: { cfg: ModeConfig; onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 800, delay: 100, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 28 }}>REFLECTION</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: `${cfg.color}AA`, letterSpacing: 1, marginBottom: 20 }}>" "</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Satoshi-Regular', color: 'rgba(230,215,255,0.88)', lineHeight: 32, textAlign: 'center', fontStyle: 'italic', marginBottom: 28 }}>
            {cfg.reflection}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: `${cfg.color}CC`, marginBottom: 48, textAlign: 'center' }}>
            That's growth. Keep going.
          </Text>
          <PrimaryBtn label="Continue ✦" onPress={onContinue} color={cfg.color} />
        </Animated.View>
      </View>
    </View>
  );
}

function BreakPromptScreen({ cfg, onBreak, onContinue }: { cfg: ModeConfig; onBreak: () => void; onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
  }, []);
  const evol = cfg.evolution;
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, paddingTop: 32, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, width: '100%', alignItems: 'center' }}>
          {/* Journey Progress */}
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 20 }}>YOUR JOURNEY PROGRESS</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.6)', marginBottom: 16 }}>Every step shapes you.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 8, width: '100%', justifyContent: 'center' }}>
            {evol.map((e, i) => (
              <View key={e} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2 }, i === 0 ? { backgroundColor: `${cfg.color}30`, borderColor: cfg.color } : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' }]}>
                    <Text style={{ fontSize: 16 }}>{i === 0 ? cfg.symbol : '○'}</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: i === 0 ? cfg.color : 'rgba(200,180,255,0.4)', marginTop: 6, textAlign: 'center', maxWidth: 70 }} numberOfLines={2}>{e}</Text>
                  {i === 0 && <Text style={{ fontSize: 9, color: 'rgba(200,180,255,0.4)', marginTop: 2 }}>Current</Text>}
                  {i === 1 && <Text style={{ fontSize: 9, color: 'rgba(200,180,255,0.4)', marginTop: 2 }}>Next</Text>}
                </View>
                {i < evol.length - 1 && (
                  <View style={{ width: 28, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 4, marginBottom: 24 }} />
                )}
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: `${cfg.color}99`, marginBottom: 36, textAlign: 'center' }}>
            72% to next evolution
          </Text>

          {/* Break Prompt */}
          <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 22, marginBottom: 20 }}>
            <LinearGradient colors={[`${cfg.color}10`, 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={{ fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 6 }}>Take a Break?</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.65)', lineHeight: 22, marginBottom: 24 }}>
              Rest is part of the journey.
            </Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{ paddingVertical: 14, borderRadius: 18, backgroundColor: `${cfg.color}20`, borderWidth: 1, borderColor: `${cfg.color}40`, alignItems: 'center' }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBreak(); }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: cfg.color }}>I'll take a break</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: `${cfg.color}88`, marginTop: 3 }}>We'll be here when you return.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' }}
                onPress={() => { Haptics.selectionAsync(); onContinue(); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.75)' }}>I'll continue later</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(180,160,255,0.45)', marginTop: 3 }}>Save my progress.</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function FarewellScreen({ cfg, onHome }: { cfg: ModeConfig; onHome: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 900, delay: 150, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <LumiCharacter color={cfg.color} size={110} />
          <Text style={{ fontSize: 34, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', textAlign: 'center', marginTop: 32, marginBottom: 12, lineHeight: 42 }}>
            See you soon,{'\n'}dreamer ✦
          </Text>
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.60)', textAlign: 'center', lineHeight: 24, marginBottom: 56 }}>
            The stars will be here when you return.
          </Text>
          <PrimaryBtn label="Home" onPress={onHome} color={cfg.color} />
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Guides data ─────────────────────────────────────────────────────────────
const GUIDES = [
  { id: 'wanderer', em: '🌙', name: 'The Night Wanderer', role: 'Explorer',  color: '#B090FF',
    desc: 'Knows every hidden path and forgotten corner. Travels without maps or plans.',
    perks: ['Hidden paths', 'Discovery +40%'] },
  { id: 'seer',     em: '🔮', name: 'The Crystal Seer',   role: 'Visionary', color: '#FFD86F',
    desc: 'Sees further than most. Offers direction when the way forward is unclear.',
    perks: ['Smart guidance', 'Priority paths'] },
  { id: 'lantern',  em: '🏮', name: 'The Gentle Lantern', role: 'Companion', color: '#6BC5FF',
    desc: 'Walks at your pace, no matter how slow. Always nearby when you need light.',
    perks: ['Calm presence', 'Never rushes you'] },
  { id: 'spark',    em: '🔥', name: 'The Ember Spark',    role: 'Motivator', color: '#FF9070',
    desc: 'Burns bright and steady. Perfect when you need a push forward.',
    perks: ['Motivation boost', 'Achievement help'] },
];

function GuidesScreen({ cfg, onBack }: { cfg: ModeConfig; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const btmPad = Platform.OS === 'web' ? 80 : insets.bottom + 20;
  const [joined, setJoined] = useState<string | null>(null);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 600, delay: 80, useNativeDriver: true }).start();
  }, []);

  function handleJoin(guideId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoined(guideId);
    setTimeout(() => onBack(), 1800);
  }

  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: btmPad + 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter }}>

          {/* Back */}
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.60)' }}>← Back to session</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.50)', letterSpacing: 1.5, marginBottom: 10 }}>KIND SOULS NEARBY</Text>
          <Text style={{ fontSize: 26, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', lineHeight: 34, marginBottom: 8 }}>
            Guides available{'\n'}for your journey.
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.58)', lineHeight: 22, marginBottom: 28 }}>
            These wanderers are passing through. Any one of them will walk beside you.
          </Text>

          {/* Guide cards */}
          {GUIDES.map(guide => (
            <View key={guide.id} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${guide.color}28`, padding: 20, marginBottom: 14, overflow: 'hidden' }}>
              <LinearGradient colors={[`${guide.color}14`, 'transparent']} style={StyleSheet.absoluteFill} />

              {/* Guide identity row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: `${guide.color}20`, borderWidth: 1.5, borderColor: `${guide.color}50`, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 26 }}>{guide.em}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 2 }}>{guide.name}</Text>
                  <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: guide.color, letterSpacing: 0.8 }}>{guide.role.toUpperCase()}</Text>
                </View>
              </View>

              {/* Description */}
              <Text style={{ fontSize: 13.5, fontFamily: 'Satoshi-Regular', color: 'rgba(215,200,255,0.78)', lineHeight: 22, marginBottom: 14 }}>
                {guide.desc}
              </Text>

              {/* Perk chips */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {guide.perks.map(p => (
                  <View key={p} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: `${guide.color}16`, borderWidth: 1, borderColor: `${guide.color}32` }}>
                    <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: guide.color }}>✦ {p}</Text>
                  </View>
                ))}
              </View>

              {/* Join button */}
              {joined === guide.id ? (
                <View style={{ paddingVertical: 13, borderRadius: 16, backgroundColor: `${guide.color}28`, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: guide.color }}>Joined! Returning to session…</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={{ paddingVertical: 13, borderRadius: 16, backgroundColor: joined ? `${guide.color}40` : guide.color, alignItems: 'center' }}
                  onPress={() => !joined && handleJoin(guide.id)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff', opacity: joined ? 0.5 : 1 }}>Join Journey</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* Maybe later */}
          <TouchableOpacity onPress={onBack} style={{ paddingVertical: 18, alignItems: 'center' }} activeOpacity={0.7}>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.50)' }}>Maybe later</Text>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
export default function DriftScreen() {
  const { character } = useApp();
  const displayName   = character?.name && character.name !== 'Sky Child' ? character.name : 'Drift Mode';

  const [step,         setStep]         = useState<FlowStep>('welcome');
  const [questionIdx,  setQuestionIdx]  = useState(0);
  const [answers,      setAnswers]      = useState<Record<string, string>>({});
  const [mode,         setMode]         = useState<string | null>(null);
  const [confidence,   setConfidence]   = useState(75);
  const [driftPlan,    setDriftPlan]    = useState<DriftPlan | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [result,       setResult]       = useState<SessionResult>({ elapsed: 0, questDone: 0, momentsFound: 0 });

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  function go(next: FlowStep, setup?: () => void) {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setup?.();
      setStep(next);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  }

  // Restore active session
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
    const next = { ...answers, [qId]: optId };
    setAnswers(next);
    setTimeout(() => {
      if (questionIdx < QUESTIONS.length - 1) {
        go('survey', () => setQuestionIdx(i => i + 1));
      } else {
        go('allset');
      }
    }, 320);
  }

  async function handleBeginAnalysis() {
    go('analyzing');

    const [plan] = await Promise.all([
      apiFetch<DriftPlan>('/drift/analyze', {
        method: 'POST',
        body: JSON.stringify({
          answers,
          characterName: character?.name,
          characterMood: character?.mood,
        }),
      }).catch(() => null as DriftPlan | null),
      new Promise<void>(resolve => setTimeout(resolve, 4200)),
    ]);

    if (plan && MODES[plan.mode]) {
      setDriftPlan(plan);
      setMode(plan.mode);
      setConfidence(plan.confidence);
    } else {
      setMode(detectMode(answers));
      setConfidence(calcConfidence(answers));
    }

    go('vibe_reveal');
  }

  function handleStartSession() {
    const start = Date.now();
    setSessionStart(start);
    AsyncStorage.setItem('drift_session_v1', JSON.stringify({ mode, answers, sessionStart: start })).catch(() => {});
    go('session');
  }

  function handleEndSession(r: SessionResult) {
    setResult(r);
    AsyncStorage.removeItem('drift_session_v1').catch(() => {});
    go('summary');
  }

  function handleRestart() {
    setQuestionIdx(0);
    setAnswers({});
    setMode(null);
    setDriftPlan(null);
    setSessionStart(null);
    setResult({ elapsed: 0, questDone: 0, momentsFound: 0 });
    AsyncStorage.removeItem('drift_session_v1').catch(() => {});
    go('welcome');
  }

  const cfg: ModeConfig | null = mode && MODES[mode] ? {
    ...MODES[mode],
    ...(driftPlan ? {
      archetype:    driftPlan.archetype,
      intention:    driftPlan.intention,
      lumiIntro:    driftPlan.lumiIntro,
      lumiMessages: driftPlan.lumiMessages,
      quest:        driftPlan.quests[0]?.title ?? MODES[mode].quest,
      quests:       driftPlan.quests,
      softRescue:   driftPlan.softRescue,
      reflection:   driftPlan.reflection,
      evolution:    driftPlan.evolution,
      stability:    driftPlan.stability,
    } : {}),
  } : null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {step === 'welcome'         && <WelcomeScreen       onStart={() => go('survey', () => setQuestionIdx(0))} name={displayName} />}
      {step === 'survey'          && <SurveyScreen        question={QUESTIONS[questionIdx]} qIdx={questionIdx} total={QUESTIONS.length} onAnswer={handleAnswer} answers={answers} />}
      {step === 'allset'          && <AllSetScreen        onBegin={handleBeginAnalysis} />}
      {step === 'analyzing'       && <AnalyzingScreen     confidence={confidence} />}
      {step === 'vibe_reveal'     && cfg && <VibeRevealScreen    cfg={cfg} confidence={confidence} onContinue={() => go('mode_cinematic')} />}
      {step === 'mode_cinematic'  && cfg && <ModeCinematicScreen cfg={cfg} onEnter={() => go('mode_perks')} />}
      {step === 'mode_perks'      && cfg && <ModePerksScreen     cfg={cfg} onGotIt={() => go('meet_lumi')} />}
      {step === 'meet_lumi'       && cfg && <MeetLumiScreen      cfg={cfg} onContinue={handleStartSession} />}
      {step === 'session'         && cfg && <SessionScreen       cfg={cfg} sessionStart={sessionStart ?? Date.now()} onEnd={handleEndSession} onGuides={() => go('guides')} />}
      {step === 'guides'          && cfg && <GuidesScreen        cfg={cfg} onBack={() => go('session')} />}
      {step === 'summary'         && cfg && <SummaryScreen       cfg={cfg} result={result} onReflect={() => go('reflection')} />}
      {step === 'reflection'      && cfg && <ReflectionScreen    cfg={cfg} onContinue={() => go('break_prompt')} />}
      {step === 'break_prompt'    && cfg && <BreakPromptScreen   cfg={cfg} onBreak={() => go('farewell')} onContinue={handleRestart} />}
      {step === 'farewell'        && cfg && <FarewellScreen      cfg={cfg} onHome={handleRestart} />}
    </Animated.View>
  );
}
