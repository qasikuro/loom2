---
name: Story Studio module architecture
description: How the story-creation feature is organized as a self-contained module without duplicating shared app infrastructure
---

# Story Studio Module Architecture

## Rule
Story Studio lives at `features/story-studio/` and owns all story-creation screens, components, utils, and services. The Expo Router route files in `app/` are thin one-line re-exports pointing into the module.

**Why:** User explicitly rejected a full DI-provider pattern (AuthProvider, StorageProvider, etc.). The module reuses existing shared infrastructure directly — `useApp()`, `apiFetch()`, `useColors()` — rather than wrapping it behind injected interfaces.

## How to apply
- New story-creation screens go in `features/story-studio/screens/`
- Story-specific components go in `features/story-studio/components/`
- Story-specific utils go in `features/story-studio/utils/`
- API calls from the module go through `StoryService` in `features/story-studio/services/StoryService.ts`, which wraps `apiFetch`
- Shared components used outside story-creation (CompletionMoment, CropImageModal, ImageSourceSheet) stay in `components/` — do NOT move them into the module
- Backward-compat re-exports: `utils/draftStore.ts` and `components/FirstPublishOverlay.tsx` re-export from the module so existing imports outside the module don't break
- Public barrel: `features/story-studio/index.ts`

## Files that stayed in shared components (used outside story creation)
- `components/CompletionMoment.tsx` — also used in `create-journal-entry.tsx`
- `components/CropImageModal.tsx` — also used in `create-outfit.tsx` and `MangaPanelEditor.tsx`
- `components/ImageSourceSheet.tsx` — also used in `create-outfit.tsx`
- `utils/entryDraftStore.ts` — contains `journalDraft` used by journal screens; only `quickMomentDraft` and `vibePostDraft` are story-studio-specific but splitting the file would be overkill
