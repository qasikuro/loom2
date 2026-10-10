const HIDDEN_ROOTS = new Set([
  '(auth)', 'onboarding', 'create-journal-entry', 'create-friend-log', 'create-moment-log',
  'create-outfit', 'chapter-editor', 'panel-editor', 'quick-moment', 'vibe-post', 'post-video',
  'publish-chapter', 'page-manager', 'create-book', 'create-guide-session', 'purchase-history',
  'shop', 'friends',
]);
/** Keep the floating entry visible on Home while its header scrolls; avoid covering full-bleed action surfaces. */
const HIDDEN_TABS = new Set(['discover', 'reels', 'create']);

export function shouldShowGlobalChat(segments: readonly string[], signedIn: boolean): boolean {
  if (!signedIn) return false;
  const root = segments[0];
  if (!root) return false;
  if (HIDDEN_ROOTS.has(root)) return false;
  if (root === 'messages' && segments.length > 1) return false;
  if (root === '(tabs)' && HIDDEN_TABS.has(segments[1] ?? 'index')) return false;
  return true;
}
