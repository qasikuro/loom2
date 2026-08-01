/**
 * ResumeDraftBanner — shown at the top of a creation screen when a saved
 * draft is detected.  The user can restore it or discard it.
 */
import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';

interface Props {
  /** Time (ms epoch) when the draft was saved, for display purposes. */
  savedAt:   number;
  onResume:  () => void;
  onDiscard: () => void;
  /** Accent colour used for the Restore button. */
  accentColor?: string;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ResumeDraftBanner({ savedAt, onResume, onDiscard, accentColor = '#6B5B95' }: Props) {
  return (
    <View style={[styles.banner, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}0D` }]}>
      <View style={styles.left}>
        <Icon name="clock" size={14} color={accentColor} />
        <View>
          <Text style={[styles.title, { color: accentColor }]}>Resume draft?</Text>
          <Text style={[styles.sub, { color: `${accentColor}80` }]}>
            You left off {timeAgo(savedAt)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.restoreBtn, { backgroundColor: accentColor }]}
          onPress={onResume}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        >
          <Text style={styles.restoreTxt}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDiscard}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Icon name="x" size={16} color={`${accentColor}70`} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    borderWidth:    1,
    borderRadius:   14,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginBottom:   14,
  },
  left: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    flex:          1,
  },
  title: {
    fontSize:    13,
    fontFamily:  'Satoshi-Bold',
    marginBottom: 1,
  },
  sub: {
    fontSize:   11,
    fontFamily: 'Satoshi-Regular',
  },
  actions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  restoreBtn: {
    paddingHorizontal: 14,
    paddingVertical:    6,
    borderRadius:      16,
  },
  restoreTxt: {
    fontSize:   12,
    fontFamily: 'Satoshi-Bold',
    color:      '#fff',
  },
});
