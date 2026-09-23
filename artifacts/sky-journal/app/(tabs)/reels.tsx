import { DiscoverCard } from '@/components/DiscoverCard';
import { DiscoverVideoPlayerModal } from '@/components/DiscoverVideoPlayerModal';
import { Icon } from '@/components/Icon';
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
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ReelFilter = 'All' | 'Stories' | 'Videos';

const FILTERS: ReelFilter[] = ['All', 'Stories', 'Videos'];

export default function ReelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
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
  const lastFetchRef = useRef(0);

  const topPad = Platform.OS === 'web' ? 54 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 120;
  const contentMaxWidth = viewportWidth >= 760 ? 760 : undefined;

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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#0A0718', '#1A0A43', '#2A0B58']}
        style={[styles.header, { paddingTop: topPad }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerOrbLarge} pointerEvents="none" />
        <View style={styles.headerOrbSmall} pointerEvents="none" />
        <View style={[styles.headerInner, contentMaxWidth != null && { maxWidth: contentMaxWidth }]}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Reels</Text>
              <Text style={styles.subtitle}>Stories and videos shared by the community</Text>
            </View>
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
        <View style={styles.statusBanner}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {discoverLoadError && apiOnline
              ? "Couldn't load reels — pull to retry"
              : 'Offline — showing saved reels'}
          </Text>
        </View>
      )}

      <FlatList
        data={reels}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <DiscoverCard
            post={item}
            delay={Math.min(index * 60, 360)}
            onPress={() => openPost(item)}
            onSave={() => toggleSavePost(item.id)}
            onReport={() => setReportTargetId(item.id)}
            onAuthorPress={() => router.push({
              pathname: '/user/[userId]',
              params: { userId: item.authorUserId },
            } as never)}
            isVideoPlaying={item.id === visiblePostId && item.contentType === 'video'}
            videoMuted={videosMuted}
            onMuteToggle={() => setVideosMuted(muted => !muted)}
          />
        )}
        ListHeaderComponent={hasCorruptedDiscover ? (
          <View style={styles.corruptBanner}>
            <Icon name="alert-triangle" size={13} color="#C8A84B" />
            <Text style={styles.corruptText}>Some reels could not be loaded.</Text>
          </View>
        ) : null}
        ListEmptyComponent={
          isLoading && discoverPosts.length === 0 ? (
            <View>
              {[0, 1, 2].map(index => (
                <SkeletonDiscoverCard key={index} style={{ opacity: 1 - index * 0.22 }} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
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
        contentContainerStyle={[
          styles.list,
          contentMaxWidth != null && { maxWidth: contentMaxWidth },
          { paddingBottom: bottomPad },
        ]}
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
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(185,150,255,0.14)',
  },
  headerOrbLarge: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -48,
    top: -62,
    backgroundColor: 'rgba(150,80,255,0.19)',
  },
  headerOrbSmall: {
    position: 'absolute',
    width: 95,
    height: 95,
    borderRadius: 48,
    left: -24,
    bottom: -38,
    backgroundColor: 'rgba(255,90,180,0.11)',
  },
  headerInner: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 13,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Satoshi-Black',
    color: '#F6F0FF',
    letterSpacing: -0.7,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(214,200,242,0.54)',
  },
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
    gap: 7,
    marginTop: 13,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
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
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  statusBanner: {
    marginHorizontal: 14,
    marginTop: 10,
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
    marginBottom: 10,
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