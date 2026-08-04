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

// ── Screens (named exports for direct use where needed) ───────────────────────
export { default as ChapterEditorScreen } from './screens/ChapterEditorScreen';
export { default as PanelEditorScreen } from './screens/PanelEditorScreen';
export { default as QuickMomentScreen } from './screens/QuickMomentScreen';
export { default as VibePostScreen } from './screens/VibePostScreen';
export { default as StoryViewerScreen } from './screens/StoryViewerScreen';

// ── Components ────────────────────────────────────────────────────────────────
export {
  FirstPublishOverlay,
  hasCompletedFirstPublish,
  markFirstPublishDone,
} from './components/FirstPublishOverlay';
