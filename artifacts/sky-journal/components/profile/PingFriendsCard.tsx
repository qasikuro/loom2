import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type PingState = 'idle' | 'sending' | 'sent' | 'cooldown';

interface Props {
  pingState: PingState;
  cooldownText: string;
  bellAnim: Animated.Value;
  moodAccent: string;
  onPing: () => void;
}

export function PingFriendsCard({ pingState, cooldownText, bellAnim, moodAccent, onPing }: Props) {
  const colors = useColors();
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: `${moodAccent}30` }, SHADOW.xs]}>
      <View style={s.left}>
        <View style={[s.iconWrap, { backgroundColor: `${moodAccent}15` }]}>
          <Animated.View style={{ transform: [{ rotate: bellAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] }) }] }}>
            <Icon name="bell" size={18} color={moodAccent} />
          </Animated.View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.title, { color: colors.foreground }]}>
            {pingState === 'sent' ? 'Friends summoned ✦' : 'Ping your sky friends'}
          </Text>
          <Text style={[s.sub, { color: colors.mutedForeground }]}>
            {pingState === 'cooldown' ? `Next signal in ${cooldownText}` : pingState === 'sent' ? 'Your constellation has been called' : 'Gently call your friends online'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[s.btn, { backgroundColor: `${moodAccent}18`, borderColor: `${moodAccent}45` }, (pingState === 'sending' || pingState === 'cooldown') && { opacity: 0.45 }]}
        onPress={onPing}
        disabled={pingState === 'sending' || pingState === 'cooldown'}
        activeOpacity={0.7}
      >
        {pingState === 'sending'
          ? <ActivityIndicator size={14} color={moodAccent} />
          : <Text style={[s.btnText, { color: moodAccent }]}>{pingState === 'sent' ? '✦ Sent' : pingState === 'cooldown' ? '⏳ Wait' : '✦ Signal'}</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  left:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:    { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  sub:      { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  btn:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  btnText:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },
});
