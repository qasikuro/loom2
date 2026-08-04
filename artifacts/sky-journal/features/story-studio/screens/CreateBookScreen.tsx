/**
 * CreateBookScreen — multi-field form for creating a new Book.
 * Navigates to BookDetailsScreen on success.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useApiFetch } from '../utils/apiClient';

// ── Constants ─────────────────────────────────────────────────────────────────

const GENRES = [
  'Fantasy', 'Romance', 'Adventure', 'Mystery', 'Slice of Life',
  'Drama', 'Sci-Fi', 'Horror', 'Comedy', 'Thriller',
  'Historical', 'Supernatural', 'Action', 'Isekai', 'Mecha',
];

const LANGUAGES = ['English', 'Japanese', 'Korean', 'Chinese', 'Spanish', 'French', 'German', 'Portuguese', 'Other'];
const AGE_RATINGS = ['All Ages', '13+', '16+', '18+'];
const SERIES_TYPES = [
  { key: 'standalone', label: 'Standalone', desc: 'Single-volume story' },
  { key: 'series',     label: 'Series',     desc: 'Multi-volume series' },
  { key: 'oneshot',   label: 'One-shot',   desc: 'Single chapter story' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookCreated {
  id: string;
  title: string;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CreateBookScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const fetch   = useApiFetch();

  const [title,      setTitle]      = useState('');
  const [subtitle,   setSubtitle]   = useState('');
  const [seriesType, setSeriesType] = useState('standalone');
  const [genres,     setGenres]     = useState<string[]>([]);
  const [language,   setLanguage]   = useState('English');
  const [ageRating,  setAgeRating]  = useState('All Ages');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [loading,    setLoading]    = useState(false);

  function toggleGenre(g: string) {
    Haptics.selectionAsync();
    setGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  async function handleCreate() {
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a book title.'); return; }
    setLoading(true);
    try {
      const book = await fetch<BookCreated>('/books', {
        method: 'POST',
        json: { title: title.trim(), subtitle: subtitle.trim(), seriesType, genre: genres, language, ageRating, visibility },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/book-details?bookId=${book.id}` as never);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not create book');
    } finally {
      setLoading(false);
    }
  }

  const accent = '#8B70C8';

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>New Book</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {/* Title & Subtitle */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>TITLE</Text>
          <TextInput
            style={s.input}
            placeholder="Book title…"
            placeholderTextColor="rgba(200,185,255,0.25)"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
          <Text style={s.sectionLabel}>SUBTITLE</Text>
          <TextInput
            style={s.input}
            placeholder="Optional subtitle…"
            placeholderTextColor="rgba(200,185,255,0.25)"
            value={subtitle}
            onChangeText={setSubtitle}
            maxLength={200}
          />
        </View>

        {/* Series Type */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>TYPE</Text>
          <View style={s.typeRow}>
            {SERIES_TYPES.map(t => {
              const active = seriesType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.typeCard, active && { borderColor: `${accent}60`, backgroundColor: `${accent}14` }]}
                  onPress={() => { setSeriesType(t.key); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.typeCardTitle, active && { color: accent }]}>{t.label}</Text>
                  <Text style={s.typeCardDesc}>{t.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Genres */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>GENRE TAGS</Text>
          <View style={s.chipWrap}>
            {GENRES.map(g => {
              const active = genres.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[s.chip, active && { borderColor: `${accent}55`, backgroundColor: `${accent}18` }]}
                  onPress={() => toggleGenre(g)}
                >
                  <Text style={[s.chipTxt, active && { color: accent }]}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Language */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>LANGUAGE</Text>
          <View style={s.chipWrap}>
            {LANGUAGES.map(l => {
              const active = language === l;
              return (
                <TouchableOpacity
                  key={l}
                  style={[s.chip, active && { borderColor: `${accent}55`, backgroundColor: `${accent}18` }]}
                  onPress={() => { setLanguage(l); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.chipTxt, active && { color: accent }]}>{l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Age Rating + Visibility */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>AGE RATING</Text>
          <View style={s.chipWrap}>
            {AGE_RATINGS.map(r => {
              const active = ageRating === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[s.chip, active && { borderColor: `${accent}55`, backgroundColor: `${accent}18` }]}
                  onPress={() => { setAgeRating(r); Haptics.selectionAsync(); }}
                >
                  <Text style={[s.chipTxt, active && { color: accent }]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[s.sectionLabel, { marginTop: 18 }]}>VISIBILITY</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['public', 'private'] as const).map(v => {
              const active = visibility === v;
              const c = v === 'public' ? '#78C8A0' : '#9B7FE8';
              return (
                <TouchableOpacity
                  key={v}
                  style={[s.chip, { flexDirection: 'row', alignItems: 'center', gap: 6 }, active && { borderColor: `${c}55`, backgroundColor: `${c}18` }]}
                  onPress={() => { setVisibility(v); Haptics.selectionAsync(); }}
                >
                  <Icon name={v === 'public' ? 'globe' : 'lock'} size={12} color={active ? c : 'rgba(200,185,255,0.38)'} />
                  <Text style={[s.chipTxt, active && { color: c }]}>{v === 'public' ? 'Public' : 'Private'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[s.createBtn, { backgroundColor: accent, opacity: loading ? 0.7 : 1 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.createBtnTxt}>Create Book →</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { color: 'rgba(255,255,255,0.92)', fontSize: 17, fontWeight: '600' },
  scroll:        { padding: 20, gap: 4 },
  section:       { marginBottom: 22 },
  sectionLabel:  { color: 'rgba(200,185,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  input:         { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: 'rgba(255,255,255,0.90)', fontSize: 15, marginBottom: 14 },
  typeRow:       { flexDirection: 'row', gap: 10 },
  typeCard:      { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
  typeCardTitle: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '600', marginBottom: 3 },
  typeCardDesc:  { color: 'rgba(255,255,255,0.36)', fontSize: 11 },
  chipWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.03)' },
  chipTxt:       { color: 'rgba(200,185,255,0.55)', fontSize: 12 },
  createBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  createBtnTxt:  { color: '#fff', fontSize: 16, fontWeight: '700' },
});
