import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Animated, Easing, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useApp, type GuideAvailability, type GuideProfile, type DiscoverPost,
} from '@/context/AppContext';
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
function lumiLine(name: string, entries: any[], stories: any[], unread: number, hour: number) {
  const n = name || 'sky child';
  if (unread > 0) return `${unread} new thing${unread > 1 ? 's' : ''} while you were away`;
  const todayCount = entries.filter(e => new Date(e.date).toDateString() === new Date().toDateString()).length;
  if (hour < 6)  return 'The stars kept watch while you slept';
  if (hour < 12) return todayCount ? `Good morning, ${n}` : 'What story will today hold?';
  if (hour < 17) return todayCount ? `${todayCount} ${todayCount === 1 ? 'memory' : 'memories'} written today` : 'The afternoon sky is all yours';
  if (hour < 20) return stories.length ? `Your ${stories.length === 1 ? 'story glows' : `${stories.length} stories glow`} out there` : 'Golden hour. A good time to write.';
  return todayCount === 0 ? 'The night is soft… write something?' : `Tonight's sky is yours`;
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
      {/* Ring */}
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
      <Text style={fb.name} numberOfLines={1}>{isMine ? 'Your Fire' : guide.name.split(' ')[0]}</Text>
      <Text style={fb.sub} numberOfLines={1}>
        {live ? '● Live' : next ?? 'Offline'}
      </Text>
    </TouchableOpacity>
  );
}
const fb = StyleSheet.create({
  wrap:    { alignItems: 'center', width: 72, gap: 5 },
  ring:    { width: 62, height: 62, borderRadius: 31, borderWidth: 2, padding: 2, position: 'relative' },
  circle:  { flex: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#181430', alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(220,200,255,0.85)' },
  liveDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#50D880', borderWidth: 2, borderColor: '#080614' },
  name:    { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(220,210,255,0.80)', textAlign: 'center' },
  sub:     { fontSize: 9.5, fontFamily: 'Satoshi-Regular', color: 'rgba(160,140,200,0.50)', textAlign: 'center' },
});

// ─── Story panel (masonry cell) ──────────────────────────────────────────────
function StoryPanel({ post, wide = false }: { post: DiscoverPost; wide?: boolean }) {
  const mc = MOOD_COLOR[post.mood] ?? '#7B6BAA';
  const h  = wide ? 200 : 140;
  return (
    <TouchableOpacity
      style={[sp.wrap, { height: h }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/story/[id]', params: { id: post.id } } as any); }}
      activeOpacity={0.88}
    >
      {post.imageUri
        ? <Image source={{ uri: post.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        : <LinearGradient colors={[`${mc}60`, `${mc}18`, '#080614']} style={StyleSheet.absoluteFill} />
      }
      <LinearGradient
        colors={['transparent', 'rgba(4,3,18,0.92)']}
        style={sp.grad}
      />
      <View style={sp.meta}>
        <View style={[sp.moodDot, { backgroundColor: mc }]} />
        <Text style={sp.title} numberOfLines={wide ? 2 : 1}>{post.chapterTitle || 'Untitled'}</Text>
        <Text style={sp.author} numberOfLines={1}>{post.authorName}</Text>
      </View>
      {post.witnessedCount > 0 && (
        <View style={sp.witness}>
          <Icon name="eye" size={9} color="rgba(255,255,255,0.55)" />
          <Text style={sp.witnessN}>{post.witnessedCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
const sp = StyleSheet.create({
  wrap:    { borderRadius: 16, overflow: 'hidden', backgroundColor: '#12103A', flex: 1 },
  grad:    { ...StyleSheet.absoluteFillObject },
  meta:    { position: 'absolute', bottom: 10, left: 10, right: 10, gap: 2 },
  moodDot: { width: 5, height: 5, borderRadius: 2.5, marginBottom: 2 },
  title:   { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.92)', lineHeight: 15 },
  author:  { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.50)' },
  witness: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 2 },
  witnessN:{ fontSize: 9.5, fontFamily: 'Satoshi-Medium', color: 'rgba(255,255,255,0.55)' },
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
    reloadData, myGuides,
  } = useApp();
  const { playSound } = useSound();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 90;

  const [showNotifs,  setShowNotifs]  = useState(false);
  const [showOutfits, setShowOutfits] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);

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

  const circleStories = discoverPosts.filter(p => p.isFollowing).slice(0, 10);

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
  const auraA  = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(auraA, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(auraA, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  const auraOp = auraA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.07, 0.22, 0.07] });
  const auraSc = auraA.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.14] });

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

  return (
    <Animated.View style={[s.root, { opacity: fadeIn }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
      >

        {/* ══════════════════════════════════════════════════
            HERO BANNER — full-bleed profile + live stats
        ══════════════════════════════════════════════════ */}
        <View style={[s.hero, { paddingTop: topPad + 10 }]}>
          {/* Mood gradient sky */}
          <LinearGradient
            colors={grad as unknown as [string, string, ...string[]]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          />
          {/* Breathing aura */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: topPad - 10, left: W * 0.05,
            width: W * 0.90, height: W * 0.90, borderRadius: W * 0.45,
            backgroundColor: accent, opacity: auraOp, transform: [{ scale: auraSc }],
          }} />
          {/* Edge glows */}
          <View pointerEvents="none" style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: accent, opacity: 0.06 }} />

          {/* ── Top row: actions ── */}
          <View style={s.heroActions}>
            <TouchableOpacity onPress={() => { setShowNotifs(true); markServerNotificationsRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={s.heroBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="bell" size={17} color="rgba(220,210,255,0.78)" />
              {hasNotifs && <View style={[s.heroBadge, { backgroundColor: accent }]} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={s.heroBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="settings" size={17} color="rgba(220,210,255,0.78)" />
            </TouchableOpacity>
          </View>

          {/* ── Avatar + identity ── */}
          <View style={s.identity}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOutfits(true); }}
              style={s.avatarWrap}
            >
              <BreathRing accent={accent} r={44} />
              <View style={s.avatarInner}>
                <Image source={imgSrc} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
              {character.role && (
                <View style={[s.roleTag, { backgroundColor: accent }]}>
                  <Text style={s.roleText}>{character.role.slice(0, 1)}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.heroName} numberOfLines={1}>{character.name || 'Sky Child'}</Text>
              {character.username && <Text style={s.heroHandle}>@{character.username}</Text>}
              {character.mood && (
                <View style={s.heroBioRow}>
                  <View style={[s.moodDot, { backgroundColor: mc }]} />
                  <Text style={[s.heroMood, { color: mc }]}>{character.mood}</Text>
                  {character.role && <Text style={[s.heroRole, { color: `${accent}80` }]}>· {character.role}</Text>}
                </View>
              )}
            </View>
          </View>

          {/* ── Bio ── */}
          {character.bio ? (
            <Text style={s.bio} numberOfLines={2}>{character.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <Text style={s.bioEmpty}>Add a bio ✦</Text>
            </TouchableOpacity>
          )}

          {/* ── Trait chips ── */}
          {character.traits.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.traitsRow}>
              {character.traits.slice(0, 8).map(t => (
                <View key={t} style={[s.trait, { backgroundColor: `${accent}16`, borderColor: `${accent}28` }]}>
                  <Text style={[s.traitTxt, { color: accent }]}>{t}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* ── Stats bar ── */}
          <View style={s.statBar}>
            {[
              { n: journalEntries.length, l: 'entries',  press: () => router.push('/(tabs)/log') },
              { n: stories.length,        l: 'stories',  press: () => router.push('/(tabs)/create') },
              { n: outfits.length,        l: 'outfits',  press: () => router.push('/(tabs)/profile') },
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
          </View>

          {/* Bottom fade to dark */}
          <LinearGradient
            colors={['transparent', '#080614']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28 }}
            pointerEvents="none"
          />
        </View>

        {/* ══════════════════════════════════════════════════
            LUMI — floating companion line
        ══════════════════════════════════════════════════ */}
        <View style={s.lumiRow}>
          <Image source={Images.character_default} style={s.lumiImg} contentFit="contain" />
          <Text style={s.lumiText} numberOfLines={2}>
            {lumiLine(character.name, journalEntries, stories, unread, hour)} ✦
          </Text>
        </View>

        {/* ══════════════════════════════════════════════════
            ACTIVITY HUD — glowing inline metrics
        ══════════════════════════════════════════════════ */}
        <TouchableOpacity style={s.hud} onPress={() => { setShowNotifs(true); markServerNotificationsRead(); }} activeOpacity={0.75}>
          {[
            { icon: 'eye',      n: totalWitnessed, color: '#C8A84B', label: 'witnessed' },
            { icon: 'bookmark', n: totalSaved,     color: '#A880F8', label: 'saved' },
            { icon: 'users',    n: friends.length, color: '#60C8A8', label: 'circle' },
            { icon: 'bell',     n: unread,         color: '#D878B0', label: 'new', dim: unread === 0 },
          ].map((item, i) => (
            <View key={item.label} style={s.hudItem}>
              {i > 0 && <View style={s.hudSep} />}
              <Icon name={item.icon as any} size={12} color={item.dim ? 'rgba(160,140,200,0.28)' : item.color} />
              <Text style={[s.hudN, { color: item.dim ? 'rgba(160,140,200,0.28)' : item.color }]}>{item.n}</Text>
              <Text style={[s.hudL, { opacity: item.dim ? 0.28 : 0.55 }]}>{item.label}</Text>
            </View>
          ))}
        </TouchableOpacity>

        {/* ══════════════════════════════════════════════════
            CAMPFIRES — story-bubble style circles
        ══════════════════════════════════════════════════ */}
        {campfires.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>CAMPFIRES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fireRow}>
              {campfires.map(({ guide, isMine }) => (
                <CampfireBubble key={guide.userId} guide={guide} isMine={isMine} />
              ))}
              {/* Browse more */}
              <TouchableOpacity style={s.moreBtn} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.78}>
                <View style={s.moreCircle}>
                  <Icon name="compass" size={18} color="rgba(160,140,200,0.60)" />
                </View>
                <Text style={fb.name}>Browse</Text>
                <Text style={fb.sub}>Discover</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {campfires.length === 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>CAMPFIRES</Text>
            <TouchableOpacity style={s.fireEmptyRow} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.78}>
              <Text style={{ fontSize: 18 }}>🔥</Text>
              <Text style={s.fireEmptyTxt}>Find guides to see their campfire sessions here</Text>
              <Icon name="chevron-right" size={14} color="rgba(160,140,200,0.40)" />
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════════════════
            CIRCLE STORIES — masonry full-bleed grid
        ══════════════════════════════════════════════════ */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>FROM YOUR CIRCLE</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/discover')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.sectionAll, { color: accent }]}>All →</Text>
            </TouchableOpacity>
          </View>
          <View style={s.masonry}>{renderCircleStories()}</View>
        </View>

        {/* ══════════════════════════════════════════════════
            QUICK ACTIONS — minimal icon row
        ══════════════════════════════════════════════════ */}
        <View style={s.actions}>
          {[
            { icon: 'book-open', label: 'Journal',  color: '#A880F8', route: '/create-journal-entry' as const },
            { icon: 'feather',   label: 'Story',    color: '#60C8F8', route: '/(tabs)/create' as const },
            { icon: 'compass',   label: 'Discover', color: '#60D8A8', route: '/(tabs)/discover' as const },
            { icon: 'moon',      label: 'Drift',    color: '#C8A8FF', route: '/(tabs)/drift' as const },
          ].map(a => (
            <TouchableOpacity
              key={a.label}
              style={s.actionPill}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); playSound('tap'); router.push(a.route); }}
              activeOpacity={0.78}
            >
              <View style={[s.actionIcon, { backgroundColor: `${a.color}18` }]}>
                <Icon name={a.icon as any} size={19} color={a.color} />
              </View>
              <Text style={[s.actionLabel, { color: `${a.color}CC` }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
                  <TouchableOpacity key={n.id} style={[m.notif, { backgroundColor: n.isRead ? colors.muted : `${accent}14`, borderColor: `${accent}20` }]} onLongPress={() => deleteServerNotification(n.id)}>
                    <View style={[m.notifIcon, { backgroundColor: `${accent}18` }]}>
                      <Icon name={n.type === 'witness' ? 'eye' : n.type === 'save' ? 'bookmark' : 'star'} size={13} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.notifTitle, { color: colors.foreground }]} numberOfLines={2}>{n.title}</Text>
                      <Text style={[m.notifSub, { color: colors.mutedForeground }]}>{n.actorName}</Text>
                    </View>
                    {!n.isRead && <View style={[m.unread, { backgroundColor: accent }]} />}
                  </TouchableOpacity>
                ))}
                {rewards.map(r => (
                  <TouchableOpacity key={r.id} style={[m.notif, { backgroundColor: `${DEF_ACCENT}12`, borderColor: `${DEF_ACCENT}25` }]} onPress={() => dismissReward(r.id)}>
                    <Text style={{ fontSize: 20 }}>{r.icon ?? '✦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.notifTitle, { color: colors.foreground }]}>{r.message}</Text>
                      {r.subMessage && <Text style={[m.notifSub, { color: colors.mutedForeground }]}>{r.subMessage}</Text>}
                    </View>
                    <Icon name="x" size={12} color={`${colors.mutedForeground}60`} />
                  </TouchableOpacity>
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

  // Hero banner
  hero: { paddingHorizontal: 20, paddingBottom: 28, overflow: 'hidden' },
  heroActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginBottom: 20 },
  heroBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  heroBadge:   { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 3.5 },

  // Avatar
  identity:   { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 14 },
  avatarWrap: { width: 86, height: 86, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarInner:{ width: 78, height: 78, borderRadius: 39, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)' },
  roleTag:    { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#080614' },
  roleText:   { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#fff' },

  // Identity text
  heroName:   { fontSize: 24, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.96)', letterSpacing: -0.5 },
  heroHandle: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.45)' },
  heroBioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  moodDot:    { width: 6, height: 6, borderRadius: 3 },
  heroMood:   { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  heroRole:   { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  // Bio + traits
  bio:        { fontSize: 13.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.60)', lineHeight: 19.5, marginBottom: 12 },
  bioEmpty:   { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.25)', fontStyle: 'italic', marginBottom: 12 },
  traitsRow:  { flexDirection: 'row', gap: 6, paddingBottom: 4, marginBottom: 16 },
  trait:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  traitTxt:   { fontSize: 11.5, fontFamily: 'Satoshi-Medium' },

  // Stats
  statBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  statItem: { alignItems: 'center', gap: 2 },
  statN:    { fontSize: 19, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.92)', letterSpacing: -0.4 },
  statL:    { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.38)', letterSpacing: 0.3 },
  statSep:  { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.06)' },

  // Lumi
  lumiRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14 },
  lumiImg:  { width: 40, height: 40 },
  lumiText: { flex: 1, fontSize: 13.5, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(210,195,255,0.58)', lineHeight: 19 },

  // Activity HUD
  hud:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)', marginBottom: 4 },
  hudItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hudSep:   { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 2 },
  hudN:     { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  hudL:     { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,1)', marginTop: 1 },

  // Sections
  section:     { paddingVertical: 16 },
  sectionRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionLabel:{ fontSize: 9.5, fontFamily: 'Satoshi-Bold', letterSpacing: 1.8, color: 'rgba(180,165,220,0.35)', flex: 1, paddingHorizontal: 20 },
  sectionAll:  { fontSize: 12, fontFamily: 'Satoshi-Medium' },

  // Campfires
  fireRow:     { flexDirection: 'row', gap: 16, paddingHorizontal: 20 },
  moreBtn:     { alignItems: 'center', width: 72, gap: 5 },
  moreCircle:  { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: 'rgba(160,140,200,0.18)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  fireEmptyRow:{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  fireEmptyTxt:{ flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(180,165,220,0.45)', lineHeight: 18 },

  // Masonry stories
  masonry:     { paddingHorizontal: 12, gap: 8 },
  masonryRow:  { flexDirection: 'row', gap: 8 },
  emptyStories:{ paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center', gap: 6 },
  emptyStoriesText: { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(180,165,220,0.45)' },
  emptyStoriesSub:  { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(160,145,200,0.35)' },

  // Quick actions
  actions:    { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 16, paddingVertical: 20 },
  actionPill: { alignItems: 'center', gap: 6 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actionLabel:{ fontSize: 11.5, fontFamily: 'Satoshi-Medium' },
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
});
