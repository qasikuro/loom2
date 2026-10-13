import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { resolveUri, type FriendSummary } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import type { FriendOutfit } from '@/hooks/useFriendOutfits';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View,
  useWindowDimensions, type DimensionValue,
} from 'react-native';
import Animated, {
  Easing, FadeIn, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

/** Artistic ink for text drawn directly over the fairy-garden hero (both themes). */
export const HERO_INK = { title: '#F4EEFF', sub: '#D6CBF2', eyebrow: '#E3D6FF', cyan: '#8FE8F5', border: 'rgba(200,170,255,0.34)' };

export function useHomeInk() {
  const c = useColors();
  const { isDark } = useTheme();
  return useMemo(() => ({
    isDark,
    title: c.foreground, sub: c.mutedForeground,
    eyebrow: isDark ? '#D9C8FF' : c.secondary,
    cyan: isDark ? '#7FE3F2' : c.skyBlue,
    card: isDark ? 'rgba(30,20,70,0.72)' : c.card,
    border: isDark ? 'rgba(190,160,255,0.26)' : `${c.border}88`,
    tint: isDark ? 'rgba(160,120,255,0.25)' : `${c.secondary}1F`,
    cta: c.secondary, ctaFg: c.secondaryForeground,
    bg: c.background,
    gradA: isDark ? 'rgba(64,38,140,0.9)' : `${c.secondary}26`,
    gradB: isDark ? 'rgba(32,20,78,0.9)' : c.card,
    heart: '#FF6F92',
  }), [c, isDark]);
}
type Ink = ReturnType<typeof useHomeInk>;
function useS() { const ink = useHomeInk(); return { ink, s: useMemo(() => makeStyles(ink), [ink]) }; }

const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function SectionHeader({ title, onSeeAll, seeAllLabel }: { title: string; onSeeAll?: () => void; seeAllLabel?: string }) {
  const { ink, s } = useS();
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle} accessibilityRole="header">{title}</Text>
      <Svg width={10} height={10} viewBox="0 0 10 10"><Path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill={ink.eyebrow} /></Svg>
      <View style={{ flex: 1 }} />
      {onSeeAll && (
        <TouchableOpacity onPress={() => { tap(); onSeeAll(); }} hitSlop={10} style={s.seeAll} accessibilityRole="button" accessibilityLabel={`${seeAllLabel ?? 'See all'}, ${title}`}>
          <Text style={s.seeAllText}>{seeAllLabel ?? 'See all'}</Text>
          <Icon name="chevron-right" size={13} color={ink.sub} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Ambient fairy dust + butterflies on the hero ─────────────────────── */
const DUST = [
  { x: '6%', y: '58%' }, { x: '22%', y: '20%' }, { x: '47%', y: '12%' },
  { x: '70%', y: '30%' }, { x: '90%', y: '66%' }, { x: '38%', y: '78%' },
] as const;

function Mote({ x, y, i, active, reduced }: { x: string; y: string; i: number; active: boolean; reduced: boolean }) {
  const p = useSharedValue(0.4);
  useEffect(() => {
    cancelAnimation(p);
    if (active && !reduced) {
      p.value = withDelay(i * 600, withRepeat(withTiming(1, { duration: 4200 + i * 380, easing: Easing.inOut(Easing.sin) }), -1, true));
    } else p.value = 0.4;
    return () => cancelAnimation(p);
  }, [active, reduced, i, p]);
  const st = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.5, 1], [0.15, 0.85, 0.25]),
    transform: [{ translateY: interpolate(p.value, [0, 1], [6, -12]) }, { translateX: interpolate(p.value, [0, 1], [-5, 5]) }],
  }));
  return <Animated.View pointerEvents="none" style={[ms.mote, { left: x as DimensionValue, top: y as DimensionValue }, st]}><View style={ms.moteCore} /></Animated.View>;
}

function Butterfly({ x, y, flip, active, reduced }: { x: string; y: string; flip?: boolean; active: boolean; reduced: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(p);
    if (active && !reduced) p.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(p);
  }, [active, reduced, p]);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(p.value, [0, 1], [0, -8]) }, { scaleX: (flip ? -1 : 1) * interpolate(p.value, [0, 0.5, 1], [1, 0.82, 1]) }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x as DimensionValue, top: y as DimensionValue, opacity: 0.8 }, st]}>
      <Svg width={18} height={14} viewBox="0 0 18 14">
        <Path d="M9 7 C6 0 0 1 2 6 C3 9 7 9 9 7 Z M9 7 C12 0 18 1 16 6 C15 9 11 9 9 7 Z" fill="#FFC6E6" opacity={0.85} />
        <Path d="M9 7 C7 11 3 13 4 10 C5 8 8 8 9 7 Z M9 7 C11 11 15 13 14 10 C13 8 10 8 9 7 Z" fill="#E7B6FF" opacity={0.8} />
      </Svg>
    </Animated.View>
  );
}

export function useAmbientState() {
  const [reduced, setReduced] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const a = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const b = AppState.addEventListener('change', st => setForeground(st === 'active'));
    return () => { a.remove(); b.remove(); };
  }, []);
  return { reduced, foreground };
}

export function HeroAmbience({ active, reduced }: { active: boolean; reduced: boolean }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      {DUST.map((d, i) => <Mote key={i} {...d} i={i} active={active} reduced={reduced} />)}
      <Butterfly x="4%" y="46%" active={active} reduced={reduced} />
      <Butterfly x="86%" y="8%" flip active={active} reduced={reduced} />
    </View>
  );
}

/* ── Friends row ─────────────────────────────────────────────────────── */
export function FriendsRow({ friends, activityByUser, onAdd, onOpen, avatarSize }: {
  friends: FriendSummary[];
  avatarSize?: number;
  activityByUser: Record<string, string>;
  onAdd: () => void;
  onOpen: (userId: string) => void;
}) {
  const { ink, s } = useS();
  const { width } = useWindowDimensions();
  const size = avatarSize ?? (width < 380 ? 54 : 60);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.friendRow}>
      <TouchableOpacity onPress={() => { tap(); onAdd(); }} style={[s.friend, { width: size + 12 }]} accessibilityRole="button" accessibilityLabel="Add friend" testID="home-add-friend">
        <View style={[s.addRing, { width: size, height: size, borderRadius: size / 2 }]}><Icon name="plus" size={22} color={ink.title} /></View>
        <Text style={s.friendName} numberOfLines={1}>Add</Text>
        <Text style={s.friendMeta} numberOfLines={1}>Friend</Text>
      </TouchableOpacity>
      {friends.map((f, i) => {
        const uri = f.avatarUri ? resolveUri(f.avatarUri) ?? f.avatarUri : null;
        const meta = f.isOnline ? 'Online' : activityByUser[f.userId] ?? '';
        return (
          <Animated.View key={f.userId} entering={FadeIn.delay(i * 60).duration(260)}>
            <TouchableOpacity onPress={() => { tap(); onOpen(f.userId); }} style={[s.friend, { width: size + 12 }]} accessibilityRole="button"
              accessibilityLabel={`${f.username || f.name}${meta ? `, ${meta}` : ''}`}>
              <View style={[s.friendRing, { width: size, height: size, borderRadius: size / 2, borderColor: f.isOnline ? ink.cyan : 'rgba(214,180,255,0.6)' }]}>
                {uri
                  ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  : <Text style={s.initial}>{(f.username || f.name || '?').charAt(0).toUpperCase()}</Text>}
              </View>
              {f.isOnline && <View style={s.onlineDot} />}
              <Text style={s.friendName} numberOfLines={1}>{f.username || f.name}</Text>
              <Text style={[s.friendMeta, f.isOnline && { color: ink.cyan }]} numberOfLines={1}>{meta || ' '}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
      {friends.length === 0 && (
        <View style={s.friendEmpty}><Text style={s.friendMeta}>Your friends will gather here once you add them.</Text></View>
      )}
    </ScrollView>
  );
}

/* ── New outfits from friends ──────────────────────────────────────── */
export function FriendOutfitsRow({ items, loading, error, onRetry, onOpen, onFind, hasFriends, cardHeight }: {
  cardHeight?: number;
  items: FriendOutfit[]; loading: boolean; error: boolean; hasFriends: boolean;
  onRetry: () => void; onOpen: (item: FriendOutfit) => void; onFind: () => void;
}) {
  const { ink, s } = useS();
  const { width } = useWindowDimensions();
  const h = cardHeight ?? Math.max(96, Math.min(116, (width - 40) / 3.3)) * 1.28;
  const w = Math.round(h / 1.25);
  if (loading) {
    return (
      <View style={s.creationRow} accessibilityLabel="Loading outfits">
        {[0, 1, 2, 3].map(i => <View key={i} style={[s.creation, { width: w, height: h, backgroundColor: ink.tint }]} />)}
      </View>
    );
  }
  if (error || items.length === 0) {
    const title = error ? 'Could not load outfits' : hasFriends ? 'No public outfits from friends yet' : 'Add friends to see their outfits';
    const text = error ? 'Check your connection and try again.' : hasFriends ? 'When friends share outfits publicly, they will appear here.' : 'Their newest public outfits will show up here.';
    return (
      <TouchableOpacity onPress={() => { tap(); (error ? onRetry : onFind)(); }} style={s.emptyCard} accessibilityRole="button" testID={error ? 'home-outfits-retry' : 'home-find-friends'}>
        <View style={s.emptyIcon}><Icon name={error ? 'refresh-cw' : 'user-plus'} size={18} color={ink.title} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.emptyTitle}>{title}</Text>
          <Text style={s.emptyText}>{text}</Text>
        </View>
        <Text style={s.seeAllText}>{error ? 'Retry' : hasFriends ? 'Friends' : 'Find'}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.creationRow}>
      {items.map((it, i) => {
        const uri = it.outfit.imageUri ? resolveUri(it.outfit.imageUri) ?? it.outfit.imageUri : undefined;
        const av = it.author.avatarUri ? resolveUri(it.author.avatarUri) ?? it.author.avatarUri : null;
        const name = it.author.username || it.author.name;
        return (
          <Animated.View key={it.outfit.id} entering={FadeIn.delay(i * 70).duration(300)}>
            <TouchableOpacity onPress={() => { tap(); onOpen(it); }} style={[s.creation, { width: w, height: h }]} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={`${it.outfit.name || 'Outfit'} by ${name}`} testID={`home-friend-outfit-${it.outfit.id}`}>
              {uri
                ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: ink.tint, alignItems: 'center', justifyContent: 'center' }]}><Icon name="image" size={20} color={ink.sub} /></View>}
              <LinearGradient colors={['transparent', 'rgba(10,6,28,0.9)']} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
              <View style={s.creationMeta}>
                <Text style={s.creationTitle} numberOfLines={1}>{it.outfit.name || 'Outfit'}</Text>
                <View style={s.authorRow}>
                  <View style={s.miniAvatar}>
                    {av ? <Image source={{ uri: av }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={s.miniInitial}>{name.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <Text style={s.creationAuthor} numberOfLines={1}>{name}</Text>
                </View>
                {it.outfit.tags?.[0] ? <Text style={s.tag} numberOfLines={1}>#{it.outfit.tags[0]}</Text> : null}
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

/* ── New story CTA ───────────────────────────────────────────────────── */
export function NewStoryCard({ resumeTitle, ready, active, onNew, onResume }: { resumeTitle?: string | null; ready: boolean; active: boolean; onNew: () => void; onResume: () => void }) {
  const { ink, s } = useS();
  const shimmer = useSharedValue(0);
  const { reduced, foreground } = useAmbientState();
  useEffect(() => {
    cancelAnimation(shimmer);
    shimmer.value = 0;
    if (reduced || !active || !foreground) return;
    shimmer.value = withRepeat(withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(shimmer);
  }, [reduced, active, foreground, shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: interpolate(shimmer.value, [0, 0.5, 1], [0, 0.18, 0]), transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-120, 360]) }] }));
  return (
    <View style={s.storyCard}>
      <LinearGradient colors={[ink.gradA, ink.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[s.shimmer, shimmerStyle]} />
      <View style={s.storyArt} pointerEvents="none">
        <View style={[s.artCard, { transform: [{ rotate: '10deg' }], right: 0, opacity: 0.6 }]}><Image source={Images.create_chapter} style={StyleSheet.absoluteFill} contentFit="cover" /></View>
        <View style={[s.artCard, { transform: [{ rotate: '-6deg' }], right: 18 }]}><Image source={require('@/assets/images/home-new-story.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" /></View>
      </View>
      <View style={{ width: '64%' }}>
        <Text style={s.eyebrow}>MAKE SOMETHING YOURS</Text>
        <Text style={s.storyTitle}>New story</Text>
        <Text style={s.storyText} numberOfLines={2}>Turn your gaming moments into a story, outfit or manga.</Text>
        <TouchableOpacity onPress={() => { tap(); onNew(); }} style={s.storyBtn} accessibilityRole="button" accessibilityLabel="Start a new story" testID="home-new-story">
          <Icon name="edit-2" size={15} color={ink.ctaFg} />
          <Text style={s.storyBtnText}>New story</Text>
          <Icon name="arrow-right" size={14} color={ink.ctaFg} />
        </TouchableOpacity>
      </View>
      {ready && resumeTitle ? (
          <TouchableOpacity onPress={() => { tap(); onResume(); }} hitSlop={8} style={[s.resume, { backgroundColor: ink.card, borderColor: ink.border }]} accessibilityRole="button" accessibilityLabel={`Continue your story, ${resumeTitle}`} testID="home-continue-story">
            <Icon name="book-open" size={12} color={ink.cyan} />
            <Text style={s.resumeText} numberOfLines={1}>Continue “{resumeTitle}”</Text>
          </TouchableOpacity>
        ) : null}
    </View>
  );
}

/* ── What's new slideshow ───────────────────────────────────────────── */
export type HomeAnnouncement = { id: string; category: string; title: string; description: string; actionLabel: string; imageUri?: string | null; onPress: () => void };

export function WhatsNewCarousel({ items, active }: { items: HomeAnnouncement[]; active: boolean }) {
  const { ink, s } = useS();
  const { width } = useWindowDimensions();
  const { reduced, foreground } = useAmbientState();
  const [index, setIndex] = useState(0);
  const [touching, setTouching] = useState(false);
  const ref = useRef<ScrollView>(null);
  const cardW = Math.min(width, 760) - 32;
  const count = items.length;
  useEffect(() => { if (index > 0 && index >= count) { setIndex(0); ref.current?.scrollTo({ x: 0, animated: false }); } }, [count, index]);

  useEffect(() => {
    if (count < 2 || reduced || touching || !active || !foreground) return;
    const id = setTimeout(() => go((index + 1) % count), 7000);
    return () => clearTimeout(id);
  }, [index, count, reduced, touching, active, foreground]);

  function go(i: number) {
    setIndex(i);
    ref.current?.scrollTo({ x: i * cardW, animated: !reduced });
  }

  if (count === 0) {
    return (
      <View style={s.newsEmpty}>
        <View style={s.emptyIcon}><Icon name="star" size={17} color={ink.title} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.emptyTitle}>No announcements right now</Text>
          <Text style={s.emptyText}>Storigam updates and community events will appear here.</Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onTouchStart={() => setTouching(true)} onTouchEnd={() => setTouching(false)} onScrollEndDrag={() => setTouching(false)}
        onMomentumScrollEnd={e => setIndex(Math.round(e.nativeEvent.contentOffset.x / cardW))}
        style={{ width: cardW }}>
        {items.map(item => (
          <View key={item.id} style={[s.newsCard, { width: cardW }]}>
            <LinearGradient colors={[ink.gradA, ink.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Image source={item.imageUri ? { uri: resolveUri(item.imageUri) ?? item.imageUri } : require('@/assets/images/home-new-story.jpg')} style={[s.newsArt, !item.imageUri && { opacity: 0.45 }]} contentFit="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={[ink.gradB, `${ink.gradB.length === 7 ? ink.gradB : '#1E1450'}00`]} start={{ x: 0.5, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={{ width: '64%', paddingLeft: count > 1 ? 26 : 0 }}>
              <View style={s.newsTag}><Text style={s.newsTagText}>{item.category.toUpperCase()}</Text></View>
              <Text style={s.newsTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={s.newsText} numberOfLines={1}>{item.description}</Text>
              <TouchableOpacity onPress={() => { tap(); item.onPress(); }} style={s.newsBtn} accessibilityRole="button" accessibilityLabel={`${item.actionLabel}, ${item.title}`}>
                <Text style={s.newsBtnText}>{item.actionLabel}</Text>
                <Icon name="arrow-right" size={12} color={ink.title} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      {count > 1 && (
        <>
          <TouchableOpacity style={[s.navBtn, { left: 4 }]} onPress={() => go((index - 1 + count) % count)} accessibilityLabel="Previous announcement" hitSlop={8}>
            <Icon name="chevron-left" size={16} color={ink.title} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.navBtn, { right: 4 }]} onPress={() => go((index + 1) % count)} accessibilityLabel="Next announcement" hitSlop={8}>
            <Icon name="chevron-right" size={16} color={ink.title} />
          </TouchableOpacity>
          <View style={s.dots}>{items.map((it, i) => <View key={it.id} style={[s.dot, i === index && s.dotOn]} />)}</View>
        </>
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  mote: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,226,160,0.25)', alignItems: 'center', justifyContent: 'center' },
  moteCore: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFF3C4' },
});
function makeStyles(ink: Ink) {
const glass = { backgroundColor: ink.card, borderColor: ink.border, borderWidth: 1 } as const;
return StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  sectionTitle: { color: ink.eyebrow, fontFamily: 'Satoshi-Bold', fontSize: 11.5, letterSpacing: 1.4 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 24 },
  seeAllText: { color: ink.sub, fontFamily: 'Satoshi-Medium', fontSize: 11.5 },
  mote: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,226,160,0.25)', alignItems: 'center', justifyContent: 'center' },
  moteCore: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFF3C4' },
  friendRow: { gap: 6, paddingRight: 16 },
  friend: { alignItems: 'center' },
  addRing: { borderWidth: 1.5, borderColor: ink.border, alignItems: 'center', justifyContent: 'center', backgroundColor: ink.tint },
  friendRing: { borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: ink.tint },
  initial: { color: ink.title, fontFamily: 'Satoshi-Black', fontSize: 20 },
  onlineDot: { position: 'absolute', top: 2, right: 4, width: 11, height: 11, borderRadius: 6, backgroundColor: '#45D992', borderWidth: 2, borderColor: ink.bg },
  friendName: { color: ink.title, fontFamily: 'Satoshi-Bold', fontSize: 11.5, marginTop: 4, maxWidth: '100%' },
  friendMeta: { color: ink.sub, fontFamily: 'Satoshi-Medium', fontSize: 10 },
  friendEmpty: { justifyContent: 'center', paddingLeft: 6, maxWidth: 220 },
  creationRow: { gap: 8, paddingRight: 16 },
  creation: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: ink.border, justifyContent: 'flex-end' },
  creationMeta: { padding: 7, gap: 3 },
  creationTitle: { color: '#FFFFFF', fontFamily: 'Satoshi-Bold', fontSize: 11.5 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniAvatar: { width: 16, height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  miniInitial: { color: '#FFFFFF', fontFamily: 'Satoshi-Bold', fontSize: 9 },
  tag: { color: 'rgba(255,255,255,0.8)', fontFamily: 'Satoshi-Medium', fontSize: 9.5 },
  creationAuthor: { flexShrink: 1, color: 'rgba(255,255,255,0.9)', fontFamily: 'Satoshi-Bold', fontSize: 10.5 },
  likePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9, backgroundColor: 'rgba(10,6,28,0.6)' },
  likeText: { color: ink.title, fontFamily: 'Satoshi-Bold', fontSize: 10 },
  emptyCard: { ...glass, borderRadius: 16, padding: 12, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 },
  emptyIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: ink.tint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: ink.title, fontFamily: 'Satoshi-Bold', fontSize: 13 },
  emptyText: { color: ink.sub, fontFamily: 'Satoshi-Medium', fontSize: 11, lineHeight: 15, marginTop: 2 },
  storyCard: { ...glass, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, overflow: 'hidden' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 70, backgroundColor: '#FFFFFF', transform: [{ skewX: '-20deg' }] },
  storyArt: { position: 'absolute', right: 12, top: 6, bottom: 6, width: 96 },
  artCard: { position: 'absolute', top: 2, width: 66, height: 86, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,240,255,0.7)' },
  eyebrow: { color: ink.eyebrow, fontFamily: 'Satoshi-Bold', fontSize: 10, letterSpacing: 1.3 },
  storyTitle: { color: ink.title, fontFamily: 'Satoshi-Black', fontSize: 21, lineHeight: 25, letterSpacing: -0.4 },
  storyText: { color: ink.sub, fontFamily: 'Satoshi-Medium', fontSize: 12.5, lineHeight: 16 },
  storyBtn: { marginTop: 7, minHeight: 38, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ink.cta },
  storyBtnText: { flex: 1, color: ink.ctaFg, fontFamily: 'Satoshi-Bold', fontSize: 13.5 },
  resume: { position: 'absolute', right: 10, bottom: 10, maxWidth: '36%', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 30, paddingHorizontal: 9, borderRadius: 15, borderWidth: 1 },
  resumeText: { color: ink.cyan, fontFamily: 'Satoshi-Bold', fontSize: 11, flexShrink: 1 },
  newsCard: { ...glass, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10, minHeight: 92, overflow: 'hidden', justifyContent: 'center' },
  newsArt: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '45%', opacity: 0.85 },
  newsTag: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: ink.tint, marginBottom: 3 },
  newsTagText: { color: ink.eyebrow, fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 1 },
  newsTitle: { color: ink.title, fontFamily: 'Satoshi-Black', fontSize: 15, lineHeight: 19 },
  newsText: { color: ink.sub, fontFamily: 'Satoshi-Medium', fontSize: 11, lineHeight: 15, marginTop: 2 },
  newsBtn: { alignSelf: 'flex-start', marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 30, paddingHorizontal: 11, borderRadius: 15, backgroundColor: ink.tint },
  newsBtnText: { color: ink.title, fontFamily: 'Satoshi-Bold', fontSize: 11 },
  newsEmpty: { ...glass, borderRadius: 18, padding: 13, flexDirection: 'row', gap: 10, alignItems: 'center' },
  navBtn: { position: 'absolute', top: '50%', marginTop: -16, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(10,6,30,0.6)', alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: 8, right: 14, flexDirection: 'row', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ink.border },
  dotOn: { backgroundColor: ink.title, width: 12 },
});
}
