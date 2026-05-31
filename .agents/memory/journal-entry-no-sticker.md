---
name: JournalEntry has no stickerCount
description: Type distinction between JournalEntry and Story/DiscoverPost for stickerCount
---

## Rule
`stickerCount` exists on `Story` and `DiscoverPost` types but NOT on `JournalEntry` (see `context/AppContext.tsx`).

`JournalCard.tsx` accepts `stickerCount?: number` as an optional prop (renders a ✦ badge when > 0) but this is for potential future use or for callers that may wrap story-like data, not for actual `JournalEntry` data.

The profile stories grid (`profile.tsx` line ~2201) shows `story.stickerCount`. Log tab (`log.tsx`) uses `TimelineCard` (private journal entries) — do NOT add stickerCount to `TimelineCard` or `JournalEntry`.

**Why:** Journal entries are always private with no social interaction. Only public stories accumulate stickers.
