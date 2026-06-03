import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';

const { height: H } = Dimensions.get('window');

const SHEET_H = Math.min(H * 0.60, 440);

const MODES = [
  {
    id:          'quick',
    icon:        'zap'         as const,
    name:        'Quick Moment',
    description: 'One image, one thought. Share in a few taps.',
    tag:         'Instant',
    color:       '#C8A84B',
    route:       '/quick-moment',
  },
  {
    id:          'chapter',
    icon:        'book-open'   as const,
    name:        'Chapter',
    description: 'Full multi-panel manga story, any length.',
    tag:         'Full editor',
    color:       '#9B7FE8',
    route:       '/chapter-editor',
  },
  {
    id:          'vibe',
    icon:        'feather'     as const,
    name:        'Vibe Post',
    description: 'Just a mood and words. No image needed.',
    tag:         'Text only',
    color:       '#78C8A8',
    route:       '/vibe-post',
  },
] as const;

export default function CreateScreen() {
  const insets  = useSafeAreaInsets();
  const botPad  = Platform.OS === 'web' ? 32 : insets.bottom + 16;

  const sheetY    = useRef(new Animated.Value(SHEET_H)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    // Slide sheet in every time the Create tab is focused
    sheetY.setValue(SHEET_H);
    bgOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY,    { toValue: 0,   tension: 48, friction: 9,                         useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 1,   duration: 260, easing: Easing.out(Easing.quad),   useNativeDriver: true }),
    ]).start();
  }, []));

  function dismiss() {
    Animated.parallel([
      Animated.timing(sheetY,    { toValue: SHEET_H, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 0,        duration: 180,                                 useNativeDriver: true }),
    ]).start(() => {
      // Navigate back to the Home tab
      router.replace('/(tabs)' as any);
    });
  }

  function selectMode(route: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.timing(sheetY,    { toValue: SHEET_H, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 0,        duration: 160,                                 useNativeDriver: true }),
    ]).start(() => {
      router.push(route as any);
    });
  }

  return (
    <View style={s.root}>
      {/* Scrim behind sheet */}
      <Animated.View
        style={[StyleSheet.absoluteFill, s.scrim, { opacity: bgOpacity }]}
        pointerEvents="none"
      />

      {/* Tap scrim to dismiss */}
      <Pressable style={s.dismissArea} onPress={dismiss} />

      {/* ── Bottom sheet ─────────────────────────────────────────── */}
      <Animated.View
        style={[s.sheet, { paddingBottom: botPad, transform: [{ translateY: sheetY }] }]}
        pointerEvents="box-none"
      >
        {/* Drag handle */}
        <View style={s.handle} />

        {/* Header row */}
        <View style={s.headerRow}>
          <Text style={s.sheetTitle}>Create</Text>
          <TouchableOpacity style={s.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="x" size={16} color="rgba(200,185,255,0.50)" />
          </TouchableOpacity>
        </View>
        <Text style={s.sheetSub}>What kind of story today?</Text>

        {/* Mode tiles */}
        <View style={s.tiles}>
          {MODES.map(mode => (
            <TouchableOpacity
              key={mode.id}
              style={s.tile}
              onPress={() => selectMode(mode.route)}
              activeOpacity={0.82}
            >
              <LinearGradient
                colors={[`${mode.color}14`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />
              <View style={[s.iconWrap, { backgroundColor: `${mode.color}1C`, borderColor: `${mode.color}38` }]}>
                <Icon name={mode.icon} size={20} color={mode.color} />
              </View>
              <View style={s.tileText}>
                <View style={s.titleRow}>
                  <Text style={[s.tileName, { color: mode.color }]}>{mode.name}</Text>
                  <View style={[s.tag, { backgroundColor: `${mode.color}18`, borderColor: `${mode.color}35` }]}>
                    <Text style={[s.tagTxt, { color: `${mode.color}CC` }]}>{mode.tag}</Text>
                  </View>
                </View>
                <Text style={s.tileDesc}>{mode.description}</Text>
              </View>
              <Icon name="chevron-right" size={15} color={`${mode.color}55`} />
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  scrim: {
    backgroundColor: 'rgba(4,2,14,0.78)',
  },
  dismissArea: {
    flex: 1,
  },

  sheet: {
    position:        'absolute',
    left:            0, right: 0, bottom: 0,
    height:          SHEET_H,
    backgroundColor: '#0B0820',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    borderTopWidth:  1,
    borderColor:     'rgba(200,185,255,0.10)',
    paddingHorizontal: 20,
    paddingTop:      12,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -8 },
    shadowOpacity:   0.55,
    shadowRadius:    20,
    elevation:       24,
  },

  handle: {
    alignSelf:       'center',
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(200,185,255,0.18)',
    marginBottom:    16,
  },

  headerRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    4,
  },
  sheetTitle: {
    fontSize:    22,
    fontFamily:  'Satoshi-Bold',
    color:       'rgba(248,244,255,0.97)',
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.09)',
    alignItems: 'center', justifyContent: 'center',
  },

  sheetSub: {
    fontSize:   13,
    fontFamily: 'Satoshi-Regular',
    color:      'rgba(200,185,255,0.40)',
    marginBottom: 18,
  },

  tiles: { gap: 10 },

  tile: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     'rgba(200,185,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.022)',
    paddingHorizontal: 14,
    paddingVertical:   12,
    overflow:        'hidden',
  },
  iconWrap: {
    width:          44,
    height:         44,
    borderRadius:   14,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  tileText:  { flex: 1 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 },
  tileName:  { fontSize: 15, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  tag: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1,
  },
  tagTxt:  { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  tileDesc:{
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.42)', lineHeight: 17,
  },
});
