import React, { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
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
import { SkyLoadingOverlay } from '@/components/SkyLoading';

// ── Types ─────────────────────────────────────────────────────────────────────

type DashboardBook = {
  id: string;
  title: string;
  coverImageUri: string | null;
  updatedAt: string;
  chapterCount: number;
  totalReads: number;
};

type Dashboard = {
  totals: { reads: number; followers: number; comments: number };
  weekly: { newFollowers: number; newComments: number };
  topBooks: DashboardBook[];
  engagementTrend: Array<{ date: string; comments: number }>;
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, delta, accentColor,
}: {
  icon: string; label: string; value: number; delta?: number; accentColor: string;
}) {
  const hasDelta = delta !== undefined && delta > 0;
  return (
    <View style={[s.statCard, { borderColor: `${accentColor}20`, backgroundColor: `${accentColor}0A` }]}>
      <View style={[s.statIconWrap, { backgroundColor: `${accentColor}18` }]}>
        <Icon name={icon as never} size={16} color={accentColor} />
      </View>
      <Text style={s.statValue}>{value.toLocaleString()}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {hasDelta && (
        <View style={[s.deltaBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}>
          <Icon name="trending-up" size={9} color={accentColor} />
          <Text style={[s.deltaText, { color: accentColor }]}>+{delta} this week</Text>
        </View>
      )}
    </View>
  );
}

// ── Simple bar chart (no external dep) ───────────────────────────────────────

function BarChart({
  data, accentColor,
}: {
  data: Array<{ date: string; comments: number }>;
  accentColor: string;
}) {
  const maxVal = Math.max(...data.map(d => d.comments), 1);
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={s.chartOuter}>
      <View style={s.chartBars}>
        {data.map((d, i) => {
          const frac = d.comments / maxVal;
          const dayIdx = new Date(d.date + 'T12:00:00Z').getDay();
          return (
            <View key={d.date} style={s.chartBarCol}>
              <View style={s.chartBarTrack}>
                <View
                  style={[
                    s.chartBarFill,
                    {
                      height: `${Math.max(frac * 100, 4)}%`,
                      backgroundColor: frac > 0 ? accentColor : 'rgba(255,255,255,0.07)',
                    },
                  ]}
                />
              </View>
              <Text style={s.chartBarLabel}>{dayLabels[dayIdx]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Book card ─────────────────────────────────────────────────────────────────

function BookCard({ book, accentColor }: { book: DashboardBook; accentColor: string }) {
  const ago = getRelativeTime(book.updatedAt);
  return (
    <TouchableOpacity
      style={s.bookCard}
      activeOpacity={0.78}
      onPress={() => router.push({ pathname: '/book-details', params: { bookId: book.id } })}
    >
      <View style={[s.bookCover, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}20` }]}>
        {book.coverImageUri
          ? <Image source={{ uri: book.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <Icon name="book-open" size={18} color={`${accentColor}80`} />
        }
      </View>
      <View style={s.bookInfo}>
        <Text style={s.bookTitle} numberOfLines={1}>{book.title}</Text>
        <View style={s.bookMeta}>
          <Icon name="layers" size={10} color="rgba(200,185,255,0.38)" />
          <Text style={s.bookMetaTxt}>{book.chapterCount} chapter{book.chapterCount !== 1 ? 's' : ''}</Text>
          <View style={s.bookMetaDot} />
          <Icon name="eye" size={10} color="rgba(200,185,255,0.38)" />
          <Text style={s.bookMetaTxt}>{book.totalReads.toLocaleString()} reads</Text>
          <View style={s.bookMetaDot} />
          <Text style={s.bookMetaTxt}>{ago}</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={14} color="rgba(200,185,255,0.25)" />
    </TouchableOpacity>
  );
}

function getRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CreatorDashboardScreen() {
  const colors    = useColors();
  const insets    = useSafeAreaInsets();
  const apiFetch  = useApiFetch();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const accentColor = colors.primary ?? '#9B7FE8';

  async function loadDashboard(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Dashboard>('/creator/dashboard');
      if (data !== null) setDashboard(data);
    } catch {
      setError('Could not load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { void loadDashboard(); }, []));

  async function handleRefresh() {
    setRefreshing(true);
    await loadDashboard(true);
  }

  const topPad = insets.top + 10;

  if (loading && !dashboard) {
    return <View style={s.root}><SkyLoadingOverlay message="Gathering your studio insights…" /></View>;
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.78)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Creator Dashboard</Text>
        <TouchableOpacity
          style={[s.newBookBtn, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}
          onPress={() => router.push('/create-book')}
        >
          <Icon name="plus" size={13} color={accentColor} />
          <Text style={[s.newBookTxt, { color: accentColor }]}>New Book</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={accentColor} />
        }
      >
        {error && (
          <View style={s.errorBanner}>
            <Icon name="alert-circle" size={13} color="#E05C5C" />
            <Text style={s.errorTxt}>{error}</Text>
            <TouchableOpacity onPress={() => loadDashboard()}>
              <Text style={s.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats row ─────────────────────────────────────────────── */}
        {dashboard && (
          <>
            <Text style={s.sectionLabel}>ALL TIME</Text>
            <View style={s.statsRow}>
              <StatCard
                icon="eye"
                label="Reads"
                value={dashboard.totals.reads}
                accentColor="#78C8FF"
              />
              <StatCard
                icon="users"
                label="Followers"
                value={dashboard.totals.followers}
                delta={dashboard.weekly.newFollowers}
                accentColor="#C870A0"
              />
              <StatCard
                icon="message-circle"
                label="Comments"
                value={dashboard.totals.comments}
                delta={dashboard.weekly.newComments}
                accentColor="#9B7FE8"
              />
            </View>

            {/* ── Engagement chart ──────────────────────────────────── */}
            <View style={s.chartCard}>
              <View style={s.chartHeader}>
                <Icon name="bar-chart-2" size={13} color={accentColor} />
                <Text style={s.chartTitle}>Weekly Engagement</Text>
                <Text style={s.chartSub}>Comments per day</Text>
              </View>
              <BarChart data={dashboard.engagementTrend} accentColor={accentColor} />
            </View>

            {/* ── My Books ──────────────────────────────────────────── */}
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>MY BOOKS</Text>
              <TouchableOpacity onPress={() => router.push('/my-books' as any)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Text style={[s.seeAllTxt, { color: accentColor }]}>See all</Text>
              </TouchableOpacity>
            </View>

            {dashboard.topBooks.length === 0 ? (
              <View style={s.emptyBooks}>
                <Icon name="book-open" size={28} color="rgba(200,185,255,0.20)" />
                <Text style={s.emptyBooksTitle}>No books yet</Text>
                <Text style={s.emptyBooksSub}>Create your first book to start tracking reads and followers.</Text>
                <TouchableOpacity
                  style={[s.createFirstBookBtn, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}
                  onPress={() => router.push('/create-book')}
                >
                  <Icon name="plus" size={13} color={accentColor} />
                  <Text style={[s.createFirstBookTxt, { color: accentColor }]}>Create a Book</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.booksList}>
                {dashboard.topBooks.map(book => (
                  <BookCard key={book.id} book={book} accentColor={accentColor} />
                ))}
              </View>
            )}

            {/* ── Quick actions ─────────────────────────────────────── */}
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>QUICK ACTIONS</Text>
            <View style={s.quickActions}>
              <TouchableOpacity
                style={[s.quickBtn, { borderColor: `${accentColor}25`, backgroundColor: `${accentColor}0A` }]}
                onPress={() => router.push('/create-book')}
                activeOpacity={0.78}
              >
                <View style={[s.quickIconWrap, { backgroundColor: `${accentColor}18` }]}>
                  <Icon name="book" size={18} color={accentColor} />
                </View>
                <Text style={s.quickBtnTitle}>New Book</Text>
                <Text style={s.quickBtnSub}>Start a new series or standalone</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.quickBtn, { borderColor: 'rgba(120,200,160,0.25)', backgroundColor: 'rgba(120,200,160,0.06)' }]}
                onPress={() => router.push('/my-books' as any)}
                activeOpacity={0.78}
              >
                <View style={[s.quickIconWrap, { backgroundColor: 'rgba(120,200,160,0.15)' }]}>
                  <Icon name="layers" size={18} color="#78C8A0" />
                </View>
                <Text style={s.quickBtnTitle}>My Books</Text>
                <Text style={s.quickBtnSub}>Manage chapters and drafts</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#04030C' },
  center:{ alignItems: 'center', justifyContent: 'center' },

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
  newBookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
  },
  newBookTxt: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel:{ fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(200,185,255,0.30)', marginBottom: 10 },
  seeAllTxt:   { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    padding: 14, alignItems: 'center', gap: 5,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statValue:    { fontSize: 22, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.95)', letterSpacing: -0.8 },
  statLabel:    { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.42)', textTransform: 'uppercase', letterSpacing: 0.8 },
  deltaBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, borderWidth: 1, marginTop: 2 },
  deltaText:    { fontSize: 9, fontFamily: 'Satoshi-Bold' },

  // Bar chart
  chartCard: {
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(200,185,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 16, marginBottom: 24,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  chartTitle:  { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.80)', flex: 1 },
  chartSub:    { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.35)' },
  chartOuter:  { height: 80 },
  chartBars:   { flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 4 },
  chartBarCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  chartBarTrack:{ flex: 1, width: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', borderRadius: 4, minHeight: 3 },
  chartBarLabel:{ fontSize: 9, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.30)' },

  // Books list
  booksList: { gap: 8, marginBottom: 8 },
  bookCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.07)',
  },
  bookCover: {
    width: 48, height: 64, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  bookInfo:    { flex: 1, gap: 5 },
  bookTitle:   { fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.90)' },
  bookMeta:    { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  bookMetaTxt: { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.38)' },
  bookMetaDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(200,185,255,0.20)' },

  // Empty books
  emptyBooks: {
    alignItems: 'center', gap: 8, paddingVertical: 32,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(200,185,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    marginBottom: 8,
  },
  emptyBooksTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.60)' },
  emptyBooksSub:   { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.35)', textAlign: 'center', paddingHorizontal: 24 },
  createFirstBookBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 16, borderWidth: 1, marginTop: 4,
  },
  createFirstBookTxt: { fontSize: 13, fontFamily: 'Satoshi-Bold' },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quickBtn: {
    flex: 1, borderRadius: 20, borderWidth: 1,
    padding: 16, gap: 8,
  },
  quickIconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickBtnTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.90)' },
  quickBtnSub:   { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.40)', lineHeight: 15 },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(224,92,92,0.10)', borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.25)', borderRadius: 14,
    padding: 12, marginBottom: 14,
  },
  errorTxt:  { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: '#E05C5C' },
  retryTxt:  { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#C8A0E8' },
});
