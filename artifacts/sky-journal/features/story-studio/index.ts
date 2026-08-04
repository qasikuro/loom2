/**
 * Story Studio — public module entry point
 *
 * Import from here when consuming Story Studio from outside the module.
 * Screens are consumed by Expo Router via the thin re-exports in app/.
 */

// ── Types (re-exported for convenience) ──────────────────────────────────────
export type { Story, StoryPage, StoryPanel, Panel, PanelOverlay, BubbleStyle } from './types';

// ── Service ───────────────────────────────────────────────────────────────────
export { StoryService } from './services/StoryService';
export type { WitnessResult, ResonateResult, SaveResult } from './services/StoryService';

// ── Utils ─────────────────────────────────────────────────────────────────────
export { DraftStore } from './utils/draftStore';

// ── Screens — existing story creation ────────────────────────────────────────
export { default as ChapterEditorScreen } from './screens/ChapterEditorScreen';
export { default as PanelEditorScreen }   from './screens/PanelEditorScreen';
export { default as QuickMomentScreen }   from './screens/QuickMomentScreen';
export { default as VibePostScreen }       from './screens/VibePostScreen';
export { default as StoryViewerScreen }   from './screens/StoryViewerScreen';

// ── Screens — Book & Chapter management ──────────────────────────────────────
export { default as CreateBookScreen }    from './screens/CreateBookScreen';
export { default as BookDetailsScreen }  from './screens/BookDetailsScreen';
export { default as ChaptersListScreen } from './screens/ChaptersListScreen';
export { default as PageManagerScreen }  from './screens/PageManagerScreen';
export { default as PublishChapterScreen } from './screens/PublishChapterScreen';

// ── Screens — Reader experience ───────────────────────────────────────────────
export { default as BookPublicScreen }    from './screens/BookPublicScreen';
export { default as ChapterReaderScreen } from './screens/ChapterReaderScreen';
export { default as EngagementScreen }    from './screens/EngagementScreen';

// ── Components ────────────────────────────────────────────────────────────────
export {
  FirstPublishOverlay,
  hasCompletedFirstPublish,
  markFirstPublishDone,
} from './components/FirstPublishOverlay';
