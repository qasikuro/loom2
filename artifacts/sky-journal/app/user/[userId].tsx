import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
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

interface PublicProfile {
  userId:      string;
  name:        string;
  username:    string | null;
  bio:         string;
  traits:      string[];
  mood:        string;
  isFollowing: boolean;
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
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { userId: currentUserId } = useAuth();
  const { followingIds, followUser, unfollowUser } = useApp();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [outfits, setOutfits] = useState<PublicOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<'stories' | 'outfits'>('stories');
  const [reportSheetVisible, setReportSheetVisible] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  const isFollowing = followingIds.includes(userId ?? '');
  const isSelf      = currentUserId === userId;

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
            toValue: 1, duration: 400,
            useNativeDriver: true, easing: Easing.out(Easing.quad),
          }),
          Animated.spring(slideAnim, {
            toValue: 0, tension: 55, friction: 9, useNativeDriver: true,
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
    if (isFollowing) {
      unfollowUser(profile.userId);
    } else {
      followUser(profile.userId);
    }
  }

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80  : insets.bottom + 40;
  const moodColor = MOOD_COLORS[profile?.mood ?? 'Hopeful'] ?? colors.primary;
  const initial   = (profile?.name ?? '?').charAt(0).toUpperCase();

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
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* ── Hero banner ─────────────────────────────────────── */}
        <View style={[styles.banner, { height: topPad + 210 }]}>
          <LinearGradient
            colors={['#2A1E5E', '#3B2C7A', '#4C3A90']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
          />
          <View style={[styles.orbA, { backgroundColor: `${moodColor}20` }]} />
          <View style={[styles.orbB, { backgroundColor: 'rgba(200,168,75,0.1)' }]} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.headerBack, { top: topPad + 10 }]}
            onPress={() => router.back()}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Icon name="arrow-left" size={18} color="rgba(220,210,255,0.9)" />
          </TouchableOpacity>
        </View>

        {/* ── Profile body ─────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.body,
            { backgroundColor: colors.background },
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Avatar overlapping the banner */}
          <View style={styles.avatarArea}>
            <View style={[styles.avatarRing, { borderColor: colors.background }]}>
              <View style={[styles.avatarInner, { backgroundColor: `${moodColor}22` }]}>
                <Text style={[styles.avatarInitial, { color: moodColor }]}>{initial}</Text>
              </View>
            </View>
          </View>

          {/* Name, handle, bio */}
          <View style={styles.nameSection}>
            <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
            {profile.username ? (
              <Text style={[styles.handle, { color: colors.primary }]}>@{profile.username}</Text>
            ) : null}
            {profile.bio ? (
              <Text style={[styles.bio, { color: colors.mutedForeground }]}>{profile.bio}</Text>
            ) : null}
          </View>

          {/* Traits */}
          {profile.traits.length > 0 && (
            <View style={styles.traitsRow}>
              {profile.traits.map(t => (
                <View
                  key={t}
                  style={[styles.traitChip, { backgroundColor: `${moodColor}14`, borderColor: `${moodColor}30` }]}
                >
                  <Text style={[styles.traitText, { color: moodColor }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Follow / Unfollow button — hidden on own profile */}
          {!isSelf && (
            <TouchableOpacity
              style={[
                styles.followBtn,
                isFollowing
                  ? { backgroundColor: colors.card, borderColor: colors.border }
                  : { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={handleFollow}
              activeOpacity={0.82}
            >
              <Icon
                name={isFollowing ? 'user-check' : 'user-plus'}
                size={15}
                color={isFollowing ? colors.mutedForeground : '#fff'}
              />
              <Text style={[styles.followBtnText, { color: isFollowing ? colors.mutedForeground : '#fff' }]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}

          {!isSelf && isFollowing && (
            <View style={[styles.notifyBanner, { backgroundColor: `${moodColor}10`, borderColor: `${moodColor}28` }]}>
              <Icon name="bell" size={13} color={moodColor} />
              <Text style={[styles.notifyText, { color: moodColor }]}>
                You'll see new posts from {profile.name} in your Discover feed
              </Text>
            </View>
          )}

          {!isSelf && (
            <TouchableOpacity
              style={styles.reportLink}
              onPress={() => setReportSheetVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="flag" size={11} color="rgba(180,100,100,0.6)" />
              <Text style={styles.reportLinkText}>Report this profile</Text>
            </TouchableOpacity>
          )}

          {/* Tab switcher */}
          <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
            {(['stories', 'outfits'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setTab(t)}
              >
                <Icon
                  name={t === 'stories' ? 'book-open' : 'grid'}
                  size={14}
                  color={tab === t ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.tabLabel, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
                  {t === 'stories' ? `Stories (${stories.length})` : `Outfits (${outfits.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Stories list ───────────────────────────────── */}
          {tab === 'stories' && (
            <View style={styles.contentList}>
              {stories.length === 0 ? (
                <View style={styles.emptyState}>
                  <Icon name="book-open" size={28} color={`${colors.primary}40`} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No public stories yet
                  </Text>
                </View>
              ) : (
                stories.map(story => {
                  const mc = MOOD_COLORS[story.mood] ?? colors.primary;
                  const firstPanel = story.panels[0];
                  return (
                    <TouchableOpacity
                      key={story.id}
                      style={[styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}
                      onPress={() => router.push({ pathname: '/story/[id]', params: { id: story.id, source: 'discover' } } as any)}
                      activeOpacity={0.84}
                    >
                      {firstPanel?.imageUri ? (
                        <Image
                          source={{ uri: firstPanel.imageUri }}
                          style={styles.storyCover}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <LinearGradient
                          colors={[`${mc}44`, `${mc}14`]}
                          style={styles.storyCover}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                      )}
                      <View style={styles.storyMeta}>
                        <Text style={[styles.storyTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {story.chapterTitle}
                        </Text>
                        <Text style={[styles.storySnippet, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {firstPanel?.text ?? ''}
                        </Text>
                        <View style={styles.storyStats}>
                          <View style={styles.statItem}>
                            <Icon name="eye" size={11} color={colors.mutedForeground} />
                            <Text style={[styles.statText, { color: colors.mutedForeground }]}>{story.witnessedCount}</Text>
                          </View>
                          <View style={[styles.moodPill, { backgroundColor: `${mc}14`, borderColor: `${mc}28` }]}>
                            <Text style={[styles.moodPillText, { color: mc }]}>{story.mood}</Text>
                          </View>
                          <Text style={[styles.statText, { color: colors.mutedForeground }]}>{fmtDate(story.date)}</Text>
                        </View>
                      </View>
                      <Icon name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* ── Outfits grid ───────────────────────────────── */}
          {tab === 'outfits' && (
            <View style={styles.contentList}>
              {outfits.length === 0 ? (
                <View style={styles.emptyState}>
                  <Icon name="grid" size={28} color={`${colors.primary}40`} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No public outfits yet
                  </Text>
                </View>
              ) : (
                <View style={styles.outfitsGrid}>
                  {outfits.map(outfit => (
                    <TouchableOpacity
                      key={outfit.id}
                      style={[styles.outfitCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}
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
                      activeOpacity={0.84}
                    >
                      {outfit.imageUri ? (
                        <Image
                          source={{ uri: outfit.imageUri }}
                          style={styles.outfitImg}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <LinearGradient
                          colors={[`${moodColor}33`, `${moodColor}0a`]}
                          style={styles.outfitImg}
                        />
                      )}
                      <View style={styles.outfitMeta}>
                        <Text style={[styles.outfitName, { color: colors.foreground }]} numberOfLines={1}>
                          {outfit.name}
                        </Text>
                        {outfit.tags.length > 0 && (
                          <Text style={[styles.outfitTags, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {outfit.tags.slice(0, 3).join(' · ')}
                          </Text>
                        )}
                      </View>
                      <View style={styles.outfitArrow}>
                        <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <ReportSheet
        visible={reportSheetVisible}
        targetType="user"
        targetId={userId ?? ''}
        targetLabel={profile?.name}
        onClose={() => setReportSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },

  banner:    { width: '100%', overflow: 'hidden', position: 'relative' },
  orbA:      { position: 'absolute', top: 30, left: -40, width: 180, height: 180, borderRadius: 90 },
  orbB:      { position: 'absolute', bottom: -20, right: -30, width: 140, height: 140, borderRadius: 70 },
  headerBack: {
    position: 'absolute', left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(14,12,36,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },

  body: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16 },

  avatarArea:  { alignItems: 'center', marginTop: -44, marginBottom: 14 },
  avatarRing:  { borderWidth: 4, borderRadius: 50, padding: 0 },
  avatarInner: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 30, fontFamily: 'Inter_700Bold' },

  nameSection: { alignItems: 'center', marginBottom: 12, gap: 4 },
  name:        { fontSize: 20, fontFamily: 'Inter_700Bold' },
  handle:      { fontSize: 14, fontFamily: 'Inter_500Medium' },
  bio:         { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, opacity: 0.8, marginTop: 4, paddingHorizontal: 12 },

  traitsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 },
  traitChip:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  traitText:  { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 11,
    borderRadius: 24, borderWidth: 1,
    alignSelf: 'center', marginBottom: 10,
  },
  followBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  notifyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16, marginHorizontal: 4,
  },
  notifyText: { fontSize: 12, fontFamily: 'Inter_400Regular', flex: 1, lineHeight: 18 },

  reportLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center', marginBottom: 14,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  reportLinkText: {
    fontSize: 11, fontFamily: 'Inter_400Regular',
    color: 'rgba(180,100,100,0.6)', fontStyle: 'italic',
  },

  tabRow:     { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 16, marginTop: 6 },
  tabBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:   { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  contentList: { gap: 10, paddingBottom: 8 },

  storyCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    borderWidth: 1, padding: 12, gap: 12,
  },
  storyCover:   { width: 64, height: 72, borderRadius: 10 },
  storyMeta:    { flex: 1, gap: 4 },
  storyTitle:   { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  storySnippet: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, opacity: 0.8 },
  storyStats:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  statItem:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:     { fontSize: 11, fontFamily: 'Inter_400Regular' },
  moodPill:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  moodPillText: { fontSize: 10, fontFamily: 'Inter_500Medium' },

  outfitsGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  outfitCard:   { width: '47.5%', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  outfitImg:    { width: '100%', height: 120 },
  outfitMeta:   { padding: 10, gap: 3 },
  outfitName:   { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  outfitTags:   { fontSize: 11, fontFamily: 'Inter_400Regular', opacity: 0.7 },
  outfitArrow:  { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText:  { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  errorText:    { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 8 },
  backBtn:      { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  backBtnText:  { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
