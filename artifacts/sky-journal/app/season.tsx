/**
 * /season  — Dedicated Season page.
 *
 * Shows the current season, star-collection progress, and days remaining.
 * Extracted from the Home tab's inline stats grid so users can explore it
 * without scrolling through the full feed.
 */
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { safeBack } from '@/utils/navigation';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import {
  Animated, Easing, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

// ── Season definitions (mirrors constants in Home tab) ────────────────────────
const SEASON_BY_MONTH: Record<number, {
  name: string; icon: string; color: string; lightColor: string;
  bgA: string; bgB: string; endMonth: number;
}> = {
  0:  { name: "Winter's Light",   icon: '❄️', color: '#80C0F0', lightColor: '#41749A', bgA: 'rgba(128,192,240,0.22)', bgB: 'rgba(80,140,200,0.10)',  endMonth: 2  },
  1:  { name: "Winter's Light",   icon: '❄️', color: '#80C0F0', lightColor: '#41749A', bgA: 'rgba(128,192,240,0.22)', bgB: 'rgba(80,140,200,0.10)',  endMonth: 2  },
  2:  { name: 'Spring Season',    icon: '🌸', color: '#F4A0C0', lightColor: '#A33C6D', bgA: 'rgba(244,160,192,0.24)', bgB: 'rgba(168,100,180,0.10)', endMonth: 5  },
  3:  { name: 'Spring Season',    icon: '🌸', color: '#F4A0C0', lightColor: '#A33C6D', bgA: 'rgba(244,160,192,0.24)', bgB: 'rgba(168,100,180,0.10)', endMonth: 5  },
  4:  { name: 'Spring Season',    icon: '🌸', color: '#F4A0C0', lightColor: '#A33C6D', bgA: 'rgba(244,160,192,0.24)', bgB: 'rgba(168,100,180,0.10)', endMonth: 5  },
  5:  { name: 'Summer Solstice',  icon: '☀️', color: '#F0C040', lightColor: '#8B6100', bgA: 'rgba(240,192,64,0.24)',  bgB: 'rgba(200,120,40,0.10)',  endMonth: 8  },
  6:  { name: 'Summer Solstice',  icon: '☀️', color: '#F0C040', lightColor: '#8B6100', bgA: 'rgba(240,192,64,0.24)',  bgB: 'rgba(200,120,40,0.10)',  endMonth: 8  },
  7:  { name: 'Summer Solstice',  icon: '☀️', color: '#F0C040', lightColor: '#8B6100', bgA: 'rgba(240,192,64,0.24)',  bgB: 'rgba(200,120,40,0.10)',  endMonth: 8  },
  8:  { name: 'Autumn Memories',  icon: '🍂', color: '#E08050', lightColor: '#9D4D2A', bgA: 'rgba(224,128,80,0.24)',  bgB: 'rgba(160,80,40,0.10)',   endMonth: 11 },
  9:  { name: 'Autumn Memories',  icon: '🍂', color: '#E08050', lightColor: '#9D4D2A', bgA: 'rgba(224,128,80,0.24)',  bgB: 'rgba(160,80,40,0.10)',   endMonth: 11 },
  10: { name: 'Autumn Memories',  icon: '🍂', color: '#E08050', lightColor: '#9D4D2A', bgA: 'rgba(224,128,80,0.24)',  bgB: 'rgba(160,80,40,0.10)',   endMonth: 11 },
  11: { name: "Winter's Light",   icon: '❄️', color: '#80C0F0', lightColor: '#41749A', bgA: 'rgba(128,192,240,0.22)', bgB: 'rgba(80,140,200,0.10)',  endMonth: 2  },
};

function getSeasonStart(): Date {
  const now = new Date(), m = now.getMonth(), y = now.getFullYear();
  if (m >= 11) return new Date(y, 11, 1);
  if (m >= 8)  return new Date(y, 8, 1);
  if (m >= 5)  return new Date(y, 5, 1);
  if (m >= 2)  return new Date(y, 2, 1);
  return new Date(y - 1, 11, 1);
}

const ALL_STARS = [
  { key: 'social',   icon: '👥', color: '#78C8A8', lightColor: '#26785F' },
  { key: 'memory',   icon: '📖', color: '#9878C8', lightColor: '#65509B' },
  { key: 'quiet',    icon: '🌙', color: '#7890C8', lightColor: '#4E6398' },
  { key: 'creative', icon: '✨', color: '#C87AA8', lightColor: '#9A4974' },
  { key: 'helping',  icon: '💛', color: '#C8A84B', lightColor: '#805B13' },
  { key: 'seasonal', icon: '🍃', color: '#68B8B0', lightColor: '#307C76' },
];

export default function SeasonScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { constellation } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();

  const month  = new Date().getMonth();
  const sd     = SEASON_BY_MONTH[month]!;
  const color  = isDark ? sd.color : sd.lightColor;
  const { name, icon, bgA, bgB } = sd;

  // Season end
  const end = new Date();
  end.setMonth(sd.endMonth, 1);
  end.setHours(0, 0, 0, 0);
  if (end <= new Date()) end.setFullYear(end.getFullYear() + 1);
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - Date.now()) / 86400000));
  const dayN     = Math.max(1, Math.ceil((Date.now() - getSeasonStart().getTime()) / 86400000));

  const unlockedStars = constellation?.unlockedStars ?? [];
  const starsCount    = unlockedStars.length;
  const pct           = starsCount / 6;

  // Entrance animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => {
    Animated.timing(fadeIn, {
      toValue: 1, duration: 500,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    return () => fadeIn.setValue(0);
  }, [fadeIn]));

  const topPad    = Platform.OS === 'web' ? 60 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80 : insets.bottom + 40;
  const backgroundGradient: [string, string, string] = isDark
    ? ['#100A28', '#08061A', '#04030C']
    : ['#EEE8FB', '#F7F4ED', colors.background];

  return (
    <Animated.View style={[s.root, { backgroundColor: colors.background, opacity: fadeIn }]}>
      {/* Background */}
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[bgA, bgB, 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          style={[s.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.card, borderColor: isDark ? 'transparent' : colors.border, borderWidth: 1 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); safeBack(); }}
          activeOpacity={0.75}
        >
          <Icon name="chevron-left" size={18} color={isDark ? 'rgba(242,232,255,0.80)' : colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.foreground }]}>{t('feature.season.title')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* Season hero card */}
        <View style={[s.heroCard, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.028)' : colors.card,
          borderColor: isDark ? 'rgba(200,180,255,0.12)' : colors.border,
        }]}>
          <View style={[s.glowOrb, { backgroundColor: color }]} />
          <View style={s.eyebrowRow}>
            <Text style={s.seasonIconLg}>{icon}</Text>
            <Text style={[s.eyebrow, { color }]}>{t('feature.season.current')}</Text>
            <View style={{ flex: 1 }} />
            <View style={[s.daysChip, { backgroundColor: `${color}22`, borderColor: `${color}44` }]}>
              <Text style={[s.daysChipTxt, { color }]}>{t('feature.season.daysLeft', { n: daysLeft })}</Text>
            </View>
          </View>
          <Text style={[s.seasonName, { color: colors.foreground }]}>{name}</Text>
          <Text style={[s.dayLabel, { color: isDark ? 'rgba(200,184,232,0.65)' : colors.mutedForeground }]}>{t('feature.season.dayOfSeason', { n: dayN })}</Text>

          {/* Progress bar */}
          <View style={s.progRow}>
            <View style={[s.progTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : colors.muted }]}>
              <View style={[s.progFill, { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color }]} />
            </View>
            <Text style={[s.progLabel, { color: isDark ? `${color}BB` : color }]}>
              {t('feature.season.starsProgress', { n: starsCount })}
            </Text>
          </View>
        </View>

        {/* Stars grid */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: isDark ? 'rgba(200,184,232,0.55)' : colors.mutedForeground }]}>{t('feature.season.starsTitle')}</Text>
          <View style={s.starsGrid}>
            {ALL_STARS.map(star => {
              const unlocked = unlockedStars.includes(star.key);
              const starColor = isDark ? star.color : star.lightColor;
              return (
                <View
                  key={star.key}
                  style={[
                    s.starCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.022)' : colors.card,
                      borderColor: isDark ? 'rgba(200,185,255,0.06)' : colors.border,
                    },
                    unlocked && { borderColor: `${starColor}66`, backgroundColor: `${starColor}12` },
                  ]}
                >
                  <View style={[s.starDot, { backgroundColor: unlocked ? starColor : (isDark ? 'rgba(255,255,255,0.08)' : colors.muted) }]}>
                    {unlocked && <Text style={s.starDotIcon}>✦</Text>}
                  </View>
                  <Text style={[s.starLabel, { color: unlocked ? starColor : colors.foreground }]}>{t(`feature.season.${star.key}`)}</Text>
                  <Text style={[s.starHint, { color: isDark ? 'rgba(180,165,230,0.55)' : colors.mutedForeground }]}>{t(`feature.season.${star.key}Hint`)}</Text>
                  {unlocked && (
                    <View style={[s.unlockedBadge, { backgroundColor: `${starColor}22` }]}>
                      <Text style={[s.unlockedTxt, { color: starColor }]}>{t('feature.season.unlocked')}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* How to earn */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: isDark ? 'rgba(200,184,232,0.55)' : colors.mutedForeground }]}>{t('feature.season.advance')}</Text>
          <View style={[s.infoCard, {
            borderColor: isDark ? `${color}1E` : colors.border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.022)' : colors.card,
          }]}>
            {[
              { icon: '📖', key: 'howMemory' },
              { icon: '🌙', key: 'howQuiet' },
              { icon: '✨', key: 'howCreative' },
              { icon: '👥', key: 'howSocial' },
              { icon: '💛', key: 'howHelping' },
              { icon: '🍃', key: 'howSeasonal' },
            ].map(({ icon: ic, key }, i) => (
              <View key={i} style={s.infoRow}>
                <Text style={s.infoIcon}>{ic}</Text>
                <Text style={[s.infoText, { color: isDark ? 'rgba(200,184,232,0.72)' : colors.text }]}>{t(`feature.season.${key}`)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Write CTA */}
        <View style={s.ctaSection}>
          <TouchableOpacity
            style={[s.ctaBtn, {
              borderColor: isDark ? `${color}44` : `${color}80`,
              backgroundColor: isDark ? `${color}11` : `${color}16`,
            }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/create'); }}
            activeOpacity={0.80}
          >
            <Text style={[s.ctaBtnIcon, { color }]}>✦</Text>
            <Text style={[s.ctaBtnTxt, { color }]}>{t('feature.season.beginWriting')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04030C' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontFamily: 'Satoshi-Bold',
    color: 'rgba(242,232,255,0.95)', letterSpacing: -0.3,
  },

  // Hero card
  heroCard: {
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    borderRadius: 24, padding: 22, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.028)',
    borderWidth: 1, borderColor: 'rgba(200,180,255,0.12)',
  },
  glowOrb: {
    position: 'absolute', top: -80, right: -60,
    width: 200, height: 200, borderRadius: 100, opacity: 0.09,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  seasonIconLg: { fontSize: 18, lineHeight: 22 },
  eyebrow: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4 },
  daysChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 22, borderWidth: 1,
  },
  daysChipTxt: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  seasonName: {
    fontSize: 26, fontFamily: 'Satoshi-Bold',
    color: 'rgba(242,232,255,0.97)', letterSpacing: -0.5, marginBottom: 4,
  },
  dayLabel: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.40)', fontStyle: 'italic', marginBottom: 18,
  },
  progRow: { gap: 8 },
  progTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden',
  },
  progFill: { height: 6, borderRadius: 3 },
  progLabel: { fontSize: 11, fontFamily: 'Satoshi-Medium', letterSpacing: 0.3 },

  // Sections
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4,
    color: 'rgba(200,184,232,0.35)', marginBottom: 12, marginTop: 8,
  },

  // Stars grid
  starsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  starCard: {
    width: '47%', borderRadius: 18, padding: 14,
    backgroundColor: 'rgba(255,255,255,0.022)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.06)',
    gap: 6,
  },
  starDot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  starDotIcon: { fontSize: 12, color: '#fff' },
  starLabel: {
    fontSize: 13, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,185,255,0.70)', letterSpacing: -0.1,
  },
  starHint: {
    fontSize: 10.5, fontFamily: 'Satoshi-Regular',
    color: 'rgba(180,165,230,0.35)', lineHeight: 14,
  },
  unlockedBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 9, marginTop: 4,
  },
  unlockedTxt: { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },

  // Info card
  infoCard: {
    borderRadius: 18, padding: 16, gap: 12,
    backgroundColor: 'rgba(255,255,255,0.022)',
    borderWidth: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: { fontSize: 16, lineHeight: 20, width: 22, textAlign: 'center' },
  infoText: {
    flex: 1, fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.60)', lineHeight: 18,
  },

  // CTA
  ctaSection: { paddingHorizontal: 16, marginTop: 4, marginBottom: 8 },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 22, borderWidth: 1,
  },
  ctaBtnIcon: { fontSize: 14 },
  ctaBtnTxt: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.1 },
});
