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
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { character, journalEntries, stories, outfits, rewards, dismissReward } = useApp();

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 28 : insets.bottom;

  // Hero image height: responsive — 46% of screen, capped so info card always fits
  const heroH = Math.min(Math.round(H * 0.46), 320);

  const [showNotifs, setShowNotifs] = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const hasNotifs = rewards.length > 0;

  return (
    <View style={[styles.root, { backgroundColor: '#F4EEE6' }]}>
      <LinearGradient colors={['#EDE7DC','#F4EEE6','#F4EEE6']} style={StyleSheet.absoluteFill} />

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor:'rgba(255,255,255,0.76)', borderColor:'rgba(107,91,149,0.1)' }]}
          onPress={() => setMenuOpen(v => !v)}
          activeOpacity={0.8}
        >
          <Feather name="menu" size={18} color="#3A2860" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor:'rgba(255,255,255,0.76)', borderColor:'rgba(107,91,149,0.1)' }]}
          onPress={() => { setShowNotifs(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.8}
        >
          <Feather name="bell" size={18} color="#3A2860" />
          {hasNotifs && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      {/* ── Page title ───────────────────────────────────────────── */}
      <View style={{ paddingTop: topPad + 58, paddingHorizontal: 22, paddingBottom: 6 }}>
        <Text style={styles.pageTitle}>My Sky Kid</Text>
      </View>

      {/* ── Hero image ──────────────────────────────────────────── */}
      <View style={[styles.heroWrap, { height: heroH }]}>
        <Image source={Images.character_default} style={styles.heroImg} resizeMode="contain" />
        <LinearGradient
          colors={['transparent','rgba(244,238,230,0.94)']}
          style={styles.heroFade}
          pointerEvents="none"
        />
        <TouchableOpacity
          style={[styles.editBtn, SHADOW.xs]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.85}
        >
          <Feather name="edit-2" size={13} color="#3A2860" />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* ── Info card ────────────────────────────────────────────── */}
      <View style={[styles.infoCard, SHADOW.md]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.infoScroll}
          bounces={false}
        >
          {/* Name */}
          <View style={styles.nameRow}>
            <Text style={styles.charName} numberOfLines={1}>{character.name}</Text>
            <Text style={styles.sparkle}>✦</Text>
          </View>

          {/* Bio */}
          {!!character.bio && (
            <Text style={styles.bio} numberOfLines={2}>{character.bio}</Text>
          )}

          {/* Traits */}
          {character.traits.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.traitsRow}
            >
              {character.traits.map(t => (
                <View key={t} style={styles.traitPill}>
                  <Text style={styles.traitText}>{t}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{stories.length}</Text>
              <Text style={styles.statLabel}>Stories</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{outfits.length}</Text>
              <Text style={styles.statLabel}>Outfits</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{journalEntries.length}</Text>
              <Text style={styles.statLabel}>Memories</Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* ── New Log button ───────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.newLogBtn, { paddingBottom: bottomPad + 18 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/create-journal-entry'); }}
        activeOpacity={0.88}
      >
        <LinearGradient
          colors={['#6055A8','#4A3C8C','#372D72']}
          style={styles.newLogGrad}
          start={{ x:0, y:0 }} end={{ x:1, y:0 }}
        >
          <Feather name="plus" size={18} color="rgba(255,255,255,0.92)" />
          <Text style={styles.newLogText}>New Log</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Menu ─────────────────────────────────────────────────── */}
      {menuOpen && (
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menuSheet, { top: topPad + 58 }, SHADOW.md]}>
            {[
              { icon:'book-open' as const, label:'Journal',   route:'/(tabs)/log'      },
              { icon:'layers'    as const, label:'Stories',   route:'/(tabs)/create'   },
              { icon:'compass'   as const, label:'Discover',  route:'/(tabs)/discover' },
              { icon:'user'      as const, label:'Character', route:'/(tabs)/profile'  },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuItem}
                onPress={() => { setMenuOpen(false); router.push(item.route as any); }}
              >
                <Feather name={item.icon} size={16} color="#6B5B95" />
                <Text style={styles.menuItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      )}

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
                <View style={styles.notifCountBadge}>
                  <Text style={styles.notifCountText}>{rewards.length}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor:'#F0EAF8' }]}
                onPress={() => setShowNotifs(false)}
              >
                <Feather name="x" size={16} color="#9A8EB4" />
              </TouchableOpacity>
            </View>

            {rewards.length === 0 ? (
              <View style={styles.notifsEmpty}>
                <Feather name="bell-off" size={34} color="#C8B8E8" />
                <Text style={styles.notifsEmptyText}>You're all caught up</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap:10, paddingBottom:8 }}>
                {rewards.map(r => (
                  <View
                    key={r.id}
                    style={[
                      styles.notifItem,
                      r.isRising
                        ? { backgroundColor:'#1A1630', borderColor:'rgba(200,168,75,0.22)' }
                        : { backgroundColor:'#F8F5FF', borderColor:'rgba(107,91,149,0.12)' },
                    ]}
                  >
                    <View style={[styles.notifIcon, {
                      backgroundColor: r.isRising ? 'rgba(200,168,75,0.18)' : 'rgba(107,91,149,0.1)',
                    }]}>
                      <Feather
                        name={r.isRising ? 'trending-up' : r.icon as any}
                        size={16}
                        color={r.isRising ? '#C8A84B' : '#6B5B95'}
                      />
                    </View>
                    <View style={{ flex:1, gap:2 }}>
                      {r.count !== undefined && (
                        <Text style={{ fontSize:20, fontFamily:'Inter_700Bold', letterSpacing:-0.5, color: r.isRising ? '#C8A84B' : '#1E1830' }}>
                          {r.count}
                        </Text>
                      )}
                      <Text style={{ fontSize:13, fontFamily:'Inter_400Regular', lineHeight:18, color: r.isRising ? 'rgba(240,234,248,0.85)' : '#6B6090' }}>
                        {r.message}
                      </Text>
                      {r.subMessage && (
                        <Text style={{ fontSize:11, fontFamily:'Inter_400Regular', color: r.isRising ? 'rgba(200,168,75,0.7)' : '#9A8EB4' }}>
                          {r.subMessage}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.notifDismiss, { backgroundColor: r.isRising ? 'rgba(255,255,255,0.07)' : 'rgba(107,91,149,0.08)' }]}
                      onPress={() => dismissReward(r.id)}
                      hitSlop={{ top:8, right:8, bottom:8, left:8 }}
                    >
                      <Feather name="x" size={12} color={r.isRising ? 'rgba(200,184,232,0.45)' : '#9A8EB4'} />
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
  root: { flex:1 },

  topBar: {
    position:'absolute', top:0, left:0, right:0, zIndex:20,
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    paddingHorizontal:20,
  },
  iconBtn: {
    width:40, height:40, borderRadius:13, borderWidth:1,
    alignItems:'center', justifyContent:'center', position:'relative',
  },
  notifDot: {
    position:'absolute', top:7, right:7,
    width:8, height:8, borderRadius:4,
    backgroundColor:'#E04455', borderWidth:1.5, borderColor:'#F4EEE6',
  },

  pageTitle: { fontSize:26, fontFamily:'Inter_700Bold', color:'#2A1E50', letterSpacing:-0.5 },

  heroWrap: { width:'100%', position:'relative' },
  heroImg:  { width:'100%', height:'100%' },
  heroFade: { position:'absolute', bottom:0, left:0, right:0, height:80 },
  editBtn: {
    position:'absolute', bottom:14, left:18,
    flexDirection:'row', alignItems:'center', gap:6,
    paddingHorizontal:14, paddingVertical:8, borderRadius:20,
    backgroundColor:'rgba(255,255,255,0.9)',
    borderWidth:1, borderColor:'rgba(107,91,149,0.15)',
  },
  editBtnText: { fontSize:13, fontFamily:'Inter_600SemiBold', color:'#3A2860' },

  infoCard: {
    flex:1,
    backgroundColor:'#FFFFFF',
    borderTopLeftRadius:26, borderTopRightRadius:26,
    marginTop:-26,
  },
  infoScroll: { paddingHorizontal:22, paddingTop:22, paddingBottom:8, gap:10 },

  nameRow: { flexDirection:'row', alignItems:'center', gap:8 },
  charName: { fontSize:26, fontFamily:'Inter_700Bold', color:'#2A1E50', letterSpacing:-0.5, flex:1 },
  sparkle: { fontSize:18, color:'#C8A84B' },

  bio: { fontSize:13, fontFamily:'Inter_400Regular', fontStyle:'italic', color:'#9A8EB4', lineHeight:20 },

  traitsRow: { flexDirection:'row', gap:7, paddingVertical:2 },
  traitPill: { paddingHorizontal:14, paddingVertical:6, borderRadius:20, backgroundColor:'#EDE8F4', borderWidth:1, borderColor:'#DDD4EE' },
  traitText: { fontSize:12, fontFamily:'Inter_500Medium', color:'#6B5B95' },

  statsRow: { flexDirection:'row', alignItems:'center', paddingTop:4 },
  statItem: { flex:1, alignItems:'center', gap:2 },
  statNum:  { fontSize:22, fontFamily:'Inter_700Bold', color:'#2A1E50', letterSpacing:-0.5 },
  statLabel:{ fontSize:11, fontFamily:'Inter_400Regular', color:'#9A8EB4' },
  statDivider: { width:1, height:32, backgroundColor:'#E8E0F0' },

  newLogBtn: { overflow:'hidden' },
  newLogGrad: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, paddingVertical:18 },
  newLogText: { fontSize:17, fontFamily:'Inter_700Bold', color:'rgba(255,255,255,0.96)', letterSpacing:-0.2 },

  menuOverlay: { ...StyleSheet.absoluteFillObject, zIndex:100 },
  menuSheet: {
    position:'absolute', left:14, width:210,
    borderRadius:18, borderWidth:1, borderColor:'rgba(107,91,149,0.12)',
    backgroundColor:'rgba(255,255,255,0.97)', paddingVertical:8, overflow:'hidden',
  },
  menuItem: { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:18, paddingVertical:13 },
  menuItemText: { fontSize:15, fontFamily:'Inter_500Medium', color:'#2A1E50' },

  modalOverlay: { flex:1, backgroundColor:'rgba(26,22,48,0.38)', justifyContent:'flex-end' },
  notifsSheet: { backgroundColor:'#FFFFFF', borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:20, paddingTop:14, maxHeight:'80%' },
  sheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:'#DDD5EE', alignSelf:'center', marginBottom:16 },
  notifsHeader: { flexDirection:'row', alignItems:'center', marginBottom:16, gap:10 },
  notifsTitle: { fontSize:18, fontFamily:'Inter_700Bold', color:'#2A1E50', flex:1 },
  notifCountBadge: { backgroundColor:'#E04455', borderRadius:10, paddingHorizontal:7, paddingVertical:2, minWidth:22, alignItems:'center' },
  notifCountText: { fontSize:11, fontFamily:'Inter_700Bold', color:'#fff' },
  closeBtn: { width:32, height:32, borderRadius:10, alignItems:'center', justifyContent:'center' },
  notifItem: { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, borderWidth:1, padding:14 },
  notifIcon: { width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center', flexShrink:0 },
  notifDismiss: { width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center', flexShrink:0 },
  notifsEmpty: { alignItems:'center', paddingVertical:40, gap:12 },
  notifsEmptyText: { fontSize:14, fontFamily:'Inter_400Regular', fontStyle:'italic', color:'#9A8EB4' },
});
