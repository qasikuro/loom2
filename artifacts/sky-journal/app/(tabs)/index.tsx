import { StarField } from '@/components/StarField';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { getDailyPrompt } from '@/constants/prompts';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Animated, DimensionValue, Easing, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import {
  useApp, apiFetch, type GuideAvailability, type GuideProfile, type DiscoverPost,
  type ConstellationState, type RewardBalance as RewardBalanceData,
} from '@/context/AppContext';
import { RewardBalance } from '@/components/RewardBalance';
import { RewardBanner } from '@/components/RewardBanner';
import { ShopModal } from '@/components/ShopModal';
import { useSound } from '@/context/SoundContext';
import { useColors } from '@/hooks/useColors';

// ─── Active Event types + theme map ──────────────────────────────────────────
interface EventInventoryItem {
  type: 'stars' | 'aura' | 'shards' | 'item';
  amount?: number; itemId?: string; itemName?: string; label: string;
}
interface ActiveEvent {
  id: string; title: string; description: string;
  theme: string; status: string;
  startsAt: string | null; endsAt: string | null;
  inventory: EventInventoryItem[];
  aiPrompt: string;
}
const EVENT_THEME: Record<string, { color: string; bgStart: string; bgEnd: string; icon: string }> = {
  spring:  { color: '#F4A0C0', bgStart: 'rgba(244,160,192,0.16)', bgEnd: 'rgba(244,160,192,0.04)', icon: '🌸' },
  summer:  { color: '#F0C040', bgStart: 'rgba(240,192,64,0.16)',  bgEnd: 'rgba(240,192,64,0.04)',  icon: '☀️' },
  autumn:  { color: '#E08040', bgStart: 'rgba(224,128,64,0.16)',  bgEnd: 'rgba(224,128,64,0.04)',  icon: '🍂' },
  winter:  { color: '#80C0F0', bgStart: 'rgba(128,192,240,0.16)', bgEnd: 'rgba(128,192,240,0.04)', icon: '❄️' },
  special: { color: '#A880F8', bgStart: 'rgba(168,128,248,0.16)', bgEnd: 'rgba(168,128,248,0.04)', icon: '✦'  },
};
const ITEM_ICONS: Record<string, string> = { stars: '⭐', aura: '🔵', shards: '💎', item: '🎁' };

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
  { key: 'social',   label: 'Social',   getCount: (c: ConstellationState) => c.socialCount,   threshold: 5,  unit: 'follows',      color: '#78C8A8', action: 'Follow 5 people you admire in Discover' },
  { key: 'memory',   label: 'Memory',   getCount: (c: ConstellationState) => c.memoryCount,   threshold: 10, unit: 'memories',     color: '#9878C8', action: 'Write in your journal a little more' },
  { key: 'quiet',    label: 'Quiet',    getCount: (c: ConstellationState) => c.quietStreak,   threshold: 7,  unit: 'day streak',   color: '#7890C8', action: 'Journal every day to build your streak' },
  { key: 'creative', label: 'Creative', getCount: (c: ConstellationState) => c.creativeCount, threshold: 5,  unit: 'stories',      color: '#C87AA8', action: 'Create and share a few more stories' },
  { key: 'helping',  label: 'Helping',  getCount: (c: ConstellationState) => c.helpingCount,  threshold: 20, unit: 'stickers sent',color: '#C8A84B', action: 'Send stickers to stories you love in Discover' },
  { key: 'seasonal', label: 'Seasonal', getCount: (c: ConstellationState) => c.seasonalCount, threshold: 6,  unit: 'outfits',      color: '#68B8B0', action: 'Log 6 outfits to your Sky Wardrobe' },
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
// ─── Daily Invitation card ───────────────────────────────────────────────────
function DailyInvitation({ onWrite, userMood }: { onWrite: (prompt: string, mood: string) => void; userMood?: string | null }) {
  const today  = new Date();
  const daily  = getDailyPrompt(userMood);
  const accent = MOOD_ACCENT[daily.mood] ?? '#C8A84B';
  const accentRgb = daily.mood === 'Dreamy' ? '168,136,248'
    : daily.mood === 'Peaceful' ? '96,168,200'
    : daily.mood === 'Soft'    ? '190,160,220'
    : daily.mood === 'Hopeful' ? '200,168,75'
    : daily.mood === 'Chaotic' ? '220,120,70'
    : '200,168,75';
  return (
    <TouchableOpacity
      style={[ds.card, { borderColor: `rgba(${accentRgb},0.22)` }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onWrite(daily.text, daily.mood); }}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={[`rgba(${accentRgb},0.11)`, `rgba(${accentRgb},0.03)`, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1.2, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`rgba(${accentRgb},0.60)`, `rgba(${accentRgb},0.12)`, 'transparent']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
        pointerEvents="none"
      />
      <View style={ds.left}>
        <View style={ds.eyebrow}>
          <Text style={[ds.sparkGlyph, { color: `rgba(${accentRgb},0.70)` }]}>✦</Text>
          <Text style={[ds.label, { color: `rgba(${accentRgb},0.65)` }]}>Daily Invitation</Text>
          <View style={[ds.datePill, { backgroundColor: `rgba(${accentRgb},0.10)` }]}>
            <Text style={[ds.dateTxt, { color: `rgba(${accentRgb},0.50)` }]}>
              {today.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          {daily.mood !== 'general' && (
            <View style={[ds.moodPill, { backgroundColor: `rgba(${accentRgb},0.12)`, borderColor: `rgba(${accentRgb},0.25)` }]}>
              <Text style={[ds.moodPillTxt, { color: accent }]}>{daily.mood}</Text>
            </View>
          )}
        </View>
        <Text style={ds.prompt}>{daily.text}</Text>
        <Text style={[ds.cta, { color: `rgba(${accentRgb},0.55)` }]}>Begin writing →</Text>
      </View>
      <View style={[ds.writeBtn, { backgroundColor: `rgba(${accentRgb},0.16)`, borderColor: `rgba(${accentRgb},0.28)` }]}>
        <Icon name="feather" size={13} color={accent} />
      </View>
    </TouchableOpacity>
  );
}
const ds = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginTop: 3, marginBottom: 2,
    paddingHorizontal: 16, paddingVertical: 16,
    borderRadius: 22, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.016)',
    borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  left:       { flex: 1 },
  eyebrow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9, flexWrap: 'wrap' },
  sparkGlyph: { fontSize: 10, lineHeight: 13 },
  label:      { fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 2.0, textTransform: 'uppercase' },
  datePill:   { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5 },
  dateTxt:    { fontSize: 8.5, fontFamily: 'Satoshi-Medium', letterSpacing: 0.3 },
  moodPill:   { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, borderWidth: 1 },
  moodPillTxt:{ fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.5 },
  prompt:     { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(242,232,255,0.88)', lineHeight: 21, letterSpacing: -0.15, marginBottom: 8 },
  cta:        { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.2 },
  writeBtn:   { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  writeBtnTxt:{ fontSize: 11.5, fontFamily: 'Satoshi-Bold', color: 'rgba(235,220,255,0.88)', letterSpacing: 0.2 },
});

function FriendBubble({ post }: { post: DiscoverPost }) {
  const mc = MOOD_COLOR[post.mood] ?? DEF_ACCENT;
  const label = post.authorHandle ? post.authorHandle.replace('@', '') : post.authorName.split(' ')[0];
  return (
    <TouchableOpacity
      style={fr.wrap}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/story/[id]', params: { id: post.id } } as any); }}
      activeOpacity={0.80}
    >
      {/* Outer glow ring — mood colour gradient */}
      <LinearGradient
        colors={[mc, '#A880F8', '#60C8F8']}
        style={fr.ring}
        start={{ x: 0.1, y: 1 }} end={{ x: 1, y: 0.1 }}
      >
        <View style={fr.inner}>
          {post.authorAvatarUri
            ? <Image source={{ uri: post.authorAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
            : <Text style={fr.initial}>{post.authorName.charAt(0).toUpperCase()}</Text>
          }
        </View>
      </LinearGradient>
      {/* Active-story dot */}
      <View style={[fr.newDot, { backgroundColor: mc }]} />
      <Text style={fr.name} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}
const fr = StyleSheet.create({
  row:    { paddingHorizontal: 16, paddingBottom: 6, gap: 4 },
  wrap:   { alignItems: 'center', width: 70, gap: 6 },
  ring:   { width: 60, height: 60, borderRadius: 30, padding: 2 },
  inner:  { flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#0E0B28',
            alignItems: 'center', justifyContent: 'center' },
  initial:{ fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.88)' },
  newDot: { position: 'absolute', top: 43, right: 8, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#06040E' },
  name:   { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(210,195,255,0.55)', textAlign: 'center', maxWidth: 66 },
  addWrap:  { alignItems: 'center', width: 58, gap: 5 },
  addCircle:{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(168,136,248,0.08)', borderWidth: 1.5, borderColor: 'rgba(168,136,248,0.18)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontSize: 9.5, fontFamily: 'Satoshi-Medium', color: 'rgba(180,160,240,0.38)', textAlign: 'center' },
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

// ─── Witness Summary Card — shown on home when stories receive new witnesses ──
function WitnessSummaryCard({
  count, storyTitle, onPress,
}: { count: number; storyTitle: string; onPress: () => void }) {
  const stars = useRef(
    Array.from({ length: 6 }, () => ({
      x:   new Animated.Value(0),
      y:   new Animated.Value(0),
      op:  new Animated.Value(0),
      sc:  new Animated.Value(0.4),
    })),
  ).current;

  useEffect(() => {
    function launch(i: number) {
      const s = stars[i]!;
      s.x.setValue(0); s.y.setValue(0); s.op.setValue(0); s.sc.setValue(0.4);
      const angle = (i / stars.length) * Math.PI * 2 + Math.random() * 0.6;
      const dist  = 28 + Math.random() * 18;
      Animated.sequence([
        Animated.delay(i * 180 + Math.random() * 120),
        Animated.parallel([
          Animated.timing(s.op, { toValue: 1,    duration: 220, useNativeDriver: true }),
          Animated.spring(s.sc, { toValue: 1,    tension: 80, friction: 7, useNativeDriver: true }),
          Animated.timing(s.x,  { toValue: Math.cos(angle) * dist, duration: 900, useNativeDriver: true }),
          Animated.timing(s.y,  { toValue: Math.sin(angle) * dist, duration: 900, useNativeDriver: true }),
        ]),
        Animated.timing(s.op, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(() => setTimeout(() => launch(i), 1400 + Math.random() * 800));
    }
    stars.forEach((_, i) => setTimeout(() => launch(i), i * 200));
  }, []);

  const ICONS = ['✦', '◈', '◇', '⬡', '◐', '△'];
  const label = count === 1
    ? `1 soul witnessed "${storyTitle}"`
    : `${count} souls witnessed "${storyTitle}"`;

  return (
    <TouchableOpacity
      style={wsc.card}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={['rgba(200,168,75,0.10)', 'rgba(200,168,75,0.04)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      {/* Floating star particles */}
      <View style={wsc.particleAnchor} pointerEvents="none">
        {stars.map((s, i) => (
          <Animated.Text
            key={i}
            style={[wsc.particle, {
              opacity:   s.op,
              transform: [{ translateX: s.x }, { translateY: s.y }, { scale: s.sc }],
            }]}
          >
            {ICONS[i]}
          </Animated.Text>
        ))}
      </View>
      <View style={wsc.inner}>
        <Icon name="eye" size={15} color="#C8A84B" />
        <Text style={wsc.label} numberOfLines={2}>{label}</Text>
        <Icon name="chevron-right" size={13} color="rgba(200,168,75,0.40)" />
      </View>
    </TouchableOpacity>
  );
}
const wsc = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 10, borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(200,168,75,0.22)', overflow: 'hidden', position: 'relative',
  },
  particleAnchor: {
    position: 'absolute', top: '50%', left: 28, width: 0, height: 0,
  },
  particle: {
    position: 'absolute', fontSize: 12, color: '#C8A84B',
  },
  inner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  label: {
    flex: 1, fontSize: 13, fontFamily: 'Satoshi-Medium',
    color: 'rgba(200,168,75,0.90)', lineHeight: 18,
  },
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
  bar:    { width: 2.5, height: 11, borderRadius: 2 },
  label:  { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.8, color: 'rgba(200,185,255,0.42)', textTransform: 'uppercase' },
  badge:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeN: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  action: { fontSize: 12, fontFamily: 'Satoshi-Medium', opacity: 0.65 },
});

// ════════════════════════════════════════════════════════════════════════════
// ─── Cosmetic item metadata (mirrors shop catalog — used for rich previews) ───
const COSMETIC_META: Record<string, { icon: string; category: 'frame' | 'accent' | 'theme'; catLabel: string; desc: string }> = {
  frame_starlight:     { icon: '✦', category: 'frame',  catLabel: 'Profile Frame', desc: 'Golden starlight radiance' },
  frame_moonveil:      { icon: '◑', category: 'frame',  catLabel: 'Profile Frame', desc: 'Silver moonlit crescent' },
  accent_aura:         { icon: '◈', category: 'accent', catLabel: 'Bio Accent',    desc: 'Soft purple luminescence' },
  theme_locket:        { icon: '◇', category: 'theme',  catLabel: 'Journal Theme', desc: 'Vintage memory locket' },
  theme_aurora:        { icon: '⋆', category: 'theme',  catLabel: 'Journal Theme', desc: 'Northern lights colours' },
  frame_blossom:       { icon: '🌸', category: 'frame',  catLabel: 'Profile Frame', desc: 'Cherry petals, spring breeze' },
  accent_petal:        { icon: '✿', category: 'accent', catLabel: 'Bio Accent',    desc: 'Blossoms frame your bio' },
  frame_solstice:      { icon: '☀', category: 'frame',  catLabel: 'Profile Frame', desc: 'Sun-drenched summer glow' },
  accent_twilight:     { icon: '◐', category: 'accent', catLabel: 'Bio Accent',    desc: 'Warm amber twilight shimmer' },
  frame_harvest:       { icon: '🍂', category: 'frame',  catLabel: 'Profile Frame', desc: 'Amber autumn leaves at dusk' },
  accent_ember:        { icon: '🔥', category: 'accent', catLabel: 'Bio Accent',    desc: 'Burnished bonfire warmth' },
  theme_aurora_winter: { icon: '🌌', category: 'theme',  catLabel: 'Journal Theme', desc: 'Polar aurora shimmer' },
  frame_frost:         { icon: '❄', category: 'frame',  catLabel: 'Profile Frame', desc: 'Ice-crystal filigree' },
};

// ─── Shared countdown helper ─────────────────────────────────────────────────
function eventCountdown(endsAt: string | null): { label: string; dateStr: string | null } | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalHours = Math.floor(ms / 3600000);
  const days  = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  let label: string;
  if (days === 0) {
    label = totalHours <= 1 ? '1 hour left' : `${totalHours}h left`;
  } else if (hours === 0) {
    label = days === 1 ? '1 day left' : `${days} days left`;
  } else {
    label = `${days}d ${hours}h left`;
  }
  const dateStr = new Date(endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, dateStr };
}

// ─── Event Detail Sheet ───────────────────────────────────────────────────────
function EventDetailSheet({ event, visible, onClose, onCreateStory }: {
  event: ActiveEvent; visible: boolean; onClose: () => void;
  onCreateStory?: (prompt: string, mood: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(600)).current;
  const th     = EVENT_THEME[event.theme] ?? EVENT_THEME['special']!;
  const cd     = eventCountdown(event.endsAt);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, tension: 55, friction: 13, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const REWARD_BG:    Record<string, string> = { stars: 'rgba(200,168,75,0.14)', aura: 'rgba(107,91,149,0.14)', shards: 'rgba(120,180,220,0.14)', item: 'rgba(168,136,248,0.14)' };
  const REWARD_COLOR: Record<string, string> = { stars: '#C8A84B', aura: '#9878D8', shards: '#78B4DC', item: '#A880F8' };
  const REWARD_BORDER:Record<string, string> = { stars: 'rgba(200,168,75,0.28)', aura: 'rgba(107,91,149,0.28)', shards: 'rgba(120,180,220,0.28)', item: 'rgba(168,136,248,0.28)' };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={m.overlay} onPress={onClose}>
        <Animated.View
          style={[ev.sheet, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 20, transform: [{ translateY: slideY }] }]}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            {/* Handle */}
            <View style={ev.sheetHandle} />

            {/* Themed header stripe */}
            <LinearGradient
              colors={[th.bgStart, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={ev.sheetHeaderGrad}
              pointerEvents="none"
            />

            {/* Eyebrow + close */}
            <View style={ev.sheetTopRow}>
              <View style={ev.eyebrowRow}>
                <Text style={ev.themeIcon}>{th.icon}</Text>
                <Text style={[ev.eyebrow, { color: th.color }]}>SKY EVENT</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[ev.sheetClose, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Icon name="x" size={13} color="rgba(200,184,232,0.55)" />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <Text style={ev.sheetTitle}>{event.title}</Text>

            {/* Countdown */}
            {cd && (
              <View style={[ev.pill, { backgroundColor: `${th.color}1E`, alignSelf: 'flex-start', marginBottom: 14 }]}>
                <Text style={[ev.pillTxt, { color: th.color }]}>
                  {cd.label}{cd.dateStr ? `  ·  ends ${cd.dateStr}` : ''}
                </Text>
              </View>
            )}

            {/* Description */}
            {!!event.description && (
              <Text style={ev.sheetDesc}>{event.description}</Text>
            )}

            {/* Rewards section — cosmetics as showcase cards, currencies as chips */}
            {event.inventory.length > 0 && (() => {
              const cosmeticItems = event.inventory.filter(it => it.type === 'item');
              const currencyItems = event.inventory.filter(it => it.type !== 'item');

              return (
                <>
                  {/* ── Cosmetic showcase ── */}
                  {cosmeticItems.length > 0 && (
                    <>
                      <Text style={ev.sheetRewardsLabel}>Exclusive cosmetics</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={ev.showScroll}
                        style={{ marginHorizontal: -20 }}
                      >
                        {cosmeticItems.map((item, i) => {
                          const meta = item.itemId ? (COSMETIC_META[item.itemId] ?? null) : null;
                          const icon = meta?.icon ?? '🎁';
                          const catLabel = meta?.catLabel ?? 'Cosmetic item';
                          const desc = meta?.desc ?? item.label;
                          const cat  = meta?.category ?? 'frame';

                          return (
                            <View key={i} style={[ev.showCard, { borderColor: `${th.color}40` }]}>
                              {/* Preview area */}
                              <View style={[ev.showPreview, { backgroundColor: `${th.color}08` }]}>
                                <LinearGradient
                                  colors={[`${th.color}18`, 'transparent']}
                                  style={StyleSheet.absoluteFill}
                                  start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
                                  pointerEvents="none"
                                />

                                {cat === 'frame' && (
                                  /* Concentric frame rings around central icon */
                                  <View style={[ev.frameOuter, { borderColor: `${th.color}50` }]}>
                                    <View style={[ev.frameMid, { borderColor: `${th.color}38` }]}>
                                      <View style={[ev.frameInner, { borderColor: `${th.color}28`, backgroundColor: `${th.color}10` }]}>
                                        <Text style={ev.showIcon}>{icon}</Text>
                                      </View>
                                    </View>
                                  </View>
                                )}

                                {cat === 'accent' && (
                                  /* Horizontal glow band with floating icon */
                                  <View style={ev.accentWrap}>
                                    <LinearGradient
                                      colors={[`${th.color}00`, `${th.color}40`, `${th.color}00`]}
                                      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                                      style={ev.accentBand}
                                      pointerEvents="none"
                                    />
                                    <Text style={ev.showIcon}>{icon}</Text>
                                    <View style={ev.accentDots}>
                                      {[0,1,2,3,4].map(d => (
                                        <View key={d} style={[ev.accentDot, { opacity: 0.18 + d * 0.08, backgroundColor: th.color }]} />
                                      ))}
                                    </View>
                                  </View>
                                )}

                                {cat === 'theme' && (
                                  /* Journal page lines with icon */
                                  <View style={ev.themeWrap}>
                                    {[0,1,2,3].map(l => (
                                      <View key={l} style={[ev.themeLine, { backgroundColor: `${th.color}22`, width: l === 2 ? '60%' : '80%' }]} />
                                    ))}
                                    <View style={[ev.themeIconBadge, { backgroundColor: `${th.color}18`, borderColor: `${th.color}30` }]}>
                                      <Text style={ev.showIcon}>{icon}</Text>
                                    </View>
                                  </View>
                                )}
                              </View>

                              {/* Card footer */}
                              <View style={ev.showCardBody}>
                                <Text style={ev.showCardName} numberOfLines={2}>{item.label}</Text>
                                <Text style={[ev.showCardCat, { color: `${th.color}AA` }]}>{catLabel}</Text>
                                <Text style={[ev.showCardDesc, { color: 'rgba(200,184,232,0.45)' }]} numberOfLines={2}>{desc}</Text>
                                <View style={[ev.showCardBadge, { backgroundColor: `${th.color}14`, borderColor: `${th.color}28` }]}>
                                  <Text style={[ev.showCardBadgeTxt, { color: th.color }]}>✦ Limited to this event</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                        <View style={{ width: 20 }} />
                      </ScrollView>
                    </>
                  )}

                  {/* ── Currency chips ── */}
                  {currencyItems.length > 0 && (
                    <>
                      <Text style={[ev.sheetRewardsLabel, { marginTop: cosmeticItems.length > 0 ? 18 : 0 }]}>Also included</Text>
                      <View style={ev.currRow}>
                        {currencyItems.map((item, i) => {
                          const color  = REWARD_COLOR[item.type]  ?? '#C8B8E8';
                          const bg     = REWARD_BG[item.type]     ?? 'rgba(200,184,232,0.10)';
                          const border = REWARD_BORDER[item.type] ?? 'rgba(200,184,232,0.20)';
                          const label  = item.type === 'stars' ? 'Stars' : item.type === 'aura' ? 'Aura' : 'Shards';
                          return (
                            <View key={i} style={[ev.currChip, { backgroundColor: bg, borderColor: border }]}>
                              <Text style={ev.currChipEmoji}>{ITEM_ICONS[item.type] ?? '✦'}</Text>
                              <Text style={[ev.currChipNum, { color }]}>{label}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  )}
                </>
              );
            })()}

            {/* Create a story CTA */}
            {(event.aiPrompt || event.description) && (
              <TouchableOpacity
                style={[ev.ctaBtn, { backgroundColor: `${th.color}18`, borderColor: `${th.color}38` }]}
                onPress={() => {
                  onClose();
                  const mood = THEME_TO_MOOD[event.theme] ?? 'Dreamy';
                  onCreateStory?.(event.aiPrompt || event.description, mood);
                }}
                activeOpacity={0.84}
              >
                <Icon name="book-open" size={15} color={th.color} />
                <Text style={[ev.ctaBtnTxt, { color: th.color }]}>Create a story for this event  →</Text>
              </TouchableOpacity>
            )}

            {/* Admin-grant note */}
            <View style={ev.sheetNote}>
              <Text style={ev.sheetNoteText}>
                ✦  Rewards are granted by the sky team during or after the event
              </Text>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Theme → Mood mapping ─────────────────────────────────────────────────────
const THEME_TO_MOOD: Record<string, string> = {
  spring:  'Soft',
  summer:  'Hopeful',
  autumn:  'Romantic',
  winter:  'Peaceful',
  special: 'Dreamy',
};

// ─── Event Banner (tappable) ──────────────────────────────────────────────────
function EventBanner({ event, onPress, onDismiss }: { event: ActiveEvent; onPress: () => void; onDismiss: () => void }) {
  const th = EVENT_THEME[event.theme] ?? EVENT_THEME['special']!;
  const cd = eventCountdown(event.endsAt);

  return (
    <View style={[ev.card, { borderColor: `${th.color}28` }]}>
      <LinearGradient
        colors={[th.bgStart, th.bgEnd, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Dismiss button */}
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDismiss(); }}
        style={ev.dismissBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="x" size={11} color={`${th.color}80`} />
      </TouchableOpacity>

      {/* Tappable content area */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.82}>
        {/* Eyebrow */}
        <View style={ev.eyebrowRow}>
          <Text style={ev.themeIcon}>{th.icon}</Text>
          <Text style={[ev.eyebrow, { color: th.color }]}>EVENT</Text>
          {cd && (
            <View style={[ev.pill, { backgroundColor: `${th.color}1E`, marginLeft: 'auto' as any }]}>
              <Text style={[ev.pillTxt, { color: th.color }]}>{cd.label}</Text>
            </View>
          )}
          <Icon name="chevron-right" size={12} color={`${th.color}80`} />
        </View>

        {/* Title */}
        <Text style={ev.title}>{event.title}</Text>

        {/* Description */}
        {!!event.description && (
          <Text style={ev.desc} numberOfLines={2}>{event.description}</Text>
        )}

        {/* Reward chips (up to 4) */}
        {event.inventory.length > 0 && (
          <View style={ev.chips}>
            {event.inventory.slice(0, 4).map((item, i) => (
              <View key={i} style={[ev.chip, { backgroundColor: `${th.color}16` }]}>
                <Text style={ev.chipIcon}>{ITEM_ICONS[item.type] ?? '🎁'}</Text>
                <Text style={[ev.chipTxt, { color: th.color }]}>{item.label}</Text>
              </View>
            ))}
            {event.inventory.length > 4 && (
              <View style={[ev.chip, { backgroundColor: `${th.color}0E` }]}>
                <Text style={[ev.chipTxt, { color: th.color, opacity: 0.60 }]}>
                  +{event.inventory.length - 4} more  →
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Season-derived data ─────────────────────────────────────────────────────
const SEASON_BY_MONTH: Record<number, { name: string; icon: string; color: string; bgA: string; bgB: string; endMonth: number }> = {
  0: { name: "Winter's Light",    icon: '❄️', color: '#80C0F0', bgA: 'rgba(128,192,240,0.20)', bgB: 'rgba(80,140,200,0.08)',  endMonth: 2  },
  1: { name: "Winter's Light",    icon: '❄️', color: '#80C0F0', bgA: 'rgba(128,192,240,0.20)', bgB: 'rgba(80,140,200,0.08)',  endMonth: 2  },
  2: { name: 'Spring in the Sky', icon: '🌸', color: '#F4A0C0', bgA: 'rgba(244,160,192,0.22)', bgB: 'rgba(168,100,180,0.08)', endMonth: 5  },
  3: { name: 'Spring in the Sky', icon: '🌸', color: '#F4A0C0', bgA: 'rgba(244,160,192,0.22)', bgB: 'rgba(168,100,180,0.08)', endMonth: 5  },
  4: { name: 'Spring in the Sky', icon: '🌸', color: '#F4A0C0', bgA: 'rgba(244,160,192,0.22)', bgB: 'rgba(168,100,180,0.08)', endMonth: 5  },
  5: { name: 'Summer Solstice',   icon: '☀️', color: '#F0C040', bgA: 'rgba(240,192,64,0.22)',  bgB: 'rgba(200,120,40,0.08)',  endMonth: 8  },
  6: { name: 'Summer Solstice',   icon: '☀️', color: '#F0C040', bgA: 'rgba(240,192,64,0.22)',  bgB: 'rgba(200,120,40,0.08)',  endMonth: 8  },
  7: { name: 'Summer Solstice',   icon: '☀️', color: '#F0C040', bgA: 'rgba(240,192,64,0.22)',  bgB: 'rgba(200,120,40,0.08)',  endMonth: 8  },
  8: { name: 'Autumn Memories',   icon: '🍂', color: '#E08050', bgA: 'rgba(224,128,80,0.22)',  bgB: 'rgba(160,80,40,0.08)',   endMonth: 11 },
  9: { name: 'Autumn Memories',   icon: '🍂', color: '#E08050', bgA: 'rgba(224,128,80,0.22)',  bgB: 'rgba(160,80,40,0.08)',   endMonth: 11 },
  10: { name: 'Autumn Memories',  icon: '🍂', color: '#E08050', bgA: 'rgba(224,128,80,0.22)',  bgB: 'rgba(160,80,40,0.08)',   endMonth: 11 },
  11: { name: "Winter's Light",   icon: '❄️', color: '#80C0F0', bgA: 'rgba(128,192,240,0.20)', bgB: 'rgba(80,140,200,0.08)',  endMonth: 2  },
};

function getSeasonStart(): Date {
  const now = new Date(), m = now.getMonth(), y = now.getFullYear();
  if (m >= 11) return new Date(y, 11, 1);
  if (m >= 8)  return new Date(y, 8, 1);
  if (m >= 5)  return new Date(y, 5, 1);
  if (m >= 2)  return new Date(y, 2, 1);
  return new Date(y - 1, 11, 1);
}

function SeasonCard({ activeEvent, constellation, onPress }: {
  activeEvent: ActiveEvent | null;
  constellation: ConstellationState | null;
  onPress: () => void;
}) {
  const month = new Date().getMonth();
  const sd    = SEASON_BY_MONTH[month]!;
  const th    = activeEvent ? (EVENT_THEME[activeEvent.theme] ?? null) : null;
  const color = th?.color   ?? sd.color;
  const icon  = th?.icon    ?? sd.icon;
  const name  = activeEvent?.title ?? sd.name;
  const bgA   = th ? th.bgStart : sd.bgA;
  const bgB   = th ? th.bgEnd   : sd.bgB;

  const end = new Date(); end.setMonth(sd.endMonth, 1); end.setHours(0, 0, 0, 0);
  if (end <= new Date()) end.setFullYear(end.getFullYear() + 1);
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - Date.now()) / 86400000));
  const dayN     = Math.max(1, Math.ceil((Date.now() - getSeasonStart().getTime()) / 86400000));

  const stars = constellation?.unlockedStars.length ?? 0;
  const pct   = stars / 6;

  return (
    <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.84}>
      <LinearGradient
        colors={[bgA, bgB, 'transparent'] as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[sc.glowOrb, { backgroundColor: color }]} />
      <View style={sc.eyebrowRow}>
        <Text style={sc.seasonIcon}>{icon}</Text>
        <Text style={[sc.eyebrow, { color }]}>CURRENT SEASON</Text>
        <View style={{ flex: 1 }} />
        <View style={[sc.pill, { backgroundColor: `${color}22` }]}>
          <Text style={[sc.pillTxt, { color }]}>{daysLeft}d left</Text>
        </View>
        <View style={[sc.badge, { backgroundColor: `${color}18`, borderColor: `${color}38` }]}>
          <Text style={[sc.badgeTxt, { color }]}>Season Pass</Text>
        </View>
      </View>
      <Text style={sc.seasonName}>{name}</Text>
      <Text style={sc.dayLabel}>Day {dayN} of your season</Text>
      <View style={sc.progBlock}>
        <View style={sc.progTrack}>
          <View style={[sc.progFill, { width: `${Math.round(pct * 100)}%` as DimensionValue, backgroundColor: color }]} />
        </View>
        <Text style={[sc.progLabel, { color: `${color}BB` }]}>{stars}/6 seasonal stars collected</Text>
      </View>
      <View style={[sc.cta, { borderColor: `${color}45` }]}>
        <Text style={[sc.ctaTxt, { color }]}>Continue Journey  →</Text>
      </View>
    </TouchableOpacity>
  );
}
const sc = StyleSheet.create({
  card:       { marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 20, padding: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,180,255,0.12)', backgroundColor: 'rgba(16,10,40,0.55)' },
  glowOrb:    { position: 'absolute', top: -70, right: -50, width: 180, height: 180, borderRadius: 90, opacity: 0.07 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  seasonIcon: { fontSize: 16, lineHeight: 20 },
  eyebrow:    { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4 },
  pill:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  pillTxt:    { fontSize: 10, fontFamily: 'Satoshi-Medium', letterSpacing: 0.3 },
  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginLeft: 3 },
  badgeTxt:   { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.6 },
  seasonName: { fontSize: 20, fontFamily: 'Satoshi-Bold', color: '#EEE8FF', letterSpacing: 0.2, marginBottom: 4 },
  dayLabel:   { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)', fontStyle: 'italic', marginBottom: 14 },
  progBlock:  { gap: 7, marginBottom: 14 },
  progTrack:  { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  progFill:   { height: 5, borderRadius: 3 },
  progLabel:  { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.3 },
  cta:        { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 22, borderWidth: 1 },
  ctaTxt:     { fontSize: 12, fontFamily: 'Satoshi-Medium', letterSpacing: 0.3 },
});

// ─── Constellation Mini-bar ──────────────────────────────────────────────────
const MINI_STARS = [
  { key: 'social',   label: 'Social',   color: '#78C8A8' },
  { key: 'memory',   label: 'Memory',   color: '#9878C8' },
  { key: 'quiet',    label: 'Quiet',    color: '#7890C8' },
  { key: 'creative', label: 'Creative', color: '#C87AA8' },
  { key: 'helping',  label: 'Helping',  color: '#C8A84B' },
  { key: 'seasonal', label: 'Seasonal', color: '#68B8B0' },
];
function ConstellationMini({ constellation, onPress }: { constellation: ConstellationState | null; onPress: () => void }) {
  if (!constellation) return null;
  return (
    <TouchableOpacity style={cm.wrap} onPress={onPress} activeOpacity={0.85}>
      <View style={cm.header}>
        <Text style={cm.headerTitle}>Your Constellation</Text>
        <Text style={cm.headerCta}>{constellation.unlockedStars.length}/6 stars  →</Text>
      </View>
      <View style={cm.row}>
        {MINI_STARS.map((star, i) => {
          const lit = constellation.unlockedStars.includes(star.key);
          // Compute partial-progress glow (0–1) for unlit stars
          const def = STAR_DEFS.find(d => d.key === star.key);
          const pct = (!lit && def) ? Math.min(1, def.getCount(constellation) / def.threshold) : 0;
          const hasProgress = pct > 0;
          return (
            <React.Fragment key={star.key}>
              {i > 0 && <View style={[cm.line, { backgroundColor: lit ? 'rgba(200,184,232,0.22)' : hasProgress ? 'rgba(200,184,232,0.12)' : 'rgba(200,184,232,0.06)' }]} />}
              <View style={cm.starCol}>
                <View style={[cm.dot, {
                  backgroundColor: lit ? star.color : hasProgress ? `${star.color}40` : 'rgba(200,184,232,0.12)',
                  shadowColor: lit ? star.color : hasProgress ? star.color : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowRadius: lit ? 7 : hasProgress ? 4 : 0,
                  shadowOpacity: lit ? 0.9 : hasProgress ? 0.45 : 0,
                }]} />
                <Text style={[cm.dotLabel, { color: lit ? 'rgba(220,210,255,0.60)' : hasProgress ? 'rgba(200,184,232,0.40)' : 'rgba(200,184,232,0.25)' }]}>{star.label}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}
const cm = StyleSheet.create({
  wrap:        { marginHorizontal: 16, marginVertical: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(200,184,232,0.08)' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.55)', letterSpacing: 0.3 },
  headerCta:   { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.35)', letterSpacing: 0.3 },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  starCol:     { alignItems: 'center', gap: 6 },
  dot:         { width: 13, height: 13, borderRadius: 7 },
  line:        { height: 1.5, flex: 1, marginHorizontal: 1 },
  dotLabel:    { fontSize: 8.5, fontFamily: 'Satoshi-Medium', letterSpacing: 0.2 },
});

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
    campfireUnread, unreadCampfireRooms,
    dmUnread, unreadDmThreads, markDmThreadRead,
  } = useApp();
  const { userId: clerkUserId } = useAuth();
  const { playSound } = useSound();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 90;

  const [showNotifs,  setShowNotifs]  = useState(false);
  const [showOutfits, setShowOutfits] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [showConstellationIntro, setShowConstellationIntro] = useState(false);
  const [activeEvent,    setActiveEvent]    = useState<ActiveEvent | null>(null);
  const [eventDismissed, setEventDismissed] = useState(false);
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [showShop,       setShowShop]       = useState(false);

  // ── Witness delta card: only shown when witness counts increased since last open ──
  const [newWitnessData, setNewWitnessData] = useState<{ count: number; title: string } | null>(null);
  useEffect(() => {
    if (!stories.length) return;
    const SNAP_KEY = 'witness_snapshot_v1';
    AsyncStorage.getItem(SNAP_KEY).then(raw => {
      const snapshot: Record<string, number> = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      let totalNew = 0;
      let topTitle = '';
      let topNew   = 0;
      stories.forEach(s => {
        const prev = snapshot[s.id] ?? 0;
        const curr = s.witnessedCount ?? 0;
        const diff = curr - prev;
        if (diff > 0) {
          totalNew += diff;
          if (diff > topNew) { topNew = diff; topTitle = s.chapterTitle || 'your story'; }
        }
      });
      if (totalNew > 0) setNewWitnessData({ count: totalNew, title: topTitle });
      // Advance snapshot to current counts so next open starts from here
      const next: Record<string, number> = {};
      stories.forEach(s => { next[s.id] = s.witnessedCount ?? 0; });
      return AsyncStorage.setItem(SNAP_KEY, JSON.stringify(next));
    }).catch(() => null);
  }, [stories]);

  // ── Banner anti-stack gate (#13) ───────────────────────────────────────────
  const [bannerGate,    setBannerGate]    = useState(false);
  const [bannerExiting, setBannerExiting] = useState(false);
  const bannerGateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayedRewardId, setDisplayedRewardId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('star_intro_v1').then(val => { if (!val) setShowConstellationIntro(true); });
  }, []);

  // Fetch active event (public endpoint, no auth required)
  useEffect(() => {
    apiFetch<{ event: ActiveEvent | null }>('/events/active')
      .then(d => setActiveEvent(d.event ?? null))
      .catch(() => {});
  }, []);

  // Check dismiss flag when activeEvent changes — always reset to false first
  // so a new day or a new event reliably un-hides the banner.
  useEffect(() => {
    setEventDismissed(false);
    if (!activeEvent) return;
    const today = new Date().toISOString().split('T')[0];
    AsyncStorage.getItem(`event_dismissed_${activeEvent.id}_${today}`)
      .then(val => { setEventDismissed(!!val); })
      .catch(() => {});
  }, [activeEvent?.id]);

  function dismissEvent() {
    if (!activeEvent) return;
    const today = new Date().toISOString().split('T')[0];
    AsyncStorage.setItem(`event_dismissed_${activeEvent.id}_${today}`, '1').catch(() => {});
    setEventDismissed(true);
  }

  // Lock the displayed reward ID during exit + gate — prevents the new reward from
  // remounting and starting its entrance animation before the old one finishes.
  useEffect(() => {
    if (bannerExiting || bannerGate) return;
    const nextId = rewards[0]?.id ?? null;
    setDisplayedRewardId(prev => prev === nextId ? prev : nextId);
  }, [rewards, bannerExiting, bannerGate]);
  const displayedReward = rewards.find(r => r.id === displayedRewardId) ?? rewards[0] ?? null;

  // Auto-dismiss the front reward banner after 4 s (prevents stacking).
  // Star unlock banners are excluded — they self-manage via the drain queue in AppContext.
  const firstReward   = displayedReward;
  const firstRewardId = displayedReward?.id ?? null;
  useEffect(() => {
    if (!firstRewardId || firstReward?.starUnlock) return;
    const timer = setTimeout(() => {
      if (bannerExitTimerRef.current) clearTimeout(bannerExitTimerRef.current);
      setBannerExiting(true);
      const id = firstRewardId;
      bannerExitTimerRef.current = setTimeout(() => {
        dismissReward(id);
        setBannerExiting(false);
        setBannerGate(true);
        if (bannerGateTimerRef.current) clearTimeout(bannerGateTimerRef.current);
        bannerGateTimerRef.current = setTimeout(() => setBannerGate(false), 400);
      }, 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [firstRewardId, firstReward?.starUnlock]);

  async function dismissConstellationIntro() {
    setShowConstellationIntro(false);
    await AsyncStorage.setItem('star_intro_v1', 'done');
  }

  const hour       = new Date().getHours();
  const unread     = serverNotifications.filter(n => !n.isRead).length;
  const hasNotifs  = rewards.length > 0 || unread > 0 || campfireUnread > 0 || dmUnread > 0;
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

  // Unique friends with recent stories (for the story-ring row)
  const circleAuthors = (() => {
    const seen = new Set<string>();
    return circleStories.filter(p => {
      if (seen.has(p.authorUserId)) return false;
      seen.add(p.authorUserId); return true;
    }).slice(0, 10);
  })();

  // Top 3 non-circle posts for the Discover Preview section
  const discoverPreview = useMemo(
    () => discoverPosts.filter(p => !p.isFollowing).slice(0, 3),
    [discoverPosts],
  );

  // ── Activity digest — what changed in the world while you were away ──────────
  const witnessedNotifs   = serverNotifications.filter(n => n.type === 'witness').length;
  const savedNotifs       = serverNotifications.filter(n => n.type === 'save').length;
  const newStoryNotifs    = serverNotifications.filter(n => n.type === 'new_story').length;
  const hasDigest = witnessedNotifs > 0 || savedNotifs > 0 || circleStories.length > 0 || newStoryNotifs > 0;

  const myCampfire: GuideProfile | null = (character.isGuide && clerkUserId) ? {
    userId: clerkUserId, name: character.name || 'Sky Child',
    username: character.username ?? null, bio: character.bio,
    guideBio: character.guideBio ?? '', guideTopics: character.guideTopics ?? [],
    guideAvailability: character.guideAvailability ?? null,
    peaceRating: 0, dreamersGuided: 0, followerCount: friends.length,
    avatarUri: character.avatarUri ?? null, mood: character.mood,
    traits: character.traits ?? [], role: character.role ?? null,
    country: character.country ?? null,
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

  // ── Greeting helpers ─────────────────────────────────────────────────────
  const greetingWord  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 20 ? 'Good evening' : 'Good night';
  const greetingEmoji = hour < 12 ? '☀️' : hour < 17 ? '🌤' : hour < 20 ? '✨' : '🌙';
  const headerSubtitle = (() => {
    if (witnessedNotifs > 0) return `${witnessedNotifs} soul${witnessedNotifs > 1 ? 's' : ''} witnessed your story`;
    if (circleStories.length > 0) return `${circleStories.length} new ${circleStories.length === 1 ? 'story' : 'stories'} from your circle`;
    if (liveCampfireCount > 0) return `${liveCampfireCount} campfire${liveCampfireCount > 1 ? 's' : ''} burning right now`;
    if (hour < 12) return 'What will today hold?';
    if (hour < 17) return 'The afternoon sky is yours';
    if (hour < 20) return 'Take a deep breath and reflect.';
    return 'A perfect time to write something';
  })();

  return (
    <Animated.View style={[s.root, { opacity: fadeIn }]}>
      {/* ── Deep space void ── */}
      <LinearGradient
        colors={['#100A28', '#08061A', '#04030C']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        pointerEvents="none"
      />
      <StarField density="high" />

      {/* ── Reward banner — one at a time, anti-stack gate ── */}
      {!bannerGate && displayedReward && (
        <View style={{ position: 'absolute', top: topPad + 8, left: 16, right: 16, zIndex: 999 }} pointerEvents="box-none">
          <RewardBanner
            key={displayedReward.id}
            reward={displayedReward}
            isExiting={bannerExiting}
            onDismiss={() => {
              if (bannerExiting) return;
              const id = displayedReward.id;
              if (bannerExitTimerRef.current) clearTimeout(bannerExitTimerRef.current);
              setBannerExiting(true);
              bannerExitTimerRef.current = setTimeout(() => {
                dismissReward(id);
                setBannerExiting(false);
                setBannerGate(true);
                if (bannerGateTimerRef.current) clearTimeout(bannerGateTimerRef.current);
                bannerGateTimerRef.current = setTimeout(() => setBannerGate(false), 400);
              }, 300);
            }}
          />
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >

        {/* ════════════════════════════════════════════════
            HEADER — greeting + stats chips
        ════════════════════════════════════════════════ */}
        <View style={[s.hero, { paddingTop: topPad + 6 }]}>
          {/* ── Base mood nebula ── */}
          <LinearGradient
            colors={[`${accent}30`, grad[0], grad[1], '#04030C'] as unknown as [string, string, ...string[]]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          {/* ── Cross-nebula shimmer ── */}
          <LinearGradient
            colors={[`${accent}1A`, 'transparent', 'rgba(96,180,248,0.10)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
            pointerEvents="none"
          />
          {/* ── Micro star field inside hero ── */}
          <StarField density="low" />
          {/* ── Accent pinstripe — top edge ── */}
          <LinearGradient
            colors={[accent, '#A880F8', 'transparent']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, opacity: 0.55 }}
            pointerEvents="none"
          />

          {/* ── Top bar: icons + avatar on the right ── */}
          <View style={[s.heroBar, { justifyContent: 'flex-end' }]}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => { router.push('/messages' as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={s.heroBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="message-circle" size={16} color={dmUnread > 0 ? '#9B78E8' : 'rgba(220,210,255,0.75)'} />
                {dmUnread > 0 && (
                  <View style={[s.heroBadge, { backgroundColor: '#9B78E8', width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 8, fontFamily: 'Satoshi-Bold', color: '#fff', lineHeight: 10 }}>{dmUnread > 9 ? '9+' : dmUnread}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setShowNotifs(true); markServerNotificationsRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                style={s.heroBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="bell" size={16} color="rgba(220,210,255,0.75)" />
                {hasNotifs && <View style={[s.heroBadge, { backgroundColor: accent }]} />}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                style={s.heroBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="settings" size={16} color="rgba(220,210,255,0.75)" />
              </TouchableOpacity>
              {/* Small avatar circle */}
              <TouchableOpacity
                style={s.heroAvatarSmallWrap}
                onPress={() => router.push('/(tabs)/profile')}
                onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOutfits(true); }}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[accent, '#A880F8', '#60C8F8', accent]}
                  style={s.heroAvatarSmallRing}
                  start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
                >
                  <View style={s.heroAvatarSmallInner}>
                    <Image source={imgSrc} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </View>
                </LinearGradient>
                {character.role && (
                  <View style={[s.roleTag, { backgroundColor: accent }]}>
                    <Text style={s.roleText}>{character.role.slice(0, 1)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Greeting block: big text + subtitle + stat pills ── */}
          <View style={s.heroGreetBlock}>
            <Text style={s.heroGreetText}>
              {greetingWord}, {character.name || 'Sky Child'} {greetingEmoji}
            </Text>
            <Text style={s.heroGreetSub}>{headerSubtitle}</Text>
            <View style={s.heroPillRow}>
              {constellation && constellation.quietStreak > 0 && (
                <TouchableOpacity
                  style={s.heroPillFire}
                  onPress={() => router.push('/(tabs)/profile')}
                  activeOpacity={0.78}
                >
                  <Text style={{ fontSize: 12, lineHeight: 15 }}>🔥</Text>
                  <Text style={s.heroPillTxt}>{constellation.quietStreak} day streak</Text>
                </TouchableOpacity>
              )}
              {rewardBalance && (
                <TouchableOpacity
                  style={s.heroPillStar}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowShop(true); }}
                  activeOpacity={0.78}
                >
                  <Text style={{ fontSize: 12, lineHeight: 15 }}>⭐</Text>
                  <Text style={s.heroPillTxt}>{rewardBalance.stars}/6 stars</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Bottom fade to deep void */}
          <LinearGradient
            colors={['transparent', '#04030C']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 36 }}
            pointerEvents="none"
          />
        </View>

        {/* ══════════════════════════════════════════════════
            LUMI — featured companion card (top of feed)
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s0, transform: [{ translateY: s0.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
        <TouchableOpacity
          style={s.lumiCard}
          onPress={() => { if (hasNotifs) { setShowNotifs(true); markServerNotificationsRead(); } else router.push('/(tabs)/create'); }}
          activeOpacity={0.88}
        >
          <LinearGradient colors={['#1E0E48', '#100828', '#080518']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -24, left: -20, right: -20, height: 90, backgroundColor: 'rgba(80,60,160,0.22)', borderRadius: 45 }} />
          <View pointerEvents="none" style={[s.lumiOrb1, { backgroundColor: accent }]} />
          <View pointerEvents="none" style={s.lumiOrb2} />
          {[{top:12,left:20},{top:6,left:'58%'},{top:20,right:16},{top:36,left:'36%'},{bottom:14,left:48},{bottom:10,right:'26%'}].map((pos,i)=>(
            <View key={i} pointerEvents="none" style={[s.lumiStar, pos as any, { opacity: 0.15 + (i % 3) * 0.10 }]} />
          ))}
          <Image source={Images.character_default} style={s.lumiCharImg} contentFit="contain" />
          <View style={[s.lumiContent, { paddingRight: 110 }]}>
            <View style={s.lumiEyebrow}>
              <Text style={{ fontSize: 10, lineHeight: 13, color: 'rgba(200,185,255,0.60)' }}>✦</Text>
              <Text style={[s.lumiEyebrowTxt, { color: 'rgba(200,185,255,0.65)' }]}>LUMI</Text>
              {hasNotifs && (
                <View style={[s.lumiPill, { backgroundColor: `${accent}20`, borderColor: `${accent}45`, marginLeft: 8 }]}>
                  <Text style={[s.lumiPillTxt, { color: accent }]}>
                    {witnessedNotifs > 0 ? `${witnessedNotifs} witnessed you` : savedNotifs > 0 ? `${savedNotifs} saved your work` : `${rewards.length + unread} new`}
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.lumiTitle}>
              {`Continue your\n${greetingWord === 'Good morning' ? 'morning' : greetingWord === 'Good afternoon' ? 'afternoon' : greetingWord === 'Good evening' ? 'evening' : 'night'} journey`}
            </Text>
            <Text style={s.lumiMsgV2}>
              {lumiAwareness(character.name, witnessedNotifs, savedNotifs, circleStories.length, liveCampfireCount, journalEntries, stories, hour, constellation, rewardBalance)}
            </Text>
            <TouchableOpacity style={s.lumiCTABtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/create'); }} activeOpacity={0.84}>
              <Text style={s.lumiCTATxt}>Begin something  →</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            WITNESS SUMMARY CARD — delta-based: only if count rose since last open
        ══════════════════════════════════════════════════ */}
        {newWitnessData && (
          <Animated.View style={{ opacity: s1, transform: [{ translateY: s1.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
            <WitnessSummaryCard
              count={newWitnessData.count}
              storyTitle={newWitnessData.title}
              onPress={() => {
                setNewWitnessData(null);
                setShowNotifs(true);
                markServerNotificationsRead();
              }}
            />
          </Animated.View>
        )}

        {/* ══════════════════════════════════════════════════
            ACTIVITY DIGEST — what changed while you were away
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s1, transform: [{ translateY: s1.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        {hasDigest && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.digestRow}>
            {witnessedNotifs > 0 && (
              <TouchableOpacity style={[s.digestPill, { backgroundColor: 'rgba(200,168,75,0.14)' }]} onPress={() => { setShowNotifs(true); markServerNotificationsRead(); }} activeOpacity={0.78}>
                <Icon name="eye" size={13} color="#C8A84B" /><Text style={[s.digestTxt, { color: '#C8A84B' }]}>{witnessedNotifs} witnessed you</Text>
              </TouchableOpacity>
            )}
            {savedNotifs > 0 && (
              <TouchableOpacity style={[s.digestPill, { backgroundColor: 'rgba(168,128,248,0.14)' }]} onPress={() => { setShowNotifs(true); markServerNotificationsRead(); }} activeOpacity={0.78}>
                <Icon name="bookmark" size={13} color="#A880F8" /><Text style={[s.digestTxt, { color: '#A880F8' }]}>{savedNotifs} saved your work</Text>
              </TouchableOpacity>
            )}
            {circleStories.length > 0 && (
              <TouchableOpacity style={[s.digestPill, { backgroundColor: 'rgba(96,200,248,0.14)' }]} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.78}>
                <Icon name="book-open" size={13} color="#60C8F8" /><Text style={[s.digestTxt, { color: '#60C8F8' }]}>{circleStories.length} new {circleStories.length === 1 ? 'story' : 'stories'}</Text>
              </TouchableOpacity>
            )}
            {liveCampfireCount > 0 && (
              <TouchableOpacity style={[s.digestPill, { backgroundColor: 'rgba(232,164,80,0.14)' }]} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.78}>
                <Text style={{ fontSize: 13, lineHeight: 16 }}>🔥</Text><Text style={[s.digestTxt, { color: '#E8A450' }]}>{liveCampfireCount} campfire{liveCampfireCount > 1 ? 's' : ''} live</Text>
              </TouchableOpacity>
            )}
            {newStoryNotifs > 0 && witnessedNotifs === 0 && savedNotifs === 0 && (
              <TouchableOpacity style={[s.digestPill, { backgroundColor: 'rgba(96,200,168,0.14)' }]} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.78}>
                <Icon name="users" size={13} color="#60C8A8" /><Text style={[s.digestTxt, { color: '#60C8A8' }]}>{newStoryNotifs} circle update{newStoryNotifs > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            YOUR CIRCLE — avatar rail + recent stories
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s2, transform: [{ translateY: s2.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        <View style={s.section}>
          <SectionHeader label="Your Circle" accent={accent} count={circleStories.length} onPress={() => router.push('/(tabs)/discover')} action={circleStories.length > 0 ? 'See all' : undefined} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[fr.row, { paddingHorizontal: 16, marginBottom: 14 }]}>
            <TouchableOpacity style={fr.addWrap} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/discover'); }} activeOpacity={0.80}>
              <View style={fr.addCircle}><Icon name="plus" size={20} color="rgba(180,160,255,0.70)" /></View>
              <Text style={fr.addLabel}>Add</Text>
            </TouchableOpacity>
            {circleAuthors.map(post => <FriendBubble key={post.authorUserId} post={post} />)}
          </ScrollView>
          {circleStories.length > 0 ? (
            <>
              <Text style={s.circleRecentLabel}>Recent from your circle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
                {circleStories.slice(0, 5).map(post => {
                  const mc = MOOD_COLOR[post.mood] ?? '#7B6BAA';
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(post.date).getTime();
                    const h = Math.floor(diff / 3600000);
                    if (h < 1) return 'just now';
                    if (h < 24) return `${h}h ago`;
                    return `${Math.floor(h / 24)}d ago`;
                  })();
                  return (
                    <TouchableOpacity key={post.id} style={s.circleRecentCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/story/[id]', params: { id: post.id } } as any); }} activeOpacity={0.82}>
                      <View style={[s.circleRecentAvatar, { backgroundColor: `${mc}20`, borderColor: `${mc}40` }]}>
                        {post.authorAvatarUri
                          ? <Image source={{ uri: post.authorAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                          : <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: mc }}>{post.authorName.charAt(0).toUpperCase()}</Text>
                        }
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.circleRecentAuthor} numberOfLines={1}>{post.authorHandle ? `@${post.authorHandle}` : post.authorName} shared</Text>
                        <Text style={s.circleRecentTitle} numberOfLines={1}>{post.chapterTitle || 'Untitled'}</Text>
                        <Text style={s.circleRecentTime}>{timeAgo}</Text>
                      </View>
                      {post.imageUri
                        ? <Image source={{ uri: post.imageUri }} style={s.circleRecentThumb} contentFit="cover" cachePolicy="memory-disk" />
                        : <View style={[s.circleRecentThumb, { backgroundColor: `${mc}20` }]} />
                      }
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <TouchableOpacity style={s.emptyStories} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.8}>
              <Text style={s.emptyStoriesText}>No stories from your circle yet</Text>
              <Text style={s.emptyStoriesSub}>Find people in Discover →</Text>
            </TouchableOpacity>
          )}
        </View>
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            CAMPFIRE TONIGHT — community campfire banner
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s3, transform: [{ translateY: s3.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
        <TouchableOpacity style={s.campfireBanner} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/campfire' as any); }} activeOpacity={0.82}>
          <LinearGradient colors={['rgba(180,90,20,0.28)', 'rgba(100,45,8,0.18)', 'rgba(20,10,4,0.12)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -28, right: 70, width: 110, height: 110, borderRadius: 55, backgroundColor: '#E87828', opacity: 0.14 }} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <Text style={{ fontSize: 14, lineHeight: 18 }}>🔥</Text>
              <Text style={s.campfireBannerEyebrow}>Campfire Tonight</Text>
            </View>
            <Text style={s.campfireBannerTitle}>Whisper Campfire</Text>
            <Text style={s.campfireBannerSub}>{liveCampfireCount > 0 ? `${liveCampfireCount} live now · Come gather` : 'Gather · Whisper · Wander'}</Text>
          </View>
          <View style={s.campfireJoinBtn}>
            <Text style={s.campfireJoinTxt}>Join Campfire</Text>
          </View>
        </TouchableOpacity>
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            DAILY SPARK — rotating daily writing prompt
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s0, transform: [{ translateY: s0.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
          <DailyInvitation
            userMood={character.mood}
            onWrite={(prompt, mood) => router.push({
              pathname: '/create-journal-entry',
              params: { initialPrompt: prompt, initialMood: mood },
            } as any)}
          />
        </Animated.View>

        {/* ══════════════════════════════════════════════════
            STATS GRID — constellation + season side by side
        ══════════════════════════════════════════════════ */}
        <Animated.View style={{ opacity: s0, transform: [{ translateY: s0.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
          <View style={s.statsGrid}>
            {constellation && (
              <TouchableOpacity style={s.statsGridCard} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.85}>
                <LinearGradient colors={['rgba(168,136,248,0.14)', 'rgba(96,168,248,0.06)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Text style={s.statsGridLabel}>Your Constellation</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginVertical: 8 }}>
                  {MINI_STARS.map(star => (
                    <View key={star.key} style={[s.statsGridStar, { backgroundColor: constellation.unlockedStars.includes(star.key) ? star.color : 'rgba(255,255,255,0.09)' }]} />
                  ))}
                </View>
                {nextStar && (
                  <>
                    <Text style={[s.statsGridSub, { color: nextStar.color }]}>{nextStar.label} Star</Text>
                    <View style={s.statsGridTrack}>
                      <View style={[s.statsGridFill, { width: `${Math.round(nextStarPct * 100)}%` as any, backgroundColor: nextStar.color }]} />
                    </View>
                    <Text style={s.statsGridHint}>{nextStarCount < nextStar.threshold ? `${nextStar.threshold - nextStarCount} more ${nextStar.unit}` : 'Ready!'}</Text>
                  </>
                )}
                <Text style={s.statsGridCTA}>Continue Journey →</Text>
              </TouchableOpacity>
            )}
            {(() => {
              const month = new Date().getMonth();
              const sd    = SEASON_BY_MONTH[month]!;
              const th    = activeEvent ? (EVENT_THEME[activeEvent.theme] ?? null) : null;
              const color = th?.color ?? sd.color;
              const icon  = th?.icon  ?? sd.icon;
              const name  = activeEvent?.title ?? sd.name;
              const bgA   = th ? th.bgStart : sd.bgA;
              const bgB   = th ? th.bgEnd   : sd.bgB;
              const end   = new Date(); end.setMonth(sd.endMonth, 1); end.setHours(0,0,0,0);
              if (end <= new Date()) end.setFullYear(end.getFullYear() + 1);
              const daysLeft = Math.max(1, Math.ceil((end.getTime() - Date.now()) / 86400000));
              const stars = constellation?.unlockedStars.length ?? 0;
              const pct   = stars / 6;
              return (
                <TouchableOpacity style={s.statsGridCard} onPress={() => activeEvent ? setShowEventSheet(true) : router.push('/(tabs)/profile')} activeOpacity={0.84}>
                  <LinearGradient colors={[bgA, bgB, 'transparent'] as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Text style={{ fontSize: 13 }}>{icon}</Text>
                    <Text style={{ fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 1.1, color, textTransform: 'uppercase' as const }}>Current Season</Text>
                  </View>
                  <View style={[s.statsGridPill, { backgroundColor: `${color}1E` }]}>
                    <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Medium', color }}>{daysLeft}d left</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#EEE8FF', letterSpacing: 0.1, marginVertical: 8, lineHeight: 20 }} numberOfLines={2}>{name}</Text>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginBottom: 5 }}>
                    <View style={{ height: 4, borderRadius: 2, width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }} />
                  </View>
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Medium', color: `${color}AA`, marginBottom: 8 }}>{stars}/6 stars collected</Text>
                  <View style={[s.statsGridCTAPill, { borderColor: `${color}45` }]}>
                    <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Medium', color, letterSpacing: 0.3 }}>Continue Journey →</Text>
                  </View>
                </TouchableOpacity>
              );
            })()}
          </View>
        </Animated.View>

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
            ACTIVE EVENT BANNER
        ══════════════════════════════════════════════════ */}
        {activeEvent && !eventDismissed && (
          <Animated.View style={{ opacity: s0, transform: [{ translateY: s0.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
            <EventBanner
              event={activeEvent}
              onPress={() => setShowEventSheet(true)}
              onDismiss={dismissEvent}
            />
          </Animated.View>
        )}


        {/* ══════════════════════════════════════════════════
            CONTINUE JOURNEY — next star nudge
        ══════════════════════════════════════════════════ */}
        {nextStar && (
          <Animated.View style={{ opacity: s7, transform: [{ translateY: s7.interpolate({ inputRange: [0,1], outputRange: [14,0] }) }] }}>
          <TouchableOpacity style={s.nudgeCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/profile'); }} activeOpacity={0.85}>
            <LinearGradient colors={[`${nextStar.color}1A`, `${nextStar.color}08`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={[s.nudgeOrb, { backgroundColor: nextStar.color }]} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={[s.nudgeEyebrow, { color: nextStar.color }]}>NEXT STAR</Text>
                <View style={[s.nudgeDot, { backgroundColor: nextStar.color }]} />
                <Text style={[s.nudgeEyebrow, { color: nextStar.color }]}>{nextStar.label}</Text>
              </View>
              <View style={s.nudgeTrack}><View style={[s.nudgeFill, { width: `${Math.round(nextStarPct * 100)}%` as any, backgroundColor: nextStar.color }]} /></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                <Text style={s.nudgeAction}>{nextStar.action}</Text>
                <Text style={[s.nudgeFraction, { color: nextStar.color }]}>{nextStarCount} / {nextStar.threshold} {nextStar.unit}</Text>
              </View>
              {nextStar.key === 'creative' && stories.length > 0 && (
                <Text style={s.nudgePublicNote}>{publicStoryCount} of {stories.length} {stories.length === 1 ? 'story is' : 'stories are'} public</Text>
              )}
              <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: nextStar.color, marginTop: 7, letterSpacing: 0.4 }}>Continue Journey →</Text>
            </View>
          </TouchableOpacity>
          </Animated.View>
        )}

        {constellation && constellation.unlockedStars.length === 6 && (
          <Animated.View style={{ opacity: s7, transform: [{ translateY: s7.interpolate({ inputRange: [0,1], outputRange: [14,0] }) }] }}>
          <TouchableOpacity style={s.nudgeCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/profile'); }} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(168,136,248,0.12)', 'rgba(96,200,248,0.08)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={{ flex: 1 }}>
              <Text style={[s.nudgeEyebrow, { color: '#A888F8', marginBottom: 3 }]}>CONSTELLATION COMPLETE</Text>
              <Text style={{ fontSize: 13, color: 'rgba(220,210,255,0.80)', fontWeight: '500', letterSpacing: 0.1 }}>✦ ✦ ✦ ✦ ✦ ✦{'  '}All six stars glow in your sky</Text>
            </View>
            <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.28)" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          </Animated.View>
        )}

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
            EXPLORE — trending discover preview
        ══════════════════════════════════════════════════ */}
        {discoverPreview.length > 0 && (
          <Animated.View style={{ opacity: s5, transform: [{ translateY: s5.interpolate({ inputRange: [0,1], outputRange: [18,0] }) }] }}>
          <View style={s.section}>
            <SectionHeader label="Explore" accent="#60C8F8" onPress={() => router.push('/(tabs)/discover')} action="See all" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 4 }}>
              {discoverPreview.map(post => {
                const mc = MOOD_COLOR[post.mood] ?? '#7B6BAA';
                return (
                  <TouchableOpacity key={post.id} style={s.exploreCard} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/story/[id]', params: { id: post.id } } as any); }} activeOpacity={0.82}>
                    {post.imageUri
                      ? <Image source={{ uri: post.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                      : <LinearGradient colors={[`${mc}60`, `${mc}28`, '#06040E']} style={StyleSheet.absoluteFill} />
                    }
                    <LinearGradient colors={['transparent', 'rgba(4,3,18,0.94)']} style={s.exploreCardGrad} pointerEvents="none" />
                    <View style={s.exploreCardMeta}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <View style={[s.exploreCardMoodDot, { backgroundColor: mc }]} />
                        <Text style={[s.exploreCardMood, { color: mc }]}>{post.mood}</Text>
                      </View>
                      <Text style={s.exploreCardTitle} numberOfLines={2}>{post.chapterTitle || 'Untitled'}</Text>
                      <Text style={s.exploreCardAuthor} numberOfLines={1}>{post.witnessedCount > 0 ? `${post.witnessedCount} witnessed` : post.authorName}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
          </Animated.View>
        )}

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
            {rewards.length === 0 && serverNotifications.length === 0 && campfireUnread === 0 && dmUnread === 0 ? (
              <View style={m.empty}>
                <Icon name="bell-off" size={28} color={`${colors.mutedForeground}60`} />
                <Text style={[m.emptyTxt, { color: colors.mutedForeground }]}>All caught up ✦</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
                {unreadDmThreads.map(thread => (
                  <TouchableOpacity
                    key={thread.partnerId}
                    style={[m.notif, { backgroundColor: 'rgba(107,91,149,0.12)', borderColor: 'rgba(107,91,149,0.30)', borderWidth: 1 }]}
                    onPress={() => {
                      markDmThreadRead(thread.partnerId);
                      setShowNotifs(false);
                      setTimeout(() => router.push(`/messages/${thread.partnerId}?name=${encodeURIComponent(thread.partnerName)}${thread.partnerHandle ? `&handle=${encodeURIComponent(thread.partnerHandle)}` : ''}` as any), 260);
                    }}
                    activeOpacity={0.78}
                  >
                    <View style={[m.notifIcon, { backgroundColor: 'rgba(107,91,149,0.18)' }]}>
                      <Icon name="message-circle" size={13} color="#9B78E8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.notifTitle, { color: colors.foreground }]} numberOfLines={1}>
                        Message from {thread.partnerName}
                      </Text>
                      <Text style={[m.notifSub, { color: colors.mutedForeground }]}>
                        {thread.partnerHandle ? `@${thread.partnerHandle}` : 'Tap to read'}
                      </Text>
                    </View>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#9B78E8' }} />
                    <Icon name="chevron-right" size={13} color="rgba(107,91,149,0.55)" />
                  </TouchableOpacity>
                ))}
                {unreadCampfireRooms.map(room => (
                  <TouchableOpacity
                    key={room.id}
                    style={[m.notif, { backgroundColor: 'rgba(120,216,160,0.10)', borderColor: 'rgba(120,216,160,0.28)', borderWidth: 1 }]}
                    onPress={() => { setShowNotifs(false); setTimeout(() => router.push(`/campfire/${room.id}` as any), 260); }}
                    activeOpacity={0.78}
                  >
                    <View style={[m.notifIcon, { backgroundColor: 'rgba(120,216,160,0.15)' }]}>
                      <Icon name="message-circle" size={13} color="#78D8A0" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.notifTitle, { color: colors.foreground }]} numberOfLines={1}>New whisper in {room.name}</Text>
                      <Text style={[m.notifSub, { color: colors.mutedForeground }]}>Tap to join the fire</Text>
                    </View>
                    <Icon name="chevron-right" size={13} color="rgba(120,216,160,0.55)" />
                  </TouchableOpacity>
                ))}
                {serverNotifications.map(n => (
                  <View key={n.id} style={[m.notif, { backgroundColor: n.isRead ? colors.muted : `${accent}14`, borderColor: n.isRead ? 'transparent' : `${accent}28` }]}>
                    <View style={[m.notifIcon, { backgroundColor: `${accent}18` }]}>
                      <Icon name={n.type === 'witness' ? 'eye' : n.type === 'save' ? 'bookmark' : n.type === 'new_story' ? 'book-open' : n.type === 'resonate' ? 'activity' : 'star'} size={13} color={accent} />
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

      {/* ── Event Detail Sheet ───────────────────────────────────────────── */}
      {activeEvent && (
        <EventDetailSheet
          event={activeEvent}
          visible={showEventSheet}
          onClose={() => setShowEventSheet(false)}
          onCreateStory={(prompt, mood) => {
            setShowEventSheet(false);
            setTimeout(() => router.push({
              pathname: '/(tabs)/create',
              params: { eventPrompt: prompt, eventMood: mood },
            } as any), 260);
          }}
        />
      )}

      <ShopModal visible={showShop} onClose={() => setShowShop(false)} />

    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04030C' },

  // ── Hero — compact identity card ───────────────────────────────────────────
  hero:        { paddingHorizontal: 0, paddingBottom: 0, overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36, marginBottom: 6 },

  // Top bar: label left, buttons right
  heroBar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginBottom: 10 },
  heroAppLabel:{ fontSize: 9.5, fontFamily: 'Satoshi-Bold', letterSpacing: 2.2, color: 'rgba(200,184,232,0.35)', textTransform: 'uppercase' },
  heroBtn:     { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 16.5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  heroBadge:   { position: 'absolute', top: 7, right: 7, width: 6.5, height: 6.5, borderRadius: 3.5 },

  // Identity row: avatar left, info right
  heroIdentityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  heroAvatarWrap:  { position: 'relative', width: 72, height: 72, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroAvatarRing:  { width: 62, height: 62, borderRadius: 31, padding: 2 },
  heroAvatarInner: { flex: 1, borderRadius: 29, overflow: 'hidden', backgroundColor: '#060412' },
  roleTag:         { position: 'absolute', bottom: 2, right: 2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#04030C' },
  roleText:        { fontSize: 8, fontFamily: 'Satoshi-Bold', color: '#fff' },

  // Info column (right of avatar)
  heroInfoCol:    { flex: 1, gap: 4 },
  heroName:       { fontSize: 19, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.97)', letterSpacing: -0.5, lineHeight: 23 },
  heroSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  heroHandle:     { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.36)' },
  moodDot:        { width: 5, height: 5, borderRadius: 2.5 },
  heroMood:       { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  heroBioRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroRole:       { fontSize: 10.5, fontFamily: 'Satoshi-Regular' },

  // Compact inline stats (below name/mood)
  heroStatInlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 1 },
  heroStatDot:       { fontSize: 9, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.20)' },
  heroStatInline:    { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(190,175,230,0.38)' },
  heroStatInlineN:   { fontSize: 10.5, fontFamily: 'Satoshi-Bold', color: 'rgba(225,215,255,0.65)' },

  // Quick action pills row
  heroActionRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingBottom: 14, flexWrap: 'wrap' },
  heroActionPill:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, borderWidth: 1 },
  heroActionTxt: { fontSize: 11.5, fontFamily: 'Satoshi-Bold' },

  // Kept for legacy references (unused by new hero)
  heroActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, paddingHorizontal: 20, marginBottom: 12 },
  heroCenter:  { alignItems: 'center', paddingHorizontal: 28, paddingBottom: 22, gap: 8 },
  avatarWrap:   { position: 'relative', marginBottom: 8, width: 108, height: 108, alignItems: 'center', justifyContent: 'center' },
  avatarOrbit3: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1 },
  avatarRing:   { width: 96, height: 96, borderRadius: 48, padding: 3 },
  avatarInner:  { flex: 1, borderRadius: 45, overflow: 'hidden', backgroundColor: '#060412' },
  heroGreeting: { fontSize: 16, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(220,205,255,0.60)', textAlign: 'center', lineHeight: 23, marginTop: 4, marginBottom: 2, paddingHorizontal: 10 },
  heroCTA:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 26, paddingVertical: 13, borderRadius: 28, borderWidth: 1, overflow: 'hidden', marginTop: 4 },
  heroCTAText: { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  statBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 16, paddingHorizontal: 8, marginHorizontal: 20, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 16, elevation: 6 },
  statItem: { alignItems: 'center', gap: 4, flex: 1 },
  statN:    { fontSize: 24, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.96)', letterSpacing: -1.0 },
  statL:    { fontSize: 9.5, fontFamily: 'Satoshi-Medium', color: 'rgba(200,180,255,0.38)', letterSpacing: 0.8, textTransform: 'uppercase' },
  statSep:  { width: 0.5, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },

  // ── Sections ───────────────────────────────────────────────────────────────
  section:     { paddingVertical: 10 },
  sectionRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  // Mixed-case editorial label — softer hierarchy signal
  sectionLabel:{ fontSize: 9.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3, color: 'rgba(200,185,240,0.32)', flex: 1, paddingHorizontal: 20 },
  sectionAll:  { fontSize: 11.5, fontFamily: 'Satoshi-Medium' },

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

  // ── Lumi companion card — immersive night-sky design ─────────────────────
  lumiCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 4,
    borderRadius: 26, overflow: 'hidden',
    backgroundColor: '#0A0618',
    borderWidth: 1, borderColor: 'rgba(155,120,255,0.13)',
    shadowColor: '#5820C0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 26, elevation: 10,
    minHeight: 130,
  },
  lumiContent:    { padding: 17, paddingTop: 16 },
  lumiOrb1:       { position: 'absolute', top: -48, right: -38, width: 170, height: 170, borderRadius: 85, opacity: 0.12 },
  lumiOrb2:       { position: 'absolute', bottom: -28, left: -28, width: 130, height: 130, borderRadius: 65, opacity: 0.07, backgroundColor: '#2A60C8' },
  lumiStar:       { position: 'absolute', width: 2, height: 2, borderRadius: 2, backgroundColor: '#E8DCFF' },
  lumiEyebrow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  lumiDot:        { width: 5, height: 5, borderRadius: 2.5 },
  lumiEyebrowTxt: { fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 2.5 },
  lumiPill:       { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 18, borderWidth: 1 },
  lumiPillTxt:    { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  lumiMsgV2:      { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(230,220,255,0.68)', lineHeight: 21, letterSpacing: -0.1 },
  lumiHint:       { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(180,160,240,0.26)', marginTop: 11, letterSpacing: 0.4 },

  // ── Star journey nudge card ────────────────────────────────────────────────
  nudgeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 4, marginBottom: 3,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.050)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 4,
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
  digestRow:   { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingBottom: 14 },
  digestPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  digestTxt:   { fontSize: 12, fontFamily: 'Satoshi-Medium' },

  // ── Find Friends — ambient, at bottom ─────────────────────────────────────
  findFriends:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, marginTop: 3, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.016)', borderWidth: 1, borderColor: 'rgba(96,200,168,0.10)' },
  findFriendsIcon:  { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(96,200,168,0.10)', alignItems: 'center', justifyContent: 'center' },
  findFriendsTitle: { fontSize: 12.5, fontFamily: 'Satoshi-Bold', color: 'rgba(180,225,208,0.75)' },
  findFriendsSub:   { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(120,170,150,0.42)', marginTop: 1 },
  findFriendsBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 11, backgroundColor: 'rgba(96,200,168,0.10)', borderWidth: 1, borderColor: 'rgba(96,200,168,0.18)' },
  findFriendsBadgeText: { fontSize: 10.5, fontFamily: 'Satoshi-Bold', color: 'rgba(94,200,160,0.80)' },
  communityFire:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, marginTop: 3, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(184,120,255,0.12)' },
  communityFireIcon:  { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(184,120,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  communityFireTitle: { fontSize: 12.5, fontFamily: 'Satoshi-Bold', color: 'rgba(220,200,255,0.82)' },
  communityFireSub:   { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(180,150,220,0.42)', marginTop: 1 },

  // ── Hero redesign styles ──────────────────────────────────────────────────
  heroAvatarSmallWrap:  { position: 'relative', marginLeft: 4 },
  heroAvatarSmallRing:  { width: 36, height: 36, borderRadius: 18, padding: 1.5 },
  heroAvatarSmallInner: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#0E0B28' },
  heroGreetBlock:  { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  heroGreetText:   { fontSize: 26, fontFamily: 'Satoshi-Bold', color: 'rgba(242,232,255,0.97)', letterSpacing: -1.0, lineHeight: 31, marginBottom: 4 },
  heroGreetSub:    { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,185,255,0.38)', lineHeight: 17, marginBottom: 12 },
  heroPillRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  heroPillFire:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18, backgroundColor: 'rgba(232,120,40,0.11)', borderWidth: 1, borderColor: 'rgba(232,120,40,0.20)' },
  heroPillStar:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18, backgroundColor: 'rgba(200,168,75,0.11)', borderWidth: 1, borderColor: 'rgba(200,168,75,0.20)' },
  heroPillTxt:     { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(235,218,195,0.68)', letterSpacing: 0.1 },

  // ── LUMI card enhanced styles ─────────────────────────────────────────────
  lumiCharImg:  { position: 'absolute', bottom: 0, right: -4, width: 118, height: 140 },
  lumiTitle:    { fontSize: 21, fontFamily: 'Satoshi-Bold', color: 'rgba(242,232,255,0.97)', letterSpacing: -0.7, lineHeight: 26, marginBottom: 5 },
  lumiCTABtn:   { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(168,136,248,0.16)', borderWidth: 1, borderColor: 'rgba(168,136,248,0.28)' },
  lumiCTATxt:   { fontSize: 11.5, fontFamily: 'Satoshi-Bold', color: 'rgba(210,185,255,0.82)', letterSpacing: 0.3 },

  // ── Your Circle compact recent cards ─────────────────────────────────────
  circleRecentLabel:  { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(180,165,230,0.30)', marginLeft: 20, marginBottom: 7 },
  circleRecentCard:   { flexDirection: 'row', alignItems: 'center', gap: 9, width: 210, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.022)', borderWidth: 1, borderColor: 'rgba(200,185,255,0.065)' },
  circleRecentAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  circleRecentAuthor: { fontSize: 9.5, fontFamily: 'Satoshi-Regular', color: 'rgba(180,165,230,0.35)', marginBottom: 1 },
  circleRecentTitle:  { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.86)', letterSpacing: -0.2 },
  circleRecentTime:   { fontSize: 9, fontFamily: 'Satoshi-Regular', color: 'rgba(160,145,210,0.28)', marginTop: 2 },
  circleRecentThumb:  { width: 34, height: 34, borderRadius: 10, flexShrink: 0, overflow: 'hidden' },

  // ── Campfire Tonight banner ───────────────────────────────────────────────
  campfireBanner:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 6, marginTop: 3, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(200,120,50,0.16)', backgroundColor: 'rgba(8,4,16,0.70)' },
  campfireBannerEyebrow: { fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 2.0, textTransform: 'uppercase', color: 'rgba(232,164,80,0.55)' },
  campfireBannerTitle:   { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(248,228,205,0.96)', letterSpacing: -0.4, lineHeight: 20 },
  campfireBannerSub:     { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(220,185,150,0.40)', marginTop: 2, lineHeight: 15 },
  campfireJoinBtn:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(200,120,40,0.16)', borderWidth: 1, borderColor: 'rgba(200,120,40,0.28)', flexShrink: 0 },
  campfireJoinTxt:       { fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(248,205,145,0.85)', letterSpacing: 0.3 },

  // ── Stats grid (constellation + season side by side) ─────────────────────
  statsGrid:     { flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingBottom: 8, paddingTop: 3 },
  statsGridCard: { flex: 1, borderRadius: 22, overflow: 'hidden', padding: 13, backgroundColor: 'rgba(255,255,255,0.022)', borderWidth: 1, borderColor: 'rgba(200,185,255,0.065)', minHeight: 148 },
  statsGridLabel:{ fontSize: 8, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(200,185,255,0.35)', marginBottom: 2 },
  statsGridStar: { width: 8, height: 8, borderRadius: 4 },
  statsGridSub:  { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3, marginBottom: 4 },
  statsGridTrack:{ height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 3 },
  statsGridFill: { height: 2.5, borderRadius: 2 },
  statsGridHint: { fontSize: 9.5, fontFamily: 'Satoshi-Regular', color: 'rgba(180,165,230,0.35)', marginBottom: 10 },
  statsGridCTA:  { fontSize: 10.5, fontFamily: 'Satoshi-Bold', color: 'rgba(180,160,240,0.48)', letterSpacing: 0.3, marginTop: 'auto' as any },
  statsGridPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 6 },
  statsGridCTAPill:{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, marginTop: 'auto' as any },

  // ── Explore horizontal cards ──────────────────────────────────────────────
  exploreCard:      { width: 124, height: 178, borderRadius: 20, overflow: 'hidden', backgroundColor: '#0A0618', position: 'relative' },
  exploreCardGrad:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
  exploreCardMeta:  { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 11 },
  exploreCardMoodDot:{ width: 4, height: 4, borderRadius: 2 },
  exploreCardMood:  { fontSize: 8, fontFamily: 'Satoshi-Bold', letterSpacing: 1.0, textTransform: 'uppercase' },
  exploreCardTitle: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(242,232,255,0.94)', letterSpacing: -0.2, lineHeight: 16, marginBottom: 2 },
  exploreCardAuthor:{ fontSize: 9, fontFamily: 'Satoshi-Regular', color: 'rgba(180,165,230,0.38)' },

  // ── Drift invitation card ──────────────────────────────────────────────────
  driftSection:    { paddingHorizontal: 16, paddingBottom: 8 },
  driftCard:       { borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(28,12,80,0.42)', position: 'relative', borderWidth: 1, borderColor: 'rgba(168,136,248,0.10)' },
  driftLumi:       { position: 'absolute', top: -8, right: -2, width: 100, height: 100 },
  driftContent:    { padding: 18, paddingRight: 88 },
  driftEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  driftEyebrow:    { fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 2.0, color: 'rgba(200,168,255,0.42)', textTransform: 'uppercase' },
  driftTitle:      { fontSize: 22, fontFamily: 'Satoshi-Bold', color: 'rgba(242,232,255,0.97)', letterSpacing: -0.7, marginBottom: 7, lineHeight: 27 },
  driftDesc:       { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.44)', lineHeight: 18, marginBottom: 14 },
  driftChips:      { flexDirection: 'row', gap: 6, marginBottom: 15, flexWrap: 'wrap' },
  driftChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 11, backgroundColor: 'rgba(160,128,248,0.11)', borderWidth: 1, borderColor: 'rgba(160,128,248,0.14)' },
  driftChipTxt:    { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,175,255,0.60)' },
  driftCTA:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  driftCTATxt:     { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,168,255,0.42)', fontStyle: 'italic' },
});

// ── Event banner styles ────────────────────────────────────────────────────────
const ev = StyleSheet.create({
  card:       {
    marginHorizontal: 16, marginTop: 4, marginBottom: 3,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 18, overflow: 'hidden', borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.020)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28, shadowRadius: 12, elevation: 3,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  themeIcon:  { fontSize: 13, lineHeight: 16 },
  eyebrow:    { fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.78 },
  pill:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9 },
  pillTxt:    { fontSize: 9.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  title:      { fontSize: 16, fontFamily: 'Satoshi-Bold', color: 'rgba(242,234,255,0.96)', letterSpacing: -0.3, marginBottom: 4 },
  desc:       { fontSize: 11.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.50)', lineHeight: 16.5, marginBottom: 7 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 1 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  chipIcon:   { fontSize: 11, lineHeight: 13 },
  chipTxt:    { fontSize: 11, fontFamily: 'Satoshi-Medium' },

  // ── Event Detail Sheet ────────────────────────────────────────────────────
  sheet: {
    backgroundColor: '#0C0820',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.12)',
    paddingHorizontal: 20, paddingTop: 8,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(200,184,232,0.22)',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeaderGrad: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  sheetTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetClose:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetTitle:    { fontSize: 24, fontFamily: 'Satoshi-Bold', color: 'rgba(242,234,255,0.97)', letterSpacing: -0.6, marginBottom: 10 },
  sheetDesc:     { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.60)', lineHeight: 19, marginBottom: 18 },
  sheetRewardsLabel: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(200,184,232,0.45)', marginBottom: 10 },
  sheetRewardsList:  { gap: 8, marginBottom: 20 },
  sheetRewardRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  sheetRewardIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sheetRewardName:   { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  sheetRewardType:   { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.45)', marginTop: 1 },
  sheetRewardAmt:    { fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  sheetNote: {
    borderTopWidth: 1, borderTopColor: 'rgba(200,184,232,0.08)',
    paddingTop: 14, marginTop: 4,
  },
  sheetNoteText: {
    fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(200,184,232,0.38)', textAlign: 'center', lineHeight: 17,
  },

  // ── Cosmetic showcase cards ───────────────────────────────────────────────
  showScroll:    { paddingLeft: 20, paddingRight: 0, gap: 12, paddingBottom: 4 },
  showCard:      {
    width: 148, borderRadius: 18, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  showPreview:   { height: 118, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  showIcon:      { fontSize: 30, lineHeight: 36 },

  // Frame category: concentric rounded-rect rings
  frameOuter:    { width: 88, height: 88, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  frameMid:      { width: 68, height: 68, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  frameInner:    { width: 50, height: 50, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Accent category: horizontal glow band
  accentWrap:    { width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8 },
  accentBand:    { position: 'absolute', left: 0, right: 0, height: 28 },
  accentDots:    { flexDirection: 'row', gap: 5, marginTop: 4 },
  accentDot:     { width: 5, height: 5, borderRadius: 2.5 },

  // Theme category: journal-page lines
  themeWrap:     { width: '100%', paddingHorizontal: 16, gap: 7, alignItems: 'flex-start', justifyContent: 'center' },
  themeLine:     { height: 2, borderRadius: 1 },
  themeIconBadge:{ position: 'absolute', top: 8, right: 14, width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Card footer text
  showCardBody:  { padding: 12, gap: 3 },
  showCardName:  { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(242,234,255,0.92)', letterSpacing: -0.2, lineHeight: 17 },
  showCardCat:   { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  showCardDesc:  { fontSize: 10.5, fontFamily: 'Satoshi-Regular', lineHeight: 14, marginTop: 1 },
  showCardBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, marginTop: 6, alignSelf: 'flex-start' },
  showCardBadgeTxt: { fontSize: 9.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },

  // Currency chips row (below showcase)
  currRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  currChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 11, borderWidth: 1 },
  currChipEmoji: { fontSize: 14, lineHeight: 17 },
  currChipNum:   { fontSize: 13, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },

  // Dismiss button (top-right of banner card)
  dismissBtn: {
    position: 'absolute', top: 10, right: 10, zIndex: 10,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Create-a-story CTA button in event detail sheet
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 16, paddingVertical: 13,
    borderRadius: 16, borderWidth: 1,
    marginTop: 18, marginBottom: 4,
  },
  ctaBtnTxt: {
    fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1, flex: 1,
  },
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
