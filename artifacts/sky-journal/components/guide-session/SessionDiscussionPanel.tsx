import { Icon } from '@/components/Icon';
import { apiFetch, useApp } from '@/context/AppContext';
import { useSSE } from '@/hooks/useSSE';
import { mergeSessionDiscussion, reconcileSessionDiscussion, type SessionDiscussionMessage } from '@/utils/sessionDiscussion';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { type Colors, type SessionPhase, Notice, PillButton, errorMessage, gs } from './shared';

export const SessionDiscussionPanel = React.memo(function SessionDiscussionPanel({ roomId, sessionId, guideId, phase, colors, enabled }: {
  roomId: string; sessionId: string; guideId: string; phase: SessionPhase; colors: Colors; enabled: boolean;
}) {
  const { userId } = useAuth();
  const { blockedIds } = useApp();
  const scope = JSON.stringify([userId, sessionId, roomId]);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [history, setHistory] = useState<{ scope: string; messages: SessionDiscussionMessage[] }>({ scope, messages: [] });
  const [draft, setDraft] = useState({ scope, text: '' });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const active = enabled && !!userId && !!roomId && phase !== 'cancelled';
  const activeRef = useRef(active);
  activeRef.current = active;
  const fetching = useRef(false);
  const sendLock = useRef(false);
  const version = useRef(0);
  const changes = useRef(new Map<string, { version: number; message: SessionDiscussionMessage | null }>());
  const list = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const messages = useMemo(() => history.scope === scope ? mergeSessionDiscussion(history.messages, [], blockedIds) : [], [history, scope, blockedIds]);
  const text = draft.scope === scope ? draft.text : '';
  const canSend = active && loaded && phase !== 'ended';

  useEffect(() => {
    setHistory({ scope, messages: [] });
    setDraft({ scope, text: '' });
    setLoaded(false); setError(null); setFeedback(null); setSending(false);
    fetching.current = false; sendLock.current = false;
    changes.current.clear(); version.current = 0; atBottom.current = true;
  }, [scope]);

  const record = useCallback((messageId: string, message: SessionDiscussionMessage | null) => {
    if (!activeRef.current || scopeRef.current !== scope) return;
    changes.current.set(messageId, { version: ++version.current, message });
    if (changes.current.size > 200) changes.current.delete(changes.current.keys().next().value!);
    setHistory(current => ({
      scope,
      messages: reconcileSessionDiscussion(current.scope === scope ? current.messages : [], [{ messageId, message }], blockedIds),
    }));
  }, [scope, blockedIds]);

  const load = useCallback(async () => {
    if (!activeRef.current || fetching.current) return;
    fetching.current = true;
    const started = version.current;
    try {
      const result = await apiFetch<{ messages: SessionDiscussionMessage[] }>(`/campfire/${encodeURIComponent(roomId)}`);
      if (scopeRef.current !== scope || !activeRef.current) return;
      const liveChanges = [...changes.current].filter(([, value]) => value.version > started)
        .map(([messageId, value]) => ({ messageId, message: value.message }));
      setHistory({ scope, messages: reconcileSessionDiscussion(result.messages, liveChanges, blockedIds) });
      setLoaded(true); setError(null);
    } catch (cause) {
      if (scopeRef.current === scope && activeRef.current) setError(errorMessage(cause, 'Discussion could not be loaded. Try again.'));
    } finally {
      if (scopeRef.current === scope) fetching.current = false;
    }
  }, [scope, roomId, blockedIds]);

  const { connected } = useSSE(active ? [`campfire:${roomId}`] : [], useCallback((_channel, raw) => {
    if (!raw || typeof raw !== 'object') return;
    const event = raw as { type?: string; message?: SessionDiscussionMessage; messageId?: string };
    if (event.type === 'new_message' && event.message?.id) record(event.message.id, event.message);
    if (event.type === 'deleted_message' && event.messageId) record(event.messageId, null);
  }, [record]), active);

  useFocusEffect(useCallback(() => {
    if (!active) return;
    void load();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void load();
    }, connected ? 60_000 : 15_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, [active, connected, load]));

  useEffect(() => {
    activeRef.current = active;
    return () => { activeRef.current = false; };
  }, [active]);

  async function send() {
    if (!canSend || sendLock.current || !text.trim()) return;
    sendLock.current = true; setSending(true); setFeedback(null);
    const submitted = text;
    try {
      const message = await apiFetch<SessionDiscussionMessage>(`/campfire/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST', body: JSON.stringify({ content: submitted.trim() }),
      });
      if (scopeRef.current !== scope) return;
      // Acknowledgement is authoritative even if the person changed tabs.
      setHistory(current => ({ scope, messages: mergeSessionDiscussion(current.scope === scope ? current.messages : [], [message], blockedIds) }));
      changes.current.set(message.id, { version: ++version.current, message });
      setDraft(current => current.scope === scope && current.text === submitted ? { scope, text: '' } : current);
      atBottom.current = true;
    } catch (cause) {
      if (scopeRef.current === scope) setFeedback(errorMessage(cause, 'Message not sent. Your draft is kept; try again.'));
    } finally {
      if (scopeRef.current === scope) { sendLock.current = false; setSending(false); }
    }
  }

  async function report(messageId: string) {
    try {
      await apiFetch(`/campfire/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/report`, {
        method: 'POST', body: JSON.stringify({ reason: 'Inappropriate message in session discussion' }),
      });
      if (scopeRef.current === scope) setFeedback('Report sent for review.');
    } catch (cause) {
      if (scopeRef.current === scope) setFeedback(errorMessage(cause, 'Could not send the report. Try again.'));
    }
  }

  return (
    <View testID="session-discussion" style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[gs.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
        <View>
          <Text style={[gs.cardTitle, { color: colors.foreground }]}>Session discussion</Text>
          <Text style={[gs.meta, { color: colors.mutedForeground }]}>{phase === 'ended' ? 'Read the recent conversation' : connected ? 'Live updates · everyone in this session' : 'Connecting · refreshes automatically'}</Text>
        </View>
        <Icon name="message-circle" size={20} color={colors.primary} />
      </View>
      {error && <View style={{ marginBottom: 8 }}><Notice colors={colors} icon="cloud-off" text={error} /><PillButton colors={colors} label="Retry discussion" variant="secondary" onPress={() => void load()} /></View>}
      <ScrollView ref={list} nestedScrollEnabled keyboardShouldPersistTaps="handled" style={s.messages}
        contentContainerStyle={{ gap: 12, paddingVertical: 8 }}
        onScroll={event => { const e = event.nativeEvent; atBottom.current = e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height < 70; }}
        scrollEventThrottle={100}
        onContentSizeChange={() => { if (atBottom.current) list.current?.scrollToEnd({ animated: false }); }}>
        {!loaded && !error ? [0, 1, 2].map(i => <View key={i} style={[s.placeholder, { width: i === 1 ? '64%' : '82%', alignSelf: i === 1 ? 'flex-end' : 'flex-start', backgroundColor: colors.muted }]} />) : null}
        {loaded && !messages.length && <View style={s.empty}><Icon name="message-circle" size={28} color={colors.primary} /><Text style={[gs.cardTitle, { color: colors.foreground, textAlign: 'center' }]}>A place to learn together</Text><Text style={[gs.body, { color: colors.mutedForeground, textAlign: 'center' }]}>{phase === 'ended' ? 'There are no recent messages to show.' : 'Say hello, share a thought, or discuss the current activity. Use Q&A for questions you want the guide to answer.'}</Text></View>}
        {messages.map(message => {
          const own = message.userId === userId;
          return <View key={message.id} style={{ alignItems: own ? 'flex-end' : 'flex-start' }}>
            <View style={[s.bubble, { backgroundColor: own ? colors.primary : colors.muted }]}>
              <View style={[gs.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
                <Text numberOfLines={1} style={[s.author, { flex: 1, color: own ? colors.primaryForeground : colors.primary }]}>{own ? 'You' : message.authorName}{message.userId === guideId ? ' · Guide' : ''}</Text>
                {!own && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Report message by ${message.authorName}`} hitSlop={10} onPress={() => void report(message.id)}><Icon name="flag" size={13} color={colors.mutedForeground} /></TouchableOpacity>}
              </View>
              <Text selectable style={[s.body, { color: own ? colors.primaryForeground : colors.foreground }]}>{message.content || `Reaction: ${message.expression ?? 'expression'}`}</Text>
              <Text style={[s.time, { color: own ? colors.primaryForeground : colors.mutedForeground }]}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          </View>;
        })}
      </ScrollView>
      {!!feedback && <Text accessibilityLiveRegion="polite" style={[gs.meta, { marginVertical: 8, color: colors.mutedForeground }]}>{feedback}</Text>}
      {phase === 'ended' ? <Notice colors={colors} icon="check-circle" text="This session has ended. Discussion is read-only; find the recap in Activity." /> : (
        <View style={[s.composer, { borderTopColor: colors.border }]}>
          <TextInput testID="session-discussion-input" accessibilityLabel="Message this session" value={text}
            onChangeText={value => setDraft({ scope, text: value })} maxLength={500} multiline
            editable={active} placeholder="Share with the session…" placeholderTextColor={colors.mutedForeground}
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]} />
          <TouchableOpacity testID="session-discussion-send" accessibilityRole="button" accessibilityLabel={sending ? 'Sending message' : 'Send message'}
            accessibilityState={{ disabled: !canSend || !text.trim() || sending, busy: sending }} disabled={!canSend || !text.trim() || sending}
            onPress={() => void send()} style={[s.send, { backgroundColor: colors.primary, opacity: !canSend || !text.trim() || sending ? 0.45 : 1 }]}>
            <Icon name={sending ? 'clock' : 'send'} size={19} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 16 },
  messages: { height: 350, flexGrow: 0 },
  placeholder: { height: 48, borderRadius: 16, marginBottom: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 44 },
  bubble: { maxWidth: '90%', borderRadius: 17, padding: 12, minWidth: 90 },
  author: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  body: { fontSize: 14, lineHeight: 21, fontFamily: 'Satoshi-Medium' },
  time: { fontSize: 10, marginTop: 5, textAlign: 'right', opacity: 0.75, fontFamily: 'Satoshi-Medium' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  input: { flex: 1, minHeight: 46, maxHeight: 110, borderRadius: 16, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: 'Satoshi-Medium' },
  send: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
