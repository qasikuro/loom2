import { Icon } from '@/components/Icon';
import { LoadingCard, SkyLoadingMark } from '@/components/SkyLoading';
import { apiFetch, resolveUri, useApp } from '@/context/AppContext';
import { safeBack } from '@/utils/navigation';
import { LinearGradient } from 'expo-linear-gradient';
import { SecureImage as Image } from '@/components/SecureImage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

interface BlockedUser {
  blockedId:  string;
  name:       string | null;
  username:   string | null;
  avatarUri:  string | null;
}

export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;
  const backgroundGradient: [string, string, string] = isDark
    ? ['#0A081A', '#120E28', '#0A081A']
    : ['#EFE9F8', '#F9F7F0', colors.background];

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
      t('social.unblockUser'),
      t('social.unblockConfirmBody', { name: user.name ?? user.username ?? t('social.thisUser') }),
      [
        { text: t('social.cancel'), style: 'cancel' },
        {
          text: t('social.unblock'),
          style: 'destructive',
          onPress: async () => {
            setPending(prev => new Set(prev).add(user.blockedId));
            await unblockUser(user.blockedId);
            setPending(prev => { const next = new Set(prev); next.delete(user.blockedId); return next; });
          },
        },
      ],
    );
  }, [t, unblockUser]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* ── Header ── */}
      <View style={[s.header, {
        paddingTop: topPad + 10,
        borderBottomColor: isDark ? 'rgba(200,184,232,0.08)' : colors.border,
      }]}>
        <TouchableOpacity
          onPress={() => safeBack()}
          style={[s.backBtn, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.card,
            borderColor: isDark ? 'rgba(200,184,232,0.14)' : colors.border,
          }]}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="chevron-left" size={20} color={isDark ? 'rgba(200,184,232,0.85)' : colors.mutedForeground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>{t('social.blockedUsers')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Content ── */}
      {loading ? (
        <ScrollView
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {[0, 1, 2].map(i => <LoadingCard key={i} style={{ opacity: 1 - i * 0.18 }} />)}
        </ScrollView>
      ) : hasError ? (
        <View style={s.center}>
          <View style={[s.emptyIconWrap, {
            backgroundColor: isDark ? 'rgba(200,184,232,0.06)' : colors.glowPurple,
            borderColor: isDark ? 'rgba(200,184,232,0.12)' : colors.border,
          }]}>
            <Icon name="wifi-off" size={26} color={isDark ? 'rgba(200,184,232,0.4)' : colors.mutedForeground} />
          </View>
          <Text style={[s.emptyHead, { color: colors.foreground }]}>{t('social.loadBlockedError')}</Text>
          <Text style={[s.emptySub, { color: colors.mutedForeground }]}>{t('social.connectionRetry')}</Text>
          <TouchableOpacity
            style={[s.retryBtn, {
              backgroundColor: isDark ? 'rgba(200,184,232,0.10)' : colors.primary,
              borderColor: isDark ? 'rgba(200,184,232,0.18)' : colors.primary,
            }]}
            onPress={fetchBlocked}
            activeOpacity={0.75}
          >
            <Text style={[s.retryText, { color: isDark ? 'rgba(200,184,232,0.75)' : colors.primaryForeground }]}>{t('social.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : visibleUsers.length === 0 ? (
        <View style={s.center}>
          <View style={[s.emptyIconWrap, {
            backgroundColor: isDark ? 'rgba(200,184,232,0.06)' : colors.glowPurple,
            borderColor: isDark ? 'rgba(200,184,232,0.12)' : colors.border,
          }]}>
            <Icon name="user-check" size={26} color={isDark ? 'rgba(200,184,232,0.4)' : colors.mutedForeground} />
          </View>
          <Text style={[s.emptyHead, { color: colors.foreground }]}>{t('social.noBlockedUsers')}</Text>
          <Text style={[s.emptySub, { color: colors.mutedForeground }]}>{t('social.blockedEmpty')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.listNote, { color: isDark ? 'rgba(200,184,232,0.70)' : colors.mutedForeground }]}>
            {t('social.blockedNotice')}
          </Text>
          {visibleUsers.map(user => {
            const isPending = pending.has(user.blockedId);
            const displayName = user.name ?? user.username ?? t('social.unknown');
            const resolvedAvatar = resolveUri(user.avatarUri);
            const avatarSource = resolvedAvatar
              ? { uri: resolvedAvatar }
              : require('@/assets/images/character_default.png');

            return (
              <View key={user.blockedId} style={[s.row, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.card,
                borderColor: isDark ? 'rgba(200,184,232,0.10)' : colors.border,
              }]}>
                {/* Avatar */}
                <View style={[s.avatar, {
                  backgroundColor: isDark ? 'rgba(155,120,255,0.15)' : colors.glowPurple,
                  borderColor: isDark ? 'rgba(155,120,255,0.25)' : `${colors.tint}55`,
                }]}>
                  <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>

                {/* Info */}
                <View style={s.info}>
                  <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>{displayName}</Text>
                  {user.username ? (
                    <Text style={[s.handle, { color: colors.mutedForeground }]} numberOfLines={1}>@{user.username}</Text>
                  ) : null}
                </View>

                {/* Unblock button */}
                <TouchableOpacity
                  style={[
                    s.unblockBtn,
                    {
                      backgroundColor: isDark ? 'rgba(200,184,232,0.10)' : colors.destructive,
                      borderColor: isDark ? 'rgba(200,184,232,0.20)' : colors.destructive,
                    },
                    isPending && s.unblockBtnPending,
                  ]}
                  onPress={() => handleUnblock(user)}
                  disabled={isPending}
                  activeOpacity={0.75}
                >
                  {isPending ? (
                    <SkyLoadingMark size={20} color={isDark ? 'rgba(200,184,232,0.7)' : colors.destructiveForeground} />
                  ) : (
                    <Text style={[s.unblockText, { color: isDark ? 'rgba(200,184,232,0.80)' : colors.destructiveForeground }]}>{t('social.unblock')}</Text>
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
