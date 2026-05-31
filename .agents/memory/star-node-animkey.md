---
name: StarNode animKey replay
description: How constellation star entrance animations replay on profile tab return
---

## Rule
`StarNode` in `ConstellationMap.tsx` accepts `animKey?: number`. Its `useEffect` depends on `[animKey]` — on each change it calls `scaleAnim.setValue(0)` then starts the spring animation with the original `enterDelay`.

`ConstellationMap` receives `animKey` from `profile.tsx` which increments it via `useFocusEffect` every time the profile tab is focused.

**Why:** `useEffect(fn, [])` only fires on mount. Tab navigation doesn't unmount the component (it stays in the tab stack), so the spring animation only played once. Adding `animKey` as a dependency + resetting the value ensures a fresh animation plays every return.

**How to apply:** Any animation in a tab-persistent component that should replay on tab return needs a similar reset-on-prop-change pattern, not just `[]` deps.
