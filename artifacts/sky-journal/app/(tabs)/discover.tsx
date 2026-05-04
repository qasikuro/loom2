import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverCard } from '@/components/DiscoverCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';

const TABS = ['For You', 'Vibes', 'Stories', 'New'] as const;
type TabType = (typeof TABS)[number];

const VIBES = [
  { label: 'Soft',        count: '1.2k', icon: 'feather' as const, color: '#7B6BAA', bg: '#EDE6F8' },
  { label: 'Lonely',      count: '842',  icon: 'moon'    as const, color: '#4A6898', bg: '#D8E4F4' },
  { label: 'Romantic',    count: '1.1k', icon: 'heart'   as const, color: '#B86098', bg: '#F4D8EC' },
  { label: 'Chaotic',     count: '512',  icon: 'zap'     as const, color: '#B85830', bg: '#F4E0D8' },
  { label: 'Peaceful',    count: '1.6k', icon: 'cloud'   as const, color: '#3888A0', bg: '#D8EEF4' },
  { label: 'Adventurous', count: '983',  icon: 'wind'    as const, color: '#3A9060', bg: '#D8F0E4' },
];

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { discoverPosts, toggleSavePost } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('For You');
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const filteredPosts =
    activeTab === 'Stories'
      ? discoverPosts.filter(p => p.chapterNumber > 1)
      : activeTab === 'New'
        ? [...discoverPosts].reverse()
        : activeTab === 'Vibes' && selectedVibe
          ? discoverPosts.filter(p => p.vibe === selectedVibe)
          : discoverPosts;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#E8E2F8', '#EEE8F8', '#F7F3ED']} style={[styles.headerGrad, { height: topPad + 110 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Discover</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Stories from the sky</Text>
        </View>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted, borderColor: colors.border }, SHADOW.xs]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
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
              style={[styles.tab, active && { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` },
                !active && { backgroundColor: colors.muted, borderColor: 'transparent' }]}
            >
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground }]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Content */}
      {activeTab === 'Vibes' ? (
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
                <Feather name="arrow-left" size={15} color={colors.foreground} />
                <Text style={[styles.backText, { color: colors.foreground }]}>{selectedVibe}</Text>
              </TouchableOpacity>
              {filteredPosts.map(post => (
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
                {VIBES.map(vibe => (
                  <TouchableOpacity
                    key={vibe.label}
                    style={[styles.vibeCard, { backgroundColor: vibe.bg, borderColor: `${vibe.color}20` }, SHADOW.xs]}
                    onPress={() => setSelectedVibe(vibe.label)}
                    activeOpacity={0.88}
                  >
                    <View style={[styles.vibeIconWrap, { backgroundColor: `${vibe.color}15` }]}>
                      <Feather name={vibe.icon} size={20} color={vibe.color} />
                    </View>
                    <Text style={[styles.vibeLabel, { color: vibe.color }]}>{vibe.label}</Text>
                    <Text style={[styles.vibeCount, { color: `${vibe.color}80` }]}>{vibe.count} stories</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredPosts}
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
                <Feather name="compass" size={26} color={`${colors.primary}70`} />
              </View>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No stories in this section yet.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -0.6 },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginTop: 2 },
  tabsScroll: { maxHeight: 48 },
  tabsRow: { flexDirection: 'row', gap: 7, paddingVertical: 6 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
  },
  tabText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1 },
  list: { paddingHorizontal: 16, paddingTop: 14 },
  vibesContent: { paddingHorizontal: 16, paddingTop: 14, gap: 16 },
  vibesSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  vibesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  vibeCard: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    minHeight: 120,
    justifyContent: 'center',
  },
  vibeIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  vibeLabel: { fontSize: 17, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  vibeCount: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  backText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
});
