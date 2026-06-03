import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/expo';

import { Icon } from '@/components/Icon';
import { apiFetch, useApp } from '@/context/AppContext';
import { useSSE } from '@/hooks/useSSE';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CampfireMsg {
  id:         string;
  userId:     string;
  authorName: string;
  content:    string | null;
  expression: string | null;
  createdAt:  string;
  isMine:     boolean;
}

interface RoomData {
  room:      { id: string; name: string; mood: string; isPreset: boolean };
  messages:  CampfireMsg[];
  soulCount: number;
}

// ── Mood colours ──────────────────────────────────────────────────────────────

const MOOD_PALETTE: Record<string, {
  sky:   readonly [string, string, string];
  ember: string;
  glow:  string;
  text:  string;
}> = {
  Dreamy:      { sky: ['#050318', '#0B0630', '#120A40'] as const, ember: '#B890FF', glow: 'rgba(184,144,255,0.28)', text: '#E0D8FF' },
  Peaceful:    { sky: ['#020E18', '#051828', '#082030'] as const, ember: '#78C4E8', glow: 'rgba(120,196,232,0.24)', text: '#D8F0FF' },
  Lonely:      { sky: ['#030614', '#060C22', '#09122E'] as const, ember: '#7890C8', glow: 'rgba(120,144,200,0.22)', text: '#D0D8F8' },
  Soft:        { sky: ['#0E0520', '#180830', '#220B40'] as const, ember: '#E8A8D8', glow: 'rgba(232,168,216,0.24)', text: '#FFE0F8' },
  Romantic:    { sky: ['#120410', '#200818', '#300C24'] as const, ember: '#F08090', glow: 'rgba(240,128,144,0.26)', text: '#FFD8E0' },
  Adventurous: { sky: ['#021006', '#04180A', '#07200F'] as const, ember: '#78D8A0', glow: 'rgba(120,216,160,0.22)', text: '#D8FFE8' },
  Chaotic:     { sky: ['#120402', '#200804', '#300C06'] as const, ember: '#F09060', glow: 'rgba(240,144,96,0.26)', text: '#FFE0D0' },
  default:     { sky: ['#040210', '#080520', '#0C0830'] as const, ember: '#C8A84B', glow: 'rgba(200,168,75,0.24)', text: '#FFF0D0' },
};

// ── Expression config ─────────────────────────────────────────────────────────

interface ExprDef {
  id:     string;
  symbol: string;
  label:  string;
  verb:   string;
}

const EXPRESSIONS: ExprDef[] = [
  { id: 'candle',  symbol: '🕯️', label: 'Candle',  verb: 'offered a candle'  },
  { id: 'spark',   symbol: '✦',  label: 'Spark',   verb: 'sent a spark'      },
  { id: 'lantern', symbol: '🌙', label: 'Lantern', verb: 'lit a lantern'     },
  { id: 'hush',    symbol: '🤫', label: 'Hush',    verb: 'fell silent'        },
];

function getExpr(id: string): ExprDef {
  return EXPRESSIONS.find(e => e.id === id) ?? EXPRESSIONS[1];
}

// ── Static stars ──────────────────────────────────────────────────────────────

const STARS = Array.from({ length: 48 }, (_, i) => ({
  key: i,
  x:   Math.abs((i * 7919 + 31) % 100),
  y:   Math.abs((i * 6271 + 53) % 80),
  r:   0.8 + (i % 5) * 0.3,
  o:   0.18 + (i % 4) * 0.12,
}));

// ── Campfire animation ────────────────────────────────────────────────────────

function CampfireScene({ ember, glow }: { ember: string; glow: string }) {
  const { width } = useWindowDimensions();

  // Flame oscillation
  const flame1 = useRef(new Animated.Value(0)).current;
  const flame2 = useRef(new Animated.Value(0)).current;
  const flame3 = useRef(new Animated.Value(0)).current;

  // Embers
  const em = Array.from({ length: 5 }, () => ({
    y: useRef(new Animated.Value(0)).current,
    x: useRef(new Animated.Value(0)).current,
    o: useRef(new Animated.Value(0)).current,
  }));

  useEffect(() => {
    const loop1 = Animated.loop(Animated.sequence([
      Animated.timing(flame1, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(flame1, { toValue: 0, duration: 1100, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    const loop2 = Animated.loop(Animated.sequence([
      Animated.timing(flame2, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(flame2, { toValue: 0, duration: 1300, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    const loop3 = Animated.loop(Animated.sequence([
      Animated.timing(flame3, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(flame3, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
    ]));
    loop1.start(); loop2.start(); loop3.start();

    // Ember rising loops (staggered)
    const emberAnimations = em.map(({ y, x, o }, i) => {
      const dur = 2200 + i * 380;
      const delay = i * 500;
      return Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y, { toValue: 1, duration: dur, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.sequence([
            Animated.timing(o, { toValue: 1, duration: dur * 0.2, useNativeDriver: true }),
            Animated.timing(o, { toValue: 0, duration: dur * 0.8, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(x, { toValue: (i % 2 === 0 ? 1 : -1) * 0.5, duration: dur * 0.5, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
            Animated.timing(x, { toValue: 0, duration: dur * 0.5, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ]));
    });
    emberAnimations.forEach(a => a.start());

    return () => {
      loop1.stop(); loop2.stop(); loop3.stop();
      emberAnimations.forEach(a => a.stop());
    };
  }, []);

  const cx = width / 2;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {/* Stars */}
      {STARS.map(st => (
        <View key={st.key} style={{
          position: 'absolute',
          left: `${st.x}%` as any, top: `${st.y}%` as any,
          width: st.r * 2, height: st.r * 2, borderRadius: st.r,
          backgroundColor: `rgba(220,210,255,${st.o})`,
        }} />
      ))}

      {/* Ground glow halo */}
      <View style={{
        position: 'absolute', bottom: 96, alignSelf: 'center',
        width: 160, height: 36, borderRadius: 80,
        backgroundColor: glow, shadowColor: ember,
        shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 0 },
      }} />
      <View style={{
        position: 'absolute', bottom: 100, alignSelf: 'center',
        width: 100, height: 22, borderRadius: 50,
        backgroundColor: `${ember}30`,
      }} />

      {/* Embers rising */}
      {em.map(({ y, x, o }, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', bottom: 108, left: cx - 4 + (i - 2) * 10,
          width: 4, height: 4, borderRadius: 2,
          backgroundColor: ember,
          opacity: o,
          transform: [
            { translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, -180 - i * 30] }) },
            { translateX: x.interpolate({ inputRange: [-1, 0, 1], outputRange: [-22, 0, 22] }) },
          ],
        }} />
      ))}

      {/* Outer flame */}
      <Animated.View style={{
        position: 'absolute', bottom: 110, alignSelf: 'center',
        width: 46, height: 80, borderRadius: 26,
        borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
        backgroundColor: `${ember}55`,
        transform: [
          { scaleX: flame1.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.18] }) },
          { scaleY: flame1.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.12] }) },
        ],
      }} />

      {/* Mid flame */}
      <Animated.View style={{
        position: 'absolute', bottom: 114, alignSelf: 'center',
        width: 30, height: 58, borderRadius: 18,
        borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
        backgroundColor: `${ember}80`,
        transform: [
          { scaleX: flame2.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.22] }) },
          { scaleY: flame2.interpolate({ inputRange: [0, 1], outputRange: [0.90, 1.10] }) },
        ],
      }} />

      {/* Inner flame (bright core) */}
      <Animated.View style={{
        position: 'absolute', bottom: 118, alignSelf: 'center',
        width: 16, height: 38, borderRadius: 12,
        borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
        backgroundColor: '#FFF8E0',
        opacity: flame3.interpolate({ inputRange: [0, 1], outputRange: [0.60, 0.90] }),
        transform: [
          { scaleX: flame3.interpolate({ inputRange: [0, 1], outputRange: [0.80, 1.20] }) },
        ],
      }} />

      {/* Logs */}
      <View style={{ position: 'absolute', bottom: 103, alignSelf: 'center', alignItems: 'center' }}>
        <View style={{ width: 72, height: 12, borderRadius: 6, backgroundColor: 'rgba(50,24,8,0.88)', transform: [{ rotate: '14deg' }], marginLeft: -8 }} />
        <View style={{ width: 72, height: 12, borderRadius: 6, backgroundColor: 'rgba(50,24,8,0.82)', transform: [{ rotate: '-11deg' }], marginTop: -7, marginLeft: 8 }} />
      </View>

      {/* Ground shadow */}
      <View style={{
        position: 'absolute', bottom: 96, alignSelf: 'center',
        width: 90, height: 10, borderRadius: 45,
        backgroundColor: 'rgba(0,0,0,0.30)',
      }} />
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageRow({ msg, palette, opacity }: {
  msg:     CampfireMsg;
  palette: typeof MOOD_PALETTE.default;
  opacity: number;
}) {
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  if (msg.expression) {
    const expr = getExpr(msg.expression);
    return (
      <Animated.View style={[mb.exprWrap, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <Text style={mb.exprSymbol}>{expr.symbol}</Text>
        <Text style={[mb.exprAuthor, { color: `${palette.ember}88` }]}>
          <Text style={{ color: msg.isMine ? palette.ember : `${palette.ember}80` }}>
            {msg.isMine ? 'You' : msg.authorName}
          </Text>
          {' '}{expr.verb}
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={{ opacity }}>
    <Animated.View style={[
      mb.row,
      msg.isMine && mb.rowMine,
      { opacity: fadeIn, transform: [{ translateY: slideUp }] },
    ]}>
      {!msg.isMine && (
        <Text style={[mb.author, { color: `${palette.ember}88` }]}>{msg.authorName}</Text>
      )}
      <View style={[
        mb.bubble,
        msg.isMine
          ? [mb.bubbleMine, { backgroundColor: `${palette.ember}18`, borderColor: `${palette.ember}35` }]
          : [mb.bubbleOther, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.09)' }],
      ]}>
        <Text style={[mb.text, { color: msg.isMine ? palette.text : 'rgba(230,220,255,0.85)' }]}>
          {msg.content}
        </Text>
      </View>
    </Animated.View>
    </View>
  );
}

const mb = StyleSheet.create({
  row:         { marginBottom: 10, maxWidth: '78%' },
  rowMine:     { alignSelf: 'flex-end' },
  author:      { fontSize: 9.5, fontFamily: 'Satoshi-Bold', marginBottom: 3, marginLeft: 12, letterSpacing: 0.2 },
  bubble:      { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1 },
  bubbleMine:  { borderBottomRightRadius: 6 },
  bubbleOther: { borderBottomLeftRadius: 6 },
  text:        { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 20 },
  // Expression
  exprWrap:    { alignItems: 'center', marginVertical: 10, gap: 2 },
  exprSymbol:  { fontSize: 22 },
  exprAuthor:  { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
});

// ── Expression bar ────────────────────────────────────────────────────────────

function ExprBar({ ember, onExpr }: { ember: string; onExpr: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);

  function press(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActive(id);
    setTimeout(() => setActive(null), 400);
    onExpr(id);
  }

  return (
    <View style={eb.row}>
      {EXPRESSIONS.map(e => (
        <TouchableOpacity
          key={e.id}
          style={[eb.btn, { borderColor: `${ember}28`, backgroundColor: `${ember}0C` }, active === e.id && { backgroundColor: `${ember}28`, borderColor: `${ember}55` }]}
          onPress={() => press(e.id)}
          activeOpacity={0.72}
        >
          <Text style={eb.symbol}>{e.symbol}</Text>
          <Text style={[eb.label, { color: `${ember}90` }]}>{e.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const eb = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingBottom: 8 },
  btn:    { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 2 },
  symbol: { fontSize: 17 },
  label:  { fontSize: 8.5, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

const POLL_MS = 30_000;

export default function CampfireRoom() {
  const insets        = useSafeAreaInsets();
  const { character, markCampfireRoomRead } = useApp();
  const { roomId }    = useLocalSearchParams<{ roomId: string }>();
  const { userId: myUserId } = useAuth();

  const [data,    setData]    = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const scrollRef  = useRef<ScrollView>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef  = useRef<string>('');

  const palette = data ? (MOOD_PALETTE[data.room.mood] ?? MOOD_PALETTE.default) : MOOD_PALETTE.default;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!roomId) return;
    try {
      const res = await apiFetch<RoomData>(`/campfire/${roomId}`);
      if (res) {
        const newestId = res.messages[res.messages.length - 1]?.id ?? '';
        const hasNew   = newestId !== lastIdRef.current;
        lastIdRef.current = newestId;
        setData(res);
        if (hasNew) {
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
        }
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchData();
    if (roomId) markCampfireRoomRead(roomId);
    // Slow fallback poll — SSE handles the live updates
    pollRef.current = setInterval(() => fetchData(true), POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchData, roomId, markCampfireRoomRead]);

  // ── SSE: live push for campfire messages and presence ────────────────────
  const { connected: sseConnected } = useSSE(
    roomId ? [`campfire:${roomId}`] : [],
    useCallback((_channel: string, raw: unknown) => {
      const payload = raw as {
        type: string;
        message?: {
          id: string; userId: string; authorName: string;
          content: string | null; expression: string | null; createdAt: string;
        };
        soulCount?: number;
      };

      if (payload?.type === 'new_message' && payload.message) {
        const m = payload.message;
        setData(prev => {
          if (!prev) return prev;
          if (prev.messages.find(x => x.id === m.id)) return prev;
          const newMsg: CampfireMsg = { ...m, isMine: m.userId === myUserId };
          return { ...prev, messages: [...prev.messages, newMsg] };
        });
        lastIdRef.current = m.id;
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
        return;
      }

      if (payload?.type === 'presence_update' && typeof payload.soulCount === 'number') {
        setData(prev => prev ? { ...prev, soulCount: payload.soulCount! } : prev);
        return;
      }
    }, [myUserId]),
  );

  // ── Send message ───────────────────────────────────────────────────────────

  function appendOwnMessage(msg: CampfireMsg) {
    setData(prev => {
      if (!prev) return prev;
      if (prev.messages.find(x => x.id === msg.id)) return prev;
      return { ...prev, messages: [...prev.messages, msg] };
    });
    lastIdRef.current = msg.id;
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  async function sendText() {
    const trimmed = text.trim();
    if (!trimmed || sending || !roomId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setText('');
    setShowInput(false);
    try {
      const sent = await apiFetch<CampfireMsg>(`/campfire/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: trimmed, authorName: character.name || 'Wanderer' }),
      });
      if (sent) appendOwnMessage(sent);
    } finally {
      setSending(false);
    }
  }

  async function sendExpression(id: string) {
    if (!roomId) return;
    try {
      const sent = await apiFetch<CampfireMsg>(`/campfire/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ expression: id, authorName: character.name || 'Wanderer' }),
      });
      if (sent) appendOwnMessage(sent);
    } catch { /* silent */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const messages = data?.messages ?? [];
  const totalMsg = messages.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={R.root}>
        {/* Sky background */}
        <LinearGradient
          colors={palette.sky as any}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
          pointerEvents="none"
        />

        {/* Campfire scene */}
        {data && !loading && (
          <CampfireScene ember={palette.ember} glow={palette.glow} />
        )}

        {/* Header */}
        <View style={[R.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={R.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Icon name="arrow-left" size={15} color="rgba(200,184,232,0.70)" />
          </TouchableOpacity>

          <View style={R.headerCenter}>
            {data ? (
              <>
                <Text style={R.roomName} numberOfLines={1}>{data.room.name}</Text>
                {!sseConnected && !loading && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: `${palette.ember}60` }} />
                    <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: `${palette.ember}70`, fontStyle: 'italic' }}>
                      Reconnecting…
                    </Text>
                  </View>
                )}
                {data.soulCount > 0 && (
                  <View style={R.soulOrbs}>
                    {Array.from({ length: Math.min(data.soulCount, 8) }).map((_, i) => (
                      <View
                        key={i}
                        style={[R.soulOrb, {
                          backgroundColor: palette.ember,
                          shadowColor: palette.ember,
                          opacity: 0.55 + (i === 0 ? 0.35 : 0),
                        }]}
                      />
                    ))}
                    {data.soulCount > 8 && (
                      <Text style={[R.soulOrbMore, { color: `${palette.ember}80` }]}>
                        +{data.soulCount - 8}
                      </Text>
                    )}
                  </View>
                )}
                <Text style={[R.soulPill, { color: `${palette.ember}AA` }]}>
                  {data.soulCount > 0
                    ? `${data.soulCount} soul${data.soulCount !== 1 ? 's' : ''} gathered`
                    : 'You are the first soul tonight'}
                </Text>
              </>
            ) : (
              <Text style={R.roomName}>Campfire</Text>
            )}
          </View>

          {/* 6h expiry note */}
          <View style={R.expiryPill}>
            <Icon name="clock" size={9} color={`${palette.ember}70`} />
            <Text style={[R.expiryText, { color: `${palette.ember}80` }]}>6 h</Text>
          </View>
        </View>

        {/* Messages scroll */}
        {loading ? (
          <View style={R.loadingWrap}>
            <Text style={[R.loadingText, { color: `${palette.ember}80` }]}>Tending the fire…</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={R.scroll}
            contentContainerStyle={[R.scrollContent, { paddingBottom: 20 }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <View style={R.empty}>
                <Text style={[R.emptyIcon, { color: `${palette.ember}60` }]}>✦</Text>
                <Text style={[R.emptyText, { color: `${palette.ember}80` }]}>The fire is quiet…{'\n'}be the first to whisper</Text>
              </View>
            ) : (
              messages.map((msg, idx) => {
                // Opacity: newest (bottom) = 1.0, fades as messages go up
                const fromBottom = totalMsg - 1 - idx;
                const opacity = Math.max(0.22, 1 - (fromBottom * 0.085));
                return (
                  <MessageRow key={msg.id} msg={msg} palette={palette} opacity={opacity} />
                );
              })
            )}
          </ScrollView>
        )}

        {/* Expressions + input */}
        <View style={[R.bottomArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {/* Expression bar */}
          <ExprBar ember={palette.ember} onExpr={sendExpression} />

          {/* Divider */}
          <View style={[R.divider, { backgroundColor: `${palette.ember}15` }]} />

          {/* Text input row */}
          {showInput ? (
            <View style={R.inputRow}>
              <TextInput
                style={[R.input, { color: palette.text, borderColor: `${palette.ember}28` }]}
                placeholder="Whisper to the fire…"
                placeholderTextColor={`${palette.ember}40`}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={500}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={sendText}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[R.sendBtn, { backgroundColor: `${palette.ember}22`, borderColor: `${palette.ember}40` }, (!text.trim() || sending) && { opacity: 0.4 }]}
                onPress={sendText}
                disabled={!text.trim() || sending}
                activeOpacity={0.75}
              >
                <Text style={[R.sendIcon, { color: palette.ember }]}>✦</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowInput(false); setText(''); }} style={R.cancelBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Icon name="x" size={14} color="rgba(200,184,232,0.40)" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[R.whisperBtn, { borderColor: `${palette.ember}22`, backgroundColor: `${palette.ember}08` }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInput(true); }}
              activeOpacity={0.78}
            >
              <Text style={[R.whisperPlaceholder, { color: `${palette.ember}55` }]}>Whisper to the fire…</Text>
              <View style={[R.whisperIcon, { backgroundColor: `${palette.ember}18` }]}>
                <Icon name="edit-2" size={12} color={`${palette.ember}90`} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const R = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040210' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(107,91,149,0.12)',
    zIndex: 10,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(107,91,149,0.20)',
    flexShrink: 0,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  roomName:     { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.92)', letterSpacing: -0.2 },
  soulOrbs:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  soulOrb:      { width: 6, height: 6, borderRadius: 3, shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
  soulOrbMore:  { fontSize: 8, fontFamily: 'Satoshi-Bold', marginLeft: 2 },
  soulPill:     { fontSize: 9.5, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  expiryPill:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  expiryText:   { fontSize: 9, fontFamily: 'Satoshi-Bold' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 0 },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: 13, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', textAlign: 'center', lineHeight: 20 },

  bottomArea: {
    backgroundColor: 'rgba(4,2,16,0.88)',
    borderTopWidth: 1, borderTopColor: 'rgba(107,91,149,0.14)',
    paddingTop: 10,
  },
  divider: { height: 1, marginHorizontal: 14, marginBottom: 8 },

  inputRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 14, paddingBottom: 6 },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 20,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    flexShrink: 0,
  },
  sendIcon:   { fontSize: 17 },
  cancelBtn:  { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  whisperBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 14, marginBottom: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
    gap: 10,
  },
  whisperPlaceholder: { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular', fontStyle: 'italic' },
  whisperIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
