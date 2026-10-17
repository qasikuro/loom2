import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Easing, cancelAnimation, runOnJS, useSharedValue, withDelay,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useLumiActivity } from '../home/useLumiActivity';
import { useLumiRig } from '../home/useLumiRig';
import {
  CHAT_PERFORMANCES, CHAT_WALK_MS, chatPosition, getChatEmote, pendingChatEmote,
  type ChatEmote, type ChatEmoteId,
} from './chatEmotes';

export type ChatLumiPhase = 'idle' | 'walking' | 'reacting' | 'returning';

/** Local visual performances only. Never sends or reads another player's chat. */
export function useChatLumiReaction({ width, size, enabled, side = 'left', onComplete }: {
  width: number; size: number; enabled: boolean; side?: 'left' | 'right'; onComplete?: () => void;
}) {
  const activity = useLumiActivity();
  const active = activity.active && enabled;
  const rig = useLumiRig({ active, reducedMotion: activity.reducedMotion, idleMotion: 'subtle' });
  const { values, stop } = rig;
  const x = useSharedValue(chatPosition(width, size, side));
  const [phase, setPhase] = useState<ChatLumiPhase>('idle');
  const [selected, setSelected] = useState<ChatEmote | null>(null);
  const [queued, setQueued] = useState<ChatEmote | null>(null);
  const current = useRef<ChatEmoteId | null>(null);
  const pending = useRef<ChatEmoteId | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const startRef = useRef<(id: ChatEmoteId) => void>(() => {});
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const walking = useCallback(() => {
    if (activity.reducedMotion) return;
    const gait = withRepeat(withSequence(
      withTiming(14, { duration: 110 }),
      withTiming(-14, { duration: 110 }),
    ), -1, true);
    values.legL.value = gait;
    values.legR.value = withRepeat(withSequence(
      withTiming(-14, { duration: 110 }),
      withTiming(14, { duration: 110 }),
    ), -1, true);
    values.hop.value = withRepeat(withSequence(
      withTiming(-5, { duration: 110 }),
      withTiming(0, { duration: 110 }),
    ), -1, false);
    values.armL.value = withRepeat(withSequence(
      withTiming(14, { duration: 110 }), withTiming(-9, { duration: 110 }),
    ), -1, true);
    values.armR.value = withRepeat(withSequence(
      withTiming(-14, { duration: 110 }), withTiming(9, { duration: 110 }),
    ), -1, true);
  }, [activity.reducedMotion, values]);

  const start = useCallback((id: ChatEmoteId) => {
    const emote = getChatEmote(id);
    if (!emote || !mounted.current || !activeRef.current || width <= 0) return;
    const token = ++epoch.current;
    current.current = id;
    pending.current = null;
    setQueued(null);
    setSelected(emote);
    setPhase('walking');
    stop();
    walking();
    const valid = () => mounted.current && activeRef.current && epoch.current === token;
    const finish = () => {
      if (!valid()) return;
      stop();
      current.current = null;
      setPhase('idle');
      setSelected(null);
      const next = pending.current;
      pending.current = null;
      setQueued(null);
      onCompleteRef.current?.();
      if (next) startRef.current(next);
    };
    const returnToCorner = () => {
      timer.current = null;
      if (!valid()) return;
      stop();
      setPhase('returning');
      walking();
      x.value = withTiming(chatPosition(width, size, side), {
        duration: activity.reducedMotion ? 0 : CHAT_WALK_MS,
        easing: Easing.inOut(Easing.cubic),
      }, finished => {
        if (finished) runOnJS(finish)();
      });
    };
    const perform = () => {
      if (!valid()) return;
      stop();
      setPhase('reacting');
      const plan = CHAT_PERFORMANCES[id];
      for (const pose of plan.poses) {
        // Reduced motion keeps a static expressive face, not walking, shaking
        // or spinning. The small card still identifies every selected emote.
        if (activity.reducedMotion) {
          if (['wide', 'shut', 'lids', 'blush', 'brows', 'mLaugh', 'mOpen', 'mSad', 'cover', 'armsOpen'].includes(pose.key)) {
            values[pose.key].value = pose.steps[0][0];
          }
          continue;
        }
        const steps = pose.steps.map(([target, duration]) =>
          withTiming(target, { duration, easing: Easing.inOut(Easing.cubic) }));
        const sequence = steps.length === 1 ? steps[0] : withSequence(...steps);
        values[pose.key].value = pose.delay ? withDelay(pose.delay, sequence) : sequence;
      }
      timer.current = setTimeout(returnToCorner, activity.reducedMotion ? 1300 : plan.duration);
    };
    x.value = withTiming(chatPosition(width, size, 'center'), {
      duration: activity.reducedMotion ? 0 : CHAT_WALK_MS,
      easing: Easing.inOut(Easing.cubic),
    }, finished => {
      if (finished) runOnJS(perform)();
    });
  }, [activity.reducedMotion, side, size, stop, values, walking, width, x]);
  startRef.current = start;

  const trigger = useCallback((id: ChatEmoteId) => {
    if (!getChatEmote(id) || !activeRef.current) return;
    if (current.current) {
      pending.current = pendingChatEmote(current.current, id);
      setQueued(pending.current ? getChatEmote(pending.current) : null);
    } else {
      startRef.current(id);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    ++epoch.current;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    cancelAnimation(x);
    stop();
    current.current = null;
    pending.current = null;
    x.value = chatPosition(width, size, side);
    setPhase('idle');
    setSelected(null);
    setQueued(null);
    return () => {
      mounted.current = false;
      ++epoch.current;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      cancelAnimation(x);
      stop();
      current.current = null;
      pending.current = null;
    };
  }, [active, activity.reducedMotion, side, size, stop, width, x]);

  return { values, x, phase, selected, queued, active, reducedMotion: activity.reducedMotion, trigger };
}
