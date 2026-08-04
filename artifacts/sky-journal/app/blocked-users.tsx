import { Icon } from '@/components/Icon';
import { apiFetch, resolveUri, useApp } from '@/context/AppContext';
import { safeBack } from '@/utils/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BlockedUser {
  blockedId:  string;
  name:       string | null;
  username:   string | null;
  avatarUri:  string | null;
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;

  const { unblockUser, blockedIds } = useApp();

  // `fetchedUsers` is the raw list from the server and never mutated after load.
  // `visibleUsers` is derived from it by intersecting with the live `blockedIds`
  // from AppContext — so an optimistic removal hides the row immediately, and a
  // rollback (failed DELETE) automatically restores it without any extra state.
  const [fetchedUsers, setFetchedUsers] = useState<BlockedUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [hasError,     setHasError]     = useState(false);
  // Track which IDs are mid-unblock so we can show a spinner on the row
  const [pending,      setPending]      = useState<Set<string>>(new Set());

  const visibleUsers = fetchedUsers.filter(u => blockedIds.includes(u.blockedId));

  const fetchBlocked = useCallback(() => {
    setLoading(true);
    setHasError(false);
    apiFetch<BlockedUser[]>('/users/blocked')
      .then(data => setFetchedUsers(data ?? []))
      .catch(() => setHasError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  const handleUnblock = useCallback((user: BlockedUser) => {
    Alert.alert(
      'Unblock user',
      `Unblock ${user.name ?? user.username ?? 'this user'}? They'll be able to see your profile and content again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            setPending(prev => new Set(prev).add(user.blockedId));
            await unblockUser(user.blockedId);
            setPending(prev => { const next = new Set(prev); next.delete(user.blockedId); return next; });
          },
        },
      ],
    );
  }, [unblockUser]);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#0A081A', '#120E28', '#0A081A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          onPress={() => safeBack()}
          style={s.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-left" size={20} color="rgba(200,184,232,0.85)" />
        </TouchableOpacity>
        <Text style={s.title}>Blocked Users</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="rgba(200,184,232,0.6)" />
        </View>
      ) : hasError ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Icon name="wifi-off" size={26} color="rgba(200,184,232,0.4)" />
          </View>
          <Text style={s.emptyHead}>Couldn't load blocked users</Text>
          <Text style={s.emptySub}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchBlocked} activeOpacity={0.75}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : visibleUsers.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIconWrap}>
            <Icon name="user-check" size={26} color="rgba(200,184,232,0.4)" />
          </View>
          <Text style={s.emptyHead}>No blocked users</Text>
          <Text style={s.emptySub}>Anyone you block will appear here so you can manage them.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.listNote}>
            Blocked users can't see your profile or content, and won't appear in your feed.
          </Text>
          {visibleUsers.map(user => {
            const isPending = pending.has(user.blockedId);
            const displayName = user.name ?? user.username ?? 'Unknown';
            const resolvedAvatar = resolveUri(user.avatarUri);
            const avatarSource = resolvedAvatar
              ? { uri: resolvedAvatar }
              : require('@/assets/images/character_default.png');

            return (
              <View key={user.blockedId} style={s.row}>
                {/* Avatar */}
                <View style={s.avatar}>
                  <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>

                {/* Info */}
                <View style={s.info}>
                  <Text style={s.name} numberOfLines={1}>{displayName}</Text>
                  {user.username ? (
                    <Text style={s.handle} numberOfLines={1}>@{user.username}</Text>
                  ) : null}
                </View>

                {/* Unblock button */}
                <TouchableOpacity
                  style={[s.unblockBtn, isPending && s.unblockBtnPending]}
                  onPress={() => handleUnblock(user)}
                  disabled={isPending}
                  activeOpacity={0.75}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color="rgba(200,184,232,0.6)" style={{ width: 52 }} />
                  ) : (
                    <Text style={s.unblockText}>Unblock</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(200,184,232,0.08)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.14)',
  },
  title: {
    fontSize: 16, fontFamily: 'Satoshi-Bold',
    color: 'rgba(235,228,255,0.95)', letterSpacing: -0.2,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 36 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(200,184,232,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyHead: { fontSize: 16, fontFamily: 'Satoshi-Bold',    color: 'rgba(200,184,232,0.75)', textAlign: 'center' },
  emptySub:  { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)', textAlign: 'center', lineHeight: 19, fontStyle: 'italic' },
  retryBtn:  { marginTop: 6, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(200,184,232,0.10)', borderWidth: 1, borderColor: 'rgba(200,184,232,0.18)' },
  retryText: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.75)' },

  list: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  listNote: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.38)', textAlign: 'center',
    lineHeight: 17, marginBottom: 4, paddingHorizontal: 8,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(200,184,232,0.10)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    backgroundColor: 'rgba(155,120,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(155,120,255,0.25)',
  },
  info:   { flex: 1, gap: 2 },
  name:   { fontSize: 14, fontFamily: 'Satoshi-Bold',    color: 'rgba(235,228,255,0.90)' },
  handle: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.45)' },

  unblockBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9,
    backgroundColor: 'rgba(200,184,232,0.10)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.20)',
    minWidth: 72, alignItems: 'center',
  },
  unblockBtnPending: { opacity: 0.6 },
  unblockText: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.80)' },
});
