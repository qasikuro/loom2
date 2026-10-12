import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useApp, apiFetch } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAuth } from '@clerk/expo';
import { LumiCompanion } from '@/features/lumi/components/LumiCompanion';
import { LumiAvatar } from '@/features/lumi/home/LumiCharacter';

// ─── Flow ────────────────────────────────────────────────────────────────────
type FlowStep =
  | 'companion'
  | 'welcome' | 'survey' | 'allset'
  | 'analyzing' | 'vibe_reveal'
  | 'mode_cinematic' | 'mode_perks' | 'meet_lumi'
  | 'session' | 'lumi_chat'
  | 'summary' | 'reflection' | 'break_prompt' | 'farewell';

type SessionResult = { elapsed: number; questDone: number; momentsFound: number };

// ─── Survey data ─────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: 'session', q: 'What kind of game session do you want today?',
    opts: [
      { id: 'locked_in',     label: 'Focused',              desc: 'I want to work toward a goal.',          em: '⚔️' },
      { id: 'just_existing', label: 'Relaxed',              desc: 'I want to play without a plan.',         em: '🌙' },
      { id: 'grinding',      label: 'Ready to keep going',  desc: 'I want to make more progress.',          em: '🔥' },
      { id: 'escaping',      label: 'Need a change',        desc: 'I want a break from my usual routine.',  em: '🌀' },
    ],
  },
  {
    id: 'depth', q: 'How long did you play last time?',
    opts: [
      { id: 'quick',      label: 'About 10 minutes',         desc: 'A short session.',                     em: '⚡' },
      { id: 'one_hour',   label: 'About 1 hour',             desc: 'A regular session.',                   em: '🕐' },
      { id: 'two_three',  label: '2–3 hours',                desc: 'A longer session.',                    em: '🌊' },
      { id: 'three_plus', label: 'More than 3 hours',        desc: 'A very long session.',                 em: '🌄' },
    ],
  },
  {
    id: 'frequency', q: 'How often do you reopen the game?',
    opts: [
      { id: 'once_week',  label: 'Once a week',             desc: 'Quality over quantity',                em: '📅' },
      { id: 'daily',      label: 'Daily',                   desc: "It's part of the routine",             em: '⭐' },
      { id: 'multiple',   label: 'Several times a day',     desc: 'I play more than once most days.',      em: '🔔' },
      { id: 'instantly',  label: 'Several times in a row',  desc: 'I often reopen it soon after playing.', em: '🌀' },
    ],
  },
  {
    id: 'who', q: 'Who do you usually play with?',
    opts: [
      { id: 'friends',  label: 'Friends',                   desc: 'The squad shows up',                   em: '🤝' },
      { id: 'randoms',  label: 'Other players',             desc: 'People I meet in the game.',            em: '🌍' },
      { id: 'solo',     label: 'Solo only',                 desc: 'My world, my rules',                   em: '🌙' },
      { id: 'menus',    label: 'Mostly in menus',           desc: 'I like setting things up or browsing.', em: '✨' },
    ],
  },
  {
    id: 'pull', q: 'What do you enjoy most about the game?',
    opts: [
      { id: 'progress',    label: 'Making progress',        desc: 'I like seeing what I have achieved.',  em: '📈' },
      { id: 'habit',       label: 'My routine',              desc: 'Playing is part of my day.',           em: '🔁' },
      { id: 'comfort',     label: 'It helps me relax',       desc: 'I enjoy spending time in the game.',   em: '🏡' },
      { id: 'competition', label: 'Competing',               desc: 'I like testing my skills.',            em: '🏆' },
    ],
  },
  {
    id: 'energy', q: 'How would you describe your energy right now?',
    opts: [
      { id: 'clear',   label: 'Ready',                      desc: 'I have energy to play.',               em: '☀️' },
      { id: 'calm',    label: 'Calm',                       desc: 'I want a quiet session.',              em: '🌙' },
      { id: 'drained', label: 'Tired',                      desc: 'I have less energy than usual.',       em: '🌧️' },
      { id: 'wired',   label: 'Restless',                   desc: 'I have energy but feel unsettled.',    em: '⚡' },
    ],
  },
];

const LUMI_DATA_NOTICE: Record<string, string> = {
  en: 'Your answers are sent to the AI service to set up your session.',
  ja: '回答はセッションを設定するためにAIサービスへ送信されます。',
  es: 'Tus respuestas se envían al servicio de IA para preparar tu sesión.',
  tr: 'Yanıtların oturumunu hazırlamak için yapay zekâ hizmetine gönderilir.',
  fr: 'Vos réponses sont envoyées au service d’IA pour préparer votre session.',
  de: 'Deine Antworten werden an den KI-Dienst gesendet, um deine Session einzurichten.',
  pt: 'Suas respostas são enviadas ao serviço de IA para preparar sua sessão.',
  ko: '답변은 세션을 준비하기 위해 AI 서비스로 전송돼요.',
  zh: '你的回答会发送给 AI 服务，用于设置本次游戏时段。',
  ru: 'Ваши ответы отправляются в сервис ИИ, чтобы настроить сеанс.',
  ar: 'تُرسل إجاباتك إلى خدمة الذكاء الاصطناعي لإعداد جلستك.',
  it: 'Le tue risposte vengono inviate al servizio AI per preparare la sessione.',
};

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
    name: 'Challenge Mode', archetype: 'Focused Player', symbol: '⚔️',
    color: '#FF7070', gradient: ['#2A0808', '#3E1010', '#4E1818'] as const,
    bg: ['#1A0404', '#2A0808'] as const,
    tagline: 'Choose a goal and work toward it.',
    description: 'You want to focus and make progress. Pick one goal for this session.',
    traits: ['Likes goals', 'Ready to focus', 'Enjoys a challenge'],
    perks: ['Optional goal ideas', 'Small challenges', 'A session recap'],
    whatChanged: ['Choose a goal if you want one', 'Try a small challenge', 'Track what you did', 'Ask Lumi for a new idea'],
    lumiIntro: 'Want to choose one goal for this session?',
    lumiSession: 'Pick a goal, and take it one step at a time.',
    quest: 'Choose one goal to work on', questTotal: 1,
    events: ['Choose a goal for this session.', 'Want a challenge? Pick one to try.', 'Take one step at a time.', 'You can change your goal whenever you like.'],
    softRescue: 'Want a challenge? Try one small step first.',
    reflection: 'What did you try? What would you like to do next time?',
    evolution: ['Focused Player', 'Goal Setter', 'Challenge Seeker'],
    stability: 88,
  },
  flow: {
    name: 'Flow Mode', archetype: 'Relaxed Explorer', symbol: '🌊',
    color: '#6BC5FF', gradient: ['#08182A', '#102238', '#183248'] as const,
    bg: ['#040E1A', '#08182A'] as const,
    tagline: 'Take your time and play your way.',
    description: 'Take your time and play at your own pace. Lumi can suggest something to try.',
    traits: ['Likes to explore', 'Easygoing', 'Plays at their own pace'],
    perks: ['Optional ideas', 'Simple session goals', 'Lumi is here if you need help'],
    whatChanged: ['Choose an idea if you want one', 'Take breaks when you like', 'Explore at your own pace', 'Ask Lumi for help'],
    lumiIntro: "Take your time. Explore wherever you like. I'm here if you need help.",
    lumiSession: 'No rush. Pick a place and explore at your own pace.',
    quest: 'Explore a new area at your own pace', questTotal: 1,
    events: ['Take your time.', 'Choose somewhere you want to explore.', 'Take a break whenever you need one.', 'Ask Lumi for an idea if you get stuck.'],
    softRescue: 'Want a change? Try a different place in your game.',
    reflection: 'What did you enjoy? Is there anything you want to try next time?',
    evolution: ['Relaxed Explorer', 'Curious Player', 'World Explorer'],
    stability: 82,
  },
  echo: {
    name: 'Echo Mode', archetype: 'Solo Explorer', symbol: '🌙',
    color: '#B090FF', gradient: ['#100828', '#1C1040', '#281850'] as const,
    bg: ['#080418', '#100828'] as const,
    tagline: 'Explore on your own terms.',
    description: 'You like exploring by yourself. Go at your own pace, and ask Lumi for an idea if you want one.',
    traits: ['Enjoys solo play', 'Likes to explore', 'Sets their own pace'],
    perks: ['Optional suggestions', 'Simple session goals', 'Chat with Lumi when you want'],
    whatChanged: ['Choose a suggestion if you want one', 'Explore at your own pace', 'Take a break whenever you like', 'Ask Lumi for help'],
    lumiIntro: 'You can explore on your own. Ask me if you want an idea.',
    lumiSession: 'No rush. Choose where you want to go next.',
    quest: 'Explore a place you have not visited before', questTotal: 1,
    events: ['Take your time.', 'Choose somewhere you want to explore.', 'You can play on your own or ask Lumi for help.', 'Take a break whenever you need one.'],
    softRescue: 'Want a change? Try a different area in your game.',
    reflection: 'Did you enjoy exploring? What would you like to do next time?',
    evolution: ['Solo Explorer', 'Curious Player', 'Path Finder'],
    stability: 79,
  },
  social: {
    name: 'Social Mode', archetype: 'Team Player', symbol: '✨',
    color: '#6BD48A', gradient: ['#08200E', '#102A16', '#183A1E'] as const,
    bg: ['#04100A', '#08200E'] as const,
    tagline: 'Play with people you know.',
    description: 'You enjoy playing with others. You can plan a group activity or message a friend.',
    traits: ['Likes playing with others', 'Enjoys teamwork', 'Values time with friends'],
    perks: ['Ideas for group play', 'Optional team goals', 'Time to catch up'],
    whatChanged: ['Choose a group activity if you want one', 'Try a team goal', 'Invite someone you know', 'Ask Lumi for an idea'],
    lumiIntro: 'Want to play with someone today? We can think of something to do together.',
    lumiSession: 'If you like, invite a friend you know to play.',
    quest: 'Choose a game activity to do with a friend', questTotal: 1,
    events: ['Want company? Message a friend you know.', 'Pick a game activity to do together.', 'You can play solo or with friends.', 'Ask Lumi for an idea for your next group session.'],
    softRescue: 'If you want company, message a friend you know.',
    reflection: 'Did you play or chat with someone? What would you like to do together next time?',
    evolution: ['Team Player', 'Good Teammate', 'Friend Finder'],
    stability: 84,
  },
  clarity: {
    name: 'Clarity Mode', archetype: 'Planner', symbol: '🔮',
    color: '#FFD86F', gradient: ['#1A1200', '#2A1E00', '#3A2A00'] as const,
    bg: ['#0E0A00', '#1A1200'] as const,
    tagline: 'Choose what to do next.',
    description: 'You want a clear plan. Pick one thing to do first, then decide what comes next.',
    traits: ['Likes a plan', 'Thinks things through', 'Prefers clear steps'],
    perks: ['Simple suggestions', 'One goal at a time', 'A session recap'],
    whatChanged: ['Choose one thing to focus on', 'Break a goal into small steps', 'Change your plan any time', 'Ask Lumi for help deciding'],
    lumiIntro: 'What would you like to do first? I can help you choose.',
    lumiSession: 'Choose one thing to do next. We can keep it simple.',
    quest: 'Choose one thing to do and take the first step', questTotal: 1,
    events: ['What would you like to do next?', 'Choose one goal to focus on.', 'You can change your plan at any time.', 'Ask Lumi if you want help choosing.'],
    softRescue: 'Start with one small step. You can decide what comes next later.',
    reflection: 'What did you choose to do? Would you plan it the same way next time?',
    evolution: ['Planner', 'Clear Thinker', 'Goal Planner'],
    stability: 81,
  },
  recovery: {
    name: 'Recovery Mode', archetype: 'Low-Energy Player', symbol: '🌸',
    color: '#FF89B0', gradient: ['#200814', '#301220', '#401A2C'] as const,
    bg: ['#100408', '#200814'] as const,
    tagline: 'Keep it easy today.',
    description: 'If you have less energy, keep this session simple. You can take a break or stop whenever you like.',
    traits: ['Wants an easy session', 'Taking it slow', 'Likes simple goals'],
    perks: ['Optional easy goals', 'Breaks when you need them', 'Friendly check-ins'],
    whatChanged: ['Choose one small thing to try', 'Take a break whenever you like', 'Skip any suggestion', 'Ask Lumi for help'],
    lumiIntro: 'You do not need to do a lot today. Try one small thing, or take a break.',
    lumiSession: 'Go at your own pace. It is okay to stop or rest.',
    quest: 'Choose one small thing to try, or take a break', questTotal: 1,
    events: ['Keep it simple today.', 'Take a break if you need one.', 'You can stop whenever you like.', 'Ask Lumi for an easy idea.'],
    softRescue: 'If you are tired, pause the game or stop for today.',
    reflection: 'Did anything feel fun or relaxing today? It is okay if you just rested.',
    evolution: ['Easy Start', 'Steady Player', 'Ready Again'],
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    "Want help choosing your next goal?",
    "You can take this one step at a time.",
    "Need a new challenge? I can suggest one.",
    "You can change your goal whenever you like.",
    "How is your goal going so far?",
  ],
  flow: [
    "Take your time.",
    "Play at your own pace.",
    "Want an idea for what to do next?",
    "You can take a break whenever you like.",
    "Is there somewhere you want to explore?",
  ],
  echo: [
    "Want to explore somewhere new?",
    "You can play on your own or ask me for an idea.",
    "No rush. Choose where you want to go.",
    "Need help deciding what to do next?",
    "Take a break whenever you need one.",
  ],
  social: [
    "Want to invite a friend you know to play?",
    "What would you like to do together?",
    "You can play with friends or on your own.",
    "Need an idea for a group session?",
    "A quick message can help make a plan.",
  ],
  clarity: [
    "What would you like to do first?",
    "Choose one goal to focus on.",
    "You can change your plan at any time.",
    "Want help deciding what to do next?",
    "A small first step is enough.",
  ],
  recovery: [
    "It is okay to keep this session short.",
    "Take a break if you need one.",
    "You can stop whenever you like.",
    "Want an easy idea, or would you rather rest?",
    "There is no need to finish a goal today.",
  ],
};

const LUMI_QUIPS_DEFAULT = [
  "What would you like help with?",
  "Want an idea for your next game session?",
  "You can take a break whenever you like.",
  "Tell me what you want to do, and I will try to help.",
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { width } = useWindowDimensions();
  const msgFade     = useRef(new Animated.Value(0)).current;
  const quipFade    = useRef(new Animated.Value(0)).current;
  const whisperFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    msgFade.setValue(0);
    Animated.timing(msgFade, { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => {
    if (!tapQuip) return;
    quipFade.setValue(0);
    Animated.sequence([
      Animated.timing(quipFade, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(quipFade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tapQuip]);

  useEffect(() => {
    if (!whisper) return;
    whisperFade.setValue(0);
    Animated.sequence([
      Animated.timing(whisperFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(whisperFade, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            paddingHorizontal: 14, paddingVertical: 10, maxWidth: Math.max(width - 80, 220),
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
  const { t } = useTranslation();
  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [round, setRound] = useState(0);
  const [label, setLabel] = useState('Tap to begin');
  const circleScale = useRef(new Animated.Value(1)).current;
  const circleOp   = useRef(new Animated.Value(0.35)).current;
  const cardFade   = useRef(new Animated.Value(0)).current;
  const currentRound = useRef(0);

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color }}>{t('feature.drift.done')}</Text>
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
  const { t } = useTranslation();
  const [text, setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            placeholder={t('feature.drift.feelingPlaceholder')}
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
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.35)' }}>{t('feature.drift.skip')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </Animated.View>
  );
}

// ─── Story vibe card ──────────────────────────────────────────────────────────
function StoryVibeCard({ cfg, onDismiss }: { cfg: ModeConfig; onDismiss: () => void }) {
  const { t } = useTranslation();
  const router   = useRouter();
  const cardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color }}>{t('feature.drift.exploreStories')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={{ paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(235,220,255,0.35)' }}>{t('feature.drift.maybeLater')}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Option card ──────────────────────────────────────────────────────────────
type OptItem = { id: string; label: string; desc: string; em: string };
function OptionCard({ opt, label, selected, onPress, color }: { opt: OptItem; label?: string; selected: boolean; onPress: () => void; color: string }) {
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
          <Text style={[oc.label, selected && { color }]}>{label ?? opt.label}</Text>
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
  const { width } = useWindowDimensions();
  const buttonWidth = Math.min(Math.max(width - 48, 240), 520);
  return (
    <TouchableOpacity
      style={[pb.btn, { width: buttonWidth }, muted
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
  btn:  { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', maxWidth: '100%' },
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
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  const language = (i18n.resolvedLanguage ?? i18n.language).split('-')[0];
  const surveyIntro = t('feature.drift.surveyIntro').split('\n')[0];
  const dataNotice = LUMI_DATA_NOTICE[language] ?? LUMI_DATA_NOTICE.en;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 900, delay: 150, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            {t('feature.drift.welcomeTo')}
          </Text>
          <Text style={{ fontSize: 52, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', letterSpacing: -2, textAlign: 'center', lineHeight: 58 }}>
            {name} ✦
          </Text>
        </Animated.View>
        <Animated.Text style={{ opacity: enter, fontSize: 16, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.68)', lineHeight: 26, textAlign: 'center', marginBottom: 28 }}>
          {t('feature.drift.welcomeBody')}
        </Animated.Text>
        <Animated.View style={{ opacity: enter, backgroundColor: 'rgba(176,144,255,0.07)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(176,144,255,0.16)', paddingHorizontal: 20, paddingVertical: 14, marginBottom: 32, width: '100%' }}>
          <Text style={{ fontSize: 12.5, fontFamily: 'Satoshi-Regular', color: 'rgba(190,170,255,0.72)', textAlign: 'center', lineHeight: 20 }}>
            {surveyIntro}{'\n'}{dataNotice}
          </Text>
        </Animated.View>
        <Animated.View style={{ opacity: enter, alignItems: 'center', gap: 12, width: '100%' }}>
          <PrimaryBtn label={t('feature.drift.getStarted')} onPress={onStart} color="#7050C8" />
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(176,144,255,0.45)' }}>
            {t('feature.drift.privacy')}
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const current = answers[question.id] ?? null;
  const progAnim = useRef(new Animated.Value((qIdx) / total)).current;
  useEffect(() => {
    Animated.timing(progAnim, { toValue: (qIdx + 1) / total, duration: 420, useNativeDriver: false }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {t(`feature.drift.q${question.id[0]?.toUpperCase()}${question.id.slice(1)}`, { defaultValue: question.q })}
        </Text>
        {question.opts.map((opt, optionIndex) => (
          <OptionCard key={opt.id} opt={opt}
            label={t(`feature.drift.optionLabels.${question.id}.${optionIndex}`, { defaultValue: opt.label })}
            selected={current === opt.id}
            onPress={() => onAnswer(question.id, opt.id)} color="#B090FF" />
        ))}
      </ScrollView>
    </View>
  );
}

function AllSetScreen({ onBegin }: { onBegin: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const points = [
    t('feature.drift.point1'), t('feature.drift.point2'),
    t('feature.drift.point3'), t('feature.drift.point4'),
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad, alignItems: 'center', justifyContent: 'center' }]}>
      <LinearGradient colors={['#080614', '#0E0A24', '#160E38']} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, alignItems: 'center', paddingTop: 40 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <Text style={{ fontSize: 56, marginBottom: 8 }}>✦</Text>
          <Text style={{ fontSize: 38, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 10, letterSpacing: -1 }}>{t('feature.drift.allSet')}</Text>
          <Text style={{ fontSize: 16, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.70)', textAlign: 'center', lineHeight: 26, marginBottom: 36 }}>
            {t('feature.drift.personalize')}
          </Text>
           <View style={{ width: Math.min(Math.max(width - 56, 240), 520), maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(176,144,255,0.20)', padding: 22, marginBottom: 36 }}>
            {points.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: i < points.length - 1 ? 18 : 0 }}>
                <Text style={{ fontSize: 14, color: '#B090FF', marginTop: 2 }}>✦</Text>
                <Text style={{ flex: 1, fontSize: 14, color: '#EDE4FF', lineHeight: 22 }}>{p}</Text>
              </View>
            ))}
          </View>
          <PrimaryBtn label={t('feature.drift.letsBegin')} onPress={onBegin} color="#7050C8" />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function AnalyzingScreen({ confidence }: { confidence: number }) {
  const { t } = useTranslation();
  const spin   = useRef(new Animated.Value(0)).current;
  const [pct, setPct] = useState(0);
  const labels = [t('feature.drift.analyzing1'), t('feature.drift.analyzing2'), t('feature.drift.analyzing3')];
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { t } = useTranslation();
  const modeKey = Object.keys(MODES).find(key => MODES[key].name === cfg.name) ?? 'challenge';
  const archetype = t(`feature.drift.archetypes.${modeKey}`, { defaultValue: cfg.archetype });
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const archScale = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(enter,    { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(archScale,{ toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, alignItems: 'center', paddingTop: 28 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
            {t('feature.drift.todaysVibe')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View style={[{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: `${cfg.color}15`, borderColor: `${cfg.color}40` }]}>
              <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: cfg.color }}>
                {cfg.name}
              </Text>
            </View>
          </View>
          <Animated.Text style={{ fontSize: 42, fontFamily: 'Satoshi-Bold', color: cfg.color, textAlign: 'center', letterSpacing: -1, transform: [{ scale: archScale }] }}>
            {archetype.replace(/^The /, '')}
          </Animated.Text>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(210,195,255,0.65)', marginTop: 4, letterSpacing: 0.5 }}>
            {cfg.symbol}  {archetype}
          </Text>
          {cfg.intention ? (
            <View style={{ marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, backgroundColor: `${cfg.color}14`, borderWidth: 1, borderColor: `${cfg.color}30` }}>
              <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(230,215,255,0.85)', textAlign: 'center', fontStyle: 'italic', lineHeight: 22 }}>
                {cfg.intention}
              </Text>
            </View>
          ) : null}
        </Animated.View>

         <Animated.View style={{ opacity: enter, width: Math.min(Math.max(width - 56, 240), 520), maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 22, marginBottom: 20 }}>
          <LinearGradient colors={[`${cfg.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.85)', lineHeight: 25, marginBottom: 20 }}>
            {cfg.description}
          </Text>
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 12 }}>{t('feature.drift.traits')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cfg.traits.map(t => <TraitPill key={t} label={t} color={cfg.color} />)}
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: enter, width: '100%', gap: 10 }}>
          <PrimaryBtn label={t('feature.drift.continue')} onPress={onContinue} color={cfg.color} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ModeCinematicScreen({ cfg, onEnter }: { cfg: ModeConfig; onEnter: () => void }) {
  const { t } = useTranslation();
  const modeKey = Object.keys(MODES).find(key => MODES[key].name === cfg.name) ?? 'challenge';
  const modeName = t(`feature.drift.modeNames.${modeKey}`, { defaultValue: cfg.name });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const circleS = expand.interpolate({ inputRange: [0, 1], outputRange: [0.01, 20] });
  const stats   = [
    { label: t('feature.drift.companion'), val: t('feature.drift.enabled') },
    { label: t('feature.drift.mode'), val: modeName.split(' ')[0] },
    { label: 'Lumi', val: t('feature.drift.active') },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad, overflow: 'hidden' }]}>
      <LinearGradient colors={cfg.bg} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Animated.View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${cfg.color}30`, transform: [{ scale: circleS }] }} />
      </View>
      <StarField />
       <ScrollView
         style={{ flex: 1 }}
         contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 }}
         showsVerticalScrollIndicator={false}
       >
        <Animated.Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: `${cfg.color}AA`, letterSpacing: 4, textTransform: 'uppercase', opacity: textIn, marginBottom: 16 }}>
          {t('feature.drift.activating')}
        </Animated.Text>
        <Animated.Text style={{ fontSize: 52, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', letterSpacing: -2, textAlign: 'center', opacity: textIn, lineHeight: 58, marginBottom: 6 }}>
          {modeName}
        </Animated.Text>
        <Animated.Text style={{ fontSize: 48, opacity: symbolP, marginBottom: 32 }}>
          {cfg.symbol}
        </Animated.Text>
        <Animated.Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: `${cfg.color}CC`, textAlign: 'center', opacity: textIn, marginBottom: 40 }}>
          {cfg.tagline}
        </Animated.Text>
        <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 48, opacity: textIn }}>
          {stats.map(s => (
            <View key={s.label} style={{ alignItems: 'center', backgroundColor: `${cfg.color}12`, borderRadius: 14, borderWidth: 1, borderColor: `${cfg.color}30`, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: cfg.color }}>{s.val}</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.5)', marginTop: 2 }}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>
        <Animated.View style={{ opacity: textIn, width: '100%' }}>
          <PrimaryBtn label={t('feature.drift.enterMode', { mode: modeName })} onPress={onEnter} color={cfg.color} />
        </Animated.View>
       </ScrollView>
    </View>
  );
}

function ModePerksScreen({ cfg, onGotIt }: { cfg: ModeConfig; onGotIt: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
       <ScrollView
         style={{ flex: 1 }}
         contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 }}
         showsVerticalScrollIndicator={false}
       >
        <Animated.View style={{ opacity: enter, width: '100%', alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: `${cfg.color}25`, borderWidth: 1.5, borderColor: `${cfg.color}50`, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 28 }}>{cfg.symbol}</Text>
           </View>
          <Text style={{ fontSize: 28, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', textAlign: 'center', marginBottom: 6 }}>{t('feature.drift.modeActivated')}</Text>
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.65)', textAlign: 'center', marginBottom: 32 }}>
            {t('feature.drift.journeyShifted')}
          </Text>
          <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}22`, padding: 22, marginBottom: 32 }}>
            <LinearGradient colors={[`${cfg.color}10`, 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 16 }}>{t('feature.drift.different')}</Text>
            {cfg.whatChanged.map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i < cfg.whatChanged.length - 1 ? 14 : 0 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.color, marginTop: 7 }} />
                <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22 }}>{w}</Text>
              </View>
            ))}
          </View>
          <PrimaryBtn label={t('feature.drift.gotIt')} onPress={onGotIt} color={cfg.color} />
        </Animated.View>
       </ScrollView>
    </View>
  );
}

const DURATIONS = [
  { label: 'Quick',  mins: 5,  desc: '5 min · small and focused' },
  { label: 'Steady', mins: 15, desc: '15 min · a real moment' },
  { label: 'Deep',   mins: 30, desc: '30 min · full presence' },
];

function MeetLumiScreen({ cfg, onContinue }: { cfg: ModeConfig; onContinue: (durationSecs: number) => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const [selectedMins, setSelectedMins] = useState(15);
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 800, delay: 150, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
       <ScrollView
         style={{ flex: 1 }}
         contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 }}
         showsVerticalScrollIndicator={false}
       >
        <Animated.View style={{ opacity: enter, alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.55)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>
            {t('feature.drift.meetLumi')}
          </Text>
          <LumiCharacter color={cfg.color} size={100} />
          <View style={{ backgroundColor: `${cfg.color}10`, borderRadius: 20, borderWidth: 1, borderColor: `${cfg.color}28`, padding: 20, marginTop: 22, marginBottom: 28, width: '100%' }}>
            <Text style={{ fontSize: 14.5, fontFamily: 'Satoshi-Regular', color: 'rgba(230,215,255,0.88)', lineHeight: 24, fontStyle: 'italic', textAlign: 'center' }}>
              "{cfg.lumiIntro}"
            </Text>
           </View>

          {/* Duration picker */}
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.50)', letterSpacing: 1.5, marginBottom: 14 }}>{t('feature.drift.howLong')}</Text>
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
       </ScrollView>
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
  const { t } = useTranslation();
  const modeKey = Object.keys(MODES).find(key => MODES[key].name === cfg.name) ?? 'challenge';
  const archetype = t(`feature.drift.archetypes.${modeKey}`, { defaultValue: cfg.archetype });
  const modeName = t(`feature.drift.modeNames.${modeKey}`, { defaultValue: cfg.name });
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
    : [cfg.lumiSession, 'Want help choosing what to do next?', 'I\'m here if you need help.', 'Take your time.', 'Hope you\'re enjoying the game.'];

  // Spread 5 messages across 4 phases; cycle within current phase's message
  const _phaseMsg = allLumiMsgs[Math.min(phase, allLumiMsgs.length - 1)];
  const windDownMsgs = [
    'Your session is almost over. You can finish whenever you like.',
    'What did you enjoy about this session?',
    'Would you like to play again later?',
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // Soft tip at 35% of session
  useEffect(() => {
    const t = setTimeout(() => {
      setSoftVis(true);
      Animated.timing(softFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, duration * 0.35 * 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // Lumi nudge at 60% of session
  useEffect(() => {
    const t = setTimeout(() => {
      setLumiNudgeVis(true);
      Animated.timing(lumiNudgeFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, duration * 0.6 * 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  // Phase → emotion
  useEffect(() => { setLumiEmotion(PHASE_EMOTIONS[phase]); }, [phase]);

  // Ambient whispers
  useEffect(() => {
    const pool = [
      'Need an idea?', 'Take your time', 'I’m here if you need help',
      'Want to take a break?', 'How is the game going?', 'You can change your goal',
      'No rush', 'Want help choosing?', 'Keep it simple',
      'You can stop whenever you like', 'What would you like to do next?', 'Keep going if you want to',
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.6)', letterSpacing: 0.5, marginBottom: 4 }}>{cfg.symbol} {modeName}</Text>
            <Text style={{ fontSize: 44, fontFamily: 'Satoshi-Bold', color: phase === 3 ? '#FFD86F' : '#F0E6FF', letterSpacing: -2 }}>
              {remMm}:{remSs}
            </Text>
            <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.45)', marginTop: 2 }}>
              {phase === 0 ? t('feature.drift.settling') : phase === 1 ? t('feature.drift.flowing') : phase === 2 ? t('feature.drift.deeper') : t('feature.drift.winding')}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}14`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cfg.color }} />
              <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: cfg.color }}>{t('feature.drift.active')}</Text>
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
            <Text style={{ fontSize: 16, fontFamily: 'Satoshi-Bold', color: cfg.color, marginBottom: 6 }}>{t('feature.drift.timeUp', { name: archetype.replace(/^The /, '') })}</Text>
            <Text style={{ fontSize: 13.5, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22, marginBottom: 16 }}>
              {t('feature.drift.timeUpBody')}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: cfg.color, borderRadius: 16, paddingVertical: 12, alignItems: 'center' }}
              onPress={handleEnd}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' }}>{t('feature.drift.closeSession')}</Text>
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
            <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: cfg.color }}>{t('feature.drift.talkToLumi')}</Text>
          </TouchableOpacity>
        </View>

        {/* Lumi's tip — appears at 35% */}
        {softVis && (
          <Animated.View style={{ opacity: softFade, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(200,180,255,0.18)', padding: 18, marginBottom: 14, overflow: 'hidden' }}>
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 10 }}>{t('feature.drift.lumiTip')}</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22, fontStyle: 'italic' }}>
              "{cfg.softRescue}"
            </Text>
            <TouchableOpacity
              style={{ marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(176,144,255,0.3)' }}
              onPress={() => { Haptics.selectionAsync(); setSoftVis(false); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(176,144,255,0.8)' }}>{t('feature.drift.dismiss')}</Text>
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
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 8 }}>{t('feature.drift.yourCompanion')}</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 4 }}>Need to talk?</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(210,195,255,0.72)', marginBottom: 14 }}>
              Ask Lumi for help with your game session or an idea for what to do next.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 16, backgroundColor: cfg.color, alignItems: 'center' }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setLumiNudgeVis(false); onChat(); }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#fff' }}>{t('feature.home.chatWithLumi')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: `${cfg.color}35`, alignItems: 'center' }}
                onPress={() => { Haptics.selectionAsync(); setLumiNudgeVis(false); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: `${cfg.color}CC` }}>{t('feature.drift.gotIt')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Session tasks */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 20, marginBottom: 14, overflow: 'hidden' }}>
          <LinearGradient colors={[`${cfg.color}12`, 'transparent']} style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5 }}>{t('feature.drift.sessionSummary')}</Text>
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
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#7CFC7C', textAlign: 'center' }}>{t('feature.drift.amazing')}</Text>
            </View>
          )}
        </View>

        {/* Mode Perks */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}18`, padding: 18, marginBottom: 20, overflow: 'hidden' }}>
          <LinearGradient colors={[`${cfg.color}10`, 'transparent']} style={StyleSheet.absoluteFill} />
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 12 }}>{t('feature.drift.different')}</Text>
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
            <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: `${cfg.color}99` }}>{t('feature.drift.endSession')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function SummaryScreen({ cfg, result, onReflect }: { cfg: ModeConfig; result: SessionResult; onReflect: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  const stabAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
    Animated.timing(stabAnim, { toValue: cfg.stability, duration: 1800, delay: 400, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            {t('feature.drift.sessionSummary')}
          </Text>
          <Text style={{ fontSize: 32, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', textAlign: 'center', lineHeight: 40 }}>
            {t('feature.drift.amazing')}
          </Text>
        </Animated.View>

        {/* Stability scoring intentionally not shown to players */}

        {/* Achievements */}
        <Animated.View style={{ opacity: enter, width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 22, marginBottom: 24 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.45)', letterSpacing: 1.5, marginBottom: 16 }}>{t('feature.drift.achieved')}</Text>
          {achievements.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: i < achievements.length - 1 ? 12 : 0 }}>
              <Text style={{ fontSize: 12, color: cfg.color, marginTop: 2 }}>✦</Text>
              <Text style={{ flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(220,205,255,0.82)', lineHeight: 22 }}>{a}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View style={{ opacity: enter, width: '100%' }}>
          <PrimaryBtn label={t('feature.drift.fullReflection')} onPress={onReflect} color={cfg.color} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ReflectionScreen({ cfg, onContinue }: { cfg: ModeConfig; onContinue: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 800, delay: 100, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
       <ScrollView
         style={{ flex: 1 }}
         contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 }}
         showsVerticalScrollIndicator={false}
       >
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 28 }}>{t('feature.drift.reflection')}</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: `${cfg.color}AA`, letterSpacing: 1, marginBottom: 20 }}>" "</Text>
          <Text style={{ fontSize: 20, fontFamily: 'Satoshi-Regular', color: 'rgba(230,215,255,0.88)', lineHeight: 32, textAlign: 'center', fontStyle: 'italic', marginBottom: 28 }}>
            {cfg.reflection}
          </Text>
          <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: `${cfg.color}CC`, marginBottom: 48, textAlign: 'center' }}>
            {t('feature.drift.keepGrowing')}
          </Text>
          <PrimaryBtn label={t('feature.drift.continue')} onPress={onContinue} color={cfg.color} />
        </Animated.View>
       </ScrollView>
    </View>
  );
}

function BreakPromptScreen({ cfg, onBreak, onContinue }: { cfg: ModeConfig; onBreak: () => void; onContinue: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const enter  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const evol = cfg.evolution;
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 60, paddingTop: 32, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: enter, width: '100%', alignItems: 'center' }}>
          {/* Journey Progress */}
          <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.5)', letterSpacing: 1.5, marginBottom: 20 }}>{t('feature.drift.journeyProgress')}</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.6)', marginBottom: 16 }}>{t('feature.drift.everyStep')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, marginBottom: 8, width: '100%', justifyContent: 'center' }}>
            {evol.map((e, i) => (
              <View key={e} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2 }, i === 0 ? { backgroundColor: `${cfg.color}30`, borderColor: cfg.color } : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' }]}>
                    <Text style={{ fontSize: 16 }}>{i === 0 ? cfg.symbol : '○'}</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: i === 0 ? cfg.color : 'rgba(200,180,255,0.4)', marginTop: 6, textAlign: 'center', maxWidth: 70 }} numberOfLines={2}>{e}</Text>
                  {i === 0 && <Text style={{ fontSize: 9, color: 'rgba(200,180,255,0.4)', marginTop: 2 }}>{t('feature.drift.current')}</Text>}
                  {i === 1 && <Text style={{ fontSize: 9, color: 'rgba(200,180,255,0.4)', marginTop: 2 }}>{t('feature.drift.next')}</Text>}
                </View>
                {i < evol.length - 1 && (
                  <View style={{ width: 28, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 4, marginBottom: 24 }} />
                )}
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', color: `${cfg.color}99`, marginBottom: 36, textAlign: 'center' }}>
            {t('feature.drift.evolutionProgress', { percent: 72 })}
          </Text>

          {/* Break Prompt */}
          <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 22, borderWidth: 1, borderColor: `${cfg.color}20`, padding: 22, marginBottom: 20 }}>
            <LinearGradient colors={[`${cfg.color}10`, 'transparent']} style={StyleSheet.absoluteFill} />
            <Text style={{ fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', marginBottom: 6 }}>{t('feature.drift.takeBreak')}</Text>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.65)', lineHeight: 22, marginBottom: 24 }}>
              {t('feature.drift.restJourney')}
            </Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{ paddingVertical: 14, borderRadius: 18, backgroundColor: `${cfg.color}20`, borderWidth: 1, borderColor: `${cfg.color}40`, alignItems: 'center' }}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBreak(); }}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: cfg.color }}>{t('feature.drift.takeBreakButton')}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: `${cfg.color}88`, marginTop: 3 }}>{t('feature.drift.returnMessage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ paddingVertical: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' }}
                onPress={() => { Haptics.selectionAsync(); onContinue(); }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(200,180,255,0.75)' }}>{t('feature.drift.continueLater')}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(180,160,255,0.45)', marginTop: 3 }}>{t('feature.drift.saveProgress')}</Text>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topPad }]}>
      <LinearGradient colors={cfg.gradient} style={StyleSheet.absoluteFill} />
      <StarField />
       <ScrollView
         style={{ flex: 1 }}
         contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 }}
         showsVerticalScrollIndicator={false}
       >
        <Animated.View style={{ opacity: enter, alignItems: 'center' }}>
          <LumiCharacter color={cfg.color} size={110} />
          <Text style={{ fontSize: 34, fontFamily: 'Satoshi-Bold', color: '#F0E6FF', textAlign: 'center', marginTop: 32, marginBottom: 12, lineHeight: 42 }}>
            See you soon.
          </Text>
          <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.60)', textAlign: 'center', lineHeight: 24, marginBottom: 56 }}>
            Come back anytime to start another session.
          </Text>
          <PrimaryBtn label="Home" onPress={onHome} color={cfg.color} />
        </Animated.View>
       </ScrollView>
    </View>
  );
}

// ─── Fallback quest tasks (when AI plan not available) ────────────────────────
const FALLBACK_QUESTS: Record<string, DriftQuest[]> = {
  challenge: [
    { title: 'Choose one game goal', description: 'Pick one thing you would like to do in the game.', type: 'challenge' },
    { title: 'Try one small challenge', description: 'Choose a challenge that feels right for this session.', type: 'challenge' },
    { title: 'Check your progress', description: 'Think about what you have done so far.', type: 'creation' },
  ],
  flow: [
    { title: 'Explore a new area', description: "Visit a place in the game you haven't seen before.", type: 'discovery' },
    { title: 'Go somewhere you like', description: 'Visit a place in the game that you enjoy.', type: 'discovery' },
    { title: 'Take a short break', description: 'Pause the game and come back when you want.', type: 'rest' },
  ],
  echo: [
    { title: 'Explore a new area', description: 'Visit a place in the game you have not seen before.', type: 'discovery' },
    { title: 'Choose what to do next', description: 'Pick one thing you want to try in the game.', type: 'gameplay' },
    { title: 'Take a short break', description: 'Pause the game and come back when you want.', type: 'rest' },
  ],
  social: [
    { title: 'Invite a friend you know', description: 'Ask a friend if they would like to play with you.', type: 'connection' },
    { title: 'Choose a group activity', description: 'Pick something you and your friends can do together.', type: 'connection' },
    { title: 'Plan your next game', description: 'Ask a friend what they would like to play next time.', type: 'connection' },
  ],
  clarity: [
    { title: 'Choose one thing to do', description: 'Pick one goal for this game session.', type: 'gameplay' },
    { title: 'Break a goal into steps', description: 'Choose one small step to start with.', type: 'challenge' },
    { title: 'Make a simple plan', description: 'Decide what you want to do first in the game.', type: 'gameplay' },
  ],
  recovery: [
    { title: 'Keep this session short', description: 'Play for a little while, or stop whenever you want.', type: 'rest' },
    { title: 'Choose an easy game goal', description: 'Pick one simple thing you would like to try.', type: 'gameplay' },
    { title: 'Take a break', description: 'Pause the game and rest if you need to.', type: 'rest' },
  ],
};

// ─── Chat message types ───────────────────────────────────────────────────────
type ChatMsg = { role: 'user' | 'assistant'; content: string };

function LumiChatScreen({ cfg, characterName, intention, onBack }: {
  cfg: ModeConfig; characterName: string; intention?: string; onBack: () => void;
}) {
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const history = next.slice(0, -1).slice(-20).map(m => ({ role: m.role, content: m.content.slice(0, 800) }));
      const res = await apiFetch<{ reply: string }>('/drift/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text.slice(0, 800), mode: cfg.name, characterName, intention, history, locale: (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0] }),
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
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
              { maxWidth: Math.min(width * 0.75, 520), borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12 },
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
  const { userId } = useAuth();
  const displayName   = character?.name && character.name !== 'Player' ? character.name : 'Calm Space';

  const [step,            setStep]           = useState<FlowStep>('companion');
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

  // Account-scoped saved session. Never auto-enters; companion offers Resume.
  const sessionKey = userId ? `drift_session_v1:${userId}` : null;
  useEffect(() => {
    let alive = true;
    setMode(null); setAnswers({}); setSessionStart(null); setDriftPlan(null);
    setStep('companion');
    // Legacy global key could belong to another account: discard it.
    AsyncStorage.removeItem('drift_session_v1').catch(() => {});
    if (!sessionKey) return;
    AsyncStorage.getItem(sessionKey).then(saved => {
      if (!alive || !saved) return;
      try {
        const d = JSON.parse(saved);
        if (d.mode && MODES[d.mode] && d.sessionStart && (Date.now() - d.sessionStart) < 8 * 3600 * 1000) {
          setMode(d.mode);
          setAnswers(d.answers ?? {});
          setSessionStart(d.sessionStart);
          if (d.duration) setSessionDuration(d.duration);
        } else {
          AsyncStorage.removeItem(sessionKey).catch(() => {});
        }
      } catch { /* ignore */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, [sessionKey]);

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
          locale: (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0],
        }),
      }).catch(() => null as DriftPlan | null),
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

  function handleStartSession(durationSecs: number, modeOverride?: string, answersOverride?: Record<string, string>) {
    const start = Date.now();
    const m = modeOverride ?? mode;
    const a = answersOverride ?? answers;
    if (sessionKey) AsyncStorage.setItem(sessionKey, JSON.stringify({ mode: m, answers: a, sessionStart: start, duration: durationSecs })).catch(() => {});
    go('session', () => {
      if (modeOverride) { setMode(modeOverride); setDriftPlan(null); setAnswers(a); }
      setSessionStart(start);
      setSessionDuration(durationSecs);
    });
  }

  // Quick start without the six-question check-in: calm Flow mode, chosen duration.
  function handleQuickStart(minutes: 5 | 15 | 30) {
    handleStartSession(minutes * 60, 'flow', {});
  }

  function handleEndSession(r: SessionResult) {
    setResult(r);
    if (sessionKey) AsyncStorage.removeItem(sessionKey).catch(() => {});
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
    if (sessionKey) AsyncStorage.removeItem(sessionKey).catch(() => {});
    go('companion');
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
      {step === 'companion' && (
        <LumiCompanion
          userId={userId}
          name={character?.name && character.name !== 'Player' ? character.name : null}
          renderCharacter={(size, emotion) => <LumiAvatar size={size} expression={emotion} />}
          hasActiveSession={!!sessionStart && !!mode}
          onResumeSession={() => go('session')}
          onQuickStart={handleQuickStart}
          onCheckIn={() => go('welcome', () => setQuestionIdx(0))}
        />
      )}
      {step !== 'companion' && step !== 'analyzing' && step !== 'lumi_chat' && (
        <TouchableOpacity
          onPress={() => go('companion')}
          accessibilityRole="button"
          accessibilityLabel={i18n.t('lumi.back')}
          style={{ position: 'absolute', zIndex: 50, right: 14, top: Platform.OS === 'web' ? 72 : 52, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(20,14,40,0.72)', borderWidth: 1, borderColor: 'rgba(176,144,255,0.35)' }}
        >
          <Text style={{ color: '#E8DEFF', fontFamily: 'Satoshi-Bold', fontSize: 12 }}>Lumi</Text>
        </TouchableOpacity>
      )}
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
