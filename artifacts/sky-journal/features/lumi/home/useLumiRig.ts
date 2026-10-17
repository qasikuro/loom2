/**
 * Layer C — animation controller. Owns every Reanimated shared value.
 * Idle values (float/breathe/sway/blink/glance/tilt) are disjoint from reaction
 * values, so a one-shot can never fight the idle loop over the same body part.
 * A one-shot first cancels + zeroes all reaction values, then plays.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Easing, cancelAnimation, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { LumiReaction } from './reactionManager';

type SV = SharedValue<number>;
export type LumiExpression = 'neutral' | 'happy' | 'focused' | 'proud' | 'sleepy' | 'excited';

const REACT_KEYS = [
  'hop', 'lean', 'reach', 'bodyRot', 'squash',
  'faceX', 'faceY', 'faceRot', 'lookX', 'lookY',
  'armL', 'armR', 'legL', 'legR', 'sprout',
  'shut', 'lids', 'wide', 'blush', 'brows',
  'mLaugh', 'mOpen', 'mSad',
  'armsOpen', 'cover', 'heart', 'hearts', 'sparkle', 'zzz', 'sweat',
] as const;
const IDLE_KEYS = ['float', 'breathe', 'sway', 'blink', 'glance', 'tilt'] as const;
type ReactKey = typeof REACT_KEYS[number];
type IdleKey = typeof IDLE_KEYS[number];
export type RigValues = Record<ReactKey | IdleKey, SV>;

const ease = Easing.inOut(Easing.cubic);
const out = Easing.out(Easing.back(1.6));

/** steps: [target, durationMs]; starts after `delay`. */
function seq(delay: number, ...steps: [number, number][]) {
  const timed = steps.map(([to, d]) => withTiming(to, { duration: d, easing: ease }));
  const body = timed.length === 1 ? timed[0] : withSequence(...timed);
  return delay > 0 ? withDelay(delay, body) : body;
}
const pop = (delay: number, to: number, d = 260) => withDelay(delay, withTiming(to, { duration: d, easing: out }));

type Plan = { ms: number; run: (v: RigValues, reduced: boolean) => void };

/** Choreography per reaction. Units: degrees, or px in the 512 art space. */
const PLANS: Record<LumiReaction, Plan> = {
  welcomeNew: {
    ms: 3000,
    run: (v, r) => {
      v.wide.value = seq(150, [1, 260], [1, 1800], [0, 300]);
      v.brows.value = seq(150, [1, 220], [1, 1300], [0, 300]);
      v.mOpen.value = seq(150, [1, 200], [0, 300]);
      v.mLaugh.value = seq(700, [1, 250], [1, 1600], [0, 300]);
      v.sparkle.value = seq(1500, [1, 300], [1, 700], [0, 400]);
      if (r) return;
      v.faceY.value = seq(0, [-12, 380], [-12, 1700], [0, 450]);
      v.reach.value = seq(300, [1, 420], [1, 1500], [0, 420]);
      v.armR.value = seq(600, [-115, 300], [-85, 200], [-125, 200], [-85, 200], [-120, 200], [0, 380]);
      v.hop.value = seq(1650, [-26, 180], [0, 200], [-12, 150], [0, 170]);
      v.sprout.value = seq(1650, [-8, 180], [8, 200], [0, 260]);
    },
  },
  returnSameDay: {
    ms: 2200,
    run: (v, r) => {
      v.shut.value = seq(350, [1, 90], [0, 120]);
      v.mLaugh.value = seq(700, [1, 220], [1, 900], [0, 300]);
      if (r) return;
      v.faceY.value = seq(0, [-8, 300], [0, 400]);
      v.faceRot.value = seq(550, [8, 320], [8, 500], [0, 380]);
      v.armR.value = seq(800, [-80, 260], [-60, 180], [-85, 180], [0, 360]);
    },
  },
  returnSleepy: {
    ms: 4600,
    run: (v, r) => {
      v.shut.value = 1; v.zzz.value = 1; v.lids.value = 0;
      v.shut.value = seq(700, [0, 200]);
      v.lids.value = seq(700, [1, 1], [1, 800], [0, 700]);
      v.zzz.value = seq(500, [0, 600]);
      v.mLaugh.value = seq(2800, [1, 260], [1, 1100], [0, 300]);
      if (r) return;
      v.faceY.value = 14; v.squash.value = 1;
      v.faceY.value = seq(2300, [14, 1], [-6, 500], [0, 400]);
      v.squash.value = seq(1500, [0, 600]);
      v.armL.value = seq(1600, [125, 500], [135, 450], [0, 450]);
      v.armR.value = seq(1600, [-125, 500], [-135, 450], [-70, 400], [-50, 180], [-75, 180], [0, 350]);
      v.sprout.value = seq(1600, [-10, 500], [6, 500], [0, 400]);
    },
  },
  tapShy: {
    ms: 2400,
    run: (v, r) => {
      v.blush.value = seq(0, [1, 260], [1, 1700], [0, 400]);
      v.cover.value = seq(250, [1, 200], [1, 1000], [0, 220]);
      v.lookX.value = seq(1500, [9, 200], [9, 400], [0, 260]);
      if (r) return;
      v.faceY.value = seq(0, [10, 300], [10, 1200], [0, 400]);
      v.faceRot.value = seq(0, [-5, 300], [-5, 1200], [0, 400]);
      v.squash.value = seq(0, [0.6, 300], [0.6, 1200], [0, 400]);
    },
  },
  tapDramatic: {
    ms: 2600,
    run: (v, r) => {
      v.mSad.value = seq(100, [1, 200], [1, 1300], [0, 250]);
      v.sweat.value = seq(400, [1, 220], [1, 900], [0, 300]);
      v.lookX.value = seq(100, [-12, 260], [-12, 1200], [9, 260], [9, 300], [0, 300]);
      v.mLaugh.value = seq(1700, [1, 220], [1, 400], [0, 250]);
      if (r) return;
      v.faceRot.value = seq(100, [-14, 320], [-14, 1150], [-5, 260], [0, 400]);
      v.faceX.value = seq(100, [-12, 320], [-12, 1150], [0, 560]);
      v.bodyRot.value = seq(500, [-9, 380], [-9, 700], [0, 500]);
      v.armL.value = seq(200, [35, 260], [35, 1200], [0, 360]);
      v.armR.value = seq(200, [-35, 260], [-35, 1200], [0, 360]);
    },
  },
  tapExcited: {
    ms: 2000,
    run: (v, r) => {
      v.wide.value = seq(0, [1, 200], [1, 1300], [0, 300]);
      v.brows.value = seq(0, [1, 200], [1, 1300], [0, 300]);
      v.mLaugh.value = seq(0, [1, 200], [1, 1300], [0, 300]);
      v.sparkle.value = seq(300, [1, 260], [1, 600], [0, 400]);
      if (r) return;
      v.hop.value = seq(0, [-30, 200], [0, 220], [-22, 180], [0, 200]);
      v.squash.value = seq(0, [-0.6, 200], [0.5, 220], [-0.4, 180], [0, 200]);
      v.armL.value = seq(0, [135, 240], [120, 300], [135, 300], [0, 400]);
      v.armR.value = seq(0, [-135, 240], [-120, 300], [-135, 300], [0, 400]);
      v.sprout.value = seq(0, [10, 200], [-10, 220], [0, 300]);
    },
  },
  tapAffectionate: {
    ms: 2600,
    run: (v, r) => {
      v.armsOpen.value = seq(100, [1, 240], [1, 1400], [0, 300]);
      v.blush.value = seq(200, [1, 300], [1, 1500], [0, 400]);
      v.mLaugh.value = seq(200, [1, 260], [1, 1500], [0, 300]);
      v.heart.value = seq(500, [1, 1500]);
      v.hearts.value = seq(700, [1, 300], [1, 900], [0, 400]);
      if (r) return;
      v.reach.value = seq(150, [1, 400], [1, 1300], [0, 450]);
    },
  },
  celebrate: {
    ms: 3400,
    run: (v, r) => {
      v.mOpen.value = seq(0, [1, 160], [1, 420], [0, 160]);
      v.wide.value = seq(0, [1, 200], [1, 2400], [0, 300]);
      v.brows.value = seq(0, [1, 200], [1, 700], [0, 300]);
      v.mLaugh.value = seq(700, [1, 200], [1, 2000], [0, 300]);
      v.sparkle.value = seq(900, [1, 300], [1, 1500], [0, 450]);
      if (r) return;
      v.armL.value = seq(500, [140, 260], [100, 140], [140, 140], [100, 140], [140, 140], [0, 420]);
      v.armR.value = seq(500, [-140, 260], [-100, 140], [-140, 140], [-100, 140], [-140, 140], [0, 420]);
      v.hop.value = seq(700, [-32, 200], [0, 220], [-20, 180], [0, 200]);
      v.squash.value = seq(700, [-0.6, 200], [0.5, 220], [0, 200]);
      v.sprout.value = seq(700, [12, 200], [-10, 220], [0, 300]);
    },
  },
  suggestCreate: {
    ms: 2800,
    run: (v, r) => {
      v.lookX.value = seq(100, [12, 300], [12, 1400], [0, 300]);
      v.lookY.value = seq(100, [8, 300], [8, 1400], [0, 300]);
      if (r) return;
      v.faceRot.value = seq(400, [10, 350], [10, 1100], [0, 400]);
      v.armR.value = seq(700, [-60, 320], [-50, 300], [-62, 300], [0, 380]);
      v.lean.value = seq(700, [6, 320], [6, 900], [0, 400]);
    },
  },
};

export const REACTION_MS: Record<LumiReaction, number> = Object.fromEntries(
  Object.entries(PLANS).map(([k, p]) => [k, p.ms]),
) as Record<LumiReaction, number>;

export function useLumiRig({ active, reducedMotion, idleMotion = 'full' }: {
  active: boolean; reducedMotion: boolean; idleMotion?: 'full' | 'subtle';
}) {
  // Fixed hook count: one shared value per key, created once.
  const sv = {} as RigValues;
  for (const k of [...REACT_KEYS, ...IDLE_KEYS]) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    sv[k] = useSharedValue(0);
  }
  const values = useRef(sv).current;
  const token = useRef(0);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playing = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const resetReaction = useCallback((animated: boolean) => {
    for (const k of REACT_KEYS) {
      cancelAnimation(values[k]);
      values[k].value = animated ? withTiming(0, { duration: 180 }) : 0;
    }
  }, [values]);

  const stop = useCallback(() => {
    token.current++;
    if (doneTimer.current) clearTimeout(doneTimer.current);
    if (startTimer.current) clearTimeout(startTimer.current);
    doneTimer.current = null;
    startTimer.current = null;
    playing.current = false;
    resetReaction(true);
  }, [resetReaction]);

  const play = useCallback((reaction: LumiReaction, onDone: () => void) => {
    const my = ++token.current;
    if (doneTimer.current) clearTimeout(doneTimer.current);
    if (startTimer.current) clearTimeout(startTimer.current);
    const transition = playing.current ? 180 : 0;
    resetReaction(transition > 0);
    playing.current = true;
    const plan = PLANS[reaction];
    if (transition) {
      startTimer.current = setTimeout(() => {
        startTimer.current = null;
        if (token.current === my && activeRef.current) plan.run(values, reducedMotion);
      }, transition);
    } else plan.run(values, reducedMotion);
    doneTimer.current = setTimeout(() => {
      if (token.current !== my) return;
      playing.current = false;
      resetReaction(true);
      onDone();
    }, transition + plan.ms + 120);
  }, [reducedMotion, resetReaction, values]);

  // Idle loops: only while active; fully cancelled on pause/unmount. Depend
  // only on booleans so ordinary renders never restart them.
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };
    if (!active) {
      for (const k of IDLE_KEYS) { cancelAnimation(values[k]); values[k].value = withTiming(0, { duration: 250 }); }
      return;
    }
    if (!reducedMotion) {
      const subtle = idleMotion === 'subtle';
      values.float.value = withRepeat(withSequence(
        withTiming(subtle ? -3 : -7, { duration: subtle ? 2400 : 1700, easing: ease }),
        withTiming(0, { duration: subtle ? 2400 : 1700, easing: ease }),
      ), -1, false);
      if (!subtle) {
        values.breathe.value = withRepeat(withSequence(
          withTiming(1, { duration: 1500, easing: ease }), withTiming(0, { duration: 1900, easing: ease }),
        ), -1, false);
        values.sway.value = withRepeat(withSequence(
          withTiming(1, { duration: 2100, easing: ease }), withTiming(-1, { duration: 2100, easing: ease }),
        ), -1, true);
      }
    }
    let n = 0;
    const blink = () => {
      if (!playing.current) values.blink.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 120 }));
      later(blink, 2600 + ((n++ * 1373) % 2900));
    };
    later(blink, 1400);
    if (!reducedMotion && idleMotion === 'full') {
      let g = 0;
      const glance = () => {
        if (!playing.current) {
          const dir = g++ % 3 === 1 ? -1 : 1;
          values.glance.value = withSequence(withTiming(dir, { duration: 260, easing: ease }), withDelay(900, withTiming(0, { duration: 320, easing: ease })));
          if (g % 2 === 0) values.tilt.value = withSequence(withTiming(dir, { duration: 600, easing: ease }), withDelay(700, withTiming(0, { duration: 700, easing: ease })));
        }
        later(glance, 5200 + ((g * 977) % 3400));
      };
      later(glance, 3800);
    }
    return () => {
      timers.forEach(clearTimeout);
      for (const k of IDLE_KEYS) { cancelAnimation(values[k]); values[k].value = withTiming(0, { duration: 250 }); }
    };
  }, [active, reducedMotion, idleMotion, values]);

  // Unmount: nothing survives.
  useEffect(() => () => {
    token.current++;
    if (doneTimer.current) clearTimeout(doneTimer.current);
    if (startTimer.current) clearTimeout(startTimer.current);
    for (const k of [...REACT_KEYS, ...IDLE_KEYS]) cancelAnimation(values[k]);
  }, [values]);

  return useMemo(() => ({ values, play, stop }), [values, play, stop]);
}
