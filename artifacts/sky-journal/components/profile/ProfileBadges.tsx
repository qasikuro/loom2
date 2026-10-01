/**
 * ProfileBadges — renders Founder and/or Beta Tester badge images inline.
 * Used on own profile and public profiles.
 */
import { SecureImage as Image } from '@/components/SecureImage';
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const PROFILE_FOUNDER_BADGE_IMAGE = require('@/assets/images/badge_founder.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const PROFILE_BETA_BADGE_IMAGE = require('@/assets/images/badge_beta.png');

interface Props {
  isFounder?:    boolean;
  isBetaTester?: boolean;
  /** Badge size (default 36) */
  size?: number;
  /** Whether to show the text label beneath each badge */
  showLabel?: boolean;
}

export function ProfileBadges({ isFounder, isBetaTester, size = 36, showLabel = false }: Props) {
  if (!isFounder && !isBetaTester) return null;

  return (
    <View style={s.row}>
      {isFounder && (
        <View style={s.badgeWrap}>
          <Image source={PROFILE_FOUNDER_BADGE_IMAGE} style={{ width: size, height: size }} contentFit="contain" />
          {showLabel && <Text style={s.label}>Founder</Text>}
        </View>
      )}
      {isBetaTester && (
        <View style={s.badgeWrap}>
          <Image source={PROFILE_BETA_BADGE_IMAGE} style={{ width: size, height: size }} contentFit="contain" />
          {showLabel && <Text style={s.label}>Beta</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeWrap: { alignItems: 'center', gap: 2 },
  label:     { fontSize: 9, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.3, textTransform: 'uppercase' },
});
