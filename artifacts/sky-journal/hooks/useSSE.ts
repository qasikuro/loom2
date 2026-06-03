/**
 * useSSE — subscribe to one or more SSE channels from /api/stream.
 *
 * Works on React Native (fetch streaming via Hermes ReadableStream) and Expo Web
 * (native EventSource with auth header injected via fetch).
 *
 * On focus:  opens the connection.
 * On blur:   closes the connection.
 * On error:  reconnects after an exponential backoff (max 30 s).
 *
 * Usage:
 *   useSSE(
 *     ['messages:myUserId', 'campfire:roomId'],
 *     (channel, data) => { ... }
 *   );
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getAuthToken } from '@/context/AppContext';
import Constants from 'expo-constants';

function resolveApiBase(): string {
  const extra  = (Constants.expoConfig as any)?.extra;
  const envUrl = extra?.apiUrl;
  if (envUrl) return envUrl as string;
  return '/api';
}

const API_BASE = resolveApiBase();

type SSEPayload = { channel: string; data: unknown };
type OnEventFn = (channel: string, data: unknown) => void;

const MAX_BACKOFF_MS  = 30_000;
const BASE_BACKOFF_MS = 1_500;

/**
 * Parse a chunk of SSE text into complete events.
 * Returns [events, leftover] where leftover is any incomplete line fragment.
 */
function parseSSEChunk(buffer: string): [SSEPayload[], string] {
  const events: SSEPayload[] = [];
  const blocks = buffer.split('\n\n');
  const leftover = blocks.pop() ?? '';

  for (const block of blocks) {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      try {
        const parsed = JSON.parse(raw) as SSEPayload;
        if (parsed && typeof parsed.channel === 'string') {
          events.push(parsed);
        }
      } catch { /* malformed — skip */ }
    }
  }

  return [events, leftover];
}

export function useSSE(
  channels: string[],
  onEvent: OnEventFn,
  enabled = true,
): void {
  const abortRef    = useRef<AbortController | null>(null);
  const backoffRef  = useRef(BASE_BACKOFF_MS);
  const retryRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEventRef  = useRef(onEvent);
  const channelsRef = useRef(channels);

  // Keep refs in sync so the reconnect loop always uses fresh values
  onEventRef.current  = onEvent;
  channelsRef.current = channels;

  const disconnect = useCallback(() => {
    if (retryRef.current)  { clearTimeout(retryRef.current); retryRef.current = null; }
    if (abortRef.current)  { abortRef.current.abort(); abortRef.current = null; }
  }, []);

  const connect = useCallback(async () => {
    disconnect();

    const token = await getAuthToken();
    if (!token) return;

    const chans = channelsRef.current.filter(Boolean);
    if (chans.length === 0) return;

    const url = `${API_BASE}/stream?channels=${chans.map(encodeURIComponent).join(',')}`;
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${token}` },
        // React Native needs these hints to avoid buffering
        ...(Platform.OS !== 'web' && { reactNative: { textStreaming: true } } as any),
      });

      if (!res.ok || !res.body) {
        throw new Error(`SSE ${res.status}`);
      }

      backoffRef.current = BASE_BACKOFF_MS;

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const [events, leftover] = parseSSEChunk(buf);
        buf = leftover;
        for (const ev of events) {
          onEventRef.current(ev.channel, ev.data);
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }

    // Connection closed or errored — schedule reconnect
    const delay = backoffRef.current;
    backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    retryRef.current = setTimeout(() => { connect(); }, delay);
  }, [disconnect]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      connect();
      return disconnect;
    }, [enabled, connect, disconnect]),
  );

  // Reconnect when the app returns from background (OS-level, not just tab focus)
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        connect();
      } else if (nextState === 'background' || nextState === 'inactive') {
        disconnect();
      }
    });
    return () => sub.remove();
  }, [enabled, connect, disconnect]);

  // Also disconnect when the component unmounts entirely
  useEffect(() => () => disconnect(), [disconnect]);
}
