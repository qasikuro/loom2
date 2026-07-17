import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useApp, apiFetch } from '@/context/AppContext';

const { width: SW } = Dimensions.get('window');

// ─── Flow ────────────────────────────────────────────────────────────────────
type FlowStep =
  | 'welcome' | 'survey' | 'allset'
  | 'analyzing' | 'vibe_reveal'
  | 'mode_cinematic' | 'mode_perks' | 'meet_lumi'
  | 'session' | 'lumi_chat'
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

// ─── Lumi quips (tapped reactions, mode-specific) ─────────────────────────────
const LUMI_QUIPS: Record<string, string[]> = {
  challenge: [
    "You're doing the thing. The actual thing. *proud ghost noises* ✦",
    "I would help but honestly you look like you don't need it. Intimidatingly capable.",
    "Some people dream about what you're doing right now. You're living it.",
    "Whatever just happened — I saw it. That was real.",
    "Okay but you know you're kind of crushing this, right?",
  ],
  flow: [
    "Shhh. Don't break it. You're in it. 🌊",
    "I wasn't going to say anything but you look *really* at peace right now.",
    "This is the part of the movie where everything quietly goes right.",
    "You found your pace. That's rare. Keep that.",
    "The stars are literally arranging themselves around your vibe tonight.",
  ],
  echo: [
    "Fun fact: you're doing better than you think. Not fluff — actual fact.",
    "I've been watching quietly. You're exploring in exactly the right direction.",
    "There's something about you tonight. Can't quite put my finger on it.",
    "The fact that you're here means something. Even if you don't know what yet.",
    "I see you. Even when you're moving quietly in the dark. Especially then.",
  ],
  social: [
    "You have the energy of someone who makes people feel genuinely seen. Use that.",
    "If warmth were a skill you'd be fully maxed out. No upgrades needed.",
    "Other people don't know it yet, but they're glad you're here.",
    "I like you. There. I said it. No take-backs.",
    "You light up spaces without trying. That's a whole thing.",
  ],
  clarity: [
    "The answer is closer than you think. Statistically speaking.",
    "You're literally using your brain to solve problems in real time. That's impressive.",
    "You're asking the right questions. Most people never even get that far.",
    "The fog always lifts eventually. You're already walking through it.",
    "Okay wait — what you just figured out? That matters.",
  ],
  recovery: [
    "Showing up when everything is heavy? That's the hardest version of brave.",
    "I'm not going anywhere. We can both be tired here. It's fine.",
    "You don't have to be okay. But I'm really glad you're here.",
    "Rest is not a reward. It's the work. You are doing the work right now.",
    "Hey. You came back. That's everything.",
  ],
};

const LUMI_QUIPS_DEFAULT = [
  "Hey. You're doing something real right now. ✦",
  "I see you. That's not nothing.",
  "Whatever brought you here tonight — I'm glad it did.",
  "You're the kind of person who shows up. That matters more than you think.",
];

// ─── Lumi emotion system ──────────────────────────────────────────────────────
type LumiEmotion = 'neutral' | 'happy' | 'focused' | 'proud' | 'sleepy' | 'excited';
const EMOTION_EYE_SCALE: Record<LumiEmotion, number> = {
  neutral: 1.0, happy: 0.38, focused: 0.60, proud: 0.44, sleepy: 0.13, excited: 1.12,
};
const EMOTION_BLUSH: Record<LumiEmotion, number> = {
  neutral: 0.38, happy: 0.78, focused: 0.08, proud: 0.56, sleepy: 0.12, excited: 0.92,
};
const PHASE_EMOTIONS: LumiEmotion[] = ['neutral', 'focused', 'focused', 'proud'];

// ─── Lumi mascot ──────────────────────────────────────────────────────────────
function LumiCharacter({ color = '#B090FF', size = 80, onTap, emotion = 'neutral' }: {
  color?: string; size?: number; onTap?: () => void; emotion?: LumiEmotion;
}) {
  const bob        = useRef(new Animated.Value(0)).current;
  const glowPulse  = useRef(new Animated.Value(0.6)).current;
  const eyeOp      = useRef(new Animated.Value(1)).current;
  const wiggle     = useRef(new Animated.Value(0)).current;
  const eyeScaleY  = useRef(new Animated.Value(1)).current;
  const blushOp    = useRef(new Animated.Value(0.38)).current;
  const bodyBounce = useRef(new Animated.Value(0)).current;

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

  // Animate face to new emotion
  useEffect(() => {
    Animated.parallel([
      Animated.spring(eyeScaleY, {
        toValue: EMOTION_EYE_SCALE[emotion], useNativeDriver: true,
        bounciness: (emotion === 'happy' || emotion === 'excited') ? 16 : 3,
      }),
      Animated.timing(blushOp, { toValue: EMOTION_BLUSH[emotion], duration: 380, useNativeDriver: true }),
    ]).start();
    if (emotion === 'excited' || emotion === 'happy') {
      Animated.sequence([
        Animated.timing(bodyBounce, { toValue: -10, duration: 140, useNativeDriver: true }),
        Animated.spring(bodyBounce,  { toValue: 0,   useNativeDriver: true, bounciness: 12 }),
      ]).start();
    }
  }, [emotion]);

  function handleTap() {
    if (!onTap) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(wiggle, { toValue: 1,    duration: 60,  useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1,   duration: 80,  useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0.6,  duration: 60,  useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -0.6, duration: 60,  useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0,    duration: 60,  useNativeDriver: true }),
    ]).start();
    onTap();
  }

  const bw   = size;
  const bh   = size * 1.15;
  const ew   = size * 0.135;
  const earW = size * 0.22;
  const earH = size * 0.30;

  const rotateStr = wiggle.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-14deg', '0deg', '14deg'] });

  const inner = (
    <Animated.View style={{ alignItems: 'center', transform: [{ translateY: bob }, { translateY: bodyBounce }, { rotate: rotateStr }] }}>
      <Animated.View style={{
        position: 'absolute', width: size * 1.75, height: size * 1.75,
        borderRadius: size * 0.875, backgroundColor: `${color}18`,
        top: -size * 0.16, opacity: glowPulse,
      }} />
      <View style={{
        position: 'absolute', width: size * 1.25, height: size * 1.25,
        borderRadius: size * 0.625, borderWidth: 1, borderColor: `${color}28`, top: 0,
      }} />
      <View style={{
        position: 'absolute', width: earW, height: earH, borderRadius: earW / 2,
        backgroundColor: color, top: earH * 0.10, left: size * 0.15, zIndex: 1,
        transform: [{ rotate: '-14deg' }],
        shadowColor: color, shadowOpacity: 0.55, shadowRadius: 8,
      }} />
      <View style={{
        position: 'absolute', width: earW, height: earH, borderRadius: earW / 2,
        backgroundColor: color, top: earH * 0.10, right: size * 0.15, zIndex: 1,
        transform: [{ rotate: '14deg' }],
        shadowColor: color, shadowOpacity: 0.55, shadowRadius: 8,
      }} />
      <View style={{
        width: bw, height: bh, borderRadius: bw * 0.48, backgroundColor: color,
        overflow: 'hidden', alignItems: 'center', zIndex: 2,
        marginTop: earH * 0.52,
        shadowColor: color, shadowOpacity: 0.65, shadowRadius: 16,
      }}>
        <LinearGradient
          colors={['rgba(255,255,255,0.44)', 'rgba(255,255,255,0.07)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: bh * 0.52 }}
        />
        {/* Left eye with emotion scaleY */}
        <Animated.View style={{ position: 'absolute', top: bh * 0.27, left: bw * 0.18, transform: [{ scaleY: eyeScaleY }] }}>
          <Animated.View style={{
            width: ew * 1.65, height: ew * 1.65, borderRadius: ew * 0.82,
            backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center',
            justifyContent: 'center', opacity: eyeOp,
          }}>
            <View style={{ width: ew * 0.80, height: ew * 0.80, borderRadius: ew * 0.40, backgroundColor: 'rgba(50,15,130,0.92)' }} />
            <View style={{ position: 'absolute', top: ew * 0.08, left: ew * 0.08, width: ew * 0.34, height: ew * 0.34, borderRadius: ew * 0.17, backgroundColor: 'rgba(255,255,255,0.92)' }} />
          </Animated.View>
        </Animated.View>
        {/* Right eye with emotion scaleY */}
        <Animated.View style={{ position: 'absolute', top: bh * 0.27, right: bw * 0.18, transform: [{ scaleY: eyeScaleY }] }}>
          <Animated.View style={{
            width: ew * 1.65, height: ew * 1.65, borderRadius: ew * 0.82,
            backgroundColor: 'rgba(255,255,255,0.96)', alignItems: 'center',
            justifyContent: 'center', opacity: eyeOp,
          }}>
            <View style={{ width: ew * 0.80, height: ew * 0.80, borderRadius: ew * 0.40, backgroundColor: 'rgba(50,15,130,0.92)' }} />
            <View style={{ position: 'absolute', top: ew * 0.08, right: ew * 0.08, width: ew * 0.34, height: ew * 0.34, borderRadius: ew * 0.17, backgroundColor: 'rgba(255,255,255,0.92)' }} />
          </Animated.View>
        </Animated.View>
        {/* Animated blush — intensity driven by emotion */}
        <Animated.View style={{ position: 'absolute', top: bh * 0.46, left: bw * 0.09, width: bw * 0.22, height: bh * 0.10, borderRadius: bw * 0.11, backgroundColor: 'rgba(255,150,195,1)', opacity: blushOp }} />
        <Animated.View style={{ position: 'absolute', top: bh * 0.46, right: bw * 0.09, width: bw * 0.22, height: bh * 0.10, borderRadius: bw * 0.11, backgroundColor: 'rgba(255,150,195,1)', opacity: blushOp }} />
        {/* Mouth — shape changes with emotion */}
        {(emotion === 'happy' || emotion === 'proud' || emotion === 'excited') ? (
          <View style={{ position: 'absolute', top: bh * 0.61, alignSelf: 'center', overflow: 'hidden', width: bw * 0.30, height: bw * 0.16 }}>
            <View style={{ width: bw * 0.30, height: bw * 0.30, borderRadius: bw * 0.15, borderWidth: 2.5, borderColor: 'rgba(40,10,110,0.55)' }} />
          </View>
        ) : emotion === 'sleepy' ? (
          <View style={{ position: 'absolute', top: bh * 0.63, alignSelf: 'center', width: bw * 0.18, height: 2.5, borderRadius: 1.5, backgroundColor: 'rgba(40,10,110,0.35)' }} />
        ) : (
          <View style={{ position: 'absolute', top: bh * 0.64, alignSelf: 'center', width: bw * 0.07, height: bw * 0.07, borderRadius: bw * 0.035, backgroundColor: 'rgba(40,10,110,0.28)' }} />
        )}
      </View>
      <View style={{
        width: bw * 0.50, height: bh * 0.18, borderRadius: bw * 0.14,
        backgroundColor: color, opacity: 0.72, marginTop: -bh * 0.04, zIndex: 1,
      }} />
      <View style={{ position: 'absolute', top: -4, right: -4, zIndex: 10 }}>
        <Text style={{ fontSize: 11, color: `${color}CC` }}>✦</Text>
      </View>
      <View style={{ position: 'absolute', top: bh * 0.28, left: -2, zIndex: 10 }}>
        <Text style={{ fontSize: 7, color: `${color}88` }}>✦</Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color, letterSpacing: 1.5, marginTop: 6, opacity: 0.75 }}>LUMI</Text>
    </Animated.View>
  );

  if (onTap) {
    return <TouchableOpacity onPress={handleTap} activeOpacity={0.85}>{inner}</TouchableOpacity>;
  }
  return inner;
}

function LumiChat({ message, color = '#B090FF', onTapLumi, tapQuip, emotion = 'neutral', whisper }: {
  message: string; color?: string; onTapLumi?: () => void; tapQuip?: string;
  emotion?: LumiEmotion; whisper?: string;
}) {
  const msgFade     = useRef(new Animated.Value(0)).current;
  const quipFade    = useRef(new Animated.Value(0)).current;
  const whisperFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    msgFade.setValue(0);
    Animated.timing(msgFade, { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }).start();
  }, [message]);

  useEffect(() => {
    if (!tapQuip) return;
    quipFade.setValue(0);
    Animated.sequence([
      Animated.timing(quipFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(quipFade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [tapQuip]);

  useEffect(() => {
    if (!whisper) return;
    whisperFade.setValue(0);
    Animated.sequence([
      Animated.timing(whisperFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(whisperFade, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [whisper]);

  return (
    <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
      {/* Lumi hero — centered, large */}
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        {/* Whisper — ambient floating text */}
        {whisper ? (
          <Animated.View style={{ marginBottom: 10, opacity: whisperFade }}>
            <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: `${color}BB`, fontStyle: 'italic', textAlign: 'center', letterSpacing: 0.4 }}>
              {whisper} ✦
            </Text>
          </Animated.View>
        ) : null}

        {/* Tap quip speech bubble */}
        {tapQuip ? (
          <Animated.View style={{
            marginBottom: 10, opacity: quipFade,
            backgroundColor: `${color}F0`, borderRadius: 16, borderBottomLeftRadius: 4,
            paddingHorizontal: 14, paddingVertical: 10, maxWidth: SW - 80,
            shadowColor: color, shadowOpacity: 0.55, shadowRadius: 10,
          }}>
            <Text style={{ fontSize: 12.5, fontFamily: 'Satoshi-Regular', color: '#fff', lineHeight: 20, textAlign: 'center' }}>
              {tapQuip}
            </Text>
          </Animated.View>
        ) : null}

        <LumiCharacter color={color} size={96} onTap={onTapLumi} emotion={emotion} />
      </View>

      {/* Phase message — centered, italic */}
      <Animated.Text style={{
        fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.88)',
        lineHeight: 22, fontStyle: 'italic', textAlign: 'center',
        opacity: msgFade, paddingHorizontal: 12,
      }}>
        "{message}"
      </Animated.Text>

      {onTapLumi && (
        <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: `${color}44`, marginTop: 10, letterSpacing: 0.8 }}>
          TAP LUMI TO TALK
        </Text>
      )}
    </View>
  );
}

// ─── Breathing game ───────────────────────────────────────────────────────────
type BreathPhase = 'idle' | 'inhale' | 'hold' | 'exhale' | 'done';
function BreathingGame({ color, onDone }: { color: string; onDone: () => void }) {
  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [round, setRound] = useState(0);
  const [label, setLabel] = useState('Tap to begin');
  const circleScale = useRef(new Animated.Value(1)).current;
  const circleOp   = useRef(new Animated.Value(0.35)).current;
  const cardFade   = useRef(new Animated.Value(0)).current;
  const currentRound = useRef(0);

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  function doInhale() {
    setPhase('inhale');
    setLabel('Breathe in…');
    Animated.parallel([
      Animated.timing(circleScale, { toValue: 1.65, duration: 4000, useNativeDriver: true }),
      Animated.timing(circleOp,   { toValue: 1,    duration: 4000, useNativeDriver: true }),
    ]).start(() => doHold());
  }
  function doHold() {
    setPhase('hold');
    setLabel('Hold…');
    setTimeout(() => doExhale(), 4000);
  }
  function doExhale() {
    setPhase('exhale');
    setLabel('Breathe out…');
    Animated.parallel([
      Animated.timing(circleScale, { toValue: 1,    duration: 6000, useNativeDriver: true }),
      Animated.timing(circleOp,   { toValue: 0.35, duration: 6000, useNativeDriver: true }),
    ]).start(() => {
      currentRound.current += 1;
      setRound(currentRound.current);
      if (currentRound.current >= 3) {
        setPhase('done');
        setLabel('Well done ✦');
      } else {
        doInhale();
      }
    });
  }

  return (
    <Animated.View style={{ opacity: cardFade, backgroundColor: `${color}12`, borderRadius: 20,
      borderWidth: 1, borderColor: `${color}28`, padding: 20, marginTop: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: `${color}AA`, letterSpacing: 2, marginBottom: 4 }}>
        BREATHING EXERCISE
      </Text>
      <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.55)', marginBottom: 16 }}>
        4 · 4 · 6  ·  3 rounds{round > 0 ? `  (${round}/3 done)` : ''}
      </Text>

      <TouchableOpacity
        onPress={phase === 'idle' ? doInhale : undefined}
        activeOpacity={phase === 'idle' ? 0.75 : 1}
        style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
      >
        <Animated.View style={{
          width: 110, height: 110, borderRadius: 55,
          backgroundColor: `${color}22`, borderWidth: 2, borderColor: `${color}55`,
          alignItems: 'center', justifyContent: 'center',
          transform: [{ scale: circleScale }], opacity: circleOp,
          shadowColor: color, shadowOpacity: 0.5, shadowRadius: 20,
        }}>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: `${color}EE`, textAlign: 'center', paddingHorizontal: 8 }}>
            {label}
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {phase === 'done' ? (
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.7)', fontStyle: 'italic' }}>
            "That was good. I felt it too."
          </Text>
          <TouchableOpacity onPress={onDone} style={{
            backgroundColor: `${color}28`, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10,
          }}>
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color }}>Done ✦</Text>
          </TouchableOpacity>
        </View>
      ) : phase === 'idle' ? (
        <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.40)', textAlign: 'center' }}>
          Tap the circle to start
        </Text>
      ) : null}
    </Animated.View>
  );
}

// ─── Journal spark ────────────────────────────────────────────────────────────
function JournalSpark({ color, mode, onDone }: { color: string; mode: string; onDone: () => void }) {
  const [text, setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const MOOD_MAP: Record<string, string> = {
    challenge: 'hopeful', flow: 'peaceful', echo: 'dreamy',
    social: 'romantic', clarity: 'peaceful', recovery: 'soft',
  };
  const modeKey = mode.split(' ')[0].toLowerCase();
  const mood    = MOOD_MAP[modeKey] ?? 'peaceful';

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await apiFetch('/journal-entries', {
        method: 'POST',
        body: JSON.stringify({
          id: Math.random().toString(36).slice(2),
          type: 'moment',
          text: text.trim(),
          mood,
          date: new Date().toISOString(),
        }),
      });
      setSaved(true);
      setTimeout(onDone, 2200);
    } catch {
      onDone();
    }
  }

  return (
    <Animated.View style={{ opacity: cardFade, backgroundColor: `${color}12`, borderRadius: 20,
      borderWidth: 1, borderColor: `${color}28`, padding: 18, marginTop: 16 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: `${color}AA`, letterSpacing: 2, marginBottom: 6 }}>
        LUMI ASKS
      </Text>
      {saved ? (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ fontSize: 22, marginBottom: 8 }}>✦</Text>
          <Text style={{ fontSize: 13.5, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.8)', fontStyle: 'italic', textAlign: 'center' }}>
            "Saved to your journal, quietly."
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.75)', lineHeight: 21, marginBottom: 12 }}>
            Write one thing you're feeling right now. Just one sentence.
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="I feel…"
            placeholderTextColor={`${color}55`}
            multiline
            style={{
              backgroundColor: `${color}10`, borderRadius: 12, borderWidth: 1,
              borderColor: `${color}30`, padding: 12, color: 'rgba(235,220,255,0.9)',
              fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 22, minHeight: 72,
              marginBottom: 12,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={save}
              disabled={!text.trim() || saving}
              style={{
                flex: 1, backgroundColor: text.trim() ? `${color}30` : `${color}14`,
                borderRadius: 14, paddingVertical: 11, alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: text.trim() ? color : `${color}55` }}>
                {saving ? 'Saving…' : 'Save quietly ✦'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDone} style={{
              paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center',
            }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.35)' }}>Skip</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </Animated.View>
  );
}

// ─── Story vibe card ──────────────────────────────────────────────────────────
function StoryVibeCard({ cfg, onDismiss }: { cfg: ModeConfig; onDismiss: () => void }) {
  const router   = useRouter();
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const color = cfg.color ?? '#B090FF';

  return (
    <Animated.View style={{ opacity: cardFade, backgroundColor: `${color}12`, borderRadius: 20,
      borderWidth: 1, borderColor: `${color}28`, padding: 18, marginTop: 16 }}>
      <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: `${color}AA`, letterSpacing: 2, marginBottom: 6 }}>
        STORIES FOR YOUR VIBE
      </Text>
      <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.75)', lineHeight: 21, marginBottom: 14 }}>
        There are stories out there that feel exactly like {cfg.name.split(' ')[0].toLowerCase()} mode. Want to drift into one?
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={() => { router.push('/(tabs)/discover' as never); onDismiss(); }}
          style={{ flex: 1, backgroundColor: `${color}28`, borderRadius: 14, paddingVertical: 11, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color }}>Explore stories ✦</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={{ paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.35)' }}>Maybe later</Text>
        </TouchableOpacity>
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
            ✦ A quick check-in — 6 questions — personalises your session.{'\n'}Your responses stay on your device. Always.
          </Text>
        </Animated.View>
        <Animated.View style={{ opacity: enter, alignItems: 'center', gap: 12, width: '100%' }}>
          <PrimaryBtn label="Get Started ✦" onPress={onStart} color="#7050C8" />
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
  const labels = ['Reading through your answers', 'Personalising your session', 'Almost there...'];
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

const DURATIONS = [
  { label: 'Quick',  mins: 5,  desc: '5 min · small and focused' },
  { label: 'Steady', mins: 15, desc: '15 min · a real moment' },
  { label: 'Deep',   mins: 30, desc: '30 min · full presence' },
];

function MeetLumiScreen({ cfg, onContinue }: { cfg: ModeConfig; onContinue: (durationSecs: number) => void }) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const [selectedMins, setSelectedMins] = useState(15);
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 800, delay: 150, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={{ opacity: enter, alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.55)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>
            Meet Lumi 🌙
          </Text>
          <LumiCharacter color={cfg.color} size={100} />
          <View style={{ backgroundColor: `${cfg.color}10`, borderRadius: 20, borderWidth: 1, borderColor: `${cfg.color}28`, padding: 20, marginTop: 22, marginBottom: 28, width: '100%' }}>
            <Text style={{ fontSize: 14.5, fontFamily: 'Satoshi-Regular', color: 'rgba(230,215,255,0.88)', lineHeight: 24, fontStyle: 'italic', textAlign: 'center' }}>
              "{cfg.lumiIntro}"
            </Text>
          </View>

          {/* Duration picker */}
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.50)', letterSpacing: 1.5, marginBottom: 14 }}>HOW LONG?</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 32, width: '100%' }}>
            {DURATIONS.map(d => {
              const sel = selectedMins === d.mins;
              return (
                <TouchableOpacity
                  key={d.mins}
                  onPress={() => { Haptics.selectionAsync(); setSelectedMins(d.mins); }}
                  activeOpacity={0.8}
                  style={{ flex: 1, paddingVertical: 14, borderRadius: 18, borderWidth: 1.5,
                    borderColor: sel ? cfg.color : 'rgba(200,180,255,0.18)',
                    backgroundColor: sel ? `${cfg.color}20` : 'rgba(255,255,255,0.03)',
                    alignItems: 'center', gap: 4 }}
                >
                  <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: sel ? cfg.color : 'rgba(200,180,255,0.55)' }}>{d.label}</Text>
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: sel ? `${cfg.color}AA` : 'rgba(180,160,255,0.38)', textAlign: 'center' }}>{d.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <PrimaryBtn label={`Begin · ${selectedMins} min`} onPress={() => onContinue(selectedMins * 60)} color={cfg.color} />
        </Animated.View>
      </View>
    </View>
  );
}

const QUEST_TYPE_ICONS: Record<string, string> = {
  discovery: '🔍', mindful: '🌿', creation: '✏️',
  connection: '🤝', challenge: '⚔️', rest: '🌙',
};

function SessionScreen({ cfg, sessionStart, duration, onEnd, onChat }: {
  cfg: ModeConfig; sessionStart: number; duration: number;
  onEnd: (r: SessionResult) => void;
  onChat: () => void;
}) {
  const insets    = useSafeAreaInsets();
  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const btmPad    = Platform.OS === 'web' ? 80 : insets.bottom + 20;
  const [elapsed, setElapsed]           = useState(Math.floor((Date.now() - sessionStart) / 1000));
  const [lumiIdx, setLumiIdx]           = useState(0);
  const [eventTxt, setEventTxt]         = useState('');
  const [eventVis, setEventVis]         = useState(false);
  const [moments, setMoments]           = useState(0);
  const [checkedTasks, setCheckedTasks]   = useState<Set<number>>(new Set());
  const [softVis, setSoftVis]             = useState(false);
  const [lumiNudgeVis, setLumiNudgeVis]   = useState(false);
  const [timeUpVis, setTimeUpVis]         = useState(false);
  const [tapQuip, setTapQuip]             = useState<string | undefined>(undefined);
  const [tapCount, setTapCount]           = useState(0);
  const [breathingVis, setBreathingVis]   = useState(false);
  const [journalVis, setJournalVis]       = useState(false);
  const [storyCardVis, setStoryCardVis]   = useState(false);
  const [lumiEmotion, setLumiEmotion]     = useState<LumiEmotion>('neutral');
  const [whisper, setWhisper]             = useState<string | undefined>(undefined);
  const eventFade    = useRef(new Animated.Value(0)).current;
  const softFade     = useRef(new Animated.Value(0)).current;
  const lumiNudgeFade= useRef(new Animated.Value(0)).current;
  const timeUpFade   = useRef(new Animated.Value(0)).current;

  const remaining = Math.max(0, duration - elapsed);
  const progress  = Math.min(1, elapsed / duration);
  // Phase: 0–30% = settling, 30–65% = flowing, 65–85% = deepening, 85–100% = winding down
  const phase = progress < 0.3 ? 0 : progress < 0.65 ? 1 : progress < 0.85 ? 2 : 3;

  const tasks: DriftQuest[] = cfg.quests?.length
    ? cfg.quests
    : FALLBACK_QUESTS[cfg.name.toLowerCase().split(' ')[0]] ?? FALLBACK_QUESTS.echo;

  const questDone  = checkedTasks.size;
  const questTotal = tasks.length;

  // Phase-aware Lumi messages — early pool, mid pool, deep pool, wind-down pool
  const allLumiMsgs = cfg.lumiMessages?.length
    ? cfg.lumiMessages
    : [cfg.lumiSession, 'You\'re doing great.', 'I\'m watching the stars with you.', 'This moment is yours.', 'Still here with you.'];

  // Spread 5 messages across 4 phases; cycle within current phase's message
  const phaseMsg = allLumiMsgs[Math.min(phase, allLumiMsgs.length - 1)];
  const windDownMsgs = [
    'You\'re almost at the end. Let that feel like something.',
    'This is the part where you take a breath and look back.',
    'Nearly there. You showed up. That matters.',
  ];
  const currentLumiMsg = phase === 3
    ? windDownMsgs[lumiIdx % windDownMsgs.length]
    : allLumiMsgs[Math.min(lumiIdx, allLumiMsgs.length - 1)];

  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Advance Lumi message ~every 2 min (relative to duration)
  useEffect(() => {
    const interval = Math.max(60000, (duration * 1000) / (allLumiMsgs.length + 1));
    const id = setInterval(() => setLumiIdx(i => i + 1), interval);
    return () => clearInterval(id);
  }, [duration]);

  // Soft tip at 35% of session
  useEffect(() => {
    const t = setTimeout(() => {
      setSoftVis(true);
      Animated.timing(softFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, duration * 0.35 * 1000);
    return () => clearTimeout(t);
  }, [duration]);

  // Lumi nudge at 60% of session
  useEffect(() => {
    const t = setTimeout(() => {
      setLumiNudgeVis(true);
      Animated.timing(lumiNudgeFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, duration * 0.6 * 1000);
    return () => clearTimeout(t);
  }, [duration]);

  // Phase → emotion
  useEffect(() => { setLumiEmotion(PHASE_EMOTIONS[phase]); }, [phase]);

  // Ambient whispers
  useEffect(() => {
    const pool = [
      'still watching', 'you\'re doing it', 'I see you',
      'right here with you', 'breathe', 'this moment is real',
      'not going anywhere', 'you\'re still here', 'something is shifting',
      'stay with it', 'I\'m proud of you', 'keep going',
    ];
    let idx = 0;
    function fire() {
      setWhisper(pool[idx % pool.length]);
      idx++;
      setTimeout(() => setWhisper(undefined), 4200);
    }
    const first  = setTimeout(fire, Math.min(40000, duration * 0.12 * 1000));
    const repeat = setInterval(fire,  Math.min(140000, duration * 0.20 * 1000));
    return () => { clearTimeout(first); clearInterval(repeat); };
  }, [duration]);

  // Breathing game at 20%
  useEffect(() => {
    const t = setTimeout(() => setBreathingVis(true), duration * 0.20 * 1000);
    return () => clearTimeout(t);
  }, [duration]);

  // Journal spark at 50%
  useEffect(() => {
    const t = setTimeout(() => setJournalVis(true), duration * 0.50 * 1000);
    return () => clearTimeout(t);
  }, [duration]);

  // Story vibe card at 78%
  useEffect(() => {
    const t = setTimeout(() => setStoryCardVis(true), duration * 0.78 * 1000);
    return () => clearTimeout(t);
  }, [duration]);

  // Time's up at 100%
  useEffect(() => {
    const t = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeUpVis(true);
      Animated.timing(timeUpFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, duration * 1000);
    return () => clearTimeout(t);
  }, [duration]);

  const showEvent = () => {
    const evts = cfg.events;
    setEventTxt(evts[moments % evts.length]);
    setMoments(m => m + 1);
    setEventVis(true);
    eventFade.setValue(0);
    Animated.sequence([
      Animated.timing(eventFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(4000),
      Animated.timing(eventFade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setEventVis(false));
  };

  useEffect(() => {
    const first = setTimeout(showEvent, Math.min(20000, duration * 0.15 * 1000));
    const repeat = setInterval(showEvent, Math.min(90000, duration * 0.4 * 1000));
    return () => { clearTimeout(first); clearInterval(repeat); };
  }, [duration]);

  // Countdown display
  const remMm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const remSs = String(remaining % 60).padStart(2, '0');

  function toggleTask(idx: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCheckedTasks(prev => {
      const next = new Set(prev);
      const isChecking = !next.has(idx);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      if (isChecking) {
        setLumiEmotion('happy');
        setTimeout(() => setLumiEmotion(PHASE_EMOTIONS[phase]), 2200);
      }
      return next;
    });
  }

  function handleEnd() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onEnd({ elapsed, questDone, momentsFound: moments });
  }

  function handleTapLumi() {
    const modeKey = cfg.name.toLowerCase().split(' ')[0];
    const pool    = LUMI_QUIPS[modeKey] ?? LUMI_QUIPS_DEFAULT;
    const quip    = pool[tapCount % pool.length];
    setTapCount(c => c + 1);
    setTapQuip(quip);
    setLumiEmotion('excited');
    setTimeout(() => {
      setTapQuip(undefined);
      setLumiEmotion(PHASE_EMOTIONS[phase]);
    }, 3500);
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

        {/* Header — countdown + progress ring */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.6)', letterSpacing: 0.5, marginBottom: 4 }}>{cfg.symbol} {cfg.name}</Text>
            <Text style={{ fontSize: 44, fontFamily: 'Satoshi-Bold', color: phase === 3 ? '#FFD86F' : '#F0E6FF', letterSpacing: -2 }}>
              {remMm}:{remSs}
            </Text>
            <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.45)', marginTop: 2 }}>
              {phase === 0 ? 'settling in…' : phase === 1 ? 'in the flow' : phase === 2 ? 'going deeper' : 'winding down ✦'}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}14`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cfg.color }} />
              <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: cfg.color }}>Active</Text>
            </View>
            {/* Mini progress arc as bar */}
            <View style={{ width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ height: 4, width: `${progress * 100}%`, borderRadius: 2, backgroundColor: phase === 3 ? '#FFD86F' : cfg.color }} />
            </View>
          </View>
        </View>

        {/* Time's up prompt */}
        {timeUpVis && (
          <Animated.View style={{ opacity: timeUpFade, backgroundColor: `${cfg.color}14`, borderRadius: 22, borderWidth: 1.5, borderColor: cfg.color, padding: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Satoshi-Bold', color: cfg.color, marginBottom: 6 }}>✦ Time's up, {cfg.archetype.replace('The ', '')}.</Text>
            <Text style={{ fontSize: 13.5, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22, marginBottom: 16 }}>
              You showed up and stayed. That's the whole thing. Ready to close this session?
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: cfg.color, borderRadius: 16, paddingVertical: 12, alignItems: 'center' }}
              onPress={handleEnd}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' }}>Close session</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Lumi companion */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 18, marginBottom: 14, overflow: 'hidden' }}>
          <LinearGradient colors={[`${cfg.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <LumiChat
            message={currentLumiMsg} color={cfg.color}
            onTapLumi={handleTapLumi} tapQuip={tapQuip}
            emotion={lumiEmotion} whisper={whisper}
          />
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); onChat(); }}
            activeOpacity={0.8}
            style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: `${cfg.color}18`, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: `${cfg.color}30` }}
          >
            <Text style={{ fontSize: 12, color: cfg.color }}>💬</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: cfg.color }}>Talk to Lumi</Text>
          </TouchableOpacity>
        </View>

        {/* Lumi's tip — appears at 35% */}
        {softVis && (
          <Animated.View style={{ opacity: softFade, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(200,180,255,0.18)', padding: 18, marginBottom: 14, overflow: 'hidden' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 10 }}>LUMI'S TIP</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22, fontStyle: 'italic' }}>
              "{cfg.softRescue}"
            </Text>
            <TouchableOpacity
              style={{ marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(176,144,255,0.3)' }}
              onPress={() => { Haptics.selectionAsync(); setSoftVis(false); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(176,144,255,0.8)' }}>Got it ✓</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Breathing game — appears at 20% */}
        {breathingVis && (
          <BreathingGame color={cfg.color} onDone={() => {
            setLumiEmotion('proud');
            setTimeout(() => setLumiEmotion(PHASE_EMOTIONS[phase]), 3000);
            setBreathingVis(false);
          }} />
        )}

        {/* Journal spark — appears at 50% */}
        {journalVis && (
          <JournalSpark color={cfg.color} mode={cfg.name} onDone={() => {
            setLumiEmotion('happy');
            setTimeout(() => setLumiEmotion(PHASE_EMOTIONS[phase]), 2200);
            setJournalVis(false);
          }} />
        )}

        {/* Story vibe card — appears at 78% */}
        {storyCardVis && (
          <StoryVibeCard cfg={cfg} onDismiss={() => setStoryCardVis(false)} />
        )}

        {/* Lumi chat nudge — appears at 60% */}
        {lumiNudgeVis && (
          <Animated.View style={{ opacity: lumiNudgeFade, backgroundColor: `${cfg.color}0C`, borderRadius: 20, borderWidth: 1, borderColor: `${cfg.color}28`, padding: 18, marginBottom: 14 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 8 }}>LUMI IS HERE</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 4 }}>Need to talk?</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(210,195,255,0.72)', marginBottom: 14 }}>
              Whatever's on your mind, she's present. No pressure.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: cfg.color, alignItems: 'center' }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setLumiNudgeVis(false); onChat(); }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#fff' }}>Open chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: `${cfg.color}35`, alignItems: 'center' }}
                onPress={() => { Haptics.selectionAsync(); setLumiNudgeVis(false); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: `${cfg.color}CC` }}>I'm good</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Session tasks */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 20, marginBottom: 14, overflow: 'hidden' }}>
          <LinearGradient colors={[`${cfg.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5 }}>SESSION TASKS</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: questDone === questTotal ? '#7CFC7C' : cfg.color }}>{questDone}/{questTotal}</Text>
          </View>
          <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 18 }}>
            <View style={{ height: 4, width: `${(questDone / questTotal) * 100}%`, borderRadius: 2, backgroundColor: questDone === questTotal ? '#7CFC7C' : cfg.color }} />
          </View>
          {tasks.map((task, i) => {
            const done = checkedTasks.has(i);
            return (
              <TouchableOpacity key={i} onPress={() => toggleTask(i)} activeOpacity={0.8}
                style={{ flexDirection: 'row', gap: 14, marginBottom: i < tasks.length - 1 ? 16 : 0, alignItems: 'flex-start' }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: done ? cfg.color : 'rgba(200,180,255,0.25)', backgroundColor: done ? cfg.color : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                  {done && <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text style={{ fontSize: 12 }}>{QUEST_TYPE_ICONS[task.type] ?? '✦'}</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: done ? 'rgba(200,180,255,0.45)' : '#EEE4FF', textDecorationLine: done ? 'line-through' : 'none', flex: 1, lineHeight: 20 }}>
                      {task.title}
                    </Text>
                  </View>
                  {!done && (
                    <Text style={{ fontSize: 12.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.60)', lineHeight: 19 }}>
                      {task.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          {questDone === questTotal && questTotal > 0 && (
            <View style={{ marginTop: 16, padding: 12, borderRadius: 14, backgroundColor: 'rgba(124,252,124,0.08)', borderWidth: 1, borderColor: 'rgba(124,252,124,0.2)' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#7CFC7C', textAlign: 'center' }}>All done. Lumi is proud of you. ✦</Text>
            </View>
          )}
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

        {!timeUpVis && (
          <TouchableOpacity
            style={{ borderWidth: 1, borderColor: `${cfg.color}35`, borderRadius: 24, paddingVertical: 16, alignItems: 'center' }}
            onPress={handleEnd}
            activeOpacity={0.78}
          >
            <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: `${cfg.color}99` }}>End early</Text>
          </TouchableOpacity>
        )}
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

// ─── Fallback quest tasks (when AI plan not available) ────────────────────────
const FALLBACK_QUESTS: Record<string, DriftQuest[]> = {
  challenge: [
    { title: 'Set one clear goal for this session', description: 'Write it down or say it aloud. What\'s the one thing you want to finish tonight?', type: 'challenge' },
    { title: '5-breath reset between tasks', description: 'When you switch tasks, pause. Five slow breaths. Reset your focus before the next thing.', type: 'mindful' },
    { title: 'Log one obstacle you solved', description: 'What got in your way today, and how did you handle it? Name it.', type: 'creation' },
  ],
  flow: [
    { title: 'Pick one thing and stay with it', description: 'No switching for 15 minutes. Just this one thing. Let yourself sink in.', type: 'challenge' },
    { title: 'Remove one distraction from your space', description: 'Silence a notification. Close a tab. Create one small quiet.', type: 'mindful' },
    { title: 'Notice the moment you enter flow', description: 'When it happens — that absorbed, effortless feeling — write one word about it.', type: 'discovery' },
  ],
  echo: [
    { title: 'Find something most people overlook', description: 'A detail, a sound, a path no one seems to take. Look for it intentionally.', type: 'discovery' },
    { title: '60 seconds of complete stillness', description: 'Stop. Just breathe and let the world exist around you for one full minute.', type: 'mindful' },
    { title: 'Capture one moment worth keeping', description: 'Something you\'d want to remember from tonight. A screenshot, a word, a feeling.', type: 'creation' },
  ],
  social: [
    { title: 'Say something kind to someone', description: 'One genuine message to another person — a player, a friend, anyone in your world.', type: 'connection' },
    { title: 'Do something alongside someone', description: 'A quest, a walk, anything. Just be present with another person for a moment.', type: 'connection' },
    { title: 'Write what you value about someone close to you', description: 'One sentence about someone who makes your experience better. Just notice it.', type: 'creation' },
  ],
  clarity: [
    { title: 'Write your biggest open question', description: 'The thing you\'re still figuring out. Get it out of your head and somewhere real.', type: 'creation' },
    { title: 'Make one small decision you\'ve been sitting on', description: 'Decide now, even if imperfectly. Movement beats perfection.', type: 'challenge' },
    { title: 'Name three things you know for certain', description: 'Ground yourself. What\'s solid right now? What\'s actually true?', type: 'mindful' },
  ],
  recovery: [
    { title: 'Let yourself do nothing for 5 minutes', description: 'No goals. No productivity. Just exist. This is the whole task — you\'re already doing it.', type: 'rest' },
    { title: 'Write one thing you\'re releasing today', description: 'Something you\'ve been carrying. Set it down just for now. It\'ll be there later if you need it.', type: 'creation' },
    { title: 'Find one thing that feels okay', description: 'Not great — just okay. Small. Real. It exists somewhere. Find it.', type: 'mindful' },
  ],
};

// ─── Chat message types ───────────────────────────────────────────────────────
type ChatMsg = { role: 'user' | 'assistant'; content: string };

function LumiChatScreen({ cfg, characterName, intention, onBack }: {
  cfg: ModeConfig; characterName: string; intention?: string; onBack: () => void;
}) {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;
  const btmPad  = Platform.OS === 'web' ? 80 : insets.bottom;
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: cfg.lumiIntro || "I'm here. What's on your mind?" },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    Haptics.selectionAsync();
    const next: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const history = next.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const res = await apiFetch<{ reply: string }>('/drift/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, mode: cfg.name, characterName, intention, history }),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "I'm still here. Sometimes the signal drifts a little." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />

      {/* Header */}
      <Animated.View style={{ opacity: enter, paddingHorizontal: 20, paddingBottom: 16 }}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{ marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.60)' }}>← Back to session</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <LumiCharacter color={cfg.color} size={52} />
          <View>
            <Text style={{ fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#F0E6FF' }}>Lumi</Text>
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: `${cfg.color}AA` }}>your companion</Text>
          </View>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${cfg.color}18`, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color }} />
            <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: cfg.color }}>Present</Text>
          </View>
        </View>
      </Animated.View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        {messages.map((m, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
            {m.role === 'assistant' && (
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${cfg.color}28`, borderWidth: 1, borderColor: `${cfg.color}50`, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14 }}>✦</Text>
              </View>
            )}
            <View style={[
              { maxWidth: SW * 0.75, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
              m.role === 'user'
                ? { backgroundColor: `${cfg.color}30`, borderWidth: 1, borderColor: `${cfg.color}50`, borderBottomRightRadius: 4 }
                : { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(200,180,255,0.15)', borderBottomLeftRadius: 4 },
            ]}>
              <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: m.role === 'user' ? '#F0E6FF' : 'rgba(225,210,255,0.90)', lineHeight: 22, fontStyle: m.role === 'assistant' ? 'italic' : 'normal' }}>
                {m.content}
              </Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${cfg.color}28`, borderWidth: 1, borderColor: `${cfg.color}50`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14 }}>✦</Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 18, paddingVertical: 14 }}>
              <Text style={{ fontSize: 18, color: `${cfg.color}CC`, letterSpacing: 3 }}>···</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(btmPad, 12) + 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(200,180,255,0.10)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}25`, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Talk to Lumi…"
            placeholderTextColor="rgba(200,180,255,0.35)"
            multiline
            maxLength={400}
            style={{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular', color: '#F0E6FF', minHeight: 36, maxHeight: 100, paddingTop: Platform.OS === 'ios' ? 8 : 4 }}
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={send}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: input.trim() && !loading ? cfg.color : `${cfg.color}30`, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 15, color: input.trim() && !loading ? '#fff' : `${cfg.color}60` }}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
export default function DriftScreen() {
  const { character } = useApp();
  const displayName   = character?.name && character.name !== 'Sky Child' ? character.name : 'Calm Space';

  const [step,            setStep]           = useState<FlowStep>('welcome');
  const [questionIdx,     setQuestionIdx]    = useState(0);
  const [answers,         setAnswers]        = useState<Record<string, string>>({});
  const [mode,            setMode]           = useState<string | null>(null);
  const [confidence,      setConfidence]     = useState(75);
  const [driftPlan,       setDriftPlan]      = useState<DriftPlan | null>(null);
  const [sessionStart,    setSessionStart]   = useState<number | null>(null);
  const [sessionDuration, setSessionDuration]= useState(900); // default 15 min
  const [result,          setResult]         = useState<SessionResult>({ elapsed: 0, questDone: 0, momentsFound: 0 });

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
          if (d.duration) setSessionDuration(d.duration);
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

  function handleStartSession(durationSecs: number) {
    const start = Date.now();
    setSessionStart(start);
    setSessionDuration(durationSecs);
    AsyncStorage.setItem('drift_session_v1', JSON.stringify({ mode, answers, sessionStart: start, duration: durationSecs })).catch(() => {});
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
    setSessionDuration(900);
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
      {step === 'session'         && cfg && <SessionScreen       cfg={cfg} sessionStart={sessionStart ?? Date.now()} duration={sessionDuration} onEnd={handleEndSession} onChat={() => go('lumi_chat')} />}
      {step === 'lumi_chat'       && cfg && <LumiChatScreen      cfg={cfg} characterName={displayName} intention={cfg.intention} onBack={() => go('session')} />}
      {step === 'summary'         && cfg && <SummaryScreen       cfg={cfg} result={result} onReflect={() => go('reflection')} />}
      {step === 'reflection'      && cfg && <ReflectionScreen    cfg={cfg} onContinue={() => go('break_prompt')} />}
      {step === 'break_prompt'    && cfg && <BreakPromptScreen   cfg={cfg} onBreak={() => go('farewell')} onContinue={handleRestart} />}
      {step === 'farewell'        && cfg && <FarewellScreen      cfg={cfg} onHome={handleRestart} />}
    </Animated.View>
  );
}
