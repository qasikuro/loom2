/**
 * MyBooksScreen
 *
 * Lists all books belonging to the authenticated creator.
 * Tapping a book navigates to BookDetailsScreen (/book-details?bookId=...).
 * Header provides a shortcut to create a new book.
 */
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';
import { LoadingCard } from '@/components/SkyLoading';

// ── Types ─────────────────────────────────────────────────────────────────────

type BookListItem = {
  id:           string;
  title:        string;
  subtitle:     string;
  genre:        string[];
  visibility:   'public' | 'private';
  coverImageUri:string | null;
  updatedAt:    string;
  chapterCount: number;
};

// ── Book row ──────────────────────────────────────────────────────────────────

function BookRow({
  book,
  accentColor,
  onPress,
}: {
  book: BookListItem;
  accentColor: string;
  onPress: () => void;
}) {
  const ago = getRelativeTime(book.updatedAt);
  const isPrivate = book.visibility === 'private';

  return (
    <TouchableOpacity style={s.bookRow} activeOpacity={0.78} onPress={onPress}>
      {/* Cover */}
      <View style={[s.cover, { backgroundColor: `${accentColor}14`, borderColor: `${accentColor}20` }]}>
        {book.coverImageUri ? (
          <Image source={{ uri: book.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Icon name="book" size={18} color={`${accentColor}60`} />
        )}
      </View>

      {/* Info */}
      <View style={s.rowInfo}>
        <View style={s.rowTitleRow}>
          <Text style={s.rowTitle} numberOfLines={1}>{book.title}</Text>
          {isPrivate && (
            <View style={s.privateBadge}>
              <Icon name="lock" size={9} color="rgba(200,185,255,0.50)" />
              <Text style={s.privateTxt}>Private</Text>
            </View>
          )}
        </View>
        {book.subtitle ? (
          <Text style={s.rowSubtitle} numberOfLines={1}>{book.subtitle}</Text>
        ) : null}
        <View style={s.rowMeta}>
          <Icon name="layers" size={10} color="rgba(200,185,255,0.35)" />
          <Text style={s.rowMetaTxt}>
            {book.chapterCount} chapter{book.chapterCount !== 1 ? 's' : ''}
          </Text>
          {book.genre.length > 0 && (
            <>
              <View style={s.metaDot} />
              <Text style={s.rowMetaTxt} numberOfLines={1}>{book.genre.slice(0, 2).join(', ')}</Text>
            </>
          )}
          <View style={s.metaDot} />
          <Text style={s.rowMetaTxt}>{ago}</Text>
        </View>
      </View>

      <Icon name="chevron-right" size={14} color="rgba(200,185,255,0.22)" />
    </TouchableOpacity>
  );
}

function getRelativeTime(iso: string): string {
  const ms   = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function MyBooksScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const apiFetch = useApiFetch();

  const [books,      setBooks]     = useState<BookListItem[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);
  const [error,      setError]     = useState<string | null>(null);

  const accentColor = colors.primary ?? '#9B7FE8';

  async function loadBooks(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BookListItem[]>('/books');
      if (data !== null) setBooks(data);
    } catch {
      setError('Could not load books');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { void loadBooks(); }, []));

  const topPad = insets.top + 10;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.78)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Books</Text>
        <TouchableOpacity
          style={[s.newBtn, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}
          onPress={() => router.push('/create-book')}
        >
          <Icon name="plus" size={14} color={accentColor} />
          <Text style={[s.newBtnTxt, { color: accentColor }]}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading && !books.length ? (
        <View style={s.loadingList}>
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Icon name="alert-circle" size={22} color="rgba(224,92,92,0.70)" />
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity style={[s.retryBtn, { borderColor: `${accentColor}30` }]} onPress={() => loadBooks()}>
            <Text style={[s.retryBtnTxt, { color: accentColor }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : books.length === 0 ? (
        <View style={s.center}>
          <View style={[s.emptyIcon, { backgroundColor: `${accentColor}10` }]}>
            <Icon name="book-open" size={30} color={`${accentColor}50`} />
          </View>
          <Text style={s.emptyTitle}>No books yet</Text>
          <Text style={s.emptySub}>Create your first book to start building your story.</Text>
          <TouchableOpacity
            style={[s.createBtn, { backgroundColor: accentColor }]}
            onPress={() => router.push('/create-book')}
          >
            <Icon name="plus" size={14} color="#fff" />
            <Text style={s.createBtnTxt}>Create a Book</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={b => b.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadBooks(true); }}
              tintColor={accentColor}
            />
          }
          renderItem={({ item }) => (
            <BookRow
              book={item}
              accentColor={accentColor}
              onPress={() => router.push({ pathname: '/book-details', params: { bookId: item.id } })}
            />
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#04030C' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.09)',
  },
  headerTitle: {
    flex: 1, fontSize: 18, fontFamily: 'Satoshi-Bold',
    color: 'rgba(248,244,255,0.95)', letterSpacing: -0.4,
  },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
  },
  newBtnTxt: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  list: { paddingHorizontal: 16, paddingTop: 6 },
  loadingList: { paddingHorizontal: 16, paddingTop: 14, gap: 10 },

  bookRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  cover: {
    width: 52, height: 70, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    flexShrink: 0,
  },
  rowInfo:     { flex: 1, gap: 4 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: {
    flex: 1, fontSize: 14, fontFamily: 'Satoshi-Bold',
    color: 'rgba(240,235,255,0.92)',
  },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    backgroundColor: 'rgba(200,185,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.12)',
  },
  privateTxt: {
    fontSize: 9, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,185,255,0.45)', letterSpacing: 0.3,
  },
  rowSubtitle: {
    fontSize: 11.5, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.42)',
  },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  rowMetaTxt: {
    fontSize: 10.5, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.35)',
  },
  metaDot: {
    width: 2, height: 2, borderRadius: 1,
    backgroundColor: 'rgba(200,185,255,0.20)',
  },

  separator: {
    height: 1, marginHorizontal: 0,
    backgroundColor: 'rgba(200,185,255,0.06)',
  },

  // Error / empty
  errorTxt:  { fontSize: 14, fontFamily: 'Satoshi-Medium', color: 'rgba(224,92,92,0.80)', textAlign: 'center' },
  retryBtn:  { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  retryBtnTxt:{ fontSize: 13, fontFamily: 'Satoshi-Bold' },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:{ fontSize: 17, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.65)', textAlign: 'center' },
  emptySub:  { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.38)', textAlign: 'center', lineHeight: 19 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: 18, marginTop: 4,
  },
  createBtnTxt: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },
});
