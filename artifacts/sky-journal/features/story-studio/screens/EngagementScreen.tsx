/**
 * EngagementScreen — reader engagement hub for a chapter.
 *
 * Three tabs:
 *  - Comments  — threaded comments with reply + like
 *  - Fan Art   — image grid (upload flow in a follow-up task)
 *  - Discussions — open-ended post list (future task)
 *
 * Route: /engagement?chapterId=<uuid>&bookId=<uuid>&tab=comments|fanart|discussions
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';
import { useAuth } from '@clerk/expo';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  chapterId: string;
  userId: string;
  parentId: string | null;
  content: string;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  // local state
  liked?: boolean;
}

type TabId = 'comments' | 'fanart' | 'discussions';

const ACCENT = '#8B70C8';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = (Date.now() - new Date(iso).getTime()) / 1000;
  if (secs < 60)   return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EngagementScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const apiFetch = useApiFetch();
  const { userId: currentUserId } = useAuth();
  const { chapterId, bookId, tab: initialTab } = useLocalSearchParams<{
    chapterId: string;
    bookId:    string;
    tab?:      string;
  }>();

  const [tab,         setTab]         = useState<TabId>((initialTab as TabId) ?? 'comments');
  const [comments,    setComments]    = useState<Comment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [posting,     setPosting]     = useState(false);
  const [input,       setInput]       = useState('');
  const [replyTo,     setReplyTo]     = useState<Comment | null>(null);
  const [expanded,    setExpanded]    = useState<Record<string, Comment[] | null>>({});
  const inputRef     = useRef<TextInput>(null);

  useFocusEffect(useCallback(() => {
    if (tab === 'comments' && chapterId) {
      loadComments();
    }
  }, [tab, chapterId]));

  async function loadComments() {
    if (!chapterId) return;
    setLoading(true);
    try {
      const data = await apiFetch<Comment[]>(`/chapters/${chapterId}/comments`);
      setComments(data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function postComment() {
    if (!input.trim() || !chapterId) return;
    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const comment = await apiFetch<Comment>(`/chapters/${chapterId}/comments`, {
        method: 'POST',
        json: {
          content:  input.trim(),
          parentId: replyTo?.id ?? null,
        },
      });
      if (replyTo) {
        // Add reply to the expanded set
        setExpanded(prev => ({
          ...prev,
          [replyTo.id]: [...(prev[replyTo.id] ?? []), comment],
        }));
        // Bump reply count on parent
        setComments(prev => prev.map(c =>
          c.id === replyTo.id ? { ...c, replyCount: c.replyCount + 1 } : c
        ));
      } else {
        setComments(prev => [comment, ...prev]);
      }
      setInput('');
      setReplyTo(null);
    } catch {
      Alert.alert('Error', 'Could not post comment');
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(comment: Comment) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic update
    const liked = !comment.liked;
    setComments(prev => prev.map(c =>
      c.id === comment.id
        ? { ...c, liked, likeCount: c.likeCount + (liked ? 1 : -1) }
        : c
    ));
    try {
      await apiFetch<{ liked: boolean }>(`/comments/${comment.id}/like`, { method: 'POST' });
    } catch {
      // Revert on failure
      setComments(prev => prev.map(c =>
        c.id === comment.id
          ? { ...c, liked: !liked, likeCount: c.likeCount + (liked ? -1 : 1) }
          : c
      ));
    }
  }

  async function loadReplies(comment: Comment) {
    if (!chapterId) return;
    if (expanded[comment.id] !== undefined) {
      // Toggle collapse
      setExpanded(prev => ({ ...prev, [comment.id]: prev[comment.id] === null ? null : null }));
      return;
    }
    setExpanded(prev => ({ ...prev, [comment.id]: null })); // loading placeholder
    try {
      const replies = await apiFetch<Comment[]>(`/chapters/${chapterId}/comments?parentId=${comment.id}`);
      setExpanded(prev => ({ ...prev, [comment.id]: replies }));
    } catch {
      setExpanded(prev => { const n = { ...prev }; delete n[comment.id]; return n; });
    }
  }

  function startReply(comment: Comment) {
    setReplyTo(comment);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // ── Comment item renderer ──────────────────────────────────────────────────

  function CommentItem({ item, isReply = false }: { item: Comment; isReply?: boolean }) {
    const isOwn = item.userId === currentUserId;
    return (
      <View style={[s.commentRow, isReply && s.replyRow]}>
        {/* Avatar */}
        <View style={[s.avatar, isReply && s.avatarSmall]}>
          <Text style={s.avatarTxt}>{item.userId.slice(5, 6).toUpperCase()}</Text>
        </View>
        <View style={s.commentBody}>
          <View style={s.commentMeta}>
            <Text style={s.commentUser}>{isOwn ? 'You' : `Reader`}</Text>
            <Text style={s.commentTime}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={s.commentContent}>{item.content}</Text>
          <View style={s.commentActions}>
            <TouchableOpacity onPress={() => toggleLike(item)} style={s.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Icon name="heart" size={12} color={item.liked ? '#E8607A' : 'rgba(255,255,255,0.30)'} />
              {item.likeCount > 0 && <Text style={[s.actionTxt, item.liked && { color: '#E8607A' }]}>{item.likeCount}</Text>}
            </TouchableOpacity>
            {!isReply && (
              <TouchableOpacity onPress={() => startReply(item)} style={s.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Icon name="corner-down-right" size={12} color="rgba(255,255,255,0.28)" />
                <Text style={s.actionTxt}>Reply</Text>
              </TouchableOpacity>
            )}
            {!isReply && item.replyCount > 0 && (
              <TouchableOpacity onPress={() => loadReplies(item)} style={s.actionBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[s.actionTxt, { color: ACCENT }]}>
                  {expanded[item.id] ? 'Hide' : `${item.replyCount} repl${item.replyCount === 1 ? 'y' : 'ies'}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Replies */}
          {!isReply && expanded[item.id] !== undefined && (
            <View style={s.replies}>
              {expanded[item.id] === null
                ? <ActivityIndicator color={ACCENT} size="small" style={{ margin: 8 }} />
                : expanded[item.id]!.map(r => <CommentItem key={r.id} item={r} isReply />)
              }
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Tab content ────────────────────────────────────────────────────────────

  function renderTabContent() {
    switch (tab) {
      case 'comments':
        if (loading) return <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />;
        if (comments.length === 0) {
          return (
            <View style={s.empty}>
              <Icon name="message-circle" size={32} color="rgba(200,185,255,0.15)" />
              <Text style={s.emptyTxt}>No comments yet</Text>
              <Text style={s.emptySub}>Be the first to share your thoughts</Text>
            </View>
          );
        }
        return (
          <FlatList
            data={comments}
            keyExtractor={c => c.id}
            renderItem={({ item }) => <CommentItem item={item} />}
            contentContainerStyle={s.commentList}
            keyboardShouldPersistTaps="handled"
          />
        );

      case 'fanart':
        return (
          <View style={s.empty}>
            <Icon name="image" size={32} color="rgba(200,185,255,0.15)" />
            <Text style={s.emptyTxt}>Fan art coming soon</Text>
            <Text style={s.emptySub}>Share artwork inspired by this chapter. Uploads will be available here.</Text>
          </View>
        );

      case 'discussions':
        return (
          <View style={s.empty}>
            <Icon name="layers" size={32} color="rgba(200,185,255,0.15)" />
            <Text style={s.emptyTxt}>Discussions coming soon</Text>
            <Text style={s.emptySub}>Readers will be able to start discussion threads about this chapter.</Text>
          </View>
        );
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Engagement</Text>
        <View style={s.backBtn} />
      </View>

      {/* Tab strip */}
      <View style={s.tabStrip}>
        {(['comments', 'fanart', 'discussions'] as TabId[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'comments' ? 'Comments' : t === 'fanart' ? 'Fan Art' : 'Discussions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {renderTabContent()}
      </View>

      {/* Comment input (comments tab only) */}
      {tab === 'comments' && (
        <View style={[s.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          {replyTo && (
            <View style={s.replyBanner}>
              <Icon name="corner-down-right" size={12} color={ACCENT} />
              <Text style={s.replyBannerTxt} numberOfLines={1}>
                Replying to comment
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Icon name="x" size={12} color="rgba(200,185,255,0.45)" />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder={replyTo ? 'Write a reply…' : 'Share your thoughts…'}
              placeholderTextColor="rgba(200,185,255,0.30)"
              multiline
              maxLength={2000}
              returnKeyType="default"
              onSubmitEditing={postComment}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || posting) && s.sendBtnDisabled]}
              onPress={postComment}
              disabled={!input.trim() || posting}
              activeOpacity={0.8}
            >
              {posting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Icon name="send" size={15} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { color: 'rgba(255,255,255,0.90)', fontSize: 17, fontWeight: '600' },
  tabStrip:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tabBtn:        { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabBtnActive:  { borderBottomWidth: 2, borderBottomColor: ACCENT },
  tabTxt:        { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '500' },
  tabTxtActive:  { color: 'rgba(255,255,255,0.90)' },
  commentList:   { padding: 16, gap: 0 },
  commentRow:    { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  replyRow:      { paddingLeft: 4, marginTop: 8, borderBottomWidth: 0 },
  avatar:        { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(139,112,200,0.25)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarSmall:   { width: 26, height: 26, borderRadius: 13 },
  avatarTxt:     { color: ACCENT, fontSize: 13, fontWeight: '700' },
  commentBody:   { flex: 1, gap: 4 },
  commentMeta:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentUser:   { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  commentTime:   { color: 'rgba(200,185,255,0.30)', fontSize: 11 },
  commentContent:{ color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20 },
  commentActions:{ flexDirection: 'row', gap: 14, marginTop: 4 },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionTxt:     { color: 'rgba(255,255,255,0.30)', fontSize: 11 },
  replies:       { marginTop: 8, paddingLeft: 4, borderLeftWidth: 2, borderLeftColor: 'rgba(139,112,200,0.18)' },
  empty:         { alignItems: 'center', paddingVertical: 56, gap: 10, paddingHorizontal: 32 },
  emptyTxt:      { color: 'rgba(255,255,255,0.30)', fontSize: 16, fontWeight: '500', textAlign: 'center' },
  emptySub:      { color: 'rgba(200,185,255,0.20)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  inputBar:      { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 10, paddingHorizontal: 16, gap: 6, backgroundColor: 'rgba(13,11,26,0.95)' },
  replyBanner:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyBannerTxt:{ flex: 1, color: ACCENT, fontSize: 11 },
  inputRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input:         { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: 'rgba(255,255,255,0.88)', fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  sendBtnDisabled:{ opacity: 0.4 },
});
