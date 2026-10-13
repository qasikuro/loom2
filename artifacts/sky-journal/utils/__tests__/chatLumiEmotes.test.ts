import { describe, expect, it } from 'vitest';
import {
  CHAT_EMOTES, CHAT_PERFORMANCES, chatPosition, getChatEmote, pendingChatEmote,
} from '../../features/lumi/chat/chatEmotes';

describe('Lumi chat emotes', () => {
  it('covers every requested emote exactly once', () => {
    expect(CHAT_EMOTES.map(e => e.emoji)).toEqual([
      '❤️', '🤦', '🫢', '🤗', '🤣', '🙄', '🥲', '🤫', '🫣', '🫡', '😤', '😳', '😵‍💫',
    ]);
    expect(new Set(CHAT_EMOTES.map(e => e.id)).size).toBe(13);
    expect(getChatEmote('unknown')).toBeNull();
  });

  it('gives each emote a distinct finite pose plan without modifying idle values', () => {
    const idleKeys = ['float', 'breathe', 'sway', 'blink', 'glance', 'tilt'];
    const plans = new Set<string>();
    for (const emote of CHAT_EMOTES) {
      const plan = CHAT_PERFORMANCES[emote.id];
      expect(plan.duration).toBeGreaterThanOrEqual(1500);
      expect(plan.duration).toBeLessThanOrEqual(3000);
      expect(plan.poses.length).toBeGreaterThanOrEqual(4);
      plans.add(JSON.stringify(plan.poses));
      for (const pose of plan.poses) {
        expect(idleKeys).not.toContain(pose.key);
        expect(pose.steps.length).toBeGreaterThan(0);
        const duration = pose.steps.reduce((sum, [target, ms]) => {
          expect(Number.isFinite(target)).toBe(true);
          expect(ms).toBeGreaterThan(0);
          return sum + ms;
        }, pose.delay ?? 0);
        expect(duration).toBeLessThanOrEqual(plan.duration);
      }
    }
    expect(plans.size).toBe(13);
  });

  it('keeps the mascot within compact, phone, tablet and landscape stages', () => {
    for (const width of [0, 32, 240, 320, 390, 760, 1100]) {
      for (const size of [44, 68, 84, 100]) {
        const max = Math.max(0, width - size);
        const left = chatPosition(width, size, 'left');
        const center = chatPosition(width, size, 'center');
        const right = chatPosition(width, size, 'right');
        expect(left).toBeGreaterThanOrEqual(0);
        expect(left).toBeLessThanOrEqual(center);
        expect(center).toBeLessThanOrEqual(right);
        expect(right).toBeLessThanOrEqual(max);
        expect(center).toBe(max / 2);
      }
    }
    expect(chatPosition(Number.NaN, 100, 'center')).toBe(0);
    expect(Number.isFinite(chatPosition(300, Number.NaN, 'center'))).toBe(true);
  });

  it('bounds rapid taps to one replaceable pending emote', () => {
    expect(pendingChatEmote('hug', 'hug')).toBeNull();
    let pending = pendingChatEmote('hug', 'heart');
    expect(pending).toBe('heart');
    pending = pendingChatEmote('hug', 'angry');
    expect(pending).toBe('angry');
    pending = pendingChatEmote('hug', 'dizzy');
    expect(pending).toBe('dizzy');
  });
});
