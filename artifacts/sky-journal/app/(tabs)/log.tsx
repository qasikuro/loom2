import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
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

import { JournalCard } from '@/components/JournalCard';
import { useApp, type JournalEntryType } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const FILTERS = [
  { key: 'all',    label: 'All',     emoji: null  },
  { key: 'diary',  label: 'Diary',   emoji: '📓' },
  { key: 'friend', label: 'Friends', emoji: '🤝' },
  { key: 'moment', label: 'Moments', emoji: '🌙' },
] as const;

type FilterKey = 'all' | JournalEntryType;

const CREATE_ACTIONS = [
  { key: 'diary',  label: 'Write Entry',      emoji: '📓', color: '#6B5B95', route: '/create-journal-entry' },
  { key: 'friend', label: 'Log Friend',        emoji: '🤝', color: '#3A78B8', route: '/create-friend-log'   },
  { key: 'moment', label: 'Quick Moment',      emoji: '🌙', color: '#5848A8', route: '/create-moment-log'   },
] as const;

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { journalEntries, deleteJournalEntry } = useApp();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  function toggleFab() {
    const toValue = fabOpen ? 0 : 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(fabAnim, { toValue, useNativeDriver: true, tension: 80, friction: 8 }).start();
    setFabOpen(!fabOpen);
  }

  function handleCreate(route: string) {
    toggleFab();
    setTimeout(() => router.push(route as any), 120);
  }

  function handleDelete(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteJournalEntry(id);
  }

  // Counts
  const counts = {
    all: journalEntries.length,
    diary: journalEntries.filter(e => e.type === 'diary').length,
    friend: journalEntries.filter(e => e.type === 'friend').length,
    moment: journalEntries.filter(e => e.type === 'moment').length,
  };

  // Filter + search
  const filtered = journalEntries.filter(e => {
    const typeMatch = activeFilter === 'all' || e.type === activeFilter;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return typeMatch;
    const textMatch =
      e.text.toLowerCase().includes(q) ||
      e.mood.toLowerCase().includes(q) ||
      (e.friendName ?? '').toLowerCase().includes(q);
    return typeMatch && textMatch;
  });

  const emptyMessages: Record<FilterKey, string> = {
    all:    'Start writing — this is your private space.',
    diary:  'No diary entries yet. Tap + to write your first.',
    friend: 'No friend encounters logged yet.',
    moment: 'No quick moments yet. Capture a thought.',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#EDE0F8', '#F4EFF8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 110 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]}>My Journal</Text>
          <View style={[styles.privateBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}22` }]}>
            <Feather name="lock" size={10} color={colors.primary} />
            <Text style={[styles.privateBadgeText, { color: colors.primary }]}>Private</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.searchToggle, { backgroundColor: showSearch ? `${colors.primary}18` : colors.muted }]}
          onPress={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
        >
          <Feather name={showSearch ? 'x' : 'search'} size={17} color={showSearch ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 16, marginBottom: 8 }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search entries, friends, moods..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow} style={styles.filtersScroll}>
        {FILTERS.map(f => {
          const count = counts[f.key];
          const isActive = activeFilter === f.key;
          return (
            <TouchableOpacity key={f.key}
              style={[styles.filterChip, {
                backgroundColor: isActive ? `${colors.primary}18` : colors.muted,
                borderColor: isActive ? `${colors.primary}45` : colors.border,
                borderWidth: isActive ? 1.5 : 1,
              }]}
              onPress={() => { setActiveFilter(f.key); Haptics.selectionAsync(); }}
            >
              {f.emoji && <Text style={styles.filterEmoji}>{f.emoji}</Text>}
              <Text style={[styles.filterLabel, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: isActive ? `${colors.primary}25` : `${colors.primary}10` }]}>
                  <Text style={[styles.filterBadgeText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Search result hint */}
      {searchQuery.trim() && (
        <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>
          {filtered.length === 0 ? 'No results' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${searchQuery}"`}
        </Text>
      )}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={e => e.id}
        renderItem={({ item }) => (
          <JournalCard entry={item} onDelete={() => handleDelete(item.id)} />
        )}
        contentContainerStyle={[
          styles.list,
          filtered.length === 0 && styles.listEmpty,
          { paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}10` }]}>
              <Text style={{ fontSize: 32 }}>
                {activeFilter === 'friend' ? '🤝' : activeFilter === 'moment' ? '🌙' : '📓'}
              </Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {searchQuery.trim() ? `No results for "${searchQuery}"` : 'Nothing here yet'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {searchQuery.trim() ? 'Try a different word or mood.' : emptyMessages[activeFilter]}
            </Text>
          </View>
        }
      />

      {/* FAB overlay backdrop */}
      {fabOpen && (
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={toggleFab} />
      )}

      {/* FAB action pills */}
      {CREATE_ACTIONS.map((action, i) => {
        const translateY = fabAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -(72 + i * 60)],
        });
        const opacity = fabAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
        return (
          <Animated.View
            key={action.key}
            style={[styles.fabAction, { bottom: bottomPad - 20, transform: [{ translateY }], opacity }]}
            pointerEvents={fabOpen ? 'auto' : 'none'}
          >
            <TouchableOpacity
              style={[styles.fabActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleCreate(action.route)}
              activeOpacity={0.85}
            >
              <Text style={styles.fabActionEmoji}>{action.emoji}</Text>
              <Text style={[styles.fabActionLabel, { color: colors.foreground }]}>{action.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <Animated.View
        style={[
          styles.fab,
          {
            bottom: bottomPad - 20,
            backgroundColor: fabOpen ? colors.foreground : colors.primary,
            transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }],
          },
        ]}
      >
        <TouchableOpacity style={styles.fabInner} onPress={toggleFab} activeOpacity={0.85}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  privateBadgeText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  searchToggle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  filtersScroll: { maxHeight: 48 },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  filterEmoji: { fontSize: 13 },
  filterLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  filterBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, minWidth: 18, alignItems: 'center' },
  filterBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  searchHint: { fontSize: 12, fontFamily: 'Inter_400Regular', paddingHorizontal: 18, paddingBottom: 4, fontStyle: 'italic' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  listEmpty: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 12, paddingTop: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 19, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  // FAB
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 8 },
  fabAction: { position: 'absolute', right: 16, zIndex: 10, alignItems: 'flex-end' },
  fabActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 28, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  fabActionEmoji: { fontSize: 18 },
  fabActionLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  fab: { position: 'absolute', right: 22, width: 56, height: 56, borderRadius: 28, zIndex: 11, shadowColor: '#6B5B95', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10 },
  fabInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
