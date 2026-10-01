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
import { SecureImage as Image } from '@/components/SecureImage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/useColors';

const MODES = [
  {
    id:          'quick',
    icon:        'star'        as const,
    nameKey:     'feature.create.quick',
    descriptionKey: 'feature.create.quickDesc',
    color:       '#FFD05B',
    border:      '#F8C84A',
    image:       Images.story_bg3,
    featured:    true,
    route:       '/quick-moment',
  },
  {
    id:          'journal',
    icon:        'feather'     as const,
    nameKey:     'feature.create.journal',
    descriptionKey: 'feature.create.journalDesc',
    color:       '#B58CFF',
    border:      '#8054D8',
    image:       Images.create_quick,
    featured:    false,
    route:       '/(tabs)/log',
  },
  {
    id:          'chapter',
    icon:        'book-open'   as const,
    nameKey:     'feature.create.chapter',
    descriptionKey: 'feature.create.chapterDesc',
    color:       '#A968FF',
    border:      '#7D3DDE',
    image:       Images.create_chapter,
    featured:    false,
    route:       '/chapter-editor',
  },
  {
    id:          'video',
    icon:        'video'       as const,
    nameKey:     'feature.create.video',
    descriptionKey: 'feature.create.videoDesc',
    color:       '#FF68A8',
    border:      '#D63388',
    image:       Images.create_video,
    featured:    false,
    route:       '/post-video',
  },
  {
    id:          'dashboard',
    icon:        'trending-up' as const,
    nameKey:     'feature.create.dashboard',
    descriptionKey: 'feature.create.dashboardDesc',
    color:       '#42E0D0',
    border:      '#18AFA9',
    image:       Images.create_dashboard,
    featured:    false,
    route:       '/creator-dashboard',
  },
] as const;

export default function CreateScreen() {
  const { t } = useTranslation();
  const colors = useColors();
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
        style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border, height: sheetHeight, paddingBottom: botPad, transform: [{ translateY: sheetY }] }]}
        pointerEvents="box-none"
      >
        {/* Drag handle */}
        <View style={s.handle} />

        {/* Header row */}
        <View style={s.headerRow}>
          <Text style={[s.sheetTitle, { color: colors.foreground }]}>{t('feature.create.title')}</Text>
          <TouchableOpacity style={[s.closeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
        {hasEventContext ? (
            <View style={[s.eventCtx, { backgroundColor: `${colors.secondary}10`, borderColor: `${colors.secondary}30` }]}>
            <Text style={[s.eventCtxLabel, { color: colors.secondary }]}>✦  {t('feature.create.eventPrompt')}</Text>
            <Text style={[s.eventCtxText, { color: colors.foreground }]} numberOfLines={3}>{eventPrompt}</Text>
          </View>
        ) : (
          <Text style={[s.sheetSub, { color: colors.mutedForeground }]}>{t('feature.create.subtitle')}</Text>
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
              <Text style={s.tileName} numberOfLines={1}>{t(mode.nameKey)}</Text>
              <Text style={s.tileDesc} numberOfLines={3}>{t(mode.descriptionKey)}</Text>
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
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  sheetSub: {
    fontSize:   14,
    fontFamily: 'Satoshi-Regular',
    marginBottom: 16,
  },

  eventCtx: {
    borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16,
  },
  eventCtxLabel: {
    fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.6,
    textTransform: 'uppercase', marginBottom: 4,
  },
  eventCtxText: {
    fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic',
    lineHeight: 18,
  },

  tilesScroll: { flex: 1, minHeight: 0 },
  tiles: { gap: 10, paddingBottom: 4 },

  tile: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    minHeight:       114,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     'transparent',
    backgroundColor: 'rgba(255,255,255,0.025)',
    paddingHorizontal: 12,
    paddingVertical:   12,
    overflow:        'hidden',
  },
  featuredTile: {
    minHeight: 128,
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
  tileText:  { flex: 1, minWidth: 0, justifyContent: 'center' },
  tileName:  {
    fontSize: 18, lineHeight: 22, fontFamily: 'Satoshi-Bold',
    color: '#FFFFFF', letterSpacing: -0.3, marginBottom: 4, flexShrink: 1,
  },
  tileDesc:{
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(225,216,246,0.72)', lineHeight: 17,
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
