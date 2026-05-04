import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp, type Friend, type LogEntry } from '@/context/AppContext';
import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';

const FILTER_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'memory', label: '📸 Memory' },
  { key: 'friend', label: '🤝 Friend' },
  { key: 'moment', label: '🌙 Moment' },
] as const;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: string) {
  const dt = new Date(d);
  return `${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return fmtDate(d);
}

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { logs, friends, searchLogs, searchFriends } = useApp();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'memory' | 'friend' | 'moment'>('all');
  const inputRef = useRef<TextInput>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 20;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const matchingLogs = query.trim()
    ? searchLogs(query).filter(l => activeFilter === 'all' || l.logType === activeFilter)
    : activeFilter !== 'all'
      ? logs.filter(l => l.logType === activeFilter)
      : [];
  const matchingFriends = query.trim() ? searchFriends(query) : friends.slice(0, 4);

  const isEmpty = !query.trim() && activeFilter === 'all';

  function logTypeIcon(type: string) {
    if (type === 'friend') return '🤝';
    if (type === 'moment') return '🌙';
    return '📸';
  }

  function logTypeColor(type: string) {
    if (type === 'friend') return '#4878A8';
    if (type === 'moment') return '#6858A8';
    return colors.primary;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search memories, friends, or feelings"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filtersRow, { paddingHorizontal: 16 }]}
        style={[styles.filtersScroll, { borderBottomColor: colors.border }]}>
        {FILTER_TYPES.map(f => (
          <TouchableOpacity key={f.key}
            style={[styles.filterChip, {
              backgroundColor: activeFilter === f.key ? `${colors.primary}18` : colors.muted,
              borderColor: activeFilter === f.key ? `${colors.primary}45` : colors.border,
              borderWidth: activeFilter === f.key ? 1.5 : 1,
            }]}
            onPress={() => setActiveFilter(f.key)}>
            <Text style={[styles.filterText, { color: activeFilter === f.key ? colors.primary : colors.mutedForeground }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.results, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled">

        {isEmpty ? (
          /* Empty state — show browse prompts */
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}12` }]}>
              <Feather name="search" size={28} color={`${colors.primary}80`} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Search your memories</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Try searching for a friend's name, a mood, a location, or any word from your stories.
            </Text>
            <View style={styles.suggestPills}>
              {['Hopeful', 'Lumière', 'Hidden Forest', 'Peaceful', 'Lonely'].map(s => (
                <TouchableOpacity key={s} style={[styles.suggestPill, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}25` }]}
                  onPress={() => setQuery(s)}>
                  <Text style={[styles.suggestPillText, { color: colors.primary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <>
            {/* Friends section */}
            {matchingFriends.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🤝 Friends</Text>
                  {matchingFriends.length > 0 && (
                    <TouchableOpacity onPress={() => router.push('/friends')}>
                      <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {matchingFriends.map(friend => (
                  <TouchableOpacity key={friend.id}
                    style={[styles.friendCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => { setQuery(friend.name); }}>
                    <View style={[styles.friendAvatar, { backgroundColor: 'rgba(72,120,168,0.15)' }]}>
                      <Text style={[styles.friendAvatarText, { color: '#4878A8' }]}>{friend.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={[styles.friendName, { color: colors.foreground }]}>{friend.name}</Text>
                      <Text style={[styles.friendMeta, { color: colors.mutedForeground }]}>
                        Met {friend.timesMet} time{friend.timesMet !== 1 ? 's' : ''} · Last seen {timeAgo(friend.lastSeen)}
                      </Text>
                      {friend.notes[friend.notes.length - 1] && (
                        <Text style={[styles.friendNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                          "{friend.notes[friend.notes.length - 1]}"
                        </Text>
                      )}
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Memories / Stories section */}
            {matchingLogs.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    {activeFilter === 'friend' ? '🤝 Friend Logs' :
                     activeFilter === 'moment' ? '🌙 Moments' :
                     activeFilter === 'memory' ? '📸 Memories' : '📖 Memories & Stories'}
                  </Text>
                  <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>{matchingLogs.length} found</Text>
                </View>
                {matchingLogs.map(log => (
                  <TouchableOpacity key={log.id}
                    style={[styles.logRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push({ pathname: '/story/[id]', params: { id: log.id, source: 'log' } })}>
                    <View style={[styles.logTypeIcon, { backgroundColor: `${logTypeColor(log.logType)}15` }]}>
                      <Text style={styles.logTypeEmoji}>{logTypeIcon(log.logType)}</Text>
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={[styles.logTitle, { color: colors.foreground }]} numberOfLines={1}>
                        {log.chapterTitle}
                      </Text>
                      <View style={styles.logMeta}>
                        <Text style={[styles.logDate, { color: colors.mutedForeground }]}>{fmtDate(log.date)}</Text>
                        {log.friendTags && log.friendTags.length > 0 && (
                          <Text style={[styles.logFriend, { color: '#4878A8' }]}>
                            · with {log.friendTags.join(', ')}
                          </Text>
                        )}
                      </View>
                      {log.panels[0]?.text && (
                        <Text style={[styles.logSnippet, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {log.panels[0].text}
                        </Text>
                      )}
                    </View>
                    <View style={styles.logRight}>
                      <MoodBadge mood={log.mood} size="sm" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* No results */}
            {matchingFriends.length === 0 && matchingLogs.length === 0 && query.trim().length > 0 && (
              <View style={styles.noResults}>
                <Feather name="cloud" size={32} color={colors.mutedForeground} />
                <Text style={[styles.noResultsText, { color: colors.mutedForeground }]}>
                  No memories found for "{query}"
                </Text>
                <Text style={[styles.noResultsSub, { color: `${colors.mutedForeground}80` }]}>
                  Try a different mood, name, or phrase
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular' },
  filtersScroll: { maxHeight: 52, borderBottomWidth: 1 },
  filtersRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  results: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  seeAll: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  resultCount: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  friendCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  friendAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  friendAvatarText: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  friendInfo: { flex: 1, gap: 3 },
  friendName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  friendMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  friendNote: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  logTypeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logTypeEmoji: { fontSize: 18 },
  logInfo: { flex: 1, gap: 3 },
  logTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  logDate: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  logFriend: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  logSnippet: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  logRight: { flexShrink: 0 },
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  suggestPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  suggestPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  suggestPillText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  noResults: { alignItems: 'center', paddingTop: 60, gap: 10 },
  noResultsText: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  noResultsSub: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
});
