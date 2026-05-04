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

import { LogCard } from '@/components/LogCard';
import { useApp, type LogType } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All', emoji: null },
  { key: 'memory', label: 'Memory', emoji: '📸' },
  { key: 'friend', label: 'Friend', emoji: '🤝' },
  { key: 'moment', label: 'Moment', emoji: '🌙' },
] as const;

type FilterKey = 'all' | LogType;

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logs, deleteLog } = useApp();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

  const filtered = activeFilter === 'all'
    ? logs
    : logs.filter(l => (l.logType ?? 'memory') === activeFilter);

  function handleDelete(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteLog(id);
  }

  const memoryCnt = logs.filter(l => (l.logType ?? 'memory') === 'memory').length;
  const friendCnt = logs.filter(l => l.logType === 'friend').length;
  const momentCnt = logs.filter(l => l.logType === 'moment').length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={['#EDE8F8', '#F8F4EE']} style={[styles.headerGrad, { height: topPad + 110 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Journal</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.push('/search')}
        >
          <Feather name="search" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Search bar shortcut */}
      <TouchableOpacity
        style={[styles.searchBarShortcut, { backgroundColor: colors.muted, borderColor: colors.border, marginHorizontal: 16, marginBottom: 10 }]}
        onPress={() => router.push('/search')}
      >
        <Feather name="search" size={14} color={colors.mutedForeground} />
        <Text style={[styles.searchBarText, { color: colors.mutedForeground }]}>
          Search memories, friends, or feelings
        </Text>
      </TouchableOpacity>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow} style={styles.filtersScroll}>
        {FILTER_OPTIONS.map(f => {
          const count = f.key === 'all' ? logs.length : f.key === 'memory' ? memoryCnt : f.key === 'friend' ? friendCnt : momentCnt;
          const isActive = activeFilter === f.key;
          return (
            <TouchableOpacity key={f.key}
              style={[styles.filterChip, {
                backgroundColor: isActive ? `${colors.primary}18` : colors.muted,
                borderColor: isActive ? `${colors.primary}45` : colors.border,
                borderWidth: isActive ? 1.5 : 1,
              }]}
              onPress={() => { setActiveFilter(f.key); Haptics.selectionAsync(); }}>
              {f.emoji && <Text style={styles.filterEmoji}>{f.emoji}</Text>}
              <Text style={[styles.filterLabel, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.filterCount, { backgroundColor: isActive ? `${colors.primary}25` : `${colors.primary}12` }]}>
                  <Text style={[styles.filterCountText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Log list */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <LogCard
            entry={item}
            onPress={() => router.push({ pathname: '/story/[id]', params: { id: item.id, source: 'log' } })}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}12` }]}>
              <Text style={{ fontSize: 32 }}>
                {activeFilter === 'friend' ? '🤝' : activeFilter === 'moment' ? '🌙' : '📸'}
              </Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {activeFilter === 'all' ? 'No entries yet' :
               activeFilter === 'friend' ? 'No friend logs yet' :
               activeFilter === 'moment' ? 'No moments yet' : 'No memory logs yet'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {activeFilter === 'all'
                ? 'Begin your journey by writing your first entry.'
                : activeFilter === 'friend'
                  ? 'Record an encounter to start building your friend memory history.'
                  : activeFilter === 'moment'
                    ? 'Capture a quiet reflection — no image needed.'
                    : 'Capture a memory with images and story panels.'}
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/create')}
            >
              <Text style={[styles.emptyBtnText, { color: '#fff' }]}>
                {activeFilter === 'friend' ? 'Log a Friend' : activeFilter === 'moment' ? 'Write a Moment' : 'Create Entry'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: bottomPad - 20 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/create'); }}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10,
  },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchBarShortcut: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchBarText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  filtersScroll: { maxHeight: 48 },
  filtersRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  filterEmoji: { fontSize: 13 },
  filterLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  filterCount: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, minWidth: 18, alignItems: 'center',
  },
  filterCountText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  list: { paddingHorizontal: 16, paddingTop: 10 },
  listEmpty: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 12, paddingTop: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 6 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  fab: {
    position: 'absolute', right: 22,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6B5B95', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
});
