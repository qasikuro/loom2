import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

// ── Expression config ─────────────────────────────────────────────────────────

const EXPRESSIONS: { id: string; emoji: string; label: string; color: string }[] = [
  { id: 'candle',  emoji: '🕯️', label: 'offered a candle', color: '#C8A84B' },
  { id: 'spark',   emoji: '✦',  label: 'sent a spark',      color: '#B890FF' },
  { id: 'lantern', emoji: '🌙', label: 'lit a lantern',      color: '#78B4DC' },
  { id: 'hush',    emoji: '🤫', label: 'fell silent',        color: '#C8B8E8' },
];

function getExpr(id: string) {
  return EXPRESSIONS.find(e => e.id === id) ?? { emoji: '✦', label: id, color: '#C8B8E8' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  const d     = new Date(iso);
  const now   = new Date();
  const delta = now.getTime() - d.getTime();
  if (delta < 86400000 && d.getDay() === now.getDay()) return 'Today';
  if (delta < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Expression bubble with pop-in animation ───────────────────────────────────

function ExpressionBubble({ msg, partnerInitial, avatarUri, primaryColor }: {
  msg: Message; partnerInitial: string; avatarUri?: string; primaryColor: string;
}) {
  const expr   = getExpr(msg.expression!);
  const scaleA = useRef(new Animated.Value(0.5)).current;
  const opA    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleA, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
      Animated.timing(opA, { toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (msg.isOwn) {
    return (
      <View style={styles.exprRowOwn}>
        <Animated.View style={[
          styles.exprPill,
          { borderColor: `${expr.color}45`, backgroundColor: `${expr.color}14`, opacity: opA, transform: [{ scale: scaleA }] },
        ]}>
          <Text style={styles.exprEmoji}>{expr.emoji}</Text>
          <Text style={[styles.exprLabel, { color: `${expr.color}CC` }]}>you {expr.label}</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.exprRowOther}>
      <View style={[styles.bubbleAvatar, { backgroundColor: `${primaryColor}18`, borderColor: `${primaryColor}30` }]}>
        {avatarUri
          ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : <Text style={[styles.bubbleAvatarText, { color: primaryColor }]}>{partnerInitial}</Text>
        }
      </View>
      <Animated.View style={[
        styles.exprPill,
        { borderColor: `${expr.color}45`, backgroundColor: `${expr.color}14`, opacity: opA, transform: [{ scale: scaleA }] },
      ]}>
        <Text style={styles.exprEmoji}>{expr.emoji}</Text>
        <Text style={[styles.exprLabel, { color: `${expr.color}CC` }]}>{expr.label}</Text>
      </Animated.View>
    </View>
  );
}

export default function MessagesScreen() {
  const { userId, name, handle, avatarUri, isGuide } = useLocalSearchParams<{
    userId:     string;
    name?:      string;
    handle?:    string;
    avatarUri?: string;
    isGuide?:   string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { markDmThreadRead } = useApp();

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [sending,        setSending]        = useState(false);
  const [input,          setInput]          = useState('');
  const [error,          setError]          = useState<string | null>(null);
  const [headerH,        setHeaderH]        = useState(0);
  const [showExprPicker, setShowExprPicker] = useState(false);

  const flatRef = useRef<FlatList<ListItem>>(null);

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'ios'  ? insets.bottom : 8;

  const partnerSubtitle = isGuide === 'true'
    ? 'Constellation Guide'
    : handle ? `@${handle}` : null;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiFetch<Message[]>(`/messages/${userId}`);
      setMessages(data ?? []);
      markDmThreadRead(userId);
    } catch {
      setError('Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [userId, markDmThreadRead]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => {
    const interval = setInterval(() => { load().catch(() => null); }, 8000);
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
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(content);
    } finally {
      setSending(false);
    }
  }, [input, sending, userId]);

  const handleExpression = useCallback(async (exprId: string) => {
    if (sending || !userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowExprPicker(false);
    setSending(true);
    const optimistic: Message = {
      id: `temp-${Date.now()}`, fromUserId: 'me', toUserId: userId,
      content: null, expression: exprId, isRead: false, createdAt: new Date().toISOString(), isOwn: true,
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const sent = await apiFetch<Message>(`/messages/${userId}`, {
        method: 'POST', body: JSON.stringify({ expression: exprId }),
      });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? (sent ?? optimistic) : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }, [sending, userId]);

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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ── Header ──────────────────────────────────────────── */}
      <LinearGradient
        colors={['#0B0820', '#130B34', '#1A0E48']}
        style={[styles.header, { paddingTop: topPad }]}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(120,70,255,0.15)', top: -50, right: -20, pointerEvents: 'none' }} />
        <View style={styles.headerRow}>
          <BackButton color="rgba(210,200,255,0.8)" />
          <View style={styles.partnerInfo}>
            <View style={[styles.partnerAvatar, { overflow: 'hidden' }]}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                : <LinearGradient colors={['rgba(120,70,255,0.55)', 'rgba(60,140,240,0.40)']} style={StyleSheet.absoluteFill} />
              }
              {!avatarUri && <Text style={styles.partnerInitial}>{partnerInitial}</Text>}
            </View>
            <View>
              <Text style={styles.partnerName}>{name ?? 'Guide'}</Text>
              {partnerSubtitle && <Text style={styles.partnerSubtitle}>{partnerSubtitle}</Text>}
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Messages ─────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerWrap}><ActivityIndicator color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Regular' }}>{error}</Text>
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
            contentContainerStyle={[styles.listPad, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToBottom}
            onLayout={scrollToBottom}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                  <Icon name="message-circle" size={30} color={`${colors.primary}60`} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Start the conversation</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  {isGuide === 'true'
                    ? "Send a message to your guide. They're here to help you navigate the sky."
                    : 'Send a whisper or light a candle to begin.'}
                </Text>
              </View>
            }
            renderItem={({ item }: { item: ListItem }) => {
              if (item.type === 'date') {
                return (
                  <View style={styles.dateSep}>
                    <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{item.date}</Text>
                  </View>
                );
              }
              const msg = item.msg;

              if (msg.expression) {
                return (
                  <ExpressionBubble
                    msg={msg}
                    partnerInitial={partnerInitial}
                    avatarUri={avatarUri}
                    primaryColor={colors.primary}
                  />
                );
              }

              return (
                <View style={[styles.msgRow, msg.isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
                  {!msg.isOwn && (
                    <View style={[styles.bubbleAvatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30`, overflow: 'hidden' }]}>
                      {avatarUri
                        ? <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        : <Text style={[styles.bubbleAvatarText, { color: colors.primary }]}>{partnerInitial}</Text>
                      }
                    </View>
                  )}
                  <View style={[
                    styles.bubble,
                    msg.isOwn
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                  ]}>
                    <Text style={[styles.bubbleText, { color: msg.isOwn ? '#fff' : colors.foreground }]}>
                      {msg.content}
                    </Text>
                    <Text style={[styles.bubbleTime, { color: msg.isOwn ? 'rgba(255,255,255,0.55)' : colors.mutedForeground }]}>
                      {fmtTime(msg.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* ── Expression picker strip ────────────────────── */}
          {showExprPicker && (
            <View style={[styles.exprStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {EXPRESSIONS.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.exprBtn, { borderColor: `${e.color}35`, backgroundColor: `${e.color}12` }]}
                  onPress={() => handleExpression(e.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.exprBtnEmoji}>{e.emoji}</Text>
                  <Text style={[styles.exprBtnLabel, { color: `${e.color}CC` }]}>
                    {e.label.split(' ').slice(0, 2).join('\n')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Input bar ─────────────────────────────────── */}
          <View style={[
            styles.inputBar,
            { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: bottomPad },
          ]}>
            <TouchableOpacity
              style={[
                styles.exprToggleBtn,
                { borderColor: showExprPicker ? `${colors.primary}55` : 'rgba(200,184,232,0.18)' },
                showExprPicker && { backgroundColor: `${colors.primary}18` },
              ]}
              onPress={() => { Haptics.selectionAsync(); setShowExprPicker(v => !v); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.75}
            >
              <Text style={[styles.exprToggleIcon, { color: showExprPicker ? colors.primary : colors.mutedForeground }]}>✦</Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
              value={input}
              onChangeText={t => { setInput(t); if (showExprPicker) setShowExprPicker(false); }}
              placeholder="Send a whisper…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={2000}
              returnKeyType="send"
              blurOnSubmit={Platform.OS !== 'ios'}
              onSubmitEditing={Platform.OS !== 'ios' ? handleSend : undefined}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : `${colors.primary}30` }]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Icon name="send" size={16} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  partnerInfo:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  partnerAvatar:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(120,70,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  partnerInitial:  { fontSize: 18, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.9)' },
  partnerName:     { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.96)' },
  partnerSubtitle: { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listPad:    { paddingHorizontal: 14, paddingTop: 14 },

  emptyWrap:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon:  { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontFamily: 'Satoshi-Bold', marginBottom: 8, textAlign: 'center' },
  emptyBody:  { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 20 },

  dateSep:  { alignItems: 'center', marginVertical: 10 },
  dateText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },

  msgRow:      { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 8 },
  msgRowOwn:   { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  bubbleAvatar:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 2 },
  bubbleAvatarText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  bubble:     { maxWidth: '76%', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, gap: 4 },
  bubbleText: { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: 'Satoshi-Regular', alignSelf: 'flex-end' },

  exprRowOwn:   { flexDirection: 'row', justifyContent: 'flex-end',  marginBottom: 10, marginRight: 6 },
  exprRowOther: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10, marginLeft: 6, alignItems: 'center', gap: 8 },
  exprPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  exprEmoji: { fontSize: 18 },
  exprLabel: { fontSize: 12, fontFamily: 'Satoshi-Medium', fontStyle: 'italic' },

  exprStrip: {
    flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-around',
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, gap: 6,
  },
  exprBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  exprBtnEmoji: { fontSize: 22 },
  exprBtnLabel: { fontSize: 9, fontFamily: 'Satoshi-Medium', letterSpacing: 0.3, textAlign: 'center' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1,
  },
  exprToggleBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, marginBottom: 3,
  },
  exprToggleIcon: { fontSize: 17, lineHeight: 20 },
  input: {
    flex: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Satoshi-Regular', maxHeight: 120,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
