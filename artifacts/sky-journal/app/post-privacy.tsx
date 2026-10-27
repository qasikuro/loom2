import { Icon } from '@/components/Icon';
import { StorigamActivityIndicator } from '@/components/SkyLoading';
import { ApiError, apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { safeBack } from '@/utils/navigation';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Kind = 'story' | 'outfit' | 'book' | 'tutorial';
type Choice = 'public' | 'friends' | 'private';
interface PostVisibility { id: string | number; title: string; kind: Kind; label: string; visibility: string }

const CHOICES: { value: Choice; title: string; body: string; icon: string }[] = [
  { value: 'public', title: 'Public', body: 'Everyone who can view your profile', icon: 'globe' },
  { value: 'friends', title: 'Private — friends only', body: 'Only reciprocal connections', icon: 'users' },
  { value: 'private', title: 'Only me', body: 'Hidden from other people', icon: 'eye-off' },
];

function describe(v: string): { title: string; known: boolean } {
  switch (v) {
    case 'public': return { title: 'Public', known: true };
    case 'friends': return { title: 'Private — friends only', known: true };
    case 'private': return { title: 'Only me', known: true };
    case 'followers': return { title: 'Followers (legacy)', known: false };
    case 'unlisted': return { title: 'Unlisted (legacy)', known: false };
    default: return { title: v ? `${v} (legacy)` : 'Unknown', known: false };
  }
}

type LoadState = 'loading' | 'ready' | 'error' | 'unavailable';
const keyOf = (p: { kind: string; id: string | number }) => `${p.kind}:${p.id}`;

export default function PostPrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const { userId } = useAuth();
  const { reloadData } = useApp();

  const [items, setItems] = useState<PostVisibility[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [picker, setPicker] = useState<PostVisibility | null>(null);
  const reqId = useRef(0);
  const accountRef = useRef(userId);
  accountRef.current = userId;

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const account = userId;
    setState(s => (s === 'ready' ? s : 'loading'));
    try {
      const data = await apiFetch<PostVisibility[]>('/my-posts/visibility');
      if (id !== reqId.current || accountRef.current !== account) return;
      setItems(Array.isArray(data) ? data : []);
      setState('ready');
    } catch (e) {
      if (id !== reqId.current) return;
      const status = e instanceof ApiError ? e.status : 0;
      setState(status === 404 || status === 503 ? 'unavailable' : 'error');
    }
  }, [userId]);

  // Account switch: drop previous account's content immediately.
  useEffect(() => {
    reqId.current++;
    setItems([]); setPending({}); setFeedback(null); setPicker(null); setQuery('');
    setState('loading');
  }, [userId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const choose = async (item: PostVisibility, next: Choice) => {
    setPicker(null);
    if (item.visibility === next) return;
    const k = keyOf(item);
    const account = userId;
    setPending(p => ({ ...p, [k]: true }));
    setFeedback(null);
    try {
      const res = await apiFetch<{ id: string | number; kind: Kind; visibility: string }>(
        `/my-posts/${encodeURIComponent(item.kind)}/${encodeURIComponent(String(item.id))}/visibility`,
        { method: 'PATCH', body: JSON.stringify({ visibility: next }) },
      );
      if (accountRef.current !== account) return;
      setItems(list => list.map(i => (keyOf(i) === k ? { ...i, visibility: res?.visibility ?? next } : i)));
      setFeedback({ type: 'ok', text: `“${item.title || 'Untitled'}” is now ${describe(res?.visibility ?? next).title}.` });
      void reloadData().catch(() => { /* The saved audience remains authoritative; retry normal refresh later. */ });
    } catch (e) {
      if (accountRef.current !== account) return;
      const status = e instanceof ApiError ? e.status : 0;
      setFeedback({
        type: 'err',
        text: status === 404 || status === 503
          ? 'Privacy settings are unavailable right now. Nothing was changed.'
          : `Couldn’t update “${item.title || 'Untitled'}”. It keeps its previous setting.`,
      });
    } finally {
      if (accountRef.current === account) setPending(p => { const n = { ...p }; delete n[k]; return n; });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => `${i.title} ${i.label} ${i.kind}`.toLowerCase().includes(q));
  }, [items, query]);

  const renderItem = ({ item }: { item: PostVisibility }) => {
    const k = keyOf(item);
    const busy = !!pending[k];
    const d = describe(item.visibility);
    const isOwner = item.visibility === 'private';
    return (
      <View testID={`post-privacy-row-${item.kind}-${item.id}`} style={[st.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[st.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title || 'Untitled'}</Text>
          <Text style={[st.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>{item.label || item.kind}</Text>
          {!d.known && (
            <Text style={[st.rowMeta, { color: colors.mutedForeground, marginTop: 3 }]}>
              Older setting — choose a new option to replace it.
            </Text>
          )}
        </View>
        <TouchableOpacity
          testID={`post-privacy-open-${item.kind}-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Visibility for ${item.title || 'Untitled'}: ${d.title}. Change`}
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => setPicker(item)}
          activeOpacity={0.75}
          style={[st.pill, {
            backgroundColor: item.visibility === 'public' ? `${colors.primary}18` : colors.muted,
            borderColor: item.visibility === 'public' ? `${colors.primary}40` : colors.border,
            opacity: busy ? 0.6 : 1,
          }]}
        >
          {busy
            ? <StorigamActivityIndicator size="small" color={colors.primary} />
            : <Icon name={isOwner ? 'lock' : 'chevron-down'} size={12} color={item.visibility === 'public' ? colors.primary : colors.mutedForeground} />}
          <Text style={[st.pillText, { color: item.visibility === 'public' ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>
            {busy ? 'Saving…' : d.title}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[st.root, { backgroundColor: colors.background }]}>
      <View style={[st.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity testID="post-privacy-back" accessibilityRole="button" accessibilityLabel="Back" onPress={() => safeBack()} style={st.back} hitSlop={8}>
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.foreground }]}>Post privacy</Text>
        <View style={{ width: 36 }} />
      </View>

      {state === 'loading' ? (
        <View style={st.center}><StorigamActivityIndicator size="large" color={colors.primary} /></View>
      ) : state === 'unavailable' || state === 'error' ? (
        <View style={st.center} testID={`post-privacy-${state}`}>
          <Icon name={state === 'unavailable' ? 'cloud-off' : 'alert-circle'} size={28} color={colors.mutedForeground} />
          <Text style={[st.emptyTitle, { color: colors.foreground }]}>
            {state === 'unavailable' ? 'Post privacy settings unavailable' : 'Couldn’t load your posts'}
          </Text>
          <Text style={[st.emptyBody, { color: colors.mutedForeground }]}>
            {state === 'unavailable'
              ? 'This setting isn’t available on the server yet. Your posts keep their current visibility.'
              : 'Check your connection and try again.'}
          </Text>
          <TouchableOpacity testID="post-privacy-retry" accessibilityRole="button" onPress={() => { setState('loading'); void load(); }}
            style={[st.retry, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
            <Icon name="refresh-cw" size={14} color={colors.primary} />
            <Text style={[st.retryText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyOf}
          renderItem={renderItem}
          scrollEnabled={filtered.length > 0 || items.length > 0}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: bottomPad + 24, width: '100%', maxWidth: 680, alignSelf: 'center' }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              <Text style={[st.intro, { color: colors.mutedForeground }]}>
                Choose who can see each story, outfit, book and tutorial. Only me stays hidden until you change it.
              </Text>
              {feedback && (
                <View testID="post-privacy-feedback" accessibilityLiveRegion="polite"
                  style={[st.feedback, { borderColor: feedback.type === 'ok' ? `${colors.primary}40` : `${colors.destructive}50`, backgroundColor: feedback.type === 'ok' ? `${colors.primary}12` : `${colors.destructive}12` }]}>
                  <Icon name={feedback.type === 'ok' ? 'check' : 'alert-circle'} size={14} color={feedback.type === 'ok' ? colors.primary : colors.destructive} />
                  <Text style={[st.feedbackText, { color: colors.foreground }]}>{feedback.text}</Text>
                </View>
              )}
              {items.length > 5 && (
                <View style={[st.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Icon name="search" size={14} color={colors.mutedForeground} />
                  <TextInput testID="post-privacy-search" value={query} onChangeText={setQuery} placeholder="Search your posts"
                    placeholderTextColor={colors.mutedForeground} style={[st.searchInput, { color: colors.foreground }]} />
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={[st.center, { paddingTop: 48 }]} testID="post-privacy-empty">
              <Icon name="book-open" size={28} color={colors.mutedForeground} />
              <Text style={[st.emptyTitle, { color: colors.foreground }]}>{items.length ? 'No matches' : 'No posts yet'}</Text>
              <Text style={[st.emptyBody, { color: colors.mutedForeground }]}>
                {items.length ? 'Try a different search.' : 'Stories, outfits, books and tutorials you share will appear here.'}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={st.backdrop} onPress={() => setPicker(null)} accessibilityLabel="Close" />
        {picker && (
          <View style={[st.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: bottomPad + 16 }]} testID="post-privacy-sheet">
            <Text style={[st.sheetTitle, { color: colors.foreground }]} numberOfLines={1}>{picker.title || 'Untitled'}</Text>
            <Text style={[st.rowMeta, { color: colors.mutedForeground, marginBottom: 8 }]}>Currently: {describe(picker.visibility).title}</Text>
            {CHOICES.map(c => {
              const active = picker.visibility === c.value;
              return (
                <TouchableOpacity key={c.value} testID={`post-privacy-choice-${c.value}`} accessibilityRole="radio"
                  accessibilityState={{ selected: active }} accessibilityLabel={`${c.title}. ${c.body}`}
                  onPress={() => void choose(picker, c.value)} activeOpacity={0.75}
                  style={[st.choice, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? `${colors.primary}12` : 'transparent' }]}>
                  <View style={[st.choiceIcon, { backgroundColor: colors.muted }]}>
                    <Icon name={c.icon as never} size={15} color={active ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.rowTitle, { color: colors.foreground }]}>{c.title}</Text>
                    <Text style={[st.rowMeta, { color: colors.mutedForeground }]}>{c.body}</Text>
                  </View>
                  {active && <Icon name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity testID="post-privacy-cancel" onPress={() => setPicker(null)} style={st.cancel} accessibilityRole="button">
              <Text style={[st.retryText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Satoshi-Bold' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptyBody: { fontSize: 13, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 19 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  retryText: { fontSize: 14, fontFamily: 'Satoshi-Medium' },
  intro: { fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 19 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  feedbackText: { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  rowTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  rowMeta: { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 170, minHeight: 34 },
  pillText: { fontSize: 11, fontFamily: 'Satoshi-Bold', flexShrink: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  sheetTitle: { fontSize: 16, fontFamily: 'Satoshi-Bold' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  choiceIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
});
