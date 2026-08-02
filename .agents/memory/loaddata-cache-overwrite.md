---
name: loadData cache/state overwrite on API failure
description: loadData() was unconditionally overwriting cache+state with empty defaults on transient API failure — root cause of recurring "data not showing" reports.
---

## The rule
Every `AsyncStorage.setItem` in `loadData`'s `cacheWrites` array must be gated on its raw fetch result being non-null. Every React state setter for user data (`setCharacterState`, `setJournalEntries`, `setStories`, `setOutfits`, `setGallery`, `setGalleryUsage`, `setDiscoverFeedRaw`, `setFollowingIds`, `setFriends`, `setServerNotifications`) must also be conditional on the corresponding raw result.

**Why:** When the API server is briefly down (e.g., post-merge restart, transient 401), all `apiFetch` calls return null. Without the guard, `loadData` overwrites the user's cached data with `DEFAULT_CHARACTER` + empty arrays. The next app open shows `loadFromCache` reading those empty values → blank screen. The staleness timestamp block already had the right pattern (`if (charRaw !== null) tsUpdates.character = now`) — the state and cache blocks just needed to match it.

**How to apply:**
- Any new endpoint added to the parallel fetch batch in `loadData` must follow the same pattern: fetch raw → parse with `parseOrDefault` → conditional state set → conditional cache write → conditional timestamp update.
- `allCoreFailed` (all 5 core endpoints null) now triggers `setTimeout(() => loadData(false), 3000)` when `retry=true` — matching the existing `waitForToken` timeout retry path. Do not remove that retry or it breaks post-merge recovery.
- The fix is in `artifacts/sky-journal/context/AppContext.tsx` around the `cacheWrites` block and the state commit block above it.
