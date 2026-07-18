import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { MoodBadge } from '@/components/MoodBadge';
import { SHADOW } from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Image } from 'expo-image';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


function formatFullDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TYPE_CFG = {
  diary:  { label: 'Diary Entry',   icon: 'feather' as const,   accent: '#6B5B95', bg: 'rgba(107,91,149,0.14)'  },
  friend: { label: 'Friend',        icon: 'users'   as const,   accent: '#3A78B8', bg: 'rgba(58,120,184,0.14)'  },
  moment: { label: 'Quick Moment',  icon: 'moon'    as const,   accent: '#5848A8', bg: 'rgba(88,72,168,0.14)'   },
};

// ── Journal theme palettes for the full entry reader ──────────────────────────
const READER_THEME: Record<string, {
  headerGradient: readonly [string, string, string];
  accentStrip: string;
  cardBg: string;
  cardBorder: string;
}> = {
  theme_locket: {
    headerGradient: ['#2A1D00', '#3D2C08', '#4A3812'] as const,
    accentStrip:    '#C8A84B',
    cardBg:         'rgba(200,168,75,0.08)',
    cardBorder:     'rgba(200,168,75,0.25)',
  },
  theme_aurora: {
    headerGradient: ['#001827', '#082233', '#102E42'] as const,
    accentStrip:    '#78B4DC',
    cardBg:         'rgba(120,180,220,0.08)',
    cardBorder:     'rgba(120,180,220,0.25)',
  },
};

export default function JournalEntryScreen() {
  const colors  = useColors();
  const { t } = useTranslation();
  const insets  = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();
  const { journalEntries, activeCosmetics } = useApp();
  const activeTheme = activeCosmetics['theme'] as string | undefined;

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const entry = journalEntries.find(e => e.id === id);

  if (!entry) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <BackButton style={s.backBtn} color={colors.foreground} size={20} />
        <View style={s.notFound}>
          <Icon name="book-open" size={36} color={colors.mutedForeground} />
          <Text style={[s.notFoundText, { color: colors.mutedForeground }]}>{t('discover.entryNotFound')}</Text>
        </View>
      </View>
    );
  }

  const cfg     = TYPE_CFG[entry.type];
  const initial = entry.type === 'friend' ? (entry.friendName?.[0] ?? '?').toUpperCase() : null;

  // Apply journal theme only to diary entries (same rule as timeline card)
  const ts = (entry.type === 'diary' && activeTheme) ? READER_THEME[activeTheme] ?? null : null;
  const headerGradient: [string, string, string] = ts
    ? [ts.headerGradient[0], ts.headerGradient[1], ts.headerGradient[2]]
    : ['#1A1640', '#23205C', '#2A2478'];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* ── Gradient header ──────────────────────────────────── */}
      <LinearGradient
        colors={headerGradient}
        style={[s.header, { paddingTop: topPad + 8 }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <BackButton style={s.backBtn} color="rgba(220,210,255,0.9)" size={20} />

        <View style={s.headerCenter}>
          {/* Type badge */}
          <View style={[s.typeBadge, { backgroundColor: cfg.bg, borderColor: `${cfg.accent}40` }]}>
            <Icon name={cfg.icon} size={13} color={cfg.accent} />
            <Text style={[s.typeBadgeText, { color: cfg.accent }]}>{entry.type === 'diary' ? t('journal.journalTitle') : entry.type === 'friend' ? t('journal.friendTitle') : t('journal.momentTitle')}</Text>
          </View>

          {/* Date */}
          <Text style={s.dateText}>{formatFullDate(entry.date)}</Text>
          <Text style={s.timeText}>{formatTime(entry.date)}</Text>
        </View>
      </LinearGradient>

      {/* ── Content ──────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Friend header */}
        {entry.type === 'friend' && entry.friendName && (
          <View style={[s.friendHeader, { backgroundColor: colors.card, borderColor: 'rgba(58,120,184,0.2)' }, SHADOW.xs]}>
            <View style={[s.friendAvatar, { backgroundColor: 'rgba(58,120,184,0.12)', borderColor: 'rgba(58,120,184,0.25)' }]}>
              <Text style={[s.friendInitial, { color: '#5898D8' }]}>{initial}</Text>
            </View>
            <View style={s.friendInfo}>
              <Text style={[s.friendName, { color: colors.foreground }]}>{entry.friendName}</Text>
              <Text style={[s.friendSub, { color: '#5898D8' }]}>{t('journal.friendEncounterLogged')}</Text>
            </View>
          </View>
        )}

        {/* Image — full display */}
        {entry.imageUri && (
          <View style={[s.imageWrap, { backgroundColor: `${cfg.accent}10` }]}>
            <Image
              source={{ uri: entry.imageUri }}
              style={s.image}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          </View>
        )}

        {/* Text body */}
        {entry.text ? (
          <View style={[s.textCard, {
            backgroundColor: ts ? ts.cardBg : colors.card,
            borderColor:     ts ? ts.cardBorder : colors.border,
          }, SHADOW.xs]}>
            {entry.type === 'moment' ? (
              <View style={[s.momentStripe, { backgroundColor: '#5848A8' }]} />
            ) : ts ? (
              <View style={[s.momentStripe, { backgroundColor: ts.accentStrip }]} />
            ) : null}
            <Text style={[
              s.bodyText,
              { color: colors.foreground },
              entry.type === 'moment' && s.momentBodyText,
            ]}>
              {entry.text}
            </Text>
          </View>
        ) : null}

        {/* Footer: mood + type context */}
        <View style={s.footer}>
          <MoodBadge mood={entry.mood} size="sm" />
          {entry.type === 'friend' && entry.friendName && (
            <View style={[s.footerPill, { backgroundColor: 'rgba(58,120,184,0.12)', borderColor: 'rgba(58,120,184,0.28)' }]}>
              <Icon name="users" size={11} color="#5898D8" />
              <Text style={[s.footerPillText, { color: '#5898D8' }]}>{t('journal.with', { name: entry.friendName })}</Text>
            </View>
          )}
          {entry.type === 'moment' && (
            <View style={[s.footerPill, { backgroundColor: 'rgba(88,72,168,0.12)', borderColor: 'rgba(88,72,168,0.28)' }]}>
              <Icon name="moon" size={11} color="#9A88E0" />
              <Text style={[s.footerPillText, { color: '#9A88E0' }]}>Captured moment</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 22,
    gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start',
  },
  headerCenter: { gap: 6 },

  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1,
  },
  typeBadgeText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  dateText: {
    fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4,
    color: 'rgba(240,234,255,0.95)',
  },
  timeText: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.55)',
  },

  scroll: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },

  friendHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderRadius: 16, padding: 14,
  },
  friendAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, flexShrink: 0,
  },
  friendInitial: { fontSize: 20, fontFamily: 'Satoshi-Bold' },
  friendInfo: { gap: 2 },
  friendName: { fontSize: 17, fontFamily: 'Satoshi-Bold' },
  friendSub:  { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  imageWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 200,
    maxHeight: 480,
  },
  image: {
    width: '100%',
    height: 360,
  },

  textCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 18, flexDirection: 'row',
    overflow: 'hidden',
  },
  momentStripe: {
    width: 3, borderRadius: 2, marginRight: 14, alignSelf: 'stretch',
  },
  bodyText: {
    flex: 1,
    fontSize: 16, fontFamily: 'Satoshi-Regular',
    lineHeight: 27, fontStyle: 'italic',
  },
  momentBodyText: {
    color: 'rgba(240,234,248,0.88)',
  },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: 8, paddingBottom: 8,
  },
  footerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
  },
  footerPillText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 15, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
});
