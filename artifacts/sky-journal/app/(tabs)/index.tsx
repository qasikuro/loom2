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

// ── Main component ─────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { width: W } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { character, journalEntries, stories, rewards, dismissReward } = useApp();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 28 : insets.bottom;
  const heroH     = Math.min(Math.round(W * 0.54), 220);

  const [showNotifs, setShowNotifs] = useState(false);
  const hasNotifs = rewards.length > 0;

  const latestEntry = journalEntries[0];
  const lastSeen    = latestEntry
    ? new Date(latestEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

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
          <View style={styles.avatarRing}>
            <Image source={Images.character_default} style={styles.avatar} resizeMode="cover" />
          </View>

          <View style={styles.nameBlock}>
            <Text style={styles.charName} numberOfLines={1}>
              {character.name || 'Sky Child'}
            </Text>
            <Text style={styles.subtitle}>Your journey, your memories.</Text>
          </View>

          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Feather name="moon" size={18} color="rgba(200,184,232,0.65)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => { setShowNotifs(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Feather name="bell" size={18} color="rgba(200,184,232,0.65)" />
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

        {/* Hero landscape */}
        <View style={[styles.heroWrap, { height: heroH }]}>
          <Image source={Images.story_bg1} style={styles.heroImg} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(18,16,42,0.55)', 'transparent', 'rgba(18,16,42,0.72)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Text style={styles.heroCaption}>✦  The sky is always waiting for you</Text>
        </View>
      </LinearGradient>

      {/* ── Category cards (scrollable) ──────────────────────────── */}
      <ScrollView
        style={styles.cardsArea}
        contentContainerStyle={[styles.cardsList, { paddingBottom: bottomPad + 82 }]}
        showsVerticalScrollIndicator={false}
      >
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
            {/* Left: icon + title + desc */}
            <View style={styles.catLeft}>
              <View style={[styles.catIconCircle, { backgroundColor: cat.iconBg }]}>
                <Feather name={cat.icon} size={20} color={cat.iconColor} />
              </View>
              <View style={styles.catTexts}>
                <Text style={styles.catTitle}>{cat.title}</Text>
                <Text style={styles.catDesc}>{cat.desc}</Text>
              </View>
            </View>

            {/* Right: artwork image */}
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
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap:10, paddingBottom:8 }}>
                {rewards.map(r => (
                  <View key={r.id} style={[styles.notifItem, {
                    backgroundColor: r.isRising ? '#1A1630' : '#F8F5FF',
                    borderColor: r.isRising ? 'rgba(200,168,75,0.22)' : 'rgba(107,91,149,0.12)',
                  }]}>
                    <View style={[styles.notifIconWrap, { backgroundColor: r.isRising ? 'rgba(200,168,75,0.18)' : 'rgba(107,91,149,0.1)' }]}>
                      <Feather name={r.isRising ? 'trending-up' : (r.icon as any)} size={16} color={r.isRising ? '#C8A84B' : '#6B5B95'} />
                    </View>
                    <View style={{ flex:1, gap:2 }}>
                      {r.count !== undefined && (
                        <Text style={{ fontSize:20, fontFamily:'Inter_700Bold', letterSpacing:-0.5, color: r.isRising ? '#C8A84B' : '#1E1830' }}>{r.count}</Text>
                      )}
                      <Text style={{ fontSize:13, fontFamily:'Inter_400Regular', lineHeight:18, color: r.isRising ? 'rgba(240,234,248,0.85)' : '#6B6090' }}>{r.message}</Text>
                      {r.subMessage && (
                        <Text style={{ fontSize:11, fontFamily:'Inter_400Regular', color: r.isRising ? 'rgba(200,168,75,0.7)' : '#9A8EB4' }}>{r.subMessage}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.dismissBtn, { backgroundColor: r.isRising ? 'rgba(255,255,255,0.07)' : 'rgba(107,91,149,0.08)' }]}
                      onPress={() => dismissReward(r.id)}
                      hitSlop={{ top:8, right:8, bottom:8, left:8 }}
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
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
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

  // Hero
  heroWrap: { position: 'relative', width: '100%', overflow: 'hidden' },
  heroImg: { width: '100%', height: '100%' },
  heroCaption: {
    position: 'absolute',
    bottom: 12,
    left: 18,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    color: 'rgba(235,228,255,0.75)',
    letterSpacing: 0.3,
  },

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

  // Notifications modal
  modalOverlay: { flex:1, backgroundColor:'rgba(10,8,28,0.5)', justifyContent:'flex-end' },
  notifsSheet: { backgroundColor:'#FFFFFF', borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:20, paddingTop:14, maxHeight:'80%' },
  sheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:'#DDD5EE', alignSelf:'center', marginBottom:16 },
  notifsHeader: { flexDirection:'row', alignItems:'center', marginBottom:16, gap:10 },
  notifsTitle: { fontSize:18, fontFamily:'Inter_700Bold', color:'#2A1E50', flex:1 },
  countBadge: { backgroundColor:'#E04455', borderRadius:10, paddingHorizontal:7, paddingVertical:2, minWidth:22, alignItems:'center' },
  countText: { fontSize:11, fontFamily:'Inter_700Bold', color:'#fff' },
  closeBtn: { width:32, height:32, borderRadius:10, backgroundColor:'#F0EAF8', alignItems:'center', justifyContent:'center' },
  notifItem: { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, borderWidth:1, padding:14 },
  notifIconWrap: { width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center', flexShrink:0 },
  dismissBtn: { width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center', flexShrink:0 },
  notifsEmpty: { alignItems:'center', paddingVertical:40, gap:12 },
  notifsEmptyText: { fontSize:14, fontFamily:'Inter_400Regular', fontStyle:'italic', color:'#9A8EB4' },
});
