import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type Colors = ReturnType<typeof useColors>;
export type SessionPhase = 'cancelled' | 'upcoming' | 'live' | 'ended';

export function getSessionPhase(status: string, startsAt: string, endsAt: string, now: number): SessionPhase {
  if (status === 'cancelled') return 'cancelled';
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (status === 'completed' || (Number.isFinite(end) && now >= end)) return 'ended';
  if (status === 'scheduled' && Number.isFinite(start) && now >= start) return 'live';
  return 'upcoming';
}

export function formatSessionCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SectionCard({ colors, icon, eyebrow, title, right, children, testID }: {
  colors: Colors; icon: string; eyebrow?: string; title: string; right?: React.ReactNode; children?: React.ReactNode; testID?: string;
}) {
  return (
    <View testID={testID} style={[gs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={gs.cardHead}>
        <View style={[gs.cardIcon, { backgroundColor: `${colors.primary}14` }]}><Icon name={icon} size={16} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          {!!eyebrow && <Text style={[gs.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>}
          <Text style={[gs.cardTitle, { color: colors.foreground }]}>{title}</Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Notice({ colors, icon, text, tone = 'muted' }: { colors: Colors; icon: string; text: string; tone?: 'muted' | 'primary' | 'danger' }) {
  const c = tone === 'danger' ? colors.destructive : tone === 'primary' ? colors.primary : colors.mutedForeground;
  return (
    <View style={[gs.notice, { backgroundColor: `${c}0F`, borderColor: `${c}26` }]}>
      <Icon name={icon} size={14} color={c} />
      <Text style={[gs.noticeText, { color: tone === 'muted' ? colors.mutedForeground : c }]}>{text}</Text>
    </View>
  );
}

export function PillButton({ colors, label, icon, onPress, disabled, busy, variant = 'primary', testID, flex }: {
  colors: Colors; label: string; icon?: string; onPress: () => void; disabled?: boolean; busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger'; testID?: string; flex?: boolean;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? `${colors.destructive}12` : `${colors.primary}10`;
  const fg = variant === 'primary' ? colors.primaryForeground : variant === 'danger' ? colors.destructive : colors.primary;
  return (
    <TouchableOpacity testID={testID} accessibilityRole="button" disabled={disabled || busy} onPress={onPress} activeOpacity={0.85}
      style={[gs.pill, flex && { flex: 1 }, { backgroundColor: bg, opacity: disabled ? 0.45 : busy ? 0.7 : 1 }]}>
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text style={[gs.pillText, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Initials({ name, colors, size = 34 }: { name: string; colors: Colors; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.primary, fontFamily: 'Satoshi-Bold', fontSize: size * 0.38 }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

export const gs = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 1 },
  cardTitle: { fontFamily: 'Satoshi-Bold', fontSize: 15 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 10 },
  noticeText: { flex: 1, fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 17 },
  pill: { minHeight: 42, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  pillText: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'Satoshi-Regular', fontSize: 14, marginBottom: 8 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  body: { fontFamily: 'Satoshi-Regular', fontSize: 13, lineHeight: 19 },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 12, marginBottom: 6 },
  meta: { fontFamily: 'Satoshi-Medium', fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
