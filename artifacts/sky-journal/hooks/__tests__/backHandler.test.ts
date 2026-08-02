/**
 * Unit tests for makeStepBackHandler (hooks/stepBackHandler.ts).
 *
 * Both quick-moment.tsx and vibe-post.tsx import and use this exact function
 * as their Android BackHandler callback.  Testing it here gives real regression
 * coverage: a change to the production module will break these assertions.
 *
 * Step constants mirror the screen files:
 *   quick-moment  STEP_IMAGE=0  STEP_CAPTION=1  STEP_PREVIEW=2  firstStep=0
 *   vibe-post     STEP_MOOD=0   STEP_TEXT=1                     firstStep=0
 */

import { describe, it, expect, vi } from 'vitest';
import { makeStepBackHandler } from '../stepBackHandler';

// ── quick-moment constants ────────────────────────────────────────────────────
const STEP_IMAGE   = 0;
const STEP_CAPTION = 1;
const STEP_PREVIEW = 2;

// ── vibe-post constants ───────────────────────────────────────────────────────
const STEP_MOOD = 0;
const STEP_TEXT = 1;

// ── quick-moment: three-step flow (firstStep = STEP_IMAGE) ───────────────────

describe('makeStepBackHandler — quick-moment (firstStep = STEP_IMAGE)', () => {
  describe('at STEP_IMAGE (step 0 — first step)', () => {
    it('returns false so navigation / guard can handle the event', () => {
      const setStep = vi.fn();
      expect(makeStepBackHandler(STEP_IMAGE, STEP_IMAGE, setStep)()).toBe(false);
    });

    it('does NOT call setStep', () => {
      const setStep = vi.fn();
      makeStepBackHandler(STEP_IMAGE, STEP_IMAGE, setStep)();
      expect(setStep).not.toHaveBeenCalled();
    });
  });

  describe('at STEP_CAPTION (step 1)', () => {
    it('returns true to consume the back event', () => {
      const setStep = vi.fn();
      expect(makeStepBackHandler(STEP_CAPTION, STEP_IMAGE, setStep)()).toBe(true);
    });

    it('calls setStep with a function', () => {
      const setStep = vi.fn();
      makeStepBackHandler(STEP_CAPTION, STEP_IMAGE, setStep)();
      expect(setStep).toHaveBeenCalledOnce();
      expect(typeof setStep.mock.calls[0][0]).toBe('function');
    });

    it('the updater function decrements step: STEP_CAPTION → STEP_IMAGE', () => {
      let updater!: (s: number) => number;
      const setStep = vi.fn((fn: (s: number) => number) => { updater = fn; });
      makeStepBackHandler(STEP_CAPTION, STEP_IMAGE, setStep)();
      expect(updater(STEP_CAPTION)).toBe(STEP_IMAGE);
    });
  });

  describe('at STEP_PREVIEW (step 2)', () => {
    it('returns true to consume the back event', () => {
      const setStep = vi.fn();
      expect(makeStepBackHandler(STEP_PREVIEW, STEP_IMAGE, setStep)()).toBe(true);
    });

    it('calls setStep with a function', () => {
      const setStep = vi.fn();
      makeStepBackHandler(STEP_PREVIEW, STEP_IMAGE, setStep)();
      expect(setStep).toHaveBeenCalledOnce();
    });

    it('the updater function decrements step: STEP_PREVIEW → STEP_CAPTION', () => {
      let updater!: (s: number) => number;
      const setStep = vi.fn((fn: (s: number) => number) => { updater = fn; });
      makeStepBackHandler(STEP_PREVIEW, STEP_IMAGE, setStep)();
      expect(updater(STEP_PREVIEW)).toBe(STEP_CAPTION);
    });
  });
});

// ── vibe-post: two-step flow (firstStep = STEP_MOOD) ─────────────────────────

describe('makeStepBackHandler — vibe-post (firstStep = STEP_MOOD)', () => {
  describe('at STEP_MOOD (step 0 — first step)', () => {
    it('returns false so navigation / guard can handle the event', () => {
      const setStep = vi.fn();
      expect(makeStepBackHandler(STEP_MOOD, STEP_MOOD, setStep)()).toBe(false);
    });

    it('does NOT call setStep', () => {
      const setStep = vi.fn();
      makeStepBackHandler(STEP_MOOD, STEP_MOOD, setStep)();
      expect(setStep).not.toHaveBeenCalled();
    });
  });

  describe('at STEP_TEXT (step 1)', () => {
    it('returns true to consume the back event', () => {
      const setStep = vi.fn();
      expect(makeStepBackHandler(STEP_TEXT, STEP_MOOD, setStep)()).toBe(true);
    });

    it('calls setStep with a function', () => {
      const setStep = vi.fn();
      makeStepBackHandler(STEP_TEXT, STEP_MOOD, setStep)();
      expect(setStep).toHaveBeenCalledOnce();
    });

    it('the updater function returns STEP_MOOD (0): STEP_TEXT → STEP_MOOD', () => {
      let updater!: (s: number) => number;
      const setStep = vi.fn((fn: (s: number) => number) => { updater = fn; });
      makeStepBackHandler(STEP_TEXT, STEP_MOOD, setStep)();
      expect(updater(STEP_TEXT)).toBe(STEP_MOOD);
    });
  });
});

// ── Back-consumption contract across all steps ────────────────────────────────

describe('makeStepBackHandler — back-consumption contract', () => {
  it('quick-moment: only step 0 falls through; steps 1 and 2 are consumed', () => {
    const consumed = [STEP_IMAGE, STEP_CAPTION, STEP_PREVIEW].map(
      step => makeStepBackHandler(step, STEP_IMAGE, vi.fn())(),
    );
    expect(consumed).toEqual([false, true, true]);
  });

  it('vibe-post: only step 0 falls through; step 1 is consumed', () => {
    const consumed = [STEP_MOOD, STEP_TEXT].map(
      step => makeStepBackHandler(step, STEP_MOOD, vi.fn())(),
    );
    expect(consumed).toEqual([false, true]);
  });

  it('firstStep=0 boundary: step equal to firstStep always falls through', () => {
    expect(makeStepBackHandler(0, 0, vi.fn())()).toBe(false);
  });

  it('step one above firstStep always consumes the event', () => {
    expect(makeStepBackHandler(1, 0, vi.fn())()).toBe(true);
  });
});
