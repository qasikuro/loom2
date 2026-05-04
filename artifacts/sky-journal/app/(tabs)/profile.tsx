import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/assets/images';
import { TraitTag } from '@/components/TraitTag';
import { MoodBadge } from '@/components/MoodBadge';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const PROFILE_TABS = ['Stories', 'Outfits', 'Saved'] as const;
type ProfileTabType = (typeof PROFILE_TABS)[number];

const OUTFIT_CARDS = [
  { id: 'o1', name: 'Starlight Cape', rarity: 'Rare' },
  { id: 'o2', name: 'Dawn Cloak', rarity: 'Common' },
  { id: 'o3', name: 'Twilight Mask', rarity: 'Epic' },
  { id: 'o4', name: 'Cloud Mantle', rarity: 'Uncommon' },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { character, logs, discoverPosts } = useApp();
  const [activeTab, setActiveTab] = useState<ProfileTabType>('Stories');
  const [following, setFollowing] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const savedPosts = discoverPosts.filter(p => p.saved);

  function handleFollow() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFollowing(!following);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }}>
        {/* Banner */}
        <View style={{ height: topPad + 200 }}>
          <LinearGradient
            colors={['#C8B8E8', '#B8D4F0', '#EDE0F8']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {/* Decorative orbs */}
          <View style={[styles.orb, { backgroundColor: 'rgba(255,255,255,0.25)', top: -40, right: -40 }]} />
          <View style={[styles.orb2, { backgroundColor: 'rgba(200,168,75,0.2)', bottom: 0, left: -20 }]} />

          {/* Top actions */}
          <View style={[styles.topActions, { paddingTop: topPad + 8 }]}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              <Feather name="settings" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
              <Feather name="share-2" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar + Info */}
        <View style={[styles.infoSection, { backgroundColor: colors.background }]}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarGlow, { backgroundColor: `${colors.primary}20` }]} />
            <View style={[styles.avatar, { borderColor: colors.background }]}>
              <Image source={Images.character_default} style={styles.avatarImg} resizeMode="cover" />
            </View>
          </View>

          <View style={styles.nameSection}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]}>{character.name}</Text>
              <Feather name="star" size={16} color={colors.gold} style={{ marginLeft: 6 }} />
            </View>
            <Text style={[styles.handle, { color: colors.mutedForeground }]}>@{character.name.toLowerCase()}.sky</Text>
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>{character.bio}</Text>
            <View style={styles.moodRow}>
              <MoodBadge mood={character.mood} size="sm" />
              {character.traits.slice(0, 2).map(t => (
                <TraitTag key={t} label={t} />
              ))}
            </View>
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{character.joinedDate}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Joined</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{character.storiesCount}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Stories</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{character.followersCount}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Witnessed</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{character.followingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Following</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.followBtn,
                {
                  backgroundColor: following ? colors.muted : colors.primary,
                  borderColor: following ? colors.border : 'transparent',
                  borderWidth: following ? 1 : 0,
                },
              ]}
              onPress={handleFollow}
              activeOpacity={0.85}
            >
              <Text style={[styles.followText, { color: following ? colors.foreground : '#fff' }]}>
                {following ? 'Witnessed' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.messageBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            >
              <Feather name="message-circle" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Tabs */}
        <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
          {PROFILE_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.profileTab,
                activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => {
                setActiveTab(tab);
                Haptics.selectionAsync();
              }}
            >
              <Text
                style={[
                  styles.profileTabText,
                  { color: activeTab === tab ? colors.primary : colors.mutedForeground },
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'Stories' && (
          <View style={styles.tabContent}>
            {logs.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="book-open" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No stories written yet
                </Text>
                <TouchableOpacity
                  style={[styles.writeBtn, { backgroundColor: `${colors.primary}15` }]}
                  onPress={() => router.push('/(tabs)/create')}
                >
                  <Text style={[styles.writeBtnText, { color: colors.primary }]}>Write your first story</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.storyGrid}>
                {logs.map(log => (
                  <TouchableOpacity
                    key={log.id}
                    style={[styles.storyCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={() => router.push({ pathname: '/story/[id]', params: { id: log.id, source: 'log' } })}
                    activeOpacity={0.85}
                  >
                    {log.imageUri ? (
                      <Image source={{ uri: log.imageUri }} style={styles.storyThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.storyThumbPlaceholder, { backgroundColor: `${colors.primary}12` }]}>
                        <Feather name="book-open" size={20} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.storyCardBody}>
                      <Text style={[styles.storyCardTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {log.chapterTitle}
                      </Text>
                      <View style={styles.storyCardStats}>
                        <Feather name="eye" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.storyCardStat, { color: colors.mutedForeground }]}>{log.witnessedCount}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'Outfits' && (
          <View style={styles.tabContent}>
            <View style={styles.storyGrid}>
              {OUTFIT_CARDS.map(outfit => (
                <View
                  key={outfit.id}
                  style={[styles.outfitCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
                >
                  <View style={[styles.outfitIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Feather name="star" size={22} color={colors.primary} />
                  </View>
                  <Text style={[styles.outfitName, { color: colors.foreground }]}>{outfit.name}</Text>
                  <Text style={[styles.outfitRarity, { color: colors.mutedForeground }]}>{outfit.rarity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'Saved' && (
          <View style={styles.tabContent}>
            {savedPosts.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="bookmark" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No saved stories yet
                </Text>
              </View>
            ) : (
              <View style={styles.storyGrid}>
                {savedPosts.map(post => (
                  <TouchableOpacity
                    key={post.id}
                    style={[styles.storyCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={() => router.push({ pathname: '/story/[id]', params: { id: post.id, source: 'discover' } })}
                  >
                    <Image
                      source={Images[post.imageKey as keyof typeof Images] ?? Images.story_bg1}
                      style={styles.storyThumb}
                      resizeMode="cover"
                    />
                    <View style={styles.storyCardBody}>
                      <Text style={[styles.storyCardTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {post.chapterTitle}
                      </Text>
                      <Text style={[styles.storyCardStat, { color: colors.mutedForeground }]}>{post.authorName}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb: { position: 'absolute', width: 180, height: 180, borderRadius: 90 },
  orb2: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    gap: 10,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
    gap: 14,
  },
  avatarWrap: {
    marginTop: -60,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  avatarGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -8,
    left: -8,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  nameSection: { gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  handle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 4,
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  divider: { width: 1, alignSelf: 'stretch' },
  actionRow: { flexDirection: 'row', gap: 10 },
  followBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  messageBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 0,
  },
  profileTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  profileTabText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  tabContent: { padding: 16 },
  storyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  storyCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  storyThumb: { width: '100%', height: 110 },
  storyThumbPlaceholder: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyCardBody: { padding: 10, gap: 4 },
  storyCardTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  storyCardStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  storyCardStat: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  outfitCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    alignItems: 'center',
  },
  outfitIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  outfitRarity: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
  writeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  writeBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
