import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

type FilterKey = 'all' | JournalEntryType;

function relativeTime(dateStr: string): string {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = now.getTime() - d.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  const weeks = Math.floor(days / 7);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  === 1) return 'yesterday';
  if (days  < 7)  return `${days} days ago`;
  if (weeks === 1) return '1 week ago';
  return `${weeks} weeks ago`;
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS   = ['S','M','T','W','T','F','S'];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatHeader(dk: string) {
  const today = toDateKey(new Date());
  const yest  = (() => { const d = new Date(); d.setDate(d.getDate()-1); return toDateKey(d); })();
  if (dk === today) return 'Today';
  if (dk === yest)  return 'Yesterday';
  const [y,m,d] = dk.split('-').map(Number);
  return `${MONTH_SHORT[m-1]} ${d}, ${y}`;
}

function groupByDate(entries: JournalEntry[]) {
  const map: Record<string, JournalEntry[]> = {};
  for (const e of entries) {
    const k = toDateKey(new Date(e.date));
    (map[k] ??= []).push(e);
  }
  return Object.entries(map)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([date, data]) => ({ date, label: formatHeader(date), data }));
}

// ── Avatar config per entry type ───────────────────────────────────────────────

const AVATAR_CFG = {
  diary:  { bg: '#6B5B95', icon: 'feather' as const,   label: 'Diary Entry'   },
  friend: { bg: '#4A6898', icon: 'users'   as const,   label: 'Friend'        },
  moment: { bg: '#3A2E68', icon: 'moon'    as const,   label: 'Quick Moment'  },
};

// ── Timeline entry card ───────────────────────────────────────────────────────

function TimelineCard({ entry, onDelete }: { entry: JournalEntry; onDelete: () => void }) {
  const colors = useColors();
  const cfg    = AVATAR_CFG[entry.type];

  const displayName =
    entry.type === 'friend' ? (entry.friendName ?? 'Someone') : cfg.label;

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
    >
      {/* ─ Top row: avatar + name + time + star ─ */}
      <View style={tc.topRow}>
        {/* Avatar */}
        <View style={[tc.avatar, { backgroundColor: cfg.bg }]}>
          {initial
            ? <Text style={tc.avatarInitial}>{initial}</Text>
            : <Feather name={cfg.icon} size={17} color="rgba(255,255,255,0.88)" />
          }
        </View>

        {/* Name + time */}
        <View style={tc.nameCol}>
          <Text style={[tc.nameText, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[tc.timeText, { color: colors.mutedForeground }]}>
            {relativeTime(entry.date)}
          </Text>
        </View>

        {/* Star bookmark */}
        <Feather name="star" size={16} color="#C8A84B" />
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
            resizeMode="cover"
          />
        )}
      </View>

      {/* ─ Footer: mood + delete ─ */}
      <View style={tc.footer}>
        <MoodBadge mood={entry.mood} size="sm" />
        {entry.type === 'friend' && !!entry.friendName && (
          <View style={[tc.typePill, { backgroundColor:'rgba(74,104,152,0.1)', borderColor:'rgba(74,104,152,0.22)' }]}>
            <Feather name="users" size={10} color="#4A6898" />
            <Text style={[tc.typePillText, { color:'#4A6898' }]}>With {entry.friendName}</Text>
          </View>
        )}
        {entry.type === 'moment' && (
          <View style={[tc.typePill, { backgroundColor:'rgba(88,72,168,0.1)', borderColor:'rgba(88,72,168,0.22)' }]}>
            <Feather name="moon" size={10} color="#5848A8" />
            <Text style={[tc.typePillText, { color:'#5848A8' }]}>Moment</Text>
          </View>
        )}
        <TouchableOpacity
          style={[tc.deleteBtn, { backgroundColor: colors.muted, marginLeft: 'auto' }]}
          onPress={onDelete}
          hitSlop={{ top:8, right:8, bottom:8, left:8 }}
        >
          <Feather name="trash-2" size={12} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const tc = StyleSheet.create({
  card: { borderRadius:16, borderWidth:1, padding:14, gap:10, marginBottom:10 },
  topRow: { flexDirection:'row', alignItems:'center', gap:11 },
  avatar: {
    width:46, height:46, borderRadius:23,
    alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  avatarInitial: { fontSize:17, fontFamily:'Inter_700Bold', color:'#fff' },
  nameCol: { flex:1 },
  nameText: { fontSize:15, fontFamily:'Inter_600SemiBold', letterSpacing:-0.1 },
  timeText: { fontSize:11, fontFamily:'Inter_400Regular', marginTop:1 },
  contentRow: { flexDirection:'row', gap:12, alignItems:'flex-start' },
  snippet: { flex:1, fontSize:13, fontFamily:'Inter_400Regular', lineHeight:20, fontStyle:'italic' },
  thumbnail: { width:64, height:64, borderRadius:10, flexShrink:0 },
  footer: { flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' },
  typePill: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:4, borderRadius:10, borderWidth:1 },
  typePillText: { fontSize:10, fontFamily:'Inter_500Medium' },
  deleteBtn: { width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center' },
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
          <Feather name="chevron-left" size={15} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[cal.monthText, { color: colors.foreground }]}>
          {MONTH_FULL[month]} {year}
        </Text>
        <TouchableOpacity style={[cal.navBtn, { backgroundColor: colors.muted }]} onPress={nextMonth}>
          <Feather name="chevron-right" size={15} color={colors.primary} />
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
  wrap: { marginHorizontal:16, marginBottom:14, borderRadius:16, borderWidth:1, padding:14 },
  monthRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  navBtn: { width:30, height:30, borderRadius:9, alignItems:'center', justifyContent:'center' },
  monthText: { fontSize:14, fontFamily:'Inter_600SemiBold' },
  weekRow: { flexDirection:'row', marginBottom:6 },
  weekDay: { flex:1, textAlign:'center', fontSize:10, fontFamily:'Inter_600SemiBold', letterSpacing:0.4, textTransform:'uppercase' },
  grid: { flexDirection:'row', flexWrap:'wrap' },
  cell: { width:'14.28%', aspectRatio:1, alignItems:'center', justifyContent:'center', position:'relative' },
  cellText: { fontSize:13, fontFamily:'Inter_400Regular' },
  dot: { position:'absolute', bottom:2, width:4, height:4, borderRadius:2 },
});

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string; emoji: string | null }[] = [
  { key:'all',    label:'All',     emoji:null },
  { key:'diary',  label:'Diary',   emoji:'📓' },
  { key:'friend', label:'Friends', emoji:'🤝' },
  { key:'moment', label:'Moments', emoji:'🌙' },
];

// ── Compose FAB ───────────────────────────────────────────────────────────────

const COMPOSE_TYPES = [
  { type: 'moment',  label: 'Moment',   icon: 'moon'    as const, color: '#5848A8', bg: 'rgba(88,72,168,0.14)'  },
  { type: 'friend',  label: 'Friend',   icon: 'users'   as const, color: '#4A6898', bg: 'rgba(74,104,152,0.14)' },
  { type: 'diary',   label: 'Diary',    icon: 'feather' as const, color: '#6B5B95', bg: 'rgba(107,91,149,0.14)' },
] as const;

function ComposeFAB({ bottomPad }: { bottomPad: number }) {
  const colors   = useColors();
  const [open, setOpen] = useState(false);
  const anim    = useRef(new Animated.Value(0)).current;

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
    <View style={[fab.wrap, { bottom: bottomPad + 16 }]} pointerEvents="box-none">
      {/* Mini action sheet */}
      {COMPOSE_TYPES.map((item, idx) => {
        const translateY = anim.interpolate({ inputRange: [0,1], outputRange: [0, -(70 + idx * 58)] });
        const opacity    = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
        return (
          <Animated.View key={item.type} style={[fab.actionRow, { opacity, transform: [{ translateY }] }]}>
            <View style={[fab.actionLabel, { backgroundColor: 'rgba(26,22,48,0.88)' }]}>
              <Text style={fab.actionLabelText}>{item.label}</Text>
            </View>
            <TouchableOpacity
              style={[fab.actionBtn, { backgroundColor: item.bg, borderColor: `${item.color}40` }]}
              onPress={() => handlePick(item.type)}
              activeOpacity={0.82}
            >
              <Feather name={item.icon} size={19} color={item.color} />
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <TouchableOpacity style={[fab.main, SHADOW.md, { backgroundColor: colors.primary }]} onPress={toggle} activeOpacity={0.88}>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Feather name="edit-2" size={20} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const fab = StyleSheet.create({
  wrap:       { position:'absolute', right:20, alignItems:'flex-end' },
  main:       { width:56, height:56, borderRadius:28, alignItems:'center', justifyContent:'center' },
  actionRow:  { position:'absolute', right:0, flexDirection:'row', alignItems:'center', gap:10 },
  actionBtn:  { width:48, height:48, borderRadius:24, borderWidth:1, alignItems:'center', justifyContent:'center' },
  actionLabel:{ paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  actionLabelText: { color:'#fff', fontSize:13, fontFamily:'Inter_500Medium' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function JournalScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { journalEntries, deleteJournalEntry } = useApp();
  const topPad    = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 80;

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

  const sections = useMemo(() => groupByDate(filtered), [filtered]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteJournalEntry(id);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Dark gradient header ─────────────────────────────────── */}
      <LinearGradient
        colors={['#1A1640', '#252070', '#2A2478']}
        style={[styles.headerGrad, { paddingTop: topPad }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        {/* Top row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>My Journal</Text>
            <View style={styles.privateBadge}>
              <Feather name="lock" size={10} color="rgba(200,184,232,0.7)" />
              <Text style={styles.privateBadgeText}>Private</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.hdrBtn, showCalendar && styles.hdrBtnActive]}
              onPress={() => setShowCalendar(v => !v)}
            >
              <Feather name="calendar" size={16} color={showCalendar ? '#fff' : 'rgba(200,184,232,0.7)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.hdrBtn, showSearch && styles.hdrBtnActive]}
              onPress={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
            >
              <Feather name={showSearch ? 'x' : 'search'} size={16} color={showSearch ? '#fff' : 'rgba(200,184,232,0.7)'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter tabs — white pill style inside dark header */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
          {FILTERS.map(f => {
            const isActive = activeFilter === f.key;
            const count    = counts[f.key];
            return (
              <TouchableOpacity key={f.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => { setActiveFilter(f.key); Haptics.selectionAsync(); }}
              >
                {f.emoji && <Text style={styles.filterEmoji}>{f.emoji}</Text>}
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {f.label}
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
          <Feather name="search" size={15} color={colors.mutedForeground} />
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
              <Feather name="x" size={13} color={colors.mutedForeground} />
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
        contentContainerStyle={[styles.timelineContent, { paddingBottom: bottomPad + 80 }]}
      >
        {sections.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor:`${colors.primary}10` }]}>
              <Text style={{ fontSize:34 }}>
                {activeFilter==='friend' ? '🤝' : activeFilter==='moment' ? '🌙' : '📓'}
              </Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {searchQuery.trim() ? `No results for "${searchQuery}"` : 'Nothing here yet'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {searchQuery.trim()
                ? 'Try a different word or mood.'
                : 'This is your private space. Start writing ✦'}
            </Text>
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
                    backgroundColor: section.date === selectedDate ? colors.primary : colors.background,
                    borderColor:      section.date === selectedDate ? colors.primary : colors.border,
                  }]} />
                  {si < sections.length - 1 && (
                    <View style={[styles.line, { backgroundColor: colors.border }]} />
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
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:14, paddingBottom:10 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:10 },
  title: { fontSize:24, fontFamily:'Inter_700Bold', letterSpacing:-0.5, color:'rgba(235,228,255,0.97)' },
  privateBadge: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:10, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(200,184,232,0.18)' },
  privateBadgeText: { fontSize:10, fontFamily:'Inter_500Medium', color:'rgba(200,184,232,0.7)' },
  headerRight: { flexDirection:'row', gap:8 },
  hdrBtn: { width:36, height:36, borderRadius:11, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.08)' },
  hdrBtnActive: { backgroundColor:'rgba(107,91,149,0.5)' },

  // Filter tabs inside dark header
  filtersScroll: { maxHeight:50 },
  filtersRow: { flexDirection:'row', gap:8, paddingHorizontal:16, paddingVertical:8 },
  filterTab: {
    flexDirection:'row', alignItems:'center', gap:5,
    paddingHorizontal:13, paddingVertical:7, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.1)',
  },
  filterTabActive: { backgroundColor:'rgba(255,255,255,0.96)' },
  filterEmoji: { fontSize:12 },
  filterLabel: { fontSize:13, fontFamily:'Inter_500Medium', color:'rgba(200,184,232,0.75)' },
  filterLabelActive: { color:'#2A1E50' },
  filterCount: { paddingHorizontal:5, paddingVertical:1, borderRadius:10, backgroundColor:'rgba(255,255,255,0.15)', minWidth:18, alignItems:'center' },
  filterCountActive: { backgroundColor:'rgba(107,91,149,0.15)' },
  filterCountText: { fontSize:10, fontFamily:'Inter_600SemiBold', color:'rgba(200,184,232,0.75)' },
  filterCountTextActive: { color:'#6B5B95' },

  // Search
  searchBar: { flexDirection:'row', alignItems:'center', gap:9, borderWidth:1, borderRadius:14, paddingHorizontal:13, paddingVertical:11, marginHorizontal:16, marginTop:10 },
  searchInput: { flex:1, fontSize:15, fontFamily:'Inter_400Regular' },
  searchHint: { fontSize:12, fontFamily:'Inter_400Regular', fontStyle:'italic', paddingHorizontal:18, paddingTop:8, paddingBottom:4 },

  // Timeline
  timelineContent: { paddingHorizontal:16, paddingTop:16 },
  timelineRow: { flexDirection:'row', gap:12 },
  timelineLeft: { width:20, alignItems:'center', paddingTop:3 },
  dot: { width:12, height:12, borderRadius:6, borderWidth:2, zIndex:1 },
  line: { flex:1, width:1.5, marginTop:5, marginBottom:-5 },
  timelineRight: { flex:1, paddingBottom:20 },
  dateLabel: { fontSize:12, fontFamily:'Inter_500Medium', marginBottom:10, marginTop:1, letterSpacing:0.2 },

  // Empty
  empty: { flex:1, alignItems:'center', justifyContent:'center', paddingTop:80, paddingHorizontal:36, gap:14 },
  emptyIcon: { width:76, height:76, borderRadius:38, alignItems:'center', justifyContent:'center', marginBottom:4 },
  emptyTitle: { fontSize:19, fontFamily:'Inter_600SemiBold', textAlign:'center' },
  emptyText: { fontSize:14, fontFamily:'Inter_400Regular', textAlign:'center', lineHeight:22, fontStyle:'italic' },
});
