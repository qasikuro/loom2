import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';

const MODES = [
  {
    id:          'quick',
    icon:        'star'        as const,
    name:        'Quick with AI',
    description: 'One image, one thought.\nLet AI turn it into something amazing.',
    color:       '#FFD05B',
    border:      '#F8C84A',
    image:       Images.story_bg3,
    featured:    true,
    route:       '/quick-moment',
  },
  {
    id:          'journal',
    icon:        'feather'     as const,
    name:        'Journal',
    description: 'Open your private journal,\nread entries or write a new one.',
    color:       '#B58CFF',
    border:      '#8054D8',
    image:       Images.create_quick,
    featured:    false,
    route:       '/(tabs)/log',
  },
  {
    id:          'chapter',
    icon:        'book-open'   as const,
    name:        'Chapter',
    description: 'Create a full multi-panel\nmanga story, any length.',
    color:       '#A968FF',
    border:      '#7D3DDE',
    image:       Images.create_chapter,
    featured:    false,
    route:       '/chapter-editor',
  },
  {
    id:          'video',
    icon:        'video'       as const,
    name:        'Post Video',
    description: 'Share a 10-second moment\ndirectly to Discover.',
    color:       '#FF68A8',
    border:      '#D63388',
    image:       Images.create_video,
    featured:    false,
    route:       '/post-video',
  },
  {
    id:          'dashboard',
    icon:        'trending-up' as const,
    name:        'Creator Dashboard',
    description: 'Track reads, followers &\nmanage your books.',
    color:       '#42E0D0',
    border:      '#18AFA9',
    image:       Images.create_dashboard,
    featured:    false,
    route:       '/creator-dashboard',
  },
] as const;

export default function CreateScreen() {
  const insets  = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.min(windowHeight * 0.92, 820);
  const botPad  = Platform.OS === 'web' ? 32 : insets.bottom + 16;

  const { eventPrompt, eventMood } = useLocalSearchParams<{ eventPrompt?: string; eventMood?: string }>();
  const hasEventContext = !!eventPrompt;

  const sheetY    = useRef(new Animated.Value(sheetHeight)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    // Slide sheet in every time the Create tab is focused
    sheetY.setValue(sheetHeight);
    bgOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(sheetY,    { toValue: 0,   tension: 48, friction: 9,                         useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 1,   duration: 260, easing: Easing.out(Easing.quad),   useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mount-only entrance animation; Animated.Value refs are stable
  }, [sheetHeight]));

  function dismiss() {
    Animated.parallel([
      Animated.timing(sheetY,    { toValue: sheetHeight, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 0,        duration: 180,                                 useNativeDriver: true }),
    ]).start(() => {
      // Navigate back to the Home tab
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/(tabs)' as any);
    });
  }

  function selectMode(route: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.parallel([
      Animated.timing(sheetY,    { toValue: sheetHeight, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(bgOpacity, { toValue: 0,        duration: 160,                                 useNativeDriver: true }),
    ]).start(() => {
      if (hasEventContext) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push({ pathname: route as any, params: { eventPrompt, eventMood } });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(route as any);
      }
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
        style={[s.sheet, { height: sheetHeight, paddingBottom: botPad, transform: [{ translateY: sheetY }] }]}
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
        {hasEventContext ? (
          <View style={s.eventCtx}>
            <Text style={s.eventCtxLabel}>✦  Event prompt</Text>
            <Text style={s.eventCtxText} numberOfLines={3}>{eventPrompt}</Text>
          </View>
        ) : (
          <Text style={s.sheetSub}>What kind of story today?</Text>
        )}

        {/* Mode tiles — scroll independently on short phones/landscape */}
        <ScrollView
          style={s.tilesScroll}
          contentContainerStyle={s.tiles}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {MODES.map(mode => (
            <TouchableOpacity
              key={mode.id}
              style={[s.tile, mode.featured && s.featuredTile]}
              onPress={() => selectMode(mode.route)}
              activeOpacity={0.82}
            >
              <Image
                source={mode.image}
                style={s.tileArtwork}
                contentFit="cover"
                contentPosition="right center"
              />
              <LinearGradient
                colors={[
                  mode.id === 'quick' ? 'rgba(36,21,13,0.98)' : 'rgba(15,8,35,0.97)',
                  `${mode.color}45`,
                  'rgba(8,5,24,0.16)',
                ]}
                locations={[0, 0.58, 1]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
              />
              <View pointerEvents="none" style={[s.tileBorder, { borderColor: mode.border }]} />
              <View style={[s.iconWrap, { backgroundColor: `${mode.color}20`, borderColor: `${mode.color}A0` }]}>
                <Icon name={mode.icon} size={mode.featured ? 27 : 25} color={mode.color} />
              </View>
              <View style={s.tileText}>
                <Text style={s.tileName}>{mode.name}</Text>
                <Text style={s.tileDesc}>{mode.description}</Text>
              </View>
              <View style={[s.arrowBtn, { borderColor: `${mode.color}80` }]}>
                <Icon name="chevron-right" size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
    backgroundColor: '#08051C',
    borderTopLeftRadius:  30,
    borderTopRightRadius: 30,
    borderTopWidth:  1,
    borderColor:     'rgba(200,185,255,0.10)',
    paddingHorizontal: 12,
    paddingTop:      10,
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
    marginBottom:    14,
  },

  headerRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    4,
  },
  sheetTitle: {
    fontSize:    30,
    fontFamily:  'Satoshi-Black',
    color:       'rgba(248,244,255,0.97)',
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.09)',
    alignItems: 'center', justifyContent: 'center',
  },

  sheetSub: {
    fontSize:   14,
    fontFamily: 'Satoshi-Regular',
    color:      'rgba(200,185,255,0.40)',
    marginBottom: 16,
  },

  eventCtx: {
    backgroundColor: 'rgba(168,136,248,0.09)',
    borderWidth: 1, borderColor: 'rgba(168,136,248,0.20)',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16,
  },
  eventCtxLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.6,
    textTransform: 'uppercase', color: 'rgba(168,136,248,0.65)', marginBottom: 4,
  },
  eventCtxText: {
    fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    color: 'rgba(220,210,255,0.72)', lineHeight: 18,
  },

  tilesScroll: { flex: 1, minHeight: 0 },
  tiles: { gap: 10, paddingBottom: 4 },

  tile: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    height:          114,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     'transparent',
    backgroundColor: 'rgba(255,255,255,0.025)',
    paddingHorizontal: 12,
    paddingVertical:   12,
    overflow:        'hidden',
  },
  featuredTile: {
    height: 128,
  },
  tileArtwork: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '58%',
    height: '100%',
    opacity: 0.88,
  },
  tileBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.25,
    borderRadius: 18,
  },
  iconWrap: {
    width:          56,
    height:         56,
    borderRadius:   16,
    borderWidth:    1,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  tileText:  { flex: 1, minWidth: 0 },
  tileName:  { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: -0.3, marginBottom: 4, flexShrink: 1 },
  tileDesc:{
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(225,216,246,0.72)', lineHeight: 16,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,5,24,0.58)',
    flexShrink: 0,
  },

});
