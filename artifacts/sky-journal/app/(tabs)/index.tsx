import { Icon } from '@/components/Icon';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/assets/images';
import { useApp } from '@/context/AppContext';
import { SHADOW } from '@/constants/colors';

const CATEGORIES = [
  {
    key: 'moments',
    title: 'Moments & Friends',
    desc: 'Log encounters with sky friends',
    icon: 'users'   as const,
    iconColor: '#4A80B8',
    iconBg:    'rgba(74,128,184,0.22)',
    grad: ['#1A2E50', '#263D6A'],
    image: Images.story_bg2,
    route: '/(tabs)/log' as const,
  },
  {
    key: 'stories',
    title: 'Manga Stories',
    desc: 'Tell your sky adventures in panels',
    icon: 'layers'  as const,
    iconColor: '#9B8AC4',
    iconBg:    'rgba(107,91,149,0.22)',
    grad: ['#2A1E50', '#3D2D70'],
    image: Images.story_bg1,
    route: '/(tabs)/create' as const,
  },
  {
    key: 'discover',
    title: 'Discover',
    desc: 'Browse memories from the sky world',
    icon: 'compass' as const,
    iconColor: '#4A9878',
    iconBg:    'rgba(58,144,96,0.22)',
    grad: ['#162A22', '#1E3A2E'],
    image: Images.story_bg3,
    route: '/(tabs)/discover' as const,
  },
  {
    key: 'outfit',
    title: 'Outfit Log',
    desc: 'Record and display your sky looks',
    icon: 'star'    as const,
    iconColor: '#C8A84B',
    iconBg:    'rgba(200,168,75,0.22)',
    grad: ['#2A2010', '#3A2E18'],
    image: Images.character_default,
    route: '/(tabs)/profile' as const,
  },
] as const;

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
  const insets = useSafeAreaInsets();
  const {
    character, journalEntries, stories, rewards, dismissReward,
    outfits, activeOutfitId, setActiveOutfitId,
  } = useApp();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 28 : insets.bottom;

  const [showNotifs,      setShowNotifs]      = useState(false);
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);
  const hasNotifs = rewards.length > 0;

  const latestEntry = journalEntries[0];
  const lastSeen    = latestEntry
    ? new Date(latestEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  const activeOutfit = outfits.find(o => o.id === activeOutfitId) ?? null;

  return (
    <View style={styles.root}>

      {/* ── Dark navy header ──────────────────────────────────────── */}
      <LinearGradient
        colors={['#12102A', '#1E1A48', '#221E52']}
        style={[styles.headerGrad, { paddingTop: topPad }]}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      >
        {/* Stars */}
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

        {/* Top row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.avatarRing} onPress={() => router.push('/(tabs)/profile')}>
            {activeOutfit?.imageUri
              ? <Image source={{ uri: activeOutfit.imageUri }} style={styles.avatar} resizeMode="cover" />
              : <Image source={Images.character_default} style={styles.avatar} resizeMode="cover" />
            }
          </TouchableOpacity>

          <View style={styles.nameBlock}>
            <Text style={styles.charName} numberOfLines={1}>{character.name || 'Sky Child'}</Text>
            <Text style={styles.subtitle}>Your journey, your memories.</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/(tabs)/profile')}>
              <Icon name="settings" size={17} color="rgba(200,184,232,0.75)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => { setShowNotifs(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Icon name="bell" size={17} color="rgba(200,184,232,0.75)" />
              {hasNotifs && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statPill}>
            <Icon name="book-open" size={12} color="rgba(200,184,232,0.6)" />
            <Text style={styles.statPillText}>{journalEntries.length} entries</Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statPill}>
            <Icon name="layers" size={12} color="rgba(200,184,232,0.6)" />
            <Text style={styles.statPillText}>{stories.length} stories</Text>
          </View>
          {lastSeen && (
            <>
              <View style={styles.statDot} />
              <View style={styles.statPill}>
                <Icon name="clock" size={12} color="rgba(200,184,232,0.6)" />
                <Text style={styles.statPillText}>Last: {lastSeen}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Character Hero ──────────────────────────────────────── */}
        <View style={styles.charHero}>
          <LinearGradient
            colors={['#C0B0DC', '#B4CAE8', '#CEC0E8', '#E8E0F8']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          {SPARKLES.map((sp, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: sp.t,
                left:  'l' in sp ? (sp as any).l : undefined,
                right: 'r' in sp ? (sp as any).r : undefined,
                width: sp.s, height: sp.s, borderRadius: sp.s,
                backgroundColor: '#C8A84B',
                opacity: sp.o,
              }}
            />
          ))}

          <View style={styles.charHeroLabel}>
            <Text style={styles.charHeroLabelText}>MY SKY KID</Text>
            {activeOutfit && (
              <View style={styles.outfitNamePill}>
                <Icon name="star" size={9} color="rgba(200,168,75,0.9)" />
                <Text style={styles.outfitNameText} numberOfLines={1}>{activeOutfit.name}</Text>
              </View>
            )}
          </View>

          {activeOutfit?.imageUri
            ? <Image source={{ uri: activeOutfit.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <Image source={Images.character_default} style={StyleSheet.absoluteFill} resizeMode="cover" />
          }

          <LinearGradient colors={['rgba(18,16,42,0.5)', 'transparent']} style={[styles.charHeroTopOverlay, { pointerEvents: 'none' }]} />
          <LinearGradient colors={['transparent', 'rgba(18,16,42,0.82)']} style={[styles.charHeroOverlay, { pointerEvents: 'none' }]} />

          {outfits.length > 0 && (
            <TouchableOpacity
              style={styles.changeOutfitBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowOutfitPicker(true); }}
            >
              <Icon name="refresh-cw" size={13} color="rgba(200,184,232,0.9)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── Scrollable content ─────────────────────────────────────── */}
      <ScrollView
        style={styles.cardsArea}
        contentContainerStyle={[styles.cardsList, { paddingBottom: bottomPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Character info */}
        <TouchableOpacity
          style={[styles.charInfoCard, SHADOW.sm]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.88}
        >
          <View style={styles.charInfoLeft}>
            <View style={styles.charNameRow}>
              <Text style={styles.charInfoName}>{character.name || 'Sky Child'}</Text>
              <Text style={styles.charInfoStar}>✦</Text>
            </View>
            {character.bio
              ? <Text style={styles.charInfoBio} numberOfLines={2}>{character.bio}</Text>
              : <Text style={styles.charInfoBioEmpty}>Tap to set your character bio...</Text>
            }
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
          <Icon name="chevron-right" size={16} color="#C0B4D8" />
        </TouchableOpacity>

        {/* Section label */}
        <Text style={styles.sectionLabel}>Where would you like to go?</Text>

        {/* ── Horizontal slim cards ────────────────────────────────── */}
        <View style={styles.hList}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.hCard, SHADOW.sm]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push(cat.route); }}
              activeOpacity={0.88}
            >
              {/* Text */}
              <View style={styles.hCardLeft}>
                <Text style={styles.hCardTitle}>{cat.title}</Text>
                <Text style={styles.hCardDesc}>{cat.desc}</Text>
              </View>

              {/* Image */}
              <Image source={cat.image} style={styles.hCardImage} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Outfit picker modal ──────────────────────────────────── */}
      <Modal visible={showOutfitPicker} transparent animationType="slide" onRequestClose={() => setShowOutfitPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOutfitPicker(false)}>
          <Pressable
            style={[styles.pickerSheet, { paddingBottom: (Platform.OS === 'web' ? 28 : insets.bottom) + 20 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose Display Outfit</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowOutfitPicker(false)}>
                <Icon name="x" size={16} color="#9A8EB4" />
              </TouchableOpacity>
            </View>
            <Text style={styles.pickerSub}>Selected outfit shows on your home & profile</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              <TouchableOpacity
                style={[styles.pickerCard, !activeOutfitId && styles.pickerCardActive]}
                onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(null); setShowOutfitPicker(false); }}
              >
                <View style={[styles.pickerCardImg, styles.pickerCardNone]}>
                  <Icon name="slash" size={22} color="#9A8EB4" />
                </View>
                <Text style={styles.pickerCardName}>None</Text>
                {!activeOutfitId && (
                  <View style={styles.pickerActiveDot}><Icon name="check" size={10} color="#fff" /></View>
                )}
              </TouchableOpacity>

              {outfits.map(outfit => (
                <TouchableOpacity
                  key={outfit.id}
                  style={[styles.pickerCard, activeOutfitId === outfit.id && styles.pickerCardActive]}
                  onPress={() => { Haptics.selectionAsync(); setActiveOutfitId(outfit.id); setShowOutfitPicker(false); }}
                >
                  {outfit.imageUri
                    ? <Image source={{ uri: outfit.imageUri }} style={styles.pickerCardImg} resizeMode="cover" />
                    : <View style={[styles.pickerCardImg, styles.pickerCardNoImg]}><Icon name="star" size={22} color="rgba(107,91,149,0.4)" /></View>
                  }
                  <Text style={styles.pickerCardName} numberOfLines={1}>{outfit.name}</Text>
                  {activeOutfitId === outfit.id && (
                    <View style={styles.pickerActiveDot}><Icon name="check" size={10} color="#fff" /></View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Notifications modal ──────────────────────────────────── */}
      <Modal visible={showNotifs} transparent animationType="slide" onRequestClose={() => setShowNotifs(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotifs(false)}>
          <Pressable
            style={[styles.notifsSheet, { paddingBottom: bottomPad + 20 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.notifsHeader}>
              <Text style={styles.notifsTitle}>Notifications</Text>
              {hasNotifs && (
                <View style={styles.countBadge}><Text style={styles.countText}>{rewards.length}</Text></View>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowNotifs(false)}>
                <Icon name="x" size={16} color="#9A8EB4" />
              </TouchableOpacity>
            </View>

            {rewards.length === 0 ? (
              <View style={styles.notifsEmpty}>
                <Icon name="bell-off" size={34} color="#C8B8E8" />
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
                      <Icon name={r.isRising ? 'trending-up' : (r.icon as any)} size={16} color={r.isRising ? '#C8A84B' : '#6B5B95'} />
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
                      <Icon name="x" size={12} color={r.isRising ? 'rgba(200,184,232,0.5)' : '#9A8EB4'} />
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, gap: 12,
  },
  avatarRing: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: 'rgba(200,184,232,0.45)',
    overflow: 'hidden', flexShrink: 0,
  },
  avatar: { width: '100%', height: '100%' },
  nameBlock: { flex: 1 },
  charName: { fontSize: 16, fontFamily: 'Inter_700Bold', color: 'rgba(235,228,255,0.96)', letterSpacing: -0.2 },
  subtitle:  { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.6)', marginTop: 1 },

  headerIcons: { flexDirection: 'row', gap: 6 },
  headerIconBtn: {
    width: 42, height: 42, borderRadius: 14,
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
    paddingHorizontal: 20, paddingBottom: 14, gap: 8,
  },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statPillText: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(200,184,232,0.6)' },
  statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(200,184,232,0.3)' },

  // Hero — scale with screen so it doesn't swallow small phones
  charHero: { position: 'relative', width: '100%', height: Math.round(Dimensions.get('window').width * 0.75), overflow: 'hidden' },
  charHeroLabel: { position: 'absolute', top: 14, left: 16, zIndex: 10, gap: 6 },
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
  outfitNameText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(240,228,200,0.92)', letterSpacing: 0.2 },
  charHeroTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 2 },
  charHeroOverlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, zIndex: 2 },

  changeOutfitBtn: {
    position: 'absolute', bottom: 14, right: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1, borderColor: 'rgba(200,184,232,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Scrollable content
  cardsArea: { flex: 1 },
  cardsList:  { paddingTop: 16, paddingHorizontal: 16 },

  // Character info card
  charInfoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#EDE4F8',
  },
  charInfoLeft: { flex: 1 },
  charNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  charInfoName: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1E1830', letterSpacing: -0.3 },
  charInfoStar: { fontSize: 12, color: '#C8A84B' },
  charInfoBio:  { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#6B6090', lineHeight: 19, fontStyle: 'italic', marginBottom: 8 },
  charInfoBioEmpty: { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#C0B4D8', lineHeight: 19, fontStyle: 'italic', marginBottom: 8 },
  charInfoTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  charInfoTrait:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(107,91,149,0.1)', borderWidth: 1, borderColor: 'rgba(107,91,149,0.18)' },
  charInfoTraitText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#6B5B95' },

  // Section label
  sectionLabel: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#9A8EB4',
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12,
  },

  // Horizontal slim cards
  hList: { gap: 10 },
  hCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20, overflow: 'hidden',
    height: 88,
    borderWidth: 1, borderColor: '#EDE8F5',
  },
  hCardLeft: {
    flex: 1, paddingHorizontal: 18, paddingVertical: 14, gap: 5,
  },
  hCardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#1E1830', letterSpacing: -0.2 },
  hCardDesc:  { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#9A8EB4', lineHeight: 17 },
  hCardImage: { width: 108, height: 88, flexShrink: 0 },

  // Modals
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(18,16,42,0.6)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20,
    shadowColor: '#1E1830', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD8EE',
    alignSelf: 'center', marginBottom: 16,
  },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pickerTitle:  { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1E1830' },
  pickerSub:    { fontSize: 13, fontFamily: 'Inter_400Regular', color: '#9A8EB4', marginBottom: 16, fontStyle: 'italic' },
  pickerRow:    { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  pickerCard: {
    width: 90, alignItems: 'center', gap: 8,
    padding: 4, borderRadius: 18, borderWidth: 2, borderColor: 'transparent',
    position: 'relative',
  },
  pickerCardActive: { borderColor: '#6B5B95' },
  pickerCardImg:    { width: 82, height: 110, borderRadius: 14, overflow: 'hidden' },
  pickerCardNone:   { backgroundColor: '#EDE8F5', alignItems: 'center', justifyContent: 'center' },
  pickerCardNoImg:  { backgroundColor: '#EDE8F5', alignItems: 'center', justifyContent: 'center' },
  pickerCardName:   { fontSize: 11, fontFamily: 'Inter_500Medium', color: '#1E1830', textAlign: 'center' },
  pickerActiveDot:  {
    position: 'absolute', top: 8, right: 8, width: 22, height: 22,
    borderRadius: 11, backgroundColor: '#6B5B95', alignItems: 'center', justifyContent: 'center',
  },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EBF8', alignItems: 'center', justifyContent: 'center' },

  notifsSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, paddingHorizontal: 20, maxHeight: 480,
    shadowColor: '#1E1830', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20,
  },
  notifsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  notifsTitle:  { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1E1830', flex: 1 },
  countBadge:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#6B5B95' },
  countText:    { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' },
  notifsEmpty:  { alignItems: 'center', paddingVertical: 36, gap: 12 },
  notifsEmptyText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: '#9A8EB4' },

  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  notifIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dismissBtn:    { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
