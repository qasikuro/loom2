import React, { useEffect } from 'react';
import { withTiming } from 'react-native-reanimated';
import { LumiRigView } from '../home/LumiCharacter';
import { useLumiRig } from '../home/useLumiRig';
import { useLumiActivity } from '../home/useLumiActivity';
import type { ChatCue } from '../logic';

/**
 * The single animated Lumi of the chat. Thinking holds a focused face; each new
 * reply/error/celebration plays one supported reaction. Idle and reactions
 * pause when the screen is unfocused or the app is in the background, and
 * reduced motion keeps only face changes.
 */
export function LumiChatCharacter({ size, thinking, cue }: {
  size: number;
  thinking: boolean;
  cue: { n: number; reaction: ChatCue } | null;
}) {
  const activity = useLumiActivity();
  const rig = useLumiRig({ active: activity.active, reducedMotion: activity.reducedMotion });
  const v = rig.values;

  useEffect(() => {
    const to = (n: number) => withTiming(n, { duration: 260 });
    v.brows.value = to(thinking ? 1 : 0);
    v.lookY.value = to(thinking ? 5 : 0);
    v.lookX.value = to(thinking ? 6 : 0);
  }, [thinking, v]);

  const n = cue?.n ?? 0;
  const reaction = cue?.reaction ?? null;
  const { play, stop } = rig;
  useEffect(() => {
    if (!n || !reaction || !activity.active) return;
    play(reaction, () => {});
    return () => stop();
  }, [n, reaction, activity.active, play, stop]);

  return <LumiRigView v={v} size={size} />;
}
