import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@clerk/expo';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import { ReportSheet } from '@/components/ReportSheet';

const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#8B7AB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

interface ActiveOutfit {
  id:          string;
  name:        string;
  description: string;
  imageUri:    string | null;
  tags:        string[];
}

interface PublicProfile {
  userId:        string;
  name:          string;
  username:      string | null;
  bio:           string;
  traits:        string[];
  mood:          string;
  avatarUri:     string | null;
  activeOutfitId: string | null;
  activeOutfit:  ActiveOutfit | null;
  isFollowing:   boolean;
}

interface PublicStory {
  id:             string;
  chapterTitle:   string;
  mood:           string;
  location:       string;
  panels:         { text?: string; imageUri?: string }[];
  witnessedCount: number;
  savedCount:     number;
  date:           string;
}

interface PublicOutfit {
  id:          string;
  name:        string;
  description: string;
  imageUri:    string | null;
  tags:        string[];
  date:        string;
}

export default function UserProfileScreen() {
  const { userId }          = useLocalSearchParams<{ userId: string }>();
  const colors              = useColors();
  const { t }               = useTranslation();
  const insets              = useSafeAreaInsets();
  const { userId: meId }    = useAuth();
  const { followingIds, followUser, unfollowUser } = useApp();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [outfits, setOutfits] = useState<PublicOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;

  const isFollowing = followingIds.includes(userId ?? '');
  const isSelf      = meId === userId;

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80  : insets.bottom + 40;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const [prof, stors, outs] = await Promise.all([
          apiFetch<PublicProfile>(`/users/${userId}`),
          apiFetch<PublicStory[]>(`/users/${userId}/stories`),
          apiFetch<PublicOutfit[]>(`/users/${userId}/outfits`),
        ]);
        setProfile(prof);
        setStories(stors);
        setOutfits(outs);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1, duration: 450,
            useNativeDriver: true, easing: Easing.out(Easing.quad),
          }),
          Animated.spring(slideAnim, {
            toValue: 0, tension: 50, friction: 9, useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1, tension: 55, friction: 9, useNativeDriver: true,
          }),
        ]).start();
      } catch {
        setError('Could not load this profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  function handleFollow() {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isFollowing) unfollowUser(profile.userId);
    else             followUser(profile.userId);
  }

  const moodColor = MOOD_COLORS[profile?.mood ?? 'Hopeful'] ?? colors.primary;
  const initial   = (profile?.name ?? '?').charAt(0).toUpperCase();
  const totalWitnessed = stories.reduce((s, st) => s + st.witnessedCount, 0);
  const isTopExplorer  = totalWitnessed >= 10 || stories.length >= 3;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Icon name="alert-circle" size={36} color={colors.mutedForeground} />
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
          {error ?? 'Profile not found.'}
        </Text>
        <TouchableOpacity
          style={[styles.backBtnErr, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backBtnErrText, { color: colors.primary }]}>{t('common.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>

        {/* ── HERO BANNER ─────────────────────────────────────────── */}
        <View style={[styles.banner, { height: topPad + 230 }]}>
          <LinearGradient
            colors={['#0A0818', '#1C0E4A', '#2C1462']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
          />
          {/* Mood-tinted orbs */}
          <View style={[styles.orbA, { backgroundColor: `${moodColor}22` }]} />
          <View style={[styles.orbB, { backgroundColor: 'rgba(200,168,75,0.10)' }]} />
          <View style={[styles.orbC, { backgroundColor: `${colors.primary}12` }]} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.topBtn, { top: topPad + 10, left: 16, backgroundColor: 'rgba(12,10,30,0.60)' }]}
            onPress={() => router.back()}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="arrow-left" size={17} color="rgba(220,210,255,0.92)" />
          </TouchableOpacity>

          {/* More / report button */}
          <TouchableOpacity
            style={[styles.topBtn, { top: topPad + 10, right: 16, backgroundColor: 'rgba(12,10,30,0.60)' }]}
            onPress={() => setReportVisible(true)}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="more-horizontal" size={17} color="rgba(220,210,255,0.92)" />
          </TouchableOpacity>

          {/* Top Explorer badge */}
          {isTopExplorer && (
            <View style={[styles.explorerBadge, { top: topPad + 10, right: 60, backgroundColor: 'rgba(232,184,48,0.18)', borderColor: 'rgba(232,184,48,0.40)' }]}>
              <Text style={{ fontSize: 12 }}>🏆</Text>
              <Text style={[styles.explorerBadgeText, { color: '#E8B830' }]}>Top Explorer</Text>
            </View>
          )}

          {/* Avatar centered in banner, floating at bottom */}
          <View style={styles.avatarInBanner}>
            {/* Glow ring */}
            <View style={[styles.avatarGlowRing, { borderColor: `${moodColor}55`, backgroundColor: `${moodColor}12` }]} />
            <View style={[styles.avatarRingOuter, { borderColor: moodColor }]}>
              <View style={[styles.avatarRingInner, { borderColor: `${moodColor}40`, backgroundColor: colors.card }]}>
                {profile.avatarUri ? (
                  <Image
                    source={{ uri: profile.avatarUri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <Text style={[styles.avatarInitial, { color: moodColor }]}>{initial}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* ── FLOATING PROFILE CARD ───────────────────────────────── */}
        <Animated.View
          style={[
            styles.profileCard,
            { backgroundColor: colors.card, borderColor: colors.border },
            SHADOW.md,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          {/* Name + badge */}
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
            <View style={[styles.nameBadge, { backgroundColor: `${colors.gold}20`, borderColor: `${colors.gold}35` }]}>
              <Text style={{ fontSize: 12 }}>✦</Text>
            </View>
            {!isSelf && (
              <TouchableOpacity
                style={[
                  styles.followPill,
                  isFollowing
                    ? { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40` }
                    : { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={handleFollow}
                activeOpacity={0.82}
              >
                <Text style={[styles.followPillText, { color: isFollowing ? colors.primary : '#fff' }]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* @handle */}
          {profile.username ? (
            <Text style={[styles.handle, { color: colors.primary }]}>@{profile.username}</Text>
          ) : null}

          {/* Bio */}
          {profile.bio ? (
            <Text style={[styles.bio, { color: colors.mutedForeground }]} numberOfLines={3}>
              {profile.bio}
            </Text>
          ) : null}

          {/* Trait chips horizontal scroll */}
          {profile.traits.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.traitsScroll}
              contentContainerStyle={styles.traitsRow}
            >
              {profile.traits.map(tr => (
                <View
                  key={tr}
                  style={[styles.traitChip, { backgroundColor: `${moodColor}14`, borderColor: `${moodColor}30` }]}
                >
                  <Text style={[styles.traitText, { color: moodColor }]}>{tr}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.primary }]}>{stories.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Stories</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.gold }]}>{outfits.length}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Outfits</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: '#6BA57A' }]}>{totalWitnessed}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Witnessed</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── BODY ─────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.body,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Following notification banner */}
          {!isSelf && isFollowing && (
            <View style={[styles.notifyBanner, { backgroundColor: `${moodColor}10`, borderColor: `${moodColor}28` }]}>
              <Icon name="bell" size={13} color={moodColor} />
              <Text style={[styles.notifyText, { color: moodColor }]}>
                You'll see new posts from {profile.name} in your Discover feed
              </Text>
            </View>
          )}

          {/* ── CURRENT OUTFIT spotlight ─────────────────────────── */}
          {profile.activeOutfit && (
            <TouchableOpacity
              style={[styles.spotlightCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.sm]}
              onPress={() => {
                router.push({
                  pathname: '/user-outfit',
                  params: {
                    outfitName:   profile.activeOutfit!.name,
                    outfitDesc:   profile.activeOutfit!.description ?? '',
                    outfitImage:  profile.activeOutfit!.imageUri ?? '',
                    outfitTags:   JSON.stringify(profile.activeOutfit!.tags),
                    outfitDate:   '',
                    authorUserId: profile.userId,
                    authorName:   profile.name,
                    authorHandle: profile.username ?? '',
                    authorBio:    profile.bio ?? '',
                    authorMood:   profile.mood ?? '',
                    authorTraits: JSON.stringify(profile.traits),
                  },
                } as any);
              }}
              activeOpacity={0.86}
            >
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Current Outfit</Text>
              <View style={styles.spotlightRow}>
                {/* Left: outfit image */}
                <View style={[styles.spotlightImgWrap, { backgroundColor: `${moodColor}18` }]}>
                  {profile.activeOutfit.imageUri ? (
                    <Image
                      source={{ uri: profile.activeOutfit.imageUri }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <LinearGradient
                      colors={[`${moodColor}50`, `${moodColor}18`]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(8,6,22,0.85)']}
                    style={[StyleSheet.absoluteFill, styles.spotlightImgGrad]}
                  >
                    <Text style={styles.spotlightImgName} numberOfLines={2}>{profile.activeOutfit.name}</Text>
                  </LinearGradient>
                </View>
                {/* Right: info */}
                <View style={styles.spotlightInfo}>
                  <Text style={[styles.spotlightAboutLabel, { color: `${colors.mutedForeground}88` }]}>About this look</Text>
                  <Text style={[styles.spotlightDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {profile.activeOutfit.description || profile.activeOutfit.name}
                  </Text>
                  <View style={styles.spotlightTags}>
                    {(profile.activeOutfit.tags ?? []).slice(0, 3).map(tag => (
                      <View key={tag} style={[styles.spotlightTag, { backgroundColor: `${moodColor}14`, borderColor: `${moodColor}28` }]}>
                        <Text style={[styles.spotlightTagText, { color: moodColor }]}>{tag}</Text>
                      </View>
                    ))}
                    {(profile.activeOutfit.tags ?? []).length === 0 && (
                      <View style={[styles.spotlightTag, { backgroundColor: `${colors.gold}14`, borderColor: `${colors.gold}28` }]}>
                        <Text style={[styles.spotlightTagText, { color: colors.gold }]}>Outfit</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* ── OTHER OUTFITS horizontal row ──────────────────────── */}
          {outfits.length > 0 && (
            <View style={styles.hSection}>
              <View style={styles.hSectionHeader}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>Other Outfits</Text>
                <Text style={[styles.hSectionCount, { color: colors.mutedForeground }]}>{outfits.length}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScrollContent}
              >
                {outfits.map(outfit => (
                  <TouchableOpacity
                    key={outfit.id}
                    style={[styles.hOutfitCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({
                        pathname: '/user-outfit',
                        params: {
                          outfitName:   outfit.name,
                          outfitDesc:   outfit.description ?? '',
                          outfitImage:  outfit.imageUri ?? '',
                          outfitTags:   JSON.stringify(outfit.tags),
                          outfitDate:   outfit.date,
                          authorUserId: profile.userId,
                          authorName:   profile.name,
                          authorHandle: profile.username ?? '',
                          authorBio:    profile.bio ?? '',
                          authorMood:   profile.mood ?? '',
                          authorTraits: JSON.stringify(profile.traits),
                        },
                      } as any);
                    }}
                    activeOpacity={0.85}
                  >
                    {outfit.imageUri ? (
                      <Image
                        source={{ uri: outfit.imageUri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <LinearGradient
                        colors={[`${moodColor}50`, `${moodColor}18`]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(8,6,22,0.90)']}
                      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}
                    >
                      <Text style={styles.hOutfitName} numberOfLines={2}>{outfit.name}</Text>
                    </LinearGradient>
                    {outfit.tags.length > 0 && (
                      <View style={[styles.hTagPill, { backgroundColor: 'rgba(8,6,22,0.72)' }]}>
                        <Text style={styles.hTagPillText}>{outfit.tags[0]}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── STORIES horizontal row ─────────────────────────────── */}
          {stories.length > 0 && (
            <View style={styles.hSection}>
              <View style={styles.hSectionHeader}>
                <Text style={[styles.hSectionTitle, { color: colors.foreground }]}>Stories</Text>
                <Text style={[styles.hSectionCount, { color: colors.mutedForeground }]}>{stories.length}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScrollContent}
              >
                {stories.map(story => {
                  const mc         = MOOD_COLORS[story.mood] ?? colors.primary;
                  const firstPanel = story.panels[0];
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={[styles.hStoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id, source: 'discover' } } as any)}
                      activeOpacity={0.86}
                    >
                      {firstPanel?.imageUri ? (
                        <Image
                          source={{ uri: firstPanel.imageUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <LinearGradient
                          colors={[`${mc}55`, `${mc}18`]}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(8,6,22,0.88)']}
                        style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}
                      >
                        <Text style={styles.hStoryTitle} numberOfLines={2}>{story.chapterTitle}</Text>
                        <View style={styles.hStoryMeta}>
                          <View style={styles.hStoryWitness}>
                            <Icon name="eye" size={10} color="rgba(200,184,232,0.75)" />
                            <Text style={styles.hStoryWitnessText}>{story.witnessedCount}</Text>
                          </View>
                          <View style={[styles.hMoodPill, { backgroundColor: `${mc}28` }]}>
                            <Text style={[styles.hMoodPillText, { color: mc }]}>{story.mood}</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Empty state when both are empty */}
          {stories.length === 0 && outfits.length === 0 && !profile.activeOutfit && (
            <View style={[styles.emptyState, { borderColor: `${colors.primary}18` }]}>
              <Icon name="star" size={28} color={`${colors.primary}40`} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {profile.name} hasn't shared anything yet
              </Text>
            </View>
          )}

          {/* Report link */}
          {!isSelf && (
            <TouchableOpacity
              style={styles.reportLink}
              onPress={() => setReportVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="flag" size={11} color="rgba(180,100,100,0.55)" />
              <Text style={styles.reportLinkText}>{t('discover.reportProfile')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

      </ScrollView>

      <ReportSheet
        visible={reportVisible}
        targetType="user"
        targetId={userId ?? ''}
        targetLabel={profile?.name}
        onClose={() => setReportVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  errorText: { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center' },
  backBtnErr: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, marginTop: 4,
  },
  backBtnErrText: { fontSize: 14, fontFamily: 'Satoshi-Medium' },

  // ── Banner
  banner: { width: '100%', overflow: 'hidden', position: 'relative' },
  orbA:   { position: 'absolute', top: 20, left: -50, width: 200, height: 200, borderRadius: 100 },
  orbB:   { position: 'absolute', bottom: 30, right: -40, width: 160, height: 160, borderRadius: 80 },
  orbC:   { position: 'absolute', top: 60, right: 40, width: 100, height: 100, borderRadius: 50 },

  topBtn: {
    position: 'absolute',
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.14)',
  },
  explorerBadge: {
    position: 'absolute',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  explorerBadgeText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },

  // Avatar inside banner
  avatarInBanner: {
    position: 'absolute',
    bottom: 40, left: 0, right: 0,
    alignItems: 'center',
  },
  avatarGlowRing: {
    position: 'absolute',
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 1,
  },
  avatarRingOuter: {
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarRingInner: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 34, fontFamily: 'Satoshi-Bold' },

  // ── Floating profile card
  profileCard: {
    marginTop: -44,
    marginHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: { fontSize: 19, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  nameBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1,
  },
  followPill: {
    marginLeft: 'auto',
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 18, borderWidth: 1,
  },
  followPillText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  handle: { fontSize: 13, fontFamily: 'Satoshi-Medium', marginTop: 1 },
  bio: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', lineHeight: 17,
    marginTop: 2,
  },

  traitsScroll: { marginTop: 8, marginHorizontal: -16 },
  traitsRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 2 },
  traitChip: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 16, borderWidth: 1,
  },
  traitText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },

  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginHorizontal: -16,
    marginTop: 10,
    paddingVertical: 11,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 1 },
  statNum:  { fontSize: 16, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  statLabel: { fontSize: 10, fontFamily: 'Satoshi-Regular' },
  statDivider: { width: 1, marginVertical: 4 },

  // ── Body
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },

  notifyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    padding: 13, borderRadius: 16, borderWidth: 1,
  },
  notifyText: { flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 18 },

  // Spotlight card (current outfit)
  spotlightCard: {
    borderRadius: 20, borderWidth: 1, padding: 14,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.4, textTransform: 'uppercase',
    marginBottom: 10,
  },
  spotlightRow: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  spotlightImgWrap: {
    width: 120, height: 144,
    borderRadius: 14, overflow: 'hidden',
  },
  spotlightImgGrad: { justifyContent: 'flex-end', padding: 8 },
  spotlightImgName: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)', lineHeight: 14,
  },
  spotlightInfo: { flex: 1, gap: 6, paddingTop: 2 },
  spotlightAboutLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  spotlightDesc: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', lineHeight: 19,
  },
  spotlightTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  spotlightTag: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 9, borderWidth: 1,
  },
  spotlightTagText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },

  // Horizontal sections
  hSection: { gap: 10 },
  hSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hSectionTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  hSectionCount: { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  hScrollContent: { gap: 10, paddingRight: 16 },

  hOutfitCard: {
    width: 100, height: 130,
    borderRadius: 14, overflow: 'hidden', borderWidth: 1,
    position: 'relative',
  },
  hOutfitName: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)', lineHeight: 13,
  },
  hTagPill: {
    position: 'absolute', top: 7, left: 7,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  hTagPillText: {
    fontSize: 9, fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,200,255,0.9)',
  },

  hStoryCard: {
    width: 130, height: 168,
    borderRadius: 14, overflow: 'hidden', borderWidth: 1,
    position: 'relative',
  },
  hStoryTitle: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,234,255,0.95)', lineHeight: 14,
    marginBottom: 5,
  },
  hStoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hStoryWitness: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hStoryWitnessText: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.8)',
  },
  hMoodPill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  hMoodPillText: { fontSize: 9, fontFamily: 'Satoshi-Bold' },

  emptyState: {
    alignItems: 'center', gap: 10,
    paddingVertical: 40, borderRadius: 16,
    borderWidth: 1, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 13, fontFamily: 'Satoshi-Regular', textAlign: 'center' },

  reportLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', paddingVertical: 4, marginTop: 8,
  },
  reportLinkText: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(180,100,100,0.55)',
  },
});
