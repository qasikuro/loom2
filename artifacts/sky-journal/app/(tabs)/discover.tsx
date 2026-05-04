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

const TABS = ['For You', 'Vibes', 'Stories', 'New'] as const;
type TabType = (typeof TABS)[number];

const VIBES = [
  { label: 'Soft', count: '1,283', icon: 'feather' as const, color: '#9888C0', bg: '#EDE0F8' },
  { label: 'Lonely', count: '842', icon: 'moon' as const, color: '#5878A8', bg: '#D8E4F4' },
  { label: 'Romantic', count: '1,105', icon: 'heart' as const, color: '#C870A0', bg: '#F4D8EC' },
  { label: 'Chaotic', count: '512', icon: 'zap' as const, color: '#C86030', bg: '#F4E0D8' },
  { label: 'Peaceful', count: '1,688', icon: 'cloud' as const, color: '#4898A8', bg: '#D8EEF4' },
  { label: 'Adventurous', count: '983', icon: 'wind' as const, color: '#50A068', bg: '#D8F0E4' },
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
      <LinearGradient
        colors={['#EDE8F8', '#F8F4EE']}
        style={[styles.headerGrad, { height: topPad + 100 }]}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Discover</Text>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabsRow, { paddingHorizontal: 20 }]}
        style={styles.tabsScroll}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              setActiveTab(tab);
              setSelectedVibe(null);
              Haptics.selectionAsync();
            }}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.mutedForeground },
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
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
              <View style={styles.vibeBackRow}>
                <TouchableOpacity
                  onPress={() => setSelectedVibe(null)}
                  style={[styles.backBtn, { backgroundColor: colors.muted }]}
                >
                  <Feather name="arrow-left" size={16} color={colors.foreground} />
                  <Text style={[styles.backText, { color: colors.foreground }]}>{selectedVibe}</Text>
                </TouchableOpacity>
              </View>
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
                Discover stories that match your mood
              </Text>
              <View style={styles.vibesGrid}>
                {VIBES.map(vibe => (
                  <TouchableOpacity
                    key={vibe.label}
                    style={[styles.vibeCard, { backgroundColor: vibe.bg }]}
                    onPress={() => setSelectedVibe(vibe.label)}
                    activeOpacity={0.85}
                  >
                    <Feather name={vibe.icon} size={26} color={vibe.color} />
                    <Text style={[styles.vibeLabel, { color: vibe.color }]}>{vibe.label}</Text>
                    <Text style={[styles.vibeCount, { color: `${vibe.color}99` }]}>
                      {vibe.count} stories
                    </Text>
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
          scrollEnabled={!!filteredPosts.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="compass" size={32} color={colors.mutedForeground} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsScroll: { maxHeight: 44 },
  tabsRow: {
    flexDirection: 'row',
    gap: 0,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  divider: {
    height: 1,
    marginHorizontal: 0,
  },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  vibesContent: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  vibesSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  vibesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vibeCard: {
    width: '48%',
    borderRadius: 16,
    padding: 20,
    gap: 6,
    minHeight: 110,
    justifyContent: 'center',
  },
  vibeLabel: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  vibeCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  vibeBackRow: {
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
  },
});
