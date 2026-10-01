import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { FriendAvatar } from '@/components/FriendAvatar';
import { ApiError, apiFetch, resolveUri, useApp, type FriendSummary } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { SecureImage as Image } from '@/components/SecureImage';
import { StorigamActivityIndicator as ActivityIndicator } from '@/components/SkyLoading';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Platform, RefreshControl, StyleSheet,
  Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

type Tab = 'all' | 'online' | 'requests' | 'suggestions';
type Invitation = {
  id: string;
  direction: 'incoming' | 'outgoing';
  userId: string;
  name: string;
  username: string | null;
  avatarUri: string | null;
  createdAt: string;
};
type SearchResult = {
  userId: string;
  name: string;
  username: string | null;
  avatarUri: string | null;
  bio: string;
};

const TABS: { id: Tab; key: string; icon: string }[] = [
  { id: 'all', key: 'all', icon: 'users' },
  { id: 'online', key: 'online', icon: 'activity' },
  { id: 'requests', key: 'requests', icon: 'bell' },
  { id: 'suggestions', key: 'find', icon: 'user-plus' },
];

function lastActive(value: string | null | undefined, t: TFunction): string {
  if (!value) return t('social.offlineHidden');
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return t('social.lastActiveMinutes', { count: Math.max(1, minutes) });
  if (minutes < 1440) return t('social.lastActiveHours', { count: Math.floor(minutes / 60) });
  return t('social.lastActiveDays', { count: Math.floor(minutes / 1440) });
}

export default function FriendsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ tab?: string }>();
  const heroGradient: [string, string, string] = isDark
    ? ['#251445', '#120E2D', '#0A0818']
    : ['#EEE8FB', '#F5F1FC', colors.background];
  const accentColor = isDark ? colors.primary : colors.tint;
  const selectedTabColor = isDark ? colors.primary : colors.secondary;
  const actionSurface = isDark ? '#7850C2' : colors.secondary;
  const actionText = isDark ? '#FFFFFF' : colors.secondaryForeground;
  const acceptSurface = isDark ? '#875DE4' : colors.secondary;
  const subtleText = isDark ? '#AFA5C8' : colors.mutedForeground;
  const cardSurface = isDark ? '#17152B' : colors.card;
  const cardBorder = isDark ? 'rgba(180,160,220,0.08)' : colors.border;
  const searchSurface = isDark ? '#17142A' : colors.card;
  const searchBorder = isDark ? 'rgba(180,160,220,0.22)' : colors.border;
  const tabBorder = isDark ? 'rgba(180,160,220,0.13)' : colors.border;
  const circleBorder = isDark ? 'rgba(190,170,225,0.25)' : colors.border;
  const countSurface = isDark ? '#292143' : colors.muted;
  const errorSurface = isDark ? 'rgba(216,90,118,0.15)' : `${colors.destructive}14`;
  const { blockedIds, refreshFriends } = useApp();
  const [tab, setTab] = useState<Tab>(params.tab === 'suggestions' ? 'suggestions' : 'all');
  const [friends, setFriends] = useState<FriendSummary[]>([]);
  const [requests, setRequests] = useState<Invitation[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const searchSeq = useRef(0);
  const active = useRef(true);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [nextFriends, nextRequests] = await Promise.all([
        apiFetch<FriendSummary[]>('/friends'),
        apiFetch<Invitation[]>('/friends/requests'),
      ]);
      if (!active.current) return;
      setFriends(nextFriends);
      setRequests(nextRequests);
      void refreshFriends();
      setError(null);
    } catch {
      if (active.current) setError(t('social.loadFriendsError'));
    } finally {
      if (active.current) { setLoading(false); setRefreshing(false); }
    }
  }, [refreshFriends, t]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void load(true);
    const timer = setInterval(() => { void load(); }, 60_000);
    return () => { active.current = false; clearInterval(timer); };
  }, [load]));

  useEffect(() => {
    const q = query.trim();
    const seq = ++searchSeq.current;
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const people = await apiFetch<SearchResult[]>(`/users/search?q=${encodeURIComponent(q)}`);
        if (searchSeq.current === seq) { setResults(people); setSearchError(null); }
      } catch {
        if (searchSeq.current === seq) { setResults([]); setSearchError(t('social.searchFailed')); }
      } finally {
        if (searchSeq.current === seq) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, t]);

  const visibleFriends = useMemo(() => friends.filter(f => !blockedIds.includes(f.userId) &&
    `${f.name} ${f.username ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [friends, blockedIds, query]);
  const online = visibleFriends.filter(f => f.isOnline);
  const offline = visibleFriends.filter(f => !f.isOnline);
  const incoming = requests.filter(r => r.direction === 'incoming' && !blockedIds.includes(r.userId));
  const outgoing = requests.filter(r => r.direction === 'outgoing' && !blockedIds.includes(r.userId));
  const existing = new Set([...friends.map(f => f.userId), ...requests.map(r => r.userId), ...blockedIds]);
  const suggested = results.filter(p => !existing.has(p.userId));

  async function changeRequest(id: string, method: 'accept' | 'remove') {
    if (busy) return;
    setBusy(id);
    try {
      await apiFetch(`/friends/requests/${encodeURIComponent(id)}${method === 'accept' ? '/accept' : ''}`,
        { method: method === 'accept' ? 'POST' : 'DELETE' });
      await load();
    } catch {
      setError(t(method === 'accept' ? 'social.acceptRequestError' : 'social.removeRequestError'));
    } finally { setBusy(null); }
  }

  async function sendRequest(userId: string) {
    if (busy) return;
    setBusy(userId);
    try {
      await apiFetch(`/friends/requests/${encodeURIComponent(userId)}`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409
        ? t('social.pendingOrFriends')
        : t('social.sendRequestError'));
      await load();
    } finally { setBusy(null); }
  }

  function profile(userId: string) {
    router.push({ pathname: '/user/[userId]', params: { userId } });
  }
  function chat(friend: FriendSummary) {
    router.push({ pathname: '/messages/[userId]', params: {
      userId: friend.userId, name: friend.name, handle: friend.username ?? '',
      avatarUri: friend.avatarUri ?? '',
    } });
  }

  const friendRow = (friend: FriendSummary) => (
    <View key={friend.userId} style={[styles.row, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
      <TouchableOpacity style={styles.person} onPress={() => profile(friend.userId)} accessibilityLabel={t('social.viewProfileFor', { name: friend.name })}>
        <FriendAvatar name={friend.name} uri={friend.avatarUri} online={friend.isOnline} size={48} largeOnlineDot />
        <View style={styles.personText}>
          <Text style={[styles.name, { color: isDark ? '#F4EEFF' : colors.foreground }]} numberOfLines={1}>{friend.name}</Text>
          <Text style={[styles.detail, { color: subtleText }]} numberOfLines={1}>{friend.isOnline ? t('social.onlineNow') : lastActive(friend.lastSeenAt, t)}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.circleButton, { borderColor: circleBorder, backgroundColor: isDark ? 'transparent' : colors.muted }]} onPress={() => chat(friend)} accessibilityLabel={t('social.chatWith', { name: friend.name })} testID={`chat-${friend.userId}`}>
        <Icon name="message-circle" size={20} color={colors.foreground} />
      </TouchableOpacity>
    </View>
  );

  const section = (title: string, list: FriendSummary[], dot: string) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: dot }]} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.count, { color: isDark ? '#C8B8E8' : colors.foreground, backgroundColor: countSurface }]}>{list.length}</Text>
      </View>
      {list.map(friendRow)}
    </View>
  );

  const requestRow = (request: Invitation) => (
    <View key={request.id} style={[styles.row, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
      <TouchableOpacity style={styles.person} onPress={() => profile(request.userId)}>
        <FriendAvatar name={request.name} uri={request.avatarUri} size={48} />
        <View style={styles.personText}>
          <Text style={[styles.name, { color: isDark ? '#F4EEFF' : colors.foreground }]} numberOfLines={1}>{request.name}</Text>
          <Text style={[styles.detail, { color: subtleText }]} numberOfLines={1}>
            {request.direction === 'incoming' ? t('social.wantsFriend') : t('social.requestSent')}
          </Text>
        </View>
      </TouchableOpacity>
      {request.direction === 'incoming' && (
        <TouchableOpacity style={[styles.accept, { backgroundColor: acceptSurface }]} disabled={!!busy} onPress={() => void changeRequest(request.id, 'accept')}
          accessibilityLabel={t('social.acceptFriendRequest', { name: request.name })} testID={`accept-${request.id}`}>
          {busy === request.id ? <ActivityIndicator color={actionText} size="small" /> : <Icon name="check" size={19} color={actionText} />}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.circleButton, { borderColor: circleBorder, backgroundColor: isDark ? 'transparent' : colors.muted }]} disabled={!!busy} onPress={() => void changeRequest(request.id, 'remove')}
        accessibilityLabel={t(request.direction === 'incoming' ? 'social.declineRequest' : 'social.cancelRequest', { name: request.name })}>
        <Icon name="x" size={18} color={subtleText} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={[styles.content, { maxWidth: Math.min(width, 680), paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={accentColor} />}
        ListHeaderComponent={
          <>
            <LinearGradient colors={heroGradient} style={[styles.hero, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 8 }]}>
              <BackButton color={colors.foreground} />
              <View style={styles.titleLine}>
                <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: isDark ? '#F4EEFF' : colors.foreground }]}>{t('social.friends')} <Text style={[styles.titleCount, { color: isDark ? '#BC9BFF' : accentColor }]}>{friends.length}</Text></Text>
                  <Text style={[styles.subtitle, { color: colors.text }]}>{t('social.connectShare')}</Text>
                </View>
                <TouchableOpacity style={[styles.addButton, { backgroundColor: actionSurface, borderColor: isDark ? '#B492F0' : colors.tint }]} onPress={() => { setTab('suggestions'); setQuery(''); }} testID="find-friends">
                  <Icon name="user-plus" size={16} color={actionText} /><Text style={[styles.addLabel, { color: actionText }]}>{t('social.addFriends')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
            <View style={styles.body}>
              <View style={[styles.searchBox, { backgroundColor: searchSurface, borderColor: searchBorder }]}>
                <Icon name="search" size={19} color={subtleText} />
                <TextInput
                  style={[styles.searchInput, { color: colors.foreground }]}
                  placeholder={t(tab === 'suggestions' ? 'social.searchPeople' : 'social.searchFriends')}
                  placeholderTextColor={subtleText}
                  value={query} onChangeText={setQuery} autoCapitalize="none"
                  returnKeyType="search" accessibilityLabel={t('social.searchFriendsLabel')}
                />
                {!!query && <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel={t('social.clearSearch')}><Icon name="x" size={17} color={subtleText} /></TouchableOpacity>}
              </View>
              <View style={styles.tabs}>
                {TABS.map(item => {
                  const selected = tab === item.id;
                  return <TouchableOpacity key={item.id} style={[styles.tab, { backgroundColor: searchSurface, borderColor: tabBorder }, selected && { backgroundColor: selectedTabColor }]}
                    onPress={() => { setTab(item.id); setQuery(''); }} testID={`friends-tab-${item.id}`}>
                    <Icon name={item.icon as never} size={14} color={selected ? (isDark ? '#fff' : colors.secondaryForeground) : subtleText} />
                    <Text style={[styles.tabLabel, { color: selected ? (isDark ? '#fff' : colors.secondaryForeground) : subtleText }]}>{t(`social.${item.key}`)}</Text>
                    {item.id === 'requests' && incoming.length > 0 && <Text style={styles.badge}>{incoming.length}</Text>}
                  </TouchableOpacity>;
                })}
              </View>

              {!!error && <TouchableOpacity style={[styles.error, { backgroundColor: errorSurface }]} onPress={() => void load()}>
                <Text style={[styles.errorText, { color: isDark ? '#F0A5B5' : colors.destructive }]}>{error} {t('social.tapToRetry')}</Text>
              </TouchableOpacity>}
              {loading ? <ActivityIndicator style={styles.loader} color={accentColor} /> : (
                <>
                  {tab === 'all' && (visibleFriends.length
                    ? <>{section(t('social.onlineFriends'), online, '#45D79B')}{section(t('social.offlineFriends'), offline, '#8982B0')}</>
                    : <Empty text={query ? t('social.noFriendsMatch') : t('social.noFriends')} />)}
                  {tab === 'online' && (online.length
                     ? section(t('social.onlineFriends'), online, '#45D79B')
                     : <Empty text={t('social.noOnline')} />)}
                  {tab === 'requests' && (requests.length
                    ? <>{incoming.length > 0 && <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Received · {incoming.length}</Text>{incoming.map(requestRow)}</View>}
                        {outgoing.length > 0 && <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sent · {outgoing.length}</Text>{outgoing.map(requestRow)}</View>}</>
                     : <Empty text={t('social.noRequests')} />)}
                  {tab === 'suggestions' && (query.trim().length < 2
                     ? <Empty text={t('social.searchToRequest')} />
                     : searching ? <ActivityIndicator style={styles.loader} color={accentColor} />
                    : searchError ? <Empty text={searchError} />
                    : suggested.length ? <View style={styles.section}>{suggested.map(person => (
                      <View key={person.userId} style={[styles.row, { backgroundColor: cardSurface, borderColor: cardBorder }]}>
                        <TouchableOpacity style={styles.person} onPress={() => profile(person.userId)}>
                          <FriendAvatar name={person.name} uri={person.avatarUri} size={48} />
                          <View style={styles.personText}>
                            <Text style={[styles.name, { color: isDark ? '#F4EEFF' : colors.foreground }]} numberOfLines={1}>{person.name}</Text>
                            <Text style={[styles.detail, { color: subtleText }]} numberOfLines={1}>{person.username ? `@${person.username}` : person.bio || t('social.viewProfile')}</Text>
                          </View>
                        </TouchableOpacity>
                         <TouchableOpacity style={[styles.accept, { backgroundColor: acceptSurface }]} disabled={!!busy} onPress={() => void sendRequest(person.userId)}
                          accessibilityLabel={t('social.sendFriendRequest', { name: person.name })} testID={`add-${person.userId}`}>
                           {busy === person.userId ? <ActivityIndicator color={actionText} size="small" /> : <Icon name="user-plus" size={17} color={actionText} />}
                        </TouchableOpacity>
                      </View>
                    ))}</View> : <Empty text={t('social.noNewPeople')} />)}
                </>
              )}
              <TouchableOpacity style={styles.inboxLink} onPress={() => router.push('/messages')}>
                <Icon name="message-circle" size={18} color={accentColor} />
                <Text style={[styles.inboxText, { color: accentColor }]}>{t('social.viewConversations')}</Text>
                <Icon name="chevron-right" size={16} color={accentColor} />
              </TouchableOpacity>
            </View>
          </>
        }
      />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const colors = useColors();
  const { isDark } = useTheme();
  return (
    <View style={styles.empty}>
      <Icon name="users" size={31} color={isDark ? '#9888BC' : colors.tint} />
      <Text style={[styles.emptyText, { color: isDark ? '#B5A9D1' : colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', flexGrow: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 20, gap: 18 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#F4EEFF', fontSize: 30, fontFamily: 'Satoshi-Black' },
  titleCount: { color: '#BC9BFF', fontSize: 17 },
  subtitle: { color: '#C8B8E8', fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 3 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 38, borderRadius: 20, backgroundColor: '#7850C2', borderWidth: 1, borderColor: '#B492F0' },
  addLabel: { color: '#fff', fontSize: 11, fontFamily: 'Satoshi-Bold' },
  body: { flex: 1, paddingHorizontal: 16 },
  searchBox: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(180,160,220,0.22)', backgroundColor: '#17142A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 },
  searchInput: { flex: 1, color: '#EDE8FF', fontFamily: 'Satoshi-Regular', fontSize: 13, height: '100%' },
  tabs: { flexDirection: 'row', gap: 5, marginTop: 12 },
  tab: { flex: 1, minWidth: 0, height: 39, borderRadius: 13, backgroundColor: '#17142A', borderWidth: 1, borderColor: 'rgba(180,160,220,0.13)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  badge: { color: '#fff', backgroundColor: '#DB5D79', borderRadius: 10, overflow: 'hidden', fontSize: 10, paddingHorizontal: 4 },
  section: { marginTop: 22, gap: 7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  sectionDot: { width: 9, height: 9, borderRadius: 5 },
  sectionTitle: { color: '#EDE8FF', fontSize: 17, fontFamily: 'Satoshi-Bold' },
  count: { color: '#C8B8E8', fontSize: 12, fontFamily: 'Satoshi-Bold', backgroundColor: '#292143', borderRadius: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2 },
  row: { minHeight: 69, backgroundColor: '#17152B', borderRadius: 17, borderWidth: 1, borderColor: 'rgba(180,160,220,0.08)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  person: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  personText: { flex: 1, minWidth: 0, gap: 3 },
  name: { color: '#F4EEFF', fontSize: 14, fontFamily: 'Satoshi-Bold' },
  detail: { color: '#AFA5C8', fontSize: 11, fontFamily: 'Satoshi-Regular' },
  circleButton: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(190,170,225,0.25)' },
  accept: { width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#875DE4' },
  error: { marginTop: 12, backgroundColor: 'rgba(216,90,118,0.15)', borderRadius: 12, padding: 12 },
  errorText: { color: '#F0A5B5', fontSize: 12, fontFamily: 'Satoshi-Regular' },
  loader: { marginTop: 70 },
  empty: { alignItems: 'center', gap: 13, paddingHorizontal: 30, paddingVertical: 75 },
  emptyText: { textAlign: 'center', color: '#B5A9D1', fontSize: 14, lineHeight: 21, fontFamily: 'Satoshi-Regular' },
  inboxLink: { marginTop: 25, marginBottom: 20, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  inboxText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
});