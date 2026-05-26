import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SHADOW } from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { ReportSheet } from '@/components/ReportSheet';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_H } = Dimensions.get('window');

const MOOD_COLORS: Record<string, string> = {
  Peaceful:    '#8B7AB5',
  Joyful:      '#D4A849',
  Melancholy:  '#5D7BA5',
  Nostalgic:   '#A5785D',
  Hopeful:     '#6BA57A',
  Dreamy:      '#9B7AB5',
  Romantic:    '#C47AB5',
  Chaotic:     '#B57A7A',
  Soft:        '#A5A5D4',
  Adventurous: '#7AB595',
  Lonely:      '#7A8BA5',
};

const MOOD_DARK_BG: Record<string, readonly [string, string, string]> = {
  Peaceful:    ['#130D28', '#1E1640', '#2A2050'],
  Joyful:      ['#1A1000', '#2A1E00', '#3A2A08'],
  Melancholy:  ['#060E1A', '#0D1828', '#152238'],
  Nostalgic:   ['#180A00', '#2A1208', '#3A1E10'],
  Hopeful:     ['#061208', '#0D2012', '#152A1C'],
  Dreamy:      ['#100828', '#1C1040', '#281850'],
  Romantic:    ['#180818', '#2A1028', '#3A1838'],
  Chaotic:     ['#180808', '#2A1010', '#3A1818'],
  Soft:        ['#0D0D22', '#18183A', '#20204A'],
  Adventurous: ['#061210', '#0D2018', '#152820'],
  Lonely:      ['#080E18', '#101A28', '#182438'],
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch { return ''; }
}

export default function UserOutfitScreen() {
  const colors  = useColors();
  const { t }   = useTranslation();
  const insets  = useSafeAreaInsets();
  const { followingIds, followUser, unfollowUser } = useApp();
  const params  = useLocalSearchParams<{
    outfitName:   string;
    outfitDesc:   string;
    outfitStory:  string;
    outfitImage:  string;
    outfitTags:   string;
    outfitDate:   string;
    authorUserId: string;
    authorName:   string;
    authorHandle: string;
    authorBio:    string;
    authorMood:   string;
    authorTraits: string;
  }>();

  const tags: string[]   = params.outfitTags   ? JSON.parse(params.outfitTags)   : [];
  const traits: string[] = params.authorTraits ? JSON.parse(params.authorTraits) : [];
  const moodColor = MOOD_COLORS[params.authorMood ?? ''] ?? colors.primary;
  const darkBg    = MOOD_DARK_BG[params.authorMood ?? ''] ?? (['#100828', '#1C1040', '#281850'] as const);
  const isFollowing = followingIds.includes(params.authorUserId ?? '');
  const initial = (params.authorName ?? '?').charAt(0).toUpperCase();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80  : insets.bottom + 24;

  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [appreciated, setAppreciated]               = useState(false);

  // ── Scroll-driven animations ────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;

  const stickyOpacity = scrollY.interpolate({
    inputRange: [SCREEN_H * 0.72, SCREEN_H * 0.88],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const imageParallax = scrollY.interpolate({
    inputRange: [0, SCREEN_H],
    outputRange: [0, -SCREEN_H * 0.22],
    extrapolate: 'clamp',
  });

  const imagePullScale = scrollY.interpolate({
    inputRange: [-SCREEN_H * 0.2, 0],
    outputRange: [1.22, 1],
    extrapolate: 'clamp',
  });

  const heroFade = scrollY.interpolate({
    inputRange: [0, SCREEN_H * 0.32],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // ── Mount entrance animation ────────────────────────────────
  const entryAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1, duration: 950, delay: 250, useNativeDriver: true,
    }).start();
  }, []);
  const entryY = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });

  // ── Scroll-hint bounce ──────────────────────────────────────
  const hintY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(hintY, { toValue: -9,  duration: 760, useNativeDriver: true }),
        Animated.timing(hintY, { toValue: 0,   duration: 760, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Double-tap to Admire ────────────────────────────────────
  const lastTapRef      = useRef(0);
  const admireScale     = useRef(new Animated.Value(0)).current;
  const admireOpacity   = useRef(new Animated.Value(0)).current;

  function handleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 340) {
      if (!appreciated) {
        setAppreciated(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        admireScale.setValue(0.25);
        admireOpacity.setValue(1);
        Animated.parallel([
          Animated.spring(admireScale, {
            toValue: 1, friction: 4, tension: 60, useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(520),
            Animated.timing(admireOpacity, {
              toValue: 0, duration: 480, useNativeDriver: true,
            }),
          ]),
        ]).start();
      }
    }
    lastTapRef.current = now;
  }

  function handleFollow() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isFollowing) unfollowUser(params.authorUserId!);
    else followUser(params.authorUserId!);
  }

  return (
    <View style={styles.root}>

      {/* ── Floating back pill — always on top ──────────────── */}
      <BackButton
        style={[styles.floatingBack, { top: topPad + 10 }]}
        color="#fff"
        size={18}
      />

      {/* ── Sticky mini-header — fades in after hero ────────── */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { paddingTop: topPad, backgroundColor: colors.background, borderBottomColor: colors.border, opacity: stickyOpacity },
        ]}
        pointerEvents="none"
      >
        <View style={{ width: 44 }} />
        <Text style={[styles.stickyTitle, { color: colors.foreground }]} numberOfLines={1}>
          {params.outfitName}
        </Text>
        <View style={{ width: 44 }} />
      </Animated.View>

      {/* ── Main scroll ─────────────────────────────────────── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        bounces
      >

        {/* ════════════════════════════════════════════════════
            HERO — the entire first screen is the outfit
            ════════════════════════════════════════════════════ */}
        <Pressable style={[styles.hero, { height: SCREEN_H }]} onPress={handleTap}>

          {/* Full-bleed image with parallax */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: imageParallax }, { scale: imagePullScale }] },
            ]}
          >
            {params.outfitImage ? (
              <Image
                source={{ uri: params.outfitImage }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={darkBg}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
              />
            )}
          </Animated.View>

          {/* Top vignette — protects the back button */}
          <LinearGradient
            colors={['rgba(0,0,0,0.60)', 'rgba(0,0,0,0.22)', 'transparent']}
            style={styles.topVignette}
            pointerEvents="none"
          />

          {/* Bottom vignette — editorial text backdrop */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.48)', 'rgba(0,0,0,0.91)']}
            style={styles.bottomVignette}
            pointerEvents="none"
          />

          {/* Hero text — name + tags + date (entry + scroll fade) */}
          <Animated.View
            style={[styles.heroContent, { opacity: heroFade }]}
            pointerEvents="none"
          >
            {tags.length > 0 && (
              <Animated.View style={[styles.tagsRow, { transform: [{ translateY: entryY }] }]}>
                {tags.map(tag => (
                  <View key={tag} style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>✦ {tag}</Text>
                  </View>
                ))}
              </Animated.View>
            )}

            <Animated.Text
              style={[styles.heroName, { transform: [{ translateY: entryY }] }]}
              numberOfLines={3}
            >
              {params.outfitName}
            </Animated.Text>

            {params.outfitDate ? (
              <Animated.View style={[styles.datePill, { transform: [{ translateY: entryY }] }]}>
                <Icon name="calendar" size={10} color="rgba(240,228,200,0.78)" />
                <Text style={styles.datePillText}>{fmtDate(params.outfitDate)}</Text>
              </Animated.View>
            ) : null}
          </Animated.View>

          {/* Scroll hint */}
          <Animated.View
            style={[
              styles.scrollHint,
              { bottom: bottomPad + 18, opacity: heroFade, transform: [{ translateY: hintY }] },
            ]}
            pointerEvents="none"
          >
            <Icon name="chevron-up" size={16} color="rgba(255,255,255,0.55)" />
            <Text style={styles.scrollHintText}>pull to reveal</Text>
          </Animated.View>

        </Pressable>

        {/* ════════════════════════════════════════════════════
            DETAILS — scrolls up from beneath the hero
            ════════════════════════════════════════════════════ */}
        <View style={[styles.details, { backgroundColor: colors.background }]}>

          {/* Mood accent line */}
          <View style={[styles.moodBar, { backgroundColor: `${moodColor}55` }]} />

          {/* ── Character card ─────────────────────────────── */}
          <View style={[styles.charCard, { backgroundColor: colors.card, borderColor: `${moodColor}28` }, SHADOW.sm]}>

            <LinearGradient
              colors={[`${moodColor}16`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1.2 }}
              pointerEvents="none"
            />

            <View style={styles.charTop}>
              <View style={[styles.charAvatar, { backgroundColor: `${moodColor}20`, borderColor: `${moodColor}44` }]}>
                <Text style={[styles.charInitial, { color: moodColor }]}>{initial}</Text>
              </View>
              <View style={styles.charNameBlock}>
                <Text style={[styles.charName, { color: colors.foreground }]}>{params.authorName}</Text>
                {params.authorHandle ? (
                  <Text style={[styles.charHandle, { color: colors.primary }]}>@{params.authorHandle}</Text>
                ) : null}
              </View>
              {params.authorMood ? (
                <View style={[styles.moodPill, { backgroundColor: `${moodColor}18`, borderColor: `${moodColor}32` }]}>
                  <Text style={[styles.moodPillText, { color: moodColor }]}>{params.authorMood}</Text>
                </View>
              ) : null}
            </View>

            {!!params.authorBio && (
              <Text style={[styles.charBio, { color: colors.mutedForeground }]}>
                {params.authorBio}
              </Text>
            )}

            {traits.length > 0 && (
              <View style={styles.traitsRow}>
                {traits.map(tr => (
                  <View key={tr} style={[styles.traitChip, { backgroundColor: `${moodColor}14`, borderColor: `${moodColor}28` }]}>
                    <Text style={[styles.traitText, { color: moodColor }]}>{tr}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={[styles.charDivider, { backgroundColor: colors.border }]} />

            <View style={styles.charActions}>
              <TouchableOpacity
                style={[
                  styles.followBtn,
                  isFollowing
                    ? { backgroundColor: colors.muted, borderColor: colors.border }
                    : { backgroundColor: moodColor, borderColor: moodColor },
                ]}
                onPress={handleFollow}
                activeOpacity={0.82}
              >
                <Icon
                  name={isFollowing ? 'user-check' : 'user-plus'}
                  size={14}
                  color={isFollowing ? colors.mutedForeground : '#fff'}
                />
                <Text style={[styles.followBtnText, { color: isFollowing ? colors.mutedForeground : '#fff' }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/user/[userId]', params: { userId: params.authorUserId } } as any);
                }}
                activeOpacity={0.82}
              >
                <Icon name="user" size={14} color={colors.mutedForeground} />
                <Text style={[styles.profileBtnText, { color: colors.mutedForeground }]}>
                  {t('discover.fullProfile')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => setReportSheetVisible(true)}
                activeOpacity={0.82}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="flag" size={14} color="rgba(200,100,100,0.65)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Notes ──────────────────────────────────────── */}
          {!!params.outfitDesc && (
            <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
              <View style={styles.cardLabel}>
                <View style={[styles.cardDot, { backgroundColor: moodColor }]} />
                <Text style={[styles.cardLabelText, { color: moodColor }]}>
                  {t('outfit.notesLabel')}
                </Text>
              </View>
              <Text style={[styles.notesText, { color: colors.foreground }]}>
                "{params.outfitDesc}"
              </Text>
            </View>
          )}

          {/* ── Character story ─────────────────────────────── */}
          {!!params.outfitStory && (
            <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: `${moodColor}28` }, SHADOW.xs]}>
              <View style={styles.cardLabel}>
                <View style={[styles.cardDot, { backgroundColor: moodColor }]} />
                <Text style={[styles.cardLabelText, { color: moodColor }]}>Character Story</Text>
              </View>
              <Text style={[styles.storyText, { color: colors.foreground }]}>{params.outfitStory}</Text>
            </View>
          )}

          {/* ── Admired badge ───────────────────────────────── */}
          {appreciated && (
            <View style={styles.admiredRow}>
              <Text style={[styles.admiredText, { color: moodColor }]}>✦ you admired this look</Text>
            </View>
          )}

        </View>
      </Animated.ScrollView>

      {/* ── Admire burst (double-tap star) ──────────────────── */}
      <Animated.View
        style={[styles.admireBurst, { opacity: admireOpacity, transform: [{ scale: admireScale }] }]}
        pointerEvents="none"
      >
        <Text style={styles.admireStar}>✦</Text>
      </Animated.View>

      <ReportSheet
        visible={reportSheetVisible}
        targetType="outfit"
        targetId={params.authorUserId ?? ''}
        targetLabel={`${params.authorName ?? 'this user'}'s outfit`}
        onClose={() => setReportSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08060F' },

  floatingBack: {
    position: 'absolute', zIndex: 60, left: 16,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },

  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyTitle: { flex: 1, fontSize: 15, fontFamily: 'Satoshi-Bold', textAlign: 'center' },

  // ── Hero ────────────────────────────────────────────────────
  hero:          { width: '100%', overflow: 'hidden', backgroundColor: '#08060F' },
  topVignette:   { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  bottomVignette:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 380 },

  heroContent: {
    position: 'absolute', bottom: 90, left: 0, right: 0, paddingHorizontal: 22,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  heroBadge: {
    backgroundColor: 'rgba(14,10,32,0.52)',
    borderRadius: 22, paddingHorizontal: 13, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.22)',
  },
  heroBadgeText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,248,0.92)' },
  heroName: {
    fontSize: 40, fontFamily: 'Satoshi-Bold', color: '#fff',
    letterSpacing: -1.2, lineHeight: 46,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16,12,36,0.48)', borderRadius: 14,
    paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(200,168,75,0.20)',
  },
  datePillText: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(240,228,200,0.88)' },

  scrollHint: {
    position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 4,
  },
  scrollHintText: {
    fontSize: 9, fontFamily: 'Satoshi-Medium', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2, textTransform: 'uppercase',
  },

  // ── Details ─────────────────────────────────────────────────
  details:  { paddingTop: 26 },
  moodBar:  { height: 3, marginHorizontal: 44, borderRadius: 2, marginBottom: 24 },

  charCard: {
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 24, borderWidth: 1, padding: 20, overflow: 'hidden',
  },
  charTop:  { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 12 },
  charAvatar: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  charInitial:   { fontSize: 25, fontFamily: 'Satoshi-Bold' },
  charNameBlock: { flex: 1, gap: 3 },
  charName:      { fontSize: 18, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  charHandle:    { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  moodPill: {
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1, flexShrink: 0,
  },
  moodPillText:  { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  charBio: {
    fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 20,
    fontStyle: 'italic', marginBottom: 12, opacity: 0.82,
  },
  traitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  traitChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  traitText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  charDivider: { height: StyleSheet.hairlineWidth, marginBottom: 14 },
  charActions: { flexDirection: 'row', gap: 10 },

  followBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 26, borderWidth: 1,
  },
  followBtnText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },

  profileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 26, borderWidth: 1,
  },
  profileBtnText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },

  reportBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  contentCard: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 20, borderWidth: 1, padding: 18,
  },
  cardLabel:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardDot:       { width: 6, height: 6, borderRadius: 3 },
  cardLabelText: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 15, fontFamily: 'Satoshi-Regular',
    lineHeight: 25, fontStyle: 'italic',
  },
  storyText: {
    fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 23,
  },

  admiredRow: { alignItems: 'center', paddingVertical: 22 },
  admiredText: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.6 },

  // ── Admire burst ────────────────────────────────────────────
  admireBurst: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 90,
  },
  admireStar: {
    fontSize: 130, color: 'rgba(200,184,232,0.90)',
    textShadowColor: 'rgba(200,168,232,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 36,
  },
});
