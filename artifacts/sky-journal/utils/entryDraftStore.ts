/**
 * entryDraftStore — lightweight AsyncStorage helpers for auto-saving
 * in-progress entries on the create-journal-entry, quick-moment, and
 * vibe-post screens.
 *
 * Each screen uses its own key so drafts don't collide.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type JournalDraft = {
  text:       string;
  friendName: string;
  mood:       string;
  /** ISO date string */
  entryDate:  string;
  imageUri?:  string;
  fontSize?:  number;
  savedAt:    number;
};

export type QuickMomentDraft = {
  caption:   string;
  mood:      string;
  isPublic:  boolean;
  imageUri?: string;
  imageFit?: 'cover' | 'contain';
  imageRatio?: number;
  step:      number;
  savedAt:   number;
};

export type VibePostDraft = {
  text:     string;
  mood:     string | null;
  isPublic: boolean;
  step:     number;
  savedAt:  number;
};

const KEYS = {
  journal: (type: string) => `draft:journal:${type}`,
  quickMoment:              'draft:quick-moment',
  vibePost:                 'draft:vibe-post',
};

async function save<T extends object>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    // best-effort; never crash the app over a draft
  }
}

async function load<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function clear(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch { /* ignore */ }
}

// ── Journal entry ─────────────────────────────────────────────────────────────

export const journalDraft = {
  save:  (type: string, d: Omit<JournalDraft, 'savedAt'>) =>
    save<JournalDraft>(KEYS.journal(type), { ...d, savedAt: Date.now() }),
  load:  (type: string) => load<JournalDraft>(KEYS.journal(type)),
  clear: (type: string) => clear(KEYS.journal(type)),
  /** Returns true only when a draft with meaningful content exists for the given type. */
  exists: async (type: string): Promise<boolean> => {
    const d = await load<JournalDraft>(KEYS.journal(type));
    return !!d && !!(d.text?.trim() || d.friendName?.trim());
  },
};

// ── Quick moment ──────────────────────────────────────────────────────────────

export const quickMomentDraft = {
  save:  (d: Omit<QuickMomentDraft, 'savedAt'>) =>
    save<QuickMomentDraft>(KEYS.quickMoment, { ...d, savedAt: Date.now() }),
  load:  () => load<QuickMomentDraft>(KEYS.quickMoment),
  clear: () => clear(KEYS.quickMoment),
};

// ── Vibe post ─────────────────────────────────────────────────────────────────

export const vibePostDraft = {
  save:  (d: Omit<VibePostDraft, 'savedAt'>) =>
    save<VibePostDraft>(KEYS.vibePost, { ...d, savedAt: Date.now() }),
  load:  () => load<VibePostDraft>(KEYS.vibePost),
  clear: () => clear(KEYS.vibePost),
};
