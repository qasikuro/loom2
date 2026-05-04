import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { DiscoverCard } from '@/components/DiscoverCard';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';

const TABS = ['For You', 'New', 'Vibes', 'People'] as const;
type TabType = (typeof TABS)[number];

const VIBES = [
  { label: 'Soft',        icon: 'feather'  as const, color: '#7B6BAA' },
  { label: 'Lonely',      icon: 'moon'     as const, color: '#4A6898' },
  { label: 'Romantic',    icon: 'heart'    as const, color: '#B86098' },
  { label: 'Chaotic',     icon: 'zap'      as const, color: '#B85830' },
  { label: 'Peaceful',    icon: 'cloud'    as const, color: '#3888A0' },
  { label: 'Adventurous', icon: 'wind'     as const, color: '#3A9060' },
  { label: 'Dreamy',      icon: 'star'     as const, color: '#7A5AB0' },
  { label: 'Hopeful',     icon: 'sunrise'  as const, color: '#C8903A' },
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
  const { discoverPosts, toggleSavePost, followingIds, followUser, unfollowUser } = useApp();
  const [activeTab, setActiveTab]     = useState<TabType>('For You');
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [peopleQuery, setPeopleQuery]     = useState('');
  const [peopleResults, setPeopleResults] = useState<UserSearchResult[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePeopleSearch(q: string) {
    setPeopleQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setPeopleResults([]); return; }
    setPeopleLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(q.trim())}`);
        setPeopleResults(res ?? []);
      } catch {
        setPeopleResults([]);
      } finally {
        setPeopleLoading(false);
      }
    }, 400);
  }

  function handleToggleFollow(result: UserSearchResult) {
    Haptics.selectionAsync();
    const nowFollowing = followingIds.includes(result.userId) || result.isFollowing;
    setPeopleResults(prev =>
      prev.map(r => r.userId === result.userId ? { ...r, isFollowing: !nowFollowing } : r),
    );
    if (nowFollowing) {
      unfollowUser(result.userId);
    } else {
      followUser(result.userId);
    }
  }

  const newPosts  = [...discoverPosts].sort((a, b) =>
    new Date(b.timeAgo).getTime() - new Date(a.timeAgo).getTime()
  );

  const vibePosts = selectedVibe
    ? discoverPosts.filter(p => p.vibe === selectedVibe || p.mood === selectedVibe)
    : discoverPosts;

  const activePosts =
    activeTab === 'For You' ? discoverPosts :
    activeTab === 'New'     ? newPosts      :
    vibePosts;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#14112E', '#1A1640', '#1E1A48']} style={[styles.headerGrad, { height: topPad + 138 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: 'rgba(235,228,255,0.97)' }]}>Discover</Text>
          <Text style={[styles.headerSub, { color: 'rgba(200,184,232,0.6)' }]}>Stories from the sky</Text>
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(200,184,232,0.18)' }]}
          onPress={() => { setActiveTab('People'); Haptics.selectionAsync(); }}
        >
          <Icon name="users" size={17} color="rgba(200,184,232,0.75)" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabsRow, { paddingHorizontal: 18 }]}
        style={styles.tabsScroll}
      >
        {TABS.map(tab => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => { setActiveTab(tab); setSelectedVibe(null); Haptics.selectionAsync(); }}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }
                  : { backgroundColor: colors.muted, borderColor: 'transparent' },
              ]}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* ── People tab ──────────────────────────────────────────────────── */}
      {activeTab === 'People' ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Icon name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={peopleQuery}
              onChangeText={handlePeopleSearch}
              placeholder="Search by name or @username…"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {peopleLoading && <ActivityIndicator size="small" color={colors.primary} />}
            {!peopleLoading && peopleQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setPeopleQuery(''); setPeopleResults([]); }}>
                <Icon name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {peopleQuery.length < 2 ? (
            <View style={styles.searchHint}>
              <View style={[styles.searchHintIcon, { backgroundColor: `${colors.primary}0E` }]}>
                <Icon name="users" size={24} color={`${colors.primary}60`} />
              </View>
              <Text style={[styles.searchHintTitle, { color: colors.foreground }]}>Find Sky Friends</Text>
              <Text style={[styles.searchHintSub, { color: colors.mutedForeground }]}>
                Search by name or @handle to find other wanderers and follow their stories.
              </Text>
            </View>
          ) : peopleResults.length === 0 && !peopleLoading ? (
            <View style={styles.searchHint}>
              <View style={[styles.searchHintIcon, { backgroundColor: `${colors.primary}0E` }]}>
                <Icon name="search" size={24} color={`${colors.primary}60`} />
              </View>
              <Text style={[styles.searchHintTitle, { color: colors.foreground }]}>No wanderers found</Text>
              <Text style={[styles.searchHintSub, { color: colors.mutedForeground }]}>
                Try a different name or username.
              </Text>
            </View>
          ) : (
            <FlatList
              data={peopleResults}
              keyExtractor={r => r.userId}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: bottomPad }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isFollowing = followingIds.includes(item.userId) || item.isFollowing;
                return (
                  <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.xs]}>
                    <View style={[styles.userAvatar, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                      <Text style={[styles.userAvatarText, { color: colors.primary }]}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.username ? (
                        <Text style={[styles.userHandle, { color: colors.primary }]}>@{item.username}</Text>
                      ) : null}
                      {item.bio ? (
                        <Text style={[styles.userBio, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {item.bio}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.followBtn,
                        isFollowing
                          ? { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }
                          : { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => handleToggleFollow(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.followBtnText,
                        { color: isFollowing ? colors.primary : '#fff' },
                      ]}>
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>

      /* ── Vibes tab ──────────────────────────────────────────────────── */
      ) : activeTab === 'Vibes' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.vibesContent, { paddingBottom: bottomPad }]}
        >
          {selectedVibe ? (
            <>
              <TouchableOpacity
                onPress={() => setSelectedVibe(null)}
                style={[styles.backBtn, { backgroundColor: colors.muted }]}
              >
                <Icon name="arrow-left" size={15} color={colors.foreground} />
                <Text style={[styles.backText, { color: colors.foreground }]}>{selectedVibe}</Text>
              </TouchableOpacity>
              {vibePosts.length === 0 ? (
                <View style={styles.empty}>
                  <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}0F` }]}>
                    <Icon name="compass" size={26} color={`${colors.primary}70`} />
                  </View>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No public {selectedVibe} stories yet.
                  </Text>
                </View>
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
              <Text style={[styles.vibesSubtitle, { color: colors.mutedForeground }]}>
                Find stories that match your mood
              </Text>
              <View style={styles.vibesGrid}>
                {VIBES.map(vibe => {
                  const count = discoverPosts.filter(p => p.mood === vibe.label || p.vibe === vibe.label).length;
                  return (
                    <TouchableOpacity
                      key={vibe.label}
                      style={[styles.vibeCard, { backgroundColor: `${vibe.color}20`, borderColor: `${vibe.color}40` }, SHADOW.xs]}
                      onPress={() => setSelectedVibe(vibe.label)}
                      activeOpacity={0.88}
                    >
                      <View style={[styles.vibeIconWrap, { backgroundColor: `${vibe.color}28` }]}>
                        <Icon name={vibe.icon} size={20} color={vibe.color} />
                      </View>
                      <Text style={[styles.vibeLabel, { color: vibe.color }]}>{vibe.label}</Text>
                      <Text style={[styles.vibeCount, { color: `${vibe.color}80` }]}>{count} stories</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

      /* ── For You / New tabs ─────────────────────────────────────────── */
      ) : (
        <FlatList
          data={activePosts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <DiscoverCard
              post={item}
              onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id, source: 'discover' } })}
              onSave={() => toggleSavePost(item.id)}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}0F` }]}>
                <Icon name="compass" size={26} color={`${colors.primary}70`} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>The sky is quiet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeTab === 'For You'
                  ? 'Follow other wanderers to see their stories here.'
                  : 'No public stories yet. Be the first to share one.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  headerGrad:   { position: 'absolute', top: 0, left: 0, right: 0 },
  header:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle:  { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  headerSub:    { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3, letterSpacing: 0.1 },
  iconBtn:      { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginTop: 2 },
  tabsScroll:   { maxHeight: 52 },
  tabsRow:      { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  tab:          { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 22, borderWidth: 1 },
  tabText:      { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.1 },
  divider:      { height: 1, marginTop: 1 },
  list:         { paddingHorizontal: 16, paddingTop: 16 },

  // Search (People tab)
  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 14, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput:  { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  searchHint:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  searchHintIcon:  { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  searchHintTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  searchHintSub:   { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },

  // User card
  userCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  userAvatar:   { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, flexShrink: 0 },
  userAvatarText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  userInfo:     { flex: 1, gap: 2 },
  userName:     { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  userHandle:   { fontSize: 12, fontFamily: 'Inter_500Medium' },
  userBio:      { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  followBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, flexShrink: 0 },
  followBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  // Vibes
  vibesContent: { paddingHorizontal: 16, paddingTop: 14, gap: 16 },
  vibesSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  vibesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vibeCard:     { width: '48%', borderRadius: 22, borderWidth: 1, padding: 18, gap: 10, minHeight: 128, justifyContent: 'center' },
  vibeIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  vibeLabel:    { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  vibeCount:    { fontSize: 11, fontFamily: 'Inter_400Regular' },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  backText:     { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Empty
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyIcon:    { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyText:    { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },
});
