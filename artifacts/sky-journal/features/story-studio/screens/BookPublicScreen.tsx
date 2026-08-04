/**
 * BookPublicScreen — reader-facing public book page.
 *
 * Shows cover art, author info, series metadata, and a scrollable list of
 * published chapters. Readers can follow the book and tap a chapter to open
 * the immersive reader.
 *
 * Route: /book-public?bookId=<uuid>
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublicChapter {
  id: string;
  title: string;
  orderIndex: number;
  publishedAt: string | null;
  pageCount: number;
  readCount: number;
}

interface PublicBook {
  id: string;
  title: string;
  subtitle: string;
  seriesType: string;
  genre: string[];
  language: string;
  ageRating: string;
  coverImageUri: string | null;
  authorUserId: string;
  followCount: number;
  isFollowing: boolean;
  chapters: PublicChapter[];
}

// ── Tab IDs ───────────────────────────────────────────────────────────────────

type TabId = 'info' | 'world' | 'characters' | 'gallery';
const TABS: { id: TabId; label: string }[] = [
  { id: 'info',       label: 'Info'       },
  { id: 'world',      label: 'World'      },
  { id: 'characters', label: 'Characters' },
  { id: 'gallery',    label: 'Gallery'    },
];

const ACCENT = '#8B70C8';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function readTime(pageCount: number): string {
  const mins = Math.max(1, Math.round(pageCount * 1.5));
  return `${mins} min`;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookPublicScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const apiFetch = useApiFetch();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [book,    setBook]    = useState<PublicBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabId>('info');
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!bookId) return;
    setLoading(true);
    apiFetch<PublicBook>(`/books/${bookId}/public`)
      .then(data => {
        setBook(data);
        setFollowing(data.isFollowing);
      })
      .catch(() => {/* handled by loading state */})
      .finally(() => setLoading(false));
  }, [bookId]));

  async function toggleFollow() {
    if (!bookId || followLoading) return;
    setFollowLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (following) {
        await apiFetch<void>(`/books/${bookId}/follow`, { method: 'DELETE' });
        setFollowing(false);
        setBook(prev => prev ? { ...prev, followCount: Math.max(0, prev.followCount - 1) } : prev);
      } else {
        await apiFetch<{ following: boolean }>(`/books/${bookId}/follow`, { method: 'POST' });
        setFollowing(true);
        setBook(prev => prev ? { ...prev, followCount: prev.followCount + 1 } : prev);
      }
    } catch {
      /* ignore */
    } finally {
      setFollowLoading(false);
    }
  }

  function openChapter(chapter: PublicChapter) {
    router.push(`/chapter-reader?chapterId=${chapter.id}&bookId=${bookId}` as never);
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderChapter({ item, index }: { item: PublicChapter; index: number }) {
    return (
      <TouchableOpacity
        style={s.chapterRow}
        onPress={() => openChapter(item)}
        activeOpacity={0.75}
      >
        <View style={s.chapterNum}>
          <Text style={s.chapterNumTxt}>{index + 1}</Text>
        </View>
        <View style={s.chapterBody}>
          <Text style={s.chapterTitle} numberOfLines={1}>{item.title}</Text>
          <View style={s.chapterMeta}>
            <Text style={s.metaTxt}>{item.pageCount} pages</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={s.metaTxt}>{readTime(item.pageCount)} read</Text>
            {item.readCount > 0 && <>
              <Text style={s.metaDot}>·</Text>
              <Text style={s.metaTxt}>{item.readCount.toLocaleString()} reads</Text>
            </>}
            {item.publishedAt && <>
              <Text style={s.metaDot}>·</Text>
              <Text style={s.metaTxt}>{formatDate(item.publishedAt)}</Text>
            </>}
          </View>
        </View>
        <Icon name="chevron-right" size={14} color="rgba(200,185,255,0.28)" />
      </TouchableOpacity>
    );
  }

  function renderTabContent() {
    if (!book) return null;
    switch (tab) {
      case 'info':
        return (
          <View>
            {book.chapters.length === 0 ? (
              <View style={s.empty}>
                <Icon name="book-open" size={28} color="rgba(200,185,255,0.15)" />
                <Text style={s.emptyTxt}>No published chapters yet</Text>
              </View>
            ) : (
              <>
                <Text style={s.sectionLabel}>CHAPTERS · {book.chapters.length}</Text>
                {book.chapters.map((c, i) => (
                  <React.Fragment key={c.id}>
                    {renderChapter({ item: c, index: i })}
                  </React.Fragment>
                ))}
              </>
            )}
          </View>
        );
      case 'world':
        return (
          <View style={s.placeholder}>
            <Icon name="globe" size={28} color="rgba(200,185,255,0.15)" />
            <Text style={s.placeholderTxt}>World lore coming soon</Text>
            <Text style={s.placeholderSub}>Authors will be able to add setting details, maps, and lore entries.</Text>
          </View>
        );
      case 'characters':
        return (
          <View style={s.placeholder}>
            <Icon name="users" size={28} color="rgba(200,185,255,0.15)" />
            <Text style={s.placeholderTxt}>Character roster coming soon</Text>
            <Text style={s.placeholderSub}>Authors will be able to introduce recurring characters here.</Text>
          </View>
        );
      case 'gallery':
        return (
          <View style={s.placeholder}>
            <Icon name="image" size={28} color="rgba(200,185,255,0.15)" />
            <Text style={s.placeholderTxt}>Fan art gallery coming soon</Text>
            <Text style={s.placeholderSub}>Readers will be able to share artwork inspired by this story.</Text>
          </View>
        );
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Icon name="book" size={40} color="rgba(200,185,255,0.2)" />
        <Text style={s.emptyTxt}>Book not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backInline}>
          <Text style={{ color: ACCENT, fontSize: 14 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverW = width * 0.38;
  const coverH = coverW * 1.45;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Top nav */}
      <View style={[s.topNav, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/engagement?bookId=${bookId}&tab=discussions` as never)}
          style={s.navBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="message-circle" size={18} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          {/* Cover art */}
          <View style={[s.cover, { width: coverW, height: coverH }]}>
            {book.coverImageUri ? (
              <Image
                source={{ uri: book.coverImageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, s.coverPlaceholder]}>
                <Icon name="book" size={32} color="rgba(200,185,255,0.25)" />
              </View>
            )}
          </View>

          {/* Meta */}
          <View style={s.heroMeta}>
            <Text style={s.bookTitle} numberOfLines={3}>{book.title}</Text>
            {!!book.subtitle && <Text style={s.bookSubtitle} numberOfLines={2}>{book.subtitle}</Text>}

            {/* Genre chips */}
            <View style={s.chips}>
              {book.genre.slice(0, 3).map(g => (
                <View key={g} style={s.chip}>
                  <Text style={s.chipTxt}>{g}</Text>
                </View>
              ))}
              <View style={s.chip}>
                <Text style={s.chipTxt}>{book.ageRating}</Text>
              </View>
            </View>

            {/* Stats row */}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statVal}>{book.followCount.toLocaleString()}</Text>
                <Text style={s.statLbl}>Followers</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statVal}>{book.chapters.length}</Text>
                <Text style={s.statLbl}>Chapters</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statVal}>{book.seriesType === 'oneshot' ? 'One-shot' : book.seriesType === 'series' ? 'Series' : 'Standalone'}</Text>
                <Text style={s.statLbl}>Type</Text>
              </View>
            </View>

            {/* Follow button */}
            <TouchableOpacity
              style={[s.followBtn, following && s.followBtnActive]}
              onPress={toggleFollow}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading
                ? <ActivityIndicator color={following ? ACCENT : '#fff'} size="small" />
                : <>
                    <Icon name={following ? 'check' : 'plus'} size={13} color={following ? ACCENT : '#fff'} />
                    <Text style={[s.followTxt, following && { color: ACCENT }]}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabStrip}
          contentContainerStyle={s.tabStripContent}
        >
          {TABS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
              onPress={() => setTab(t.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === t.id && s.tabTxtActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        <View style={s.tabContent}>
          {renderTabContent()}
        </View>
      </ScrollView>

      {/* Read first chapter CTA */}
      {book.chapters.length > 0 && (
        <View style={[s.readCta, { bottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={s.readCtaBtn}
            onPress={() => openChapter(book.chapters[0]!)}
            activeOpacity={0.85}
          >
            <Icon name="book-open" size={15} color="#fff" />
            <Text style={s.readCtaTxt}>Start Reading</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:            { flex: 1 },
  scroll:          { flex: 1 },
  topNav:          { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  navBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hero:            { flexDirection: 'row', padding: 20, gap: 16, alignItems: 'flex-start' },
  cover:           { borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  coverPlaceholder:{ alignItems: 'center', justifyContent: 'center' },
  heroMeta:        { flex: 1, gap: 8 },
  bookTitle:       { color: 'rgba(255,255,255,0.94)', fontSize: 18, fontWeight: '700', lineHeight: 24 },
  bookSubtitle:    { color: 'rgba(255,255,255,0.40)', fontSize: 13, fontStyle: 'italic' },
  chips:           { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(139,112,200,0.12)', borderWidth: 1, borderColor: 'rgba(139,112,200,0.22)' },
  chipTxt:         { color: 'rgba(200,185,255,0.60)', fontSize: 10 },
  statsRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  statItem:        { alignItems: 'center', gap: 1 },
  statVal:         { color: 'rgba(255,255,255,0.80)', fontSize: 12, fontWeight: '600' },
  statLbl:         { color: 'rgba(200,185,255,0.35)', fontSize: 9 },
  statDivider:     { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  followBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: ACCENT, alignSelf: 'flex-start', marginTop: 4 },
  followBtnActive: { backgroundColor: 'rgba(139,112,200,0.14)', borderWidth: 1, borderColor: `${ACCENT}55` },
  followTxt:       { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabStrip:        { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  tabStripContent: { paddingHorizontal: 16, gap: 4 },
  tabBtn:          { paddingHorizontal: 14, paddingVertical: 11 },
  tabBtnActive:    { borderBottomWidth: 2, borderBottomColor: ACCENT },
  tabTxt:          { color: 'rgba(255,255,255,0.38)', fontSize: 13, fontWeight: '500' },
  tabTxtActive:    { color: 'rgba(255,255,255,0.90)' },
  tabContent:      { paddingHorizontal: 0 },
  sectionLabel:    { color: 'rgba(200,185,255,0.30)', fontSize: 10, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  chapterRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  chapterNum:      { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  chapterNumTxt:   { color: 'rgba(200,185,255,0.50)', fontSize: 11, fontWeight: '600' },
  chapterBody:     { flex: 1 },
  chapterTitle:    { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '500', marginBottom: 3 },
  chapterMeta:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  metaTxt:         { color: 'rgba(200,185,255,0.35)', fontSize: 11 },
  metaDot:         { color: 'rgba(200,185,255,0.20)', fontSize: 11 },
  empty:           { alignItems: 'center', paddingVertical: 50, gap: 8, paddingHorizontal: 20 },
  emptyTxt:        { color: 'rgba(255,255,255,0.30)', fontSize: 15, fontWeight: '500' },
  placeholder:     { alignItems: 'center', paddingVertical: 50, gap: 10, paddingHorizontal: 32 },
  placeholderTxt:  { color: 'rgba(255,255,255,0.30)', fontSize: 15, fontWeight: '500', textAlign: 'center' },
  placeholderSub:  { color: 'rgba(200,185,255,0.20)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  backInline:      { marginTop: 12 },
  readCta:         { position: 'absolute', alignSelf: 'center' },
  readCtaBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30, backgroundColor: ACCENT, shadowColor: ACCENT, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  readCtaTxt:      { color: '#fff', fontSize: 15, fontWeight: '700' },
});
