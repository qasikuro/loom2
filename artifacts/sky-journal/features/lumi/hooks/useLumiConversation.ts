import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  converseWithLumi,
  getLumiState,
  updateLumiState,
  clearLumiState,
  setLumiRequestAccount,
} from '../api';
import {
  LumiMessage,
  LumiPreferences,
  MAX_HISTORY,
  MAX_MESSAGE,
  makeId,
  sanitizeRecommendations,
} from '../types';

const localKey = (uid: string) => `lumi_chat_v1:${uid}`;

type Role = 'user' | 'assistant';

function toHistory(msgs: LumiMessage[]): { role: Role; content: string }[] {
  return msgs
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.status !== 'failed' && m.status !== 'pending')
    .map(m => ({ role: m.role as Role, content: m.content.slice(0, MAX_MESSAGE) }))
    .slice(-MAX_HISTORY);
}

export function useLumiConversation(userId: string | null | undefined, locale: string) {
  // Update before effects so token waits from the previous account are cancelled.
  setLumiRequestAccount(userId);
  const [messages, setMessages] = useState<LumiMessage[]>([]);
  const [remember, setRememberState] = useState(false);
  const [preferences, setPreferences] = useState<LumiPreferences>({});
  const [hydrating, setHydrating] = useState(true);
  const [hydrateError, setHydrateError] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // epoch guards stale completions across account switches / unmount
  const epochRef = useRef(0);
  const busyRef = useRef(false);
  const messagesRef = useRef<LumiMessage[]>([]);
  messagesRef.current = messages;
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  const hydrate = useCallback(async () => {
    const epoch = ++epochRef.current;
    setMessages([]);
    setRememberState(false);
    setPreferences({});
    setSending(false);
    busyRef.current = false;
    setHydrateError(false);
    if (!userId) { setHydrating(false); return; }
    setHydrating(true);
    try {
      // Remove legacy device copies. Opted-in history is kept only by the
      // authenticated server, preventing late cache writes after deletion.
      void AsyncStorage.removeItem(localKey(userId)).catch(() => null);
      const state = await getLumiState();
      if (epoch !== epochRef.current) return;
      setRememberState(!!state.remember);
      setPreferences(state.preferences ?? {});
      if (state.remember) {
        // Server history is authoritative: another device may have cleared it.
        setMessages((state.messages ?? []).map(m => ({
          id: makeId(), role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content), status: 'ok',
        })));
      }
    } catch {
      if (epoch === epochRef.current) setHydrateError(true);
    } finally {
      if (epoch === epochRef.current) setHydrating(false);
    }
  }, [userId]);

  useEffect(() => {
    void hydrate();
    return () => { epochRef.current++; };
  }, [hydrate]);

  const runConverse = useCallback(async (userMsgId: string, text: string, prior: LumiMessage[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const epoch = epochRef.current;
    setSending(true);
    try {
      const res = await converseWithLumi({
        message: text.slice(0, MAX_MESSAGE),
        history: toHistory(prior),
        locale,
        game: prefsRef.current.game || undefined,
      });
      if (epoch !== epochRef.current) return;
      const reply = typeof res?.reply === 'string' ? res.reply.trim() : '';
      setMessages(ms => [
        ...ms.map(m => (m.id === userMsgId ? { ...m, status: 'ok' as const } : m)),
        {
          id: makeId(),
          role: 'assistant',
          content: reply || '…',
          status: 'ok',
          fallback: !!res?.fallback,
          recommendations: sanitizeRecommendations(res?.recommendations),
        },
      ]);
    } catch {
      if (epoch !== epochRef.current) return;
      setMessages(ms => ms.map(m => (m.id === userMsgId ? { ...m, status: 'failed' as const } : m)));
    } finally {
      if (epoch === epochRef.current) {
        busyRef.current = false;
        setSending(false);
      }
    }
  }, [locale]);

  const send = useCallback((raw: string) => {
    const text = raw.trim().slice(0, MAX_MESSAGE);
    if (!text || busyRef.current || sending || hydrating || !userId) return;
    const prior = messagesRef.current;
    const msg: LumiMessage = { id: makeId(), role: 'user', content: text, status: 'pending' };
    setMessages(ms => [...ms, msg]);
    void runConverse(msg.id, text, prior);
  }, [runConverse, sending, hydrating, userId]);

  const retry = useCallback((id: string) => {
    if (busyRef.current || sending || hydrating) return;
    const all = messagesRef.current;
    const idx = all.findIndex(m => m.id === id);
    if (idx < 0) return;
    const target = all[idx];
    setMessages(ms => ms.map(m => (m.id === id ? { ...m, status: 'pending' as const } : m)));
    void runConverse(id, target.content, all.slice(0, idx));
  }, [runConverse, sending, hydrating]);

  const addLocal = useCallback((m: Omit<LumiMessage, 'id'>) => {
    setMessages(ms => [...ms, { ...m, id: makeId() }]);
  }, []);

  const setFeedback = useCallback((id: string, fb: 'up' | 'down') => {
    setMessages(ms => ms.map(m => (m.id === id ? { ...m, feedback: m.feedback === fb ? undefined : fb } : m)));
  }, []);

  const saveSettings = useCallback(async (nextRemember: boolean, prefs: LumiPreferences): Promise<boolean> => {
    const epoch = epochRef.current;
    setSavingSettings(true);
    try {
      const state = await updateLumiState({ remember: nextRemember, preferences: prefs });
      if (epoch !== epochRef.current) return false;
      setRememberState(!!state.remember);
      setPreferences(state.preferences ?? prefs);
      if (!state.remember && userId) AsyncStorage.removeItem(localKey(userId)).catch(() => null);
      return true;
    } catch {
      return false;
    } finally {
      if (epoch === epochRef.current) setSavingSettings(false);
    }
  }, [userId]);

  const clearHistory = useCallback(async (): Promise<boolean> => {
    const epoch = epochRef.current;
    try {
      const res = await clearLumiState();
      if (epoch !== epochRef.current) return false;
      if (!res?.success) return false;
      if (userId) await AsyncStorage.removeItem(localKey(userId)).catch(() => null);
      // Server clears history + preferences and disables remember; mirror it.
      // Bump epoch so any in-flight reply cannot repopulate the cleared chat.
      epochRef.current++;
      busyRef.current = false;
      setSending(false);
      setMessages([]);
      setPreferences({});
      setRememberState(false);
      return true;
    } catch {
      return false;
    }
  }, [userId]);

  return {
    messages, remember, preferences, hydrating, hydrateError, sending, savingSettings,
    send, retry, addLocal, setFeedback, saveSettings, clearHistory, rehydrate: hydrate,
  };
}
