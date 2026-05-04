import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useRef, useState } from 'react';
import {
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

// ── Date utils ────────────────────────────────────────────────────────────────

type FilterKey = 'all' | JournalEntryType;

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS   = ['S','M','T','W','T','F','S'];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatHeader(dateKey: string) {
  const today = toDateKey(new Date());
  const yest  = (() => { const d = new Date(); d.setDate(d.getDate()-1); return toDateKey(d); })();
  if (dateKey === today) return 'Today';
  if (dateKey === yest)  return 'Yesterday';
  const [y, m, d] = dateKey.split('-').map(Number);
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

// ── Timeline entry card ───────────────────────────────────────────────────────

const CARD_PH = {
  diary:  { stops: ['#C4B0E8','#9480C8'] as [string,string], icon: 'feather'  as const, ic: '#fff' },
  friend: { stops: ['#7AAED8','#4A80B8'] as [string,string], icon: 'users'    as const, ic: '#fff' },
  moment: { stops: ['#3A2E68','#1E1A40'] as [string,string], icon: 'moon'     as const, ic: 'rgba(200,184,232,0.8)' },
};

function TimelineCard({ entry, onDelete }: { entry: JournalEntry; onDelete: () => void }) {
  const colors = useColors();
  const ph = CARD_PH[entry.type];

  const title =
    entry.type === 'friend'
      ? `Encountered ${entry.friendName ?? 'someone'}`
      : entry.text.split(/\n/)[0].trim().slice(0, 72) || entry.text.slice(0, 72);

  const excerpt =
    entry.type === 'friend'
      ? entry.text !== `An encounter with ${entry.friendName}.` ? entry.text : ''
      : entry.text.slice(title.length).replace(/^\s+/, '').trim();

  return (
    <View style={[tc.card, SHADOW.sm, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Image / gradient placeholder */}
      <View style={tc.imageWrap}>
        {entry.imageUri ? (
          <Image source={{ uri: entry.imageUri }} style={tc.image} resizeMode="cover" />
        ) : (
          <LinearGradient colors={ph.stops} style={tc.placeholder} start={{ x:0,y:0 }} end={{ x:1,y:1 }}>
            <Feather name={ph.icon} size={28} color={ph.ic} />
          </LinearGradient>
        )}
        <View style={tc.bookmarkBubble}>
          <Feather name="bookmark" size={13} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      {/* Body */}
      <View style={tc.body}>
        <Text style={[tc.title, { color: colors.foreground }]} numberOfLines={2}>{title}</Text>
        {!!excerpt && (
          <Text style={[tc.excerpt, { color: colors.mutedForeground }]} numberOfLines={2}>{excerpt}</Text>
        )}
        <View style={tc.footer}>
          <MoodBadge mood={entry.mood} size="sm" />

          {entry.type === 'friend' && !!entry.friendName && (
            <View style={[tc.pill, { backgroundColor:'rgba(58,120,184,0.1)', borderColor:'rgba(58,120,184,0.22)' }]}>
              <Feather name="users" size={10} color="#3A78B8" />
              <Text style={[tc.pillText, { color:'#3A78B8' }]}>{entry.friendName}</Text>
            </View>
          )}
          {entry.type === 'moment' && (
            <View style={[tc.pill, { backgroundColor:'rgba(88,72,168,0.1)', borderColor:'rgba(88,72,168,0.22)' }]}>
              <Feather name="moon" size={10} color="#5848A8" />
              <Text style={[tc.pillText, { color:'#5848A8' }]}>Moment</Text>
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
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  card: { borderRadius:16, borderWidth:1, overflow:'hidden', marginBottom:10 },
  imageWrap: { position:'relative' },
  image: { width:'100%', height:180 },
  placeholder: { width:'100%', height:150, alignItems:'center', justifyContent:'center' },
  bookmarkBubble: {
    position:'absolute', top:10, right:12,
    width:30, height:30, borderRadius:8,
    backgroundColor:'rgba(0,0,0,0.28)',
    alignItems:'center', justifyContent:'center',
  },
  body: { padding:14, gap:7 },
  title: { fontSize:16, fontFamily:'Inter_700Bold', letterSpacing:-0.2 },
  excerpt: { fontSize:13, fontFamily:'Inter_400Regular', lineHeight:20, fontStyle:'italic' },
  footer: { flexDirection:'row', alignItems:'center', gap:7, flexWrap:'wrap', marginTop:2 },
  pill: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:4, borderRadius:10, borderWidth:1 },
  pillText: { fontSize:10, fontFamily:'Inter_500Medium' },
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

  const firstDOW  = new Date(year, month, 1).getDay();
  const daysInMo  = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = Array(firstDOW).fill(null);
  for (let d=1; d<=daysInMo; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={[cal.wrap, SHADOW.xs, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Month nav */}
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

      {/* Day headers */}
      <View style={cal.weekRow}>
        {WEEK_DAYS.map((d,i) => (
          <Text key={i} style={[cal.weekDay, { color: colors.mutedForeground }]}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={cal.grid}>
        {cells.map((cell, i) => {
          if (cell === null) return <View key={`e${i}`} style={cal.cell} />;
          const dk = `${year}-${String(month+1).padStart(2,'0')}-${String(cell).padStart(2,'0')}`;
          const has  = entryDates.has(dk);
          const sel  = dk === selectedDate;
          const now  = cell===today.getDate() && month===today.getMonth() && year===today.getFullYear();
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
              {has && !sel && (
                <View style={[cal.dot, { backgroundColor: colors.primary }]} />
              )}
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

// ── Main screen ───────────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string; emoji: string | null }[] = [
  { key:'all',    label:'All',     emoji:null },
  { key:'diary',  label:'Diary',   emoji:'📓' },
  { key:'friend', label:'Friends', emoji:'🤝' },
  { key:'moment', label:'Moments', emoji:'🌙' },
];

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
      <LinearGradient colors={['#EDE0F8','#F4EFF8','#F8F4EE']} style={[styles.headerGrad, { height: topPad+120 }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad+10 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]}>My Journal</Text>
          <View style={[styles.badge, { backgroundColor:`${colors.primary}12`, borderColor:`${colors.primary}22` }]}>
            <Feather name="lock" size={10} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Private</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: showCalendar ? `${colors.primary}18` : colors.muted }]}
            onPress={() => setShowCalendar(v => !v)}
          >
            <Feather name="calendar" size={17} color={showCalendar ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: showSearch ? `${colors.primary}18` : colors.muted }]}
            onPress={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
          >
            <Feather name={showSearch ? 'x' : 'search'} size={17} color={showSearch ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
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

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f.key;
          const count    = counts[f.key];
          return (
            <TouchableOpacity key={f.key}
              style={[styles.chip,
                isActive
                  ? { backgroundColor:`${colors.primary}15`, borderColor:`${colors.primary}40`, borderWidth:1.5 }
                  : { backgroundColor: colors.muted, borderColor:'transparent', borderWidth:1 },
              ]}
              onPress={() => { setActiveFilter(f.key); Haptics.selectionAsync(); }}
            >
              {f.emoji && <Text style={styles.chipEmoji}>{f.emoji}</Text>}
              <Text style={[styles.chipLabel, { color: isActive ? colors.primary : colors.mutedForeground }]}>{f.label}</Text>
              {count > 0 && (
                <View style={[styles.chipBadge, { backgroundColor: isActive ? `${colors.primary}22` : `${colors.primary}0C` }]}>
                  <Text style={[styles.chipBadgeText, { color: isActive ? colors.primary : colors.mutedForeground }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Calendar */}
      {showCalendar && (
        <MiniCalendar
          entries={journalEntries}
          selectedDate={selectedDate}
          onSelectDate={handleCalDate}
        />
      )}

      {/* Search result hint */}
      {!!searchQuery.trim() && (
        <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>
          {filtered.length === 0
            ? 'No results'
            : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${searchQuery}"`}
        </Text>
      )}

      {/* Timeline scroll */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.timelineContent, { paddingBottom: bottomPad }]}
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
                : 'Start writing — this is your private space.'}
            </Text>
          </View>
        ) : (
          sections.map((section, si) => (
            <View
              key={section.date}
              onLayout={e => { sectionY.current[section.date] = e.nativeEvent.layout.y; }}
            >
              {/* Timeline row: dot column + content column */}
              <View style={styles.timelineRow}>
                {/* Left: dot + connector line */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, {
                    backgroundColor: section.date === selectedDate ? colors.primary : colors.background,
                    borderColor:      section.date === selectedDate ? colors.primary : colors.border,
                  }]} />
                  {si < sections.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  )}
                </View>

                {/* Right: date + cards */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1 },
  headerGrad: { position:'absolute', top:0, left:0, right:0 },
  header: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingBottom:10 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:10 },
  title: { fontSize:26, fontFamily:'Inter_700Bold', letterSpacing:-0.5 },
  badge: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:10, borderWidth:1 },
  badgeText: { fontSize:10, fontFamily:'Inter_500Medium' },
  headerRight: { flexDirection:'row', alignItems:'center', gap:8 },
  iconBtn: { width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center' },
  searchBar: { flexDirection:'row', alignItems:'center', gap:9, borderWidth:1, borderRadius:14, paddingHorizontal:13, paddingVertical:11, marginHorizontal:16, marginBottom:8 },
  searchInput: { flex:1, fontSize:15, fontFamily:'Inter_400Regular' },
  filtersScroll: { maxHeight:48 },
  filtersRow: { flexDirection:'row', gap:8, paddingHorizontal:16, paddingVertical:6 },
  chip: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:12, paddingVertical:7, borderRadius:20 },
  chipEmoji: { fontSize:13 },
  chipLabel: { fontSize:13, fontFamily:'Inter_500Medium' },
  chipBadge: { paddingHorizontal:6, paddingVertical:1, borderRadius:10, minWidth:18, alignItems:'center' },
  chipBadgeText: { fontSize:10, fontFamily:'Inter_600SemiBold' },
  searchHint: { fontSize:12, fontFamily:'Inter_400Regular', fontStyle:'italic', paddingHorizontal:18, paddingBottom:6 },
  // Timeline layout
  timelineContent: { paddingHorizontal:16, paddingTop:10 },
  timelineRow: { flexDirection:'row', gap:12 },
  timelineLeft: { width:20, alignItems:'center', paddingTop:3 },
  timelineDot: { width:12, height:12, borderRadius:6, borderWidth:2, zIndex:1 },
  timelineLine: { flex:1, width:1.5, marginTop:5, marginBottom:-5 },
  timelineRight: { flex:1, paddingBottom:20 },
  dateLabel: { fontSize:12, fontFamily:'Inter_500Medium', marginBottom:10, marginTop:1, letterSpacing:0.2 },
  // Empty state
  empty: { flex:1, alignItems:'center', justifyContent:'center', paddingTop:80, paddingHorizontal:36, gap:14 },
  emptyIcon: { width:76, height:76, borderRadius:38, alignItems:'center', justifyContent:'center', marginBottom:4 },
  emptyTitle: { fontSize:19, fontFamily:'Inter_600SemiBold', textAlign:'center' },
  emptyText: { fontSize:14, fontFamily:'Inter_400Regular', textAlign:'center', lineHeight:22, fontStyle:'italic' },
});
