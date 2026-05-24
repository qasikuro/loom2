import { Icon } from '@/components/Icon';
import { FriendProfileSheet, type FriendSummary } from '@/components/FriendProfileSheet';
import { BlurView } from 'expo-blur';
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
import { Swipeable } from 'react-native-gesture-handler';
import { apiFetch, useApp } from '@/context/AppContext';
import { SHADOW } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from 'react-i18next';

const FRIEND_MOOD_COLORS: Record<string, string> = {
  Hopeful: '#6BA57A', Peaceful: '#5B9BB5', Lonely: '#5D7BA5',
  Romantic: '#B86098', Chaotic: '#B85830', Dreamy: '#9B7AB5',
  Soft: '#7B6BAA', Adventurous: '#3A9060',
};

const CATEGORIES = [
  {
    key: 'flames',
    title: 'App Flames and Energy System',
    desc: 'Track your celestial flames and energy',
    icon: 'zap'     as const,
    iconColor: '#F0C060',
    iconBg:    'rgba(200,160,40,0.28)',
    image: Images.story_bg1,
  },
  {
    key: 'guides',
    title: 'Guides and Video',
    desc: 'Explore sky tutorials and walkthroughs',
    icon: 'play-circle' as const,
    iconColor: '#A8D8F0',
    iconBg:    'rgba(60,140,190,0.28)',
    image: Images.story_bg2,
  },
  {
    key: 'marketplace',
    title: 'Marketplace',
    desc: 'Trade items and discover rare finds',
    icon: 'shopping-bag' as const,
    iconColor: '#C0A8F0',
    iconBg:    'rgba(107,91,149,0.28)',
    image: Images.story_bg3,
  },
  {
    key: 'discovers',
    title: 'Discovers',
    desc: 'Uncover hidden realms and sky secrets',
    icon: 'compass' as const,
    iconColor: '#70D0A8',
    iconBg:    'rgba(58,144,96,0.28)',
    image: Images.character_default,
  },
  {
    key: 'connections',
    title: 'Connections and Requests',
    desc: 'Manage your sky friendships and bonds',
    icon: 'users'   as const,
    iconColor: '#F0A8C0',
    iconBg:    'rgba(180,80,120,0.28)',
    image: Images.story_bg1,
  },
];

// Stars in the header — restrained, 3 only
const HEADER_STARS = [
  { t: 16, l: 42,  s: 2 },
  { t: 26, r: 60,  s: 2 },
  { t: 10, l: 180, s: 1.5 },
] as const;

// Gold sparkle accents on the hero — 2 max
const SPARKLES = [
  { t: 20, l: 28,  s: 4, o: 0.40 },
  { t: 55, r: 32,  s: 3, o: 0.30 },
] as const;

export default function HomeScreen() {
  const colors  = useColors();
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    character, journalEntries, stories, rewards, dismissReward,
    outfits, activeOutfitId, setActiveOutfitId,
    serverNotifications, markServerNotificationsRead, deleteServerNotification,
    followingIds,
  } = useApp();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  // Tab bar height (64) + safe area + breathing room
  const bottomPad = Platform.OS === 'web' ? 84 : insets.bottom + 90;

  const [showNotifs,       setShowNotifs]       = useState(false);
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);

  // Friends
  const [friends,         setFriends]         = useState<FriendSummary[]>([]);
  const [selectedFriend,  setSelectedFriend]  = useState<FriendSummary | null>(null);
  const [friendSheetOpen, setFriendSheetOpen] = useState(false);
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

  // Load friends whenever following list changes
  useEffect(() => {
    if (followingIds.length === 0) { setFriends([]); return; }
    apiFetch<FriendSummary[]>('/friends')
      .then(data => setFriends(data))
      .catch(() => {});
  }, [followingIds.length]);

  const heroFloatY = heroFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -9],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Vivid header ──────────────────────────────────── */}
      <LinearGradient
        colors={['#0A0818', '#18083A', '#2A1262']}
        style={[styles.headerGrad, { paddingTop: topPad }]}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
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

          <TouchableOpacity
            style={styles.nameBlock}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 4 }}
          >
            <Text style={styles.charName} numberOfLines={1}>{character.name || t('home.skyChild')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          </TouchableOpacity>

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
            <Text style={styles.statPillText}>{t('home.entries', { n: journalEntries.length })}</Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statPill}>
            <Icon name="layers" size={12} color="rgba(200,184,232,0.65)" />
            <Text style={styles.statPillText}>{t('home.stories', { n: stories.length })}</Text>
          </View>
          {lastSeen && (
            <>
              <View style={styles.statDot} />
              <View style={styles.statPill}>
                <Icon name="clock" size={12} color="rgba(200,184,232,0.65)" />
                <Text style={styles.statPillText}>{t('home.lastSeen', { date: lastSeen })}</Text>
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
            <Text style={styles.charHeroLabelText}>{t('home.mySkykid')}</Text>
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
        contentContainerStyle={[styles.cardsList, { paddingBottom: bottomPad }]}
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
                <Text style={[styles.charInfoName, { color: colors.foreground }]}>{character.name || t('home.skyChild')}</Text>
                <Text style={[styles.charInfoStar, { color: colors.gold }]}>✦</Text>
              </View>
              {character.bio
                ? <Text style={[styles.charInfoBio, { color: colors.mutedForeground }]} numberOfLines={2}>{character.bio}</Text>
                : <Text style={[styles.charInfoBioEmpty, { color: `${colors.mutedForeground}80` }]}>{t('home.tapBio')}</Text>
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
              <Text style={[styles.charInfoCta, { color: colors.primary }]}>{t('home.edit')}</Text>
              <Icon name="chevron-right" size={14} color={`${colors.primary}80`} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Friends section ──────────────────────────────── */}
        <View style={styles.friendsSection}>
          <Text style={[styles.friendsLabel, { color: colors.mutedForeground }]}>Friends</Text>
          {friends.length === 0 ? (
            <TouchableOpacity
              style={[styles.friendsEmptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/(tabs)/discover')}
              activeOpacity={0.82}
            >
              <View style={[styles.friendsEmptyIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Icon name="users" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.friendsEmptyTitle, { color: colors.foreground }]}>No friends yet</Text>
                <Text style={[styles.friendsEmptySub, { color: colors.mutedForeground }]}>Find people to follow in Discover</Text>
              </View>
              <Icon name="chevron-right" size={14} color={`${colors.primary}70`} />
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
              {friends.map(friend => {
                const initial   = friend.name.charAt(0).toUpperCase();
                const moodColor = FRIEND_MOOD_COLORS[friend.mood] ?? '#6B5B95';
                return (
                  <TouchableOpacity
                    key={friend.userId}
                    style={styles.friendBubbleWrap}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFriend(friend);
                      setFriendSheetOpen(true);
                    }}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.friendBubble, { borderColor: `${moodColor}55` }]}>
                      {friend.avatarUri ? (
                        <Image
                          source={{ uri: friend.avatarUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <LinearGradient
                          colors={[`${moodColor}60`, `${moodColor}25`]}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      {!friend.avatarUri && (
                        <Text style={[styles.friendBubbleInitial, { color: moodColor }]}>{initial}</Text>
                      )}
                    </View>
                    <Text style={[styles.friendBubbleName, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {friend.username ? `@${friend.username}` : friend.name.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Section label */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t('home.featuresBeingAdded')}</Text>

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
                onPress={() => {}}
                activeOpacity={1}
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

                {true && (
                  <BlurView
                    intensity={Platform.OS === 'web' ? 16 : 32}
                    tint="dark"
                    style={[StyleSheet.absoluteFill, styles.lockedOverlay]}
                    pointerEvents="none"
                  >
                    <View style={styles.lockPill}>
                      <Icon name="lock" size={10} color="rgba(210,200,255,0.72)" />
                      <Text style={styles.lockLabel}>Soon</Text>
                    </View>
                  </BlurView>
                )}
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
              <Text style={[styles.pickerTitle, { color: colors.foreground }]}>{t('home.chooseOutfit')}</Text>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: colors.muted }]}
                onPress={() => setShowOutfitPicker(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.pickerSub, { color: colors.mutedForeground }]}>{t('home.outfitSubtitle')}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.pickerCard, !activeOutfitId && { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40` }]}
                onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(null); setShowOutfitPicker(false); }}
              >
                <View style={[styles.pickerCardImg, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name="slash" size={22} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.pickerCardName, { color: colors.mutedForeground }]}>{t('home.none')}</Text>
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
                  <Swipeable
                    key={n.id}
                    renderRightActions={() => (
                      <TouchableOpacity
                        style={styles.swipeDelete}
                        onPress={() => deleteServerNotification(n.id)}
                      >
                        <Icon name="trash-2" size={17} color="#fff" />
                      </TouchableOpacity>
                    )}
                    overshootRight={false}
                  >
                    <TouchableOpacity
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
                        <Text style={{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: colors.foreground }}>
                          {n.actorName}
                        </Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Satoshi-Regular', lineHeight: 17, color: colors.mutedForeground }}>
                          {n.type === 'new_story' ? 'shared a new story' : 'added a new outfit'}{n.title ? `: "${n.title}"` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
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
                          fontSize: 20, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5,
                          color: r.isRising ? colors.gold : colors.foreground,
                        }}>
                          {r.count}
                        </Text>
                      )}
                      <Text style={{
                        fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 18,
                        color: r.isRising ? colors.foreground : colors.mutedForeground,
                      }}>
                        {r.message}
                      </Text>
                      {r.subMessage && (
                        <Text style={{
                          fontSize: 11, fontFamily: 'Satoshi-Regular',
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

      {/* ── Friend profile sheet ─────────────────────────────── */}
      <FriendProfileSheet
        friend={selectedFriend}
        visible={friendSheetOpen}
        onClose={() => { setFriendSheetOpen(false); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080714' },

  headerGrad: { position: 'relative', overflow: 'hidden' },
  star:       { position: 'absolute', borderRadius: 99, backgroundColor: 'rgba(220,210,255,1)' },

  topRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12,
  },
  avatarRing: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: 'rgba(180,140,255,0.55)',
    overflow: 'hidden', flexShrink: 0,
    shadowColor: '#9B78FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  avatar:    { width: '100%', height: '100%' },
  nameBlock: { flex: 1 },
  charName:  { fontSize: 17, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.5 },
  subtitle:  { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(210,196,240,0.50)', marginTop: 2, letterSpacing: 0.3 },

  headerIcons:   { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.14)',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#E04455',
    borderWidth: 1.5, borderColor: '#1A1638',
  },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12, gap: 8,
  },
  statPill:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statPillText: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.52)' },
  statDot:      { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(200,184,232,0.25)' },

  charHero:          { position: 'relative', width: '100%', overflow: 'hidden' },
  charHeroLabel:     { position: 'absolute', top: 12, left: 16, zIndex: 10, gap: 5 },
  charHeroLabelText: {
    fontSize: 12, fontFamily: 'Satoshi-Bold', letterSpacing: 0.4,
    color: 'rgba(220,210,255,0.72)',
    textTransform: 'uppercase',
  },
  outfitNamePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(12,10,24,0.60)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(200,168,75,0.20)',
    alignSelf: 'flex-start',
  },
  outfitNameText:     { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(232,220,190,0.88)', letterSpacing: 0.1 },
  charHeroTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 64, zIndex: 2 },
  charHeroOverlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 110, zIndex: 2 },
  changeOutfitBtn: {
    position: 'absolute', bottom: 12, right: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },

  cardsArea: { flex: 1 },
  cardsList:  { paddingTop: 20, paddingHorizontal: 16 },

  charInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#27243E',
    borderRadius: 22, padding: 18,
    marginBottom: 22,
    borderWidth: 1, borderColor: 'rgba(160,120,255,0.14)',
    shadowColor: '#7040C0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 6,
  },
  charInfoLeft:     { flex: 1 },
  charInfoRight:    { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  charInfoCta:      { fontSize: 11, fontFamily: 'Satoshi-Bold', color: 'rgba(200,160,255,0.72)' },
  charNameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  charInfoName:     { fontSize: 17, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.4 },
  charInfoStar:     { fontSize: 11, color: '#D4A840' },
  charInfoBio:      { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(210,196,240,0.72)', lineHeight: 19, fontStyle: 'italic', marginBottom: 10 },
  charInfoBioEmpty: { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(210,196,240,0.32)', lineHeight: 19, fontStyle: 'italic', marginBottom: 10 },
  charInfoTraits:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  charInfoTrait:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(155,120,255,0.14)', borderWidth: 1, borderColor: 'rgba(155,120,255,0.28)' },
  charInfoTraitText:{ fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(210,196,240,0.85)' },

  sectionLabel: {
    fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(210,196,240,0.45)',
    letterSpacing: 2.0, textTransform: 'uppercase', marginBottom: 12,
  },

  hList: { gap: 12 },
  hCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, overflow: 'hidden',
    height: 86, gap: 14,
    paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.09)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 5,
  },
  hCardIcon:  {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  hCardLeft:  { flex: 1, gap: 4 },
  hCardTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.3 },
  hCardDesc:  { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(210,196,240,0.58)', lineHeight: 17 },
  hCardArrow: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  lockedOverlay: {
    borderRadius: 20,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 12,
    backgroundColor: Platform.OS === 'web' ? 'rgba(6,5,18,0.60)' : undefined,
  },
  lockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(10,8,24,0.70)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.16)',
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  lockLabel: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(200,184,232,0.65)', letterSpacing: 0.3,
  },

  // Friends row
  friendsSection: { marginTop: 0, marginBottom: 24 },
  friendsLabel: {
    fontSize: 10, fontFamily: 'Satoshi-Bold',
    textTransform: 'uppercase', letterSpacing: 2.0,
    marginBottom: 14, paddingHorizontal: 0,
    color: 'rgba(210,196,240,0.48)',
  },
  friendsRow: { gap: 16, paddingVertical: 4, paddingHorizontal: 2 },
  friendBubbleWrap: { alignItems: 'center', gap: 6, width: 64 },
  friendBubble: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#9B78FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  friendBubbleInitial: { fontSize: 20, fontFamily: 'Satoshi-Bold' },
  friendBubbleName: {
    fontSize: 10, fontFamily: 'Satoshi-Medium',
    textAlign: 'center', maxWidth: 62,
    color: 'rgba(210,196,240,0.65)',
  },
  friendsEmptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 15,
    backgroundColor: '#27243E',
    borderColor: 'rgba(155,120,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 3,
  },
  friendsEmptyIcon: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  friendsEmptyTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  friendsEmptySub:   { fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 3 },

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
    backgroundColor: '#0E0B22',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 16, paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.08)',
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  pickerTitle: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.2 },
  pickerSub:   { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)', fontStyle: 'italic', marginBottom: 14 },
  closeBtn:    {
    width: 32, height: 32, borderRadius: 16,
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
  pickerCardName:   { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.75)', textAlign: 'center' },
  pickerActiveDot:  {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#8B7AB5',
    alignItems: 'center', justifyContent: 'center',
  },

  notifsSheet: {
    backgroundColor: '#0E0B22',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 16, paddingHorizontal: 20,
    maxHeight: '72%',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.08)',
  },
  notifsHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 18,
  },
  notifsTitle:    { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', flex: 1, letterSpacing: -0.3 },
  countBadge:     { backgroundColor: '#8B7AB5', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText:      { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#fff' },
  notifsEmpty:    { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifsEmptyText:{ fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.5)', fontStyle: 'italic' },
  notifItem:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  swipeDelete:    { width: 64, alignSelf: 'stretch', backgroundColor: '#C0392B', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  notifIconWrap:  { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dismissBtn:     { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
