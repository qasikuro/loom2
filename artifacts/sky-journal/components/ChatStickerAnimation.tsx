/**
 * Full-screen animated sticker overlay for DM chat.
 * Uses pure React Native Animated (nativeDriver) — no extra deps.
 */
import React, { useEffect } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const CX = W / 2;
const CY = H / 2;

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export type StickerAnimType =
  | 'explode' | 'throw' | 'shatter' | 'hearts' | 'starburst'
  | 'fire' | 'snow' | 'confetti' | 'sparkle' | 'glow' | 'float' | 'fade'
  | 'donkey' | 'wolf';

// ── Particle definition ───────────────────────────────────────────────────────
interface Particle {
  key:     string;
  left:    number;
  top:     number;
  size:    number;
  emoji?:  string;
  bgColor?: string;
  isRect?: boolean;
  x:       Animated.Value;
  y:       Animated.Value;
  opacity: Animated.Value;
  scale:   Animated.Value;
  rot:     Animated.Value;
}

function makeP(
  key: string,
  left: number, top: number,
  opts: { emoji?: string; bgColor?: string; isRect?: boolean; size?: number },
): Particle {
  return {
    key, left, top,
    size:    opts.size ?? 24,
    emoji:   opts.emoji,
    bgColor: opts.bgColor,
    isRect:  opts.isRect,
    x:       new Animated.Value(0),
    y:       new Animated.Value(0),
    opacity: new Animated.Value(1),
    scale:   new Animated.Value(1),
    rot:     new Animated.Value(0),
  };
}

// ── Particle factories per animation type ─────────────────────────────────────
function buildParticles(type: StickerAnimType): Particle[] {
  switch (type) {

    case 'explode': {
      const sparks = ['💥', '✦', '★', '·', '⬥', '◆', '🔥'];
      return Array.from({ length: 22 }, (_, i) =>
        makeP(`p${i}`, CX, CY, { emoji: pick(sparks), size: rnd(14, 28) }),
      );
    }

    case 'throw': {
      const dust = ['·', '·', '·', '·', '○', '◌'];
      const impact = Array.from({ length: 7 }, (_, i) =>
        makeP(`d${i}`, CX + rnd(-30, 30), H * 0.75, { emoji: pick(dust), size: rnd(10, 16) }),
      );
      return [makeP('main', W * 0.85, H * 0.55, { emoji: '🪨', size: 48 }), ...impact];
    }

    case 'shatter': {
      const shards = ['◇', '◈', '◆', '▷', '◁', '△', '▽', '❖', '◇', '◈', '◆', '◇'];
      return shards.map((emoji, i) => makeP(`s${i}`, CX, CY, { emoji, size: rnd(16, 30) }));
    }

    case 'hearts': {
      const hearts = ['💋', '💋', '💋', '❤️', '❤️', '🩷', '💕', '💕', '💞', '💖', '💗', '🤍'];
      return hearts.map((emoji, i) =>
        makeP(`h${i}`, CX + rnd(-W * 0.35, W * 0.35), H * 0.78, { emoji, size: rnd(18, 36) }),
      );
    }

    case 'starburst': {
      return Array.from({ length: 18 }, (_, i) =>
        makeP(`st${i}`, CX, CY, { emoji: pick(['⭐', '✦', '★', '✧', '✦', '⭐']), size: rnd(14, 32) }),
      );
    }

    case 'fire': {
      const flames = ['🔥', '🔥', '🔥', '🔥', '🔥', '🌡️', '✦', '·', '○'];
      return Array.from({ length: 16 }, (_, i) =>
        makeP(`f${i}`, CX + rnd(-W * 0.4, W * 0.4), H * 0.88, { emoji: pick(flames), size: rnd(20, 38) }),
      );
    }

    case 'snow': {
      const flakes = ['❄️', '❄️', '❄️', '❅', '❆', '·', '○', '◌'];
      return Array.from({ length: 20 }, (_, i) =>
        makeP(`sn${i}`, rnd(0, W), rnd(-60, -10), { emoji: pick(flakes), size: rnd(14, 30) }),
      );
    }

    case 'confetti': {
      const colors = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF','#FF9F1C','#FF6BD6','#4CC9F0'];
      return Array.from({ length: 26 }, (_, i) =>
        makeP(`c${i}`, rnd(0, W), rnd(-60, -10), { bgColor: pick(colors), isRect: true, size: rnd(8, 16) }),
      );
    }

    case 'sparkle': {
      return Array.from({ length: 12 }, (_, i) =>
        makeP(`sp${i}`, CX + rnd(-W * 0.25, W * 0.25), CY + rnd(-H * 0.2, H * 0.2), {
          emoji: pick(['✦', '✧', '★', '⭐', '✦']), size: rnd(12, 24),
        }),
      );
    }

    case 'donkey': {
      // Dust clouds + musical notes flying out
      const donkeyParts = ['💨', '💨', '·', '·', '○', '◌', '~', '~', '🌾', '🌾'];
      return [
        // Donkey bouncing center
        makeP('dk0', CX, CY * 0.7, { emoji: '🫏', size: 72 }),
        // Dust and debris
        ...Array.from({ length: 10 }, (_, i) =>
          makeP(`dd${i}`, CX + rnd(-W * 0.4, W * 0.4), H * 0.70 + rnd(-20, 20), {
            emoji: pick(donkeyParts), size: rnd(14, 28),
          })
        ),
      ];
    }

    case 'wolf': {
      // Stars and moons rising + howl waves
      const wolfParts = ['🌕', '⭐', '✦', '★', '✧', '🌙', '◈', '·'];
      return [
        // Wolf center
        makeP('wf0', CX, CY * 0.75, { emoji: '🐺', size: 72 }),
        // Stars rising in arcs
        ...Array.from({ length: 14 }, (_, i) =>
          makeP(`ws${i}`, CX + rnd(-W * 0.45, W * 0.45), H * 0.60 + rnd(-30, 30), {
            emoji: pick(wolfParts), size: rnd(14, 32),
          })
        ),
      ];
    }

    case 'glow':
    case 'float':
    case 'fade':
    default:
      return [];
  }
}

// ── Animation runners per type ────────────────────────────────────────────────
function runAnimation(
  type: StickerAnimType,
  particles: Particle[],
  mainScale:   Animated.Value,
  mainOpacity: Animated.Value,
  flashOpacity: Animated.Value,
  onComplete: () => void,
) {
  const dur = type === 'fire' || type === 'snow' || type === 'confetti' ? 2200
            : type === 'wolf' ? 2400
            : type === 'donkey' ? 2000
            : 1400;

  switch (type) {
    case 'explode':
    case 'shatter':
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.65, duration: 60, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 2.6, tension: 180, friction: 5, useNativeDriver: true }),
        Animated.timing(mainScale, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.delay(450),
        Animated.timing(mainOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
      break;

    case 'hearts':
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 1.8, tension: 200, friction: 6, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(mainScale, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(mainOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      break;

    case 'throw':
      Animated.sequence([
        Animated.timing(mainScale, { toValue: 1.0, duration: 50, useNativeDriver: true }),
        Animated.delay(500),
        Animated.spring(mainScale, { toValue: 0, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(mainOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      break;

    case 'starburst':
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 3, tension: 120, friction: 4, useNativeDriver: true }),
        Animated.timing(mainScale, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(mainOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
      break;

    case 'glow':
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 2.0, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(mainScale, { toValue: 0.8, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(mainOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
      break;

    case 'float':
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 1.5, tension: 60, friction: 6, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(mainScale, { toValue: 0.6, duration: 400, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(mainOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
      break;

    case 'sparkle':
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 2.2, tension: 160, friction: 5, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(mainScale, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(mainOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      break;

    case 'donkey':
      // Three bounces then fade
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 0, tension: 0, friction: 0, useNativeDriver: true }),
      ]).start(); // mainScale handled by particles
      Animated.timing(mainOpacity, { toValue: 0, duration: 1, useNativeDriver: true }).start();
      break;

    case 'wolf':
      // mainScale handled by particles (wolf emoji is a particle)
      Animated.timing(mainScale, { toValue: 0, duration: 1, useNativeDriver: true }).start();
      Animated.timing(mainOpacity, { toValue: 0, duration: 1, useNativeDriver: true }).start();
      break;

    default:
      // fade (hush)
      Animated.sequence([
        Animated.spring(mainScale, { toValue: 1.6, tension: 40, friction: 10, useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(mainScale, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(mainOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(600),
        Animated.timing(mainOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
  }

  // Particle animations
  particles.forEach((p, i) => {
    const delay = i * 30;

    switch (type) {
      case 'explode': {
        const angle = (i / particles.length) * Math.PI * 2 + rnd(-0.4, 0.4);
        const dist  = rnd(90, 220);
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(p.x,       { toValue: Math.cos(angle) * dist, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(p.y,       { toValue: Math.sin(angle) * dist, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(p.scale,   { toValue: 0.2, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0, duration: 700, delay: 200, useNativeDriver: true }),
            Animated.timing(p.rot,     { toValue: rnd(-2, 2), duration: 700, useNativeDriver: true }),
          ]),
        ]).start();
        break;
      }

      case 'throw': {
        if (p.emoji === '🪨') {
          Animated.parallel([
            Animated.timing(p.x, { toValue: -(W * 0.7), duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.y, { toValue: -(H * 0.2), duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(p.y, { toValue: H * 0.08, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.timing(p.rot, { toValue: 1.5, duration: 700, useNativeDriver: true }),
          ]).start();
          Animated.timing(p.opacity, { toValue: 0, duration: 200, delay: 750, useNativeDriver: true }).start();
          Animated.timing(p.scale, { toValue: 1.1, duration: 700, useNativeDriver: true }).start();
        } else {
          Animated.sequence([
            Animated.delay(650 + delay * 0.5),
            Animated.parallel([
              Animated.timing(p.x,       { toValue: rnd(-50, 50), duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(p.y,       { toValue: rnd(-60, -120), duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0, duration: 400, delay: 100, useNativeDriver: true }),
              Animated.timing(p.scale,   { toValue: 0.4, duration: 400, useNativeDriver: true }),
            ]),
          ]).start();
        }
        break;
      }

      case 'shatter': {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist  = rnd(100, 260);
        Animated.sequence([
          Animated.delay(delay * 0.5),
          Animated.parallel([
            Animated.timing(p.x,       { toValue: Math.cos(angle) * dist, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.y,       { toValue: Math.sin(angle) * dist + 80, duration: 800, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.rot,     { toValue: rnd(-2, 2), duration: 800, useNativeDriver: true }),
            Animated.timing(p.scale,   { toValue: 0, duration: 600, delay: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
          ]),
        ]).start();
        break;
      }

      case 'hearts': {
        const sway = rnd(-40, 40);
        const rise = rnd(280, 480);
        Animated.sequence([
          Animated.delay(delay * 60),
          Animated.parallel([
            Animated.timing(p.y, { toValue: -rise, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.x, { toValue: sway, duration: 700, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: -sway, duration: 700, useNativeDriver: true }),
            ]),
            Animated.spring(p.scale, { toValue: rnd(0.8, 1.3), friction: 3, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
              Animated.delay(900),
              Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
          ]),
        ]).start();
        break;
      }

      case 'starburst': {
        const angle = (i / particles.length) * Math.PI * 2 + rnd(-0.2, 0.2);
        const dist  = rnd(80, 200);
        Animated.sequence([
          Animated.delay(delay * 20),
          Animated.parallel([
            Animated.timing(p.x,       { toValue: Math.cos(angle) * dist, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(p.y,       { toValue: Math.sin(angle) * dist, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(p.scale,   { toValue: 0.1, duration: 600, delay: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.opacity, { toValue: 0, duration: 500, delay: 400, useNativeDriver: true }),
            Animated.timing(p.rot,     { toValue: rnd(-1, 1), duration: 900, useNativeDriver: true }),
          ]),
        ]).start();
        break;
      }

      case 'fire': {
        const sway = rnd(-30, 30);
        const rise = rnd(200, 450);
        Animated.sequence([
          Animated.delay(delay * 40),
          Animated.parallel([
            Animated.timing(p.y, { toValue: -rise, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.x, { toValue: sway,        duration: 500, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: -sway,       duration: 550, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: sway * 0.5,  duration: 500, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.delay(1000),
              Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
            ]),
            Animated.timing(p.scale, { toValue: rnd(0.2, 0.5), duration: 1600, useNativeDriver: true }),
          ]),
        ]).start();
        break;
      }

      case 'snow': {
        const drift = rnd(-40, 40);
        const fall  = rnd(H * 0.65, H * 0.9);
        Animated.sequence([
          Animated.delay(delay * 50),
          Animated.parallel([
            Animated.timing(p.y, { toValue: fall, duration: rnd(1400, 2000), easing: Easing.linear, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.x, { toValue: drift,        duration: 600, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: -drift,       duration: 600, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: drift * 0.5,  duration: 600, useNativeDriver: true }),
            ]),
            Animated.timing(p.rot, { toValue: rnd(-1, 1), duration: 1800, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.delay(1200),
              Animated.timing(p.opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
            ]),
          ]),
        ]).start();
        break;
      }

      case 'confetti': {
        const fall  = rnd(H * 0.65, H * 0.95);
        const drift = rnd(-60, 60);
        Animated.sequence([
          Animated.delay(delay * 25),
          Animated.parallel([
            Animated.timing(p.y,   { toValue: fall, duration: rnd(1400, 2000), easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(p.x,   { toValue: drift, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(p.rot, { toValue: rnd(-3, 3), duration: 2000, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
              Animated.delay(1400),
              Animated.timing(p.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]),
          ]),
        ]).start();
        break;
      }

      case 'sparkle': {
        const angle = (i / particles.length) * Math.PI * 2;
        const dist  = rnd(50, 130);
        Animated.sequence([
          Animated.delay(delay * 50),
          Animated.parallel([
            Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(p.y, { toValue: Math.sin(angle) * dist, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.sequence([
              Animated.spring(p.scale, { toValue: 1.3, useNativeDriver: true }),
              Animated.timing(p.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
              Animated.delay(400),
              Animated.timing(p.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]),
          ]),
        ]).start();
        break;
      }

      case 'donkey': {
        if (p.emoji === '🫏') {
          // Three big bounces
          Animated.sequence([
            Animated.spring(p.scale, { toValue: 0, tension: 0, friction: 0, useNativeDriver: true }),
          ]).start(); // reset
          p.scale.setValue(1.0);
          p.opacity.setValue(1);
          Animated.sequence([
            Animated.spring(p.y, { toValue: -80, tension: 220, friction: 4, useNativeDriver: true }),
            Animated.spring(p.y, { toValue: 0,   tension: 180, friction: 6, useNativeDriver: true }),
            Animated.spring(p.y, { toValue: -55, tension: 220, friction: 4, useNativeDriver: true }),
            Animated.spring(p.y, { toValue: 0,   tension: 180, friction: 6, useNativeDriver: true }),
            Animated.spring(p.y, { toValue: -30, tension: 220, friction: 4, useNativeDriver: true }),
            Animated.spring(p.y, { toValue: 0,   tension: 180, friction: 6, useNativeDriver: true }),
            Animated.delay(400),
            Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          ]).start();
          Animated.sequence([
            Animated.timing(p.scale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 0.95, duration: 80,  useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 1.08, duration: 100, useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 0.97, duration: 80,  useNativeDriver: true }),
            Animated.timing(p.scale, { toValue: 1.0,  duration: 100, useNativeDriver: true }),
          ]).start();
        } else {
          // Dust bursting out
          const angle = (i / 10) * Math.PI * 2;
          const dist  = rnd(80, 200);
          Animated.sequence([
            Animated.delay(200 + i * 40),
            Animated.parallel([
              Animated.timing(p.x,       { toValue: Math.cos(angle) * dist, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(p.y,       { toValue: Math.sin(angle) * dist * 0.5 + 40, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.timing(p.scale,   { toValue: 0.2, duration: 700, useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0, duration: 500, delay: 100, useNativeDriver: true }),
              Animated.timing(p.rot,     { toValue: rnd(-1.5, 1.5), duration: 700, useNativeDriver: true }),
            ]),
          ]).start();
        }
        break;
      }

      case 'wolf': {
        if (p.emoji === '🐺') {
          p.scale.setValue(0.3);
          p.opacity.setValue(0);
          // Rise up dramatically
          Animated.sequence([
            Animated.parallel([
              Animated.spring(p.scale, { toValue: 1.1, tension: 60, friction: 5, useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(p.y, { toValue: -40, duration: 800, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
            ]),
            Animated.delay(600),
            // Howl shake
            Animated.sequence([
              Animated.timing(p.x, { toValue: -6, duration: 60, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: 6,  duration: 60, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: -4, duration: 60, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: 4,  duration: 60, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: 0,  duration: 60, useNativeDriver: true }),
            ]),
            Animated.delay(400),
            Animated.parallel([
              Animated.timing(p.scale,   { toValue: 0, duration: 500, useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
          ]).start();
        } else {
          // Stars and moons arc outward from below wolf
          const angle = (i / 14) * Math.PI * 2;
          const dist  = rnd(120, 280);
          p.opacity.setValue(0);
          p.scale.setValue(0.5);
          Animated.sequence([
            Animated.delay(400 + i * 60),
            Animated.parallel([
              Animated.timing(p.opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
              Animated.spring(p.scale, { toValue: rnd(0.8, 1.4), friction: 4, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(p.y, { toValue: Math.sin(angle) * dist - 80, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(p.rot, { toValue: rnd(-1, 1), duration: 1200, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(p.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
              Animated.timing(p.scale,   { toValue: 0.1, duration: 500, useNativeDriver: true }),
            ]),
          ]).start();
        }
        break;
      }

      default: break;
    }
  });

  setTimeout(onComplete, dur);
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  type:        StickerAnimType;
  mainEmoji:   string;
  onComplete:  () => void;
}

export function ChatStickerAnimation({ type, mainEmoji, onComplete }: Props) {
  const particles   = React.useMemo(() => buildParticles(type), [type]);
  const mainScale   = React.useMemo(() => new Animated.Value(0), []);
  const mainOpacity = React.useMemo(() => new Animated.Value(0), []);
  const flashOpacity = React.useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    runAnimation(type, particles, mainScale, mainOpacity, flashOpacity, onComplete);
  }, []);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* White flash for bomb/shatter */}
      <Animated.View style={[styles.flash, { opacity: flashOpacity }]} />

      {/* Central main emoji (hidden for donkey/wolf — they use particles) */}
      {type !== 'donkey' && type !== 'wolf' && (
        <Animated.Text
          style={[styles.mainEmoji, { opacity: mainOpacity, transform: [{ scale: mainScale }] }]}
        >
          {mainEmoji}
        </Animated.Text>
      )}

      {/* Particles */}
      {particles.map(p => {
        const rotStr = p.rot.interpolate({
          inputRange:  [-3, 0, 3],
          outputRange: ['-1080deg', '0deg', '1080deg'],
        });
        const baseStyle = {
          left:    p.left,
          top:     p.top,
          opacity: p.opacity,
          transform: [
            { translateX: p.x },
            { translateY: p.y },
            { scale:      p.scale },
            { rotate:     rotStr },
          ],
        };

        if (p.isRect && p.bgColor) {
          return (
            <Animated.View
              key={p.key}
              style={[
                styles.confettiRect,
                { width: p.size, height: p.size * 0.6, backgroundColor: p.bgColor, marginLeft: -p.size / 2, marginTop: -p.size * 0.3 },
                baseStyle,
              ]}
            />
          );
        }
        return (
          <Animated.Text
            key={p.key}
            style={[
              styles.particle,
              { fontSize: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2 },
              baseStyle,
            ]}
          >
            {p.emoji}
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  mainEmoji: {
    position:   'absolute',
    left:       CX,
    top:        CY,
    fontSize:   64,
    marginLeft: -40,
    marginTop:  -40,
    textAlign:  'center',
    lineHeight: 80,
  },
  particle: {
    position:  'absolute',
    textAlign: 'center',
  },
  confettiRect: {
    position:     'absolute',
    borderRadius: 2,
  },
});
