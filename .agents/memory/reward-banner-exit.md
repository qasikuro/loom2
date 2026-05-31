---
name: RewardBanner exit animation
description: How the banner exit animation and anti-stack gate works in index.tsx
---

## Rule
`RewardBanner` accepts `isExiting?: boolean`. When true it slides up to translateY -90 and fades to 0 over 280ms.

The parent (`index.tsx`) owns two pieces of state: `bannerGate` (hides next banner during cooldown) and `bannerExiting` (triggers exit animation on current banner). Both manual X-dismiss and the 4s auto-dismiss follow the same sequence:
1. `setBannerExiting(true)` — banner animates out
2. After 300ms: `dismissReward(id)` + `setBannerExiting(false)` + `setBannerGate(true)`
3. After another 400ms: `setBannerGate(false)` — next banner can enter

**Why:** Without the exit animation the queue looked like a flash-cut between banners. The 300ms exit window must elapse before data is removed so the animating banner stays mounted.

**How to apply:** If adding new banner types, pass `isExiting={bannerExiting}` and never call `dismissReward` before the exit timer fires.
