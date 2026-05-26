import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  content:    string;
  isRead:     boolean;
  createdAt:  string;
  isOwn:      boolean;
}

type ListItem =
  | { type: 'date'; date: string; key: string }
  | { type: 'msg';  msg: Message; key: string };

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string) {
  const d   = new Date(iso);
  const now = new Date();
  const delta = now.getTime() - d.getTime();
  if (delta < 86400000 && d.getDay() === now.getDay()) return 'Today';
  if (delta < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function MessagesScreen() {
  const { userId, name, avatarUri } = useLocalSearchParams<{
    userId:    string;
    name?:     string;
    avatarUri?: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [input,    setInput]    = useState('');
  const [error,    setError]    = useState<string | null>(null);

  const flatRef = useRef<FlatList<ListItem>>(null);

  const topPad    = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPad = Platform.OS === 'ios'  ? insets.bottom : 8;

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiFetch<Message[]>(`/messages/${userId}`);
      setMessages(data ?? []);
    } catch {
      setError('Could not load messages');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || sending || !userId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setSending(true);

    // Optimistic insert
    const optimistic: Message = {
      id:         `temp-${Date.now()}`,
      fromUserId: 'me',
      toUserId:   userId,
      content,
      isRead:     false,
      createdAt:  new Date().toISOString(),
      isOwn:      true,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const sent = await apiFetch<Message>(`/messages/${userId}`, {
        method: 'POST',
        body:   JSON.stringify({ content }),
      });
      setMessages(prev => prev.map(m => m.id === optimistic.id ? sent : m));
    } catch {
      // Remove optimistic on failure
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(content); // restore
    } finally {
      setSending(false);
    }
  }, [input, sending, userId]);

  const listData: ListItem[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = fmtDate(msg.createdAt);
    if (d !== lastDate) {
      listData.push({ type: 'date', date: d, key: `date-${d}` });
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
      >
        <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(120,70,255,0.15)', top: -50, right: -20, pointerEvents: 'none' }} />
        <View style={styles.headerRow}>
          <BackButton color="rgba(210,200,255,0.8)" />
          <View style={styles.partnerInfo}>
            <View style={[styles.partnerAvatar, { overflow: 'hidden' }]}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient
                  colors={['rgba(120,70,255,0.55)', 'rgba(60,140,240,0.40)']}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {!avatarUri && (
                <Text style={styles.partnerInitial}>{partnerInitial}</Text>
              )}
            </View>
            <View>
              <Text style={styles.partnerName}>{name ?? 'Guide'}</Text>
              <Text style={styles.partnerSubtitle}>Constellation Guide</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Messages ─────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Regular' }}>{error}</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList<ListItem>
            ref={flatRef}
            data={listData}
            keyExtractor={item => item.key}
            contentContainerStyle={[styles.listPad, { paddingBottom: 12 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}>
                  <Icon name="message-circle" size={30} color={`${colors.primary}60`} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Start the conversation</Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  Send a message to your guide. They're here to help you navigate the sky.
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
              return (
                <View style={[styles.msgRow, msg.isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
                  {!msg.isOwn && (
                    <View style={[styles.bubbleAvatar, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
                      <Text style={[styles.bubbleAvatarText, { color: colors.primary }]}>{partnerInitial}</Text>
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

          {/* ── Input bar ─────────────────────────────────── */}
          <View style={[
            styles.inputBar,
            { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: bottomPad },
          ]}>
            <TextInput
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]}
              value={input}
              onChangeText={setInput}
              placeholder="Send a message…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={2000}
              returnKeyType="send"
              blurOnSubmit={Platform.OS !== 'ios'}
              onSubmitEditing={Platform.OS !== 'ios' ? handleSend : undefined}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: input.trim() ? colors.primary : `${colors.primary}30` },
              ]}
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

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  partnerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(120,70,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerInitial: { fontSize: 18, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.9)' },
  partnerName:    { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.96)' },
  partnerSubtitle:{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)' },

  // Messages
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listPad:    { paddingHorizontal: 14, paddingTop: 14 },

  emptyWrap:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon:  {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Satoshi-Bold', marginBottom: 8, textAlign: 'center' },
  emptyBody:  { fontSize: 14, fontFamily: 'Satoshi-Regular', textAlign: 'center', lineHeight: 20 },

  dateSep:    { alignItems: 'center', marginVertical: 10 },
  dateText:   { fontSize: 11, fontFamily: 'Satoshi-Medium' },

  msgRow:     { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', gap: 8 },
  msgRowOwn:  { justifyContent: 'flex-end' },
  msgRowOther:{ justifyContent: 'flex-start' },

  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 2,
  },
  bubbleAvatarText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },

  bubble: {
    maxWidth: '76%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    gap: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: 'Satoshi-Regular', lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: 'Satoshi-Regular', alignSelf: 'flex-end' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Satoshi-Regular',
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
