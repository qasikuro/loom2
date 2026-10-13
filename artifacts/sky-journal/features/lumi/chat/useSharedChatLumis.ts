import { useCallback, useEffect, useRef, useState } from 'react';
import { useLumiActivity } from '../home/useLumiActivity';
import { useChatLumiReaction } from './useChatLumiReaction';
import { MAX_SHARED_REACTION_AGE_MS, queueSharedPerformances, type SharedLumiEvent } from './sharedChatReactions';

export function useSharedChatLumis({ width, size, enabled, events }: {
  width: number; size: number; enabled: boolean; events: readonly SharedLumiEvent[];
}) {
  const activity = useLumiActivity();
  const ready = activity.active && enabled && width > 0;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const queue = useRef<SharedLumiEvent[]>([]);
  const seen = useRef(new Set<string>());
  const current = useRef<SharedLumiEvent | null>(null);
  const [playing, setPlaying] = useState<SharedLumiEvent | null>(null);
  const previousReady = useRef(false);
  const drainRef = useRef<() => void>(() => {});

  const completed = useCallback((side: 'own' | 'other') => {
    if (!readyRef.current || current.current?.side !== side) return;
    current.current = null;
    setPlaying(null);
    drainRef.current();
  }, []);
  const finishedOwn = useCallback(() => completed('own'), [completed]);
  const finishedOther = useCallback(() => completed('other'), [completed]);
  const own = useChatLumiReaction({ width, size, enabled: ready, side: 'right', onComplete: finishedOwn });
  const other = useChatLumiReaction({ width, size, enabled: ready, side: 'left', onComplete: finishedOther });

  drainRef.current = () => {
    if (!readyRef.current || !own.active || !other.active || current.current) return;
    let next: SharedLumiEvent | undefined;
    while ((next = queue.current.shift())) {
      if (Date.now() - Date.parse(next.createdAt) <= MAX_SHARED_REACTION_AGE_MS) break;
    }
    if (!next) return;
    current.current = next;
    setPlaying(next);
    (next.side === 'own' ? own : other).trigger(next.emoteId);
  };

  // Layout changes also reset the actor hooks; clear the shared turn together.
  useEffect(() => {
    // Preserve the *current* live turn during keyboard/rotation/motion-setting
    // changes. Leaving the chat or opening a blocking modal drops it instead.
    queue.current = ready && previousReady.current && current.current
      ? queueSharedPerformances([current.current], queue.current)
      : [];
    current.current = null;
    setPlaying(null);
    previousReady.current = ready;
    if (ready) drainRef.current();
  }, [ready, width, size, activity.reducedMotion]);

  useEffect(() => {
    return () => {
      queue.current = [];
      current.current = null;
    };
  }, []);

  useEffect(() => {
    const unseen = events.filter(event => !seen.current.has(event.messageId));
    for (const event of unseen) seen.current.add(event.messageId);
    if (seen.current.size > 512) seen.current = new Set([...seen.current].slice(-256));
    if (!ready) return;
    queue.current = queueSharedPerformances(queue.current, unseen, current.current?.messageId);
    drainRef.current();
  }, [events, ready]);

  useEffect(() => {
    drainRef.current();
  }, [ready, own.active, other.active]);

  return { own, other, playing };
}
