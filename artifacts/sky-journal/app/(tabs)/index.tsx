import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/assets/images';
import { useApp } from '@/context/AppContext';
import { SHADOW } from '@/constants/colors';

// ── Category nav cards ─────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: 'moments',
    title: 'Moments & Friends',
    desc: 'Log special moments with friends',
    icon: 'users'     as const,
    iconColor: '#4A80B8',
    iconBg:    'rgba(74,128,184,0.16)',
    image: Images.story_bg2,
    route: '/(tabs)/log' as const,
  },
  {
    key: 'stories',
    title: 'Manga Stories',
    desc: 'Create and share your sky adventures',
    icon: 'layers'    as const,
    iconColor: '#6B5B95',
    iconBg:    'rgba(107,91,149,0.16)',
    image: Images.story_bg1,
    route: '/(tabs)/create' as const,
  },
  {
    key: 'discover',
    title: 'Collections',
    desc: 'View memories and stories from others',
    icon: 'compass'   as const,
    iconColor: '#3A9060',
    iconBg:    'rgba(58,144,96,0.16)',
    image: Images.story_bg3,
    route: '/(tabs)/discover' as const,
  },
  {
    key: 'outfit',
    title: 'Outfit Log',
    desc: 'Record and style your sky looks',
    icon: 'user'      as const,
    iconColor: '#C8A84B',
    iconBg:    'rgba(200,168,75,0.16)',
    image: Images.character_default,
    route: '/(tabs)/profile' as const,
  },
] as const;

// ── Sparkle dots ──────────────────────────────────────────────────────────────
const SPARKLES = [
  { t: 18, l: 22, s: 5, o: 0.55 },
  { t: 44, l: 56, s: 3, o: 0.35 },
  { t: 12, l: 120, s: 4, o: 0.45 },
  { t: 60, r: 28, s: 6, o: 0.5  },
  { t: 30, r: 70, s: 3, o: 0.3  },
  { t: 76, l: 88, s: 3, o: 0.28 },
  { t: 22, r: 140, s: 4, o: 0.38},
] as const;

// ── Main component ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    character, journalEntries, stories, rewards, dismissReward,
    outfits, activeOutfitId, setActiveOutfitId,
  } = useApp();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 28 : insets.bottom;

  const [showNotifs, setShowNotifs]         = useState(false);
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);
  const hasNotifs = rewards.length > 0;

  const latestEntry = journalEntries[0];
  const lastSeen    = latestEntry
    ? new Date(latestEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const activeOutfit = outfits.find(o => o.id === activeOutfitId) ?? null;

  return (
    <View style={styles.root}>

      {/* ── Dark navy header (NOT scrollable) ────────────────────── */}
      <LinearGradient
        colors={['#12102A', '#1E1A48', '#221E52']}
        style={[styles.headerGrad, { paddingTop: topPad }]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      >
        {/* Stars decoration */}
        {([
          { t:14, l:30, s:2 }, { t:28, r:50, s:3 }, { t:8, l:160, s:2 },
          { t:36, r:140, s:2 }, { t:22, l:220, s:3 }, { t:42, r:220, s:2 },
        ] as Array<{t:number; s:number; l?:number; r?:number}>).map((st, i) => (
          <View key={i} style={[styles.star, {
            top: st.t, left: st.l, right: st.r,
            width: st.s, height: st.s,
            opacity: 0.28 + i * 0.06,
          }]} />
        ))}

        {/* Top row: avatar + name/subtitle + icons */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.avatarRing} onPress={() => router.push('/(tabs)/profile')}>
            {activeOutfit?.imageUri ? (
              <Image source={{ uri: activeOutfit.imageUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <Image source={Images.character_default} style={styles.avatar} resizeMode="cover" />
            )}
          </TouchableOpacity>

          <View style={styles.nameBlock}>
            <Text style={styles.charName} numberOfLines={1}>
              {character.name || 'Sky Child'}
            </Text>
            <Text style={styles.subtitle}>Your journey, your memories.</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => router.push('/(tabs)/profile')}
            >
              <Feather name="settings" size={17} color="rgba(200,184,232,0.75)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => { setShowNotifs(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Feather name="bell" size={17} color="rgba(200,184,232,0.75)" />
              {hasNotifs && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statPill}>
            <Feather name="book-open" size={12} color="rgba(200,184,232,0.6)" />
            <Text style={styles.statPillText}>{journalEntries.length} entries</Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statPill}>
            <Feather name="layers" size={12} color="rgba(200,184,232,0.6)" />
            <Text style={styles.statPillText}>{stories.length} stories</Text>
          </View>
          {lastSeen && (
            <>
              <View style={styles.statDot} />
              <View style={styles.statPill}>
                <Feather name="clock" size={12} color="rgba(200,184,232,0.6)" />
                <Text style={styles.statPillText}>Last: {lastSeen}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Character / Outfit Hero ─────────────────────────────── */}
        <View style={styles.charHero}>
          {/* Sky gradient background */}
          <LinearGradient
            colors={['#C0B0DC', '#B4CAE8', '#CEC0E8', '#E8E0F8']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          {/* Sparkle decorations */}
          {SPARKLES.map((sp, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: sp.t,
                left:  'l' in sp ? (sp as any).l : undefined,
                right: 'r' in sp ? (sp as any).r : undefined,
                width: sp.s,
                height: sp.s,
                borderRadius: sp.s,
                backgroundColor: '#C8A84B',
                opacity: sp.o,
              }}
            />
          ))}

          {/* Section label */}
          <View style={styles.charHeroLabel}>
            <Text style={styles.charHeroLabelText}>MY SKY KID</Text>
          </View>

          {/* Character art — full bleed */}
          {activeOutfit?.imageUri ? (
            <Image
              source={{ uri: activeOutfit.imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={Images.character_default}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )}

          {/* Top gradient so label stays readable */}
          <LinearGradient
            colors={['rgba(18,16,42,0.55)', 'transparent']}
            style={styles.charHeroTopOverlay}
            pointerEvents="none"
          />

          {/* Bottom gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(18,16,42,0.78)']}
            style={styles.charHeroOverlay}
            pointerEvents="none"
          />

          {/* Edit button */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Feather name="edit-2" size={11} color="rgba(50,36,90,0.85)" />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>

          {/* Change outfit button */}
          {outfits.length > 0 && (
            <TouchableOpacity
              style={styles.changeOutfitBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowOutfitPicker(true);
              }}
            >
              <Feather name="refresh-cw" size={12} color="rgba(200,184,232,0.9)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── Category cards (scrollable) ──────────────────────────── */}
      <ScrollView
        style={styles.cardsArea}
        contentContainerStyle={[styles.cardsList, { paddingBottom: bottomPad + 82 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Character info card */}
        <TouchableOpacity
          style={styles.charInfoCard}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.88}
        >
          <View style={styles.charInfoLeft}>
            <View style={styles.charNameRow}>
              <Text style={styles.charInfoName}>{character.name || 'Sky Child'}</Text>
              <Text style={styles.charInfoStar}>✦</Text>
            </View>
            {character.bio ? (
              <Text style={styles.charInfoBio} numberOfLines={2}>{character.bio}</Text>
            ) : null}
            {character.traits.length > 0 && (
              <View style={styles.charInfoTraits}>
                {character.traits.slice(0, 4).map(t => (
                  <View key={t} style={styles.charInfoTrait}>
                    <Text style={styles.charInfoTraitText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <Feather name="chevron-right" size={16} color="#C0B4D8" />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Where would you like to go?</Text>

        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.catCard, SHADOW.sm]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(cat.route);
            }}
            activeOpacity={0.88}
          >
            <View style={styles.catLeft}>
              <View style={[styles.catIconCircle, { backgroundColor: cat.iconBg }]}>
                <Feather name={cat.icon} size={20} color={cat.iconColor} />
              </View>
              <View style={styles.catTexts}>
                <Text style={styles.catTitle}>{cat.title}</Text>
                <Text style={styles.catDesc}>{cat.desc}</Text>
              </View>
            </View>
            <View style={styles.catImageWrap}>
              <Image source={cat.image} style={styles.catImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(255,255,255,0.55)', 'transparent']}
                style={styles.catImageFade}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
            </View>
            <Feather name="chevron-right" size={16} color="#C0B4D8" style={styles.catChevron} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Outfit picker modal ───────────────────────────────────── */}
      <Modal
        visible={showOutfitPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOutfitPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowOutfitPicker(false)}>
          <Pressable
            style={[styles.pickerSheet, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 20 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose Display Outfit</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowOutfitPicker(false)}>
                <Feather name="x" size={16} color="#9A8EB4" />
              </TouchableOpacity>
            </View>
            <Text style={styles.pickerSub}>Selected outfit shows on your home & profile</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              {/* None option */}
              <TouchableOpacity
                style={[
                  styles.pickerCard,
                  !activeOutfitId && styles.pickerCardActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveOutfitId(null);
                  setShowOutfitPicker(false);
                }}
              >
                <View style={[styles.pickerCardImg, styles.pickerCardNone]}>
                  <Feather name="slash" size={22} color="#9A8EB4" />
                </View>
                <Text style={styles.pickerCardName}>None</Text>
                {!activeOutfitId && (
                  <View style={styles.pickerActiveDot}>
                    <Feather name="check" size={10} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {outfits.map(outfit => (
                <TouchableOpacity
                  key={outfit.id}
                  style={[
                    styles.pickerCard,
                    activeOutfitId === outfit.id && styles.pickerCardActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveOutfitId(outfit.id);
                    setShowOutfitPicker(false);
                  }}
                >
                  {outfit.imageUri ? (
                    <Image source={{ uri: outfit.imageUri }} style={styles.pickerCardImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.pickerCardImg, styles.pickerCardNoImg]}>
                      <Feather name="star" size={22} color="rgba(107,91,149,0.4)" />
                    </View>
                  )}
                  <Text style={styles.pickerCardName} numberOfLines={1}>{outfit.name}</Text>
                  {activeOutfitId === outfit.id && (
                    <View style={styles.pickerActiveDot}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Notifications modal ───────────────────────────────────── */}
      <Modal
        visible={showNotifs}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifs(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotifs(false)}>
          <Pressable
            style={[styles.notifsSheet, { paddingBottom: bottomPad + 20 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.notifsHeader}>
              <Text style={styles.notifsTitle}>Notifications</Text>
              {hasNotifs && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{rewards.length}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowNotifs(false)}
              >
                <Feather name="x" size={16} color="#9A8EB4" />
              </TouchableOpacity>
            </View>

            {rewards.length === 0 ? (
              <View style={styles.notifsEmpty}>
                <Feather name="bell-off" size={34} color="#C8B8E8" />
                <Text style={styles.notifsEmptyText}>You're all caught up ✦</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
                {rewards.map(r => (
                  <View key={r.id} style={[styles.notifItem, {
                    backgroundColor: r.isRising ? '#1A1630' : '#F8F5FF',
                    borderColor: r.isRising ? 'rgba(200,168,75,0.22)' : 'rgba(107,91,149,0.12)',
                  }]}>
                    <View style={[styles.notifIconWrap, { backgroundColor: r.isRising ? 'rgba(200,168,75,0.18)' : 'rgba(107,91,149,0.1)' }]}>
                      <Feather name={r.isRising ? 'trending-up' : (r.icon as any)} size={16} color={r.isRising ? '#C8A84B' : '#6B5B95'} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      {r.count !== undefined && (
                        <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, color: r.isRising ? '#C8A84B' : '#1E1830' }}>{r.count}</Text>
                      )}
                      <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, color: r.isRising ? 'rgba(240,234,248,0.85)' : '#6B6090' }}>{r.message}</Text>
                      {r.subMessage && (
                        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: r.isRising ? 'rgba(200,168,75,0.7)' : '#9A8EB4' }}>{r.subMessage}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.dismissBtn, { backgroundColor: r.isRising ? 'rgba(255,255,255,0.07)' : 'rgba(107,91,149,0.08)' }]}
                      onPress={() => dismissReward(r.id)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Feather name="x" size={12} color={r.isRising ? 'rgba(200,184,232,0.5)' : '#9A8EB4'} />
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
  root: { flex: 1, backgroundColor: '#F5F2EC' },

  // Header
  headerGrad: { position: 'relative', overflow: 'hidden' },
  star: { position: 'absolute', borderRadius: 99, backgroundColor: 'rgba(220,210,255,1)' },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(200,184,232,0.4)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatar: { width: '100%', height: '100%' },
  nameBlock: { flex: 1 },
  charName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: 'rgba(235,228,255,0.96)',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(200,184,232,0.6)',
    marginTop: 1,
  },
  headerIcons: { flexDirection: 'row', gap: 4 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.14)',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E04455',
    borderWidth: 1.5,
    borderColor: '#1E1A48',
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statPillText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.6)' },
  statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(200,184,232,0.3)' },

  // Character hero
  charHero: {
    position: 'relative',
    width: '100%',
    height: 300,
    overflow: 'hidden',
  },
  charHeroLabel: {
    position: 'absolute',
    top: 14,
    left: 16,
    zIndex: 10,
  },
  charHeroLabelText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
    color: 'rgba(235,228,255,0.95)',
    textShadowColor: 'rgba(18,16,42,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  charHeroTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 2,
  },
  charHeroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    zIndex: 2,
  },
  editBtn: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(107,91,149,0.22)',
  },
  editBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(50,36,90,0.9)',
  },
  changeOutfitBtn: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(26,22,48,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(200,184,232,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Character info card
  charInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE8F4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  charInfoLeft: { flex: 1, gap: 5 },
  charNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  charInfoName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#1E1830', letterSpacing: -0.4 },
  charInfoStar: { fontSize: 14, color: '#C8A84B' },
  charInfoBio: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: '#7A6E9A', lineHeight: 19 },
  charInfoTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  charInfoTrait: {
    backgroundColor: 'rgba(107,91,149,0.09)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(107,91,149,0.16)',
  },
  charInfoTraitText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#6B5B95' },

  // Cards section
  cardsArea: { flex: 1 },
  cardsList: { paddingHorizontal: 16, paddingTop: 18, gap: 12 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#9A8EB4',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  catCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE8F4',
    flexDirection: 'row',
    alignItems: 'center',
    height: 110,
    overflow: 'hidden',
  },
  catLeft: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  catIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTexts: { gap: 3 },
  catTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#1E1830', letterSpacing: -0.2 },
  catDesc:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9A8EB4', lineHeight: 17 },
  catImageWrap: {
    width: 130,
    height: '100%',
    position: 'relative',
    flexShrink: 0,
  },
  catImage: { width: '100%', height: '100%' },
  catImageFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 40,
  },
  catChevron: {
    position: 'absolute',
    right: 12,
    bottom: 14,
  },

  // Modals shared
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,8,28,0.5)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD5EE', alignSelf: 'center', marginBottom: 16 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0EAF8', alignItems: 'center', justifyContent: 'center' },

  // Outfit picker sheet
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 10 },
  pickerTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#2A1E50', flex: 1 },
  pickerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: '#9A8EB4', marginBottom: 18 },
  pickerRow: { gap: 12, paddingBottom: 8, paddingHorizontal: 2 },
  pickerCard: {
    width: 100,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EDE8F4',
    overflow: 'hidden',
    backgroundColor: '#FAFAF8',
    position: 'relative',
  },
  pickerCardActive: {
    borderColor: '#6B5B95',
    backgroundColor: 'rgba(107,91,149,0.04)',
  },
  pickerCardImg: { width: '100%', height: 120 },
  pickerCardNone: {
    backgroundColor: '#F0EAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCardNoImg: {
    backgroundColor: 'rgba(107,91,149,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCardName: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: '#3A2E60',
    paddingHorizontal: 8,
    paddingVertical: 8,
    lineHeight: 15,
  },
  pickerActiveDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6B5B95',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Notifications modal
  notifsSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 14, maxHeight: '80%' },
  notifsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  notifsTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#2A1E50', flex: 1 },
  countBadge: { backgroundColor: '#E04455', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  countText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#fff' },
  notifItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  notifIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dismissBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifsEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifsEmptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic', color: '#9A8EB4' },
});
