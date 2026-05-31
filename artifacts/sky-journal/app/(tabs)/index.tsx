import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Animated, Easing, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useApp, type GuideAvailability, type GuideProfile, type DiscoverPost,
  type ConstellationState, type RewardBalance as RewardBalanceData,
} from '@/context/AppContext';
import { RewardBalance } from '@/components/RewardBalance';
import { useSound } from '@/context/SoundContext';
import { useColors } from '@/hooks/useColors';

// ─── Palette ────────────────────────────────────────────────────────────────
const MOOD_GRAD: Record<string, readonly [string, string, string]> = {
  Hopeful:     ['#101808', '#182210', '#1E2C14'],
  Peaceful:    ['#081420', '#0E1C2C', '#142436'],
  Lonely:      ['#0A0A1C', '#0E1020', '#121628'],
  Dreamy:      ['#100824', '#18103A', '#1E164C'],
  Romantic:    ['#180810', '#22101C', '#2C1428'],
  Soft:        ['#120818', '#1A1028', '#201434'],
  Chaotic:     ['#180602', '#220804', '#2E0C06'],
  Adventurous: ['#081008', '#0E180A', '#141E0E'],
  Joyful:      ['#081008', '#0E1A0C', '#162010'],
};
const DEFAULT_GRAD: readonly [string, string, string] = ['#1A1630', '#222050', '#28246A'];

const MOOD_ACCENT: Record<string, string> = {
  Hopeful: '#C8A84B', Peaceful: '#78A8C8', Lonely: '#7090C0',
  Dreamy: '#B89AE8', Romantic: '#D878B0', Soft: '#C8A0D8',
  Chaotic: '#E8784A', Adventurous: '#6AC888', Joyful: '#70C888',
};
const MOOD_COLOR: Record<string, string> = {
  Peaceful: '#5B9BB5', Joyful: '#D4A849', Lonely: '#5D7BA5',
  Hopeful: '#6BA57A', Dreamy: '#9B7AB5', Romantic: '#B86098',
  Chaotic: '#B85830', Soft: '#7B6BAA', Adventurous: '#3A9060',
};
const DEF_ACCENT = '#9B78E8';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function nextSession(avail: GuideAvailability | null | undefined): string | null {
  if (!avail?.days?.length) return null;
  const now = new Date(), cur = now.getDay();
  const [fH = 0, fM = 0] = avail.timeFrom.split(':').map(Number);
  for (let off = 0; off <= 7; off++) {
    const day = (cur + off) % 7;
    if (!avail.days.includes(day)) continue;
    const t = new Date(now); t.setDate(now.getDate() + off); t.setHours(fH, fM, 0, 0);
    if (t <= now) continue;
    const h = fH % 12 || 12, ampm = fH < 12 ? 'am' : 'pm';
    const m = String(fM).padStart(2, '0');
    const label = off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : DAY[day];
    return `${label} ${h}:${m}${ampm}`;
  }
  return null;
}
function liveNow(avail: GuideAvailability | null | undefined): boolean {
  if (!avail) return false;
  const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
  if (!avail.days.includes(now.getDay())) return false;
  const [fH = 0, fM = 0] = avail.timeFrom.split(':').map(Number);
  const [tH = 0, tM = 0] = avail.timeTo.split(':').map(Number);
  return cur >= fH * 60 + fM && cur < tH * 60 + tM;
}
// ─── Constellation star definitions (matches ConstellationMap.tsx) ───────────
const STAR_DEFS = [
  { key: 'social',   label: 'Social',   getCount: (c: ConstellationState) => c.socialCount,   threshold: 5,  unit: 'connections',  color: '#78C8A8', action: 'Follow friends & swap stickers in Discover' },
  { key: 'memory',   label: 'Memory',   getCount: (c: ConstellationState) => c.memoryCount,   threshold: 10, unit: 'memories',     color: '#9878C8', action: 'Write in your journal a little more' },
  { key: 'quiet',    label: 'Quiet',    getCount: (c: ConstellationState) => c.quietStreak,   threshold: 7,  unit: 'day streak',   color: '#7890C8', action: 'Journal every day to build your streak' },
  { key: 'creative', label: 'Creative', getCount: (c: ConstellationState) => c.creativeCount, threshold: 5,  unit: 'stories',      color: '#C87AA8', action: 'Create and share a few more stories' },
  { key: 'helping',  label: 'Helping',  getCount: (c: ConstellationState) => c.helpingCount,  threshold: 20, unit: 'stickers sent',color: '#C8A84B', action: 'Send stickers to stories you love in Discover' },
  { key: 'seasonal', label: 'Seasonal', getCount: (c: ConstellationState) => c.seasonalCount, threshold: 3,  unit: 'stars',        color: '#68B8B0', action: 'Keep unlocking other stars to light this one' },
] as const;

/** Returns the locked star closest to its unlock threshold (0–1), or null if all unlocked */
function closestLockedStar(c: ConstellationState) {
  const locked = STAR_DEFS.filter(d => !c.unlockedStars.includes(d.key));
  if (!locked.length) return null;
  return locked.reduce<typeof STAR_DEFS[number]>((best, d) => {
    const bp = Math.min(1, best.getCount(c) / best.threshold);
    const dp = Math.min(1, d.getCount(c) / d.threshold);
    return dp > bp ? d : best;
  }, locked[0]!);
}

// Lumi is aware of what actually happened — she synthesises the real world
function lumiAwareness(
  name: string,
  witnessed: number,
  saved: number,
  newCircleStories: number,
  liveCampfires: number,
  entries: any[],
  stories: any[],
  hour: number,
  constellation?: ConstellationState | null,
  rewardBalance?: RewardBalanceData | null,
): string {
  const n = name || 'sky child';
  const todayEntries = entries.filter((e: any) =>
    new Date(e.date).toDateString() === new Date().toDateString()).length;

  // Social activity — highest priority
  if (witnessed > 0 && saved > 0 && newCircleStories > 0)
    return `${witnessed} souls witnessed you, ${saved} carried your story — and your circle wrote ${newCircleStories} new chapter${newCircleStories > 1 ? 's' : ''} while you were away`;
  if (witnessed > 0 && newCircleStories > 0)
    return `${witnessed} soul${witnessed > 1 ? 's' : ''} found your story, and ${newCircleStories} new chapter${newCircleStories > 1 ? 's' : ''} glow from your circle`;
  if (witnessed > 0 && liveCampfires > 0)
    return `${witnessed} soul${witnessed > 1 ? 's' : ''} witnessed you while you were away — and ${liveCampfires} campfire${liveCampfires > 1 ? 's are' : ' is'} burning right now`;
  if (witnessed > 0 && saved > 0)
    return `${witnessed} witnessed your story. ${saved} person${saved > 1 ? 's' : ''} saved it — your words are travelling`;
  if (witnessed > 0)
    return `${witnessed} soul${witnessed > 1 ? 's' : ''} witnessed your story while you were in the clouds, ${n}`;
  if (saved > 0 && newCircleStories > 0)
    return `${saved} person${saved > 1 ? 's' : ''} saved what you made. Your circle added ${newCircleStories} new chapter${newCircleStories > 1 ? 's' : ''}`;
  if (saved > 0)
    return `${saved} person${saved > 1 ? 's' : ''} saved your story — your words stayed with them`;
  if (newCircleStories > 0 && liveCampfires > 0)
    return `${newCircleStories} new ${newCircleStories === 1 ? 'chapter' : 'chapters'} from your circle, and ${liveCampfires} campfire${liveCampfires > 1 ? 's are' : ' is'} lit — the sky has been alive`;
  if (newCircleStories > 0)
    return newCircleStories === 1
      ? 'Someone in your circle wrote a new chapter — the sky has been busy'
      : `${newCircleStories} new chapters from your circle — go see what they made`;
  if (liveCampfires > 0)
    return `${liveCampfires} campfire${liveCampfires > 1 ? 's are' : ' is'} lit right now — someone is waiting in the warmth`;

  // ── Constellation awareness — when the world is quiet, Lumi reflects on your journey ──
  if (constellation) {
    const unlocked = constellation.unlockedStars.length;
    if (unlocked === 6)
      return `All six stars shine in your sky, ${n}. You are a Child of the Sky — the journey never ends`;
    if (unlocked >= 4)
      return `${unlocked} stars glow in your constellation, ${n}. Only ${6 - unlocked} more wait for your light`;
    if (unlocked >= 2)
      return `${unlocked} stars glow in your sky, ${n} — you are becoming luminous`;
    if (unlocked === 1)
      return `Your first star glows, ${n}${constellation.activeTitle ? ` — ${constellation.activeTitle}` : ''}. Keep showing up`;
    if (constellation.quietStreak >= 5 && !constellation.unlockedStars.includes('quiet'))
      return `${constellation.quietStreak} days of writing in a row, ${n} — your Quiet Star is almost within reach`;
    if (rewardBalance && rewardBalance.stars >= 6)
      return `✦ ${rewardBalance.stars} stars gathered so far, ${n}. You are building something luminous`;
  }

  // Poetic time-aware fallback
  if (hour < 6)  return `The stars have been keeping watch, ${n}. The sky is all yours right now`;
  if (hour < 12) return todayEntries
    ? `Good morning, ${n} — you already wrote ${todayEntries} ${todayEntries === 1 ? 'memory' : 'memories'} today`
    : `The morning sky is fresh, ${n} — what will today hold?`;
  if (hour < 17) return stories.length
    ? `${stories.length} ${stories.length === 1 ? 'story glows' : 'stories glow'} out there — the afternoon is still yours`
    : `The afternoon sky is all yours, ${n} — begin something`;
  if (hour < 20) return 'Golden hour. Someone out there is always watching the sky';
  return todayEntries === 0
    ? `The night is soft, ${n} — a perfect time to write something small`
    : `Tonight's sky is yours — you wrote ${todayEntries} ${todayEntries === 1 ? 'memory' : 'memories'} today`;
}

// ─── Breathing ring ──────────────────────────────────────────────────────────
function BreathRing({ accent, r = 46 }: { accent: string; r?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: r,
      borderWidth: 2, borderColor: accent,
      opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.65, 0.15] }),
      transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.10] }) }],
    }} />
  );
}

// ─── Friend bubble — story-ring style "who's around" row ─────────────────────
function FriendBubble({ post }: { post: DiscoverPost }) {
  const mc = MOOD_COLOR[post.mood] ?? DEF_ACCENT;
  const label = post.authorHandle ? post.authorHandle.replace('@', '') : post.authorName.split(' ')[0];
  return (
    <TouchableOpacity
      style={fr.wrap}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/story/[id]', params: { id: post.id } } as any); }}
      activeOpacity={0.80}
    >
      {/* Gradient ring — mood colour → purple */}
      <LinearGradient
        colors={[mc, '#A880F8', '#60C8F8']}
        style={fr.ring}
        start={{ x: 0.1, y: 1 }} end={{ x: 1, y: 0.1 }}
      >
        <View style={fr.inner}>
          <Text style={fr.initial}>{post.authorName.charAt(0).toUpperCase()}</Text>
        </View>
      </LinearGradient>
      {/* New-story dot */}
      <View style={[fr.newDot, { backgroundColor: mc }]} />
      <Text style={fr.name} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}
const fr = StyleSheet.create({
  row:    { paddingHorizontal: 16, paddingBottom: 6, gap: 4 },
  wrap:   { alignItems: 'center', width: 66, gap: 5 },
  ring:   { width: 58, height: 58, borderRadius: 29, padding: 2.5 },
  inner:  { flex: 1, borderRadius: 27, overflow: 'hidden', backgroundColor: '#0E0B28',
            alignItems: 'center', justifyContent: 'center' },
  initial:{ fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.90)' },
  newDot: { position: 'absolute', top: 42, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#080614' },
  name:   { fontSize: 10.5, fontFamily: 'Satoshi-Medium', color: 'rgba(210,195,255,0.62)', textAlign: 'center' },
});

// ─── Campfire bubble (stories-style circle) ──────────────────────────────────
function CampfireBubble({ guide, isMine }: { guide: GuideProfile; isMine?: boolean }) {
  const live = guide.isAvailableNow || liveNow(guide.guideAvailability ?? null);
  const next = nextSession(guide.guideAvailability ?? null);
  const ringColor = live ? '#50D880' : isMine ? '#A880F8' : 'rgba(160,140,200,0.35)';
  return (
    <TouchableOpacity
      style={fb.wrap}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/guide/[userId]', params: { userId: guide.userId } } as any); }}
      activeOpacity={0.82}
    >
      {/* Pulse ring container — BreathRing positioned relative to this */}
      <View style={{ position: 'relative', width: 66, height: 66, alignItems: 'center', justifyContent: 'center' }}>
        {live && <BreathRing accent="#50D880" r={33} />}
        {isMine && !live && <BreathRing accent="#A880F8" r={33} />}
        <View style={[fb.ring, { borderColor: ringColor }]}>
          <View style={fb.circle}>
            {guide.avatarUri
              ? <Image source={{ uri: guide.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
              : <LinearGradient colors={isMine ? ['#5A28B8', '#3050C0'] : ['#2A2050', '#181430']} style={StyleSheet.absoluteFill} />
            }
            {!guide.avatarUri && (
              <Text style={fb.initial}>{guide.name.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          {live && <View style={fb.liveDot} />}
        </View>
      </View>
      <Text style={fb.name} numberOfLines={1}>{isMine ? 'Your Fire' : guide.name.split(' ')[0]}</Text>
      <Text style={[fb.sub, live && { color: '#50D880' }]} numberOfLines={1}>
        {live ? '● Live now' : next ?? 'Offline'}
      </Text>
    </TouchableOpacity>
  );
}
const fb = StyleSheet.create({
  wrap:    { alignItems: 'center', width: 76, gap: 6 },
  ring:    { width: 62, height: 62, borderRadius: 31, borderWidth: 2, padding: 2, position: 'relative' },
  circle:  { flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#181430', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(220,200,255,0.85)' },
  liveDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, backgroundColor: '#50D880', borderWidth: 2, borderColor: '#080614' },
  name:    { fontSize: 11.5, fontFamily: 'Satoshi-Medium', color: 'rgba(220,210,255,0.82)', textAlign: 'center' },
  sub:     { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(160,140,200,0.50)', textAlign: 'center' },
});

// ─── Story panel (masonry cell) ──────────────────────────────────────────────
function StoryPanel({ post, wide = false }: { post: DiscoverPost; wide?: boolean }) {
  const mc = MOOD_COLOR[post.mood] ?? '#7B6BAA';
  const h  = wide ? 200 : 148;
  return (
    <TouchableOpacity
      style={[sp.wrap, { height: h, borderColor: `${mc}28` }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/story/[id]', params: { id: post.id } } as any); }}
      activeOpacity={0.85}
    >
      {post.imageUri
        ? <Image source={{ uri: post.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        : <LinearGradient colors={[`${mc}70`, `${mc}28`, '#080614']} style={StyleSheet.absoluteFill} />
      }
      {/* Top mood stripe */}
      <LinearGradient
        colors={[`${mc}40`, 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 48 }}
        pointerEvents="none"
      />
      {/* Bottom scrim */}
      <LinearGradient colors={['transparent', 'rgba(4,3,18,0.95)']} style={sp.grad} />
      <View style={sp.meta}>
        <View style={sp.moodRow}>
          <View style={[sp.moodDot, { backgroundColor: mc }]} />
          <Text style={[sp.mood, { color: mc }]}>{post.mood}</Text>
        </View>
        <Text style={sp.title} numberOfLines={wide ? 2 : 1}>{post.chapterTitle || 'Untitled'}</Text>
        <Text style={sp.author} numberOfLines={1}>{post.authorName}</Text>
      </View>
      {post.witnessedCount > 0 && (
        <View style={sp.witness}>
          <Icon name="eye" size={9} color="rgba(255,255,255,0.60)" />
          <Text style={sp.witnessN}>{post.witnessedCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
const sp = StyleSheet.create({
  wrap:    { borderRadius: 20, overflow: 'hidden', backgroundColor: '#0E0C2A', flex: 1, borderWidth: 0.5 },
  grad:    { ...StyleSheet.absoluteFillObject },
  meta:    { position: 'absolute', bottom: 10, left: 10, right: 10, gap: 2 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
  moodDot: { width: 4, height: 4, borderRadius: 2 },
  mood:    { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  title:   { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.95)', lineHeight: 16 },
  author:  { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.55)', marginTop: 1 },
  witness: { position: 'absolute', top: 9, right: 9, flexDirection: 'row', alignItems: 'center', gap: 3,
             backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 8 },
  witnessN:{ fontSize: 9.5, fontFamily: 'Satoshi-Medium', color: 'rgba(255,255,255,0.65)' },
});

// ─── Section header with accent bar + optional count badge ───────────────────
function SectionHeader({ label, accent, count, onPress, action }: {
  label: string; accent: string; count?: number; onPress?: () => void; action?: string;
}) {
  return (
    <View style={sh.row}>
      <View style={[sh.bar, { backgroundColor: accent }]} />
      <Text style={sh.label}>{label}</Text>
      {count != null && count > 0 && (
        <View style={[sh.badge, { backgroundColor: `${accent}1C` }]}>
          <Text style={[sh.badgeN, { color: accent }]}>{count}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {onPress && (
        <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 12, right: 4 }}>
          <Text style={[sh.action, { color: accent }]}>{action ?? 'See all'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  bar:    { width: 3, height: 13, borderRadius: 2 },
  label:  { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 1.3, color: 'rgba(200,185,255,0.50)', textTransform: 'uppercase' },
  badge:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeN: { fontSize: 10.5, fontFamily: 'Satoshi-Bold' },
  action: { fontSize: 12.5, fontFamily: 'Satoshi-Medium' },
});

// ════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const { width: W } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const colors  = useColors();
  const {
    character, journalEntries, stories, outfits,
    activeOutfitId, setActiveOutfitId,
    friends, discoverPosts, followingIds,
    rewards, serverNotifications,
    markServerNotificationsRead, deleteServerNotification, dismissReward,
    reloadData, myGuides, rewardBalance, constellation,
  } = useApp();
  const { playSound } = useSound();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 90;

  const [showNotifs,  setShowNotifs]  = useState(false);
  const [showOutfits, setShowOutfits] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showConstellationIntro, setShowConstellationIntro] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('star_intro_v1').then(val => { if (!val) setShowConstellationIntro(true); });
  }, []);

  async function dismissConstellationIntro() {
    setShowConstellationIntro(false);
    await AsyncStorage.setItem('star_intro_v1', 'done');
  }

  const hour       = new Date().getHours();
  const unread     = serverNotifications.filter(n => !n.isRead).length;
  const hasNotifs  = rewards.length > 0 || unread > 0;
  const accent     = MOOD_ACCENT[character.mood ?? ''] ?? DEF_ACCENT;
  const grad       = MOOD_GRAD[character.mood ?? ''] ?? DEFAULT_GRAD;
  const mc         = MOOD_COLOR[character.mood ?? ''] ?? DEF_ACCENT;

  const activeOutfit  = outfits.find(o => o.id === activeOutfitId) ?? null;
  const imgSrc        = activeOutfit?.imageUri ? { uri: activeOutfit.imageUri }
                        : character.avatarUri  ? { uri: character.avatarUri }
                        : Images.character_default;

  const totalWitnessed = stories.reduce((s, x) => s + (x.witnessedCount ?? 0), 0);
  const totalSaved     = stories.reduce((s, x) => s + (x.savedCount ?? 0), 0);

  // Mood this week — dominant mood from last 7 days of journal entries
  const moodThisWeek = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recent = journalEntries.filter(e => new Date(e.date) >= cutoff && e.mood);
    if (recent.length < 2) return null;
    const counts: Record<string, number> = {};
    recent.forEach(e => { counts[e.mood] = (counts[e.mood] ?? 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return (sorted[0]?.[1] ?? 0) >= 2 ? sorted[0]![0] : null;
  }, [journalEntries]);

  // Public story count (for Creative Star nudge)
  const publicStoryCount = useMemo(() => stories.filter(s => s.isPublic).length, [stories]);

  // Next star to unlock (highest % progress among locked stars)
  const nextStar = constellation ? closestLockedStar(constellation) : null;
  const nextStarPct = (nextStar && constellation)
    ? Math.min(1, nextStar.getCount(constellation) / nextStar.threshold)
    : 0;
  const nextStarCount = (nextStar && constellation) ? nextStar.getCount(constellation) : 0;

  const circleStories = discoverPosts.filter(p => p.isFollowing).slice(0, 10);

  // Unique friends with recent stories (for the "Who's Around" row)
  const circleAuthors = (() => {
    const seen = new Set<string>();
    return circleStories.filter(p => {
      if (seen.has(p.authorUserId)) return false;
      seen.add(p.authorUserId); return true;
    }).slice(0, 10);
  })();

  // ── Activity digest — what changed in the world while you were away ──────────
  const witnessedNotifs   = serverNotifications.filter(n => n.type === 'witness').length;
  const savedNotifs       = serverNotifications.filter(n => n.type === 'save').length;
  const newStoryNotifs    = serverNotifications.filter(n => n.type === 'new_story').length;
  const hasDigest = witnessedNotifs > 0 || savedNotifs > 0 || circleStories.length > 0 || newStoryNotifs > 0;

  const myCampfire: GuideProfile | null = character.isGuide ? {
    userId: 'me', name: character.name || 'Sky Child',
    username: character.username ?? null, bio: character.bio,
    guideBio: character.guideBio ?? '', guideTopics: character.guideTopics ?? [],
    guideAvailability: character.guideAvailability ?? null,
    peaceRating: 0, dreamersGuided: 0, followerCount: friends.length,
    avatarUri: character.avatarUri ?? null, mood: character.mood,
    isFollowing: false, isAvailableNow: liveNow(character.guideAvailability ?? null),
  } : null;

  // ── Animations ─────────────────────────────────────────────────────────────
  const fadeIn = useRef(new Animated.Value(0)).current;
  // Section entrance stagger (Friends, Lumi, Digest, Circle, Drift, Campfires, FindFriends)
  const s0 = useRef(new Animated.Value(0)).current;
  const s1 = useRef(new Animated.Value(0)).current;
  const s2 = useRef(new Animated.Value(0)).current;
  const s3 = useRef(new Animated.Value(0)).current;
  const s4 = useRef(new Animated.Value(0)).current;
  const s5 = useRef(new Animated.Value(0)).current;
  const s6 = useRef(new Animated.Value(0)).current;
  const s7 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    // Stagger sections in after a short hero settle
    Animated.sequence([
      Animated.delay(200),
      Animated.stagger(70, [s0, s1, s2, s3, s4, s5, s6, s7].map(v =>
        Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      )),
    ]).start();
  }, []);

  async function onRefresh() {
    setRefreshing(true); await reloadData(); setRefreshing(false);
  }

  // Masonry layout: alternate between wide (full-width) and 2-column pairs
  function renderCircleStories() {
    if (!circleStories.length) return (
      <TouchableOpacity
        style={s.emptyStories}
        onPress={() => router.push('/(tabs)/discover')}
        activeOpacity={0.8}
      >
        <Text style={s.emptyStoriesText}>No stories from your circle yet</Text>
        <Text style={s.emptyStoriesSub}>Find people in Discover →</Text>
      </TouchableOpacity>
    );
    const rows: React.ReactNode[] = [];
    let i = 0;
    while (i < circleStories.length) {
      // Every 3rd item: full-width wide panel
      if (i % 3 === 2 || i === circleStories.length - 1) {
        rows.push(
          <View key={`w${i}`} style={s.masonryRow}>
            <StoryPanel post={circleStories[i]!} wide />
          </View>
        );
        i++;
      } else {
        // Pair of half-width panels
        const a = circleStories[i], b = circleStories[i + 1];
        rows.push(
          <View key={`p${i}`} style={s.masonryRow}>
            {a && <StoryPanel post={a} />}
            {b && <StoryPanel post={b} />}
          </View>
        );
        i += 2;
      }
    }
    return rows;
  }

  const campfires = [
    ...(myCampfire ? [{ guide: myCampfire, isMine: true }] : []),
    ...myGuides.slice(0, 5).map(g => ({ guide: g, isMine: false })),
  ];
  const liveCampfireCount = campfires.filter(c =>
    c.guide.isAvailableNow || liveNow(c.guide.guideAvailability ?? null)).length;

  return (
    <Animated.View style={[s.root, { opacity: fadeIn }]}>
      {/* Continuous atmospheric depth — deep purple sky fading to near-black */}
      <LinearGradient
        colors={['#1E1438', '#10102A', '#080614']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        pointerEvents="none"
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >

        {/* ══════════════════════════════════════════════════
            HERO — centered immersive sanctuary
        ══════════════════════════════════════════════════ */}
        <View style={[s.hero, { paddingTop: topPad + 8 }]}>
          {/* Base mood gradient — diagonal, rich */}
          <LinearGradient
            colors={[`${accent}28`, grad[0], grad[1], grad[2]] as unknown as [string, string, ...string[]]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          {/* Cross-wash — opposite angle, creates mesh depth without circles */}
          <LinearGradient
            colors={[`${accent}22`, 'transparent', `${accent}14`]}
            style={StyleSheet.absoluteFill}
            start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />
          {/* Top vignette — adds premium depth at the very top */}
          <LinearGradient
            colors={['rgba(0,0,0,0.22)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90 }}
            pointerEvents="none"
          />
          {/* Accent pinstripe — thin premium top edge */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: accent, opacity: 0.45 }} />

          {/* ── Top row: bell + settings ── */}
          <View style={s.heroActions}>
            <TouchableOpacity
              onPress={() => { setShowNotifs(true); markServerNotificationsRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              style={s.heroBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="bell" size={17} color="rgba(220,210,255,0.78)" />
              {hasNotifs && <View style={[s.heroBadge, { backgroundColor: accent }]} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={s.heroBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="settings" size={17} color="rgba(220,210,255,0.78)" />
            </TouchableOpacity>
          </View>

          {/* ── Centered identity block ── */}
          <View style={s.heroCenter}>
            {/* Avatar — gradient ring, no animated moon */}
            <TouchableOpacity
              style={s.avatarWrap}
              onPress={() => router.push('/(tabs)/profile')}
              onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOutfits(true); }}
            >
              <LinearGradient
                colors={[accent, '#A880F8', '#60C8F8']}
                style={s.avatarRing}
                start={{ x: 0.1, y: 1 }} end={{ x: 1, y: 0.1 }}
              >
                <View style={s.avatarInner}>
                  <Image source={imgSrc} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
              </LinearGradient>
              {character.role && (
                <View style={[s.roleTag, { backgroundColor: accent }]}>
                  <Text style={s.roleText}>{character.role.slice(0, 1)}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Name — large, the visual anchor */}
            <Text style={s.heroName}>{character.name || 'Sky Child'}</Text>

            {/* Mood + handle — soft metadata */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {character.mood && (
                <>
                  <View style={[s.moodDot, { backgroundColor: mc }]} />
                  <Text style={[s.heroMood, { color: mc }]}>{character.mood}</Text>
                </>
              )}
              {character.username && (
                <Text style={s.heroHandle}>{character.mood ? '· ' : ''}@{character.username}</Text>
              )}
            </View>

            {/* Mood arc — dominant mood this week */}
            {moodThisWeek && (
              <Text style={s.heroMoodArc}>You've been feeling {moodThisWeek} most this week</Text>
            )}

          </View>

          {/* ── Stats — glassy frosted card ── */}
          <View style={s.statBar}>
            {[
              { n: journalEntries.length, l: 'entries',  press: () => router.push('/(tabs)/log') },
              { n: stories.length,        l: 'stories',  press: () => router.push('/(tabs)/create') },
              { n: friends.length,        l: 'circle',   press: () => router.push('/(tabs)/discover') },
            ].map((item, i) => (
              <React.Fragment key={item.l}>
                {i > 0 && <View style={s.statSep} />}
                <TouchableOpacity style={s.statItem} onPress={item.press} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Text style={s.statN}>{item.n}</Text>
                  <Text style={s.statL}>{item.l}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
            {unread > 0 && (
              <>
                <View style={s.statSep} />
                <TouchableOpacity style={s.statItem} onPress={() => { setShowNotifs(true); markServerNotificationsRead(); }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                  <Text style={[s.statN, { color: accent }]}>{unread}</Text>
                  <Text style={s.statL}>new</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Reward balance — tappable, links to constellation on profile */}
          {rewardBalance && (
            <TouchableOpacity
              style={{ alignItems: 'center', paddingBottom: 10, paddingTop: 4 }}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/profile'); }}
              activeOpacity={0.8}
            >
              <RewardBalance
                stars={rewardBalance.stars}
                auraEnergy={rewardBalance.auraEnergy}
                memoryShards={rewardBalance.memoryShards}
                size="sm"
              />
              <Text style={{ fontSize: 10, color: 'rgba(200,184,232,0.40)', marginTop: 4, letterSpacing: 0.6 }}>
                view constellation →
              </Text>
            </TouchableOpacity>
          )}

          {/* Bottom fade to dark */}
          <LinearGradient
            colors={['transparent', '#080614']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44 }}
            pointerEvents="none"
          />
        </View>

        {/* ══════════════════════════════════════════════════
            CONSTELLATION INTRO — one-time, first-run hint
        ══════════════════════════════════════════════════ */}
        {showConstellationIntro && (
          <Animated.View style={{ opacity: s0, transform: [{ translateY: s0.interpolate({ inputRange: [0,1], outputRange: [10,0] }) }] }}>
          <View style={s.introCard}>
            <LinearGradient
              colors={['rgba(168,136,248,0.14)', 'rgba(96,168,248,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.introTitle}>✦  Your constellation awaits</Text>
              <Text style={s.introBody}>
                Earn stars by journaling daily, creating stories, and connecting with others.
                Each star unlocks a title — and lets you spend in the shop.
              </Text>
            </View>
            <TouchableOpacity
              onPress={dismissConstellationIntro}
              style={s.introDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={s.introDismissText}>Got it ✦</Text>
            </TouchableOpacity>
          </View>
          </Animated.View>
        )}

        {/* ══════════════════════════════════════════════════
            WHO'S AROUND — friends with recent stories
        ══════════════════════════════════════════════════ */}
        {circleAuthors.length > 0 && (
          <Animated.View style={{ opacity: s0, transform: [{ translateY: s0.interpolate({ inputRange: [0,1], outputRange: [14,0] }) }] }}>
            <View style={{ paddingTop: 8, paddingBottom: 4 }}>
              <SectionHeader
                label="Who's Around"
                accent={accent}
                count={circleAuthors.length}
                onPress={() => router.push('/(tabs)/discover')}
                action="See all"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fr.row}>
                {circleAuthors.map(post => <FriendBubble key={post.authorUserId} post={post} />)}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* ══════════════════════════════════════════════════
            LUMI — aware companion who synthesises the world
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s1, transform: [{ translateY: s1.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        <TouchableOpacity
          style={s.lumiBlock}
          onPress={() => {
            if (hasNotifs) { setShowNotifs(true); markServerNotificationsRead(); }
            else router.push('/(tabs)/create');
          }}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[`${accent}18`, `${accent}08`, 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image source={Images.character_default} style={s.lumiAvatar} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.lumiLabel}>Lumi</Text>
            <Text style={s.lumiMsg}>
              {lumiAwareness(
                character.name, witnessedNotifs, savedNotifs,
                circleStories.length, liveCampfireCount,
                journalEntries, stories, hour,
                constellation, rewardBalance,
              )} ✦
            </Text>
          </View>
          {hasNotifs && (
            <View style={[s.lumiBadge, { backgroundColor: accent }]}>
              <Text style={s.lumiBadgeN}>{rewards.length + unread}</Text>
            </View>
          )}
        </TouchableOpacity>
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            STAR JOURNEY NUDGE — next constellation milestone
        ══════════════════════════════════════════════════ */}
        {nextStar && (
          <Animated.View style={{ opacity: s7, transform: [{ translateY: s7.interpolate({ inputRange: [0,1], outputRange: [14,0] }) }] }}>
          <TouchableOpacity
            style={s.nudgeCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/profile'); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[`${nextStar.color}1A`, `${nextStar.color}08`, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Star glow orb */}
            <View style={[s.nudgeOrb, { backgroundColor: nextStar.color }]} />

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={[s.nudgeEyebrow, { color: nextStar.color }]}>NEXT STAR</Text>
                <View style={[s.nudgeDot, { backgroundColor: nextStar.color }]} />
                <Text style={[s.nudgeEyebrow, { color: nextStar.color }]}>{nextStar.label}</Text>
              </View>

              {/* Progress bar */}
              <View style={s.nudgeTrack}>
                <View style={[s.nudgeFill, { width: `${Math.round(nextStarPct * 100)}%` as any, backgroundColor: nextStar.color }]} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                <Text style={s.nudgeAction}>{nextStar.action}</Text>
                <Text style={[s.nudgeFraction, { color: nextStar.color }]}>
                  {nextStarCount} / {nextStar.threshold} {nextStar.unit}
                </Text>
              </View>
              {nextStar.key === 'creative' && stories.length > 0 && (
                <Text style={s.nudgePublicNote}>
                  {publicStoryCount} of {stories.length} {stories.length === 1 ? 'story is' : 'stories are'} public
                </Text>
              )}
            </View>

            <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.28)" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          </Animated.View>
        )}

        {/* Show "all stars lit" celebration when constellation complete */}
        {constellation && constellation.unlockedStars.length === 6 && (
          <Animated.View style={{ opacity: s7, transform: [{ translateY: s7.interpolate({ inputRange: [0,1], outputRange: [14,0] }) }] }}>
          <TouchableOpacity
            style={s.nudgeCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/profile'); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(168,136,248,0.12)', 'rgba(96,200,248,0.08)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.nudgeEyebrow, { color: '#A888F8', marginBottom: 3 }]}>CONSTELLATION COMPLETE</Text>
              <Text style={{ fontSize: 13, color: 'rgba(220,210,255,0.80)', fontWeight: '500', letterSpacing: 0.1 }}>
                ✦ ✦ ✦ ✦ ✦ ✦{'  '}All six stars glow in your sky
              </Text>
            </View>
            <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.28)" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          </Animated.View>
        )}

        {/* ══════════════════════════════════════════════════
            ACTIVITY DIGEST — what changed while you were away
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s1, transform: [{ translateY: s1.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        {hasDigest && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.digestRow}
          >
            {witnessedNotifs > 0 && (
              <TouchableOpacity
                style={[s.digestPill, { backgroundColor: 'rgba(200,168,75,0.14)' }]}
                onPress={() => { setShowNotifs(true); markServerNotificationsRead(); }}
                activeOpacity={0.78}
              >
                <Icon name="eye" size={13} color="#C8A84B" />
                <Text style={[s.digestTxt, { color: '#C8A84B' }]}>
                  {witnessedNotifs} witnessed you
                </Text>
              </TouchableOpacity>
            )}
            {savedNotifs > 0 && (
              <TouchableOpacity
                style={[s.digestPill, { backgroundColor: 'rgba(168,128,248,0.14)' }]}
                onPress={() => { setShowNotifs(true); markServerNotificationsRead(); }}
                activeOpacity={0.78}
              >
                <Icon name="bookmark" size={13} color="#A880F8" />
                <Text style={[s.digestTxt, { color: '#A880F8' }]}>
                  {savedNotifs} saved your work
                </Text>
              </TouchableOpacity>
            )}
            {circleStories.length > 0 && (
              <TouchableOpacity
                style={[s.digestPill, { backgroundColor: 'rgba(96,200,248,0.14)' }]}
                onPress={() => router.push('/(tabs)/discover')}
                activeOpacity={0.78}
              >
                <Icon name="book-open" size={13} color="#60C8F8" />
                <Text style={[s.digestTxt, { color: '#60C8F8' }]}>
                  {circleStories.length} new {circleStories.length === 1 ? 'story' : 'stories'}
                </Text>
              </TouchableOpacity>
            )}
            {liveCampfireCount > 0 && (
              <TouchableOpacity
                style={[s.digestPill, { backgroundColor: 'rgba(232,164,80,0.14)' }]}
                onPress={() => router.push('/(tabs)/discover')}
                activeOpacity={0.78}
              >
                <Text style={{ fontSize: 13, lineHeight: 16 }}>🔥</Text>
                <Text style={[s.digestTxt, { color: '#E8A450' }]}>
                  {liveCampfireCount} campfire{liveCampfireCount > 1 ? 's' : ''} live
                </Text>
              </TouchableOpacity>
            )}
            {newStoryNotifs > 0 && witnessedNotifs === 0 && savedNotifs === 0 && (
              <TouchableOpacity
                style={[s.digestPill, { backgroundColor: 'rgba(96,200,168,0.14)' }]}
                onPress={() => router.push('/(tabs)/discover')}
                activeOpacity={0.78}
              >
                <Icon name="users" size={13} color="#60C8A8" />
                <Text style={[s.digestTxt, { color: '#60C8A8' }]}>
                  {newStoryNotifs} circle update{newStoryNotifs > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            YOUR CIRCLE — stories from people you follow
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s2, transform: [{ translateY: s2.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        <View style={s.section}>
          <SectionHeader
            label="Your Circle"
            accent={accent}
            count={circleStories.length}
            onPress={() => router.push('/(tabs)/discover')}
          />
          <View style={s.masonry}>{renderCircleStories()}</View>
        </View>
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            DRIFT — Lumi's sanctuary, a real invitation
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s3, transform: [{ translateY: s3.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        <View style={s.driftSection}>
          <TouchableOpacity
            style={s.driftCard}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); playSound('tap'); router.push('/(tabs)/drift'); }}
            activeOpacity={0.84}
          >
            {/* Deep dreamy atmosphere */}
            <LinearGradient
              colors={['rgba(90,48,200,0.35)', 'rgba(50,24,140,0.28)', 'rgba(16,10,50,0.20)']}
              start={{ x: 0.1, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Soft glow behind Lumi */}
            <View pointerEvents="none" style={{ position: 'absolute', top: -24, right: -24, width: 130, height: 130, borderRadius: 65, backgroundColor: '#A880F8', opacity: 0.10 }} />

            {/* Lumi — floating in top-right, peeking in */}
            <Image source={Images.character_default} style={s.driftLumi} contentFit="contain" />

            {/* Content — padded to not overlap Lumi */}
            <View style={s.driftContent}>
              <View style={s.driftEyebrowRow}>
                <Icon name="moon" size={12} color="rgba(200,168,255,0.65)" />
                <Text style={s.driftEyebrow}>Drift · with Lumi</Text>
              </View>

              <Text style={s.driftTitle}>A space to just be</Text>

              <Text style={s.driftDesc}>
                Lumi is waiting inside. No stories, no pressure — just breathing,
                soft prompts, and a gentle check-in on how you're really feeling right now.
              </Text>

              {/* Feature pills */}
              <View style={s.driftChips}>
                {[
                  { icon: 'wind',      label: 'Breathe'  },
                  { icon: 'edit-2',    label: 'Reflect'  },
                  { icon: 'heart',     label: 'Check in' },
                ].map(c => (
                  <View key={c.label} style={s.driftChip}>
                    <Icon name={c.icon as any} size={11} color="rgba(200,175,255,0.65)" />
                    <Text style={s.driftChipTxt}>{c.label}</Text>
                  </View>
                ))}
              </View>

              {/* CTA line */}
              <View style={s.driftCTA}>
                <Text style={s.driftCTATxt}>Enter when you're ready</Text>
                <Icon name="arrow-right" size={13} color="rgba(200,168,255,0.50)" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            CAMPFIRES — guide sessions you follow
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s4, transform: [{ translateY: s4.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        {campfires.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              label="Campfires"
              accent="#E8A450"
              count={liveCampfireCount > 0 ? liveCampfireCount : undefined}
              action={liveCampfireCount > 0 ? `${liveCampfireCount} live` : undefined}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fireRow}>
              {campfires.map(({ guide, isMine }) => (
                <CampfireBubble key={guide.userId} guide={guide} isMine={isMine} />
              ))}
              <TouchableOpacity style={s.moreBtn} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.78}>
                <View style={s.moreCircle}>
                  <Icon name="compass" size={18} color="rgba(160,140,200,0.55)" />
                </View>
                <Text style={fb.name}>Browse</Text>
                <Text style={fb.sub}>Discover</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {campfires.length === 0 && (
          <View style={s.section}>
            <SectionHeader label="Campfires" accent="#E8A450" />
            <TouchableOpacity style={s.fireEmptyRow} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.78}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={s.fireEmptyTxt}>Find guides to light up your campfire sessions</Text>
              <Icon name="chevron-right" size={14} color="rgba(160,140,200,0.35)" />
            </TouchableOpacity>
          </View>
        )}
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            FIND FRIENDS — ambient, low-pressure CTA
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s5, transform: [{ translateY: s5.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        <TouchableOpacity
          style={s.findFriends}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/discover'); }}
          activeOpacity={0.80}
        >
          <View style={s.findFriendsIcon}>
            <Icon name="user-plus" size={15} color="#60C8A8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.findFriendsTitle}>Add to your Circle</Text>
            <Text style={s.findFriendsSub}>Find and follow people in the sky</Text>
          </View>
          <View style={s.findFriendsBadge}>
            <Text style={s.findFriendsBadgeText}>Find Friends</Text>
          </View>
        </TouchableOpacity>
        </Animated.View>

      </ScrollView>

      {/* ── Outfit picker sheet ──────────────────────────────────────────────── */}
      <Modal visible={showOutfits} transparent animationType="slide" onRequestClose={() => setShowOutfits(false)}>
        <Pressable style={m.overlay} onPress={() => setShowOutfits(false)}>
          <Pressable style={[m.sheet, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 24, backgroundColor: colors.card, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <View style={[m.handle, { backgroundColor: `${accent}28` }]} />
            <Text style={[m.title, { color: colors.foreground }]}>Choose Outfit</Text>
            <Text style={[m.sub, { color: colors.mutedForeground }]}>Long-press your avatar anytime</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.row}>
              <TouchableOpacity style={[m.oCard, !activeOutfitId && { borderColor: accent }]} onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(null); setShowOutfits(false); }}>
                <View style={[m.oImg, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}><Icon name="slash" size={20} color={colors.mutedForeground} /></View>
                <Text style={[m.oName, { color: colors.mutedForeground }]}>Default</Text>
                {!activeOutfitId && <View style={[m.check, { backgroundColor: accent }]}><Icon name="check" size={9} color="#fff" /></View>}
              </TouchableOpacity>
              {outfits.map(o => (
                <TouchableOpacity key={o.id} style={[m.oCard, activeOutfitId === o.id && { borderColor: accent }]} onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(o.id); setShowOutfits(false); }}>
                  {o.imageUri
                    ? <Image source={{ uri: o.imageUri }} style={m.oImg} contentFit="cover" />
                    : <View style={[m.oImg, { backgroundColor: `${accent}12`, alignItems: 'center', justifyContent: 'center' }]}><Icon name="star" size={20} color={`${accent}50`} /></View>
                  }
                  <Text style={[m.oName, { color: colors.mutedForeground }]} numberOfLines={1}>{o.name}</Text>
                  {activeOutfitId === o.id && <View style={[m.check, { backgroundColor: accent }]}><Icon name="check" size={9} color="#fff" /></View>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Notifications sheet ──────────────────────────────────────────────── */}
      <Modal visible={showNotifs} transparent animationType="slide" onRequestClose={() => setShowNotifs(false)}>
        <Pressable style={m.overlay} onPress={() => setShowNotifs(false)}>
          <Pressable style={[m.sheet, m.sheetTall, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 24, backgroundColor: colors.card, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
            <View style={[m.handle, { backgroundColor: `${accent}28` }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Text style={[m.title, { marginBottom: 0, flex: 1 }]}>Notifications</Text>
              {hasNotifs && <View style={[m.badge, { backgroundColor: accent }]}><Text style={m.badgeN}>{rewards.length + unread}</Text></View>}
              <TouchableOpacity onPress={() => setShowNotifs(false)} style={[m.closeX, { backgroundColor: colors.muted }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="x" size={15} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {rewards.length === 0 && serverNotifications.length === 0 ? (
              <View style={m.empty}>
                <Icon name="bell-off" size={28} color={`${colors.mutedForeground}60`} />
                <Text style={[m.emptyTxt, { color: colors.mutedForeground }]}>All caught up ✦</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                {serverNotifications.map(n => (
                  <View key={n.id} style={[m.notif, { backgroundColor: n.isRead ? colors.muted : `${accent}14`, borderColor: n.isRead ? 'transparent' : `${accent}28` }]}>
                    <View style={[m.notifIcon, { backgroundColor: `${accent}18` }]}>
                      <Icon name={n.type === 'witness' ? 'eye' : n.type === 'save' ? 'bookmark' : n.type === 'new_story' ? 'book-open' : 'star'} size={13} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.notifTitle, { color: colors.foreground }]} numberOfLines={2}>{n.title}</Text>
                      <Text style={[m.notifSub, { color: colors.mutedForeground }]}>{n.actorName}</Text>
                    </View>
                    {!n.isRead && <View style={[m.unread, { backgroundColor: accent }]} />}
                    <TouchableOpacity
                      style={[m.deleteBtn, { backgroundColor: 'rgba(255,80,80,0.12)' }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); deleteServerNotification(n.id); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="x" size={12} color="rgba(255,120,120,0.80)" />
                    </TouchableOpacity>
                  </View>
                ))}
                {rewards.map(r => (
                  <View key={r.id} style={[m.notif, { backgroundColor: `${DEF_ACCENT}10`, borderColor: `${DEF_ACCENT}22` }]}>
                    <Text style={{ fontSize: 20, lineHeight: 24 }}>{r.icon ?? '✦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.notifTitle, { color: colors.foreground }]}>{r.message}</Text>
                      {r.subMessage && <Text style={[m.notifSub, { color: colors.mutedForeground }]}>{r.subMessage}</Text>}
                    </View>
                    <TouchableOpacity
                      style={[m.deleteBtn, { backgroundColor: 'rgba(255,80,80,0.12)' }]}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); dismissReward(r.id); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="x" size={12} color="rgba(255,120,120,0.80)" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080614' },

  // ── Hero — centered immersive ──────────────────────────────────────────────
  hero:        { paddingHorizontal: 0, paddingBottom: 28, overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, marginBottom: 4 },
  heroActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, paddingHorizontal: 20, marginBottom: 12 },
  heroBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroBadge:   { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 3.5 },

  // Centered identity block
  heroCenter:  { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 22, gap: 7 },

  // Avatar
  avatarWrap:  { position: 'relative', marginBottom: 6 },
  avatarRing:  { width: 98, height: 98, borderRadius: 49, padding: 3 },
  avatarInner: { flex: 1, borderRadius: 46, overflow: 'hidden', backgroundColor: '#0A0820' },
  roleTag:     { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#080614' },
  roleText:    { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#fff' },

  // Identity text — centered
  heroName:    { fontSize: 32, fontFamily: 'Satoshi-Bold', color: 'rgba(245,240,255,0.98)', letterSpacing: -1.2, textAlign: 'center' },
  heroHandle:  { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.42)', textAlign: 'center' },
  heroBioRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  moodDot:     { width: 6, height: 6, borderRadius: 3 },
  heroMood:    { fontSize: 12.5, fontFamily: 'Satoshi-Medium' },
  heroRole:    { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Greeting — the single emotional focal line
  heroGreeting: {
    fontSize: 16, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(220,205,255,0.60)', textAlign: 'center', lineHeight: 23,
    marginTop: 4, marginBottom: 2, paddingHorizontal: 10,
  },

  // Primary CTA
  heroCTA:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 28, borderWidth: 1, overflow: 'hidden', marginTop: 4 },
  heroCTAText: { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },

  // Stats row — below hero center, no top border (gradient does the separation)
  statBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
              paddingVertical: 14, paddingHorizontal: 8, marginHorizontal: 20, marginBottom: 6,
              backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22,
              borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.09)' },
  statItem: { alignItems: 'center', gap: 3, flex: 1 },
  statN:    { fontSize: 22, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.96)', letterSpacing: -0.8 },
  statL:    { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,180,255,0.42)', letterSpacing: 0.6, textTransform: 'uppercase' },
  statSep:  { width: 0.5, height: 30, backgroundColor: 'rgba(255,255,255,0.10)' },

  // ── Sections ───────────────────────────────────────────────────────────────
  section:     { paddingVertical: 18 },
  sectionRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  // Mixed-case editorial label — softer hierarchy signal
  sectionLabel:{ fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3, color: 'rgba(200,185,240,0.38)', flex: 1, paddingHorizontal: 20 },
  sectionAll:  { fontSize: 12.5, fontFamily: 'Satoshi-Medium' },

  // ── Campfires ──────────────────────────────────────────────────────────────
  fireRow:     { flexDirection: 'row', gap: 18, paddingHorizontal: 20 },
  moreBtn:     { alignItems: 'center', width: 72, gap: 5 },
  moreCircle:  { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: 'rgba(160,140,200,0.14)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  fireEmptyRow:{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  fireEmptyTxt:{ flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(180,165,220,0.42)', lineHeight: 18 },

  // ── Masonry circle stories ─────────────────────────────────────────────────
  masonry:     { paddingHorizontal: 12, gap: 8 },
  masonryRow:  { flexDirection: 'row', gap: 8 },
  emptyStories:{ paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center', gap: 6 },
  emptyStoriesText: { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(180,165,220,0.42)' },
  emptyStoriesSub:  { fontSize: 12.5, fontFamily: 'Satoshi-Regular', color: 'rgba(160,145,200,0.30)', fontStyle: 'italic' },

  // ── Lumi companion block ───────────────────────────────────────────────────
  lumiBlock:   {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 16, marginTop: 2, marginBottom: 4,
    paddingHorizontal: 18, paddingVertical: 16,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  lumiAvatar:  { width: 52, height: 52 },
  lumiLabel:   { fontSize: 9.5, fontFamily: 'Satoshi-Bold', letterSpacing: 1.6, color: 'rgba(200,185,255,0.40)', marginBottom: 5, textTransform: 'uppercase' },
  lumiMsg:     { fontSize: 13.5, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(220,205,255,0.72)', lineHeight: 20 },
  lumiBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  lumiBadgeN:  { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#fff' },

  // ── Star journey nudge card ────────────────────────────────────────────────
  nudgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginTop: 6, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  nudgeOrb: {
    width: 7, height: 7, borderRadius: 4,
    opacity: 0.65,
    shadowRadius: 8, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 },
  },
  nudgeDot:      { width: 3, height: 3, borderRadius: 2, opacity: 0.6 },
  nudgeEyebrow:  { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4, textTransform: 'uppercase', opacity: 0.75 },
  nudgeTrack:    { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginVertical: 1 },
  nudgeFill:     { height: 3, borderRadius: 2, opacity: 0.75 },
  nudgeAction:   { fontSize: 11.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.50)', flex: 1, marginRight: 8 },
  nudgeFraction:   { fontSize: 11, fontFamily: 'Satoshi-Bold', opacity: 0.70 },
  nudgePublicNote: { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.38)', marginTop: 4, fontStyle: 'italic' },

  // ── Constellation intro card (one-time) ───────────────────────────────────
  introCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(168,136,248,0.12)',
  },
  introTitle:       { fontSize: 12.5, fontFamily: 'Satoshi-Bold', color: 'rgba(220,200,255,0.82)', marginBottom: 5, letterSpacing: 0.1 },
  introBody:        { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.52)', lineHeight: 18 },
  introDismiss:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(168,136,248,0.12)', alignSelf: 'center' },
  introDismissText: { fontSize: 11.5, fontFamily: 'Satoshi-Bold', color: 'rgba(200,168,255,0.75)', letterSpacing: 0.3 },

  // ── Hero mood arc ─────────────────────────────────────────────────────────
  heroMoodArc: { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.42)', marginTop: 5, textAlign: 'center' },

  // ── Activity digest strip ──────────────────────────────────────────────────
  digestRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  digestPill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20 },
  digestTxt:   { fontSize: 13, fontFamily: 'Satoshi-Medium' },

  // ── Find Friends — ambient, at bottom ─────────────────────────────────────
  findFriends:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginBottom: 12, marginTop: 4, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16 },
  findFriendsIcon:  { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(96,200,168,0.14)', alignItems: 'center', justifyContent: 'center' },
  findFriendsTitle: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(190,230,215,0.80)' },
  findFriendsSub:   { fontSize: 11.5, fontFamily: 'Satoshi-Regular', color: 'rgba(130,180,160,0.50)', marginTop: 1 },
  findFriendsBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 11, backgroundColor: 'rgba(96,200,168,0.15)' },
  findFriendsBadgeText: { fontSize: 11.5, fontFamily: 'Satoshi-Bold', color: '#5EC8A0' },

  // ── Drift invitation card ──────────────────────────────────────────────────
  driftSection:    { paddingHorizontal: 16, paddingBottom: 8 },
  driftCard:       { borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(50,24,120,0.30)', position: 'relative' },
  driftLumi:       { position: 'absolute', top: -10, right: -6, width: 110, height: 110 },
  driftContent:    { padding: 22, paddingRight: 96 },
  driftEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  driftEyebrow:    { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.5, color: 'rgba(200,168,255,0.55)', textTransform: 'uppercase' },
  driftTitle:      { fontSize: 24, fontFamily: 'Satoshi-Bold', color: 'rgba(235,225,255,0.97)', letterSpacing: -0.6, marginBottom: 10, lineHeight: 28 },
  driftDesc:       { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.55)', lineHeight: 19.5, marginBottom: 18 },
  driftChips:      { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  driftChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(160,128,248,0.16)' },
  driftChipTxt:    { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,175,255,0.72)' },
  driftCTA:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  driftCTATxt:     { fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,168,255,0.55)', fontStyle: 'italic' },
});

// Modal styles
const m = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet:     { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingTop: 12, paddingHorizontal: 20 },
  sheetTall: { maxHeight: '80%' },
  handle:    { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  title:     { fontSize: 17, fontFamily: 'Satoshi-Bold', marginBottom: 4 },
  sub:       { fontSize: 12.5, fontFamily: 'Satoshi-Regular', marginBottom: 18 },
  row:       { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  oCard:     { width: 84, borderRadius: 14, padding: 8, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent', position: 'relative' },
  oImg:      { width: 68, height: 68, borderRadius: 10, overflow: 'hidden', marginBottom: 6 },
  oName:     { fontSize: 11, fontFamily: 'Satoshi-Medium', textAlign: 'center' },
  check:     { position: 'absolute', top: 4, right: 4, width: 17, height: 17, borderRadius: 8.5, alignItems: 'center', justifyContent: 'center' },
  badge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeN:    { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#fff' },
  closeX:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  empty:     { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyTxt:  { fontSize: 14, fontFamily: 'Satoshi-Regular' },
  notif:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  notifIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  notifTitle:{ fontSize: 13, fontFamily: 'Satoshi-Medium', lineHeight: 17 },
  notifSub:  { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },
  unread:    { width: 7, height: 7, borderRadius: 3.5 },
  deleteBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});
