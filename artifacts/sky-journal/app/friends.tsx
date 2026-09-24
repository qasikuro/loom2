import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { ApiError, apiFetch, resolveUri, useApp, type FriendSummary } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet,
  Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'users' },
  { id: 'online', label: 'Online', icon: 'activity' },
  { id: 'requests', label: 'Requests', icon: 'bell' },
  { id: 'suggestions', label: 'Find', icon: 'user-plus' },
];

function Avatar({ uri, name, online, size = 48 }: { uri?: string | null; name: string; online?: boolean; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? <Image source={{ uri: resolveUri(uri) ?? uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> :
        <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{name.charAt(0).toUpperCase()}</Text>}
      {online && <View style={styles.onlineDot} />}
    </View>
  );
}

function lastActive(value: string | null | undefined): string {
  if (!value) return 'Offline or status hidden';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `Last active ${Math.max(1, minutes)}m ago`;
  if (minutes < 1440) return `Last active ${Math.floor(minutes / 60)}h ago`;
  return `Last active ${Math.floor(minutes / 1440)}d ago`;
}

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ tab?: string }>();
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
      if (active.current) setError('Could not load friends. Pull down to retry.');
    } finally {
      if (active.current) { setLoading(false); setRefreshing(false); }
    }
  }, [refreshFriends]);

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
        if (searchSeq.current === seq) { setResults([]); setSearchError('Search failed. Try again.'); }
      } finally {
        if (searchSeq.current === seq) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

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
      setError(`Could not ${method === 'accept' ? 'accept' : 'remove'} the request. Please try again.`);
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
        ? 'This person is already a friend or has a pending request.'
        : 'Could not send your request. Please try again.');
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
    <View key={friend.userId} style={styles.row}>
      <TouchableOpacity style={styles.person} onPress={() => profile(friend.userId)} accessibilityLabel={`View ${friend.name}'s profile`}>
        <Avatar name={friend.name} uri={friend.avatarUri} online={friend.isOnline} />
        <View style={styles.personText}>
          <Text style={styles.name} numberOfLines={1}>{friend.name}</Text>
          <Text style={styles.detail} numberOfLines={1}>{friend.isOnline ? 'Online now' : lastActive(friend.lastSeenAt)}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.circleButton} onPress={() => chat(friend)} accessibilityLabel={`Chat with ${friend.name}`} testID={`chat-${friend.userId}`}>
        <Icon name="message-circle" size={20} color="#EDE8FF" />
      </TouchableOpacity>
    </View>
  );

  const section = (title: string, list: FriendSummary[], dot: string) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: dot }]} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.count}>{list.length}</Text>
      </View>
      {list.map(friendRow)}
    </View>
  );

  const requestRow = (request: Invitation) => (
    <View key={request.id} style={styles.row}>
      <TouchableOpacity style={styles.person} onPress={() => profile(request.userId)}>
        <Avatar name={request.name} uri={request.avatarUri} />
        <View style={styles.personText}>
          <Text style={styles.name} numberOfLines={1}>{request.name}</Text>
          <Text style={styles.detail} numberOfLines={1}>
            {request.direction === 'incoming' ? 'Wants to be your friend' : 'Request sent'}
          </Text>
        </View>
      </TouchableOpacity>
      {request.direction === 'incoming' && (
        <TouchableOpacity style={styles.accept} disabled={!!busy} onPress={() => void changeRequest(request.id, 'accept')}
          accessibilityLabel={`Accept ${request.name}'s friend request`} testID={`accept-${request.id}`}>
          {busy === request.id ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="check" size={19} color="#fff" />}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.circleButton} disabled={!!busy} onPress={() => void changeRequest(request.id, 'remove')}
        accessibilityLabel={`${request.direction === 'incoming' ? 'Decline' : 'Cancel'} ${request.name}'s request`}>
        <Icon name="x" size={18} color="#AFA5C8" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: '#0A0818' }]}>
      <FlatList
        data={[]}
        renderItem={null}
        contentContainerStyle={[styles.content, { maxWidth: Math.min(width, 680), paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['#251445', '#120E2D', '#0A0818']} style={[styles.hero, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 8 }]}>
              <BackButton color="#EDE8FF" />
              <View style={styles.titleLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Friends <Text style={styles.titleCount}>{friends.length}</Text></Text>
                  <Text style={styles.subtitle}>Connect, talk and share your world</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => { setTab('suggestions'); setQuery(''); }} testID="find-friends">
                  <Icon name="user-plus" size={16} color="#fff" /><Text style={styles.addLabel}>Add Friends</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
            <View style={styles.body}>
              <View style={styles.searchBox}>
                <Icon name="search" size={19} color="#AFA5C8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder={tab === 'suggestions' ? 'Search people by name or @username' : 'Search friends by name or @username'}
                  placeholderTextColor="#AFA5C8"
                  value={query} onChangeText={setQuery} autoCapitalize="none"
                  returnKeyType="search" accessibilityLabel="Search friends"
                />
                {!!query && <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search"><Icon name="x" size={17} color="#AFA5C8" /></TouchableOpacity>}
              </View>
              <View style={styles.tabs}>
                {TABS.map(item => {
                  const selected = tab === item.id;
                  return <TouchableOpacity key={item.id} style={[styles.tab, selected && { backgroundColor: colors.primary }]}
                    onPress={() => { setTab(item.id); setQuery(''); }} testID={`friends-tab-${item.id}`}>
                    <Icon name={item.icon as never} size={14} color={selected ? '#fff' : '#AFA5C8'} />
                    <Text style={[styles.tabLabel, { color: selected ? '#fff' : '#AFA5C8' }]}>{item.label}</Text>
                    {item.id === 'requests' && incoming.length > 0 && <Text style={styles.badge}>{incoming.length}</Text>}
                  </TouchableOpacity>;
                })}
              </View>

              {!!error && <TouchableOpacity style={styles.error} onPress={() => void load()}>
                <Text style={styles.errorText}>{error} Tap to retry.</Text>
              </TouchableOpacity>}
              {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
                <>
                  {tab === 'all' && (visibleFriends.length
                    ? <>{section('Online friends', online, '#45D79B')}{section('Offline friends', offline, '#8982B0')}</>
                    : <Empty text={query ? 'No friends match your search.' : 'No friends yet. Find people to connect with.'} />)}
                  {tab === 'online' && (online.length
                    ? section('Online friends', online, '#45D79B')
                    : <Empty text="No friends online right now." />)}
                  {tab === 'requests' && (requests.length
                    ? <>{incoming.length > 0 && <View style={styles.section}><Text style={styles.sectionTitle}>Received · {incoming.length}</Text>{incoming.map(requestRow)}</View>}
                        {outgoing.length > 0 && <View style={styles.section}><Text style={styles.sectionTitle}>Sent · {outgoing.length}</Text>{outgoing.map(requestRow)}</View>}</>
                    : <Empty text="No pending friend requests." />)}
                  {tab === 'suggestions' && (query.trim().length < 2
                    ? <Empty text="Search for someone by name or username to send a friend request." />
                    : searching ? <ActivityIndicator style={styles.loader} color={colors.primary} />
                    : searchError ? <Empty text={searchError} />
                    : suggested.length ? <View style={styles.section}>{suggested.map(person => (
                      <View key={person.userId} style={styles.row}>
                        <TouchableOpacity style={styles.person} onPress={() => profile(person.userId)}>
                          <Avatar name={person.name} uri={person.avatarUri} />
                          <View style={styles.personText}>
                            <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
                            <Text style={styles.detail} numberOfLines={1}>{person.username ? `@${person.username}` : person.bio || 'View profile'}</Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.accept} disabled={!!busy} onPress={() => void sendRequest(person.userId)}
                          accessibilityLabel={`Send ${person.name} a friend request`} testID={`add-${person.userId}`}>
                          {busy === person.userId ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="user-plus" size={17} color="#fff" />}
                        </TouchableOpacity>
                      </View>
                    ))}</View> : <Empty text="No new people found. Try a different name." />)}
                </>
              )}
              <TouchableOpacity style={styles.inboxLink} onPress={() => router.push('/messages')}>
                <Icon name="message-circle" size={18} color={colors.primary} />
                <Text style={[styles.inboxText, { color: colors.primary }]}>View all conversations</Text>
                <Icon name="chevron-right" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </>
        }
      />
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Icon name="users" size={31} color="#9888BC" /><Text style={styles.emptyText}>{text}</Text></View>;
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
  avatar: { borderWidth: 2, borderColor: '#8468C4', backgroundColor: '#392653', overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#EDE8FF', fontFamily: 'Satoshi-Bold' },
  onlineDot: { position: 'absolute', right: -2, bottom: -2, backgroundColor: '#45D79B', borderColor: '#17152B', borderWidth: 2, width: 14, height: 14, borderRadius: 7 },
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