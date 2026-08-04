/**
 * Story Studio — shared types
 *
 * Re-exports story-related types from the app's shared AppContext so that
 * all Story Studio screens and services import from one place within the
 * module, rather than reaching into the root context directly.
 *
 * Do NOT add story-studio-specific types here that don't belong in the
 * shared app layer; put those in the file that defines them.
 */
export type {
  Story,
  StoryPage,
  StoryPanel,
  StoryPanel as Panel,
  PanelOverlay,
  BubbleStyle,
} from '@/context/AppContext';
