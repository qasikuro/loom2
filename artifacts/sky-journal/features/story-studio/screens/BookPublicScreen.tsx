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
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SecureImage as Image } from '@/components/SecureImage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';
import { SkyLoadingMark, SkyLoadingOverlay } from '@/components/SkyLoading';
import { useTranslation } from 'react-i18next';

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
  description: string;
  seriesType: string;
  genre: string[];
  language: string;
  ageRating: string;
  coverImageUri: string | null;
  authorUserId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUri: string | null;
  followCount: number;
  isFollowing: boolean;
  chapters: PublicChapter[];
}

// ── Tab IDs ───────────────────────────────────────────────────────────────────

type TabId = 'chapters' | 'info' | 'world' | 'characters' | 'gallery';
const TABS: { id: TabId }[] = [
  { id: 'chapters' },
  { id: 'info' },
  { id: 'world' },
  { id: 'characters' },
  { id: 'gallery' },
];

const ACCENT = '#8B70C8';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookPublicScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const webTopInset = Platform.OS === 'web' ? 67 : insets.top;
  const apiFetch = useApiFetch();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  const [book,    setBook]    = useState<PublicBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabId>('chapters');
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!bookId) {
      setLoading(false);
      return;
    }
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
            <Text style={s.metaTxt}>{t('studioReader.pages', { count: item.pageCount })}</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={s.metaTxt}>{t('studioReader.minute', { count: Math.max(1, Math.round(item.pageCount * 1.5)) })} {t('studioReader.read')}</Text>
            {item.readCount > 0 && <>
              <Text style={s.metaDot}>·</Text>
              <Text style={s.metaTxt}>{item.readCount.toLocaleString()} {t('studioReader.reads')}</Text>
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
      case 'chapters':
        return (
          <View>
            {book.chapters.length === 0 ? (
              <View style={s.empty}>
                <Icon name="book-open" size={28} color="rgba(200,185,255,0.15)" />
                <Text style={s.emptyTxt}>{t('studioReader.noChapters')}</Text>
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
      case 'info':
        return (
          <View style={s.infoTab}>
            {/* Author row */}
            <TouchableOpacity
              style={s.authorRow}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/user/[userId]', params: { userId: book.authorUserId } } as never)}
            >
              {book.authorAvatarUri ? (
                <Image source={{ uri: book.authorAvatarUri }} style={s.authorAvatar} contentFit="cover" />
              ) : (
                <View style={[s.authorAvatar, s.authorAvatarFallback]}>
                  <Text style={s.authorAvatarInitial}>
                    {(book.authorName ?? 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.authorName}>{book.authorName}</Text>
                {!!book.authorUsername && (
                  <Text style={s.authorHandle}>@{book.authorUsername}</Text>
                )}
              </View>
              <Icon name="chevron-right" size={14} color="rgba(200,185,255,0.28)" />
            </TouchableOpacity>

            {/* Description */}
            {!!book.description && (
              <>
                <Text style={s.infoLabel}>{t('studioReader.about')}</Text>
                <Text style={s.descriptionTxt}>{book.description}</Text>
              </>
            )}

            {/* Details */}
            <Text style={s.infoLabel}>{t('studioReader.details')}</Text>
            <View style={s.detailGrid}>
              <View style={s.detailItem}>
                <Text style={s.detailLbl}>{t('studioReader.genre')}</Text>
                <Text style={s.detailVal}>{book.genre.join(', ') || '—'}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLbl}>{t('studioReader.language')}</Text>
                <Text style={s.detailVal}>{book.language}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLbl}>{t('studioReader.ageRating')}</Text>
                <Text style={s.detailVal}>{book.ageRating}</Text>
              </View>
              <View style={s.detailItem}>
                <Text style={s.detailLbl}>{t('studioReader.format')}</Text>
                <Text style={s.detailVal}>
                  {book.seriesType === 'oneshot' ? t('studioReader.oneShot') : book.seriesType === 'series' ? t('studioReader.series') : t('studioReader.standalone')}
                </Text>
              </View>
            </View>
          </View>
        );
      case 'world':
        return (
          <View style={s.placeholder}>
            <Icon name="globe" size={28} color="rgba(200,185,255,0.15)" />
            <Text style={s.placeholderTxt}>{t('studioReader.worldLoreSoon')}</Text>
            <Text style={s.placeholderSub}>{t('studioReader.worldLoreDescription')}</Text>
          </View>
        );
      case 'characters':
        return (
          <View style={s.placeholder}>
            <Icon name="users" size={28} color="rgba(200,185,255,0.15)" />
            <Text style={s.placeholderTxt}>{t('studioReader.charactersSoon')}</Text>
            <Text style={s.placeholderSub}>{t('studioReader.charactersDescription')}</Text>
          </View>
        );
      case 'gallery':
        return (
          <View style={s.placeholder}>
            <Icon name="image" size={28} color="rgba(200,185,255,0.15)" />
            <Text style={s.placeholderTxt}>{t('studioReader.fanArtSoon')}</Text>
            <Text style={s.placeholderSub}>{t('studioReader.fanArtDescription')}</Text>
          </View>
        );
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={[s.root, { backgroundColor: colors.background }]}><SkyLoadingOverlay message={t('studioReader.loadingStory')} /></View>;
  }

  if (!bookId) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={s.emptyTxt}>{t('studioReader.missingBookId')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backInline}>
          <Text style={{ color: ACCENT, fontSize: 14 }}>{t('studioReader.goBackLower')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!book) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Icon name="book" size={40} color="rgba(200,185,255,0.2)" />
        <Text style={s.emptyTxt}>{t('studioReader.bookNotFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backInline}>
          <Text style={{ color: ACCENT, fontSize: 14 }}>{t('studioReader.goBackLower')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverW = Math.min(isLandscape ? 190 : 150, Math.max(104, width * (isLandscape ? 0.24 : 0.34)));
  const coverH = coverW * 1.45;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Top nav */}
      <View style={[s.topNav, { paddingTop: webTopInset + 8 }]}>
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
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 40) + 96 }}
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
                <Text style={s.statLbl}>{t('studioReader.followers')}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statVal}>{book.chapters.length}</Text>
                <Text style={s.statLbl}>{t('studioReader.chapters')}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statVal}>{book.seriesType === 'oneshot' ? t('studioReader.oneShot') : book.seriesType === 'series' ? t('studioReader.series') : t('studioReader.standalone')}</Text>
                <Text style={s.statLbl}>{t('studioReader.type')}</Text>
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
                ? <SkyLoadingMark size={18} color={following ? ACCENT : '#fff'} />
                : <>
                    <Icon name={following ? 'check' : 'plus'} size={13} color={following ? ACCENT : '#fff'} />
                    <Text style={[s.followTxt, following && { color: ACCENT }]}>
                      {following ? t('studioReader.following') : t('studioReader.follow')}
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
          {TABS.map(tabItem => (
            <TouchableOpacity
              key={tabItem.id}
              style={[s.tabBtn, tab === tabItem.id && s.tabBtnActive]}
              onPress={() => setTab(tabItem.id)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === tabItem.id && s.tabTxtActive]}>{tabItem.id === 'chapters' ? t('studioReader.chapters') : tabItem.id === 'info' ? t('studioReader.info') : tabItem.id === 'world' ? t('studioReader.world') : tabItem.id === 'characters' ? t('studioReader.characters') : t('studioReader.gallery')}</Text>
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
            <Text style={s.readCtaTxt}>{t('studioReader.startReading')}</Text>
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
  heroMeta:        { flex: 1, minWidth: 0, gap: 8 },
  bookTitle:       { color: 'rgba(255,255,255,0.94)', fontSize: 18, fontWeight: '700', lineHeight: 24, flexShrink: 1 },
  bookSubtitle:    { color: 'rgba(255,255,255,0.40)', fontSize: 13, fontStyle: 'italic', flexShrink: 1 },
  chips:           { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  chip:            { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(139,112,200,0.12)', borderWidth: 1, borderColor: 'rgba(139,112,200,0.22)' },
  chipTxt:         { color: 'rgba(200,185,255,0.60)', fontSize: 10 },
  statsRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  statItem:        { alignItems: 'center', gap: 1, minWidth: 38, flexShrink: 1 },
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
  tabContent:      { paddingHorizontal: 0, minWidth: 0 },
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
  // Info tab
  infoTab:         { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  authorRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  authorAvatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(139,112,200,0.18)' },
  authorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  authorAvatarInitial: { color: ACCENT, fontSize: 18, fontWeight: '700' },
  authorName:      { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600' },
  authorHandle:    { color: 'rgba(200,185,255,0.40)', fontSize: 12, marginTop: 1 },
  infoLabel:       { color: 'rgba(200,185,255,0.30)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  descriptionTxt:  { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 21 },
  detailGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailItem:      { minWidth: '44%', gap: 2 },
  detailLbl:       { color: 'rgba(200,185,255,0.35)', fontSize: 10 },
  detailVal:       { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
});
