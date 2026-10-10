import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, BackHandler, FlatList, Keyboard, Modal, PanResponder, Platform,
  Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Icon } from '@/components/Icon';
import { FriendAvatar } from '@/components/FriendAvatar';
import { StorigamActivityIndicator as Spinner } from '@/components/SkyLoading';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useChatAccent } from '@/hooks/useChatAccent';
import { matchesQuery, mergeContacts, type Contact } from '@/utils/friendsDrawerContacts';
import { useFriendsDrawerData, type Invitation, type SearchResult } from '@/hooks/useFriendsDrawerData';
import '@/i18n/drawerTranslations';

export type DrawerTab = 'all' | 'online' | 'requests' | 'find';
const TABS: { id: DrawerTab; key: string }[] = [
  { id: 'all', key: 'all' }, { id: 'online', key: 'online' }, { id: 'requests', key: 'requests' }, { id: 'find', key: 'find' },
];

type Row =
  | { kind: 'contact'; key: string; c: Contact }
  | { kind: 'request'; key: string; r: Invitation }
  | { kind: 'person'; key: string; p: SearchResult }
  | { kind: 'header'; key: string; text: string };

function lastActive(value: string, t: TFunction): string {
  const m = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (m < 60) return t('social.lastActiveMinutes', { count: Math.max(1, m) });
  if (m < 1440) return t('social.lastActiveHours', { count: Math.floor(m / 60) });
  return t('social.lastActiveDays', { count: Math.floor(m / 1440) });
}

interface Props { visible: boolean; scopeKey: string | null; initialTab: DrawerTab; onClose: () => void }

export function FriendsMessagesDrawer({ visible, scopeKey, initialTab, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { blockedIds, dmThreads, dmThreadsLoading, dmThreadsError, refreshDmThreads, apiOnline } = useApp();
  const drawerW = Math.min(Math.round(width * 0.9), 440);
  const { accent, onAccent } = useChatAccent();
  const sub = colors.mutedForeground;

  const [mounted, setMounted] = useState(visible);
  const [tab, setTab] = useState<DrawerTab>('all');
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [reduce, setReduce] = useState(false);
  const x = useRef(new Animated.Value(drawerW)).current;
  const pending = useRef<(() => void) | null>(null);
  const closing = useRef(false);

  const data = useFriendsDrawerData(visible, scopeKey, query, tab === 'find');

  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (on) setReduce(v); }).catch(() => null);
    const sub2 = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => { on = false; sub2.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      closing.current = false;
      setMounted(true); setTab(initialTab); setQuery(''); setPicking(false);
      Keyboard.dismiss();
      x.setValue(reduce ? 0 : drawerW);
      if (!reduce) Animated.timing(x, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    } else if (mounted && !closing.current) {
      setMounted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runPending = useCallback(() => {
    if (fallbackTimer.current) { clearTimeout(fallbackTimer.current); fallbackTimer.current = null; }
    const fn = pending.current; pending.current = null;
    if (fn) setTimeout(fn, 0);
  }, []);
  useEffect(() => () => { if (fallbackTimer.current) clearTimeout(fallbackTimer.current); }, []);

  const dismiss = useCallback((after?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    pending.current = after ?? null;
    x.stopAnimation();
    const finish = () => {
      onClose(); setMounted(false);
      if (Platform.OS === 'ios' && pending.current) {
        // Modal.onDismiss normally runs the navigation; fall back if it never fires.
        fallbackTimer.current = setTimeout(runPending, 700);
      } else runPending();
    };
    if (after || reduce) { x.setValue(drawerW); finish(); }
    else Animated.timing(x, { toValue: drawerW, duration: 200, useNativeDriver: true }).start(finish);
  }, [onClose, reduce, drawerW, runPending, x]);

  useEffect(() => {
    if (!visible) return;
    const s = BackHandler.addEventListener('hardwareBackPress', () => { dismiss(); return true; });
    return () => s.remove();
  }, [visible, dismiss]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderMove: (_, g) => { if (g.dx > 0) x.setValue(g.dx); },
    onPanResponderRelease: (_, g) => {
      if (g.dx > drawerW * 0.3 || g.vx > 0.8) { closing.current = false; dismiss(); }
      else Animated.timing(x, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.timing(x, { toValue: 0, duration: 160, useNativeDriver: true }).start(),
  }), [drawerW, dismiss, x]);

  const dmRestricted = dmThreadsError === '401' || dmThreadsError === '403';
  const restricted = data.restricted || dmRestricted;
  const blocked = useMemo(() => new Set(blockedIds), [blockedIds]);

  const contacts = useMemo<Contact[]>(
    () => mergeContacts(data.friends, dmThreads, blocked, restricted),
    [data.friends, dmThreads, blocked, restricted],
  );

  const q = query.trim().toLowerCase();
  const matches = useCallback((name: string, handle: string | null) => matchesQuery(q, name, handle), [q]);

  const incoming = data.requests.filter(r => r.direction === 'incoming' && !blocked.has(r.userId));
  const outgoing = data.requests.filter(r => r.direction === 'outgoing' && !blocked.has(r.userId));

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (restricted) return out;
    const c = (list: Contact[]) => list.forEach(x2 => out.push({ kind: 'contact', key: `c-${x2.userId}`, c: x2 }));
    if (picking) { c(contacts.filter(x2 => x2.isFriend && matches(x2.name, x2.handle))); return out; }
    if (tab === 'all') c(contacts.filter(x2 => matches(x2.name, x2.handle)));
    else if (tab === 'online') c(contacts.filter(x2 => x2.isFriend && x2.online && matches(x2.name, x2.handle)));
    else if (tab === 'requests') {
      const inc = incoming.filter(r => matches(r.name, r.username));
      const outg = outgoing.filter(r => matches(r.name, r.username));
      if (inc.length) { out.push({ kind: 'header', key: 'h-in', text: `${t('social.received')} · ${inc.length}` }); inc.forEach(r => out.push({ kind: 'request', key: `r-${r.id}`, r })); }
      if (outg.length) { out.push({ kind: 'header', key: 'h-out', text: `${t('social.sent')} · ${outg.length}` }); outg.forEach(r => out.push({ kind: 'request', key: `r-${r.id}`, r })); }
    } else {
      const existing = new Set([...data.friends.map(f => f.userId), ...data.requests.map(r => r.userId), ...blockedIds]);
      data.results.filter(p => !existing.has(p.userId)).forEach(p => out.push({ kind: 'person', key: `p-${p.userId}`, p }));
    }
    return out;
  }, [restricted, data.friends, data.requests, data.results, picking, tab, contacts, matches, incoming, outgoing, blockedIds, t]);

  function openChat(c: { userId: string; name: string; handle: string | null; avatar: string | null }) {
    dismiss(() => router.push({
      pathname: '/messages/[userId]',
      params: { userId: c.userId, name: c.name, handle: c.handle ?? '', avatarUri: c.avatar ?? '' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewAll = () => dismiss(() => router.push('/messages' as any));

  const border = colors.border;
  const initialLoading = data.loading && !data.friends.length && !data.requests.length;

  function renderEmpty() {
    if (restricted) return <Empty icon="alert-circle" text={t('social.unavailableBody')} title={t('social.unavailable')} />;
    if (initialLoading || (data.searching && tab === 'find')) return <View style={{ paddingTop: 48 }}><Spinner color={accent} /></View>;
    if (data.error && !contacts.length) return <Empty icon="alert-circle" text={t('social.loadFriendsError')} action={t('social.retry')} onAction={() => void data.load()} />;
    if (picking) return <Empty icon="users" text={q ? t('social.noContactsMatch') : t('social.pickerEmpty')} />;
    if (tab === 'find') {
      if (q.length < 2) return <Empty icon="search" text={t('social.searchToRequest')} />;
      if (data.searchError) return <Empty icon="alert-circle" text={t('social.searchFailed')} />;
      return <Empty icon="users" text={t('social.noNewPeople')} />;
    }
    if (tab === 'online') return <Empty icon="activity" text={t('social.noOnline')} />;
    if (tab === 'requests') return <Empty icon="bell" text={t('social.noRequests')} />;
    return <Empty icon="message-circle" text={q ? t('social.noContactsMatch') : t('social.noContacts')} />;
  }

  function Empty(p: { icon: string; text: string; title?: string; action?: string; onAction?: () => void }) {
    return (
      <View style={st.empty}>
        <Icon name={p.icon as never} size={30} color={accent} />
        {!!p.title && <Text style={[st.emptyTitle, { color: colors.foreground }]}>{p.title}</Text>}
        <Text style={[st.emptyText, { color: sub }]}>{p.text}</Text>
        {!!p.action && (
          <TouchableOpacity style={[st.retry, { borderColor: accent }]} onPress={p.onAction} accessibilityRole="button">
            <Text style={{ color: accent, fontFamily: 'Satoshi-Bold', fontSize: 13 }}>{p.action}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function CircleBtn(p: { icon: string; label: string; onPress: () => void; filled?: boolean; disabled?: boolean; busy?: boolean; testID?: string }) {
    return (
      <TouchableOpacity
        onPress={p.onPress} disabled={p.disabled} accessibilityRole="button" accessibilityLabel={p.label} testID={p.testID}
        style={[st.circle, p.filled ? { backgroundColor: accent } : { borderColor: border, borderWidth: 1 }, p.disabled && { opacity: 0.5 }]}
      >
        {p.busy ? <Spinner size="small" color={p.filled ? onAccent : accent} />
          : <Icon name={p.icon as never} size={19} color={p.filled ? onAccent : colors.foreground} />}
      </TouchableOpacity>
    );
  }

  function renderItem({ item }: { item: Row }) {
    if (item.kind === 'header') return <Text style={[st.section, { color: sub }]}>{item.text}</Text>;
    if (item.kind === 'contact') {
      const c = item.c;
      const status = c.isFriend ? (c.online ? t('social.onlineNow') : c.lastSeenAt ? lastActive(c.lastSeenAt, t) : null) : null;
      return (
        <TouchableOpacity
          style={[st.row, { borderBottomColor: border }]} onPress={() => openChat(c)} testID={`drawer-chat-${c.userId}`}
          accessibilityRole="button"
          accessibilityLabel={`${t('social.chatWith', { name: c.name })}${c.unread ? `, ${t('social.unreadConversation')}` : ''}`}
        >
          <FriendAvatar name={c.name} uri={c.avatar} online={c.online} size={44} borderColor={c.unread ? accent : undefined} />
          <View style={st.rowText}>
            <Text style={[st.name, { color: colors.foreground }, c.unread && { fontFamily: 'Satoshi-Black' }]} numberOfLines={1}>{c.name}</Text>
            {!!c.preview
              ? <Text style={[st.detail, { color: c.unread ? colors.foreground : sub }]} numberOfLines={1}>{c.preview}</Text>
              : <Text style={[st.detail, { color: sub }]} numberOfLines={1}>{c.handle ? `@${c.handle}` : ''}{c.handle && status ? ' · ' : ''}{status ?? ''}</Text>}
            {!!c.preview && (c.handle || status) && (
              <Text style={[st.meta, { color: sub }]} numberOfLines={1}>{c.handle ? `@${c.handle}` : ''}{c.handle && status ? ' · ' : ''}{status ?? ''}</Text>
            )}
          </View>
          {c.unread && <View style={[st.dot, { backgroundColor: accent }]} />}
          <View style={st.circle}><Icon name="message-circle" size={19} color={c.unread ? accent : colors.foreground} /></View>
        </TouchableOpacity>
      );
    }
    if (item.kind === 'request') {
      const r = item.r;
      return (
        <View style={[st.row, { borderBottomColor: border }]}>
          <FriendAvatar name={r.name} uri={r.avatarUri} size={44} />
          <View style={st.rowText}>
            <Text style={[st.name, { color: colors.foreground }]} numberOfLines={1}>{r.name}</Text>
            <Text style={[st.detail, { color: sub }]} numberOfLines={1}>{r.direction === 'incoming' ? t('social.wantsFriend') : t('social.requestSent')}</Text>
          </View>
          {r.direction === 'incoming' && (
            <CircleBtn icon="check" filled busy={data.busy === r.id} disabled={!!data.busy} onPress={() => void data.accept(r.id)}
              label={t('social.acceptFriendRequest', { name: r.name })} testID={`drawer-accept-${r.id}`} />
          )}
          <CircleBtn icon="x" disabled={!!data.busy} onPress={() => void data.remove(r.id)}
            label={t(r.direction === 'incoming' ? 'social.declineRequest' : 'social.cancelRequest', { name: r.name })} />
        </View>
      );
    }
    const p = item.p;
    return (
      <View style={[st.row, { borderBottomColor: border }]}>
        <FriendAvatar name={p.name} uri={p.avatarUri} size={44} />
        <View style={st.rowText}>
          <Text style={[st.name, { color: colors.foreground }]} numberOfLines={1}>{p.name}</Text>
          <Text style={[st.detail, { color: sub }]} numberOfLines={1}>{p.username ? `@${p.username}` : p.bio || t('social.viewProfile')}</Text>
        </View>
        <CircleBtn icon="user-plus" filled busy={data.busy === p.userId} disabled={!!data.busy} onPress={() => void data.send(p.userId)}
          label={t('social.sendFriendRequest', { name: p.name })} testID={`drawer-add-${p.userId}`} />
      </View>
    );
  }

  const errText = data.actionError === 'accept' ? t('social.acceptRequestError')
    : data.actionError === 'remove' ? t('social.removeRequestError')
    : data.actionError === 'pending' ? t('social.pendingOrFriends')
    : data.actionError === 'send' ? t('social.sendRequestError') : null;
  const banner = errText ?? (!data.restricted && !initialLoading && data.error && contacts.length ? t('social.loadFriendsError') : null)
    ?? (!apiOnline ? t('social.offlineNotice') : null)
    ?? (!restricted && dmThreadsError ? t('social.conversationsLoadError') : null);

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={() => dismiss()}
      onDismiss={runPending}>
      <View style={st.fill}>
        <Animated.View style={[st.fill, { backgroundColor: colors.overlay, opacity: x.interpolate({ inputRange: [0, drawerW], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
          <Pressable style={st.fill} onPress={() => dismiss()} accessibilityLabel={t('social.closeDrawer')} accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          {...pan.panHandlers}
          accessibilityViewIsModal
          style={[st.drawer, { width: drawerW, backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 24 : insets.top + 8, transform: [{ translateX: x }], borderColor: border }]}
        >
          <View style={st.head}>
            <Text style={[st.title, { color: colors.foreground }]} accessibilityRole="header" numberOfLines={1}>
              {picking ? t('social.newMessage') : t('social.messages')}
            </Text>
            <CircleBtn icon="x" label={t('social.closeDrawer')} onPress={() => dismiss()} testID="drawer-close" />
          </View>
          <View style={st.actions}>
            <TouchableOpacity style={[st.addBtn, { backgroundColor: accent, flex: 1 }]} onPress={() => { setPicking(false); setTab('find'); setQuery(''); }} accessibilityRole="button" testID="drawer-add-friends">
              <Icon name="user-plus" size={15} color={onAccent} />
              <Text style={{ color: onAccent, fontFamily: 'Satoshi-Bold', fontSize: 13 }} numberOfLines={1}>{t('social.addFriends')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.addBtn, { borderColor: border, borderWidth: 1, flex: 1 }]} accessibilityRole="button" accessibilityLabel={picking ? t('social.cancelNewMessage') : t('social.newMessage')}
              onPress={() => { setPicking(p => !p); setTab('all'); setQuery(''); }} testID="drawer-new-message">
              <Icon name={picking ? 'x' : 'plus'} size={15} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontFamily: 'Satoshi-Bold', fontSize: 13 }} numberOfLines={1}>{picking ? t('social.cancel') : t('social.newMessage')}</Text>
            </TouchableOpacity>
          </View>

          <View style={[st.search, { backgroundColor: colors.card, borderColor: border }]}>
            <Icon name="search" size={18} color={sub} />
            <TextInput
              style={[st.input, { color: colors.foreground }]} value={query} onChangeText={setQuery}
              placeholder={t('social.searchMessagesPlaceholder')} placeholderTextColor={sub}
              autoCapitalize="none" autoCorrect={false} returnKeyType="search" accessibilityLabel={t('social.searchFriendsLabel')}
            />
            {!!query && (
              <TouchableOpacity style={st.clear} onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t('social.clearSearch')}>
                <Icon name="x" size={17} color={sub} />
              </TouchableOpacity>
            )}
          </View>

          {picking ? (
            <Text style={[st.section, { color: sub, paddingHorizontal: 16 }]}>{t('social.chooseRecipient')}</Text>
          ) : (
            <View style={st.tabs} accessibilityRole="tablist">
              {TABS.map(it => {
                const sel = tab === it.id;
                return (
                  <TouchableOpacity key={it.id} testID={`drawer-tab-${it.id}`} accessibilityRole="tab" accessibilityState={{ selected: sel }}
                    onPress={() => { setTab(it.id); setQuery(''); }}
                    style={[st.tab, { borderColor: border, backgroundColor: sel ? accent : colors.card }]}>
                    <Text style={[st.tabLabel, { color: sel ? onAccent : sub }]} numberOfLines={1}>{t(`social.${it.key}`)}</Text>
                    {it.id === 'requests' && incoming.length > 0 && <Text style={[st.badge, { backgroundColor: colors.destructive }]}>{incoming.length}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {!!banner && (
            <TouchableOpacity style={[st.banner, { backgroundColor: `${colors.destructive}22` }]}
              onPress={() => { void data.load(); void refreshDmThreads(); }} accessibilityRole="button">
              <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: 'Satoshi-Medium' }}>{banner} {t('social.tapToRetry')}</Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={rows}
            keyExtractor={r => r.key}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={renderEmpty()}
            ListFooterComponent={tab === 'all' && !picking && dmThreadsLoading && rows.length ? <Spinner color={accent} /> : null}
            contentContainerStyle={{ flexGrow: 1 }}
          />

          <TouchableOpacity style={[st.footer, { borderTopColor: border, paddingBottom: Math.max(insets.bottom, 12) }]} onPress={viewAll} accessibilityRole="button" testID="drawer-view-all">
            <Icon name="message-circle" size={18} color={accent} />
            <Text style={{ color: accent, fontFamily: 'Satoshi-Bold', fontSize: 14, flex: 1 }}>{t('social.viewConversations')}</Text>
            <Icon name="chevron-right" size={16} color={accent} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  drawer: { position: 'absolute', top: 0, bottom: 0, right: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 24, borderBottomLeftRadius: 24, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 8, paddingBottom: 4 },
  title: { flex: 1, fontSize: 22, fontFamily: 'Satoshi-Black', minWidth: 0 },
  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, justifyContent: 'center', minWidth: 0 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, height: 46, borderRadius: 14, borderWidth: 1, paddingLeft: 12 },
  input: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'Satoshi-Regular' },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: 10 },
  tab: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabLabel: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  badge: { color: '#fff', fontSize: 10, fontFamily: 'Satoshi-Bold', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 5, minWidth: 16, textAlign: 'center' },
  banner: { marginHorizontal: 12, marginTop: 8, borderRadius: 10, padding: 10, minHeight: 44, justifyContent: 'center' },
  section: { fontSize: 12, fontFamily: 'Satoshi-Bold', marginTop: 12, marginBottom: 4, paddingHorizontal: 16, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  name: { fontSize: 14.5, fontFamily: 'Satoshi-Bold' },
  detail: { fontSize: 12.5, fontFamily: 'Satoshi-Regular' },
  meta: { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 56 },
  emptyTitle: { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  emptyText: { textAlign: 'center', fontSize: 13.5, lineHeight: 20, fontFamily: 'Satoshi-Regular' },
  retry: { minHeight: 44, paddingHorizontal: 20, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
