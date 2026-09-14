/**
 * BookDetailsScreen — overview of a book, its chapters and their status.
 * "+ New Chapter" creates a blank draft chapter and navigates to PageManagerScreen.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';
import { SkyLoadingMark, SkyLoadingOverlay } from '@/components/SkyLoading';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Book {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  seriesType: string;
  genre: string[];
  language: string;
  ageRating: string;
  visibility: string;
  coverImageUri: string | null;
  chapterCount: number;
  createdAt: string;
}

interface Chapter {
  id: string;
  bookId: string;
  title: string;
  orderIndex: number;
  status: 'draft' | 'published';
  publishedAt: string | null;
  pageCount: number;
  updatedAt: string;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookDetailsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const fetch   = useApiFetch();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [book,       setBook]       = useState<Book | null>(null);
  const [chapters,   setChapters]   = useState<Chapter[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [adding,     setAdding]     = useState(false);
  const [descDraft,  setDescDraft]  = useState('');
  const [descFocused, setDescFocused] = useState(false);
  const [descSaving, setDescSaving] = useState(false);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);

  async function loadData() {
    if (!bookId) {
      setLoading(false);
      return;
    }
    try {
      const [bookData, chapData] = await Promise.all([
        fetch<Book>(`/books/${bookId}`),
        fetch<Chapter[]>(`/books/${bookId}/chapters`),
      ]);
      setBook(bookData);
      setDescDraft(bookData.description ?? '');
      setChapters(chapData);
    } catch (err) {
      Alert.alert('Error', 'Could not load book details');
    } finally {
      setLoading(false);
    }
  }

  async function saveDescription() {
    if (!bookId || descSaving) return;
    setDescSaving(true);
    try {
      const updated = await fetch<Book>(`/books/${bookId}`, {
        method: 'PATCH',
        json: { description: descDraft.trim() },
      });
      setBook(updated);
      setDescDraft(updated.description ?? '');
    } catch {
      Alert.alert('Error', 'Could not save synopsis');
    } finally {
      setDescSaving(false);
      setDescFocused(false);
    }
  }

  useFocusEffect(useCallback(() => { void loadData(); }, [bookId]));

  async function addChapter() {
    if (!bookId) return;
    setAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const chap = await fetch<Chapter>(`/books/${bookId}/chapters`, {
        method: 'POST',
        json: {
          title: `Chapter ${chapters.length + 1}`,
          orderIndex: chapters.length,
        },
      });
      setChapters(prev => [...prev, chap]);
      router.push(`/page-manager?chapterId=${chap.id}&bookId=${bookId}` as never);
    } catch (err) {
      Alert.alert('Error', 'Could not create chapter');
    } finally {
      setAdding(false);
    }
  }

  async function deleteChapter(chapterId: string) {
    Alert.alert('Delete Chapter', 'This will permanently delete the chapter and all its pages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeletingChapterId(chapterId);
          try {
            await fetch<void>(`/chapters/${chapterId}`, { method: 'DELETE' });
            setChapters(prev => prev.filter(c => c.id !== chapterId));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {
            Alert.alert('Error', 'Could not delete chapter');
          } finally {
            setDeletingChapterId(null);
          }
        },
      },
    ]);
  }

  const accent = '#8B70C8';

  function timeAgo(iso: string) {
    const d = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (d < 1) return 'today';
    if (d < 2) return 'yesterday';
    if (d < 7) return `${Math.floor(d)}d ago`;
    return `${Math.floor(d / 7)}w ago`;
  }

  function renderChapter({ item, index }: { item: Chapter; index: number }) {
    const isPublished = item.status === 'published';
    const statusColor = isPublished ? '#78C8A0' : '#9B7FE8';
    return (
      <TouchableOpacity
        style={s.chapterCard}
        onPress={() => router.push(`/page-manager?chapterId=${item.id}&bookId=${bookId}` as never)}
        activeOpacity={0.75}
      >
        <View style={s.chapterIndex}>
          <Text style={s.chapterIndexTxt}>{index + 1}</Text>
        </View>
        <View style={s.chapterBody}>
          <Text style={s.chapterTitle} numberOfLines={1}>{item.title}</Text>
          <View style={s.chapterMeta}>
            <View style={[s.statusBadge, { borderColor: `${statusColor}40`, backgroundColor: `${statusColor}14` }]}>
              <Text style={[s.statusTxt, { color: statusColor }]}>{isPublished ? 'Published' : 'Draft'}</Text>
            </View>
            <Text style={s.metaTxt}>{item.pageCount} pages</Text>
            <Text style={s.metaTxt}>{timeAgo(item.updatedAt)}</Text>
          </View>
        </View>
        <View style={s.chapterActions}>
          <TouchableOpacity
            onPress={() => router.push(`/publish-chapter?chapterId=${item.id}&bookId=${bookId}` as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.actionBtn}
          >
            <Icon name="send" size={14} color={isPublished ? statusColor : 'rgba(200,185,255,0.4)'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteChapter(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.actionBtn}
          >
            {deletingChapterId === item.id
              ? <SkyLoadingMark size={17} />
              : <Icon name="trash-2" size={14} color="rgba(200,185,255,0.28)" />}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <View style={[s.root, { backgroundColor: colors.background }]}><SkyLoadingOverlay message="Opening your book…" /></View>;
  }

  if (!bookId) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={s.emptyTxt}>This book link is missing an ID.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: accent, fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{book?.title ?? 'Book Details'}</Text>
        <TouchableOpacity
          onPress={() => router.push(`/chapters-list?bookId=${bookId}` as never)}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="list" size={18} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
      </View>

      {/* Book meta */}
      {book && (
        <View style={s.bookMeta}>
          <View style={s.bookMetaChips}>
            {book.genre.slice(0, 3).map(g => (
              <View key={g} style={s.metaChip}>
                <Text style={s.metaChipTxt}>{g}</Text>
              </View>
            ))}
            {book.genre.length > 3 && (
              <View style={s.metaChip}>
                <Text style={s.metaChipTxt}>+{book.genre.length - 3}</Text>
              </View>
            )}
            <View style={s.metaChip}>
              <Text style={s.metaChipTxt}>{book.ageRating}</Text>
            </View>
            <View style={s.metaChip}>
              <Icon name={book.visibility === 'public' ? 'globe' : 'lock'} size={10} color="rgba(200,185,255,0.45)" />
            </View>
          </View>
          {book.subtitle ? <Text style={s.bookSubtitle}>{book.subtitle}</Text> : null}

          {/* Synopsis / description — inline editable */}
          <Text style={s.descLabel}>SYNOPSIS</Text>
          <TextInput
            style={[s.descInput, descFocused && s.descInputFocused]}
            value={descDraft}
            onChangeText={setDescDraft}
            onFocus={() => setDescFocused(true)}
            onBlur={saveDescription}
            multiline
            numberOfLines={4}
            placeholder="Write a synopsis for your book…"
            placeholderTextColor="rgba(200,185,255,0.22)"
            returnKeyType="default"
            blurOnSubmit={false}
          />
          {descFocused && (
            <TouchableOpacity
              style={[s.descSaveBtn, descSaving && { opacity: 0.6 }]}
              onPress={saveDescription}
              disabled={descSaving}
            >
              {descSaving
                ? <SkyLoadingMark size={17} color="#fff" />
                : <Text style={s.descSaveTxt}>Save</Text>}
            </TouchableOpacity>
          )}

          <Text style={s.bookStat}>{chapters.length} chapter{chapters.length !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* Chapters list */}
      <FlatList
        data={chapters}
        keyExtractor={c => c.id}
        renderItem={renderChapter}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 100 }]}
        ListEmptyComponent={
          <View style={s.empty}>
            <Icon name="book-open" size={32} color="rgba(200,185,255,0.18)" />
            <Text style={s.emptyTxt}>No chapters yet</Text>
            <Text style={s.emptySub}>Tap "+ New Chapter" to get started</Text>
          </View>
        }
      />

      {/* FAB */}
      <View style={[s.fab, { bottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[s.fabBtn, { backgroundColor: accent }]}
          onPress={addChapter}
          disabled={adding}
          activeOpacity={0.85}
        >
          {adding
            ? <SkyLoadingMark size={18} color="#fff" />
            : <>
                <Icon name="plus" size={16} color="#fff" />
                <Text style={s.fabTxt}>New Chapter</Text>
              </>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, color: 'rgba(255,255,255,0.92)', fontSize: 17, fontWeight: '600', textAlign: 'center', marginHorizontal: 8 },
  bookMeta:      { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  bookMetaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  metaChipTxt:   { color: 'rgba(200,185,255,0.50)', fontSize: 11 },
  bookSubtitle:  { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 4, fontStyle: 'italic' },
  descLabel:     { color: 'rgba(200,185,255,0.38)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 10, marginBottom: 6 },
  descInput:     { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: 'rgba(255,255,255,0.82)', fontSize: 13, minHeight: 80, textAlignVertical: 'top', marginBottom: 4 },
  descInputFocused: { borderColor: 'rgba(139,112,200,0.45)', backgroundColor: 'rgba(139,112,200,0.06)' },
  descSaveBtn:   { alignSelf: 'flex-end', backgroundColor: '#8B70C8', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, marginBottom: 6 },
  descSaveTxt:   { color: '#fff', fontSize: 13, fontWeight: '600' },
  bookStat:      { color: 'rgba(200,185,255,0.38)', fontSize: 12, marginTop: 4 },
  list:          { padding: 16, gap: 10 },
  chapterCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, gap: 12 },
  chapterIndex:  { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  chapterIndexTxt: { color: 'rgba(255,255,255,0.50)', fontSize: 12, fontWeight: '600' },
  chapterBody:   { flex: 1 },
  chapterTitle:  { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '500', marginBottom: 5 },
  chapterMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  statusTxt:     { fontSize: 10, fontWeight: '600' },
  metaTxt:       { color: 'rgba(200,185,255,0.35)', fontSize: 11 },
  chapterActions: { flexDirection: 'row', gap: 4 },
  actionBtn:     { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  empty:         { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTxt:      { color: 'rgba(255,255,255,0.35)', fontSize: 16, fontWeight: '500' },
  emptySub:      { color: 'rgba(200,185,255,0.25)', fontSize: 13 },
  fab:           { position: 'absolute', alignSelf: 'center' },
  fabBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 28, shadowColor: '#8B70C8', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabTxt:        { color: '#fff', fontSize: 15, fontWeight: '700' },
});
