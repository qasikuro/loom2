import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { ChatStickerAnimation, type StickerAnimType } from '@/components/ChatStickerAnimation';
import { apiFetch, useApp } from '@/context/AppContext';
import { useSound } from '@/context/SoundContext';
import { useSSE } from '@/hooks/useSSE';
import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Constants ─────────────────────────────────────────────────────────────────
const NIGHT   = '#080618';
const NIGHT2  = '#0D0926';

const PURPLE  = '#6B4EE8';
const PURPLE2 = '#3B2A8C';
const BORDER  = 'rgba(200,184,232,0.10)';
const MUTED   = 'rgba(200,184,232,0.45)';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  id:         string;
  fromUserId: string;
  toUserId:   string;
  content:    string | null;
  expression: string | null;
  isRead:     boolean;
  createdAt:  string;
  isOwn:      boolean;
}

type ListItem =
  | { type: 'date'; date: string; key: string }
  | { type: 'msg';  msg: Message; key: string };

// ── Sticker registry ──────────────────────────────────────────────────────────

export interface StickerDef {
  id:         string;
  emoji:      string;
  label:      string;
  color:      string;
  anim:       StickerAnimType;
  haptic:     'light' | 'medium' | 'heavy';
  ownLabel:   string;
  otherLabel: string;
}

export const STICKERS: StickerDef[] = [
  { id: 'bomb',     emoji: '💣', label: 'BOOM!',    color: '#FF6B35', anim: 'explode',   haptic: 'heavy',  ownLabel: 'you threw a bomb',       otherLabel: 'threw a bomb 💥'       },
  { id: 'stone',    emoji: '🪨', label: 'bonk!',    color: '#9A8462', anim: 'throw',     haptic: 'medium', ownLabel: 'you threw a stone',      otherLabel: 'threw a stone 🪨'      },
  { id: 'mirror',   emoji: '🪞', label: 'shatter!', color: '#78B4DC', anim: 'shatter',   haptic: 'heavy',  ownLabel: 'you broke the mirror',   otherLabel: 'broke the mirror ✦'    },
  { id: 'kiss',     emoji: '💋', label: 'mwah!',    color: '#FF6B9D', anim: 'hearts',    haptic: 'light',  ownLabel: 'you sent a kiss',        otherLabel: 'sent you a kiss 💕'    },
  { id: 'stars',    emoji: '⭐', label: 'dazzled!', color: '#FFD700', anim: 'starburst', haptic: 'light',  ownLabel: 'you scattered stars',    otherLabel: 'scattered stars ✦'     },
  { id: 'fire',     emoji: '🔥', label: 'fire!',    color: '#FF6B35', anim: 'fire',      haptic: 'medium', ownLabel: 'you lit a fire',         otherLabel: 'lit a fire 🔥'         },
  { id: 'snow',     emoji: '❄️', label: 'brr~',     color: '#78C8DC', anim: 'snow',      haptic: 'light',  ownLabel: 'you cast a blizzard',    otherLabel: 'cast a blizzard ❄️'    },
  { id: 'confetti', emoji: '🎉', label: 'yay!',     color: '#C8A84B', anim: 'confetti',  haptic: 'medium', ownLabel: 'you celebrated',         otherLabel: 'celebrated 🎉'         },
  { id: 'candle',   emoji: '🕯️', label: 'candle',   color: '#C8A84B', anim: 'glow',      haptic: 'light',  ownLabel: 'you offered a candle',   otherLabel: 'offered a candle 🕯️'  },
  { id: 'spark',    emoji: '✦',  label: 'spark',    color: '#B890FF', anim: 'sparkle',   haptic: 'light',  ownLabel: 'you sent a spark',       otherLabel: 'sent a spark ✦'        },
  { id: 'lantern',  emoji: '🌙', label: 'lantern',  color: '#78B4DC', anim: 'float',     haptic: 'light',  ownLabel: 'you lit a lantern',      otherLabel: 'lit a lantern 🌙'      },
  { id: 'hush',     emoji: '🤫', label: 'hush~',    color: '#C8B8E8', anim: 'fade',      haptic: 'light',  ownLabel: 'you fell silent',        otherLabel: 'fell silent 🤫'        },
  { id: 'donkey',   emoji: '🫏', label: 'hee-haw!', color: '#D4A256', anim: 'donkey',    haptic: 'heavy',  ownLabel: 'you sent the donkey',    otherLabel: 'sent the donkey 🫏'    },
  { id: 'wolf',     emoji: '🐺', label: 'awoo~',    color: '#7B68C8', anim: 'wolf',      haptic: 'medium', ownLabel: 'you howled at the moon', otherLabel: 'howled at the moon 🌕' },
];

export function getSticker(id: string): StickerDef {
  return STICKERS.find(s => s.id === id) ?? STICKERS[9];
}

// ── Haptic helpers ────────────────────────────────────────────────────────────
async function fireHaptic(def: StickerDef) {
  switch (def.haptic) {
    case 'heavy':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise(r => setTimeout(r, 80));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'medium':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise(r => setTimeout(r, 60));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    default:
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string) {
  const d   = new Date(iso);
  const now = new Date();
  const dt  = now.getTime() - d.getTime();
  if (dt < 86400000 && d.getDay() === now.getDay()) return 'Today';
  if (dt < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Star background decoration ────────────────────────────────────────────────
const STARS = Array.from({ length: 28 }, (_, i) => ({
  key: `s${i}`,
  left: `${Math.random() * 98}%` as `${number}%`,
  top:  `${Math.random() * 90}%` as `${number}%`,
  size: Math.random() < 0.3 ? 2.5 : 1.5,
  opacity: 0.08 + Math.random() * 0.18,
}));

// ── Sticker bubble (in chat history) ─────────────────────────────────────────
function StickerBubble({ msg, partnerInitial, avatarUri, primaryColor }: {
  msg: Message; partnerInitial: string; avatarUri?: string; primaryColor: string;
}) {
  const def    = getSticker(msg.expression!);
  const scaleA = useRef(new Animated.Value(0.3)).current;
  const opA    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleA, { toValue: 1, tension: 150, friction: 7, useNativeDriver: true }),
      Animated.timing(opA, { toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = msg.isOwn ? def.ownLabel : def.otherLabel;

  if (msg.isOwn) {
    return (
      <View style={styles.exprRowOwn}>
        <Animated.View style={{ opacity: opA, transform: [{ scale: scaleA }] }}>
          <View style={[styles.stickerCard, { borderColor: `${def.color}40`, backgroundColor: `${def.color}18` }]}>
            <Text style={styles.stickerCardEmoji}>{def.emoji}</Text>
            <View style={styles.stickerCardBody}>
              <Text style={[styles.stickerCardLabel, { color: `${def.color}E0` }]}>{def.label}</Text>
              <Text style={styles.stickerCardSubtitle}>{label}</Text>
              <Text style={styles.stickerCardTime}>{fmtTime(msg.createdAt)}</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.exprRowOther}>
      <View style={[styles.bubbleAvatarSm, { backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}30`, overflow: 'hidden' }]}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <Text style={[styles.bubbleAvatarSmText, { color: primaryColor }]}>{partnerInitial}</Text>
        }
      </View>
      <Animated.View style={{ opacity: opA, transform: [{ scale: scaleA }] }}>
        <View style={[styles.stickerCard, { borderColor: `${def.color}40`, backgroundColor: `${def.color}18` }]}>
          <Text style={styles.stickerCardEmoji}>{def.emoji}</Text>
          <View style={styles.stickerCardBody}>
            <Text style={[styles.stickerCardLabel, { color: `${def.color}E0` }]}>{def.label}</Text>
            <Text style={styles.stickerCardSubtitle}>{label}</Text>
            <Text style={styles.stickerCardTime}>{fmtTime(msg.createdAt)}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const { userId, name, handle, avatarUri, isGuide } = useLocalSearchParams<{
    userId:     string;
    name?:      string;
    handle?:    string;
    avatarUri?: string;
    isGuide?:   string;
  }>();
  const insets = useSafeAreaInsets();
  const { markDmThreadRead } = useApp();
  const { playStickerSound } = useSound();
  const { userId: myUserId } = useAuth();

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [input,      setInput]      = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [headerH,    setHeaderH]    = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  const [playingAnim, setPlayingAnim] = useState<{ type: StickerAnimType; emoji: string } | null>(null);

  const lastMsgIdRef = useRef<string | null>(null);
  const flatRef      = useRef<FlatList<ListItem>>(null);

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'ios'  ? insets.bottom : 8;

  const partnerSubtitle = isGuide === 'true'
    ? 'Constellation Guide'
    : handle ? `@${handle}` : null;

  const playSticker = useCallback((def: StickerDef) => {
    setPlayingAnim({ type: def.anim, emoji: def.emoji });
    fireHaptic(def);
    playStickerSound(def.id);
  }, [playStickerSound]);

  // Queue of sticker animations waiting to play (so back-to-back stickers each get their moment)
  const stickerQueueRef = useRef<StickerDef[]>([]);
  const animBusyRef     = useRef(false);

  const drainStickerQueue = useCallback(() => {
    if (animBusyRef.current || stickerQueueRef.current.length === 0) return;
    const next = stickerQueueRef.current.shift()!;
    animBusyRef.current = true;
    setPlayingAnim({ type: next.anim, emoji: next.emoji });
    fireHaptic(next);
    playStickerSound(next.id);
  }, [playStickerSound]);

  const queueSticker = useCallback((def: StickerDef) => {
    stickerQueueRef.current.push(def);
    drainStickerQueue();
  }, [drainStickerQueue]);

  // Called when the overlay animation finishes — play next in queue if any
  const handleAnimComplete = useCallback(() => {
    setPlayingAnim(null);
    animBusyRef.current = false;
    drainStickerQueue();
  }, [drainStickerQueue]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiFetch<Message[]>(`/messages/${userId}`);
      const msgs = data ?? [];
      const isFirstLoad = lastMsgIdRef.current === null;

      if (!isFirstLoad && msgs.length > 0) {
        // ── Poll cycle: animate every new incoming sticker, in order ─────────
        const lastKnownIdx = msgs.findIndex(m => m.id === lastMsgIdRef.current);
        if (lastKnownIdx !== -1) {
          const newMsgs = msgs.slice(lastKnownIdx + 1);
          newMsgs
            .filter(m => !m.isOwn && m.expression)
            .forEach(m => queueSticker(getSticker(m.expression!)));
        }
      } else if (isFirstLoad && msgs.length > 0) {
        // ── First open: animate the most recent UNREAD sticker if fresh (≤ 3 min) ─
        const freshCutoff = Date.now() - 3 * 60 * 1000;
        const freshUnread = [...msgs]
          .reverse()
          .find(m => !m.isOwn && m.expression && !m.isRead && new Date(m.createdAt).getTime() > freshCutoff);
        if (freshUnread?.expression) {
          // Small delay so the screen finishes loading before the animation fires
          setTimeout(() => queueSticker(getSticker(freshUnread.expression!)), 700);
        }
      }

      if (msgs.length > 0) lastMsgIdRef.current = msgs[msgs.length - 1].id;

      setMessages(msgs);
      markDmThreadRead(userId);
    } catch {
      setError('Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [userId, markDmThreadRead, queueSticker]);

  useEffect(() => { load(); }, [load]);

  // ── SSE: live push for incoming messages ──────────────────────────────────
  // Subscribe to our own userId channel — the server emits to it when anyone
  // sends us a message, so we can append without polling.
  useSSE(
    myUserId ? [`messages:${myUserId}`] : [],
    useCallback((_channel: string, data: unknown) => {
      const ev = data as {
        type: string; id: string; fromUserId: string; toUserId: string;
        content: string | null; expression: string | null;
        isRead: boolean; createdAt: string; isOwn: boolean;
      };
      // Only append if it's from the person we're currently chatting with
      if (ev?.type !== 'new_message' || ev.fromUserId !== userId) return;
      setMessages(prev => {
        if (prev.find(m => m.id === ev.id)) return prev; // deduplicate
        const newMsg: Message = { ...ev, isOwn: false };
        lastMsgIdRef.current = ev.id;
        // Animate incoming sticker
        if (ev.expression) {
          const def = getSticker(ev.expression);
          queueSticker(def);
        }
        markDmThreadRead(userId ?? '');
        return [...prev, newMsg];
      });
    }, [userId, markDmThreadRead, queueSticker]),
  );

  // Slow background poll as a fallback (catches anything SSE misses)
  useFocusEffect(useCallback(() => {
    const interval = setInterval(() => { load().catch(() => null); }, 30_000);
    return () => clearInterval(interval);
  }, [load]));

  const scrollToBottom = useCallback(() => {
    flatRef.current?.scrollToEnd({ animated: false });
  }, []);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending || !userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`, fromUserId: 'me', toUserId: userId,
      content, expression: null, isRead: false, createdAt: new Date().toISOString(), isOwn: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const sent = await apiFetch<Message>(`/messages/${userId}`, {
        method: 'POST', body: JSON.stringify({ content }),
      });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? (sent ?? optimistic) : m));
      if (sent?.id) lastMsgIdRef.current = sent.id;
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [input, sending, userId]);

  const handleSticker = useCallback(async (def: StickerDef) => {
    if (sending || !userId) return;
    setShowPicker(false);
    setSending(true);
    playSticker(def);
    const optimistic: Message = {
      id: `temp-${Date.now()}`, fromUserId: 'me', toUserId: userId,
      content: null, expression: def.id, isRead: false, createdAt: new Date().toISOString(), isOwn: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const sent = await apiFetch<Message>(`/messages/${userId}`, {
        method: 'POST', body: JSON.stringify({ expression: def.id }),
      });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? (sent ?? optimistic) : m));
      if (sent?.id) lastMsgIdRef.current = sent.id;
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }, [sending, userId, playSticker]);

  // Build flat list with date separators
  const listData: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = fmtDate(msg.createdAt);
    if (d !== lastDate) {
      listData.push({ type: 'date', date: d, key: `date-${d}-${msg.id}` });
      lastDate = d;
    }
    listData.push({ type: 'msg', msg, key: msg.id });
  }

  const partnerInitial = (name ?? 'G').charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      {/* ── Static star background ─────────────────────────── */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {STARS.map(s => (
          <View key={s.key} style={{
            position: 'absolute', left: s.left, top: s.top,
            width: s.size, height: s.size, borderRadius: s.size / 2,
            backgroundColor: '#C8B8E8', opacity: s.opacity,
          }} />
        ))}
      </View>

      {/* ── Header ──────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0B0820', '#100C30', '#160A42']}
        style={[styles.header, { paddingTop: topPad }]}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        {/* Nebula glow orbs */}
        <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(107,78,232,0.12)', top: -60, right: -30 }} />
          <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(60,140,240,0.08)', top: 10, left: 40 }} />
        </View>

        <View style={styles.headerRow}>
          <BackButton color="rgba(210,200,255,0.85)" />

          <View style={styles.partnerInfo}>
            {/* Avatar with glow ring */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatarGlow} />
              <View style={styles.partnerAvatar}>
                {avatarUri
                  ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  : <LinearGradient colors={['rgba(107,78,232,0.75)', 'rgba(60,100,240,0.55)']} style={StyleSheet.absoluteFill} />
                }
                {!avatarUri && <Text style={styles.partnerInitial}>{partnerInitial}</Text>}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.partnerName} numberOfLines={1}>{name ?? 'Guide'}</Text>
              {partnerSubtitle && (
                <Text style={styles.partnerSubtitle} numberOfLines={1}>{partnerSubtitle}</Text>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Messages ─────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerWrap}><ActivityIndicator color={PURPLE} /></View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={{ color: MUTED, fontFamily: 'Satoshi-Regular' }}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={headerH}
        >
          <FlatList<ListItem>
            ref={flatRef}
            data={listData}
            keyExtractor={item => item.key}
            contentContainerStyle={[styles.listPad, { paddingBottom: 14 }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            onLayout={scrollToBottom}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <LinearGradient
                  colors={[`${PURPLE}28`, `${PURPLE}10`]}
                  style={styles.emptyIcon}
                >
                  <Text style={{ fontSize: 32 }}>✦</Text>
                </LinearGradient>
                <Text style={styles.emptyTitle}>Begin your story</Text>
                <Text style={styles.emptyBody}>
                  {isGuide === 'true'
                    ? "Your guide awaits. They'll help you navigate the sky."
                    : 'Send a whisper, or tap ✦ to throw something fun.'}
                </Text>
              </View>
            }
            renderItem={({ item }: { item: ListItem }) => {
              if (item.type === 'date') {
                return (
                  <View style={styles.dateSep}>
                    <View style={styles.dateLine} />
                    <View style={styles.datePill}>
                      <Text style={styles.dateText}>{item.date}</Text>
                    </View>
                    <View style={styles.dateLine} />
                  </View>
                );
              }
              const msg = item.msg;
              if (msg.expression) {
                return (
                  <StickerBubble
                    msg={msg}
                    partnerInitial={partnerInitial}
                    avatarUri={avatarUri}
                    primaryColor={PURPLE}
                  />
                );
              }
              return (
                <View style={[styles.msgRow, msg.isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
                  {!msg.isOwn && (
                    <View style={[styles.bubbleAvatarSm, { backgroundColor: 'rgba(107,78,232,0.18)', borderColor: 'rgba(107,78,232,0.30)', overflow: 'hidden' }]}>
                      {avatarUri
                        ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        : <Text style={[styles.bubbleAvatarSmText, { color: PURPLE }]}>{partnerInitial}</Text>
                      }
                    </View>
                  )}
                  <View style={[
                    styles.bubble,
                    msg.isOwn ? styles.bubbleOwn : styles.bubbleOther,
                  ]}>
                    {msg.isOwn && (
                      <LinearGradient
                        colors={[PURPLE, PURPLE2]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Text style={[styles.bubbleText, { color: msg.isOwn ? 'rgba(255,255,255,0.95)' : 'rgba(220,210,255,0.90)' }]}>
                      {msg.content}
                    </Text>
                    <Text style={[styles.bubbleTime, { color: msg.isOwn ? 'rgba(255,255,255,0.40)' : 'rgba(200,184,232,0.40)' }]}>
                      {fmtTime(msg.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* ── Sticker picker sheet ────────────────────────── */}
          {showPicker && (
            <View style={styles.pickerSheet}>
              {/* Handle */}
              <View style={styles.pickerHandle} />
              <Text style={styles.pickerTitle}>✦  expressions</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <View style={styles.pickerGrid}>
                  {STICKERS.map(def => (
                    <TouchableOpacity
                      key={def.id}
                      style={[styles.pickerCell, { borderColor: `${def.color}35`, backgroundColor: `${def.color}12` }]}
                      onPress={() => handleSticker(def)}
                      activeOpacity={0.70}
                    >
                      <Text style={styles.pickerEmoji}>{def.emoji}</Text>
                      <Text style={[styles.pickerLabel, { color: `${def.color}CC` }]}>{def.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* ── Input bar ─────────────────────────────────── */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(bottomPad, 8) }]}>
            <TouchableOpacity
              style={[
                styles.stickerToggleBtn,
                showPicker && { backgroundColor: `${PURPLE}28`, borderColor: `${PURPLE}60` },
              ]}
              onPress={() => { Haptics.selectionAsync(); setShowPicker(v => !v); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.75}
            >
              <Text style={[styles.stickerToggleIcon, { color: showPicker ? PURPLE : MUTED }]}>✦</Text>
            </TouchableOpacity>

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={t => { setInput(t); if (showPicker) setShowPicker(false); }}
                placeholder="Send a whisper…"
                placeholderTextColor="rgba(200,184,232,0.30)"
                multiline
                maxLength={2000}
                returnKeyType="send"
                blurOnSubmit={Platform.OS !== 'ios'}
                onSubmitEditing={Platform.OS !== 'ios' ? handleSend : undefined}
              />
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
                : (
                  <LinearGradient
                    colors={input.trim() ? [PURPLE, PURPLE2] : ['rgba(107,78,232,0.25)', 'rgba(59,42,140,0.25)']}
                    style={StyleSheet.absoluteFill}
                  />
                )
              }
              {!sending && <Icon name="send" size={15} color={input.trim() ? '#fff' : 'rgba(255,255,255,0.30)'} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Full-screen sticker animation overlay ─────────── */}
      {playingAnim && (
        <ChatStickerAnimation
          type={playingAnim.type}
          mainEmoji={playingAnim.emoji}
          onComplete={handleAnimComplete}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT },

  // ── Header
  header:          { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  partnerInfo:     { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 },

  avatarWrap:    { position: 'relative', width: 46, height: 46 },
  avatarGlow:    {
    position: 'absolute', inset: -4,
    borderRadius: 27, borderWidth: 1.5,
    borderColor: 'rgba(107,78,232,0.45)',
  },
  partnerAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(107,78,232,0.25)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  partnerInitial:  { fontSize: 20, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.95)' },
  partnerName:     { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(225,215,255,0.97)', letterSpacing: -0.2 },
  partnerSubtitle: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.50)', marginTop: 1 },

  // ── Messages list
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listPad:    { paddingHorizontal: 14, paddingTop: 14 },

  // ── Empty state
  emptyWrap:  { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40 },
  emptyIcon:  { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(107,78,232,0.20)' },
  emptyTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.90)', marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody:  { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 21, color: MUTED },

  // ── Date separator
  dateSep:  { flexDirection: 'row', alignItems: 'center', marginVertical: 14, gap: 8 },
  dateLine: { flex: 1, height: 1, backgroundColor: 'rgba(200,184,232,0.08)' },
  datePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(200,184,232,0.07)', borderWidth: 1, borderColor: 'rgba(200,184,232,0.10)' },
  dateText: { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.45)', letterSpacing: 0.5 },

  // ── Message bubbles
  msgRow:      { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end', gap: 8 },
  msgRowOwn:   { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  bubbleAvatarSm:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 2, flexShrink: 0 },
  bubbleAvatarSmText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  bubble:      { maxWidth: '76%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 3, overflow: 'hidden' },
  bubbleOwn:   { borderBottomRightRadius: 5 },
  bubbleOther: { borderBottomLeftRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: BORDER },
  bubbleText:  { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 21 },
  bubbleTime:  { fontSize: 10, fontFamily: 'Satoshi-Regular', alignSelf: 'flex-end' },

  // ── Sticker row + card
  exprRowOwn:   { flexDirection: 'row', justifyContent: 'flex-end',   marginBottom: 8, marginRight: 4 },
  exprRowOther: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 8, marginLeft: 4, alignItems: 'flex-end', gap: 8 },

  stickerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 18, borderWidth: 1.5,
    maxWidth: 240,
  },
  stickerCardEmoji:    { fontSize: 32 },
  stickerCardBody:     { flexShrink: 1, gap: 1 },
  stickerCardLabel:    { fontSize: 13, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  stickerCardSubtitle: { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', color: 'rgba(200,184,232,0.55)' },
  stickerCardTime:     { fontSize: 9, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.35)', marginTop: 2 },

  // ── Sticker picker
  pickerSheet: {
    backgroundColor: NIGHT2,
    borderTopWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
    maxHeight: 310,
  },
  pickerHandle: {
    width: 36, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(200,184,232,0.18)',
    alignSelf: 'center', marginBottom: 10,
  },
  pickerTitle: {
    fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 1.8,
    textTransform: 'uppercase', textAlign: 'center',
    marginBottom: 10, color: 'rgba(200,184,232,0.40)',
  },
  pickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    justifyContent: 'center', paddingBottom: 4,
  },
  pickerCell: {
    width: 70, alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: 16, borderWidth: 1,
  },
  pickerEmoji:  { fontSize: 30, lineHeight: 36 },
  pickerLabel:  { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 0.4, textAlign: 'center', textTransform: 'uppercase' },

  // ── Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: NIGHT2,
    borderTopWidth: 1, borderColor: BORDER,
  },
  stickerToggleBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(200,184,232,0.05)',
    borderWidth: 1, borderColor: BORDER,
    marginBottom: 2,
  },
  stickerToggleIcon: { fontSize: 18, lineHeight: 22 },
  inputWrap: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22, borderWidth: 1, borderColor: BORDER,
    minHeight: 40, justifyContent: 'center',
  },
  input: {
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    color: 'rgba(220,210,255,0.92)', maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 2,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(107,78,232,0.35)',
  },
  sendBtnDisabled: { borderColor: 'rgba(107,78,232,0.15)' },
});
