/**
 * Unit tests for useJournalDraftLoader.
 *
 * The two scenarios that matter:
 *
 * 1. Screen opened WITH initialPrompt → draft load is skipped entirely so
 *    the banner never fires and the prompt text stays in the field.
 * 2. Screen opened WITHOUT initialPrompt, draft exists → banner is offered
 *    (pendingDraft is set to the loaded draft).
 *
 * Strategy: mock React's useState/useEffect and journalDraft.load so the hook
 * runs in pure Node.js without a renderer.  useEffect is driven synchronously;
 * promise resolution is awaited in async tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JournalDraft } from '@/utils/entryDraftStore';

// ── Hoisted shared state ───────────────────────────────────────────────────────

const { mockSetPendingDraft, mockLoad, capturedEffect } = vi.hoisted(() => ({
  mockSetPendingDraft: vi.fn(),
  mockLoad:            vi.fn<() => Promise<JournalDraft | null>>(),
  capturedEffect:      { fn: null as (() => void) | null },
}));

// ── Module mocks ───────────────────────────────────────────────────────────────

// Minimal React stubs — only the hooks this module uses.
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, mockSetPendingDraft],
  useEffect: (fn: () => void) => {
    capturedEffect.fn = fn;
    fn(); // drive synchronously so tests can await the inner promise
  },
}));

// Mock the draft store; tests control what load() resolves to.
vi.mock('@/utils/entryDraftStore', () => ({
  journalDraft: { load: mockLoad },
}));

// AppContext is only imported for the JournalEntryType type; the value never
// reaches runtime code, so an empty stub is enough.
vi.mock('@/context/AppContext', () => ({}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { useJournalDraftLoader } from '../useJournalDraftLoader';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetAll() {
  mockSetPendingDraft.mockReset();
  mockLoad.mockReset();
  capturedEffect.fn = null;
}

// A realistic saved draft with meaningful text content.
const SAVED_DRAFT = {
  text:       'Hello world draft',
  friendName: '',
  mood:       'Peaceful',
  entryDate:  new Date().toISOString(),
  savedAt:    Date.now(),
};

// ── Tests: prompt suppresses draft banner ─────────────────────────────────────

describe('useJournalDraftLoader — initialPrompt set (hasPrefilledContent = true)', () => {
  beforeEach(resetAll);

  it('does NOT call journalDraft.load when the screen has pre-filled content', () => {
    useJournalDraftLoader('diary', /* hasPrefilledContent */ true);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('never calls setPendingDraft so the banner remains hidden', () => {
    useJournalDraftLoader('diary', true);
    // No async work happens, but settle any microtasks to be certain.
    expect(mockSetPendingDraft).not.toHaveBeenCalled();
  });

  it('returns null as the initial pendingDraft value', () => {
    const [pendingDraft] = useJournalDraftLoader('diary', true);
    expect(pendingDraft).toBeNull();
  });
});

// ── Tests: no prompt → draft banner offered ───────────────────────────────────

describe('useJournalDraftLoader — no initialPrompt (hasPrefilledContent = false)', () => {
  beforeEach(resetAll);

  it('calls journalDraft.load with the correct entry type', async () => {
    mockLoad.mockResolvedValue(SAVED_DRAFT);
    useJournalDraftLoader('diary', false);
    await Promise.resolve(); // flush the .then() microtask
    expect(mockLoad).toHaveBeenCalledOnce();
    expect(mockLoad).toHaveBeenCalledWith('diary');
  });

  it('calls setPendingDraft with the loaded draft when text is non-empty', async () => {
    mockLoad.mockResolvedValue(SAVED_DRAFT);
    useJournalDraftLoader('diary', false);
    await Promise.resolve();
    expect(mockSetPendingDraft).toHaveBeenCalledOnce();
    expect(mockSetPendingDraft).toHaveBeenCalledWith(SAVED_DRAFT);
  });

  it('calls setPendingDraft when only friendName is non-empty (friend entry)', async () => {
    const friendDraft = { ...SAVED_DRAFT, text: '', friendName: 'Alice' };
    mockLoad.mockResolvedValue(friendDraft);
    useJournalDraftLoader('friend', false);
    await Promise.resolve();
    expect(mockSetPendingDraft).toHaveBeenCalledOnce();
    expect(mockSetPendingDraft).toHaveBeenCalledWith(friendDraft);
  });

  it('does NOT call setPendingDraft when the stored draft has no meaningful content', async () => {
    const emptyDraft = { ...SAVED_DRAFT, text: '   ', friendName: '  ' };
    mockLoad.mockResolvedValue(emptyDraft);
    useJournalDraftLoader('diary', false);
    await Promise.resolve();
    expect(mockSetPendingDraft).not.toHaveBeenCalled();
  });

  it('does NOT call setPendingDraft when no draft is stored at all (load returns null)', async () => {
    mockLoad.mockResolvedValue(null);
    useJournalDraftLoader('diary', false);
    await Promise.resolve();
    expect(mockSetPendingDraft).not.toHaveBeenCalled();
  });

  it('passes the entry type correctly for moment entries', async () => {
    mockLoad.mockResolvedValue(SAVED_DRAFT);
    useJournalDraftLoader('moment', false);
    await Promise.resolve();
    expect(mockLoad).toHaveBeenCalledWith('moment');
  });
});

// ── Tests: guard is stateless across entry types ───────────────────────────────

describe('useJournalDraftLoader — guard does not bleed across entry types', () => {
  beforeEach(resetAll);

  it('skips load for diary when prompt present, but would load for moment', async () => {
    // Simulates two separate screen instances with different params.
    // First call: diary with prompt → no load.
    useJournalDraftLoader('diary', true);
    expect(mockLoad).not.toHaveBeenCalled();

    resetAll();

    // Second call: moment without prompt → load is triggered.
    mockLoad.mockResolvedValue(SAVED_DRAFT);
    useJournalDraftLoader('moment', false);
    await Promise.resolve();
    expect(mockLoad).toHaveBeenCalledWith('moment');
  });
});
