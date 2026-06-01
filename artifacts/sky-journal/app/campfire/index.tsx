import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { useApp } from '@/context/AppContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CampfireRoom {
  id:          string;
  name:        string;
  mood:        string;
  isPreset:    boolean;
  soulCount:   number;
  lastMessage: {
    authorName: string;
    content:    string | null;
    expression: string | null;
    createdAt:  string;
  } | null;
}

// ── Mood config ───────────────────────────────────────────────────────────────

const MOOD_FIRE: Record<string, { ember: string; glow: string; icon: string; label: string }> = {
  Dreamy:      { ember: '#B890FF', glow: 'rgba(184,144,255,0.22)', icon: '✦', label: 'Dreamy'      },
  Peaceful:    { ember: '#78C4E8', glow: 'rgba(120,196,232,0.20)', icon: '◌', label: 'Peaceful'    },
  Lonely:      { ember: '#7090C8', glow: 'rgba(112,144,200,0.20)', icon: '·', label: 'Lonely'      },
  Soft:        { ember: '#E8A8D8', glow: 'rgba(232,168,216,0.20)', icon: '○', label: 'Soft'        },
  Romantic:    { ember: '#F08090', glow: 'rgba(240,128,144,0.22)', icon: '♡', label: 'Romantic'    },
  Adventurous: { ember: '#78D8A0', glow: 'rgba(120,216,160,0.20)', icon: '◈', label: 'Adventurous' },
  Chaotic:     { ember: '#F09060', glow: 'rgba(240,144,96,0.22)',  icon: '◉', label: 'Chaotic'     },
  default:     { ember: '#C8A84B', glow: 'rgba(200,168,75,0.20)',  icon: '✦', label: 'Campfire'    },
};

const EXPRESSION_LABELS: Record<string, string> = {
  candle:  '🕯️ offered a candle',
  spark:   '✦ sent a spark',
  lantern: '🌙 lit a lantern',
  hush:    '🤫 fell silent',
};

// ── Star field (static) ───────────────────────────────────────────────────────

const STARS = Array.from({ length: 38 }, (_, i) => ({
  key: i,
  x:   Math.abs((i * 7919 + 42) % 100),
  y:   Math.abs((i * 6271 + 17) % 72),
  r:   0.9 + (i % 5) * 0.28,
  o:   0.25 + (i % 4) * 0.14,
}));

// ── Pulsing fire orb component ────────────────────────────────────────────────

function FireOrb({ room, onPress }: { room: CampfireRoom; onPress: () => void }) {
  const moodCfg = MOOD_FIRE[room.mood] ?? MOOD_FIRE.default;
  const pulseAnim = useRef(new Animated.Value(0.88)).current;
  const glowAnim  = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 1800 + (room.soulCount * 120), useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(pulseAnim, { toValue: 0.88, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    const g = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 2400, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: false, easing: Easing.inOut(Easing.sin) }),
    ]));
    p.start(); g.start();
    return () => { p.stop(); g.stop(); };
  }, [room.soulCount]);

  const lastPreview = room.lastMessage
    ? room.lastMessage.expression
      ? EXPRESSION_LABELS[room.lastMessage.expression] ?? room.lastMessage.expression
      : room.lastMessage.content
    : null;

  return (
    <TouchableOpacity style={fo.wrap} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }} activeOpacity={0.82}>
      {/* Outer glow ring */}
      <Animated.View style={[fo.glowRing, {
        borderColor: moodCfg.ember,
        shadowColor: moodCfg.ember,
        transform: [{ scale: pulseAnim }],
        opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] }),
      }]} />

      {/* Main orb */}
      <Animated.View style={[fo.orb, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={[`${moodCfg.ember}28`, `${moodCfg.ember}10`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
        <View style={[fo.orbInner, { borderColor: `${moodCfg.ember}40` }]}>
          <Text style={[fo.orbIcon, { color: moodCfg.ember }]}>{moodCfg.icon}</Text>
        </View>
      </Animated.View>

      {/* Soul count badge */}
      {room.soulCount > 0 && (
        <View style={[fo.badge, { backgroundColor: `${moodCfg.ember}26`, borderColor: `${moodCfg.ember}40` }]}>
          <Text style={[fo.badgeText, { color: moodCfg.ember }]}>{room.soulCount} soul{room.soulCount !== 1 ? 's' : ''}</Text>
        </View>
      )}

      {/* Room name */}
      <Text style={fo.name} numberOfLines={2}>{room.name}</Text>

      {/* Mood label */}
      <Text style={[fo.mood, { color: `${moodCfg.ember}80` }]}>{moodCfg.label}</Text>

      {/* Last whisper */}
      {lastPreview ? (
        <Text style={fo.preview} numberOfLines={1}>{lastPreview}</Text>
      ) : (
        <Text style={fo.previewEmpty}>No whispers yet…</Text>
      )}
    </TouchableOpacity>
  );
}

const fo = StyleSheet.create({
  wrap:        { alignItems: 'center', width: '46%', marginBottom: 24, paddingHorizontal: 4 },
  glowRing: {
    position: 'absolute', top: -4, width: 88, height: 88, borderRadius: 44,
    borderWidth: 1.5, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
  },
  orb: {
    width: 80, height: 80, borderRadius: 40, marginBottom: 10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  orbInner: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  orbIcon:      { fontSize: 28 },
  badge: {
    position: 'absolute', top: 0, right: '8%',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1,
  },
  badgeText:   { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },
  name:        { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.90)', textAlign: 'center', lineHeight: 18, marginBottom: 2 },
  mood:        { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.6, marginBottom: 5 },
  preview:     { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.40)', textAlign: 'center', fontStyle: 'italic' },
  previewEmpty:{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.22)', textAlign: 'center', fontStyle: 'italic' },
});

// ── Kindle sheet (create room) ────────────────────────────────────────────────

const MOODS = ['Dreamy','Peaceful','Lonely','Soft','Romantic','Adventurous','Chaotic'];

function KindleSheet({
  visible, onClose, onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, mood: string) => void;
}) {
  const insets    = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const [name, setName]   = useState('');
  const [mood, setMood]   = useState('Dreamy');
  const [busy, setBusy]   = useState(false);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 13, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
    }
  }, [visible]);

  async function handleCreate() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const room = await apiFetch<CampfireRoom>('/campfire', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), mood }),
      });
      onCreate(room.id, mood);
      setName('');
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={ks.overlay} onPress={onClose} />
      <Animated.View style={[ks.sheet, { paddingBottom: insets.bottom + 20, transform: [{ translateY: slideAnim }] }]}>
        <View style={ks.handle} />
        <Text style={ks.title}>Kindle a Fire</Text>
        <Text style={ks.sub}>Name your campfire and choose its vibe</Text>

        <TextInput
          style={ks.input}
          placeholder="e.g. Lost in the Stars…"
          placeholderTextColor="rgba(200,184,232,0.30)"
          value={name}
          onChangeText={setName}
          maxLength={50}
          returnKeyType="done"
        />

        <Text style={ks.sectionLabel}>VIBE</Text>
        <View style={ks.moodRow}>
          {MOODS.map(m => {
            const cfg = MOOD_FIRE[m] ?? MOOD_FIRE.default;
            const active = mood === m;
            return (
              <TouchableOpacity
                key={m}
                style={[ks.moodPill, active && { backgroundColor: `${cfg.ember}22`, borderColor: `${cfg.ember}55` }]}
                onPress={() => { Haptics.selectionAsync(); setMood(m); }}
                activeOpacity={0.75}
              >
                <Text style={[ks.moodPillText, active && { color: cfg.ember }]}>{cfg.icon} {m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[ks.confirmBtn, (!name.trim() || busy) && { opacity: 0.45 }]}
          onPress={handleCreate}
          disabled={!name.trim() || busy}
          activeOpacity={0.78}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={ks.confirmText}>Kindle</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const ks = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,2,14,0.65)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0E0B24', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: 'rgba(107,91,149,0.28)',
    paddingHorizontal: 22, paddingTop: 12, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(200,184,232,0.20)', alignSelf: 'center', marginBottom: 6 },
  title:  { fontSize: 20, fontFamily: 'Satoshi-Bold', color: '#F0EAF8', letterSpacing: -0.3 },
  sub:    { fontSize: 13, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.50)', marginTop: -6 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(107,91,149,0.22)',
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, fontFamily: 'Satoshi-Regular',
    color: 'rgba(230,220,255,0.90)',
  },
  sectionLabel: { fontSize: 9, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.35)', letterSpacing: 0.9, marginBottom: -6 },
  moodRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodPill: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 10, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(107,91,149,0.18)',
  },
  moodPillText: { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.55)' },
  confirmBtn: {
    backgroundColor: '#5A28B8', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  confirmText: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#fff', letterSpacing: -0.2 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CampfireLobby() {
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { character } = useApp();

  const [rooms,   setRooms]   = useState<CampfireRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindle,  setKindle]  = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadRooms = useCallback(async () => {
    try {
      const data = await apiFetch<CampfireRoom[]>('/campfire');
      setRooms(data ?? []);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRooms(); }, [loadRooms]));

  function handleRoomPress(roomId: string) {
    router.push({ pathname: '/campfire/[roomId]', params: { roomId } } as any);
  }

  function handleCreated(roomId: string) {
    setKindle(false);
    setTimeout(() => router.push({ pathname: '/campfire/[roomId]', params: { roomId } } as any), 300);
  }

  return (
    <View style={L.root}>
      {/* Night sky */}
      <LinearGradient
        colors={['#030210', '#070420', '#0A0630', '#0E0840']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
        pointerEvents="none"
      />

      {/* Stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS.map(st => (
          <View
            key={st.key}
            style={{
              position: 'absolute',
              left: `${st.x}%` as any, top: `${st.y}%` as any,
              width: st.r * 2, height: st.r * 2, borderRadius: st.r,
              backgroundColor: `rgba(220,210,255,${st.o})`,
            }}
          />
        ))}
      </View>

      {/* Header */}
      <View style={[L.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={L.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Icon name="arrow-left" size={16} color="rgba(200,184,232,0.75)" />
        </TouchableOpacity>
        <View style={L.headerCenter}>
          <Text style={L.headerTitle}>Sky Campfires</Text>
          <Text style={L.headerSub}>Gather · Whisper · Wander</Text>
        </View>
        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setKindle(true); }} style={L.kindleBtn} activeOpacity={0.8}>
          <Text style={L.kindleBtnText}>✦ Kindle</Text>
        </TouchableOpacity>
      </View>

      {/* Room grid */}
      {loading ? (
        <View style={L.centre}>
          <ActivityIndicator color="rgba(155,120,232,0.8)" size="large" />
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          <FlatList
            data={rooms}
            keyExtractor={r => r.id}
            numColumns={2}
            contentContainerStyle={[L.grid, { paddingBottom: insets.bottom + 60 }]}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
            ListHeaderComponent={() => (
              <View style={L.intro}>
                <Text style={L.introText}>
                  {rooms.filter(r => r.soulCount > 0).length > 0
                    ? `${rooms.reduce((n, r) => n + r.soulCount, 0)} souls gathered around the fires`
                    : 'The fires await — be the first soul tonight'}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <FireOrb room={item} onPress={() => handleRoomPress(item.id)} />
            )}
          />
        </Animated.View>
      )}

      <KindleSheet visible={kindle} onClose={() => setKindle(false)} onCreate={(id) => handleCreated(id)} />
    </View>
  );
}

const L = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030210' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,91,149,0.14)',
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(107,91,149,0.22)',
    flexShrink: 0,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 16, fontFamily: 'Satoshi-Bold', color: '#F0EAF8', letterSpacing: -0.2 },
  headerSub:    { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.38)', letterSpacing: 0.4 },
  kindleBtn: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(107,91,149,0.18)', borderWidth: 1, borderColor: 'rgba(107,91,149,0.32)',
    flexShrink: 0,
  },
  kindleBtnText: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.85)' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid:   { paddingTop: 24 },
  intro:  { paddingHorizontal: 20, marginBottom: 20, alignItems: 'center' },
  introText: { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.38)', fontStyle: 'italic', textAlign: 'center' },
});
