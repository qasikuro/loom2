import { Icon } from '@/components/Icon';
import { DiscoverCard } from '@/components/DiscoverCard';
import { SkeletonDiscoverCard } from '@/components/Skeleton';
import { ReportSheet } from '@/components/ReportSheet';
import { MoodDoorModal } from '@/components/MoodDoorModal';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from 'react-i18next';
import { SHADOW } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;

const TABS = ['Stories', 'Guides', 'Vibes', 'People'] as const;
type TabType = (typeof TABS)[number];

const TAB_ICONS: Record<TabType, string> = {
  Stories: '✦',
  Guides:  '★',
  Vibes:   '◈',
  People:  '◉',
};

const GUIDE_TOPICS = [
  'Anxiety & Stress', 'Motivation', 'Self Growth', 'Relationships',
  'Loneliness', 'Creativity', 'Spirituality', 'Mental Health',
  'Dreams & Goals', 'Grief', 'Social Skills', 'Mindfulness',
];

const TOPIC_COLORS: Record<string, string> = {
  'Anxiety & Stress': '#E87898',
  'Motivation':       '#E8A850',
  'Self Growth':      '#68C890',
  'Relationships':    '#D878B0',
  'Loneliness':       '#7890C8',
  'Creativity':       '#B878E8',
  'Spirituality':     '#C8A84B',
  'Mental Health':    '#78B8D8',
  'Dreams & Goals':   '#9878D8',
  'Grief':            '#8890A8',
  'Social Skills':    '#78C8A8',
  'Mindfulness':      '#68B8B0',
};

const VIBES = [
  { label: 'Soft',        icon: 'feather'  as const, color: '#9B87C8', dark: '#2D1E4A' },
  { label: 'Lonely',      icon: 'moon'     as const, color: '#6B8EC8', dark: '#1A2A4A' },
  { label: 'Romantic',    icon: 'heart'    as const, color: '#C87AA8', dark: '#3A1830' },
  { label: 'Chaotic',     icon: 'zap'      as const, color: '#C87850', dark: '#3A1A0A' },
  { label: 'Peaceful',    icon: 'cloud'    as const, color: '#58A0B8', dark: '#0A2A38' },
  { label: 'Adventurous', icon: 'wind'     as const, color: '#58A878', dark: '#0A2A1A' },
  { label: 'Dreamy',      icon: 'star'     as const, color: '#9878C8', dark: '#2A1848' },
  { label: 'Hopeful',     icon: 'sunrise'  as const, color: '#C8A050', dark: '#3A2800' },
];

interface UserSearchResult {
  userId:      string;
  username:    string | null;
  name:        string;
  bio:         string;
  traits:      string[];
  avatarUri:   string | null;
  isFollowing: boolean;
}

interface GuideResult {
  userId:            string;
  name:              string;
  username:          string | null;
  bio:               string;
  guideBio:          string;
  guideTopics:       string[];
  guideAvailability: { days: number[]; timeFrom: string; timeTo: string } | null;
  peaceRating:       number;
  dreamersGuided:    number;
  followerCount:     number;
  avatarUri:         string | null;
  mood:              string;
  isFollowing:       boolean;
  isAvailableNow:    boolean;
}

export default function DiscoverScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { t }     = useTranslation();
  const { discoverPosts, toggleSavePost, followingIds, followUser, unfollowUser, refreshFeed, isLoading,
          apiOnline, discoverLoadError, reloadData, isRefreshing,
          discoverMoodFilter, setDiscoverMoodFilter,
          hasCorruptedDiscover } = useApp();

  const [activeTab,     setActiveTab]     = useState<TabType>('Stories');
  const [storiesSort,   setStoriesSort]   = useState<'for-you' | 'new'>('for-you');
  const [selectedVibe,  setSelectedVibe]  = useState<string | null>(null);
  const [peopleQuery,   setPeopleQuery]   = useState('');
  const [peopleResults, setPeopleResults] = useState<UserSearchResult[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError,   setPeopleError]   = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [refreshing,    setRefreshing]    = useState(false);
  const [guidesData,    setGuidesData]    = useState<GuideResult[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guidesError,   setGuidesError]   = useState<string | null>(null);
  const [guideTopicFilter, setGuideTopicFilter] = useState<string | null>(null);
  const [guideAvailNow,    setGuideAvailNow]    = useState(false);
  const [moodDoorVisible, setMoodDoorVisible] = useState(false);
  const searchTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef     = useRef<number>(0);
  const guidesLoaded     = useRef(false);
  const moodDoorShown    = useRef(false);

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 130;

  // Refresh the discover feed when the tab comes into focus,
  // but at most once every 2 minutes to avoid hammering the API.
  // Also show the mood door on the first focus of each app session.
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 2 * 60 * 1000) {
      lastFetchRef.current = now;
      refreshFeed().catch(() => null);
    }
    if (!moodDoorShown.current) {
      moodDoorShown.current = true;
      // Small delay so the tab transition finishes before overlay appears
      const t = setTimeout(() => setMoodDoorVisible(true), 350);
      return () => clearTimeout(t);
    }
  }, [refreshFeed]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastFetchRef.current = Date.now();
    await refreshFeed().catch(() => null);
    setRefreshing(false);
  }, [refreshFeed]);

  function selectTab(tab: TabType) {
    setActiveTab(tab);
    setSelectedVibe(null);
    Haptics.selectionAsync();
  }

  function handlePeopleSearch(q: string) {
    setPeopleQuery(q);
    setPeopleError(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setPeopleResults([]); return; }
    setPeopleLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q.trim())}`);
        setPeopleResults(res ?? []);
      } catch (err: any) {
        setPeopleResults([]);
        setPeopleError(err?.message ?? 'Search failed. Please try again.');
      } finally {
        setPeopleLoading(false);
      }
    }, 400);
  }

  function handleToggleFollow(item: UserSearchResult) {
    Haptics.selectionAsync();
    const nowFollowing = followingIds.includes(item.userId) || item.isFollowing;
    setPeopleResults(prev =>
      prev.map(r => r.userId === item.userId ? { ...r, isFollowing: !nowFollowing } : r),
    );
    if (nowFollowing) unfollowUser(item.userId);
    else followUser(item.userId);
  }

  async function loadGuides(topic: string | null = guideTopicFilter, availNow: boolean = guideAvailNow) {
    setGuidesLoading(true);
    setGuidesError(null);
    try {
      let qs = '';
      if (topic)    qs += `topic=${encodeURIComponent(topic)}&`;
      if (availNow) qs += 'available_now=true&';
      const data = await apiFetch<GuideResult[]>(`/guides?${qs}`);
      setGuidesData(data ?? []);
    } catch {
      setGuidesError('Could not load guides. Pull to refresh.');
    } finally {
      setGuidesLoading(false);
    }
  }

  // Load guides the first time the Guides tab is opened
  useEffect(() => {
    if (activeTab === 'Guides' && !guidesLoaded.current) {
      guidesLoaded.current = true;
      loadGuides();
    }
  }, [activeTab]);

  function handleGuideFollow(g: GuideResult) {
    Haptics.selectionAsync();
    const nowFollowing = followingIds.includes(g.userId) || g.isFollowing;
    setGuidesData(prev =>
      prev.map(r => r.userId === g.userId ? { ...r, isFollowing: !nowFollowing } : r),
    );
    if (nowFollowing) unfollowUser(g.userId);
    else followUser(g.userId);
  }

  const filteredByMoodDoor = discoverMoodFilter
    ? discoverPosts.filter(p => p.mood === discoverMoodFilter || p.vibe === discoverMoodFilter)
    : discoverPosts;

  const sortedByNew = [...filteredByMoodDoor].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const vibePosts = selectedVibe
    ? filteredByMoodDoor.filter(p => p.vibe === selectedVibe || p.mood === selectedVibe)
    : filteredByMoodDoor;
  const activePosts = storiesSort === 'new' ? sortedByNew : filteredByMoodDoor;

  const CARD_W = (SCREEN_W - 48) / 2;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Vivid gradient header (in-flow, not absolute) ─────────── */}
      <LinearGradient
        colors={['#0A0818', '#140934', '#1E0A50']}
        style={{ paddingTop: topPad }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(120,70,255,0.20)', top: -50, right: -20, pointerEvents: 'none' }} />
        <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(60,140,240,0.14)', top: 20, left: -28, pointerEvents: 'none' }} />
        <View style={{ position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(244,168,200,0.14)', bottom: 8, right: 80, pointerEvents: 'none' }} />

        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={styles.headerTitle}>{t('discover.title')}</Text>
              {isRefreshing && !refreshing && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(200,184,232,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                  <ActivityIndicator size="small" color="rgba(200,184,232,0.55)" style={{ transform: [{ scale: 0.55 }] }} />
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)' }}>Updating</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSub}>{t('discover.subTitle')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.usersBtn}
              onPress={() => { router.push('/saved-stories' as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="bookmark" size={18} color="rgba(200,184,232,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.usersBtn}
              onPress={() => router.push('/messages' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="message-circle" size={18} color="rgba(200,184,232,0.85)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab pills row — horizontal scroll so tabs never clip on narrow screens */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
          style={{ flexGrow: 0 }}
        >
          {TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => selectTab(tab)}
                style={[
                  styles.tabPill,
                  active
                    ? { backgroundColor: 'rgba(155,120,232,0.22)', borderColor: 'rgba(155,120,232,0.60)' }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(200,184,232,0.14)' },
                ]}
                activeOpacity={0.75}
              >
                <Text style={[styles.tabIcon, { color: active ? '#C8B0FF' : 'rgba(200,184,232,0.40)' }]}>
                  {TAB_ICONS[tab]}
                </Text>
                <Text style={[
                  styles.tabText,
                  { color: active ? '#C8B0FF' : 'rgba(200,184,232,0.55)' },
                ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* ── Offline / error banner ──────────────────────────────────── */}
      {(!apiOnline || discoverLoadError) && !isLoading && (
        <View style={offlineBannerS.row}>
          <View style={offlineBannerS.dot} />
          <Text style={offlineBannerS.msg}>{discoverLoadError && apiOnline ? "Couldn't load stories" : "Offline — showing cached stories"}</Text>
          <TouchableOpacity style={offlineBannerS.btn} onPress={discoverLoadError && apiOnline ? refreshFeed : reloadData} activeOpacity={0.75}>
            <Text style={offlineBannerS.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Thin separator */}
      <View style={[styles.sep, { backgroundColor: colors.border }]} />

      {/* ── Stories ────────────────────────────────────────── */}
      {activeTab === 'Stories' && (
        <FlatList
          key="stories"
          data={activePosts}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <View>
              <View style={styles.storiesSortRow}>
                <TouchableOpacity
                  style={[styles.sortChip, storiesSort === 'for-you' && { backgroundColor: 'rgba(155,120,232,0.18)', borderColor: 'rgba(155,120,232,0.45)' }]}
                  onPress={() => { setStoriesSort('for-you'); Haptics.selectionAsync(); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sortChipText, { color: storiesSort === 'for-you' ? '#C8B0FF' : 'rgba(200,184,232,0.45)' }]}>✦ For You</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortChip, storiesSort === 'new' && { backgroundColor: 'rgba(155,120,232,0.18)', borderColor: 'rgba(155,120,232,0.45)' }]}
                  onPress={() => { setStoriesSort('new'); Haptics.selectionAsync(); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sortChipText, { color: storiesSort === 'new' ? '#C8B0FF' : 'rgba(200,184,232,0.45)' }]}>◎ New</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.moodDoorBtn}
                  onPress={() => { Haptics.selectionAsync(); setMoodDoorVisible(true); }}
                  activeOpacity={0.75}
                >
                  <Icon name="eye" size={12} color="rgba(200,184,232,0.55)" />
                  <Text style={styles.moodDoorBtnTxt}>Mood</Text>
                </TouchableOpacity>
              </View>
              {discoverMoodFilter && (
                <View style={styles.moodFilterRow}>
                  <Text style={styles.moodFilterLabel}>Showing</Text>
                  <View style={styles.moodFilterChip}>
                    <Text style={styles.moodFilterChipTxt}>{discoverMoodFilter}</Text>
                    <TouchableOpacity
                      onPress={() => { setDiscoverMoodFilter(null); Haptics.selectionAsync(); }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Icon name="x" size={11} color="rgba(200,184,232,0.65)" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.moodFilterLabel}>stories</Text>
                </View>
              )}
              {hasCorruptedDiscover && (
                <View style={corruptBannerS.row}>
                  <Icon name="alert-triangle" size={13} color="#C8A84B" />
                  <Text style={corruptBannerS.msg}>
                    Some stories couldn't be loaded — they may have been removed or corrupted.
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <DiscoverCard
              post={item}
              delay={Math.min(index * 75, 400)}
              onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id, source: 'discover' } })}
              onSave={() => toggleSavePost(item.id)}
              onReport={() => setReportTargetId(item.id)}
              onAuthorPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.authorUserId } } as any)}
            />
          )}
          contentContainerStyle={[styles.listPad, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            isLoading && discoverPosts.length === 0 ? (
              <View>
                {[0, 1, 2].map(i => (
                  <SkeletonDiscoverCard key={i} style={{ opacity: 1 - i * 0.22 }} />
                ))}
              </View>
            ) : (
              <EmptyFeed
                tab="Stories"
                colors={colors}
                onCreatePress={() => router.push('/(tabs)/create')}
              />
            )
          }
        />
      )}

      {/* ── Vibes ─────────────────────────────────────────── */}
      {activeTab === 'Vibes' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.vibesScroll, { paddingBottom: bottomPad }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {selectedVibe ? (
            <>
              <TouchableOpacity
                style={[styles.backRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => setSelectedVibe(null)}
              >
                <Icon name="arrow-left" size={14} color={colors.foreground} />
                <Text style={[styles.backText, { color: colors.foreground }]}>{t(`moods.${selectedVibe}` as any)}</Text>
              </TouchableOpacity>

              {vibePosts.length === 0 ? (
                <EmptyVibes
                  vibe={selectedVibe}
                  colors={colors}
                  onCreatePress={() => router.push('/(tabs)/create')}
                />
              ) : vibePosts.map(post => (
                <DiscoverCard
                  key={post.id}
                  post={post}
                  onPress={() => router.push({ pathname: '/story/[id]', params: { id: post.id, source: 'discover' } })}
                  onSave={() => toggleSavePost(post.id)}
                />
              ))}
            </>
          ) : (
            <>
              <Text style={[styles.vibeHint, { color: colors.mutedForeground }]}>
                {t('discover.findMood')}
              </Text>
              <View style={styles.vibeGrid}>
                {VIBES.map(vibe => {
                  const count = discoverPosts.filter(p => p.mood === vibe.label || p.vibe === vibe.label).length;
                  return (
                    <TouchableOpacity
                      key={vibe.label}
                      style={[styles.vibeCard, { width: CARD_W, borderColor: `${vibe.color}35` }]}
                      onPress={() => { setSelectedVibe(vibe.label); Haptics.selectionAsync(); }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={[`${vibe.color}22`, `${vibe.color}08`]}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0.1, y: 0 }}
                        end={{ x: 0.9, y: 1 }}
                      />
                      <View style={[styles.vibeIconWrap, { backgroundColor: `${vibe.color}28` }]}>
                        <Icon name={vibe.icon} size={22} color={vibe.color} />
                      </View>
                      <Text style={[styles.vibeLabel, { color: vibe.color }]}>{t(`moods.${vibe.label}` as any)}</Text>
                      <Text style={[styles.vibeCount, { color: `${vibe.color}70` }]}>
                        {count} {count === 1 ? t('discover.story') : t('discover.stories')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {/* ── Report sheet ──────────────────────────────────── */}
      <ReportSheet
        visible={!!reportTargetId}
        targetType="story"
        targetId={reportTargetId ?? ''}
        onClose={() => setReportTargetId(null)}
      />

      {/* ── Mood door overlay ─────────────────────────────── */}
      <MoodDoorModal
        visible={moodDoorVisible}
        onSelect={(mood) => {
          setDiscoverMoodFilter(mood);
          setMoodDoorVisible(false);
        }}
        onDismiss={() => {
          setDiscoverMoodFilter(null);
          setMoodDoorVisible(false);
        }}
      />

      {/* ── Guides ─────────────────────────────────────────── */}
      {activeTab === 'Guides' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[{ paddingBottom: bottomPad }]}
        >
          {/* Header banner */}
          <LinearGradient
            colors={['rgba(80,40,180,0.28)', 'rgba(60,120,240,0.14)', 'transparent']}
            style={styles.guideBanner}
          >
            <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(100,60,220,0.18)', top: -40, right: -20, pointerEvents: 'none' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="star" size={16} color="#C8A84B" />
              <Text style={styles.guideBannerTitle}>Constellation Guides</Text>
            </View>
            <Text style={styles.guideBannerSub}>
              Wanderers who light the path — find a guide who resonates with your sky journey
            </Text>
          </LinearGradient>

          {/* Topic filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideTopicRow}>
            <TouchableOpacity
              style={[styles.guideTopicChip, !guideTopicFilter && { backgroundColor: 'rgba(155,120,232,0.22)', borderColor: 'rgba(155,120,232,0.55)' }, !guideTopicFilter ? {} : { borderColor: 'rgba(200,184,232,0.18)' }]}
              onPress={() => { setGuideTopicFilter(null); loadGuides(null, guideAvailNow); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.guideTopicText, { color: guideTopicFilter ? 'rgba(200,184,232,0.55)' : '#C8B8E8' }]}>All Topics</Text>
            </TouchableOpacity>
            {GUIDE_TOPICS.map(t => {
              const active = guideTopicFilter === t;
              const col    = TOPIC_COLORS[t] ?? '#9878D8';
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.guideTopicChip, active ? { backgroundColor: `${col}22`, borderColor: `${col}55` } : { borderColor: 'rgba(200,184,232,0.14)' }]}
                  onPress={() => { const next = active ? null : t; setGuideTopicFilter(next); loadGuides(next, guideAvailNow); Haptics.selectionAsync(); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.guideTopicText, { color: active ? col : 'rgba(200,184,232,0.55)' }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Available now toggle */}
          <TouchableOpacity
            style={[styles.guideAvailToggle, guideAvailNow ? { backgroundColor: 'rgba(80,200,130,0.14)', borderColor: 'rgba(80,200,130,0.40)' } : { borderColor: 'rgba(200,184,232,0.14)' }]}
            onPress={() => { const next = !guideAvailNow; setGuideAvailNow(next); loadGuides(guideTopicFilter, next); Haptics.selectionAsync(); }}
            activeOpacity={0.8}
          >
            <View style={[styles.availDot, { backgroundColor: guideAvailNow ? '#60D890' : '#808090' }]} />
            <Text style={[styles.guideAvailText, { color: guideAvailNow ? '#70E8A0' : 'rgba(200,184,232,0.55)' }]}>
              {guideAvailNow ? 'Available Now' : 'All Guides'}
            </Text>
          </TouchableOpacity>

          {/* Error */}
          {!!guidesError && (
            <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(180,60,60,0.12)', borderWidth: 1, borderColor: 'rgba(180,60,60,0.25)' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#E06C75', textAlign: 'center' }}>{guidesError}</Text>
            </View>
          )}

          {/* Loading */}
          {guidesLoading ? (
            <ActivityIndicator color="rgba(155,120,232,0.7)" style={{ marginTop: 40 }} />
          ) : guidesData.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconBox, { backgroundColor: 'rgba(155,120,232,0.12)' }]}>
                <Icon name="star" size={30} color="rgba(155,120,232,0.6)" />
              </View>
              {guideTopicFilter ? (
                <>
                  <Text style={[styles.emptyTitle, { color: 'rgba(220,210,255,0.90)' }]}>No guides here</Text>
                  <Text style={[styles.emptyBody, { color: 'rgba(200,184,232,0.55)' }]}>
                    {`No guides for "${guideTopicFilter}" yet — try another topic`}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.emptyTitle, { color: 'rgba(220,210,255,0.90)' }]}>Some guides are unavailable</Text>
                  <Text style={[styles.emptyBody, { color: 'rgba(200,184,232,0.55)' }]}>
                    Some guides are resting for now — check back soon
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
              {guidesData.map(g => {
                const isFollowing = followingIds.includes(g.userId) || g.isFollowing;
                return (
                  <TouchableOpacity
                    key={g.userId}
                    style={styles.guideCard}
                    onPress={() => router.push({ pathname: '/guide/[userId]', params: { userId: g.userId } } as any)}
                    activeOpacity={0.88}
                  >
                    {/* Avatar */}
                    <View style={styles.guideCardAvatar}>
                      {g.avatarUri ? (
                        <Image source={{ uri: g.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                      ) : (
                        <LinearGradient colors={['rgba(120,70,255,0.55)', 'rgba(60,140,240,0.40)']} style={StyleSheet.absoluteFill} />
                      )}
                      {!g.avatarUri && (
                        <Text style={styles.guideCardInitial}>{g.name.charAt(0).toUpperCase()}</Text>
                      )}
                      <View style={[styles.guideCardAvailDot, { backgroundColor: g.isAvailableNow ? '#60D890' : '#808090' }]} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.guideCardName} numberOfLines={1}>{g.name}</Text>
                        {g.isAvailableNow && (
                          <View style={styles.guideNowBadge}>
                            <Text style={styles.guideNowText}>Now</Text>
                          </View>
                        )}
                      </View>
                      {g.username && (
                        <Text style={styles.guideCardHandle}>@{g.username}</Text>
                      )}
                      {!!g.guideBio && (
                        <Text style={styles.guideCardBio} numberOfLines={2}>{g.guideBio}</Text>
                      )}
                      {g.guideTopics.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                          {g.guideTopics.slice(0, 3).map(topic => {
                            const col = TOPIC_COLORS[topic] ?? '#9878D8';
                            return (
                              <View key={topic} style={[styles.guideTagPill, { backgroundColor: `${col}16`, borderColor: `${col}30` }]}>
                                <Text style={[styles.guideTagText, { color: col }]}>{topic}</Text>
                              </View>
                            );
                          })}
                          {g.guideTopics.length > 3 && (
                            <Text style={styles.guideTagMore}>+{g.guideTopics.length - 3}</Text>
                          )}
                        </View>
                      )}
                    </View>

                    {/* Follow button */}
                    <TouchableOpacity
                      style={[
                        styles.followBtn,
                        isFollowing
                          ? { backgroundColor: 'rgba(155,120,232,0.14)', borderColor: 'rgba(155,120,232,0.35)' }
                          : { backgroundColor: 'rgba(155,120,232,0.85)', borderColor: 'rgba(155,120,232,0.85)' },
                      ]}
                      onPress={() => handleGuideFollow(g)}
                      activeOpacity={0.8}
                    >
                      <Icon name={isFollowing ? 'user-check' : 'user-plus'} size={13} color={isFollowing ? '#C8B0FF' : '#fff'} />
                      <Text style={[styles.followBtnText, { color: isFollowing ? '#C8B0FF' : '#fff' }]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── People ─────────────────────────────────────────── */}
      {activeTab === 'People' && (
        <View style={styles.peopleRoot}>
          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Icon name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={peopleQuery}
              onChangeText={handlePeopleSearch}
              placeholder={t('discover.searchPlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {peopleLoading && (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            {!peopleLoading && peopleQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => { setPeopleQuery(''); setPeopleResults([]); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Error banner */}
          {!!peopleError && (
            <View style={{ marginHorizontal: 16, marginTop: -4, marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(180,60,60,0.12)', borderWidth: 1, borderColor: 'rgba(180,60,60,0.25)' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#E06C75', textAlign: 'center' }}>{peopleError}</Text>
            </View>
          )}

          {/* Results / empty states */}
          {peopleQuery.length < 2 ? (
            <PeopleEmptyStart colors={colors} />
          ) : peopleResults.length === 0 && !peopleLoading ? (
            <PeopleNoResults colors={colors} />
          ) : (
            <FlatList
              data={peopleResults}
              keyExtractor={r => r.userId}
              contentContainerStyle={[styles.peopleList, { paddingBottom: bottomPad }]}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isFollowing = followingIds.includes(item.userId) || item.isFollowing;
                return (
                  <TouchableOpacity
                    style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}
                    onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.userId } } as any)}
                    activeOpacity={0.88}
                  >
                    <View style={[styles.personAvatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35`, overflow: 'hidden' }]}>
                      {item.avatarUri ? (
                        <Image
                          source={{ uri: item.avatarUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <Text style={[styles.personInitial, { color: colors.primary }]}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={styles.personInfo}>
                      <Text style={[styles.personName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.username ? (
                        <Text style={[styles.personHandle, { color: colors.primary }]}>
                          @{item.username}
                        </Text>
                      ) : null}
                      {item.bio ? (
                        <Text style={[styles.personBio, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {item.bio}
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.followBtn,
                        isFollowing
                          ? { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}35` }
                          : { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => handleToggleFollow(item)}
                      activeOpacity={0.8}
                    >
                      <Icon
                        name={isFollowing ? 'user-check' : 'user-plus'}
                        size={13}
                        color={isFollowing ? colors.primary : '#fff'}
                      />
                      <Text style={[styles.followBtnText, { color: isFollowing ? colors.primary : '#fff' }]}>
                        {isFollowing ? t('discover.following') : t('discover.follow')}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyFeed({ tab, colors, onCreatePress }: { tab: string; colors: any; onCreatePress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}12` }]}>
        <Icon name="compass" size={30} color={`${colors.primary}70`} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('discover.emptyFeed')}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        {t('discover.emptyFeedSub')}
      </Text>
      <TouchableOpacity
        style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
        onPress={onCreatePress}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={14} color="#fff" />
        <Text style={styles.ctaBtnText}>{t('discover.beFirst')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyVibes({ vibe, colors, onCreatePress }: { vibe: string; colors: any; onCreatePress: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}12` }]}>
        <Icon name="compass" size={30} color={`${colors.primary}70`} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('discover.emptyFeed')}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        {t('discover.emptyVibes', { vibe: t(`moods.${vibe}` as any) })}
      </Text>
      <TouchableOpacity
        style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
        onPress={onCreatePress}
        activeOpacity={0.85}
      >
        <Icon name="plus" size={14} color="#fff" />
        <Text style={styles.ctaBtnText}>{t('discover.beFirst')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PeopleEmptyStart({ colors }: { colors: any }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyStarRing, { borderColor: `${colors.primary}28` }]}>
        <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}14` }]}>
          <Icon name="users" size={30} color={`${colors.primary}70`} />
        </View>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Find Sky Friends</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        Search by name or @handle to find wanderers and follow their sky stories.
      </Text>
      <View style={[styles.searchHint, { borderColor: `${colors.primary}22`, backgroundColor: `${colors.primary}08` }]}>
        <Icon name="search" size={12} color={`${colors.primary}70`} />
        <Text style={[styles.searchHintText, { color: `${colors.primary}90` }]}>
          Try searching "sky" or any @username
        </Text>
      </View>
    </View>
  );
}

function PeopleNoResults({ colors }: { colors: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}12` }]}>
        <Icon name="search" size={30} color={`${colors.primary}70`} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('discover.noResults')}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        {t('discover.tryDifferent')}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerText:  { flex: 1, gap: 3 },
  headerTitle: {
    fontSize: 22, fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.6, color: '#EDE8FF',
  },
  headerSub: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(210,196,240,0.55)', fontStyle: 'italic',
  },
  usersBtn: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(155,120,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(155,120,255,0.28)',
    marginTop: 2,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingRight: 24,
    gap: 8,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 15, paddingVertical: 8,
    borderRadius: 22, borderWidth: 1,
  },
  tabIcon: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  tabText: { fontSize: 13, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },

  // Stories sort toggle
  storiesSortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 14,
    paddingBottom: 4,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  sortChipText: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },

  sep: { height: StyleSheet.hairlineWidth },

  // Feed list
  listPad: { paddingHorizontal: 16, paddingTop: 18 },

  // Vibes
  vibesScroll: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  vibeHint: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', textAlign: 'center',
    color: 'rgba(210,196,240,0.55)',
    paddingBottom: 4,
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  vibeCard: {
    borderRadius: 20, borderWidth: 1,
    padding: 16, gap: 6,
    minHeight: 122,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  vibeIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  vibeLabel: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  vibeCount: { fontSize: 11, fontFamily: 'Satoshi-Medium', opacity: 0.72 },

  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24, borderWidth: 1, marginBottom: 8,
  },
  backText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },

  // Guides
  guideBanner: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 4,
    overflow: 'hidden',
  },
  guideBannerTitle: {
    fontSize: 17,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.95)',
    letterSpacing: -0.3,
  },
  guideBannerSub: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.55)',
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  guideTopicRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 7,
    flexDirection: 'row',
  },
  guideTopicChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(200,184,232,0.06)',
  },
  guideTopicText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 0.1,
  },
  guideAvailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
  },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  guideAvailText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(30,20,60,0.65)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(155,120,232,0.18)',
    padding: 14,
  },
  guideCardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'rgba(120,70,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  guideCardInitial: {
    fontSize: 22,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.9)',
  },
  guideCardAvailDot: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(12,8,32,0.9)',
  },
  guideCardName:   { fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.95)' },
  guideCardHandle: { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(155,120,232,0.70)' },
  guideCardBio:    { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)', lineHeight: 17 },
  guideNowBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(80,200,130,0.18)',
    borderWidth: 1, borderColor: 'rgba(80,200,130,0.40)',
  },
  guideNowText: { fontSize: 9, fontFamily: 'Satoshi-Bold', color: '#70E8A0' },
  guideTagPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  guideTagText:  { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  guideTagMore:  { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)', alignSelf: 'center' },

  // People
  peopleRoot: { flex: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  searchInput: {
    flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular',
    paddingVertical: 0,
  },
  peopleList: { paddingHorizontal: 16, gap: 10 },
  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  personAvatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, flexShrink: 0,
  },
  personInitial:  { fontSize: 17, fontFamily: 'Satoshi-Bold' },
  personInfo:     { flex: 1, gap: 3 },
  personName:     { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  personHandle:   { fontSize: 12, fontFamily: 'Satoshi-Medium' },
  personBio:      { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 16 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 14, height: 36,
    borderRadius: 18, borderWidth: 1.5,
    flexShrink: 0, minWidth: 88,
  },
  followBtnText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Empty states
  emptyWrap: {
    alignItems: 'center', paddingTop: 60,
    paddingHorizontal: 32, gap: 14,
  },
  emptyStarRing: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 4,
  },
  emptyIconBox: {
    width: 68, height: 68, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 19, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  emptyBody:  {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', textAlign: 'center', lineHeight: 21,
  },
  searchHint: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, marginTop: 4,
  },
  searchHintText: { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, height: 48, borderRadius: 24,
    marginTop: 6,
    shadowColor: '#9B78FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaBtnText: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },

  moodDoorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(200,184,232,0.06)',
    borderColor: 'rgba(200,184,232,0.14)',
  },
  moodDoorBtnTxt: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.50)', letterSpacing: 0.4,
  },
  moodFilterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  moodFilterLabel: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.40)',
  },
  moodFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(155,120,232,0.15)',
    borderColor: 'rgba(155,120,232,0.35)',
  },
  moodFilterChipTxt: {
    fontSize: 12, fontFamily: 'Satoshi-Bold',
    color: '#C8B0FF', letterSpacing: 0.2,
  },
});

const offlineBannerS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 14, marginTop: 8, marginBottom: 2,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(14, 10, 32, 0.88)',
    borderColor: 'rgba(200, 168, 75, 0.35)',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8A84B', flexShrink: 0 },
  msg: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(220, 210, 240, 0.78)' },
  btn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(107,91,149,0.40)',
  },
  btnText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#9B78E8' },
});

const corruptBannerS = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
    backgroundColor: 'rgba(200, 168, 75, 0.08)',
    borderColor: 'rgba(200, 168, 75, 0.25)',
  },
  msg: { flex: 1, fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(220, 210, 190, 0.65)' },
});
