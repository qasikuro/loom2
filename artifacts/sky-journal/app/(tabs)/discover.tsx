import { Icon } from '@/components/Icon';
import { DiscoverCard } from '@/components/DiscoverCard';
import { ReportSheet } from '@/components/ReportSheet';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from 'react-i18next';
import { SHADOW } from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_W = Dimensions.get('window').width;

const TABS = ['For You', 'New', 'Vibes', 'People'] as const;
type TabType = (typeof TABS)[number];

const TAB_LABEL_KEYS: Record<TabType, string> = {
  'For You': 'discover.forYou',
  'New':     'discover.new',
  'Vibes':   'discover.vibes',
  'People':  'discover.people',
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
  isFollowing: boolean;
}

export default function DiscoverScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const { t }     = useTranslation();
  const { discoverPosts, toggleSavePost, followingIds, followUser, unfollowUser } = useApp();

  const [activeTab,     setActiveTab]     = useState<TabType>('For You');
  const [selectedVibe,  setSelectedVibe]  = useState<string | null>(null);
  const [peopleQuery,   setPeopleQuery]   = useState('');
  const [peopleResults, setPeopleResults] = useState<UserSearchResult[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError,   setPeopleError]   = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 130;

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

  const newPosts  = [...discoverPosts].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const vibePosts = selectedVibe
    ? discoverPosts.filter(p => p.vibe === selectedVibe || p.mood === selectedVibe)
    : discoverPosts;
  const activePosts =
    activeTab === 'For You' ? discoverPosts :
    activeTab === 'New'     ? newPosts      : vibePosts;

  const CARD_W = (SCREEN_W - 48) / 2;  // 2 columns with 16px padding each side + 16px gap

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Vivid gradient header (in-flow, not absolute) ─────────── */}
      <LinearGradient
        colors={['#1A0848', '#3A18B8', '#5430C0']}
        style={{ paddingTop: topPad }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ position: 'absolute', width: 155, height: 155, borderRadius: 78, backgroundColor: 'rgba(100,60,255,0.16)', top: -35, right: -8, pointerEvents: 'none' }} />
        <View style={{ position: 'absolute', width: 95, height: 95, borderRadius: 48, backgroundColor: 'rgba(60,140,240,0.12)', top: 22, left: -18, pointerEvents: 'none' }} />
        <View style={{ position: 'absolute', width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(200,168,75,0.12)', bottom: 12, right: 68, pointerEvents: 'none' }} />

        {/* Title row */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t('discover.title')}</Text>
            <Text style={styles.headerSub}>{t('discover.subTitle')}</Text>
          </View>
          <TouchableOpacity
            style={styles.usersBtn}
            onPress={() => selectTab('People')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="users" size={18} color="rgba(200,184,232,0.85)" />
          </TouchableOpacity>
        </View>

        {/* Tab pills row */}
        <View style={styles.tabsRow}>
          {TABS.map(tab => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => selectTab(tab)}
                style={[
                  styles.tabPill,
                  active
                    ? { backgroundColor: 'rgba(120,86,255,0.28)', borderColor: 'rgba(120,86,255,0.55)' }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(200,184,232,0.14)' },
                ]}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.tabText,
                  { color: active ? '#C8B8F8' : 'rgba(200,184,232,0.55)' },
                ]}>
                  {t(TAB_LABEL_KEYS[tab])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {/* Thin separator */}
      <View style={[styles.sep, { backgroundColor: colors.border }]} />

      {/* ── For You / New ──────────────────────────────────── */}
      {(activeTab === 'For You' || activeTab === 'New') && (
        <FlatList
          key={activeTab}
          data={activePosts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <DiscoverCard
              post={item}
              onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id, source: 'discover' } })}
              onSave={() => toggleSavePost(item.id)}
              onReport={() => setReportTargetId(item.id)}
              onAuthorPress={() => router.push({ pathname: '/user/[userId]', params: { userId: item.authorUserId } } as any)}
            />
          )}
          contentContainerStyle={[styles.listPad, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyFeed
              tab={activeTab}
              colors={colors}
              onCreatePress={() => router.push('/(tabs)/create')}
            />
          }
        />
      )}

      {/* ── Vibes ─────────────────────────────────────────── */}
      {activeTab === 'Vibes' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.vibesScroll, { paddingBottom: bottomPad }]}
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
                    <View style={[styles.personAvatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }]}>
                      <Text style={[styles.personInitial, { color: colors.primary }]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
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
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerText:  { flex: 1, gap: 2 },
  headerTitle: {
    fontSize: 20, fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.4, color: 'rgba(235,228,255,0.97)',
  },
  headerSub: {
    fontSize: 11, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.55)',
  },
  usersBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(120,86,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(120,86,255,0.28)',
    marginTop: 2,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  tabText: { fontSize: 12, fontFamily: 'Satoshi-Medium', letterSpacing: 0.1 },

  sep: { height: StyleSheet.hairlineWidth },

  // Feed list
  listPad: { paddingHorizontal: 16, paddingTop: 14 },

  // Vibes
  vibesScroll: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  vibeHint: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', textAlign: 'center',
    paddingBottom: 4,
  },
  vibeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  vibeCard: {
    borderRadius: 18, borderWidth: 1,
    padding: 14, gap: 6,
    minHeight: 110,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  vibeIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  vibeLabel: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  vibeCount: { fontSize: 11, fontFamily: 'Satoshi-Regular' },

  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22, borderWidth: 1, marginBottom: 6,
  },
  backText: { fontSize: 14, fontFamily: 'Satoshi-Bold' },

  // People
  peopleRoot: { flex: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    margin: 16, borderRadius: 13, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: 13, fontFamily: 'Satoshi-Regular',
    paddingVertical: 0,
  },
  peopleList: { paddingHorizontal: 16, gap: 8 },
  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 16, borderWidth: 1,
    padding: 12,
  },
  personAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, flexShrink: 0,
  },
  personInitial:  { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  personInfo:     { flex: 1, gap: 2 },
  personName:     { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  personHandle:   { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  personBio:      { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 15 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, height: 30,
    borderRadius: 15, borderWidth: 1.5,
    flexShrink: 0,
  },
  followBtnText: { fontSize: 11, fontFamily: 'Satoshi-Bold' },

  // Empty states
  emptyWrap: {
    alignItems: 'center', paddingTop: 60,
    paddingHorizontal: 36, gap: 12,
  },
  emptyStarRing: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, marginBottom: 4,
  },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 19, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  emptyBody:  {
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    fontStyle: 'italic', textAlign: 'center', lineHeight: 21,
  },
  searchHint: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, marginTop: 4,
  },
  searchHintText: { fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, height: 48, borderRadius: 24,
    marginTop: 6,
  },
  ctaBtnText: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#fff' },
});
