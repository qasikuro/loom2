import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useWeather } from '@/hooks/useWeather';

interface Props {
  query:       string | null;
  timezone?:   string | null;
  accentColor?: string;
  compact?:    boolean;
}

function localTime(timezone: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', {
      timeZone:  timezone,
      hour:      '2-digit',
      minute:    '2-digit',
      hour12:    true,
    });
  } catch { return ''; }
}

export function WeatherWidget({ query, timezone, accentColor, compact }: Props) {
  const colors          = useColors();
  const { data, loading } = useWeather(query);
  const [time, setTime] = useState(() => timezone ? localTime(timezone) : '');

  useEffect(() => {
    if (!timezone) { setTime(''); return; }
    setTime(localTime(timezone));
    const id = setInterval(() => setTime(localTime(timezone)), 30_000);
    return () => clearInterval(id);
  }, [timezone]);

  const accent = accentColor ?? '#9B78E8';

  if (compact) {
    if (!data && !loading) return null;
    return (
      <View style={[styles.compactPill, { backgroundColor: accent + '14', borderColor: accent + '28' }]}>
        {loading ? (
          <ActivityIndicator size={10} color={accent} />
        ) : data ? (
          <>
            <Text style={styles.compactEmoji}>{data.emoji}</Text>
            <Text style={[styles.compactTemp, { color: accent }]}>{data.tempC}°</Text>
            <Text style={[styles.compactCond, { color: colors.mutedForeground }]} numberOfLines={1}>
              {data.conditionText}
            </Text>
            {time ? (
              <>
                <View style={[styles.sep, { backgroundColor: colors.border }]} />
                <Text style={[styles.compactTime, { color: colors.mutedForeground }]}>🕐 {time}</Text>
              </>
            ) : null}
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.strip, { backgroundColor: accent + '0C', borderColor: accent + '20' }]}>
      {loading ? (
        <ActivityIndicator size={12} color={accent} style={{ marginLeft: 2 }} />
      ) : data ? (
        <>
          <Text style={styles.stripEmoji}>{data.emoji}</Text>
          <Text style={[styles.stripTemp, { color: accent }]}>{data.tempC}°C</Text>
          <Text style={[styles.stripCond, { color: colors.mutedForeground }]}>
            {data.conditionText}
          </Text>
          {time ? (
            <>
              <View style={[styles.sep, { backgroundColor: colors.border }]} />
              <Text style={[styles.stripTime, { color: colors.mutedForeground }]}>🕐 {time}</Text>
            </>
          ) : null}
        </>
      ) : (
        <Text style={[styles.stripCond, { color: colors.mutedForeground, fontStyle: 'italic' }]}>
          Fetching your sky…
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius:    12,
    borderWidth:     1,
  },
  stripEmoji: { fontSize: 16 },
  stripTemp:  { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  stripCond:  { fontSize: 12, fontFamily: 'Satoshi-Regular', flex: 1 },
  stripTime:  { fontSize: 12, fontFamily: 'Satoshi-Regular' },

  compactPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    alignSelf:       'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius:    20,
    borderWidth:     1,
    marginTop:       6,
  },
  compactEmoji: { fontSize: 13 },
  compactTemp:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  compactCond:  { fontSize: 11, fontFamily: 'Satoshi-Regular', maxWidth: 100 },
  compactTime:  { fontSize: 11, fontFamily: 'Satoshi-Regular' },

  sep: { width: 1, height: 10, borderRadius: 1 },
});
