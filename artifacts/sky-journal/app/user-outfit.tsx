import { Icon } from '@/components/Icon';
import { SHADOW } from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { ReportSheet } from '@/components/ReportSheet';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#8B7AB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
  Romantic: '#C47AB5', Chaotic: '#B57A7A', Soft: '#A5A5D4',
  Adventurous: '#7AB595', Lonely: '#7A8BA5',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  } catch {
    return '';
  }
}

export default function UserOutfitScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { followingIds, followUser, unfollowUser } = useApp();
  const params  = useLocalSearchParams<{
    outfitName:   string;
    outfitDesc:   string;
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
  const isFollowing = followingIds.includes(params.authorUserId ?? '');
  const initial = (params.authorName ?? '?').charAt(0).toUpperCase();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80  : insets.bottom + 16;

  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [120, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const imageScale = scrollY.interpolate({
    inputRange: [-80, 0],
    outputRange: [1.14, 1],
    extrapolate: 'clamp',
  });

  function handleFollow() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isFollowing) {
      unfollowUser(params.authorUserId!);
    } else {
      followUser(params.authorUserId!);
    }
  }

  const IMG_H = 340;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Sticky mini-header (fades in on scroll) ─────────── */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { paddingTop: topPad, backgroundColor: colors.background, borderBottomColor: colors.border, opacity: headerOpacity },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.stickyTitle, { color: colors.foreground }]} numberOfLines={1}>
          {params.outfitName}
        </Text>
        <View style={{ width: 28 }} />
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Hero image ───────────────────────────────────────── */}
        <View style={[styles.heroWrap, { height: IMG_H }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: imageScale }] }]}>
            {params.outfitImage ? (
              <Image source={{ uri: params.outfitImage }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            ) : (
              <LinearGradient
                colors={[`${moodColor}55`, `${moodColor}18`, colors.background]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              />
            )}
          </Animated.View>

          {/* Gradient fade at bottom */}
          <LinearGradient
            colors={['transparent', colors.background]}
            style={styles.heroFade}
            pointerEvents="none"
          />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: topPad + 10, backgroundColor: 'rgba(0,0,0,0.38)' }]}
            onPress={() => router.back()}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>

          {/* Outfit name over image */}
          <View style={[styles.heroLabel, { bottom: 24 }]}>
            <Text style={styles.heroName}>{params.outfitName}</Text>
            {params.outfitDate ? (
              <View style={styles.datePill}>
                <Icon name="calendar" size={10} color="rgba(240,228,200,0.85)" />
                <Text style={styles.datePillText}>{fmtDate(params.outfitDate)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Vibe tags ────────────────────────────────────────── */}
        {tags.length > 0 && (
          <View style={styles.tagsRow}>
            {tags.map(tag => (
              <View key={tag} style={[styles.tag, { backgroundColor: `${moodColor}16`, borderColor: `${moodColor}30` }]}>
                <Text style={[styles.tagText, { color: moodColor }]}>✦ {tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Description / notes ──────────────────────────────── */}
        {!!params.outfitDesc && (
          <View style={[styles.descCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
            <View style={styles.descHeader}>
              <Icon name="file-text" size={14} color={colors.primary} />
              <Text style={[styles.descLabel, { color: colors.primary }]}>Notes</Text>
            </View>
            <Text style={[styles.descText, { color: colors.foreground }]}>{params.outfitDesc}</Text>
          </View>
        )}

        {/* ── Divider ──────────────────────────────────────────── */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerLabel, { color: colors.mutedForeground }]}>✦ Character ✦</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* ── Character chart card ─────────────────────────────── */}
        <View style={[styles.charCard, { backgroundColor: colors.card, borderColor: `${moodColor}28` }, SHADOW.sm]}>

          {/* Subtle mood gradient wash */}
          <LinearGradient
            colors={[`${moodColor}12`, 'transparent']}
            style={styles.charCardGrad}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            pointerEvents="none"
          />

          {/* Avatar + name row */}
          <View style={styles.charTop}>
            <View style={[styles.charAvatar, { backgroundColor: `${moodColor}22`, borderColor: `${moodColor}40` }]}>
              <Text style={[styles.charInitial, { color: moodColor }]}>{initial}</Text>
            </View>
            <View style={styles.charNameBlock}>
              <Text style={[styles.charName, { color: colors.foreground }]}>{params.authorName}</Text>
              {params.authorHandle ? (
                <Text style={[styles.charHandle, { color: colors.primary }]}>@{params.authorHandle}</Text>
              ) : null}
            </View>
            {params.authorMood ? (
              <View style={[styles.moodBadge, { backgroundColor: `${moodColor}18`, borderColor: `${moodColor}30` }]}>
                <Text style={[styles.moodBadgeText, { color: moodColor }]}>{params.authorMood}</Text>
              </View>
            ) : null}
          </View>

          {/* Bio */}
          {!!params.authorBio && (
            <Text style={[styles.charBio, { color: colors.mutedForeground }]}>
              {params.authorBio}
            </Text>
          )}

          {/* Traits */}
          {traits.length > 0 && (
            <View style={styles.traitsRow}>
              {traits.map(t => (
                <View key={t} style={[styles.traitChip, { backgroundColor: `${moodColor}14`, borderColor: `${moodColor}28` }]}>
                  <Text style={[styles.traitText, { color: moodColor }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Divider */}
          <View style={[styles.charDivider, { backgroundColor: colors.border }]} />

          {/* Follow row */}
          <View style={styles.charActions}>
            <TouchableOpacity
              style={[
                styles.followBtn,
                isFollowing
                  ? { backgroundColor: colors.muted, borderColor: colors.border }
                  : { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={handleFollow}
              activeOpacity={0.82}
            >
              <Icon name={isFollowing ? 'user-check' : 'user-plus'} size={14} color={isFollowing ? colors.mutedForeground : '#fff'} />
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
              <Text style={[styles.profileBtnText, { color: colors.mutedForeground }]}>Full Profile</Text>
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
      </Animated.ScrollView>

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
  root: { flex: 1 },

  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyTitle: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },

  heroWrap:   { width: '100%', overflow: 'hidden' },
  heroFade:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  backBtn:    {
    position: 'absolute', left: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  heroLabel:  { position: 'absolute', left: 20, right: 20 },
  heroName:   {
    fontSize: 26, fontFamily: 'Inter_700Bold', color: '#fff',
    letterSpacing: -0.5, lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  datePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(20,16,42,0.52)', borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(200,168,75,0.25)',
  },
  datePillText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: 'rgba(240,228,200,0.9)' },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 6, marginBottom: 4 },
  tag:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  descCard:   { marginHorizontal: 16, marginTop: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
  descHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  descLabel:  { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, textTransform: 'uppercase' },
  descText:   { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22, fontStyle: 'italic' },

  dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginVertical: 22 },
  dividerLine:  { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 1 },

  charCard:     { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, borderWidth: 1, padding: 18, overflow: 'hidden' },
  charCardGrad: { ...StyleSheet.absoluteFillObject },

  charTop:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  charAvatar:   { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  charInitial:  { fontSize: 22, fontFamily: 'Inter_700Bold' },
  charNameBlock:{ flex: 1, gap: 2 },
  charName:     { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  charHandle:   { fontSize: 13, fontFamily: 'Inter_500Medium' },

  moodBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, flexShrink: 0 },
  moodBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  charBio:  { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, fontStyle: 'italic', marginBottom: 12, opacity: 0.85 },

  traitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  traitChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  traitText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },

  charDivider: { height: StyleSheet.hairlineWidth, marginBottom: 14 },
  charActions: { flexDirection: 'row', gap: 10 },

  followBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 22, borderWidth: 1 },
  followBtnText:  { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  profileBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 22, borderWidth: 1 },
  profileBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  reportBtn:      { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
