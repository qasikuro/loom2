import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Thread {
  partnerId:     string;
  partnerName:   string;
  partnerHandle: string | null;
  partnerAvatar: string | null;
  lastMessage:   string;
  lastAt:        string;
  unread:        boolean;
}

function fmtThreadTime(iso: string): string {
  const d   = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)   return 'now';
  if (diffMins < 60)  return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7)   return `${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MessagesInboxScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === 'web' ? 48 : insets.top;

  const [threads,  setThreads]  = useState<Thread[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Thread[]>('/messages');
      const sorted = (data ?? []).sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
      );
      setThreads(sorted);
      setError(null);
    } catch {
      setError('Could not load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const interval = setInterval(() => { void load(); }, 15000);
      return () => clearInterval(interval);
    }, [load]),
  );

  const unreadCount = threads.filter(t => t.unread).length;

  function openThread(thread: Thread) {
    router.push({
      pathname: '/messages/[userId]',
      params: {
        userId:    thread.partnerId,
        name:      thread.partnerName,
        handle:    thread.partnerHandle ?? '',
        avatarUri: thread.partnerAvatar ?? '',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }

  const renderThread = ({ item }: { item: Thread }) => {
    const initial = item.partnerName.charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={[styles.threadRow, { borderBottomColor: `${colors.border}50` }]}
        onPress={() => openThread(item)}
        activeOpacity={0.75}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { borderColor: item.unread ? colors.primary : 'transparent', borderWidth: item.unread ? 2 : 0 }]}>
          {item.partnerAvatar ? (
            <Image source={{ uri: item.partnerAvatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['rgba(120,70,255,0.55)', 'rgba(60,140,240,0.40)']}
              style={StyleSheet.absoluteFill}
            />
          )}
          {!item.partnerAvatar && (
            <Text style={styles.avatarInitial}>{initial}</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.threadContent}>
          <View style={styles.threadTopRow}>
            <Text style={[styles.threadName, { color: colors.foreground }, item.unread && styles.threadNameUnread]} numberOfLines={1}>
              {item.partnerName}
            </Text>
            <Text style={[styles.threadTime, { color: item.unread ? colors.primary : colors.mutedForeground }]}>
              {fmtThreadTime(item.lastAt)}
            </Text>
          </View>
          {item.partnerHandle && (
            <Text style={[styles.threadHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
              @{item.partnerHandle}
            </Text>
          )}
          <Text
            style={[styles.threadLastMsg, { color: item.unread ? colors.foreground : colors.mutedForeground }]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        </View>

        {/* Unread dot */}
        {item.unread && (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['#0B0820', '#130B34', '#1A0E48']}
        style={[styles.header, { paddingTop: topPad }]}
      >
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(120,70,255,0.12)', top: -50, right: -20, pointerEvents: 'none' }} />
        <View style={styles.headerRow}>
          <BackButton color="rgba(210,200,255,0.8)" />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Messages</Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ fontFamily: 'Satoshi-Regular', color: colors.mutedForeground }}>{error}</Text>
        </View>
      ) : (
        <FlatList<Thread>
          data={threads}
          keyExtractor={t => t.partnerId}
          renderItem={renderThread}
          contentContainerStyle={threads.length === 0 ? styles.emptyContainer : { paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                <Icon name="message-circle" size={32} color={`${colors.primary}60`} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                Connect with a Constellation Guide to start a conversation.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onPress={() => router.push('/(tabs)/discover' as any)}
                activeOpacity={0.75}
              >
                <Icon name="compass" size={14} color={colors.primary} />
                <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Find a Guide</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1 },
  header:            { paddingBottom: 16 },
  headerRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  headerTitleWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:       { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#E8E0FF' },
  unreadBadge:       { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBadgeText:   { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#fff' },

  center:            { flex: 1, alignItems: 'center', justifyContent: 'center' },

  threadRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  avatar:            { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:     { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#E8E0FF', position: 'absolute' },
  threadContent:     { flex: 1, gap: 2 },
  threadTopRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  threadName:        { fontSize: 15, fontFamily: 'Satoshi-Medium', flex: 1, marginRight: 8 },
  threadNameUnread:  { fontFamily: 'Satoshi-Bold' },
  threadHandle:      { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  threadLastMsg:     { fontSize: 13, fontFamily: 'Satoshi-Regular' },
  threadTime:        { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  unreadDot:         { width: 8, height: 8, borderRadius: 4 },

  emptyContainer:    { flex: 1 },
  emptyWrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 80, gap: 12 },
  emptyIcon:         { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 4 },
  emptyTitle:        { fontSize: 17, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptyBody:         { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 20, opacity: 0.75 },
  emptyBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  emptyBtnText:      { fontSize: 14, fontFamily: 'Satoshi-Medium' },
});
