import { DiscoverVideoPlayerModal } from '@/components/DiscoverVideoPlayerModal';
import { Icon } from '@/components/Icon';
import { ReelCard } from '@/components/ReelCard';
import { ReportSheet } from '@/components/ReportSheet';
import { SkeletonDiscoverCard } from '@/components/Skeleton';
import { useApp, type DiscoverPost } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Alert,
  Platform,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ReelFilter = 'All' | 'Stories' | 'Videos';

const FILTERS: ReelFilter[] = ['All', 'Stories', 'Videos'];

export default function ReelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    discoverPosts,
    toggleSavePost,
    refreshFeed,
    isLoading,
    apiOnline,
    discoverLoadError,
    hasCorruptedDiscover,
  } = useApp();

  const [filter, setFilter] = useState<ReelFilter>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const [videosMuted, setVideosMuted] = useState(true);
  const [selectedVideoPost, setSelectedVideoPost] = useState<DiscoverPost | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [feedHeight, setFeedHeight] = useState(0);
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

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 300,
  });
  const onViewableItemsChanged = useRef(({
    viewableItems,
  }: {
    viewableItems: { item: DiscoverPost }[];
  }) => {
    const videoItem = viewableItems.find(item => item.item.contentType === 'video');
    setVisiblePostId(videoItem?.item.id ?? null);
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

  async function sharePost(post: DiscoverPost) {
    const path = post.bookId
      ? `book-public?bookId=${encodeURIComponent(post.bookId)}`
      : `story/${encodeURIComponent(post.id)}`;
    const appLink = `sky-journal:///${path}`;
    const mediaLink = post.contentType === 'video' && post.videoUri?.startsWith('https://')
      ? post.videoUri
      : null;
    try {
      await Share.share({
        title: post.chapterTitle,
        message: `${post.chapterTitle} by ${post.authorName}\n${mediaLink ?? appLink}${mediaLink ? `\nOpen in GameJo: ${appLink}` : ''}`,
        ...(Platform.OS === 'ios' ? { url: mediaLink ?? appLink } : {}),
      });
    } catch {
      Alert.alert('Unable to share', 'Please try sharing this reel again.');
    }
  }

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
        renderItem={({ item }) => (
          <ReelCard
            post={item}
            height={reelHeight}
            topInset={topPad}
            onOpen={() => openPost(item)}
            onAuthorPress={() => router.push({
              pathname: '/user/[userId]',
              params: { userId: item.authorUserId },
            } as never)}
            playing={item.id === visiblePostId && item.contentType === 'video'}
            muted={videosMuted}
            onMuteToggle={() => setVideosMuted(muted => !muted)}
            onShare={() => { void sharePost(item); }}
            onSave={() => toggleSavePost(item.id)}
            onReport={() => setReportTargetId(item.id)}
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
                {filter === 'All' ? 'No reels yet' : `No ${filter.toLowerCase()} yet`}
              </Text>
              <Text style={styles.emptyBody}>
                Share a story or video and it will appear here.
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/create')}
                activeOpacity={0.82}
              >
                <Icon name="plus" size={15} color="#fff" />
                <Text style={styles.emptyButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          )
        }
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
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
            <Text style={styles.title}>Reels <Text style={styles.titleStar}>✦</Text></Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(tabs)/create');
              }}
              accessibilityLabel="Create a story or video"
              activeOpacity={0.78}
            >
              <Icon name="plus" size={19} color="#F4EEFF" />
            </TouchableOpacity>
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
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </LinearGradient>

      {(!apiOnline || discoverLoadError) && !isLoading && (
        <View style={[styles.statusBanner, { top: topPad + 111 }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {discoverLoadError && apiOnline
              ? "Couldn't load reels — pull to retry"
              : 'Offline — showing saved reels'}
          </Text>
        </View>
      )}
      {hasCorruptedDiscover && apiOnline && !discoverLoadError && (
        <View style={[styles.corruptBanner, { top: topPad + 111 }]}>
          <Icon name="alert-triangle" size={13} color="#C8A84B" />
          <Text style={styles.corruptText}>Some reels could not be loaded.</Text>
        </View>
      )}

      <ReportSheet
        visible={!!reportTargetId}
        targetType="story"
        targetId={reportTargetId ?? ''}
        onClose={() => setReportTargetId(null)}
      />
      <DiscoverVideoPlayerModal
        post={selectedVideoPost}
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
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    height: 35,
    paddingHorizontal: 15,
    borderRadius: 18,
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
    fontSize: 11,
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
    fontSize: 19,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(230,220,250,0.92)',
  },
  emptyBody: {
    marginTop: 7,
    maxWidth: 280,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.52)',
  },
  emptyButton: {
    marginTop: 18,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  emptyButtonText: {
    fontSize: 13,
    fontFamily: 'Satoshi-Bold',
    color: '#fff',
  },
});