import { Icon } from '@/components/Icon';
import { LoadingCard, SkyLoadingMark } from '@/components/SkyLoading';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useFriendsDrawer } from '@/context/FriendsDrawerContext';
import { useTranslation } from 'react-i18next';
import { SHADOW } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
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

const TABS = ['Guides', 'Books', 'People'] as const;
type TabType = (typeof TABS)[number];

const TAB_ICONS: Record<TabType, string> = {
  Guides:  '★',
  Books:   '◎',
  People:  '◉',
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

interface GuideSessionPreview {
  id: string;
  guideId: string;
  title: string;
  description: string;
  startsAt: string;
}

export default function DiscoverScreen() {
  const { open: openFriendsDrawer } = useFriendsDrawer();
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const { t, i18n } = useTranslation();
  const { followingIds, followUser, unfollowUser, isRefreshing } = useApp();

  const [activeTab,     setActiveTab]     = useState<TabType>('Guides');
  const [peopleQuery,   setPeopleQuery]   = useState('');
  const [peopleResults, setPeopleResults] = useState<UserSearchResult[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError,   setPeopleError]   = useState<string | null>(null);
  const [guidesData,    setGuidesData]    = useState<GuideResult[]>([]);
  const [guideSessions, setGuideSessions] = useState<GuideSessionPreview[]>([]);
  const [guidesLoading, setGuidesLoading] = useState(false);
  const [guidesError,   setGuidesError]   = useState<string | null>(null);
  const [guideTopicFilter, setGuideTopicFilter] = useState<string | null>(null);
  const [guideAvailNow,    setGuideAvailNow]    = useState(false);
  const [booksData,    setBooksData]    = useState<DiscoverBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError,   setBooksError]   = useState<string | null>(null);
  const searchTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidesLoaded     = useRef(false);
  const booksLoaded      = useRef(false);
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 130;
  const contentMaxWidth = viewportWidth >= 760 ? 760 : undefined;

  function selectTab(tab: TabType) {
    setActiveTab(tab);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setPeopleResults([]);
        setPeopleError(err?.message ?? t('discoverLog.searchFailed'));
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
      const [data, sessions] = await Promise.all([
        apiFetch<GuideResult[]>(`/guides?${qs}`),
        apiFetch<GuideSessionPreview[]>('/guide-sessions').catch(() => []),
      ]);
      setGuidesData(data ?? []);
      setGuideSessions(sessions ?? []);
    } catch {
      setGuidesError(t('discoverLog.loadGuidesError'));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only activeTab should trigger this check
  }, [activeTab]);

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
        <View style={[styles.headerRow, contentMaxWidth != null && { maxWidth: contentMaxWidth }]}>
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={styles.headerTitle}>{t('discover.title')}</Text>
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
                  { color: active ? '#F2ECFF' : 'rgba(237,232,255,0.82)' },
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
        >
          {/* Header banner */}
          <LinearGradient
            colors={['rgba(80,40,180,0.28)', 'rgba(60,120,240,0.14)', 'transparent']}
             style={[styles.guideBanner, contentMaxWidth != null && { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' }]}
          >
            <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(100,60,220,0.18)', top: -40, right: -20, pointerEvents: 'none' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="star" size={16} color="#C8A84B" />
              <Text style={[styles.guideBannerTitle, { color: colors.foreground }]}>{t('discoverLog.guidesTitle')}</Text>
            </View>
            <Text style={[styles.guideBannerSub, { color: colors.mutedForeground }]}>
              {t('discoverLog.guidesSubtitle')}
            </Text>
          </LinearGradient>

          {/* Topic filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.guideTopicRow}>
            <TouchableOpacity
              style={[
                styles.guideTopicChip,
                guideTopicFilter
                  ? { backgroundColor: colors.card, borderColor: colors.border }
                  : { backgroundColor: `${colors.tint}18`, borderColor: `${colors.tint}70` },
              ]}
              onPress={() => { setGuideTopicFilter(null); loadGuides(null, guideAvailNow); Haptics.selectionAsync(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.guideTopicText, { color: guideTopicFilter ? colors.mutedForeground : colors.tint }]}>{t('discoverLog.allTopics')}</Text>
            </TouchableOpacity>
            {GUIDE_TOPICS.map(topic => {
              const active = guideTopicFilter === topic;
              return (
                <TouchableOpacity
                  key={topic}
                  style={[
                    styles.guideTopicChip,
                    active
                      ? { backgroundColor: `${colors.tint}18`, borderColor: `${colors.tint}70` }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => { const next = active ? null : topic; setGuideTopicFilter(next); loadGuides(next, guideAvailNow); Haptics.selectionAsync(); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.guideTopicText, { color: active ? colors.tint : colors.mutedForeground }]}>{t(`discoverLog.topic${GUIDE_TOPICS.indexOf(topic)}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

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
            <View style={{ marginHorizontal: 16, marginBottom: 10, padding: 10, borderRadius: 12, backgroundColor: 'rgba(180,60,60,0.12)', borderWidth: 1, borderColor: 'rgba(180,60,60,0.25)' }}>
              <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Regular', color: '#E06C75', textAlign: 'center' }}>{guidesError}</Text>
            </View>
          )}

          {/* Loading */}
          {guidesLoading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
              {[0, 1, 2].map(i => <LoadingCard key={i} style={{ opacity: 1 - i * 0.18 }} />)}
            </View>
          ) : guidesData.length === 0 ? (
            <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconBox, { backgroundColor: `${colors.tint}12` }]}>
              <Icon name="star" size={30} color={colors.tint} />
              </View>
              {guideTopicFilter ? (
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
              {guidesData.map(g => {
                const isFollowing = followingIds.includes(g.userId) || g.isFollowing;
                const nextSession = guideSessions.find(session => session.guideId === g.userId);
                return (
                  <TouchableOpacity
                    key={g.userId}
                    style={[styles.guideCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                      <View style={[styles.guideCardAvailDot, { backgroundColor: g.isAvailableNow ? '#60D890' : '#808090', borderColor: colors.card }]} />
                    </View>

                    {/* Info */}
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
                       {nextSession && (
                          <View style={[styles.guideSessionPreview, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                            <Text style={[styles.guideSessionTitle, { color: colors.foreground }]} numberOfLines={1}>{nextSession.title}</Text>
                            <Text style={[styles.guideSessionDescription, { color: colors.mutedForeground }]} numberOfLines={2}>{nextSession.description}</Text>
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <Icon name="clock" size={11} color={colors.tint} />
                              <Text style={[styles.guideSessionTime, { color: colors.tint }]}>
                                {new Date(nextSession.startsAt).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })}
                             </Text>
                           </View>
                         </View>
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

                    {/* Follow button */}
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
              placeholder={t('discoverLog.searchPeoplePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {peopleLoading && (
              <SkyLoadingMark size={16} color={colors.primary} />
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                        {isFollowing ? t('discoverLog.following') : t('discoverLog.follow')}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PeopleEmptyStart({ colors }: { colors: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyStarRing, { borderColor: `${colors.primary}28` }]}>
        <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}14` }]}>
          <Icon name="users" size={30} color={`${colors.primary}70`} />
        </View>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('discoverLog.findFriends')}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        {t('discoverLog.findFriendsBody')}
      </Text>
      <View style={[styles.searchHint, { borderColor: `${colors.primary}22`, backgroundColor: `${colors.primary}08` }]}>
        <Icon name="search" size={12} color={`${colors.primary}70`} />
        <Text style={[styles.searchHintText, { color: `${colors.primary}90` }]}>
          {t('discoverLog.searchHint')}
        </Text>
      </View>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PeopleNoResults({ colors }: { colors: any }) {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconBox, { backgroundColor: `${colors.primary}12` }]}>
        <Icon name="search" size={30} color={`${colors.primary}70`} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('discoverLog.noPeopleResults')}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
        {t('discoverLog.tryDifferentPeople')}
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
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerText:  { flex: 1, minWidth: 0, gap: 3 },
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingRight: 12,
    gap: 6,
    alignItems: 'center',
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 18, borderWidth: 1,
    flexShrink: 1,
  },
  tabIcon: { fontSize: 9, fontFamily: 'Satoshi-Bold' },
  tabText: { fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },

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
    borderRadius: 18, borderWidth: 1,
    borderColor: 'rgba(155,120,232,0.18)', padding: 14,
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 4,
    overflow: 'hidden',
    width: '100%',
  },
  guideBannerTitle: {
    fontSize: 19,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.3,
  },
  guideBannerSub: {
    fontSize: 14,
    fontFamily: 'Satoshi-Medium',
    marginTop: 4,
    lineHeight: 20,
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
  },
  guideTopicText: {
    fontSize: 13,
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
  guideAvailText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  guideCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%', maxWidth: 760, alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
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
  guideCardName:   { fontSize: 16, fontFamily: 'Satoshi-Bold', flexShrink: 1 },
  guideCardHandle: { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  guideCardBio:    { fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 19 },
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
  guideNowBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(80,200,130,0.18)',
    borderWidth: 1, borderColor: 'rgba(80,200,130,0.40)',
  },
  guideNowText: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  guideTagPill:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  guideTagText:  { fontSize: 10, fontFamily: 'Satoshi-Medium' },
  guideTagMore:  { fontSize: 11, fontFamily: 'Satoshi-Regular', alignSelf: 'center' },

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
    width: '100%', maxWidth: 760, alignSelf: 'center',
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

});
