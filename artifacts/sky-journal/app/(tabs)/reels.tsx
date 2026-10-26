import { DiscoverVideoPlayerModal } from '@/components/DiscoverVideoPlayerModal';
import { Icon } from '@/components/Icon';
import { ReelCard } from '@/components/ReelCard';
import { ReportSheet } from '@/components/ReportSheet';
import { SkeletonDiscoverCard } from '@/components/Skeleton';
import { useFriendsDrawer } from '@/context/FriendsDrawerContext';
import { useApp, type DiscoverPost } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { UI } from '@/constants/uiTokens';
import { getReelPlaybackWindow } from '@/utils/reelPlayback';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  AppState,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareContent } from '@/utils/shareContent';

type ReelFilter = 'All' | 'Stories' | 'Videos';

const FILTERS: ReelFilter[] = ['All', 'Stories', 'Videos'];

export default function ReelsScreen() {
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    discoverPosts,
    toggleSavePost,
    toggleLikePost,
    refreshFeed,
    isLoading,
    apiOnline,
    hasCheckedApi,
    discoverLoadError,
    hasCorruptedDiscover,
    dmUnread,
  } = useApp();
  const { open: openFriendsDrawer } = useFriendsDrawer();

  const [filter, setFilter] = useState<ReelFilter>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const [readyPostId, setReadyPostId] = useState<string | null>(null);
  const [videosMuted, setVideosMuted] = useState(true);
  const [selectedVideoPost, setSelectedVideoPost] = useState<DiscoverPost | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [feedHeight, setFeedHeight] = useState(0);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const listRef = useRef<FlatList<DiscoverPost>>(null);
  const lastFetchRef = useRef(0);

  const topPad = Platform.OS === 'web' ? 54 : insets.top;
  const reelHeight = Math.max(420, feedHeight);

  const reels = useMemo(() => {
    if (filter === 'Stories') {
      return discoverPosts.filter(post => post.contentType !== 'video');
    }
    if (filter === 'Videos') {
      return discoverPosts.filter(post => post.contentType === 'video');
    }
    return discoverPosts;
  }, [discoverPosts, filter]);
  const playbackEnabled = isFocused && appActive && !selectedVideoPost;
  const { activePostId, preparedIndices } = getReelPlaybackWindow(reels, visiblePostId, readyPostId, playbackEnabled);
  const activePostIdRef = useRef(activePostId);
  activePostIdRef.current = activePostId;
  const onVideoBufferHealth = useCallback((id: string, allowed: boolean) => {
    // Late status callbacks from a reel we just swiped past cannot change
    // the visible player's bandwidth budget.
    if (id !== activePostIdRef.current) return;
    setReadyPostId(current => allowed ? id : current === id ? null : current);
  }, []);
  useEffect(() => {
    if (!playbackEnabled) setReadyPostId(null);
  }, [playbackEnabled]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 55,
    minimumViewTime: 40,
  });
  const onViewableItemsChanged = useRef(({
    viewableItems,
  }: {
    viewableItems: { item: DiscoverPost }[];
  }) => {
    // Keep the current reel during the brief gap between two 55%-visible pages.
    const visible = viewableItems[0];
    if (visible) setVisiblePostId(visible.item.id);
  });

  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 2 * 60 * 1000) {
      lastFetchRef.current = now;
      refreshFeed().catch(() => null);
    }
  }, [refreshFeed]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastFetchRef.current = Date.now();
    await refreshFeed().catch(() => null);
    setRefreshing(false);
  }, [refreshFeed]);

  const openPost = useCallback((post: DiscoverPost) => {
    if (post.contentType === 'video') {
      setSelectedVideoPost(post);
      return;
    }
    if (post.bookId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push({ pathname: '/book-public', params: { bookId: post.bookId } } as any);
      return;
    }
    router.push({ pathname: '/story/[id]', params: { id: post.id, source: 'reels' } });
  }, []);

  const openAuthor = useCallback((userId: string) => {
    router.push({ pathname: '/user/[userId]', params: { userId } } as never);
  }, []);
  const toggleMuted = useCallback(() => setVideosMuted(muted => !muted), []);

  const sharePost = useCallback(async (post: DiscoverPost) => {
    const path = post.bookId
      ? `/book-public?bookId=${encodeURIComponent(post.bookId)}`
      : `/story/${encodeURIComponent(post.id)}`;
    await shareContent({
      title: post.chapterTitle,
      description: t('reels.byAuthor', { title: post.chapterTitle, name: post.authorName }),
      path,
    });
  }, [t]);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
      onLayout={event => {
        const next = Math.round(event.nativeEvent.layout.height);
        if (next > 0 && next !== feedHeight) setFeedHeight(next);
      }}
    >
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <ReelCard
            post={item}
            height={reelHeight}
            topInset={topPad}
            onOpen={openPost}
            onAuthorPress={openAuthor}
            playing={playbackEnabled && item.id === activePostId && item.contentType === 'video'}
            prepareVideo={preparedIndices.includes(index)}
            onVideoReady={onVideoBufferHealth}
            muted={videosMuted}
            onMuteToggle={toggleMuted}
            onShare={sharePost}
            onLike={toggleLikePost}
            onSave={toggleSavePost}
            onReport={setReportTargetId}
          />
        )}
        ListEmptyComponent={
          isLoading && discoverPosts.length === 0 ? (
            <View style={{ paddingTop: topPad + 116 }}>
              {[0, 1, 2].map(index => (
                <SkeletonDiscoverCard key={index} style={{ opacity: 1 - index * 0.22 }} />
              ))}
            </View>
          ) : (
            <View style={[styles.empty, { paddingTop: topPad + 170 }]}>
              <View style={styles.emptyIcon}>
                <Icon
                  name={filter === 'Videos' ? 'video' : 'star'}
                  size={30}
                  color="rgba(190,160,255,0.70)"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {t(filter === 'All' ? 'reels.emptyAll' : filter === 'Videos' ? 'reels.emptyVideos' : 'reels.emptyStories')}
              </Text>
              <Text style={styles.emptyBody}>
                {t('reels.emptyBody')}
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/create')}
                activeOpacity={0.82}
              >
                <Icon name="plus" size={15} color="#fff" />
                <Text style={styles.emptyButtonText}>{t('reels.create')}</Text>
              </TouchableOpacity>
            </View>
          )
        }
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={false}
        getItemLayout={(_, index) => ({
          length: reelHeight,
          offset: reelHeight * index,
          index,
        })}
        snapToInterval={reelHeight}
        decelerationRate="fast"
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      <LinearGradient
        colors={['rgba(9,6,24,0.92)', 'rgba(9,6,24,0.55)', 'transparent']}
        style={[styles.header, { paddingTop: topPad }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerInner}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('reels.title')} <Text style={styles.titleStar}>✦</Text></Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => openFriendsDrawer('all')}
                accessibilityRole="button" accessibilityLabel={t('social.openMessages')}
                activeOpacity={0.78}
                testID="reels-chat"
              >
                <Icon name="message-circle" size={19} color="#F4EEFF" />
                {dmUnread > 0 && <View style={styles.dmDot} />}
              </TouchableOpacity>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/create');
              }}
              accessibilityLabel={t('reels.createAccessible')}
              activeOpacity={0.78}
            >
              <Icon name="plus" size={19} color="#F4EEFF" />
            </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map(item => {
              const active = item === filter;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => {
                    setFilter(item);
                    setVisiblePostId(null);
                    setReadyPostId(null);
                    listRef.current?.scrollToOffset({ offset: 0, animated: false });
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.76}
                >
                  <Icon
                    name={item === 'Videos' ? 'video' : item === 'Stories' ? 'book-open' : 'layers'}
                    size={12}
                    color={active ? '#D9C7FF' : 'rgba(205,192,235,0.48)'}
                  />
                   <Text style={[styles.filterText, active && styles.filterTextActive]}>{t(`reels.filter${item}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </LinearGradient>

      {((hasCheckedApi && !apiOnline) || discoverLoadError) && !isLoading && (
        <View style={[styles.statusBanner, { top: topPad + 111 }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {discoverLoadError && apiOnline
               ? t('reels.loadFailed')
               : t('reels.offline')}
          </Text>
        </View>
      )}
      {hasCorruptedDiscover && apiOnline && !discoverLoadError && (
        <View style={[styles.corruptBanner, { top: topPad + 111 }]}>
          <Icon name="alert-triangle" size={13} color="#C8A84B" />
           <Text style={styles.corruptText}>{t('reels.corrupt')}</Text>
        </View>
      )}

      <ReportSheet
        visible={!!reportTargetId}
        targetType="story"
        targetId={reportTargetId ?? ''}
        onClose={() => setReportTargetId(null)}
      />
      <DiscoverVideoPlayerModal
        post={isFocused ? selectedVideoPost : null}
        onClose={() => setSelectedVideoPost(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    left: 0, right: 0, top: 0, zIndex: 2,
  },
  headerInner: {
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 5,
    paddingBottom: 9,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  title: {
    fontSize: 27,
    fontFamily: 'Satoshi-Black',
    color: '#F6F0FF',
    letterSpacing: -0.7,
  },
  titleStar: { color: '#D6B8FF', fontSize: 22 },
  dmDot: { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: '#E05568' },
  createButton: {
    width: UI.minTapTarget,
    height: UI.minTapTarget,
    borderRadius: UI.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(180,130,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(200,170,255,0.32)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    minHeight: UI.minTapTarget,
    paddingHorizontal: 16,
    borderRadius: UI.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.12)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(155,120,232,0.22)',
    borderColor: 'rgba(180,145,245,0.48)',
  },
  filterText: {
    fontSize: UI.type.supporting,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(205,192,235,0.48)',
  },
  filterTextActive: {
    color: '#D9C7FF',
  },
  list: {
    width: '100%',
  },
  statusBanner: {
    position: 'absolute',
    zIndex: 3,
    left: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(200,168,75,0.35)',
    backgroundColor: 'rgba(14,10,32,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C8A84B',
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Satoshi-Medium',
    color: 'rgba(220,210,240,0.78)',
  },
  corruptBanner: {
    position: 'absolute',
    zIndex: 3,
    left: 14,
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(200,168,75,0.24)',
    backgroundColor: 'rgba(200,168,75,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  corruptText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(220,210,190,0.65)',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(155,120,232,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(155,120,232,0.24)',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: UI.type.cardTitle,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(230,220,250,0.92)',
  },
  emptyBody: {
    marginTop: 7,
    maxWidth: 280,
    textAlign: 'center',
    fontSize: UI.type.supporting,
    lineHeight: 21,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.52)',
  },
  emptyButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: UI.radius.pill,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyButtonText: {
    fontSize: UI.type.supporting,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },
});