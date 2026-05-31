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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useApp } from '@/context/AppContext';
import { useSound } from '@/context/SoundContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import { getTimeVariant } from '@/components/GradientSky';

// ── Time-aware deep sky palettes ───────────────────────────────────────────────
const SKY_PALETTES: Record<string, readonly [string, string, string, string, string]> = {
  dawn:  ['#1A0828', '#3C1040', '#782040', '#C05030', '#D09878'],
  day:   ['#080A20', '#0E1848', '#1A3080', '#3060B8', '#5888C8'],
  dusk:  ['#0A0618', '#281040', '#601848', '#A83038', '#C87050'],
  night: ['#030208', '#060312', '#0E0820', '#140C30', '#0A0818'],
};

// ── Mood → aurora tint (3 colours) ────────────────────────────────────────────
const MOOD_AURORA: Record<string, readonly [string, string, string]> = {
  Hopeful:     ['#C0B030', '#50C878', '#60A870'],
  Peaceful:    ['#3090C8', '#5070B8', '#60A8C0'],
  Dreamy:      ['#8058C8', '#6040B8', '#A870D8'],
  Lonely:      ['#405888', '#385090', '#506888'],
  Romantic:    ['#C04898', '#A83088', '#D06098'],
  Soft:        ['#9068B8', '#7850A8', '#B888C8'],
  Chaotic:     ['#D04828', '#C03018', '#E06840'],
  Adventurous: ['#388848', '#309060', '#58A870'],
};
const DEFAULT_AURORA: readonly [string, string, string] = ['#5840A0', '#3858B8', '#8050B8'];

// ── Static star positions (3 depth layers) ────────────────────────────────────
const STARS_FAR  = Array.from({ length: 22 }, (_, i) => ({
  lp: ((i * 47 + 23) % 100) / 100,
  tp: ((i * 37 + 15) % 58) / 100,
  s:  0.9 + (i % 3) * 0.4,
  o:  0.18 + (i % 5) * 0.07,
}));
const STARS_MID  = Array.from({ length: 12 }, (_, i) => ({
  lp: ((i * 71 + 41) % 96) / 100,
  tp: ((i * 53 + 28) % 62) / 100,
  s:  1.4 + (i % 4) * 0.5,
  o:  0.28 + (i % 4) * 0.10,
}));
const STARS_NEAR = Array.from({ length: 6 }, (_, i) => ({
  lp: ((i * 89 + 12) % 90) / 100,
  tp: ((i * 61 +  8) % 48) / 100,
  s:  2.0 + (i % 3) * 1.2,
  o:  0.50 + (i % 2) * 0.18,
}));

// ── Warm ambient glow positions (candle-like) ─────────────────────────────────
const GLOWS = [
  { lp: 0.06, tp: 0.60, color: '#FF8830', r: 44 },
  { lp: 0.22, tp: 0.68, color: '#FFC048', r: 34 },
  { lp: 0.72, tp: 0.65, color: '#FF7828', r: 38 },
  { lp: 0.88, tp: 0.71, color: '#FFAA40', r: 30 },
  { lp: 0.50, tp: 0.75, color: '#D868A0', r: 28 },
] as const;

// ── Action orbs ───────────────────────────────────────────────────────────────
const ORBS = [
  { key: 'journal',  label: 'Journal',  icon: 'book-open',  color: '#A880F8', glow: 'rgba(168,128,248,0.35)', route: '/create-journal-entry' as const },
  { key: 'story',    label: 'Story',    icon: 'feather',    color: '#60C8F8', glow: 'rgba(96,200,248,0.32)',  route: '/(tabs)/create' as const },
  { key: 'wander',   label: 'Wander',   icon: 'compass',    color: '#60D8A8', glow: 'rgba(96,216,168,0.32)', route: '/(tabs)/discover' as const },
  { key: 'drift',    label: 'Drift',    icon: 'moon',       color: '#C8A8FF', glow: 'rgba(200,168,255,0.35)', route: '/(tabs)/drift' as const },
] as const;

// ── Context-aware Lumi message ────────────────────────────────────────────────
function lumiSpeech(char: any, entries: any[], friends: any[], unread: number, hour: number) {
  if (unread > 0) return `${unread} new thing${unread > 1 ? 's' : ''} in your space ✦`;
  const today = new Date();
  const todayEntries = entries.filter(e => {
    const d = new Date(e.date);
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  });
  const name = char.name ? char.name.split(' ')[0] : 'sky child';
  if (hour < 6)  return 'The stars are keeping watch for you ✦';
  if (hour < 12) return todayEntries.length ? `Good morning, ${name} ✦` : 'What will you carry today?';
  if (hour < 17) return todayEntries.length ? `${todayEntries.length} ${todayEntries.length === 1 ? 'memory' : 'memories'} written today ✦` : 'The afternoon is yours to fill';
  if (hour < 20) {
    const mood = char.mood || '';
    if (mood === 'Peaceful') return 'A quiet dusk, just for you ✦';
    if (mood === 'Dreamy')   return 'The golden hour feels dreamy...';
    return 'The sky is golden right now ✦';
  }
  if (friends.length > 0) return `${friends.length} friend${friends.length > 1 ? 's' : ''} drifting nearby`;
  return todayEntries.length === 0 ? 'The night is soft... write something?' : 'Tonight\'s chapter is yours ✦';
}

// ── Burst dirs ────────────────────────────────────────────────────────────────
const BURST_DIRS  = Array.from({ length: 8 }, (_, i) => (i * 45 * Math.PI) / 180);
const BURST_SIZES = [7, 4, 9, 5, 8, 4, 7, 5] as const;

export default function HomeScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets  = useSafeAreaInsets();
  const colors  = useColors();
  const {
    character, journalEntries, stories, outfits,
    activeOutfitId, setActiveOutfitId,
    friends, rewards, serverNotifications,
    markServerNotificationsRead, deleteServerNotification, dismissReward,
    isLoading,
  } = useApp();
  const { playSound } = useSound();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 90;

  const [showNotifs,       setShowNotifs]       = useState(false);
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);

  const hour         = new Date().getHours();
  const timeVariant  = getTimeVariant();
  const unreadCount  = serverNotifications.filter(n => !n.isRead).length;
  const hasNotifs    = rewards.length > 0 || unreadCount > 0;
  const activeOutfit = outfits.find(o => o.id === activeOutfitId) ?? null;
  const latestEntry  = journalEntries[0];
  const skyColors    = SKY_PALETTES[timeVariant] ?? SKY_PALETTES.night;
  const aurora       = MOOD_AURORA[character.mood ?? ''] ?? DEFAULT_AURORA;
  const speech       = lumiSpeech(character, journalEntries, friends, unreadCount, hour);

  // ── Animated values ──────────────────────────────────────────────────────────
  const sceneAnim     = useRef(new Animated.Value(0)).current;
  const anim1         = useRef(new Animated.Value(0)).current;
  const anim2         = useRef(new Animated.Value(0)).current;
  const anim3         = useRef(new Animated.Value(0)).current;
  const lumiFloat     = useRef(new Animated.Value(0)).current;
  const lumiTap       = useRef(new Animated.Value(1)).current;
  const bubblePulse   = useRef(new Animated.Value(1)).current;
  const memoryFade    = useRef(new Animated.Value(0)).current;

  const starsFarAnims  = useRef(STARS_FAR.map(s => new Animated.Value(s.o))).current;
  const starsMidAnims  = useRef(STARS_MID.map(s => new Animated.Value(s.o))).current;
  const starsNearAnims = useRef(STARS_NEAR.map(s => new Animated.Value(s.o))).current;
  const glowAnims      = useRef(GLOWS.map(() => new Animated.Value(0.55))).current;
  const orbAnims       = useRef(ORBS.map(() => ({ op: new Animated.Value(0), sc: new Animated.Value(0.6) }))).current;

  const burstAnims = useRef(
    BURST_DIRS.map(() => ({ x: new Animated.Value(0), y: new Animated.Value(0), op: new Animated.Value(0), sc: new Animated.Value(0) }))
  ).current;

  useEffect(() => {
    // Scene fade in
    Animated.timing(sceneAnim, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();

    // Memory echo fade in (delayed)
    Animated.timing(memoryFade, { toValue: 1, duration: 700, delay: 600, useNativeDriver: true }).start();

    // Aurora drift loops (3 independent blobs)
    [
      { anim: anim1, dur: 6200, offset: 0 },
      { anim: anim2, dur: 8400, offset: 2200 },
      { anim: anim3, dur: 10800, offset: 4600 },
    ].forEach(({ anim, dur, offset }) => {
      setTimeout(() => Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(anim, { toValue: 0, duration: dur, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])).start(), offset);
    });

    // Star twinkle — far (slowest)
    starsFarAnims.forEach((a, i) => setTimeout(() => Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: Math.min(0.95, STARS_FAR[i].o + 0.45), duration: 1900 + i * 190, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(a, { toValue: Math.max(0.05, STARS_FAR[i].o - 0.12), duration: 1600 + i * 170, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start(), i * 140));

    // Star twinkle — mid
    starsMidAnims.forEach((a, i) => setTimeout(() => Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: Math.min(0.95, STARS_MID[i].o + 0.38), duration: 1400 + i * 210, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(a, { toValue: Math.max(0.08, STARS_MID[i].o - 0.18), duration: 1200 + i * 195, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start(), i * 195));

    // Star twinkle — near (brightest, fastest)
    starsNearAnims.forEach((a, i) => setTimeout(() => Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.92, duration: 900 + i * 280, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(a, { toValue: 0.28, duration: 1100 + i * 240, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start(), i * 380));

    // Candle-glow flicker
    glowAnims.forEach((a, i) => {
      const flicker = () => Animated.sequence([
        Animated.timing(a, { toValue: 0.35 + Math.random() * 0.55, duration: 200 + Math.random() * 280, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.50 + Math.random() * 0.40, duration: 170 + Math.random() * 230, useNativeDriver: true }),
      ]).start(() => flicker());
      setTimeout(flicker, i * 280);
    });

    // Lumi gentle float
    Animated.loop(Animated.sequence([
      Animated.timing(lumiFloat, { toValue: 1, duration: 3400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(lumiFloat, { toValue: 0, duration: 3400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start();

    // Speech bubble subtle breathe
    Animated.loop(Animated.sequence([
      Animated.timing(bubblePulse, { toValue: 1.015, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(bubblePulse, { toValue: 0.985, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ])).start();

    // Action orbs staggered entrance
    Animated.parallel(
      orbAnims.map((a, i) => Animated.parallel([
        Animated.timing(a.op, { toValue: 1, duration: 480, delay: 400 + i * 90, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.spring(a.sc, { toValue: 1, delay: 400 + i * 90, tension: 58, friction: 8, useNativeDriver: true }),
      ]))
    ).start();
  }, []);

  // ── Derived Animated values ───────────────────────────────────────────────────
  const lumiY = lumiFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -11] });

  const a1x = anim1.interpolate({ inputRange: [0, 1], outputRange: [0,  W * 0.18] });
  const a1y = anim1.interpolate({ inputRange: [0, 1], outputRange: [0,  H * 0.10] });
  const a1o = anim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.32, 0.12] });

  const a2x = anim2.interpolate({ inputRange: [0, 1], outputRange: [0, -W * 0.14] });
  const a2y = anim2.interpolate({ inputRange: [0, 1], outputRange: [0,  H * 0.08] });
  const a2o = anim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.10, 0.28, 0.10] });

  const a3x = anim3.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.08, W * 0.08] });
  const a3y = anim3.interpolate({ inputRange: [0, 1], outputRange: [ H * 0.06, -H * 0.06] });
  const a3o = anim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.08, 0.22, 0.08] });

  // Lumi tap burst
  function tapLumi() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSound('star');
    Animated.sequence([
      Animated.timing(lumiTap, { toValue: 1.13, duration: 80, useNativeDriver: true }),
      Animated.spring(lumiTap, { toValue: 1, tension: 200, friction: 7, useNativeDriver: true }),
    ]).start();
    burstAnims.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.op.setValue(0); p.sc.setValue(0); });
    Animated.parallel(
      burstAnims.map((p, i) => {
        const dist = 36 + (i % 3) * 14;
        return Animated.sequence([
          Animated.parallel([
            Animated.timing(p.op, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.timing(p.sc, { toValue: 1.2, duration: 50, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(p.x,  { toValue: Math.cos(BURST_DIRS[i]) * dist, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(p.y,  { toValue: Math.sin(BURST_DIRS[i]) * dist, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(p.op, { toValue: 0, duration: 460, useNativeDriver: true }),
            Animated.timing(p.sc, { toValue: 2.0, duration: 460, useNativeDriver: true }),
          ]),
        ]);
      })
    ).start();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>

      {/* ═══════════════════════════════════════════════
          LAYER 0 — Deep sky gradient (time-aware)
      ═══════════════════════════════════════════════ */}
      <LinearGradient
        colors={skyColors as unknown as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.35, y: 0 }} end={{ x: 0.65, y: 1 }}
      />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: sceneAnim }]}>

        {/* ═══════════════════════════════════════════
            LAYER 1 — Stars (far, mid, near depth)
        ═══════════════════════════════════════════ */}
        {STARS_FAR.map((s, i) => (
          <Animated.View key={`sf${i}`} pointerEvents="none" style={{
            position: 'absolute', left: s.lp * W, top: s.tp * H,
            width: s.s, height: s.s, borderRadius: s.s,
            backgroundColor: '#E8E0FF', opacity: starsFarAnims[i],
          }} />
        ))}
        {STARS_MID.map((s, i) => (
          <Animated.View key={`sm${i}`} pointerEvents="none" style={{
            position: 'absolute', left: s.lp * W, top: s.tp * H,
            width: s.s, height: s.s, borderRadius: s.s,
            backgroundColor: '#F0EAFF', opacity: starsMidAnims[i],
          }} />
        ))}
        {STARS_NEAR.map((s, i) => (
          <Animated.View key={`sn${i}`} pointerEvents="none" style={{
            position: 'absolute', left: s.lp * W, top: s.tp * H,
            width: s.s, height: s.s, borderRadius: s.s,
            backgroundColor: '#FFFFFF', opacity: starsNearAnims[i],
          }} />
        ))}

        {/* ═══════════════════════════════════════════
            LAYER 2 — Aurora blobs (mood-reactive)
        ═══════════════════════════════════════════ */}
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: -H * 0.12, left: -W * 0.18,
          width: W * 0.80, height: W * 0.80, borderRadius: W * 0.40,
          backgroundColor: aurora[0], opacity: a1o,
          transform: [{ translateX: a1x }, { translateY: a1y }],
        }} />
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: H * 0.08, right: -W * 0.22,
          width: W * 0.72, height: W * 0.72, borderRadius: W * 0.36,
          backgroundColor: aurora[1], opacity: a2o,
          transform: [{ translateX: a2x }, { translateY: a2y }],
        }} />
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: H * 0.28, left: W * 0.10,
          width: W * 0.68, height: W * 0.68, borderRadius: W * 0.34,
          backgroundColor: aurora[2], opacity: a3o,
          transform: [{ translateX: a3x }, { translateY: a3y }],
        }} />

        {/* ═══════════════════════════════════════════
            LAYER 3 — Horizon gradient (ground depth)
        ═══════════════════════════════════════════ */}
        <LinearGradient
          colors={['transparent', 'rgba(4,3,12,0.62)', 'rgba(2,1,8,0.90)']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: H * 0.52 }}
          pointerEvents="none"
        />

        {/* Mountain silhouette suggestion */}
        <View pointerEvents="none" style={{
          position: 'absolute', bottom: bottomPad + 80,
          left: 0, right: 0, height: 50,
          backgroundColor: 'rgba(3,2,10,0.50)',
          borderTopLeftRadius: W * 0.4,
          borderTopRightRadius: W * 0.2,
        }} />
        <View pointerEvents="none" style={{
          position: 'absolute', bottom: bottomPad + 100,
          left: -W * 0.1, width: W * 0.45, height: 60,
          backgroundColor: 'rgba(6,4,18,0.45)',
          borderTopRightRadius: W * 0.3,
        }} />
        <View pointerEvents="none" style={{
          position: 'absolute', bottom: bottomPad + 85,
          right: -W * 0.05, width: W * 0.40, height: 50,
          backgroundColor: 'rgba(6,4,18,0.40)',
          borderTopLeftRadius: W * 0.25,
        }} />

        {/* ═══════════════════════════════════════════
            LAYER 4 — Warm ambient glows (candle-like)
        ═══════════════════════════════════════════ */}
        {GLOWS.map((g, i) => (
          <Animated.View key={`g${i}`} pointerEvents="none" style={{
            position: 'absolute',
            left: g.lp * W - g.r,
            top:  g.tp * H - g.r,
            width: g.r * 2, height: g.r * 2, borderRadius: g.r,
            backgroundColor: g.color, opacity: glowAnims[i],
          }} />
        ))}

      </Animated.View>

      {/* ═══════════════════════════════════════════════
          UI LAYER — header, Lumi, memory, orbs
      ═══════════════════════════════════════════════ */}

      {/* ── Floating header ──────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOutfitPicker(true); }}
          style={styles.avatarRing}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {activeOutfit?.imageUri
            ? <Image source={{ uri: activeOutfit.imageUri }} style={styles.avatarImg} contentFit="cover" />
            : <Image source={Images.character_default} style={styles.avatarImg} contentFit="cover" />
          }
          {activeOutfit && (
            <View style={styles.outfitDot} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.nameBlock}
          hitSlop={{ top: 4, bottom: 4, left: 0, right: 8 }}
        >
          <Text style={styles.nameText} numberOfLines={1}>
            {character.name || 'Sky Child'}
          </Text>
          {character.mood ? (
            <Text style={styles.moodText}>{character.mood} · {timeVariant}</Text>
          ) : (
            <Text style={styles.moodText}>{timeVariant} sky</Text>
          )}
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {(stories.length > 0 || journalEntries.length > 0) && (
            <View style={styles.statsPill}>
              <Icon name="layers" size={10} color="rgba(200,180,255,0.50)" />
              <Text style={styles.statsText}>{stories.length + journalEntries.length}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.bellBtn, hasNotifs && styles.bellActive]}
            onPress={() => { setShowNotifs(true); markServerNotificationsRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="bell" size={17} color="rgba(220,210,255,0.82)" />
            {hasNotifs && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Center space: memory echo + Lumi ─────────────── */}
      <View style={[styles.centerSpace, { paddingTop: topPad + 70, paddingBottom: bottomPad + 20 }]}>

        {/* Memory echo — floats above Lumi as a faint whisper */}
        {latestEntry?.text && (
          <Animated.View style={[styles.memoryEcho, { opacity: memoryFade }]}>
            <Text style={styles.memoryQuote} numberOfLines={3}>
              "{latestEntry.text.length > 90
                  ? latestEntry.text.slice(0, 90) + '...'
                  : latestEntry.text}"
            </Text>
            <Text style={styles.memoryDate}>
              {new Date(latestEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </Animated.View>
        )}

        {/* Friends whisper (if has friends) */}
        {friends.length > 0 && (
          <Animated.View style={[styles.friendsWhisper, { opacity: memoryFade }]}>
            {friends.slice(0, 5).map((f, i) => {
              const MOOD_COLORS: Record<string, string> = { Hopeful: '#6BA57A', Peaceful: '#5B9BB5', Lonely: '#5D7BA5', Romantic: '#B86098', Chaotic: '#B85830', Dreamy: '#9B7AB5', Soft: '#7B6BAA', Adventurous: '#3A9060' };
              const mc = MOOD_COLORS[f.mood] ?? '#7060A8';
              return (
                <TouchableOpacity
                  key={f.userId}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push({ pathname: '/user/[userId]', params: { userId: f.userId } } as any); }}
                  style={[styles.friendDot, { backgroundColor: `${mc}35`, borderColor: `${mc}55` }]}
                >
                  {f.avatarUri
                    ? <Image source={{ uri: f.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                    : <Text style={[styles.friendInitial, { color: mc }]}>{f.name.charAt(0).toUpperCase()}</Text>
                  }
                </TouchableOpacity>
              );
            })}
            {friends.length > 5 && <Text style={styles.friendMore}>+{friends.length - 5}</Text>}
          </Animated.View>
        )}

        {/* Lumi companion */}
        <Pressable onPress={tapLumi} style={styles.lumiSection}>
          {/* Speech bubble */}
          <Animated.View style={[styles.speechBubble, { transform: [{ scale: bubblePulse }] }]}>
            <Text style={styles.speechText}>{speech}</Text>
            <View style={styles.speechTail} />
          </Animated.View>

          {/* Glow ring */}
          <Animated.View pointerEvents="none" style={[styles.lumiGlow, {
            backgroundColor: `${aurora[0]}22`,
            transform: [{ translateY: lumiY }],
          }]} />

          {/* Lumi image (floating) */}
          <Animated.View style={{ transform: [{ translateY: lumiY }, { scale: lumiTap }] }}>
            {activeOutfit?.imageUri
              ? <Image source={{ uri: activeOutfit.imageUri }} style={styles.lumiImg} contentFit="contain" />
              : <Image source={Images.character_default} style={styles.lumiImg} contentFit="contain" />
            }
          </Animated.View>

          {/* Burst particles */}
          {burstAnims.map((p, i) => (
            <Animated.View key={`b${i}`} pointerEvents="none" style={{
              position: 'absolute',
              width: BURST_SIZES[i], height: BURST_SIZES[i], borderRadius: BURST_SIZES[i],
              backgroundColor: i % 2 === 0 ? '#C8A84B' : aurora[0],
              opacity: p.op,
              transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.sc }],
            }} />
          ))}
        </Pressable>
      </View>

      {/* ── Action orbs ──────────────────────────────────── */}
      <View style={[styles.orbsBar, { paddingBottom: bottomPad - 10 }]}>
        {ORBS.map((orb, i) => (
          <Animated.View key={orb.key} style={{ opacity: orbAnims[i].op, transform: [{ scale: orbAnims[i].sc }] }}>
            <TouchableOpacity
              style={[styles.orbWrap, { shadowColor: orb.color }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                playSound('tap');
                router.push(orb.route);
              }}
              activeOpacity={0.78}
            >
              {/* Glow blob behind orb */}
              <View style={[styles.orbGlow, { backgroundColor: orb.glow }]} />
              <View style={[styles.orbCircle, { borderColor: `${orb.color}40` }]}>
                <Icon name={orb.icon as any} size={22} color={orb.color} />
              </View>
              <Text style={[styles.orbLabel, { color: `${orb.color}BB` }]}>{orb.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* ── Outfit picker modal ──────────────────────────── */}
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
            <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>Wear one of your saved outfits</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.pickerCard, !activeOutfitId && { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` }]}
                onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(null); setShowOutfitPicker(false); }}
              >
                <View style={[styles.pickerCardImg, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="slash" size={22} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.pickerCardName, { color: colors.mutedForeground }]}>None</Text>
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

      {/* ── Notifications modal ──────────────────────────── */}
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
                    <View style={[styles.notifRow, { backgroundColor: n.isRead ? colors.muted : `${colors.primary}14`, borderColor: colors.border }]}>
                      <View style={[styles.notifIcon, { backgroundColor: `${colors.primary}20` }]}>
                        <Icon name={n.type === 'witness' ? 'eye' : n.type === 'save' ? 'bookmark' : 'star'} size={14} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.notifText, { color: colors.foreground }]} numberOfLines={2}>{n.title}</Text>
                        <Text style={[styles.notifMeta, { color: colors.mutedForeground }]}>{n.actorName}</Text>
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
                    </View>
                    <Icon name="x" size={13} color={`${colors.mutedForeground}80`} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030208' },

  // Header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 14,
    // subtle dark gradient behind header for readability
    backgroundColor: 'rgba(6,4,18,0.40)',
  },
  avatarRing: {
    width: 40, height: 40, borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(200,184,232,0.45)',
  },
  avatarImg: { width: 40, height: 40 },
  outfitDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#C8A84B',
    borderWidth: 1.5, borderColor: '#030208',
  },
  nameBlock: { flex: 1, marginLeft: 11 },
  nameText: {
    fontSize: 15, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,235,255,0.90)', letterSpacing: -0.2,
  },
  moodText: {
    fontSize: 11, fontFamily: 'Satoshi-Regular',
    color: 'rgba(190,175,240,0.48)', marginTop: 1.5, letterSpacing: 0.2,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(200,184,232,0.12)',
  },
  statsText: {
    fontSize: 11, fontFamily: 'Satoshi-Medium',
    color: 'rgba(200,180,255,0.50)',
  },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellActive: {
    backgroundColor: 'rgba(155,120,255,0.18)',
    borderColor: 'rgba(155,120,255,0.38)',
  },
  bellDot: {
    position: 'absolute', top: 7, right: 7,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FF5C8A',
  },

  // Center space
  centerSpace: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end',
  },
  memoryEcho: {
    marginBottom: 20, paddingHorizontal: 22, paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(190,170,255,0.08)',
    maxWidth: 300, alignItems: 'center',
  },
  memoryQuote: {
    fontSize: 12.5, fontFamily: 'Satoshi-Regular',
    color: 'rgba(190,170,255,0.40)',
    fontStyle: 'italic', textAlign: 'center', lineHeight: 18.5,
  },
  memoryDate: {
    fontSize: 10, fontFamily: 'Satoshi-Regular',
    color: 'rgba(170,150,220,0.28)', marginTop: 5, letterSpacing: 0.5,
  },

  // Friends whisper
  friendsWhisper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 14,
  },
  friendDot: {
    width: 30, height: 30, borderRadius: 15,
    overflow: 'hidden', borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  friendInitial: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  friendMore: {
    fontSize: 11, fontFamily: 'Satoshi-Medium',
    color: 'rgba(190,170,255,0.40)', marginLeft: 2,
  },

  // Lumi
  lumiSection: { alignItems: 'center' },
  speechBubble: {
    marginBottom: 10,
    paddingHorizontal: 18, paddingVertical: 11,
    backgroundColor: 'rgba(20,12,52,0.88)',
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(190,170,255,0.30)',
    maxWidth: 260,
  },
  speechText: {
    fontSize: 13.5, fontFamily: 'Satoshi-Regular',
    color: 'rgba(238,228,255,0.95)',
    textAlign: 'center', lineHeight: 19,
  },
  speechTail: {
    position: 'absolute', bottom: -7, alignSelf: 'center',
    width: 13, height: 13,
    backgroundColor: 'rgba(20,12,52,0.88)',
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(190,170,255,0.30)',
  },
  lumiGlow: {
    position: 'absolute',
    width: 172, height: 172, borderRadius: 86,
    top: 14,
  },
  lumiImg: { width: 152, height: 152 },

  // Action orbs
  orbsBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-evenly',
    alignItems: 'flex-end', paddingHorizontal: 16,
    // dark band behind orbs for readability
    paddingTop: 18,
    backgroundColor: 'rgba(4,3,12,0.55)',
  },
  orbWrap: {
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.70, shadowRadius: 16, elevation: 12,
  },
  orbGlow: {
    position: 'absolute', bottom: 26,
    width: 70, height: 70, borderRadius: 35,
  },
  orbCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  orbLabel: {
    fontSize: 11, fontFamily: 'Satoshi-Medium',
    marginTop: 7, letterSpacing: 0.3,
  },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.60)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderWidth: 1, paddingTop: 12, paddingHorizontal: 20,
  },
  notifsSheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderWidth: 1, paddingTop: 12, paddingHorizontal: 20,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pickerTitle: { fontSize: 17, fontFamily: 'Satoshi-Bold' },
  pickerSub: { fontSize: 13, fontFamily: 'Satoshi-Regular', marginBottom: 16 },
  pickerRow: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  pickerCard: {
    width: 88, borderRadius: 14, padding: 8, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  pickerCardImg: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  pickerCardName: { fontSize: 11, fontFamily: 'Satoshi-Medium', textAlign: 'center' },
  pickerActiveDot: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  notifsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  notifsTitle: { fontSize: 17, fontFamily: 'Satoshi-Bold', flex: 1 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countText: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#fff' },
  notifsEmpty: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  notifsEmptyText: { fontSize: 14, fontFamily: 'Satoshi-Regular' },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
  },
  notifIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  notifText: { fontSize: 13, fontFamily: 'Satoshi-Medium', lineHeight: 18 },
  notifMeta: { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5 },
  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1,
  },
  rewardEmoji: { fontSize: 22 },
  rewardTitle: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  swipeDelete: {
    width: 60, backgroundColor: '#D03050', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
});
