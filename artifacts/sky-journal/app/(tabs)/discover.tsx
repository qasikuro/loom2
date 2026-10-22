import { Icon } from '@/components/Icon';
import { LoadingCard, SkyLoadingMark } from '@/components/SkyLoading';
import { Images } from '@/assets/images/index';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useFriendsDrawer } from '@/context/FriendsDrawerContext';
import { useTranslation } from 'react-i18next';
import { SHADOW } from '@/constants/colors';
import { UI } from '@/constants/uiTokens';
import { useAuth } from '@clerk/expo';
import {
  getListGuideTutorialsQueryKey,
  useListGuideTutorials,
} from '@workspace/api-client-react';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = ['Guides', 'Books', 'Tutorials'] as const;
type TabType = (typeof TABS)[number];

const TAB_ICONS: Record<TabType, string> = {
  Guides:  'star',
  Books:   'book-open',
  Tutorials: 'layers',
};

const GUIDE_TOPICS = [
  'Anxiety & Stress', 'Motivation', 'Self Growth', 'Relationships',
  'Loneliness', 'Creativity', 'Spirituality', 'Mental Health',
  'Dreams & Goals', 'Grief', 'Social Skills', 'Mindfulness',
] as const;

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

interface DiscoverBook {
  id:              string;
  title:           string;
  subtitle:        string | null;
  description:     string | null;
  genre:           string | null;
  ageRating:       string | null;
  coverImageUri:   string | null;
  chapterCount:    number;
  authorUserId:    string;
  authorName:      string | null;
  authorUsername:  string | null;
  authorAvatarUri: string | null;
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

interface GuideSessionPreview {
  id: string;
  guideId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  coverImageUri: string | null;
  attendeeCount: number;
  isJoined: boolean;
  status: string;
  topic: string | null;
  tutorial: { id: string; title: string; steps: { id: string }[] } | null;
}

export default function DiscoverScreen() {
  const { open: openFriendsDrawer } = useFriendsDrawer();
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const { followingIds, followUser, unfollowUser, isRefreshing } = useApp();
  const { userId, isLoaded: authLoaded, isSignedIn } = useAuth();

  const [activeTab,     setActiveTab]     = useState<TabType>('Guides');
  const [guidesData,    setGuidesData]    = useState<GuideResult[]>([]);
  const [guideSessions, setGuideSessions] = useState<GuideSessionPreview[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guidesError,   setGuidesError]   = useState<string | null>(null);
  const [guideTopicFilter, setGuideTopicFilter] = useState<string | null>(null);
  const [guideTopicSearch, setGuideTopicSearch] = useState('');
  const [guideAvailNow,    setGuideAvailNow]    = useState(false);
  const [booksData,    setBooksData]    = useState<DiscoverBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError,   setBooksError]   = useState<string | null>(null);
  const guidesLoaded     = useRef(false);
  const guidesInFlight = useRef(false);
  const refreshVisibleGuides = useRef<() => void>(() => {});
  const booksLoaded      = useRef(false);
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 130;
  const contentMaxWidth = viewportWidth >= 760 ? 760 : undefined;
  const upcomingSessions = guideSessions
    .filter(session => session.status === 'scheduled' && new Date(session.endsAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const guideIdsWithSessions = new Set(upcomingSessions.map(session => session.guideId));
  const guidesWithSessions = guidesData.filter(guide => guideIdsWithSessions.has(guide.userId));
  const matchingGuideTopics = guideTopicSearch.trim() && !guideTopicFilter
    ? GUIDE_TOPICS
      .map((topic, index) => ({ topic, label: t(`discoverLog.topic${index}`) }))
      .filter(({ topic, label }) =>
        `${label} ${topic}`.toLocaleLowerCase(i18n.language).includes(guideTopicSearch.trim().toLocaleLowerCase(i18n.language)),
      )
      .slice(0, 6)
    : [];
  const tutorialQuery = useListGuideTutorials(
    { mine: false },
    {
      query: {
        queryKey: [...getListGuideTutorialsQueryKey({ mine: false }), userId],
        enabled: !!isSignedIn && activeTab === 'Tutorials',
        staleTime: 60_000,
      },
    },
  );

  function selectTab(tab: TabType) {
    setActiveTab(tab);
    Haptics.selectionAsync();
  }

  async function loadGuides(topic: string | null = guideTopicFilter, availNow: boolean = guideAvailNow, silent = false) {
    if (silent && guidesInFlight.current) return;
    guidesInFlight.current = true;
    if (!silent) { setGuidesLoading(true); setGuidesError(null); }
    try {
      let qs = '';
      if (topic)    qs += `topic=${encodeURIComponent(topic)}&`;
      if (availNow) qs += 'available_now=true&';
      const [data, sessions] = await Promise.all([
        apiFetch<GuideResult[]>(`/guides?${qs}`),
        apiFetch<GuideSessionPreview[]>('/guide-sessions'),
      ]);
      setGuidesData(data ?? []);
      setGuideSessions(sessions ?? []);
      setGuidesError(null);
    } catch {
      if (!silent) {
        setGuideSessions([]);
        setGuidesError(t('discoverLog.loadGuidesError'));
      }
    } finally {
      guidesInFlight.current = false;
      if (!silent) setGuidesLoading(false);
    }
  }

  // Load guides the first time the Guides tab is opened
  useEffect(() => {
    if (activeTab === 'Guides' && !guidesLoaded.current) {
      guidesLoaded.current = true;
      loadGuides();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only activeTab should trigger this check
  }, [activeTab]);

  refreshVisibleGuides.current = () => { void loadGuides(guideTopicFilter, guideAvailNow, true); };
  useFocusEffect(useCallback(() => {
    if (!isSignedIn || activeTab !== 'Guides') return;
    if (guidesLoaded.current) refreshVisibleGuides.current();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshVisibleGuides.current();
    }, 15_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshVisibleGuides.current();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [activeTab, isSignedIn]));

  async function loadBooks() {
    setBooksLoading(true);
    setBooksError(null);
    try {
      const data = await apiFetch<DiscoverBook[]>('/public-books');
      setBooksData(data ?? []);
    } catch {
      setBooksError(t('discoverLog.loadBooksError'));
    } finally {
      setBooksLoading(false);
    }
  }

  // Load books the first time the Books tab is opened
  useEffect(() => {
    if (activeTab === 'Books' && !booksLoaded.current) {
      booksLoaded.current = true;
      loadBooks();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only activeTab should trigger this check
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

  function selectGuideTopic(topic: string, label: string) {
    setGuideTopicFilter(topic);
    setGuideTopicSearch(label);
    void loadGuides(topic, guideAvailNow);
    Haptics.selectionAsync();
  }

  function clearGuideTopic() {
    const hadTopicFilter = guideTopicFilter !== null;
    setGuideTopicSearch('');
    setGuideTopicFilter(null);
    if (hadTopicFilter) void loadGuides(null, guideAvailNow);
    Haptics.selectionAsync();
  }

  function updateGuideTopicSearch(value: string) {
    setGuideTopicSearch(value);
    if (guideTopicFilter) {
      setGuideTopicFilter(null);
      void loadGuides(null, guideAvailNow);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Vivid gradient header (in-flow, not absolute) ─────────── */}
      <LinearGradient
        colors={['#0A0818', '#140934', '#1E0A50']}
        style={{ paddingTop: topPad, overflow: 'hidden' }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Image
          source={Images.story_bg1}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
        <LinearGradient
          colors={['rgba(10,7,25,0.40)', 'rgba(14,8,36,0.58)', 'rgba(16,8,38,0.96)']}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Title row */}
        <View style={[styles.headerRow, contentMaxWidth != null && { maxWidth: contentMaxWidth }]}>
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={styles.headerTitle}>{t('discover.title')}</Text>
              <Icon name="star" size={20} color="#F6C968" />
              {isRefreshing && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(200,184,232,0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 }}>
                  <SkyLoadingMark size={14} color="rgba(200,184,232,0.7)" />
                  <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)' }}>{t('discoverLog.updating')}</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSub}>{t('discover.subTitle')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
            <TouchableOpacity
              style={styles.usersBtn}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => { router.push('/saved-stories' as any); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="bookmark" size={18} color="rgba(200,184,232,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.usersBtn}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => openFriendsDrawer('all')}
              accessibilityRole="button" accessibilityLabel={t('social.openMessages')}
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
                    ? { backgroundColor: colors.primary, borderColor: `${colors.primary}CC` }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(200,184,232,0.14)' },
                ]}
                activeOpacity={0.75}
              >
                <Icon
                  name={TAB_ICONS[tab]}
                  size={16}
                  color={active ? '#C8B0FF' : 'rgba(200,184,232,0.55)'}
                />
                <Text style={[
                  styles.tabText,
                  { color: active ? colors.primaryForeground : 'rgba(237,232,255,0.82)' },
                ]}>
                  {t(`discoverLog.tab${tab}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* Thin separator */}
      <View style={[styles.sep, { backgroundColor: colors.border }]} />

      {/* ── Books ─────────────────────────────────────────── */}
      {activeTab === 'Books' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[{ paddingBottom: bottomPad, paddingTop: 12 }]}
          refreshControl={
            <RefreshControl
              refreshing={booksLoading && booksData.length > 0}
              onRefresh={() => { booksLoaded.current = false; loadBooks(); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Banner */}
          <LinearGradient
            colors={['rgba(80,40,180,0.22)', 'rgba(40,80,220,0.10)', 'transparent']}
             style={[styles.booksBanner, contentMaxWidth != null && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <Icon name="book-open" size={15} color="#C8A84B" />
              <Text style={styles.booksBannerTitle}>{t('discoverLog.libraryTitle')}</Text>
            </View>
            <Text style={styles.booksBannerSub}>
              {t('discoverLog.librarySubtitle')}
            </Text>
          </LinearGradient>

          {/* Error */}
          {!!booksError && (
            <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(180,60,60,0.12)', borderWidth: 1, borderColor: 'rgba(180,60,60,0.25)' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#E06C75', textAlign: 'center' }}>{booksError}</Text>
            </View>
          )}

          {/* Loading */}
          {booksLoading && booksData.length === 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
              {[0, 1, 2].map(i => <LoadingCard key={i} style={{ opacity: 1 - i * 0.18 }} />)}
            </View>
          ) : booksData.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconBox, { backgroundColor: 'rgba(155,120,232,0.12)' }]}>
                <Icon name="book-open" size={30} color="rgba(155,120,232,0.6)" />
              </View>
              <Text style={[styles.emptyTitle, { color: 'rgba(220,210,255,0.90)' }]}>{t('discoverLog.noBooks')}</Text>
              <Text style={[styles.emptyBody, { color: 'rgba(200,184,232,0.55)' }]}>
                {t('discoverLog.firstBook')}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {booksData.map(book => (
                <TouchableOpacity
                  key={book.id}
                  style={styles.bookCard}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onPress={() => router.push({ pathname: '/book-public', params: { bookId: book.id } } as any)}
                  activeOpacity={0.88}
                >
                  {/* Cover */}
                  <View style={styles.bookCardCover}>
                    {book.coverImageUri ? (
                      <Image
                        source={{ uri: book.coverImageUri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <LinearGradient
                        colors={['rgba(120,70,255,0.55)', 'rgba(60,140,240,0.35)']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    {!book.coverImageUri && (
                      <Icon name="book-open" size={28} color="rgba(220,210,255,0.55)" />
                    )}
                    {/* Chapter badge */}
                    <View style={styles.bookChapterBadge}>
                      <Text style={styles.bookChapterBadgeText}>
                        {t('discoverLog.chapterCount', { count: book.chapterCount })}
                      </Text>
                    </View>
                  </View>

                  {/* Info */}
                     <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                    <Text style={styles.bookCardTitle} numberOfLines={2}>{book.title}</Text>
                    {book.authorName ? (
                      <TouchableOpacity
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: book.authorUserId } } as any)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.bookCardAuthor}>{t('discoverLog.byAuthor', { name: book.authorName })}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {/* Genre + age rating tags */}
                    {(book.genre || book.ageRating) ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                        {book.genre ? (
                          <View style={styles.bookTag}>
                            <Text style={styles.bookTagText}>{book.genre}</Text>
                          </View>
                        ) : null}
                        {book.ageRating ? (
                          <View style={[styles.bookTag, { backgroundColor: 'rgba(200,168,75,0.12)', borderColor: 'rgba(200,168,75,0.28)' }]}>
                            <Text style={[styles.bookTagText, { color: '#C8A84B' }]}>{book.ageRating}</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    {/* Description */}
                    {book.description ? (
                      <Text style={styles.bookCardDesc} numberOfLines={3}>{book.description}</Text>
                    ) : null}
                  </View>

                  {/* Chevron */}
                  <Icon name="chevron-right" size={16} color="rgba(200,184,232,0.30)" style={{ alignSelf: 'center' }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Guides ─────────────────────────────────────────── */}
      {activeTab === 'Guides' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[{ paddingBottom: bottomPad }]}
          refreshControl={
            <RefreshControl
              refreshing={guidesLoading && guidesData.length > 0}
              onRefresh={() => { guidesLoaded.current = true; loadGuides(); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={[styles.guideBanner, contentMaxWidth != null && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}>
            <View style={styles.guideBannerHeading}>
              <Icon name="compass" size={18} color={colors.primary} />
              <Text style={[styles.guideBannerTitle, { color: colors.foreground }]}>{t('discoverLog.guidesTitle')}</Text>
            </View>
            <Text style={[styles.guideBannerSub, { color: colors.mutedForeground }]}>
              {t('discoverLog.guidesSubtitle')}
            </Text>
          </View>

          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <View style={[styles.guideTopicSearch, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="search" size={17} color={colors.mutedForeground} />
              <TextInput
                value={guideTopicSearch}
                onChangeText={updateGuideTopicSearch}
                placeholder={t('discoverLog.searchGuideTopics')}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.guideTopicSearchInput, { color: colors.foreground }]}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (matchingGuideTopics.length === 1) {
                    const [match] = matchingGuideTopics;
                    selectGuideTopic(match.topic, match.label);
                  }
                }}
                accessibilityLabel={t('discoverLog.searchGuideTopics')}
                testID="discover-guide-topic-search"
              />
              {!!guideTopicSearch && (
                <TouchableOpacity
                  onPress={clearGuideTopic}
                  accessibilityRole="button"
                  accessibilityLabel={t('discoverLog.clearTopicSearch')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x-circle" size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
            {guideTopicSearch.trim().length > 0 && !guideTopicFilter && (
              matchingGuideTopics.length > 0 ? (
                <View style={styles.guideTopicSuggestions}>
                  {matchingGuideTopics.map(({ topic, label }) => (
                    <TouchableOpacity
                      key={topic}
                      style={[styles.guideTopicSuggestion, { backgroundColor: `${colors.primary}13`, borderColor: `${colors.primary}35` }]}
                      onPress={() => selectGuideTopic(topic, label)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.guideTopicDot, { backgroundColor: TOPIC_COLORS[topic] }]} />
                      <Text style={[styles.guideTopicSuggestionText, { color: colors.primary }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={[styles.guideTopicNoMatch, { color: colors.mutedForeground }]}>
                  {t('discoverLog.noMatchingTopics')}
                </Text>
              )
            )}
          </View>

          {/* Available now toggle */}
          <TouchableOpacity
            style={[
              styles.guideAvailToggle,
              guideAvailNow
                ? { backgroundColor: 'rgba(80,200,130,0.14)', borderColor: 'rgba(80,200,130,0.40)' }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => { const next = !guideAvailNow; setGuideAvailNow(next); loadGuides(guideTopicFilter, next); Haptics.selectionAsync(); }}
            activeOpacity={0.8}
          >
            <View style={[styles.availDot, { backgroundColor: guideAvailNow ? '#60D890' : '#808090' }]} />
            <Text style={[styles.guideAvailText, { color: guideAvailNow ? colors.tint : colors.mutedForeground }]}>
              {guideAvailNow ? t('discoverLog.availableNow') : t('discoverLog.allGuides')}
            </Text>
          </TouchableOpacity>

          {/* Error */}
          {!!guidesError && (
            <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(180,60,60,0.12)', borderWidth: 1, borderColor: 'rgba(180,60,60,0.25)', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#E06C75', textAlign: 'center' }}>{guidesError}</Text>
              <TouchableOpacity onPress={() => loadGuides()} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Bold', color: colors.tint }}>{t('discoverLog.retry')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading */}
          {guidesLoading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
              {[0, 1, 2].map(i => <LoadingCard key={i} style={{ opacity: 1 - i * 0.18 }} />)}
            </View>
          ) : guidesWithSessions.length === 0 ? (
            <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconBox, { backgroundColor: `${colors.tint}12` }]}>
              <Icon name="star" size={30} color={colors.tint} />
              </View>
              {guideTopicFilter && guidesData.length === 0 ? (
                <>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('discoverLog.noGuidesForTopic')}</Text>
                  <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                    {t('discoverLog.noGuidesTopic', { topic: t(`discoverLog.topic${GUIDE_TOPICS.indexOf(guideTopicFilter as typeof GUIDE_TOPICS[number])}`) })}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('discoverLog.guidesUnavailable')}</Text>
                  <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                    {t('discoverLog.guidesUnavailableBody')}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
              {guidesWithSessions.map(g => {
                const isFollowing = followingIds.includes(g.userId) || g.isFollowing;
                const nextSession = upcomingSessions.find(session => session.guideId === g.userId);
                return (
                  <View
                    key={g.userId}
                    style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.guideCardTop}>
                      <TouchableOpacity
                        style={styles.guideProfileArea}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onPress={() => router.push({ pathname: '/guide/[userId]', params: { userId: g.userId } } as any)}
                        activeOpacity={0.82}
                      >
                        <View style={styles.guideCardAvatar}>
                          {g.avatarUri ? (
                            <Image source={{ uri: g.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                          ) : (
                            <LinearGradient colors={['rgba(120,70,255,0.55)', 'rgba(60,140,240,0.40)']} style={StyleSheet.absoluteFill} />
                          )}
                          {!g.avatarUri && <Text style={styles.guideCardInitial}>{g.name.charAt(0).toUpperCase()}</Text>}
                          <View style={[styles.guideCardAvailDot, { backgroundColor: g.isAvailableNow ? '#60D890' : '#808090', borderColor: colors.card }]} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                       <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <Text style={[styles.guideCardName, { color: colors.foreground }]} numberOfLines={1}>{g.name}</Text>
                        {g.isAvailableNow && (
                          <View style={styles.guideNowBadge}>
                            <Text style={[styles.guideNowText, { color: colors.tint }]}>{t('discoverLog.now')}</Text>
                          </View>
                        )}
                      </View>
                      {g.username && (
                        <Text style={[styles.guideCardHandle, { color: colors.tint }]}>@{g.username}</Text>
                      )}
                      {!!g.guideBio && (
                        <Text style={[styles.guideCardBio, { color: colors.mutedForeground }]} numberOfLines={2}>{g.guideBio}</Text>
                      )}
                      {g.guideTopics.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                          {g.guideTopics.slice(0, 3).map(topic => {
                            const col = TOPIC_COLORS[topic] ?? '#9878D8';
                            return (
                              <View key={topic} style={[styles.guideTagPill, { backgroundColor: `${col}16`, borderColor: `${col}30` }]}>
                                <Text style={[styles.guideTagText, { color: colors.foreground }]}>{topic}</Text>
                              </View>
                            );
                          })}
                          {g.guideTopics.length > 3 && (
                            <Text style={styles.guideTagMore}>+{g.guideTopics.length - 3}</Text>
                          )}
                        </View>
                      )}
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.followBtn,
                          isFollowing
                            ? { backgroundColor: `${colors.tint}18`, borderColor: `${colors.tint}55` }
                            : { backgroundColor: colors.tint, borderColor: colors.tint },
                        ]}
                        onPress={() => handleGuideFollow(g)}
                        activeOpacity={0.8}
                      >
                        <Icon name={isFollowing ? 'user-check' : 'user-plus'} size={13} color={isFollowing ? colors.tint : colors.primaryForeground} />
                        <Text style={[styles.followBtnText, { color: isFollowing ? colors.tint : colors.primaryForeground }]}>
                          {isFollowing ? t('discoverLog.following') : t('discoverLog.follow')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {nextSession && (
                      <TouchableOpacity
                        style={styles.sessionCoverCard}
                        activeOpacity={0.9}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onPress={() => router.push({ pathname: '/guide-session/[sessionId]', params: { sessionId: nextSession.id } } as any)}
                      >
                        {nextSession.coverImageUri ? (
                          <Image source={{ uri: nextSession.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                        ) : (
                          <LinearGradient colors={['#4a3978', '#8a6caa', '#d8a88d']} style={StyleSheet.absoluteFill} />
                        )}
                        <LinearGradient colors={['rgba(24,17,42,0.82)', 'rgba(24,17,42,0.36)', 'rgba(24,17,42,0.2)']} style={StyleSheet.absoluteFill} />
                        <View style={styles.sessionCoverContent}>
                          <View style={styles.sessionEyebrow}><Icon name="radio" size={11} color="#F0D59B" /><Text style={styles.sessionEyebrowText}>{t('discoverLog.upcomingSession')}</Text></View>
                          <Text style={styles.sessionCoverTitle} numberOfLines={2}>{nextSession.title}</Text>
                          <Text style={styles.sessionCoverDescription} numberOfLines={2}>{nextSession.description}</Text>
                          {nextSession.tutorial && (
                            <View style={styles.sessionTutorialBadge}>
                              <Icon name="book-open" size={11} color="#F5D99D" />
                              <Text style={styles.sessionTutorialText} numberOfLines={1}>
                                {nextSession.tutorial.title} · {nextSession.tutorial.steps.length} steps
                              </Text>
                            </View>
                          )}
                          <View style={styles.sessionCoverMeta}>
                            <Icon name="calendar" size={13} color="#F5D99D" />
                            <Text style={styles.sessionCoverMetaText}>{new Date(nextSession.startsAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                            <View style={styles.sessionAttendees}><Icon name="users" size={13} color="#F5D99D" /><Text style={styles.sessionCoverMetaText}>{t('discoverLog.attendingCount', { count: nextSession.attendeeCount })}</Text></View>
                          </View>
                        </View>
                        <View style={styles.sessionArrow}><Icon name="chevron-right" size={19} color="#2E2140" /></View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Tutorials ──────────────────────────────────────── */}
      {activeTab === 'Tutorials' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.tutorialsContent}
          refreshControl={
            <RefreshControl
              refreshing={tutorialQuery.isRefetching}
              onRefresh={() => { void tutorialQuery.refetch(); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={[styles.tutorialsBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.tutorialsBannerIcon, { backgroundColor: `${colors.primary}16` }]}>
              <Icon name="layers" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.tutorialsBannerTitle, { color: colors.foreground }]}>My tutorials</Text>
              <Text style={[styles.tutorialsBannerSubtitle, { color: colors.mutedForeground }]}>
                Find and manage the tutorials you have created.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.tutorialsLibraryButton, { backgroundColor: `${colors.primary}15` }]}
              onPress={() => router.push('/guide-tutorials')}
              accessibilityRole="button"
              accessibilityLabel="Open my tutorials"
              activeOpacity={0.8}
            >
              <Icon name="book-open" size={15} color={colors.primary} />
              <Text style={[styles.tutorialsLibraryText, { color: colors.primary }]}>Open</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tutorialsHeading}>
            <View>
              <Text style={[styles.tutorialsHeadingTitle, { color: colors.foreground }]}>Explore tutorials</Text>
              <Text style={[styles.tutorialsHeadingSubtitle, { color: colors.mutedForeground }]}>
                Open a guide to follow its steps.
              </Text>
            </View>
          </View>

          {!authLoaded || (isSignedIn && tutorialQuery.isLoading) ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map(index => (
                <LoadingCard key={index} style={{ opacity: 1 - index * 0.16, marginHorizontal: 16 }} />
              ))}
            </View>
          ) : !isSignedIn ? (
            <View style={[styles.tutorialsState, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Icon name="lock" size={24} color={colors.primary} />
              <Text style={[styles.tutorialsStateTitle, { color: colors.foreground }]}>Sign in to explore tutorials</Text>
              <TouchableOpacity
                style={[styles.tutorialsStateButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(auth)/sign-in')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tutorialsStateButtonText, { color: colors.primaryForeground }]}>Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : tutorialQuery.isError ? (
            <View style={[styles.tutorialsState, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Icon name="cloud-off" size={24} color={colors.mutedForeground} />
              <Text style={[styles.tutorialsStateTitle, { color: colors.foreground }]}>Tutorials could not be loaded</Text>
              <Text style={[styles.tutorialsStateBody, { color: colors.mutedForeground }]}>Check your connection and try again.</Text>
              <TouchableOpacity
                style={[styles.tutorialsStateButton, { backgroundColor: colors.primary }]}
                onPress={() => { void tutorialQuery.refetch(); }}
                activeOpacity={0.8}
              >
                <Icon name="refresh-cw" size={14} color={colors.primaryForeground} />
                <Text style={[styles.tutorialsStateButtonText, { color: colors.primaryForeground }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (tutorialQuery.data ?? []).length === 0 ? (
            <View style={[styles.tutorialsState, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Icon name="book-open" size={26} color={colors.primary} />
              <Text style={[styles.tutorialsStateTitle, { color: colors.foreground }]}>No tutorials yet</Text>
              <Text style={[styles.tutorialsStateBody, { color: colors.mutedForeground }]}>
                Visit the tutorial library to write one or check your saved guides.
              </Text>
              <TouchableOpacity
                style={[styles.tutorialsStateButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/guide-tutorials')}
                activeOpacity={0.8}
              >
                <Icon name="book-open" size={14} color={colors.primaryForeground} />
                <Text style={[styles.tutorialsStateButtonText, { color: colors.primaryForeground }]}>Open library</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10, paddingHorizontal: 16 }}>
              {(tutorialQuery.data ?? []).map(tutorial => {
                const coverUri = tutorial.steps.find(step =>
                  (step.type === 'image' || step.type === 'video') && !!step.mediaUri,
                )?.mediaUri;
                return (
                  <TouchableOpacity
                    key={tutorial.id}
                    style={[styles.tutorialCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      router.push(`/guide-tutorial/${tutorial.id}` as Href);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${tutorial.title}, ${tutorial.steps.length} steps, by ${tutorial.guideName}`}
                    activeOpacity={0.86}
                  >
                    <View style={[styles.tutorialCover, { backgroundColor: `${colors.primary}14` }]}>
                      {coverUri ? (
                        <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                      ) : (
                        <LinearGradient colors={[`${colors.primary}30`, `${colors.tint}22`]} style={StyleSheet.absoluteFill} />
                      )}
                      <View style={styles.tutorialStepBadge}>
                        <Icon name="list" size={11} color="#FFF" />
                        <Text style={styles.tutorialStepBadgeText}>{tutorial.steps.length} steps</Text>
                      </View>
                    </View>
                    <View style={styles.tutorialCardInfo}>
                      {tutorial.topic ? (
                        <View style={[styles.tutorialTopic, { backgroundColor: `${colors.primary}15` }]}>
                          <Text style={[styles.tutorialTopicText, { color: colors.primary }]} numberOfLines={1}>{tutorial.topic}</Text>
                        </View>
                      ) : null}
                      <Text style={[styles.tutorialCardTitle, { color: colors.foreground }]} numberOfLines={2}>{tutorial.title}</Text>
                      <Text style={[styles.tutorialCardDescription, { color: colors.mutedForeground }]} numberOfLines={2}>{tutorial.description}</Text>
                      <View style={styles.tutorialGuideRow}>
                        <View style={[styles.tutorialGuideAvatar, { backgroundColor: `${colors.primary}18` }]}>
                          {tutorial.guideAvatarUri ? (
                            <Image source={{ uri: tutorial.guideAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                          ) : (
                            <Icon name="user" size={12} color={colors.primary} />
                          )}
                        </View>
                        <Text style={[styles.tutorialGuideName, { color: colors.mutedForeground }]} numberOfLines={1}>{tutorial.guideName}</Text>
                        <View style={{ flex: 1 }} />
                        <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerText:  { flex: 1, minWidth: 0, gap: 3 },
  headerTitle: {
    fontSize: UI.type.screenTitle, fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.6, color: '#EDE8FF',
  },
  headerSub: {
    fontSize: UI.type.supporting, fontFamily: 'Satoshi-Regular',
    color: 'rgba(210,196,240,0.72)', lineHeight: 19,
  },
  usersBtn: {
    width: UI.minTapTarget, height: UI.minTapTarget, borderRadius: UI.radius.control,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(155,120,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(155,120,255,0.28)',
    marginTop: 2,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingRight: 12,
    gap: UI.space.sm,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI.space.sm,
    minHeight: UI.minTapTarget,
    paddingHorizontal: 14,
    borderRadius: UI.radius.pill, borderWidth: 1,
    flexShrink: 1,
  },
  tabIcon: { fontSize: 9, fontFamily: 'Satoshi-Bold' },
  tabText: { fontSize: UI.type.supporting, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },

  sep: { height: StyleSheet.hairlineWidth },

  // Books
  booksBanner: {
    paddingHorizontal: 20, paddingTop: 8,
    paddingBottom: 16, marginBottom: 4,
    overflow: 'hidden',
  },
  booksBannerTitle: {
    fontSize: 17, fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.95)', letterSpacing: -0.3,
  },
  booksBannerSub: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.55)', marginTop: 4,
    fontStyle: 'italic', lineHeight: 18,
  },
  bookCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    width: '100%', maxWidth: 760, alignSelf: 'center',
    backgroundColor: 'rgba(30,20,60,0.65)',
    borderRadius: UI.radius.card, borderWidth: 1,
    borderColor: 'rgba(155,120,232,0.18)', padding: UI.space.md,
  },
  bookCardCover: {
    width: 80, height: 112,
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: 'rgba(120,70,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, position: 'relative',
  },
  bookChapterBadge: {
    position: 'absolute', bottom: 5, right: 5,
    backgroundColor: 'rgba(8,6,22,0.82)',
    borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(155,120,232,0.30)',
  },
  bookChapterBadgeText: {
    fontSize: 9, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.85)',
  },
  bookCardTitle: {
    fontSize: 15, fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.96)', letterSpacing: -0.3, lineHeight: 20,
  },
  bookCardAuthor: {
    fontSize: 12, fontFamily: 'Satoshi-Medium',
    color: 'rgba(155,120,232,0.80)',
  },
  bookTag: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1,
    backgroundColor: 'rgba(155,120,232,0.12)',
    borderColor: 'rgba(155,120,232,0.28)',
  },
  bookTagText: {
    fontSize: 10, fontFamily: 'Satoshi-Medium',
    color: 'rgba(200,184,232,0.75)',
  },
  bookCardDesc: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.50)', lineHeight: 17, fontStyle: 'italic',
  },

  // Guides
  guideBanner: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    marginBottom: 2,
    width: '100%',
  },
  guideBannerHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 4 },
  guideBannerTitle: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.35,
  },
  guideBannerSub: {
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    lineHeight: 17,
  },
  guideTopicSearch: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  guideTopicSearchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 0,
    fontSize: 13,
    fontFamily: 'Satoshi-Medium',
  },
  guideTopicSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 9,
  },
  guideTopicSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  guideTopicDot: { width: 7, height: 7, borderRadius: 4 },
  guideTopicSuggestionText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Bold',
  },
  guideTopicNoMatch: { marginTop: 9, fontSize: 12, fontFamily: 'Satoshi-Regular' },
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
  guideAvailText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  guideCard: {
    gap: 12,
    width: '100%', maxWidth: 760, alignSelf: 'center',
    borderRadius: UI.radius.card,
    borderWidth: 1,
    padding: 14,
  },
  guideCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  guideProfileArea: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 },
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
  guideCardName:   { fontSize: 16, fontFamily: 'Satoshi-Bold', flexShrink: 1 },
  guideCardHandle: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  guideCardBio:    { fontSize: UI.type.supporting, fontFamily: 'Satoshi-Regular', lineHeight: 20 },
  guideSessionPreview: {
    marginTop: 5,
    padding: 9,
    borderRadius: 11,
    borderWidth: 1,
    gap: 3,
  },
  guideSessionTitle: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  guideSessionDescription: { fontSize: 11, lineHeight: 15, fontFamily: 'Satoshi-Regular' },
  guideSessionTime: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  sessionCoverCard: { height: 156, borderRadius: 15, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#5a4d73' },
  sessionCoverContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 4, maxWidth: '88%' },
  sessionEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  sessionEyebrowText: { color: '#F0D59B', fontFamily: 'Satoshi-Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  sessionCoverTitle: { color: '#FFF9F0', fontFamily: 'Satoshi-Bold', fontSize: 17, lineHeight: 21 },
  sessionCoverDescription: { color: 'rgba(255,249,240,0.88)', fontFamily: 'Satoshi-Regular', fontSize: 12, lineHeight: 16 },
  sessionTutorialBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', borderRadius: 10, backgroundColor: 'rgba(23,17,38,0.60)', paddingHorizontal: 8, paddingVertical: 5, marginTop: 2 },
  sessionTutorialText: { color: '#FFF5DD', fontFamily: 'Satoshi-Bold', fontSize: 10, flexShrink: 1 },
  sessionCoverMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  sessionCoverMetaText: { color: '#FFF7E8', fontFamily: 'Satoshi-Medium', fontSize: 11 },
  sessionAttendees: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  sessionArrow: { position: 'absolute', right: 12, top: '43%', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,249,240,0.92)', alignItems: 'center', justifyContent: 'center' },
  guideNowBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(80,200,130,0.18)',
    borderWidth: 1, borderColor: 'rgba(80,200,130,0.40)',
  },
  guideNowText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  guideTagPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  guideTagText:  { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  guideTagMore:  { fontSize: 11, fontFamily: 'Satoshi-Regular', alignSelf: 'center' },

  // Tutorial discovery
  tutorialsContent: { paddingTop: 14, paddingBottom: 130 },
  tutorialsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  tutorialsBannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialsBannerTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  tutorialsBannerSubtitle: { fontSize: 11, fontFamily: 'Satoshi-Regular', lineHeight: 15, marginTop: 2 },
  tutorialsLibraryButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tutorialsLibraryText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  tutorialsHeading: { marginHorizontal: 18, marginBottom: 12 },
  tutorialsHeadingTitle: { fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  tutorialsHeadingSubtitle: { fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  tutorialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: UI.radius.card,
    borderWidth: 1,
    padding: 11,
  },
  tutorialCover: {
    width: 76,
    height: 98,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tutorialStepBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(12,8,32,0.82)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tutorialStepBadgeText: { color: '#FFF', fontSize: 9, fontFamily: 'Satoshi-Bold' },
  tutorialCardInfo: { flex: 1, minWidth: 0, gap: 5 },
  tutorialTopic: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  tutorialTopicText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  tutorialCardTitle: { fontSize: 14, lineHeight: 18, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  tutorialCardDescription: { fontSize: 11, lineHeight: 15, fontFamily: 'Satoshi-Regular' },
  tutorialGuideRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tutorialGuideAvatar: { width: 20, height: 20, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tutorialGuideName: { fontSize: 10, fontFamily: 'Satoshi-Medium', flexShrink: 1 },
  tutorialsState: {
    minHeight: 196,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  tutorialsStateTitle: { fontSize: 15, textAlign: 'center', fontFamily: 'Satoshi-Bold' },
  tutorialsStateBody: { maxWidth: 280, fontSize: 12, lineHeight: 17, textAlign: 'center', fontFamily: 'Satoshi-Regular' },
  tutorialsStateButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 4,
    paddingHorizontal: 15,
    borderRadius: 13,
  },
  tutorialsStateButtonText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 14, minHeight: UI.minTapTarget,
    borderRadius: UI.radius.pill, borderWidth: 1.5,
    flexShrink: 0, minWidth: 88,
  },
  followBtnText: { fontSize: UI.type.supporting, fontFamily: 'Satoshi-Bold' },

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
    fontSize: UI.type.supporting, fontFamily: 'Satoshi-Regular',
    textAlign: 'center', lineHeight: 21,
  },
});
