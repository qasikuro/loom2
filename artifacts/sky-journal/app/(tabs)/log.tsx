import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Animated,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodBadge } from '@/components/MoodBadge';
import { useApp, type JournalEntry, type JournalEntryType } from '@/context/AppContext';
import { SHADOW } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from 'react-i18next';

// ── Helpers ───────────────────────────────────────────────────────────────────

type FilterKey = 'all' | JournalEntryType;
type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function relativeTime(dateStr: string, t: TFunc): string {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = now.getTime() - d.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  const weeks = Math.floor(days / 7);
  if (mins  < 1)  return t('common.justNow');
  if (mins  < 60) return t('common.minsAgo', { n: mins });
  if (hours < 24) return t('common.hoursAgo', { n: hours });
  if (days  === 1) return t('common.yesterday');
  if (days  < 7)  return t('common.daysAgo', { n: days });
  if (weeks === 1) return t('common.weekAgo');
  return t('common.weeksAgo', { n: weeks });
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS   = ['S','M','T','W','T','F','S'];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatHeader(dk: string, t: TFunc): string {
  const today = toDateKey(new Date());
  const yest  = (() => { const d = new Date(); d.setDate(d.getDate()-1); return toDateKey(d); })();
  if (dk === today) return t('common.today');
  if (dk === yest)  return t('common.yesterday');
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupByDate(entries: JournalEntry[], t: TFunc) {
  const map: Record<string, JournalEntry[]> = {};
  for (const e of entries) {
    const k = toDateKey(new Date(e.date));
    (map[k] ??= []).push(e);
  }
  return Object.entries(map)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, label: formatHeader(date, t), data }));
}

// ── Avatar config per entry type ───────────────────────────────────────────────

const AVATAR_CFG = {
  diary:  { bg: '#6B5B95', icon: 'feather' as const,   labelKey: 'log.diaryLabel'   },
  friend: { bg: '#4A6898', icon: 'users'   as const,   labelKey: 'log.friendLabel'  },
  moment: { bg: '#3A2E68', icon: 'moon'    as const,   labelKey: 'log.momentLabel'  },
};

// ── Timeline entry card ───────────────────────────────────────────────────────

function TimelineCard({ entry, onDelete }: { entry: JournalEntry; onDelete: () => void }) {
  const colors = useColors();
  const cfg    = AVATAR_CFG[entry.type];
  const { t }  = useTranslation();
  const [confirming, setConfirming] = React.useState(false);
  const confirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTrash() {
    if (confirming) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onDelete();
    } else {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
    }
  }

  const displayName =
    entry.type === 'friend' ? (entry.friendName ?? 'Someone') : t(cfg.labelKey);

  const initial =
    entry.type === 'friend'
      ? (entry.friendName?.[0] ?? '?').toUpperCase()
      : null;

  // First line of text as the snippet
  const snippet = entry.text.split('\n')[0].trim().slice(0, 120) || entry.text.slice(0, 120);

  return (
    <TouchableOpacity
      style={[tc.card, SHADOW.sm, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.92}
      onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/journal-entry', params: { id: entry.id } }); }}
    >
      {/* ─ Top row: avatar + name + time + star ─ */}
      <View style={tc.topRow}>
        {/* Avatar */}
        <View style={[tc.avatar, { backgroundColor: cfg.bg }]}>
          {initial
            ? <Text style={tc.avatarInitial}>{initial}</Text>
            : <Icon name={cfg.icon} size={17} color="rgba(255,255,255,0.88)" />
          }
        </View>

        {/* Name + time */}
        <View style={tc.nameCol}>
          <Text style={[tc.nameText, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[tc.timeText, { color: colors.mutedForeground }]}>
            {relativeTime(entry.date, t)}
          </Text>
        </View>

        {/* Star bookmark */}
        <Icon name="star" size={16} color="#C8A84B" />
      </View>

      {/* ─ Content: snippet + optional thumbnail ─ */}
      <View style={tc.contentRow}>
        <Text style={[tc.snippet, { color: colors.mutedForeground }]} numberOfLines={3}>
          {snippet}
        </Text>
        {entry.imageUri && (
          <Image
            source={{ uri: entry.imageUri }}
            style={tc.thumbnail}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
      </View>

      {/* ─ Footer: mood + delete ─ */}
      <View style={tc.footer}>
        <MoodBadge mood={entry.mood} size="sm" />
        {entry.type === 'friend' && !!entry.friendName && (
          <View style={[tc.typePill, { backgroundColor:'rgba(74,104,152,0.22)', borderColor:'rgba(74,104,152,0.38)' }]}>
            <Icon name="users" size={10} color="#7AAAE0" />
            <Text style={[tc.typePillText, { color:'#7AAAE0' }]}>{t('log.withFriend', { name: entry.friendName })}</Text>
          </View>
        )}
        {entry.type === 'moment' && (
          <View style={[tc.typePill, { backgroundColor:'rgba(88,72,168,0.22)', borderColor:'rgba(88,72,168,0.38)' }]}>
            <Icon name="moon" size={10} color="#B0A0E0" />
            <Text style={[tc.typePillText, { color:'#B0A0E0' }]}>{t('log.moment')}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[tc.deleteBtn, { marginLeft: 'auto', backgroundColor: confirming ? '#E04455' : colors.muted, minWidth: confirming ? 68 : 28 }]}
          onPress={handleTrash}
          hitSlop={{ top:8, right:8, bottom:8, left:8 }}
          activeOpacity={0.75}
        >
          {confirming
            ? <Text style={tc.deleteBtnText}>{t('common.deleteConfirm')}</Text>
            : <Icon name="trash-2" size={12} color={colors.mutedForeground} />
          }
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const tc = StyleSheet.create({
  card: { borderRadius:16, borderWidth:1, padding:15, gap:10, marginBottom:10 },
  topRow: { flexDirection:'row', alignItems:'center', gap:12 },
  avatar: {
    width:44, height:44, borderRadius:14,
    alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  avatarInitial: { fontSize:18, fontFamily:'Satoshi-Bold', color:'#fff' },
  nameCol: { flex:1 },
  nameText: { fontSize:14, fontFamily:'Satoshi-Bold', letterSpacing:-0.2 },
  timeText: { fontSize:11, fontFamily:'Satoshi-Regular', marginTop:2 },
  contentRow: { flexDirection:'row', gap:12, alignItems:'flex-start' },
  snippet: { flex:1, fontSize:13, fontFamily:'Satoshi-Regular', lineHeight:20, fontStyle:'italic' },
  thumbnail: { width:64, height:64, borderRadius:12, flexShrink:0 },
  footer: { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' },
  typePill: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:10, borderWidth:1 },
  typePillText: { fontSize:10, fontFamily:'Satoshi-Medium' },
  deleteBtn: { height:28, paddingHorizontal:8, borderRadius:9, alignItems:'center', justifyContent:'center' },
  deleteBtnText: { color:'#fff', fontSize:11, fontFamily:'Satoshi-Bold' },
});

// ── Mini calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({
  entries, selectedDate, onSelectDate,
}: {
  entries: JournalEntry[];
  selectedDate: string | null;
  onSelectDate: (k: string) => void;
}) {
  const colors = useColors();
  const today  = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const entryDates = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => s.add(toDateKey(new Date(e.date))));
    return s;
  }, [entries]);

  function prevMonth() { month===0 ? (setYear(y=>y-1), setMonth(11)) : setMonth(m=>m-1); }
  function nextMonth() { month===11? (setYear(y=>y+1), setMonth(0))  : setMonth(m=>m+1); }

  const firstDOW = new Date(year, month, 1).getDay();
  const daysInMo = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = Array(firstDOW).fill(null);
  for (let d=1; d<=daysInMo; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={[cal.wrap, SHADOW.xs, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={cal.monthRow}>
        <TouchableOpacity style={[cal.navBtn, { backgroundColor: colors.muted }]} onPress={prevMonth}>
          <Icon name="chevron-left" size={15} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[cal.monthText, { color: colors.foreground }]}>
          {MONTH_FULL[month]} {year}
        </Text>
        <TouchableOpacity style={[cal.navBtn, { backgroundColor: colors.muted }]} onPress={nextMonth}>
          <Icon name="chevron-right" size={15} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={cal.weekRow}>
        {WEEK_DAYS.map((d,i) => (
          <Text key={i} style={[cal.weekDay, { color: colors.mutedForeground }]}>{d}</Text>
        ))}
      </View>

      <View style={cal.grid}>
        {cells.map((cell, i) => {
          if (cell === null) return <View key={`e${i}`} style={cal.cell} />;
          const dk  = `${year}-${String(month+1).padStart(2,'0')}-${String(cell).padStart(2,'0')}`;
          const has = entryDates.has(dk);
          const sel = dk === selectedDate;
          const now = cell===today.getDate() && month===today.getMonth() && year===today.getFullYear();
          return (
            <TouchableOpacity
              key={`d${cell}`}
              style={[
                cal.cell,
                sel && { backgroundColor: colors.primary, borderRadius:9 },
                now && !sel && { borderRadius:9, borderWidth:1.5, borderColor: colors.primary },
              ]}
              onPress={() => has && onSelectDate(dk)}
              activeOpacity={has ? 0.72 : 1}
            >
              <Text style={[
                cal.cellText,
                { color: sel ? '#fff' : now ? colors.primary : has ? colors.foreground : colors.mutedForeground },
                !has && { opacity: 0.38 },
              ]}>
                {cell}
              </Text>
              {has && !sel && <View style={[cal.dot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  wrap: { marginHorizontal:16, marginBottom:14, borderRadius:14, borderWidth:1, padding:14 },
  monthRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  navBtn: { width:28, height:28, borderRadius:9, alignItems:'center', justifyContent:'center' },
  monthText: { fontSize:14, fontFamily:'Satoshi-Bold' },
  weekRow: { flexDirection:'row', marginBottom:6 },
  weekDay: { flex:1, textAlign:'center', fontSize:10, fontFamily:'Satoshi-Bold', letterSpacing:0.6, textTransform:'uppercase' },
  grid: { flexDirection:'row', flexWrap:'wrap' },
  cell: { width:'14.28%', aspectRatio:1, alignItems:'center', justifyContent:'center', position:'relative' },
  cellText: { fontSize:13, fontFamily:'Satoshi-Regular' },
  dot: { position:'absolute', bottom:2, width:4, height:4, borderRadius:2 },
});

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTER_ICONS: Record<FilterKey, { name: 'book-open' | 'feather' | 'users' | 'moon'; color: string }> = {
  all:    { name: 'book-open', color: '#9A8EB4' },
  diary:  { name: 'feather',   color: '#6B5B95' },
  friend: { name: 'users',     color: '#4A6898' },
  moment: { name: 'moon',      color: '#5848A8' },
};

const FILTERS: { key: FilterKey }[] = [
  { key: 'all'    },
  { key: 'diary'  },
  { key: 'friend' },
  { key: 'moment' },
];

const FILTER_LABEL_KEYS: Record<FilterKey, string> = {
  all:    'log.allFilter',
  diary:  'log.diary',
  friend: 'log.friends',
  moment: 'log.moments',
};

// ── Compose FAB ───────────────────────────────────────────────────────────────

const COMPOSE_TYPES = [
  { type: 'moment',  labelKey: 'log.composeMoment', icon: 'moon'    as const, color: '#5848A8', bg: 'rgba(88,72,168,0.14)'  },
  { type: 'friend',  labelKey: 'log.composeFriend', icon: 'users'   as const, color: '#4A6898', bg: 'rgba(74,104,152,0.14)' },
  { type: 'diary',   labelKey: 'log.composeDiary',  icon: 'feather' as const, color: '#6B5B95', bg: 'rgba(107,91,149,0.14)' },
] as const;

function ComposeFAB({ bottomPad }: { bottomPad: number }) {
  const colors     = useColors();
  const { t }      = useTranslation();
  const [open, setOpen] = useState(false);
  const anim       = useRef(new Animated.Value(0)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;

  // Gentle float — FAB hovers up and down like a sky lantern
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const floatY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = open ? 0 : 1;
    setOpen(!open);
    Animated.spring(anim, { toValue, useNativeDriver: true, tension: 60, friction: 8 }).start();
  }

  function handlePick(type: 'diary' | 'friend' | 'moment') {
    setOpen(false);
    anim.setValue(0);
    Haptics.selectionAsync();
    router.push({ pathname: '/create-journal-entry', params: { type } });
  }

  const rotation = anim.interpolate({ inputRange: [0,1], outputRange: ['0deg','45deg'] });

  return (
    <View style={[fab.wrap, { bottom: bottomPad + 16 }, { pointerEvents: 'box-none' }]}>
      {/* Mini action sheet */}
      {COMPOSE_TYPES.map((item, idx) => {
        const translateY = anim.interpolate({ inputRange: [0,1], outputRange: [0, -(70 + idx * 58)] });
        const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
        return (
          <Animated.View key={item.type} style={[fab.actionRow, { opacity, transform: [{ translateY }] }]}>
            <View style={[fab.actionLabel, { backgroundColor: 'rgba(26,22,48,0.88)', borderWidth:1, borderColor:'rgba(200,184,232,0.12)' }]}>
              <Text style={fab.actionLabelText}>{t(item.labelKey)}</Text>
            </View>
            <TouchableOpacity
              style={[fab.actionBtn, { backgroundColor: item.bg, borderColor: `${item.color}40` }]}
              onPress={() => handlePick(item.type)}
              activeOpacity={0.82}
            >
              <Icon name={item.icon} size={19} color={item.color} />
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main FAB — floats like a sky lantern */}
      <Animated.View style={{ transform: [{ translateY: floatY }] }}>
        <TouchableOpacity style={[fab.main, SHADOW.md, { backgroundColor: colors.primary }]} onPress={toggle} activeOpacity={0.88}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Icon name="edit-2" size={20} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const fab = StyleSheet.create({
  wrap:       { position:'absolute', right:20, alignItems:'flex-end' },
  main:       { width:52, height:52, borderRadius:26, alignItems:'center', justifyContent:'center' },
  actionRow:  { position:'absolute', right:0, flexDirection:'row', alignItems:'center', gap:10 },
  actionBtn:  { width:48, height:48, borderRadius:24, borderWidth:1, alignItems:'center', justifyContent:'center' },
  actionLabel:{ paddingHorizontal:10, paddingVertical:5, borderRadius:12 },
  actionLabelText: { color:'#fff', fontSize:12, fontFamily:'Satoshi-Medium' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();
  const { journalEntries, deleteJournalEntry } = useApp();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  // FAB sits at bottom: insets.bottom + 96, height 56 → need insets.bottom + 172 clearance
  const bottomPad = Platform.OS === 'web' ? 180 : insets.bottom + 180;

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showSearch,   setShowSearch]   = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const sectionY  = useRef<Record<string, number>>({});

  const filtered = useMemo(() => journalEntries.filter(e => {
    const typeOk = activeFilter === 'all' || e.type === activeFilter;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return typeOk;
    return typeOk && (
      e.text.toLowerCase().includes(q) ||
      e.mood.toLowerCase().includes(q) ||
      (e.friendName ?? '').toLowerCase().includes(q)
    );
  }), [journalEntries, activeFilter, searchQuery]);

  const sections = useMemo(() => groupByDate(filtered, t), [filtered, t]);

  const counts = {
    all:    journalEntries.length,
    diary:  journalEntries.filter(e => e.type==='diary').length,
    friend: journalEntries.filter(e => e.type==='friend').length,
    moment: journalEntries.filter(e => e.type==='moment').length,
  };

  function handleCalDate(dk: string) {
    setSelectedDate(dk);
    const y = sectionY.current[dk];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }
  }

  function handleDelete(id: string) {
    deleteJournalEntry(id);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Vivid gradient header ─────────────────────────────────── */}
      <LinearGradient
        colors={['#0A0818', '#170A42', '#2C1465']}
        style={[styles.headerGrad, { paddingTop: topPad }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        {/* Top row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{t('profile.journal')}</Text>
            <View style={styles.privateBadge}>
              <Icon name="lock" size={10} color="rgba(200,184,232,0.7)" />
              <Text style={styles.privateBadgeText}>{t('common.private')}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.hdrBtn, showCalendar && styles.hdrBtnActive]}
              onPress={() => setShowCalendar(v => !v)}
            >
              <Icon name="calendar" size={16} color={showCalendar ? '#fff' : 'rgba(200,184,232,0.7)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hdrBtn, showSearch && styles.hdrBtnActive]}
              onPress={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
            >
              <Icon name={showSearch ? 'x' : 'search'} size={16} color={showSearch ? '#fff' : 'rgba(200,184,232,0.7)'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter tabs — white pill style inside dark header */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map(f => {
            const isActive = activeFilter === f.key;
            const count    = counts[f.key];
            const ic       = FILTER_ICONS[f.key];
            return (
              <TouchableOpacity key={f.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => { setActiveFilter(f.key); Haptics.selectionAsync(); }}
              >
                <Icon
                  name={ic.name}
                  size={12}
                  color={isActive ? ic.color : 'rgba(200,184,232,0.6)'}
                />
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {t(FILTER_LABEL_KEYS[f.key])}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                    <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      {showSearch && (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search entries, friends, moods..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Calendar ───────────────────────────────────────────────── */}
      {showCalendar && (
        <View style={{ paddingTop: 14 }}>
          <MiniCalendar
            entries={journalEntries}
            selectedDate={selectedDate}
            onSelectDate={handleCalDate}
          />
        </View>
      )}

      {/* ── Search hint ────────────────────────────────────────────── */}
      {!!searchQuery.trim() && (
        <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>
          {filtered.length === 0
            ? 'No results'
            : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${searchQuery}"`}
        </Text>
      )}

      {/* ── Timeline list ──────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.timelineContent, { paddingBottom: bottomPad }]}
      >
        {sections.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor:`${colors.primary}10` }]}>
              <Icon
                name={FILTER_ICONS[activeFilter].name}
                size={32}
                color={FILTER_ICONS[activeFilter].color}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {searchQuery.trim() ? `No results for "${searchQuery}"` : 'Nothing here yet'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {searchQuery.trim()
                ? 'Try a different word or mood.'
                : 'This is your private space. Start writing ✦'}
            </Text>
            {!searchQuery.trim() && (
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => { Haptics.selectionAsync(); router.push({ pathname: '/create-journal-entry', params: { type: 'diary' } }); }}
                activeOpacity={0.85}
              >
                <Icon name="feather" size={15} color="#fff" />
                <Text style={styles.emptyBtnText}>Write First Entry</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          sections.map((section, si) => (
            <View
              key={section.date}
              onLayout={e => { sectionY.current[section.date] = e.nativeEvent.layout.y; }}
            >
              <View style={styles.timelineRow}>
                {/* Left dot + line */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.dot, {
                    backgroundColor: section.date === selectedDate ? colors.primary : '#fff',
                    borderColor:     section.date === selectedDate ? colors.primary : `${colors.primary}40`,
                  }]} />
                  {si < sections.length - 1 && (
                    <View style={[styles.line, { backgroundColor: `${colors.primary}18` }]} />
                  )}
                </View>

                {/* Right content */}
                <View style={styles.timelineRight}>
                  <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
                    {section.label}
                  </Text>
                  {section.data.map(entry => (
                    <TimelineCard
                      key={entry.id}
                      entry={entry}
                      onDelete={() => handleDelete(entry.id)}
                    />
                  ))}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── Compose FAB ───────────────────────────────────────────── */}
      <ComposeFAB bottomPad={Platform.OS === 'web' ? 100 : insets.bottom + 80} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1 },

  // Header (dark)
  headerGrad: { paddingBottom: 0 },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:12, paddingBottom:8 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:10 },
  title: { fontSize:20, fontFamily:'Satoshi-Bold', letterSpacing:-0.3, color:'rgba(235,228,255,0.97)' },
  privateBadge: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:10, backgroundColor:'rgba(255,255,255,0.06)', borderWidth:1, borderColor:'rgba(200,184,232,0.12)' },
  privateBadgeText: { fontSize:10, fontFamily:'Satoshi-Medium', color:'rgba(200,184,232,0.60)' },
  headerRight: { flexDirection:'row', gap:6 },
  hdrBtn: { width:36, height:36, borderRadius:12, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.07)', borderWidth:1, borderColor:'rgba(200,184,232,0.10)' },
  hdrBtnActive: { backgroundColor:'rgba(120,86,255,0.22)', borderColor:'rgba(120,86,255,0.35)' },

  // Filter tabs inside dark header
  filtersScroll: { maxHeight:44 },
  filtersRow: { flexDirection:'row', gap:7, paddingHorizontal:16, paddingVertical:5, paddingBottom:14 },
  filterTab: {
    flexDirection:'row', alignItems:'center', gap:5,
    paddingHorizontal:11, paddingVertical:6, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.12)',
  },
  filterTabActive: { backgroundColor:'rgba(120,86,255,0.16)', borderColor:'rgba(120,86,255,0.30)' },
  filterLabel: { fontSize:12, fontFamily:'Satoshi-Medium', color:'rgba(200,184,232,0.55)' },
  filterLabelActive: { color:'rgba(235,225,255,0.95)', fontFamily:'Satoshi-Bold' },
  filterCount: { paddingHorizontal:6, paddingVertical:2, borderRadius:9, backgroundColor:'rgba(255,255,255,0.10)', minWidth:18, alignItems:'center' },
  filterCountActive: { backgroundColor:'rgba(120,86,255,0.28)' },
  filterCountText: { fontSize:10, fontFamily:'Satoshi-Bold', color:'rgba(200,184,232,0.75)' },
  filterCountTextActive: { color:'#fff' },

  // Search
  searchBar: { flexDirection:'row', alignItems:'center', gap:10, borderWidth:1, borderRadius:14, paddingHorizontal:14, paddingVertical:11, marginHorizontal:16, marginTop:0, borderColor:'rgba(255,255,255,0.08)' },
  searchInput: { flex:1, fontSize:13, fontFamily:'Satoshi-Regular' },
  searchHint: { fontSize:12, fontFamily:'Satoshi-Regular', fontStyle:'italic', marginHorizontal:16, marginBottom:6 },

  // Timeline
  timelineContent: { paddingHorizontal:16, paddingTop:16 },
  timelineRow: { flexDirection:'row', gap:14 },
  timelineLeft: { width:22, alignItems:'center', paddingTop:4 },
  dot: { width:12, height:12, borderRadius:6, borderWidth:1.5, zIndex:1 },
  line: { flex:1, width:2, marginTop:6, marginBottom:-6, borderRadius:1 },
  timelineRight: { flex:1, paddingBottom:24 },
  dateLabel: { fontSize:11, fontFamily:'Satoshi-Bold', marginBottom:10, marginTop:2, letterSpacing:1.4, textTransform:'uppercase' },

  // Empty
  empty: { flex:1, alignItems:'center', justifyContent:'center', paddingTop:60, paddingHorizontal:36, gap:14 },
  emptyIcon: { width:64, height:64, borderRadius:20, alignItems:'center', justifyContent:'center', marginBottom:4 },
  emptyTitle: { fontSize:18, fontFamily:'Satoshi-Bold', textAlign:'center', letterSpacing:-0.3 },
  emptyText: { fontSize:13, fontFamily:'Satoshi-Regular', textAlign:'center', lineHeight:20, fontStyle:'italic' },
  emptyBtn: { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:24, height:48, borderRadius:24, marginTop:4 },
  emptyBtnText: { fontSize:14, fontFamily:'Satoshi-Bold', color:'#fff' },
});
