import { Icon } from '@/components/Icon';
import { apiFetch, useApp } from '@/context/AppContext';
import { useSSE } from '@/hooks/useSSE';
import { mergeSessionDiscussion, reconcileSessionDiscussion, reuseSessionDiscussionMessages, type SessionDiscussionMessage } from '@/utils/sessionDiscussion';
import { useAuth } from '@clerk/expo';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DiscussionHistory } from './DiscussionHistory';
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
  const loadController = useRef<AbortController | null>(null);
  const messages = useMemo(() => history.scope === scope ? mergeSessionDiscussion(history.messages, [], blockedIds) : [], [history, scope, blockedIds]);
  const text = draft.scope === scope ? draft.text : '';
  const canSend = active && loaded && phase !== 'ended';

  useEffect(() => {
    setHistory({ scope, messages: [] });
    setDraft({ scope, text: '' });
    setLoaded(false); setError(null); setFeedback(null); setSending(false);
    fetching.current = false; sendLock.current = false;
    changes.current.clear(); version.current = 0;
    return () => { loadController.current?.abort(); };
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
    const controller = new AbortController();
    loadController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const result = await apiFetch<{ messages: SessionDiscussionMessage[] }>(`/campfire/${encodeURIComponent(roomId)}`, { signal: controller.signal });
      if (scopeRef.current !== scope || !activeRef.current) return;
      const liveChanges = [...changes.current].filter(([, value]) => value.version > started)
        .map(([messageId, value]) => ({ messageId, message: value.message }));
      const next = reconcileSessionDiscussion(result.messages, liveChanges, blockedIds);
      setHistory(current => {
        const stable = reuseSessionDiscussionMessages(current.scope === scope ? current.messages : [], next);
        return current.scope === scope && stable === current.messages ? current : { scope, messages: stable };
      });
      setLoaded(true); setError(null);
    } catch (cause) {
      if (scopeRef.current === scope && activeRef.current) setError(controller.signal.aborted
        ? 'Discussion is taking longer than expected. Check your connection and retry.'
        : errorMessage(cause, 'Discussion could not be loaded. Try again.'));
    } finally {
      clearTimeout(timeout);
      if (scopeRef.current === scope) fetching.current = false;
    }
  }, [scope, roomId, blockedIds]);

  const { connected } = useSSE(active ? [`campfire:${roomId}`] : [], useCallback((_channel, raw) => {
    if (!raw || typeof raw !== 'object') return;
    const event = raw as { type?: string; message?: SessionDiscussionMessage; messageId?: string };
    if (event.type === 'new_message' && event.message?.id) record(event.message.id, event.message);
    if (event.type === 'deleted_message' && event.messageId) record(event.messageId, null);
  }, [record]), active, true);

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
    } catch (cause) {
      if (scopeRef.current === scope) setFeedback(errorMessage(cause, 'Message not sent. Your draft is kept; try again.'));
    } finally {
      if (scopeRef.current === scope) { sendLock.current = false; setSending(false); }
    }
  }

  const report = useCallback(async (messageId: string) => {
    try {
      await apiFetch(`/campfire/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/report`, {
        method: 'POST', body: JSON.stringify({ reason: 'Inappropriate message in session discussion' }),
      });
      if (scopeRef.current === scope) setFeedback('Report sent for review.');
    } catch (cause) {
      if (scopeRef.current === scope) setFeedback(errorMessage(cause, 'Could not send the report. Try again.'));
    }
  }, [roomId, scope]);

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
      <DiscussionHistory messages={messages} userId={userId} guideId={guideId} colors={colors}
        loaded={loaded} failed={!!error} ended={phase === 'ended'} scope={scope} onReport={report} />
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
  card: { flex: 1, minHeight: 0, borderWidth: 1, borderRadius: 22, padding: 16 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  input: { flex: 1, minHeight: 46, maxHeight: 110, borderRadius: 16, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: 'Satoshi-Medium' },
  send: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
