import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/assets/images';
import { useApp } from '@/context/AppContext';
import { SHADOW } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';

const CATEGORIES = [
  {
    key: 'moments',
    title: 'Moments & Friends',
    desc: 'Log encounters with sky friends',
    icon: 'users'   as const,
    iconColor: '#7AB8F0',
    iconBg:    'rgba(74,128,184,0.28)',
    image: Images.story_bg2,
    route: '/(tabs)/log' as const,
  },
  {
    key: 'stories',
    title: 'Manga Stories',
    desc: 'Tell your sky adventures in panels',
    icon: 'layers'  as const,
    iconColor: '#C0A8F0',
    iconBg:    'rgba(107,91,149,0.28)',
    image: Images.story_bg1,
    route: '/(tabs)/create' as const,
  },
  {
    key: 'discover',
    title: 'Discover',
    desc: 'Browse memories from the sky world',
    icon: 'compass' as const,
    iconColor: '#70D0A8',
    iconBg:    'rgba(58,144,96,0.28)',
    image: Images.story_bg3,
    route: '/(tabs)/discover' as const,
  },
  {
    key: 'outfit',
    title: 'Outfit Log',
    desc: 'Record and display your sky looks',
    icon: 'star'    as const,
    iconColor: '#F0D070',
    iconBg:    'rgba(200,168,75,0.28)',
    image: Images.character_default,
    route: '/(tabs)/profile' as const,
  },
] as const;

// Stars in the header
const HEADER_STARS = [
  { t: 14, l: 30,  s: 2 },
  { t: 28, r: 50,  s: 3 },
  { t: 8,  l: 160, s: 2 },
  { t: 36, r: 140, s: 2 },
  { t: 22, l: 220, s: 3 },
  { t: 42, r: 220, s: 2 },
] as const;

// Gold sparkles on the hero
const SPARKLES = [
  { t: 18, l: 22,  s: 5, o: 0.55 },
  { t: 44, l: 56,  s: 3, o: 0.35 },
  { t: 12, l: 120, s: 4, o: 0.45 },
  { t: 60, r: 28,  s: 6, o: 0.5  },
  { t: 30, r: 70,  s: 3, o: 0.3  },
  { t: 76, l: 88,  s: 3, o: 0.28 },
  { t: 22, r: 140, s: 4, o: 0.38 },
] as const;

export default function HomeScreen() {
  const colors  = useColors();
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    character, journalEntries, stories, rewards, dismissReward,
    outfits, activeOutfitId, setActiveOutfitId,
    serverNotifications, markServerNotificationsRead,
  } = useApp();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 28 : insets.bottom + 110;

  const [showNotifs,       setShowNotifs]       = useState(false);
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);
  const unreadServerCount = serverNotifications.filter(n => !n.isRead).length;
  const hasNotifs = rewards.length > 0 || unreadServerCount > 0;

  const latestEntry = journalEntries[0];
  const lastSeen    = latestEntry
    ? new Date(latestEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const activeOutfit = outfits.find(o => o.id === activeOutfitId) ?? null;

  // ── Animations ──────────────────────────────────────────────────────────────

  // Star twinkle – each header star pulses at a different rhythm
  const starAnims = useRef(HEADER_STARS.map(() => new Animated.Value(0.28))).current;

  // Gold sparkle shimmer
  const sparkleAnims = useRef(SPARKLES.map(sp => new Animated.Value(sp.o))).current;

  // Hero character float
  const heroFloat = useRef(new Animated.Value(0)).current;

  // Nav cards stagger entrance
  const cardAnims = useRef(
    CATEGORIES.map(() => ({
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(28),
    }))
  ).current;

  // Character info card entrance
  const infoCardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Star twinkle loops
    starAnims.forEach((anim, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.9 + (i % 3) * 0.03,
            duration: 800 + i * 180,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
          Animated.timing(anim, {
            toValue: 0.15 + (i % 2) * 0.08,
            duration: 1000 + i * 150,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
        ])
      );
      // Stagger each star
      setTimeout(() => loop.start(), i * 320);
    });

    // Sparkle shimmer loops
    sparkleAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.9,
            duration: 1400 + i * 200,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
          Animated.timing(anim, {
            toValue: 0.1,
            duration: 1200 + i * 180,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sin),
          }),
        ])
      ).start();
    });

    // Hero float — gentle sine wave
    Animated.loop(
      Animated.sequence([
        Animated.timing(heroFloat, {
          toValue: 1,
          duration: 3400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(heroFloat, {
          toValue: 0,
          duration: 3400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    ).start();

    // Info card fade in
    Animated.timing(infoCardAnim, {
      toValue: 1,
      duration: 500,
      delay: 60,
      useNativeDriver: true,
      easing: Easing.out(Easing.quad),
    }).start();

    // Nav cards staggered entrance — drift down from sky
    Animated.parallel(
      cardAnims.map((anim, i) =>
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 480,
            delay: 140 + i * 100,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          Animated.spring(anim.translateY, {
            toValue: 0,
            delay: 140 + i * 100,
            tension: 52,
            friction: 8,
            useNativeDriver: true,
          }),
        ])
      )
    ).start();
  }, []);

  const heroFloatY = heroFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -9],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Vivid header ──────────────────────────────────── */}
      <LinearGradient
        colors={['#140840', '#2E1498', '#5028B8']}
        style={[styles.headerGrad, { paddingTop: topPad }]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      >
        {/* Animated twinkling stars */}
        {(HEADER_STARS as ReadonlyArray<{ t: number; s: number; l?: number; r?: number }>).map((st, i) => (
          <Animated.View
            key={i}
            style={[
              styles.star,
              {
                top: st.t,
                left: (st as any).l,
                right: (st as any).r,
                width: st.s, height: st.s,
                opacity: starAnims[i],
              },
            ]}
          />
        ))}

        {/* Top row */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.avatarRing}
            onPress={() => router.push('/(tabs)/profile')}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            {activeOutfit?.imageUri
              ? <Image source={{ uri: activeOutfit.imageUri }} style={styles.avatar} contentFit="cover" />
              : <Image source={Images.character_default} style={styles.avatar} contentFit="cover" />
            }
          </TouchableOpacity>

          <View style={styles.nameBlock}>
            <Text style={styles.charName} numberOfLines={1}>{character.name || 'Sky Child'}</Text>
            <Text style={styles.subtitle}>Your journey, your memories.</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(200,184,232,0.18)' }]}
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Icon name="settings" size={18} color="rgba(220,210,255,0.85)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(200,184,232,0.18)' }]}
              onPress={() => { setShowNotifs(true); markServerNotificationsRead(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Icon name="bell" size={18} color="rgba(220,210,255,0.85)" />
              {hasNotifs && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statPill}>
            <Icon name="book-open" size={12} color="rgba(200,184,232,0.65)" />
            <Text style={styles.statPillText}>{journalEntries.length} entries</Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statPill}>
            <Icon name="layers" size={12} color="rgba(200,184,232,0.65)" />
            <Text style={styles.statPillText}>{stories.length} stories</Text>
          </View>
          {lastSeen && (
            <>
              <View style={styles.statDot} />
              <View style={styles.statPill}>
                <Icon name="clock" size={12} color="rgba(200,184,232,0.65)" />
                <Text style={styles.statPillText}>Last: {lastSeen}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Character Hero ─────────────────────────────────── */}
        <View style={[styles.charHero, { height: Math.round(screenW * 0.54) }]}>
          {/* Background gradient */}
          <LinearGradient
            colors={['#C0B0DC', '#B4CAE8', '#CEC0E8', '#E8E0F8']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          {/* Floating character image */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateY: heroFloatY }] }]}
          >
            {activeOutfit?.imageUri
              ? <Image source={{ uri: activeOutfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
              : <Image source={Images.character_default} style={StyleSheet.absoluteFill} contentFit="contain" />
            }
          </Animated.View>

          {/* Gradient overlays */}
          <LinearGradient
            colors={['rgba(18,16,42,0.5)', 'transparent']}
            style={styles.charHeroTopOverlay}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(15,13,30,0.95)']}
            style={styles.charHeroOverlay}
            pointerEvents="none"
          />

          {/* Animated gold sparkle dots */}
          {(SPARKLES as ReadonlyArray<{ t: number; s: number; o: number; l?: number; r?: number }>).map((sp, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                top: sp.t,
                left:  (sp as any).l,
                right: (sp as any).r,
                width: sp.s, height: sp.s, borderRadius: sp.s,
                backgroundColor: '#C8A84B',
                opacity: sparkleAnims[i],
              }}
            />
          ))}

          {/* Label */}
          <View style={styles.charHeroLabel}>
            <Text style={styles.charHeroLabelText}>MY SKY KID</Text>
            {activeOutfit && (
              <View style={styles.outfitNamePill}>
                <Icon name="star" size={9} color="rgba(200,168,75,0.9)" />
                <Text style={styles.outfitNameText} numberOfLines={1}>{activeOutfit.name}</Text>
              </View>
            )}
          </View>

          {/* Change outfit button */}
          {outfits.length > 0 && (
            <TouchableOpacity
              style={styles.changeOutfitBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowOutfitPicker(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="refresh-cw" size={14} color="rgba(200,184,232,0.9)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── Scrollable content ──────────────────────────────── */}
      <ScrollView
        style={styles.cardsArea}
        contentContainerStyle={[styles.cardsList, { paddingBottom: bottomPad + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Character info card — animated fade-in */}
        <Animated.View style={{ opacity: infoCardAnim }}>
          <TouchableOpacity
            style={[styles.charInfoCard, SHADOW.sm, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.86}
          >
            <View style={styles.charInfoLeft}>
              <View style={styles.charNameRow}>
                <Text style={[styles.charInfoName, { color: colors.foreground }]}>{character.name || 'Sky Child'}</Text>
                <Text style={[styles.charInfoStar, { color: colors.gold }]}>✦</Text>
              </View>
              {character.bio
                ? <Text style={[styles.charInfoBio, { color: colors.mutedForeground }]} numberOfLines={2}>{character.bio}</Text>
                : <Text style={[styles.charInfoBioEmpty, { color: `${colors.mutedForeground}80` }]}>Tap to set your character bio...</Text>
              }
              {character.traits.length > 0 && (
                <View style={styles.charInfoTraits}>
                  {character.traits.slice(0, 4).map(t => (
                    <View key={t} style={[styles.charInfoTrait, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                      <Text style={[styles.charInfoTraitText, { color: colors.primary }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.charInfoRight}>
              <Text style={[styles.charInfoCta, { color: colors.primary }]}>Edit</Text>
              <Icon name="chevron-right" size={14} color={`${colors.primary}80`} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Section label */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Where would you like to go?</Text>

        {/* ── Animated navigation cards ──────────────────────── */}
        <View style={styles.hList}>
          {CATEGORIES.map((cat, i) => (
            <Animated.View
              key={cat.key}
              style={{
                opacity: cardAnims[i].opacity,
                transform: [{ translateY: cardAnims[i].translateY }],
              }}
            >
              <TouchableOpacity
                style={[styles.hCard, SHADOW.sm]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push(cat.route);
                }}
                activeOpacity={0.86}
              >
                <Image source={cat.image} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient
                  colors={['rgba(12,10,26,0.94)', 'rgba(12,10,26,0.72)', 'rgba(12,10,26,0.14)']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={[styles.hCardIcon, { backgroundColor: cat.iconBg }]}>
                  <Icon name={cat.icon} size={16} color={cat.iconColor} />
                </View>
                <View style={styles.hCardLeft}>
                  <Text style={styles.hCardTitle}>{cat.title}</Text>
                  <Text style={styles.hCardDesc}>{cat.desc}</Text>
                </View>
                <View style={styles.hCardArrow}>
                  <Icon name="arrow-right" size={14} color="rgba(220,210,255,0.6)" />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* ── Outfit picker modal ──────────────────────────────── */}
      <Modal
        visible={showOutfitPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOutfitPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowOutfitPicker(false)}>
          <Pressable
            style={[styles.pickerSheet, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 24, backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: `${colors.primary}30` }]} />
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>Choose Display Outfit</Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.muted }]}
                onPress={() => setShowOutfitPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>Selected outfit shows on your home & profile</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.pickerCard, !activeOutfitId && { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` }]}
                onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(null); setShowOutfitPicker(false); }}
              >
                <View style={[styles.pickerCardImg, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="slash" size={22} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.pickerCardName, { color: colors.mutedForeground }]}>None</Text>
                {!activeOutfitId && (
                  <View style={[styles.pickerActiveDot, { backgroundColor: colors.primary }]}><Icon name="check" size={10} color="#fff" /></View>
                )}
              </TouchableOpacity>

              {outfits.map(outfit => (
                <TouchableOpacity
                  key={outfit.id}
                  style={[styles.pickerCard, activeOutfitId === outfit.id && { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` }]}
                  onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(outfit.id); setShowOutfitPicker(false); }}
                >
                  {outfit.imageUri
                    ? <Image source={{ uri: outfit.imageUri }} style={styles.pickerCardImg} contentFit="cover" />
                    : <View style={[styles.pickerCardImg, { backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }]}><Icon name="star" size={22} color={`${colors.primary}60`} /></View>
                  }
                  <Text style={[styles.pickerCardName, { color: colors.mutedForeground }]} numberOfLines={1}>{outfit.name}</Text>
                  {activeOutfitId === outfit.id && (
                    <View style={[styles.pickerActiveDot, { backgroundColor: colors.primary }]}><Icon name="check" size={10} color="#fff" /></View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Notifications modal ──────────────────────────────── */}
      <Modal
        visible={showNotifs}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifs(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotifs(false)}>
          <Pressable
            style={[styles.notifsSheet, { paddingBottom: bottomPad + 24, backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: `${colors.primary}30` }]} />
            <View style={styles.notifsHeader}>
              <Text style={[styles.notifsTitle, { color: colors.foreground }]}>Notifications</Text>
              {hasNotifs && (
                <View style={[styles.countBadge, { backgroundColor: colors.primary }]}><Text style={styles.countText}>{rewards.length}</Text></View>
              )}
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.muted }]}
                onPress={() => setShowNotifs(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {rewards.length === 0 && serverNotifications.length === 0 ? (
              <View style={styles.notifsEmpty}>
                <Icon name="bell-off" size={34} color={`${colors.mutedForeground}70`} />
                <Text style={[styles.notifsEmptyText, { color: colors.mutedForeground }]}>You're all caught up ✦</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
                {serverNotifications.length > 0 && serverNotifications.map(n => (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.notifItem, {
                      backgroundColor: 'rgba(120,86,255,0.07)',
                      borderColor: 'rgba(120,86,255,0.22)',
                    }]}
                    onPress={() => {
                      setShowNotifs(false);
                      if (n.type === 'new_story') {
                        router.push({ pathname: '/story/[id]', params: { id: n.refId, source: 'discover' } });
                      }
                    }}
                    activeOpacity={0.82}
                  >
                    <View style={[styles.notifIconWrap, { backgroundColor: `${colors.primary}28` }]}>
                      <Icon
                        name={n.type === 'new_story' ? 'book-open' : 'star'}
                        size={16}
                        color={colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>
                        {n.actorName}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, color: colors.mutedForeground }}>
                        {n.type === 'new_story' ? 'shared a new story' : 'added a new outfit'}{n.title ? `: "${n.title}"` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {rewards.map(r => (
                  <View key={r.id} style={[styles.notifItem, {
                    backgroundColor: r.isRising ? 'rgba(200,168,75,0.08)' : 'rgba(255,255,255,0.04)',
                    borderColor: r.isRising ? 'rgba(200,168,75,0.25)' : 'rgba(200,184,232,0.1)',
                  }]}>
                    <View style={[styles.notifIconWrap, {
                      backgroundColor: r.isRising ? `${colors.gold}30` : `${colors.primary}28`,
                    }]}>
                      <Icon
                        name={r.isRising ? 'trending-up' : (r.icon as any)}
                        size={16}
                        color={r.isRising ? colors.gold : colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      {r.count !== undefined && (
                        <Text style={{
                          fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.5,
                          color: r.isRising ? colors.gold : colors.foreground,
                        }}>
                          {r.count}
                        </Text>
                      )}
                      <Text style={{
                        fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18,
                        color: r.isRising ? colors.foreground : colors.mutedForeground,
                      }}>
                        {r.message}
                      </Text>
                      {r.subMessage && (
                        <Text style={{
                          fontSize: 11, fontFamily: 'Inter_400Regular',
                          color: r.isRising ? `${colors.gold}B0` : `${colors.mutedForeground}90`,
                        }}>
                          {r.subMessage}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.dismissBtn, { backgroundColor: colors.muted }]}
                      onPress={() => dismissReward(r.id)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Icon name="x" size={12} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080714' },

  headerGrad: { position: 'relative', overflow: 'hidden' },
  star:       { position: 'absolute', borderRadius: 99, backgroundColor: 'rgba(220,210,255,1)' },

  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 12,
  },
  avatarRing: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: 'rgba(200,184,232,0.45)',
    overflow: 'hidden', flexShrink: 0,
  },
  avatar:    { width: '100%', height: '100%' },
  nameBlock: { flex: 1 },
  charName:  { fontSize: 16, fontFamily: 'Inter_700Bold', color: 'rgba(235,228,255,0.97)', letterSpacing: -0.3 },
  subtitle:  { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.55)', marginTop: 2, letterSpacing: 0.1 },

  headerIcons:   { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 44, height: 44, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.14)',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 9, right: 9,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#E04455',
    borderWidth: 1.5, borderColor: '#1E1A48',
  },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 8, gap: 8,
  },
  statPill:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statPillText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.65)' },
  statDot:      { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(200,184,232,0.3)' },

  charHero:          { position: 'relative', width: '100%', overflow: 'hidden' },
  charHeroLabel:     { position: 'absolute', top: 14, left: 16, zIndex: 10, gap: 6 },
  charHeroLabelText: {
    fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.3,
    color: 'rgba(235,228,255,0.95)',
    textShadowColor: 'rgba(18,16,42,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  outfitNamePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(18,16,42,0.52)', borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(200,168,75,0.25)',
    alignSelf: 'flex-start',
  },
  outfitNameText:     { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(240,228,200,0.92)', letterSpacing: 0.2 },
  charHeroTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 2 },
  charHeroOverlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 130, zIndex: 2 },
  changeOutfitBtn: {
    position: 'absolute', bottom: 14, right: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },

  cardsArea: { flex: 1 },
  cardsList:  { paddingTop: 16, paddingHorizontal: 16 },

  charInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20, padding: 16,
    marginBottom: 22,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.12)',
  },
  charInfoLeft:     { flex: 1 },
  charInfoRight:    { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  charInfoCta:      { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: 'rgba(139,122,181,0.75)' },
  charNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  charInfoName:     { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#EDE8FF', letterSpacing: -0.3 },
  charInfoStar:     { fontSize: 12, color: '#C8A84B' },
  charInfoBio:      { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.72)', lineHeight: 19, fontStyle: 'italic', marginBottom: 8 },
  charInfoBioEmpty: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.38)', lineHeight: 19, fontStyle: 'italic', marginBottom: 8 },
  charInfoTraits:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  charInfoTrait:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(139,122,181,0.18)', borderWidth: 1, borderColor: 'rgba(139,122,181,0.32)' },
  charInfoTraitText:{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#C8B8EE' },

  sectionLabel: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(200,184,232,0.48)',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12,
  },

  hList: { gap: 10 },
  hCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, overflow: 'hidden',
    height: 96, gap: 12,
    paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.1)',
  },
  hCardIcon:  {
    width: 42, height: 42, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  hCardLeft:  { flex: 1, gap: 4 },
  hCardTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#EDE8FF', letterSpacing: -0.2 },
  hCardDesc:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(220,210,255,0.68)', lineHeight: 17 },
  hCardArrow: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(8,6,24,0.72)',
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(200,184,232,0.3)',
    alignSelf: 'center', marginBottom: 18,
  },

  pickerSheet: {
    backgroundColor: '#1C1840',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 16, paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.1)',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  pickerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#EDE8FF', letterSpacing: -0.3 },
  pickerSub:   { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.55)', fontStyle: 'italic', marginBottom: 18 },
  closeBtn:    {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  pickerRow: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  pickerCard: {
    width: 88, alignItems: 'center', gap: 8,
    borderRadius: 16, padding: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  pickerCardActive: { borderColor: 'rgba(139,122,181,0.55)', backgroundColor: 'rgba(139,122,181,0.1)' },
  pickerCardImg:    { width: 66, height: 66, borderRadius: 14, overflow: 'hidden' },
  pickerCardNone:   { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  pickerCardNoImg:  { backgroundColor: 'rgba(139,122,181,0.1)', alignItems: 'center', justifyContent: 'center' },
  pickerCardName:   { fontSize: 11, fontFamily: 'Inter_500Medium', color: 'rgba(200,184,232,0.75)', textAlign: 'center' },
  pickerActiveDot:  {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#8B7AB5',
    alignItems: 'center', justifyContent: 'center',
  },

  notifsSheet: {
    backgroundColor: '#1C1840',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 16, paddingHorizontal: 20,
    maxHeight: '72%',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.1)',
  },
  notifsHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 18,
  },
  notifsTitle:    { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#EDE8FF', flex: 1, letterSpacing: -0.3 },
  countBadge:     { backgroundColor: '#8B7AB5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText:      { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' },
  notifsEmpty:    { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifsEmptyText:{ fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.5)', fontStyle: 'italic' },
  notifItem:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  notifIconWrap:  { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dismissBtn:     { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
