import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';

const MOOD_TILES = [
  { label: 'Soft',     icon: 'feather'  as const, color: '#C8A0D8', bg: '#2A1040', accentRgb: '190,160,220' },
  { label: 'Dreamy',   icon: 'star'     as const, color: '#A880F8', bg: '#1E1040', accentRgb: '168,128,248' },
  { label: 'Chaotic',  icon: 'zap'      as const, color: '#E8784A', bg: '#2E0C06', accentRgb: '220,120,70' },
  { label: 'Peaceful', icon: 'cloud'    as const, color: '#60C0D8', bg: '#0A2838', accentRgb: '96,192,216' },
  { label: 'Hopeful',  icon: 'sunrise'  as const, color: '#C8A84B', bg: '#281C00', accentRgb: '200,168,75' },
] as const;

interface Props {
  visible: boolean;
  onSelect: (mood: string) => void;
  onDismiss: () => void;
}

export function MoodDoorModal({ visible, onSelect, onDismiss }: Props) {
  const insets  = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.92)).current;
  const tileAnims = useRef(MOOD_TILES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.92);
      tileAnims.forEach(a => a.setValue(0));
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale,   { toValue: 1, tension: 60, friction: 12, useNativeDriver: true }),
        ...tileAnims.map((a, i) =>
          Animated.timing(a, {
            toValue:  1,
            duration: 260,
            delay:    60 + i * 55,
            easing:   Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
        ),
      ]).start();
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleSelect(mood: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(mood);
  }

  const topPad = Platform.OS === 'web' ? 60 : insets.top;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={s.overlay} onPress={onDismiss}>
        <Animated.View style={[s.container, { opacity, transform: [{ scale }], paddingTop: topPad + 24, paddingBottom: Platform.OS === 'web' ? 48 : insets.bottom + 40 }]}>
          <Pressable onPress={e => e.stopPropagation()} style={{ flex: 1 }}>

            {/* Atmospheric background glows */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={[s.glow, { top: -60, left: -40, width: 220, height: 220, backgroundColor: 'rgba(168,120,248,0.18)', borderRadius: 110 }]} />
              <View style={[s.glow, { bottom: 40, right: -50, width: 180, height: 180, backgroundColor: 'rgba(96,200,240,0.12)', borderRadius: 90 }]} />
            </View>

            {/* Header */}
            <View style={s.header}>
              <Text style={s.eyebrow}>◈  Step through a door</Text>
              <Text style={s.title}>What are you{'\n'}in the mood for?</Text>
              <Text style={s.sub}>Your choice shapes what you see in Discover today.</Text>
            </View>

            {/* Mood tiles */}
            <View style={s.tiles}>
              {MOOD_TILES.map((tile, i) => (
                <Animated.View
                  key={tile.label}
                  style={{
                    opacity:   tileAnims[i],
                    transform: [{ translateY: tileAnims[i]!.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
                  }}
                >
                  <TouchableOpacity
                    style={[s.tile, { borderColor: `rgba(${tile.accentRgb},0.28)` }]}
                    onPress={() => handleSelect(tile.label)}
                    activeOpacity={0.82}
                  >
                    <LinearGradient
                      colors={[`rgba(${tile.accentRgb},0.18)`, `rgba(${tile.accentRgb},0.06)`, 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={[s.iconCircle, { backgroundColor: `rgba(${tile.accentRgb},0.16)`, borderColor: `rgba(${tile.accentRgb},0.30)` }]}>
                      <Icon name={tile.icon} size={24} color={tile.color} />
                    </View>
                    <Text style={[s.tileLabel, { color: tile.color }]}>{tile.label}</Text>
                    <View style={s.tileSpacer} />
                    <View style={[s.arrow, { backgroundColor: `rgba(${tile.accentRgb},0.14)` }]}>
                      <Icon name="chevron-right" size={14} color={`rgba(${tile.accentRgb},0.70)`} />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>

            {/* Skip */}
            <TouchableOpacity style={s.skip} onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}>
              <Text style={s.skipTxt}>Show me everything</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4,2,16,0.88)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  glow: {
    position: 'absolute',
  },
  header: {
    marginBottom: 28,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: 2.2,
    color: 'rgba(200,184,232,0.38)',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Satoshi-Bold',
    color: 'rgba(248,244,255,0.97)',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 10,
  },
  sub: {
    fontSize: 13,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.45)',
    lineHeight: 19,
  },
  tiles: {
    gap: 10,
    flex: 1,
    justifyContent: 'center',
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.028)',
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileLabel: {
    fontSize: 18,
    fontFamily: 'Satoshi-Bold',
    letterSpacing: -0.3,
  },
  tileSpacer: { flex: 1 },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  skip: {
    alignSelf: 'center',
    marginTop: 22,
    paddingVertical: 8,
  },
  skipTxt: {
    fontSize: 13,
    fontFamily: 'Satoshi-Medium',
    color: 'rgba(200,184,232,0.35)',
    letterSpacing: 0.2,
  },
});
