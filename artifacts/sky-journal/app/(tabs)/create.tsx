import React from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';

const { width: W } = Dimensions.get('window');

const MODES = [
  {
    id:          'quick',
    icon:        'zap'         as const,
    name:        'Quick Moment',
    description: 'One image, one thought. Share in a few taps.',
    tag:         'Instant',
    color:       '#C8A84B',
    glow:        '#C8A84B',
    route:       '/quick-moment',
  },
  {
    id:          'chapter',
    icon:        'book-open'   as const,
    name:        'Chapter',
    description: 'Full multi-panel manga story, any length.',
    tag:         'Full editor',
    color:       '#9B7FE8',
    glow:        '#9B7FE8',
    route:       '/chapter-editor',
  },
  {
    id:          'vibe',
    icon:        'feather'     as const,
    name:        'Vibe Post',
    description: 'Just a mood. No image needed. Words only.',
    tag:         'Text only',
    color:       '#78C8A8',
    glow:        '#78C8A8',
    route:       '/vibe-post',
  },
] as const;

const STARS = [
  { top: 0.06, left: 0.08,  size: 2, opacity: 0.55 },
  { top: 0.10, left: 0.72,  size: 1.5, opacity: 0.45 },
  { top: 0.18, left: 0.38,  size: 2.5, opacity: 0.60 },
  { top: 0.24, left: 0.85,  size: 1.5, opacity: 0.35 },
  { top: 0.30, left: 0.15,  size: 2, opacity: 0.50 },
  { top: 0.08, left: 0.52,  size: 1, opacity: 0.40 },
];

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 48 : insets.top;

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#07041A', '#0B0820', '#060412']}
        style={StyleSheet.absoluteFill}
      />

      {/* Static star field */}
      {STARS.map((st, i) => (
        <View
          key={i}
          style={{
            position:        'absolute',
            top:             st.top * 400,
            left:            st.left * W,
            width:           st.size,
            height:          st.size,
            borderRadius:    st.size,
            backgroundColor: '#fff',
            opacity:         st.opacity,
          }}
        />
      ))}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingTop: topPad + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Create</Text>
          <Text style={s.headerSub}>What will you share today?</Text>
        </View>

        {/* Mode tiles */}
        <View style={s.tiles}>
          {MODES.map(mode => (
            <TouchableOpacity
              key={mode.id}
              style={s.tile}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(mode.route as any);
              }}
              activeOpacity={0.83}
            >
              <LinearGradient
                colors={[`${mode.color}16`, `${mode.color}06`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              />

              {/* Left icon */}
              <View style={[s.iconWrap, { backgroundColor: `${mode.color}1C`, borderColor: `${mode.color}38` }]}>
                <Icon name={mode.icon} size={22} color={mode.color} />
              </View>

              {/* Text block */}
              <View style={s.tileText}>
                <View style={s.titleRow}>
                  <Text style={[s.tileName, { color: mode.color }]}>{mode.name}</Text>
                  <View style={[s.tag, { backgroundColor: `${mode.color}18`, borderColor: `${mode.color}35` }]}>
                    <Text style={[s.tagTxt, { color: `${mode.color}CC` }]}>{mode.tag}</Text>
                  </View>
                </View>
                <Text style={s.tileDesc}>{mode.description}</Text>
              </View>

              {/* Chevron */}
              <Icon name="chevron-right" size={16} color={`${mode.color}55`} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Soft footer hint */}
        <Text style={s.footer}>✦ All stories can be kept private</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#07041A' },
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },

  header:     { marginBottom: 32, alignItems: 'center' },
  headerTitle:{
    fontSize: 32, fontFamily: 'Satoshi-Bold',
    color: 'rgba(248,244,255,0.97)',
    letterSpacing: -1.0, marginBottom: 8,
  },
  headerSub: {
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.45)',
    letterSpacing: 0.1,
  },

  tiles: { gap: 12 },

  tile: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    borderRadius:    22,
    borderWidth:     1,
    borderColor:     'rgba(200,185,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.024)',
    padding:         18,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    12,
    elevation:       4,
  },
  iconWrap: {
    width:        52,
    height:       52,
    borderRadius: 16,
    borderWidth:  1,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
  },
  tileText:  { flex: 1 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  tileName:  { fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  tag: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 9, borderWidth: 1,
  },
  tagTxt:  { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  tileDesc:{
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,185,255,0.45)', lineHeight: 18,
  },

  footer: {
    marginTop:  36,
    fontSize:   12,
    fontFamily: 'Satoshi-Regular',
    fontStyle:  'italic',
    color:      'rgba(200,185,255,0.20)',
    textAlign:  'center',
  },
});
