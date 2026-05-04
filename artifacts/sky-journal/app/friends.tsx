import { Feather } from '@expo/vector-icons';
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

import { useApp, type Friend, type LogEntry } from '@/context/AppContext';
import { LogCard } from '@/components/LogCard';
import { useColors } from '@/hooks/useColors';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(d: string) {
  const dt = new Date(d);
  return `${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(d);
}

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { friends, logs } = useApp();
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 20;

  const friendLogs = selectedFriend
    ? logs.filter(l => l.friendTags?.includes(selectedFriend.name))
    : [];

  if (selectedFriend) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => setSelectedFriend(null)}>
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{selectedFriend.name}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.detailScroll, { paddingBottom: bottomPad }]}>
          {/* Friend profile card */}
          <View style={[styles.friendProfile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.profileAvatar, { backgroundColor: 'rgba(72,120,168,0.15)' }]}>
              <Text style={[styles.profileAvatarText, { color: '#4878A8' }]}>{selectedFriend.name.charAt(0)}</Text>
            </View>
            <Text style={[styles.profileName, { color: colors.foreground }]}>{selectedFriend.name}</Text>
            <View style={styles.profileStats}>
              <View style={styles.profileStat}>
                <Text style={[styles.profileStatNum, { color: colors.foreground }]}>{selectedFriend.timesMet}</Text>
                <Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Times met</Text>
              </View>
              <View style={[styles.profileStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.profileStat}>
                <Text style={[styles.profileStatNum, { color: colors.foreground }]}>{timeAgo(selectedFriend.lastSeen)}</Text>
                <Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Last seen</Text>
              </View>
              <View style={[styles.profileStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.profileStat}>
                <Text style={[styles.profileStatNum, { color: colors.foreground }]}>{friendLogs.length}</Text>
                <Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Logs</Text>
              </View>
            </View>
          </View>

          {/* Memory notes timeline */}
          {selectedFriend.notes.length > 0 && (
            <View style={styles.notesSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Memory Notes</Text>
              {selectedFriend.notes.map((note, idx) => (
                <View key={idx} style={styles.noteItem}>
                  <View style={[styles.noteDot, { backgroundColor: colors.primary }]} />
                  <View style={[styles.noteBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.noteText, { color: colors.mutedForeground }]}>{note}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Related logs */}
          {friendLogs.length > 0 && (
            <View style={styles.logsSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Logs with {selectedFriend.name}</Text>
              {friendLogs.map(log => (
                <LogCard key={log.id} entry={log}
                  onPress={() => router.push({ pathname: '/story/[id]', params: { id: log.id, source: 'log' } })} />
              ))}
            </View>
          )}

          {friendLogs.length === 0 && (
            <View style={styles.emptyLogs}>
              <Feather name="book-open" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyLogsText, { color: colors.mutedForeground }]}>
                No log entries with {selectedFriend.name} yet
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Friend Memories</Text>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => router.push('/create-friend-log')}>
          <Feather name="user-plus" size={17} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {friends.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}12` }]}>
            <Text style={{ fontSize: 36 }}>🤝</Text>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No friends yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Create a Friend Log to start tracking encounters with travelers you meet in the sky.
          </Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/create-friend-log')}>
            <Text style={[styles.emptyBtnText, { color: '#fff' }]}>Log a Friend Encounter</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={f => f.id}
          renderItem={({ item: friend }) => (
            <TouchableOpacity
              style={[styles.friendCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setSelectedFriend(friend)}
              activeOpacity={0.85}
            >
              <View style={[styles.cardAvatar, { backgroundColor: 'rgba(72,120,168,0.15)' }]}>
                <Text style={[styles.cardAvatarText, { color: '#4878A8' }]}>{friend.name.charAt(0)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.foreground }]}>{friend.name}</Text>
                <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
                  Met {friend.timesMet} time{friend.timesMet !== 1 ? 's' : ''} · Last seen {timeAgo(friend.lastSeen)}
                </Text>
                {friend.notes.length > 0 && (
                  <Text style={[styles.cardNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                    "{friend.notes[friend.notes.length - 1]}"
                  </Text>
                )}
              </View>
              <View style={styles.cardRight}>
                <View style={[styles.metBadge, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}>
                  <Text style={[styles.metNum, { color: colors.primary }]}>{friend.timesMet}×</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.mutedForeground }]}>
              {friends.length} traveler{friends.length !== 1 ? 's' : ''} in your memory
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  listHeader: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic', marginBottom: 12 },
  friendCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  cardAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardAvatarText: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cardMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  cardNote: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  metNum: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  // Detail view
  detailScroll: { paddingHorizontal: 16, paddingTop: 16 },
  friendProfile: { alignItems: 'center', padding: 24, borderRadius: 20, borderWidth: 1, marginBottom: 20, gap: 12 },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 30, fontFamily: 'Inter_600SemiBold' },
  profileName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  profileStats: { flexDirection: 'row', width: '100%', marginTop: 4 },
  profileStat: { flex: 1, alignItems: 'center', gap: 3 },
  profileStatNum: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  profileStatLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  profileStatDivider: { width: 1, alignSelf: 'stretch' },
  notesSection: { marginBottom: 24, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  noteItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  noteDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8, flexShrink: 0 },
  noteBubble: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  noteText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', lineHeight: 22 },
  logsSection: { marginBottom: 20 },
  emptyLogs: { alignItems: 'center', paddingTop: 30, gap: 10 },
  emptyLogsText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', textAlign: 'center' },
});
