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

export const STORY_EDITOR_DRAFT_KEY = 'story_draft_v2';
export const TEXT_STORY_DRAFT_KEY = 'draft:text-story';

export type ResumableStoryDraft = {
  kind: 'manga' | 'chapter' | 'text-story';
  title: string;
  imageUri?: string;
  savedAt: number;
};

export type CreateDestination = {
  pathname: string;
  params?: Record<string, string>;
};

export function getCreateDestination(
  pathname: string,
  eventPrompt?: string,
  eventMood?: string,
  extraParams: Record<string, string> = {},
): CreateDestination {
  const params = {
    ...(eventPrompt ? { eventPrompt } : {}),
    ...(eventPrompt && eventMood ? { eventMood } : {}),
    ...extraParams,
  };

  return Object.keys(params).length > 0 ? { pathname, params } : { pathname };
}

export function getDraftResumeDestination(
  draft: ResumableStoryDraft,
  eventPrompt?: string,
  eventMood?: string,
): CreateDestination {
  const pathname = draft.kind === 'manga'
    ? '/quick-moment'
    : draft.kind === 'text-story'
      ? '/text-story'
      : '/chapter-editor';
  return getCreateDestination(pathname, eventPrompt, eventMood, { resumeDraft: '1' });
}

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

export async function getResumableStoryDraft(): Promise<ResumableStoryDraft | null> {
  const [mangaDraft, chapterRaw, textStoryRaw] = await Promise.all([
    quickMomentDraft.load(),
    AsyncStorage.getItem(STORY_EDITOR_DRAFT_KEY).catch(() => null),
    AsyncStorage.getItem(TEXT_STORY_DRAFT_KEY).catch(() => null),
  ]);
  const drafts: ResumableStoryDraft[] = [];

  if (mangaDraft && (mangaDraft.caption.trim() || mangaDraft.imageUri)) {
    drafts.push({
      kind: 'manga',
      title: mangaDraft.caption.trim() || 'Manga story draft',
      imageUri: mangaDraft.imageUri,
      savedAt: mangaDraft.savedAt,
    });
  }

  if (chapterRaw) {
    try {
      const value: unknown = JSON.parse(chapterRaw);
      if (value && typeof value === 'object') {
        const chapter = value as {
          title?: unknown;
          pages?: unknown;
          savedAt?: unknown;
        };
        const title = typeof chapter.title === 'string' ? chapter.title.trim() : '';
        const pages = Array.isArray(chapter.pages) ? chapter.pages : [];
        const hasPanelText = pages.some(page => {
          if (!page || typeof page !== 'object') return false;
          const panels = (page as { panels?: unknown }).panels;
          if (!Array.isArray(panels)) return false;
          return panels.some(panel => {
            if (!panel || typeof panel !== 'object') return false;
            const item = panel as { text?: unknown; bubbleText?: unknown };
            return [item.text, item.bubbleText].some(
              text => typeof text === 'string' && text.trim().length > 0,
            );
          });
        });

        if (title || hasPanelText) {
          drafts.push({
            kind: 'chapter',
            title: title || 'Untitled story',
            savedAt: typeof chapter.savedAt === 'number' ? chapter.savedAt : 0,
          });
        }
      }
    } catch {
      // Ignore malformed local drafts; the editors validate them when opened.
    }
  }

  if (textStoryRaw) {
    try {
      const value: unknown = JSON.parse(textStoryRaw);
      if (value && typeof value === 'object') {
        const draft = value as {
          title?: unknown;
          blocks?: unknown;
          savedAt?: unknown;
        };
        const title = typeof draft.title === 'string' ? draft.title.trim() : '';
        const blocks = Array.isArray(draft.blocks) ? draft.blocks : [];
        const hasContent = blocks.some(block => {
          if (!block || typeof block !== 'object') return false;
          const item = block as { text?: unknown; imageUri?: unknown };
          return (typeof item.text === 'string' && item.text.trim().length > 0)
            || (typeof item.imageUri === 'string' && item.imageUri.length > 0);
        });
        if (title || hasContent) {
          drafts.push({
            kind: 'text-story',
            title: title || 'Text story draft',
            savedAt: typeof draft.savedAt === 'number' ? draft.savedAt : 0,
          });
        }
      }
    } catch {
      // Ignore malformed drafts; the editor validates them before use.
    }
  }

  return drafts.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null;
}
