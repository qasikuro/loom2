import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import {
  useApp,
  type GuideAvailability,
  type GuideProfile,
  type DiscoverPost,
} from '@/context/AppContext';
import { useSound } from '@/context/SoundContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';

// ── Mood palette ───────────────────────────────────────────────────────────────
const MOOD_GRADIENT: Record<string, readonly [string, string, string]> = {
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
const DEFAULT_GRADIENT: readonly [string, string, string] = ['#1A1630', '#222050', '#28246A'];

const MOOD_ACCENT: Record<string, string> = {
  Hopeful: '#C8A84B', Peaceful: '#78A8C8', Lonely: '#7090C0',
  Dreamy: '#B89AE8', Romantic: '#D878B0', Soft: '#C8A0D8',
  Chaotic: '#E8784A', Adventurous: '#6AC888', Joyful: '#70C888',
};
const DEFAULT_ACCENT = '#9B78E8';

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#5B9BB5', Joyful: '#D4A849', Lonely: '#5D7BA5',
  Hopeful: '#6BA57A', Dreamy: '#9B7AB5', Romantic: '#B86098',
  Chaotic: '#B85830', Soft: '#7B6BAA', Adventurous: '#3A9060',
};

// ── Campfire helpers ───────────────────────────────────────────────────────────
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function nextCampfireTime(avail: GuideAvailability | null | undefined): string | null {
  if (!avail || !avail.days?.length) return null;
  const now = new Date();
  const cur = now.getDay();
  const parts = avail.timeFrom.split(':').map(Number);
  const fH = parts[0] ?? 0;
  const fM = parts[1] ?? 0;
  for (let off = 0; off <= 7; off++) {
    const day = (cur + off) % 7;
    if (avail.days.includes(day)) {
      const t = new Date(now);
      t.setDate(now.getDate() + off);
      t.setHours(fH, fM, 0, 0);
      if (t > now) {
        const label = off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : DAY_NAMES[day];
        const h = fH % 12 || 12;
        const ampm = fH < 12 ? 'am' : 'pm';
        const mStr = String(fM).padStart(2, '0');
        return `${label} · ${h}:${mStr}${ampm}`;
      }
    }
  }
  return null;
}

function isGuideAvailableNow(avail: GuideAvailability | null | undefined): boolean {
  if (!avail) return false;
  const now = new Date();
  if (!avail.days.includes(now.getDay())) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fH, fM] = avail.timeFrom.split(':').map(Number);
  const [tH, tM] = avail.timeTo.split(':').map(Number);
  return cur >= (fH ?? 0) * 60 + (fM ?? 0) && cur < (tH ?? 0) * 60 + (tM ?? 0);
}

// ── Lumi message ───────────────────────────────────────────────────────────────
function getLumiMessage(
  name: string, entries: any[], stories: any[],
  friends: any[], unread: number, hour: number,
): string {
  if (unread > 0) return `${unread} new thing${unread > 1 ? 's' : ''} happened while you were away ✦`;
  const today = new Date();
  const todayEntries = entries.filter(e => {
    const d = new Date(e.date);
    return d.toDateString() === today.toDateString();
  });
  const n = name || 'sky child';
  if (hour < 6)  return 'The stars kept watch while you slept ✦';
  if (hour < 12) return todayEntries.length ? `Good morning, ${n} ✦` : 'What story will today hold?';
  if (hour < 17) return todayEntries.length ? `${todayEntries.length} ${todayEntries.length === 1 ? 'memory' : 'memories'} written today ✦` : 'The afternoon sky is all yours';
  if (hour < 20) {
    if (stories.length > 0) return `Your ${stories.length === 1 ? 'story is' : `${stories.length} stories are`} glowing out there ✦`;
    return 'Golden hour. A good time to write.';
  }
  if (friends.length > 0) return `${friends.length} friend${friends.length > 1 ? 's' : ''} drift nearby tonight`;
  return todayEntries.length === 0 ? 'The night is soft… write something?' : 'Tonight\'s sky is yours ✦';
}

// ── Breathing ring ─────────────────────────────────────────────────────────────
function BreathingRing({ accent }: { accent: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.18, 0.72, 0.18] });
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
      borderRadius: 54, borderWidth: 2.5, borderColor: accent,
      transform: [{ scale }], opacity,
    }} />
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, action, onAction }: {
  icon: string; label: string; action?: string; onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={sh.row}>
      <Icon name={icon as any} size={13} color={colors.mutedForeground} />
      <Text style={[sh.label, { color: colors.mutedForeground }]}>{label}</Text>
      {action && onAction && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[sh.action, { color: colors.primary }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12, paddingHorizontal: 20 },
  label:  { fontSize: 10.5, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4, textTransform: 'uppercase', flex: 1 },
  action: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
});

// ── Campfire card ──────────────────────────────────────────────────────────────
function CampfireCard({ guide, isMine = false }: { guide: GuideProfile; isMine?: boolean }) {
  const colors  = useColors();
  const nextT   = nextCampfireTime(guide.guideAvailability ?? null);
  const liveNow = guide.isAvailableNow || isGuideAvailableNow(guide.guideAvailability ?? null);
  const initial = guide.name.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[cf.card, { backgroundColor: isMine ? 'rgba(100,50,200,0.18)' : colors.card, borderColor: isMine ? 'rgba(140,80,255,0.38)' : colors.border }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/guide/[userId]', params: { userId: guide.userId } } as any); }}
      activeOpacity={0.88}
    >
      {isMine && <LinearGradient colors={['rgba(80,30,180,0.32)', 'rgba(40,12,100,0.22)']} style={StyleSheet.absoluteFill} />}
      {/* Avatar */}
      <View style={cf.avatarWrap}>
        {guide.avatarUri
          ? <Image source={{ uri: guide.avatarUri }} style={cf.avatarImg} contentFit="cover" cachePolicy="memory-disk" />
          : <LinearGradient colors={['rgba(120,70,255,0.60)', 'rgba(60,120,240,0.45)']} style={StyleSheet.absoluteFill} />
        }
        {!guide.avatarUri && <Text style={cf.avatarInitial}>{initial}</Text>}
        <View style={[cf.statusDot, { backgroundColor: liveNow ? '#50D880' : '#50506A' }]} />
      </View>
      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[cf.name, { color: isMine ? 'rgba(220,200,255,0.95)' : colors.foreground }]} numberOfLines={1}>
            {isMine ? 'Your Campfire' : guide.name}
          </Text>
          {liveNow && (
            <View style={cf.livePill}>
              <View style={cf.liveDot} />
              <Text style={cf.liveText}>Live</Text>
            </View>
          )}
        </View>
        {!isMine && guide.username && <Text style={[cf.handle, { color: colors.mutedForeground }]}>@{guide.username}</Text>}
        {guide.guideTopics.length > 0 && (
          <Text style={[cf.topics, { color: colors.mutedForeground }]} numberOfLines={1}>
            {guide.guideTopics.slice(0, 3).join(' · ')}
          </Text>
        )}
        {nextT && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Icon name="clock" size={10} color={isMine ? 'rgba(180,140,255,0.70)' : colors.mutedForeground} />
            <Text style={[cf.time, { color: isMine ? 'rgba(180,140,255,0.70)' : colors.mutedForeground }]}>{nextT}</Text>
          </View>
        )}
        {isMine && typeof guide.dreamersGuided === 'number' && guide.dreamersGuided > 0 && (
          <Text style={cf.guided}>{guide.dreamersGuided} dreamer{guide.dreamersGuided > 1 ? 's' : ''} guided ✦</Text>
        )}
      </View>
      {/* Action */}
      <TouchableOpacity
        style={[cf.joinBtn, { backgroundColor: isMine ? 'rgba(120,60,255,0.25)' : `${colors.primary}18`, borderColor: isMine ? 'rgba(140,80,255,0.45)' : `${colors.primary}30` }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/messages/[userId]', params: { userId: guide.userId, name: guide.name } } as any); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name={isMine ? 'users' : 'message-circle'} size={13} color={isMine ? 'rgba(180,140,255,0.90)' : colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
const cf = StyleSheet.create({
  card:         { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, overflow: 'hidden', marginHorizontal: 20, marginBottom: 10 },
  avatarWrap:   { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg:    { width: 46, height: 46 },
  avatarInitial:{ fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#fff' },
  statusDot:    { position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: '#0A0818' },
  name:         { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  handle:       { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },
  topics:       { fontSize: 11.5, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  time:         { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  guided:       { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(180,140,255,0.65)', marginTop: 3 },
  livePill:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(80,216,128,0.18)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  liveDot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#50D880' },
  liveText:     { fontSize: 9.5, fontFamily: 'Satoshi-Bold', color: '#50D880', letterSpacing: 0.4 },
  joinBtn:      { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

// ── Circle story card ──────────────────────────────────────────────────────────
function CircleCard({ post }: { post: DiscoverPost }) {
  const colors = useColors();
  const mc = MOOD_COLORS[post.mood] ?? '#7B6BAA';
  return (
    <TouchableOpacity
      style={[cc.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/story/[id]', params: { id: post.id } } as any); }}
      activeOpacity={0.88}
    >
      {/* Cover */}
      <View style={cc.cover}>
        {post.imageUri
          ? <Image source={{ uri: post.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          : <LinearGradient colors={[`${mc}55`, `${mc}22`]} style={StyleSheet.absoluteFill} />
        }
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={cc.overlay} />
        {/* Mood dot */}
        <View style={[cc.moodDot, { backgroundColor: mc }]} />
      </View>
      {/* Info */}
      <View style={cc.info}>
        <Text style={[cc.title, { color: colors.foreground }]} numberOfLines={2}>{post.chapterTitle || 'Untitled'}</Text>
        <Text style={[cc.author, { color: colors.mutedForeground }]} numberOfLines={1}>
          {post.authorName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="eye" size={10} color={colors.mutedForeground} />
            <Text style={[cc.stat, { color: colors.mutedForeground }]}>{post.witnessedCount}</Text>
          </View>
          <Text style={[cc.timeAgo, { color: `${colors.mutedForeground}80` }]}>{post.timeAgo}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const cc = StyleSheet.create({
  card:    { width: 148, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cover:   { width: '100%', height: 110, backgroundColor: '#141230' },
  overlay: { ...StyleSheet.absoluteFillObject },
  moodDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  info:    { padding: 10, gap: 3, minHeight: 80, flexDirection: 'column' },
  title:   { fontSize: 12.5, fontFamily: 'Satoshi-Bold', lineHeight: 16 },
  author:  { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  stat:    { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  timeAgo: { fontSize: 10, fontFamily: 'Satoshi-Regular' },
});

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════
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
    isLoading, reloadData, myGuides,
  } = useApp();
  const { playSound } = useSound();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 90;

  const [showNotifs,       setShowNotifs]       = useState(false);
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);
  const [refreshing,       setRefreshing]       = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────
  const hour       = new Date().getHours();
  const unreadCount = serverNotifications.filter(n => !n.isRead).length;
  const hasNotifs  = rewards.length > 0 || unreadCount > 0;

  const accent   = MOOD_ACCENT[character.mood ?? ''] ?? DEFAULT_ACCENT;
  const gradient = MOOD_GRADIENT[character.mood ?? ''] ?? DEFAULT_GRADIENT;

  const activeOutfit     = outfits.find(o => o.id === activeOutfitId) ?? null;
  const avatarSrc        = character.avatarUri ? { uri: character.avatarUri } : Images.character_default;
  const displayImgSrc    = activeOutfit?.imageUri ? { uri: activeOutfit.imageUri } : avatarSrc;

  const totalWitnessed   = stories.reduce((sum, s) => sum + (s.witnessedCount ?? 0), 0);
  const totalSaved       = stories.reduce((sum, s) => sum + (s.savedCount ?? 0), 0);

  const witnessNotifs    = serverNotifications.filter(n => n.type === 'witness');
  const saveNotifs       = serverNotifications.filter(n => n.type === 'save');
  const newStoryNotifs   = serverNotifications.filter(n => n.type === 'new_story').slice(0, 5);

  // Circle stories = posts from people they follow, newest first
  const circleStories    = discoverPosts.filter(p => p.isFollowing).slice(0, 12);

  // My own campfire guide (if isGuide) — show first
  const myCampfire: GuideProfile | null = character.isGuide ? {
    userId:            'me',
    name:              character.name || 'Sky Child',
    username:          character.username ?? null,
    bio:               character.bio,
    guideBio:          character.guideBio ?? '',
    guideTopics:       character.guideTopics ?? [],
    guideAvailability: character.guideAvailability ?? null,
    peaceRating:       0,
    dreamersGuided:    0,
    followerCount:     friends.length,
    avatarUri:         character.avatarUri ?? null,
    mood:              character.mood,
    isFollowing:       false,
    isAvailableNow:    isGuideAvailableNow(character.guideAvailability ?? null),
  } : null;

  const lumiMsg = getLumiMessage(character.name, journalEntries, stories, friends, unreadCount, hour);

  // ── Animations ────────────────────────────────────────────────────────────
  const auraAnim  = useRef(new Animated.Value(0)).current;
  const lumiFloat = useRef(new Animated.Value(0)).current;
  const fadeIn    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(auraAnim, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(auraAnim, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(lumiFloat, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(lumiFloat, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);

  const auraGlow   = auraAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.06, 0.22, 0.06] });
  const auraScale  = auraAnim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.12] });
  const lumiY      = lumiFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });

  async function handleRefresh() {
    setRefreshing(true);
    await reloadData();
    setRefreshing(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.root, { backgroundColor: colors.background, opacity: fadeIn }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={accent} />
        }
      >

        {/* ═══════════════════════════════════════════════════
            PROFILE HEADER — mood-reactive atmospheric banner
        ═══════════════════════════════════════════════════ */}
        <View style={[styles.profileHeader, { paddingTop: topPad + 12 }]}>
          {/* Base dark gradient */}
          <LinearGradient
            colors={gradient as unknown as [string, string, ...string[]]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          />
          {/* Breathing aura glow */}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', top: topPad - 20, left: W * 0.05,
            width: W * 0.90, height: W * 0.90, borderRadius: W * 0.45,
            backgroundColor: accent, opacity: auraGlow,
            transform: [{ scale: auraScale }],
          }} />
          {/* Corner glows */}
          <View pointerEvents="none" style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: accent, opacity: 0.07 }} />
          <View pointerEvents="none" style={{ position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: accent, opacity: 0.05 }} />

          {/* Top row: bell + settings */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: `${accent}28` }]}
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="settings" size={16} color="rgba(220,210,255,0.80)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: hasNotifs ? `${accent}28` : 'rgba(255,255,255,0.10)', borderColor: hasNotifs ? `${accent}45` : `${accent}18` }]}
              onPress={() => { setShowNotifs(true); markServerNotificationsRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="bell" size={16} color="rgba(220,210,255,0.85)" />
              {hasNotifs && <View style={[styles.notifDot, { backgroundColor: accent }]} />}
            </TouchableOpacity>
          </View>

          {/* Avatar + identity */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOutfitPicker(true); }}
              style={styles.avatarOuter}
            >
              <BreathingRing accent={accent} />
              <View style={styles.avatarInner}>
                <Image source={displayImgSrc} style={styles.avatarImg} contentFit="cover" />
              </View>
              {character.role && (
                <View style={[styles.roleBadge, { backgroundColor: accent }]}>
                  <Text style={styles.roleBadgeText}>{character.role.slice(0, 1)}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.identityBlock}>
              <Text style={styles.charName} numberOfLines={1}>
                {character.name || 'Sky Child'}
              </Text>
              {character.username && (
                <Text style={styles.handle}>@{character.username}</Text>
              )}
              {character.mood && (
                <View style={[styles.moodPill, { backgroundColor: `${MOOD_COLORS[character.mood] ?? accent}28`, borderColor: `${MOOD_COLORS[character.mood] ?? accent}50` }]}>
                  <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[character.mood] ?? accent }]} />
                  <Text style={[styles.moodText, { color: MOOD_COLORS[character.mood] ?? accent }]}>{character.mood}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bio */}
          {character.bio ? (
            <Text style={styles.bio} numberOfLines={3}>{character.bio}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.bioEmpty}>Tap to write your bio ✦</Text>
            </TouchableOpacity>
          )}

          {/* Trait chips */}
          {character.traits.length > 0 && (
            <View style={styles.traitsRow}>
              {character.traits.slice(0, 6).map(trait => (
                <View key={trait} style={[styles.traitChip, { backgroundColor: `${accent}18`, borderColor: `${accent}32` }]}>
                  <Text style={[styles.traitText, { color: accent }]}>{trait}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            {[
              { n: journalEntries.length, label: 'entries' },
              { n: stories.length,        label: 'stories' },
              { n: outfits.length,        label: 'outfits' },
              { n: friends.length,        label: 'circle' },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={styles.statDivider} />}
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => {
                    if (s.label === 'circle' || s.label === 'outfits') router.push('/(tabs)/profile');
                    if (s.label === 'entries') router.push('/(tabs)/log');
                    if (s.label === 'stories') router.push('/(tabs)/create');
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.statNum}>{s.n}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>

          {/* Edit profile CTA */}
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: `${accent}45` }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/profile'); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.editBtnText, { color: accent }]}>Edit Profile</Text>
            <Icon name="chevron-right" size={13} color={`${accent}80`} />
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════
            LUMI COMPANION
        ═══════════════════════════════════════════════════ */}
        <View style={[styles.lumiSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Animated.View style={{ transform: [{ translateY: lumiY }] }}>
            <Image source={Images.character_default} style={styles.lumiImg} contentFit="contain" />
          </Animated.View>
          <View style={styles.lumiBubble}>
            <View style={styles.lumiTailLeft} />
            <Text style={[styles.lumiMsg, { color: colors.foreground }]}>{lumiMsg}</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════
            ACTIVITY — what's happening in your space
        ═══════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <SectionHeader icon="activity" label="Your Space" action={hasNotifs ? 'See All' : undefined} onAction={() => setShowNotifs(true)} />

          <View style={styles.statGrid}>
            {/* Witnessed */}
            <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowNotifs(true)} activeOpacity={0.82}>
              <LinearGradient colors={['rgba(200,168,75,0.18)', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={styles.statCardNum}>{totalWitnessed}</Text>
              <Icon name="eye" size={14} color="#C8A84B" />
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Witnessed</Text>
              {witnessNotifs.length > 0 && (
                <View style={[styles.statCardBadge, { backgroundColor: '#C8A84B' }]}>
                  <Text style={styles.statCardBadgeText}>+{witnessNotifs.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Saved */}
            <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowNotifs(true)} activeOpacity={0.82}>
              <LinearGradient colors={['rgba(168,128,248,0.18)', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={styles.statCardNum}>{totalSaved}</Text>
              <Icon name="bookmark" size={14} color="#A880F8" />
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Saved</Text>
              {saveNotifs.length > 0 && (
                <View style={[styles.statCardBadge, { backgroundColor: '#A880F8' }]}>
                  <Text style={styles.statCardBadgeText}>+{saveNotifs.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Visitors (circle = followers proxy) */}
            <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.82}>
              <LinearGradient colors={['rgba(96,200,168,0.16)', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={styles.statCardNum}>{friends.length}</Text>
              <Icon name="users" size={14} color="#60C8A8" />
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Circle</Text>
            </TouchableOpacity>

            {/* Memories left (new story notifs from circle) */}
            <TouchableOpacity style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowNotifs(true)} activeOpacity={0.82}>
              <LinearGradient colors={['rgba(216,120,176,0.16)', 'transparent']} style={StyleSheet.absoluteFill} />
              <Text style={styles.statCardNum}>{newStoryNotifs.length}</Text>
              <Icon name="mail" size={14} color="#D878B0" />
              <Text style={[styles.statCardLabel, { color: colors.mutedForeground }]}>Memories</Text>
              {newStoryNotifs.length > 0 && (
                <View style={[styles.statCardBadge, { backgroundColor: '#D878B0' }]}>
                  <Text style={styles.statCardBadgeText}>new</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Recent notifications preview (top 3) */}
          {serverNotifications.length > 0 && (
            <View style={{ marginTop: 4, gap: 6 }}>
              {serverNotifications.slice(0, 3).map(n => (
                <TouchableOpacity key={n.id} style={[styles.notifRow, { backgroundColor: n.isRead ? colors.muted : `${accent}12`, borderColor: n.isRead ? colors.border : `${accent}28` }]} onPress={() => setShowNotifs(true)} activeOpacity={0.84}>
                  <View style={[styles.notifIcon, { backgroundColor: `${accent}20` }]}>
                    <Icon name={n.type === 'witness' ? 'eye' : n.type === 'save' ? 'bookmark' : n.type === 'new_story' ? 'book-open' : 'star'} size={13} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, { color: colors.foreground }]} numberOfLines={1}>{n.title}</Text>
                    <Text style={[styles.notifActor, { color: colors.mutedForeground }]}>{n.actorName}</Text>
                  </View>
                  {!n.isRead && <View style={[styles.unreadDot, { backgroundColor: accent }]} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════
            CAMPFIRES — guide sessions
        ═══════════════════════════════════════════════════ */}
        {(myCampfire || myGuides.length > 0) && (
          <View style={styles.section}>
            <SectionHeader icon="sun" label="Campfires" action="Browse" onAction={() => router.push('/(tabs)/discover')} />

            {myCampfire && <CampfireCard guide={myCampfire} isMine />}

            {myGuides.slice(0, 3).map(guide => (
              <CampfireCard key={guide.userId} guide={guide} />
            ))}

            {myGuides.length === 0 && !myCampfire && (
              <TouchableOpacity
                style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20 }]}
                onPress={() => router.push('/(tabs)/discover')}
                activeOpacity={0.84}
              >
                <Icon name="sun" size={22} color={`${colors.mutedForeground}60`} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No campfires yet</Text>
                <Text style={[styles.emptySub, { color: `${colors.mutedForeground}80` }]}>Find guides in Discover →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* No campfires placeholder if both empty */}
        {!myCampfire && myGuides.length === 0 && (
          <View style={styles.section}>
            <SectionHeader icon="sun" label="Campfires" />
            <TouchableOpacity
              style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20 }]}
              onPress={() => router.push('/(tabs)/discover')}
              activeOpacity={0.84}
            >
              <Text style={{ fontSize: 24 }}>🔥</Text>
              <Text style={[styles.emptyText, { color: colors.foreground }]}>Find a Campfire</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Follow guides to see their sessions here</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══════════════════════════════════════════════════
            FROM YOUR CIRCLE — stories from people you follow
        ═══════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <SectionHeader icon="layers" label="From Your Circle" action="See All" onAction={() => router.push('/(tabs)/discover')} />

          {circleStories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {circleStories.map(post => (
                <CircleCard key={post.id} post={post} />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 20 }]}
              onPress={() => router.push('/(tabs)/discover')}
              activeOpacity={0.84}
            >
              <Icon name="users" size={22} color={`${colors.mutedForeground}60`} />
              <Text style={[styles.emptyText, { color: colors.foreground }]}>Your circle is quiet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Follow people in Discover to see their stories here</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════
            QUICK ACTIONS
        ═══════════════════════════════════════════════════ */}
        <View style={styles.section}>
          <SectionHeader icon="zap" label="Quick Actions" />
          <View style={styles.actionsGrid}>
            {[
              { icon: 'book-open', label: 'Write in Journal', sub: `${journalEntries.length} entries`, color: '#A880F8', route: '/create-journal-entry' as const },
              { icon: 'feather',   label: 'Create Story',     sub: `${stories.length} stories`,       color: '#60C8F8', route: '/(tabs)/create' as const },
              { icon: 'compass',   label: 'Wander & Discover', sub: 'Explore the sky',              color: '#60D8A8', route: '/(tabs)/discover' as const },
              { icon: 'moon',      label: 'Enter Drift',       sub: 'Quiet space',                   color: '#C8A8FF', route: '/(tabs)/drift' as const },
            ].map(action => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: `${action.color}35` }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); playSound('tap'); router.push(action.route); }}
                activeOpacity={0.82}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${action.color}18` }]}>
                  <Icon name={action.icon as any} size={20} color={action.color} />
                </View>
                <Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
                <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>{action.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* ── Outfit picker modal ──────────────────────────────────────────────── */}
      <Modal visible={showOutfitPicker} transparent animationType="slide" onRequestClose={() => setShowOutfitPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOutfitPicker(false)}>
          <Pressable
            style={[styles.pickerSheet, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 24, backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: `${colors.primary}28` }]} />
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Choose Outfit</Text>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.muted }]} onPress={() => setShowOutfitPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>Long-press your avatar anytime to switch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.pickerCard, !activeOutfitId && { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` }]}
                onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(null); setShowOutfitPicker(false); }}
              >
                <View style={[styles.pickerCardImg, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="slash" size={22} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.pickerCardName, { color: colors.mutedForeground }]}>Default</Text>
                {!activeOutfitId && <View style={[styles.pickerActiveDot, { backgroundColor: colors.primary }]}><Icon name="check" size={10} color="#fff" /></View>}
              </TouchableOpacity>
              {outfits.map(outfit => (
                <TouchableOpacity
                  key={outfit.id}
                  style={[styles.pickerCard, activeOutfitId === outfit.id && { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` }]}
                  onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(outfit.id); setShowOutfitPicker(false); }}
                >
                  {outfit.imageUri
                    ? <Image source={{ uri: outfit.imageUri }} style={styles.pickerCardImg} contentFit="cover" />
                    : <View style={[styles.pickerCardImg, { backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }]}><Icon name="star" size={22} color={`${colors.primary}60`} /></View>
                  }
                  <Text style={[styles.pickerCardName, { color: colors.mutedForeground }]} numberOfLines={1}>{outfit.name}</Text>
                  {activeOutfitId === outfit.id && <View style={[styles.pickerActiveDot, { backgroundColor: colors.primary }]}><Icon name="check" size={10} color="#fff" /></View>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Notifications modal ──────────────────────────────────────────────── */}
      <Modal visible={showNotifs} transparent animationType="slide" onRequestClose={() => setShowNotifs(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotifs(false)}>
          <Pressable
            style={[styles.notifsSheet, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 24, backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: `${colors.primary}28` }]} />
            <View style={styles.notifsHeader}>
              <Text style={[styles.notifsTitle, { color: colors.foreground }]}>Notifications</Text>
              {hasNotifs && <View style={[styles.countBadge, { backgroundColor: colors.primary }]}><Text style={styles.countText}>{rewards.length + unreadCount}</Text></View>}
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.muted }]} onPress={() => setShowNotifs(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {rewards.length === 0 && serverNotifications.length === 0 ? (
              <View style={styles.notifsEmpty}>
                <Icon name="bell-off" size={32} color={`${colors.mutedForeground}70`} />
                <Text style={[styles.notifsEmptyText, { color: colors.mutedForeground }]}>You're all caught up ✦</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
                {serverNotifications.map(n => (
                  <Swipeable key={n.id} renderRightActions={() => (
                    <TouchableOpacity style={styles.swipeDelete} onPress={() => deleteServerNotification(n.id)}>
                      <Icon name="trash-2" size={18} color="#fff" />
                    </TouchableOpacity>
                  )}>
                    <View style={[styles.notifRowFull, { backgroundColor: n.isRead ? colors.muted : `${colors.primary}14`, borderColor: colors.border }]}>
                      <View style={[styles.notifIcon, { backgroundColor: `${colors.primary}20` }]}>
                        <Icon name={n.type === 'witness' ? 'eye' : n.type === 'save' ? 'bookmark' : 'star'} size={14} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifTitle, { color: colors.foreground }]} numberOfLines={2}>{n.title}</Text>
                        <Text style={[styles.notifActor, { color: colors.mutedForeground }]}>{n.actorName}</Text>
                      </View>
                      {!n.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                    </View>
                  </Swipeable>
                ))}
                {rewards.map(r => (
                  <TouchableOpacity key={r.id} style={[styles.rewardRow, { backgroundColor: `${colors.accent}18`, borderColor: `${colors.accent}35` }]} onPress={() => dismissReward(r.id)} activeOpacity={0.8}>
                    <Text style={styles.rewardEmoji}>{r.icon ?? '✦'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rewardTitle, { color: colors.foreground }]}>{r.message}</Text>
                      {r.subMessage && <Text style={[styles.notifActor, { color: colors.mutedForeground }]}>{r.subMessage}</Text>}
                    </View>
                    <Icon name="x" size={13} color={`${colors.mutedForeground}80`} />
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

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Profile header
  profileHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 6,
  },
  headerActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 20,
  },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute', top: 7, right: 7,
    width: 7, height: 7, borderRadius: 3.5,
  },

  // Avatar
  avatarSection:   { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 16 },
  avatarOuter:     { width: 88, height: 88, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarInner:     { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)' },
  avatarImg:       { width: 80, height: 80 },
  roleBadge:       { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A0818' },
  roleBadgeText:   { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#fff' },

  // Identity
  identityBlock: { flex: 1, gap: 5 },
  charName:      { fontSize: 22, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.96)', letterSpacing: -0.4 },
  handle:        { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.52)' },
  moodPill:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, alignSelf: 'flex-start' },
  moodDot:       { width: 6, height: 6, borderRadius: 3 },
  moodText:      { fontSize: 11.5, fontFamily: 'Satoshi-Medium', letterSpacing: 0.2 },

  // Bio + traits
  bio:           { fontSize: 13.5, fontFamily: 'Satoshi-Regular', color: 'rgba(210,196,255,0.68)', lineHeight: 20, marginBottom: 12 },
  bioEmpty:      { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.30)', fontStyle: 'italic', marginBottom: 12 },
  traitsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  traitChip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  traitText:     { fontSize: 11.5, fontFamily: 'Satoshi-Medium' },

  // Stats strip
  statsStrip:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', marginBottom: 14 },
  statItem:      { alignItems: 'center', gap: 2 },
  statNum:       { fontSize: 18, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.92)', letterSpacing: -0.4 },
  statLabel:     { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,180,255,0.45)', letterSpacing: 0.3 },
  statDivider:   { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.07)' },

  // Edit CTA
  editBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  editBtnText:   { fontSize: 13.5, fontFamily: 'Satoshi-Medium' },

  // Lumi companion
  lumiSection: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, marginVertical: 10, padding: 14,
    borderRadius: 20, borderWidth: 1,
  },
  lumiImg:    { width: 52, height: 52 },
  lumiBubble: { flex: 1, position: 'relative', paddingLeft: 8 },
  lumiTailLeft: {
    position: 'absolute', left: 2, top: '50%',
    marginTop: -5, width: 10, height: 10,
    backgroundColor: 'transparent',
    borderTopWidth: 5, borderBottomWidth: 5, borderRightWidth: 8,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderRightColor: 'rgba(155,120,255,0.20)',
  },
  lumiMsg:    { fontSize: 13.5, fontFamily: 'Satoshi-Regular', lineHeight: 19, fontStyle: 'italic' },

  // Sections
  section: { marginTop: 10, marginBottom: 4 },

  // Stat grid (2x2)
  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, paddingHorizontal: 20, marginBottom: 12,
  },
  statCard: {
    flex: 1, minWidth: '44%', borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 4, alignItems: 'flex-start', overflow: 'hidden', position: 'relative',
  },
  statCardNum:   { fontSize: 22, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.92)', letterSpacing: -0.4 },
  statCardLabel: { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  statCardBadge: { position: 'absolute', top: 8, right: 8, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  statCardBadgeText: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#fff' },

  // Notification rows (preview)
  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1,
    marginHorizontal: 20,
  },
  notifRowFull: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
  },
  notifIcon:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  notifTitle:   { fontSize: 13, fontFamily: 'Satoshi-Medium', lineHeight: 17 },
  notifActor:   { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },
  unreadDot:    { width: 7, height: 7, borderRadius: 3.5 },

  // Empty state
  emptyCard:  { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  emptyText:  { fontSize: 15, fontFamily: 'Satoshi-Bold' },
  emptySub:   { fontSize: 12.5, fontFamily: 'Satoshi-Regular', textAlign: 'center' },

  // Quick actions grid (2x2)
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 },
  actionBtn: {
    flex: 1, minWidth: '44%', borderRadius: 18, borderWidth: 1,
    padding: 16, gap: 6,
  },
  actionIcon:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  actionLabel: { fontSize: 13.5, fontFamily: 'Satoshi-Bold', lineHeight: 17 },
  actionSub:   { fontSize: 11.5, fontFamily: 'Satoshi-Regular' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingTop: 12, paddingHorizontal: 20 },
  notifsSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, paddingTop: 12, paddingHorizontal: 20, maxHeight: '80%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pickerTitle:  { fontSize: 17, fontFamily: 'Satoshi-Bold' },
  pickerSub:    { fontSize: 12.5, fontFamily: 'Satoshi-Regular', marginBottom: 16 },
  pickerRow:    { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  pickerCard:   { width: 88, borderRadius: 14, padding: 8, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  pickerCardImg:{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  pickerCardName: { fontSize: 11, fontFamily: 'Satoshi-Medium', textAlign: 'center' },
  pickerActiveDot: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  notifsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  notifsTitle:  { fontSize: 17, fontFamily: 'Satoshi-Bold', flex: 1 },
  countBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText:    { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#fff' },
  notifsEmpty:  { alignItems: 'center', paddingVertical: 36, gap: 10 },
  notifsEmptyText: { fontSize: 14, fontFamily: 'Satoshi-Regular' },
  rewardRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  rewardEmoji:  { fontSize: 22 },
  rewardTitle:  { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  swipeDelete:  { width: 60, backgroundColor: '#D03050', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
