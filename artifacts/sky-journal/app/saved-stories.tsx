import { BackButton } from '@/components/BackButton';
import { DiscoverCard } from '@/components/DiscoverCard';
import { Icon } from '@/components/Icon';
import { SkeletonDiscoverCard } from '@/components/Skeleton';
import { apiFetch, useApp, type DiscoverPost } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

export default function SavedStoriesScreen() {
  const { toggleSavePost, savedStoryIds, followingIds } = useApp();
  const insets  = useSafeAreaInsets();
  const colors  = useColors();
  const { t }   = useTranslation();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;

  const [posts,       setPosts]       = useState<DiscoverPost[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchSaved = useCallback(async () => {
    try {
      const raw = await apiFetch<any[]>('/stories/saved');
      const hydrated: DiscoverPost[] = (raw ?? []).map((p: any) => ({
        ...p,
        saved:       savedStoryIds.has(p.id),
        isFollowing: followingIds.includes(p.authorUserId),
      }));
      setPosts(hydrated);
    } catch { /* silently ignore */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [savedStoryIds, followingIds]);

  useEffect(() => { fetchSaved(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSaved();
  }, [fetchSaved]);

  const handleUnsave = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSavePost(id);
    setPosts(prev => prev.filter(p => p.id !== id));
  }, [toggleSavePost]);

  const isEmpty = !loading && posts.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#0A0818', '#140934', '#1E0A50']}
        style={{ paddingTop: topPad }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <BackButton color="#EDE8FF" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Saved Stories</Text>
            <Text style={styles.headerSub}>your collected moments ✦</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={i => String(i)}
          renderItem={() => <SkeletonDiscoverCard />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 100 }}
        />
      ) : isEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>◇</Text>
          <Text style={styles.emptyTitle}>No saved stories yet</Text>
          <Text style={styles.emptySub}>
            Tap the bookmark on any story in Discover to collect it here.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyBtnText}>Explore stories</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <DiscoverCard
              post={{ ...item, saved: savedStoryIds.has(item.id), isFollowing: followingIds.includes(item.authorUserId) }}
              onSave={() => handleUnsave(item.id)}
              onPress={() => router.push(`/story/${item.id}` as any)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#9B78E8"
              colors={['#9B78E8']}
            />
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 100 }}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 12,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 20, fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.5, color: '#EDE8FF',
  },
  headerSub: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(210,196,240,0.55)', fontStyle: 'italic',
    marginTop: 2,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon:  { fontSize: 48, color: 'rgba(155,120,232,0.45)', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#3D2B6B', textAlign: 'center' },
  emptySub:   { fontSize: 14, fontFamily: 'Satoshi-Regular', color: '#7A6A9A', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(155,120,232,0.15)',
    borderWidth: 1, borderColor: 'rgba(155,120,232,0.35)',
  },
  emptyBtnText: { fontSize: 14, fontFamily: 'Satoshi-Medium', color: '#8B68C8' },

});
