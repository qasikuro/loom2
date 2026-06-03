# Sky Journal — Product Roadmap & Quality Reference
**Version:** 2.0 — June 3, 2026  
**Perspectives:** CTO · UX · UI · Interaction Experience (IX)  
**Replaces:** `SKY_JOURNAL_AAA_ANALYSIS.md`

---

## The North Star

> Every feature must deepen the emotional loop. If it does not make the user *feel* something, it does not ship.

```
Feel something  →  Express it  →  Be seen  →  Feel something again
       ↑__________________________________________________|
```

Sky Journal's architecture must serve this loop — not decorate it. AAA quality is not feature density. It is the sensation that every tap, every transition, and every word inside the app *mattered*.

---

## Current State Assessment

**Overall Grade: B+** → **Target: AAA**

The gap is not architectural. The data model is clean, the social philosophy is correct (no likes, no follower counts, witnessed/saved), and the Clerk + Drizzle + PostgreSQL stack is production-grade. The gap lives in three layers:

1. **Sensory depth** — The app tells users it is dreamy. It does not yet make them *feel* dreamy.
2. **Continuity** — The emotional loop has dead ends. Completing an action drops the user into a neutral state with no narrative momentum.
3. **Reliability** — Silent error paths, SSE edge cases, and TypeScript gaps erode trust without the user understanding why.

### Feature Grades

| Area | Feature | Grade | Key Gap |
|------|---------|-------|---------|
| Journaling | Entry creation | A− | Works well; prompts are strong |
| Journaling | Daily spark prompt | B+ | No ritual continuity ("Day N of your season") |
| Journaling | Streak / season counter | B | Exists but not emotionally rewarded |
| Journaling | Mood tagging | B+ | Not deeply integrated elsewhere in the app |
| Stories | Multi-panel manga editor | A− | Strong; 12-panel limit is correct |
| Stories | Witnessed / Saved counts | B+ | Good philosophy, weak completion moment |
| Stories | Immersive reader | B | Missing haptics, audio, shared transitions |
| Character | Name / bio / username | A− | Inline edit is smooth |
| Character | Trait chips | B+ | Not yet surfaced socially |
| Character | Outfit log | B | Not connected to Discover or social layer |
| Discover | For You ranked feed | B+ | Algorithm is thoughtful |
| Discover | Vibes tab | B | No visual differentiation per mood |
| Discover | People search / follow | B | Functional; follow UX is good |
| Discover | Guides tab | B | Value proposition unclear |
| Constellation | Progress system | B | Mechanically present; emotionally inert |
| Campfire | Real-time SSE chat | B | SSE reliability now fixed (Tier 1 ✓) |
| Campfire | Soul presence orbs | B+ | Shipped in Tier 1 ✓ |
| Home | Lumi AI greeting | B+ | Poetic but static after first view |
| Home | Who's Around widget | B | Good concept; needs depth |
| Push Notifications | Registration | B | Infrastructure shipped in Tier 1 ✓ |
| Push Notifications | Poetic delivery | F | Not yet implemented |
| Sound Design | — | F | Not implemented |
| Haptics | — | F | Not implemented |
| Onboarding | 7-step overlay | B | Exists and fires; content could be richer |
| Accessibility | — | C | Not audited |

---

## What We Do Not Build

These are common suggestions that would each break the emotional loop. They are documented here so they are never re-evaluated in isolation.

| Feature | Why Not |
|---------|---------|
| Follower / following counts | Turns ambient connection into competition |
| Public like counts | Creates anxiety instead of warmth |
| Direct messaging | Campfire covers this with better emotional boundaries |
| Algorithmic "trending" tab | Introduces popularity pressure into a calm space |
| Ads or sponsored content | One ad destroys dreamlike trust permanently |
| Notification badges with numbers | "3 unread" creates obligation; poetry creates invitation |
| Public leaderboards | The constellation is personal, not comparative |
| Comment sections | Replies create debate; witnessed + stickers create resonance |
| Comment reply threads | Same as above — the absence of replies is a feature |

---

## Tier 1 — Foundation ✅ COMPLETE

**Status:** All 9 items shipped as of June 3, 2026.  
**Purpose:** Pre-conditions. Building Tier 2 on top of these gaps would have produced a beautiful product that quietly corrodes.

| # | Item | Effort | Status |
|---|------|--------|--------|
| 1 | TypeScript notification type union (#72) | 0.5 day | ✅ Done |
| 2 | SSE reconnect on OS-level app wake (#66) | 0.5 day | ✅ Done |
| 3 | Zod validation on guides endpoint (#70) | 0.5 day | ✅ Done |
| 4 | Corrupted story/journal data shows retry banner (#71) | 1 day | ✅ Done |
| 5 | Staleness timestamps reset on save/delete (#73) | 0.5 day | ✅ Done |
| 6 | Typed image upload errors with user-facing messages (#77) | 1 day | ✅ Done |
| 7 | Campfire soul orb presence UI (#65) | 1 day | ✅ Done |
| 8 | Push notification infrastructure (token → DB → deliver) | 1.5 days | ✅ Done |
| 9 | Onboarding flow verified and wired | 0.5 day | ✅ Done |

**Tier 1 total:** ~7 days · **Delivered**

---

## Tier 2 — Emotional Deepening

**Status:** Ready to begin  
**Purpose:** These transform the app from useful to *memorable*. Every item attacks a dead end in the emotional loop.  
**Timeframe:** 2–3 weeks  
**Recommended start:** Immediately (sequentially or in parallel pairs)

---

### T2-01 · Haptics
**Priority:** P0 — highest ROI per hour on the entire roadmap  
**Effort:** 1 day  
**Perspectives:**

- **CTO:** `expo-haptics` is already available in Expo SDK 54. No new dependency. Zero risk.
- **IX:** Haptics are the difference between "I tapped a button" and "the app responded to me." Every emotional beat needs a tactile echo.
- **UX:** Users in research describe haptic apps as "more alive" even when they can not name why. This is the fastest way to raise the perceived quality of the entire product.
- **UI:** No visual changes required. Purely additive.

**Implementation:**
- `Haptics.impactAsync(Light)` on mood chip selection
- `Haptics.impactAsync(Medium)` on Witness tap, outfit save, story publish
- `Haptics.notificationAsync(Success)` when a constellation star unlocks
- `Haptics.impactAsync(Soft)` on sticker receive, campfire join, journal save
- Single global toggle in Profile → Settings (respect system "Reduce Motion" preference)

---

### T2-02 · Post-Action Completion Moments
**Priority:** P0  
**Effort:** 2–3 days  
**Perspectives:**

- **UX:** Currently every creative act ends in a dismissal. The user saved their most private thoughts and was returned to a list. This is a missed emotional beat of enormous magnitude.
- **IX:** The moment after completion is the highest-attention moment in any user flow. Every AAA product uses it. Sky Journal must too.
- **UI:** Subtle full-screen overlays (not modals) with soft gradients, one Lumi line, and a micro-animation. 2 seconds. Auto-dismiss.
- **CTO:** Stateless overlay components. No new API calls required.

**Three moments to implement:**

**A. Post-journal-save**
Soft cream overlay, a constellation shimmer at the top, Lumi line: *"Another thread woven. The sky remembers."* — 2 seconds, tap to dismiss early.

**B. Post-story-publish ("Chapter Released" screen)**
Cover panel displayed full-bleed, witnessed count at zero with a pulse animation, Lumi line: *"Your chapter is in the sky now."* — stays until user taps away. Optional share card.

**C. Post-witness feedback (for the witness-er, not the author)**
A 1.5s translucent overlay at the bottom: *"Your light reached them."* — reinforces that witnessing is an act, not a counter increment.

---

### T2-03 · Constellation Micro-Progress Flashes
**Priority:** P1  
**Effort:** 1 day  
**Perspectives:**

- **UX:** The constellation exists as a separate section users visit occasionally. It is not connected to the daily emotional experience. This severs the feedback loop.
- **IX:** Every action that earns XP should produce an immediate in-context signal — not a notification, not a full-screen overlay, but a 1.5-second shimmer at the bottom edge: a small star icon + "+1" that fades out.
- **UI:** Translucent bottom-of-screen bar, lavender/gold gradient, animated entrance and exit. Appears over any screen. Does not block interaction.
- **CTO:** Driven by a lightweight event emitter already available in `AppContext`. No new data fetching. Listen for XP grant events from mutations.

**When a star fully unlocks:** 2-second full-screen constellation moment — the star ignites with a glow burst, Lumi speaks one line, and the user is prompted: *"Name this memory."* The named memory is stored as a journal-style artefact.

---

### T2-04 · Daily Ritual Narrative
**Priority:** P0  
**Effort:** 2 days  
**Perspectives:**

- **UX:** The single most powerful retention mechanic. A *season* counter ("Day 12 of your Summer") is poetry, not pressure. It invites return without demanding it.
- **IX:** Miss a day? The home sky darkens slightly — not punishing, just honest. Return after a gap? Lumi: *"The light returns when you do."* The ritual absorbs absence without breaking.
- **UI:** Home screen top section: `Day [N] of your [Season]` in Satoshi-Regular italic, faded gold. Below: `[X] days until Autumn begins`. Seasonal theme shifts the home gradient subtly.
- **CTO:** Season is calculated client-side from signup date. No new API needed. Push notification scheduled for local dawn time via `expo-notifications` scheduled notifications.

**Daily dawn notification (poetic, never transactional):**  
*"A new day in your sky. [Today's spark prompt]"*  
Tapping opens directly to the journal entry composer.

---

### T2-05 · Titles System
**Priority:** P1  
**Effort:** 2–3 days  
**Perspectives:**

- **UX:** Titles are the single most powerful social currency that does not compromise the no-follower-count philosophy. They signal *what kind of person you are* in the sky, not *how popular you are*.
- **IX:** Earned titles must feel discovered, not purchased. Display them on discover cards, campfire presence, and profile header — always subordinate to the name, never the lead identity.
- **UI:** Small italic text beneath the username on cards: *"Keeper of Quiet"*, *"Wanderer"*, *"Lighthouse"*. Tapping a title shows a preview modal explaining how it was earned (not the count).
- **CTO:** Titles table in DB (or computed from existing counters). Server computes active title on character fetch. No client-side computation needed.

**Suggested earned titles:**

| Title | Trigger |
|-------|---------|
| First Light | First journal entry ever |
| Keeper of Quiet | 100 journal entries |
| Lighthouse | 50 witness actions given |
| Wanderer | All 6 mood vibes used in stories |
| Story Keeper | 10 published chapters |
| Ancient Sky | 6-month account anniversary |
| Ember | Host a campfire room |
| Witness Circle | 10 witnessed actions received |

---

### T2-06 · Campfire Ambience
**Priority:** P2  
**Effort:** 1 day  
**Perspectives:**

- **UX:** The campfire is the app's highest-intimacy space. Right now every room looks identical — a dark screen with messages. The room *theme* exists in the data but is not expressed visually or audibly.
- **IX:** Ambient audio (when sound is enabled) + a subtle colour tint shift transforms "chat room" into "place." Users remember places, not interfaces.
- **UI:** Mood-based background tint on the campfire screen: Lonely = deep blue haze, Hopeful = warm gold glow, Peaceful = soft mint, Chaotic = deep red embers. Tint is subtle (8–12% opacity overlay), not overwhelming.
- **CTO:** CSS/RN background colour interpolated from room `mood` field already stored on campfire rooms. Audio is the ambient sound system from Tier 4 applied early to just campfire — a single looping track per mood.

**Tier 2 total estimated effort:** ~9–11 days  
**Recommended timeframe:** Weeks 1–3 after Tier 1 completion

---

## Tier 3 — Social Warmth

**Status:** Planned  
**Purpose:** These grow the community into the kind of place users *protect*.  
**Timeframe:** Weeks 4–6  
**Effort total:** ~8–10 days

---

### T3-01 · Anonymous Witness Circles on Stories
**Priority:** P1 · **Effort:** 1 day

- **UX:** "10 souls stood beside your story" is more powerful than "10 witnesses." Showing small anonymous avatar orbs (silhouettes, not profile pictures) below a story card creates a sense of collective presence without revealing who was there.
- **UI:** Row of up to 8 faint circular orbs below the witness count. If the author is followed by any of the witnesses, a soft glow differentiates those orbs (no names).
- **CTO:** No new data required — `witnessed_count` already exists. Anonymous orb count is purely a display mechanic.

---

### T3-02 · Sky Circle Home Widget ("Who Wrote Today")
**Priority:** P1 · **Effort:** 2 days

- **UX:** The Home tab is currently a personal dashboard. Adding soft ambient awareness of followed users' activity — shown as glowing orbs, not a list — adds warmth without social pressure.
- **IX:** Tap an orb → jump to that user's latest public story. No "X just posted" text. Just presence.
- **UI:** A horizontal row of 4–6 softly glowing orbs beneath the Lumi greeting. Orb colour = user's profile mood. No names visible until tap. Empty state: *"Your circle is quiet today."*
- **CTO:** New API endpoint: `GET /social/circle-activity` — returns array of users you follow who created content today (story or public outfit). Cached aggressively, 15-minute TTL.

---

### T3-03 · Sticker Post-Witness Prompt
**Priority:** P1 · **Effort:** 1.5 days

- **UX:** Stickers exist but their discoverability is unclear. Surfacing them as an optional, post-witness prompt (never forced) turns a hidden feature into a natural behaviour.
- **IX:** After tapping Witness: the witness animation plays, then 0.7s later a soft row slides up from the bottom — 4 animated sticker options + a "Maybe later" link. This disappears after 4 seconds if untouched.
- **UI:** The sticker row uses the existing sticker assets. Slide-up animation with spring physics. No modal, no blocking overlay.
- **CTO:** Sticker system already exists. This is a UI trigger change only — stickers are already POST-able via the existing route.

---

### T3-04 · Guides Tab — Keepers Programme
**Priority:** P2 · **Effort:** 2 days

- **UX:** The Guides tab currently displays guide profiles but the curation logic and value proposition are unclear. A "Keepers" editorial model — nominated by high empathy signals, rotated weekly, admin-featured — gives the tab a clear purpose.
- **IX:** Guides should feel like *introductions*, not search results. Each keeper card should have a short personal statement ("My sky on quiet days...") not just stats.
- **UI:** Editorial card format — large background image (from their best story), name, title, short quote, "Visit their sky" CTA. Horizontal scroll of 5–8 keepers. Admin-managed.
- **CTO:** Nomination score: `(witnessed_count_given × 2) + (sticker_diversity) + (days_active / 30)`. Admin panel gets "Feature as Keeper" toggle. Rotates every Monday 00:00 UTC via a cron or manual admin action.

---

### T3-05 · Follow Notification Poetry
**Priority:** P0 · **Effort:** 0.5 day

- **UX:** Currently follows are transactional — a button state change. The author receives nothing.
- **IX:** Push notification on follow: *"A new light joined your sky."* — no username, no count. Just the warmth of being seen. The identity is revealed if the user visits their Sky Circle.
- **CTO:** Push already wired from Tier 1. This is a one-line addition to the follow API route.

---

## Tier 4 — Sensory Layer

**Status:** Planned  
**Purpose:** These are the polish that make users describe the app to friends. The "I can't explain it, it just feels right" quality.  
**Timeframe:** Weeks 7–10  
**Effort total:** ~10–13 days

---

### T4-01 · Ambient Sound System
**Priority:** P1 · **Effort:** 2–3 days

- **UX:** Sky: Children of the Light is famous for its soundscape. Sky Journal is visually themed but audibly silent. A time-aware ambient layer is the single biggest jump in perceived quality after haptics.
- **IX:** All audio is opt-in, default ON, with a single global toggle in Settings. Volume does not override system volume. Audio fades when a system interruption occurs (call, other app). Respects iOS silent switch.
- **UI:** No visual UI required beyond the existing sound toggle.
- **CTO:** `expo-av` for audio playback. 4 ambient tracks (dawn, day, dusk, night) cross-faded by local time of day, matching the existing `GradientSky` time logic. Tracks are short loops (30–60s) bundled in the app binary.

**Sound map:**
| Event | Sound |
|-------|-------|
| Journal save | Soft chime (0.8s) |
| Witness tap | Wind-chime (0.6s) |
| Story panel swipe | Page-turn breath (0.3s) |
| Constellation star unlock | Rising tone (2s) |
| Campfire entry | Crackle fade-in loop |
| Sticker received | Soft bell (0.5s) |
| Ambient background | Time-aware loop (dawn / day / dusk / night) |

---

### T4-02 · Shared Element Transitions
**Priority:** P2 · **Effort:** 2–3 days

- **IX:** Currently navigating from a story card in Discover to the full reader is an abrupt slide. The story image should expand *in place* — the same image, growing to fill the screen. This is the transition that makes an app feel premium.
- **CTO:** React Native Reanimated 3 `useSharedTransition` or the Expo Router shared element API (available in SDK 54). Requires wrapping story card images and the reader's header image with matching `sharedTransitionTag`.

---

### T4-03 · Continuous Sky Gradient Animation
**Priority:** P2 · **Effort:** 1 day

- **UX:** The home screen sky gradient currently renders once and is static. A slow, continuous animation (1° colour shift per minute, matching real solar time) makes the home screen feel like a *living* sky, not a wallpaper.
- **CTO:** Reanimated `withTiming` loop driven by a `useEffect` that fires every 60 seconds. The existing `GradientSky` component is already time-aware — it just needs the interpolation loop added.

---

### T4-04 · Campfire Log as Memory Entry
**Priority:** P1 · **Effort:** 1.5 days

- **UX:** Campfire conversations disappear. Users have expressed wanting to keep them. The campfire log should be optionally saveable as a private memory entry — ephemeral by default, preserved by choice.
- **IX:** On campfire exit: a 3-second "embers fading" transition, then a Lumi prompt: *"Keep this fire as a memory?"* Yes → creates a read-only journal entry with the campfire title, date, and message log. No → exits normally.
- **CTO:** New journal entry `type: 'campfire'` (extend existing enum). No schema change needed if `text` stores the log as formatted text.

---

### T4-05 · Seasonal Memory Auto-Generated Visual
**Priority:** P1 · **Effort:** 2–3 days

- **UX:** At the end of each 3-month season, Sky Journal generates a personal "Season in Review" — your mood map, most-witnessed story, days written, dominant trait. This is the reason users stay for a full season.
- **IX:** The visual appears as a special notification + home screen overlay on the season's final day. It is shareable (as an image) but private by default.
- **CTO:** Server-side generation using `@resvg/resvg-js` or a Canvas-based approach for the visual. Triggered by a cron at season end. Stored in object storage. Delivered via push notification.

---

## Tier 5 — Admin & Operations

**Status:** Planned  
**Purpose:** These protect the live service at scale. Without them, production incidents are discovered by users, not operators.  
**Timeframe:** Weeks 8–12 (can run in parallel with Tier 4)  
**Effort total:** ~8–10 days

---

### T5-01 · Server Health Dashboard in Admin
**Priority:** P0 · **Effort:** 1.5 days

- **CTO:** Task #79 was cancelled prematurely. This is essential for a live service. Operators need: active SSE connections, active campfire rooms, upload storage used, memory/CPU snapshot, DB pool health, and error rate from the last 24h.
- **UI:** New "Health" tab in the admin panel. Auto-refreshing every 30 seconds. Simple stat cards, no charts required at this stage.

---

### T5-02 · Push Notification Composer in Admin
**Priority:** P1 · **Effort:** 1.5 days

- **CTO:** The push infrastructure is now live (Tier 1 ✓). Admin needs a UI to compose and send targeted or global notifications without a code deploy.
- **UX:** Two modes: Global (all users) and Targeted (users with a specific title, mood, or who have been inactive for N days). Preview shows exactly what the user will receive on their lock screen.
- **Guardrail:** All push copy must be reviewed before sending. Admin panel requires a second-tap confirmation with the exact notification preview shown.

---

### T5-03 · Campfire Room Monitor in Admin
**Priority:** P1 · **Effort:** 1 day

- **CTO:** Operators currently cannot see active campfire rooms or participant counts without a DB query. This creates a blind spot for content moderation.
- **UI:** Live list of active rooms — name, mood, soul count, created at, flag count. "Close room" and "Mute user from room" actions. Auto-refreshing every 15 seconds.

---

### T5-04 · Seasonal Content Editor (No Redeploy)
**Priority:** P1 · **Effort:** 3–4 days

- **CTO:** Tasks #21, #22, #23 are all linked. Seasonal content (countdown, themes, daily sparks, memory prompts) should be editable from the admin panel without a code deploy. The current setup requires a developer to update static config.
- **Implementation:** New `seasonal_config` table in DB. Admin panel editor for: current season name, end date, theme colour, daily spark pool, season-end memory prompt text. Mobile app reads from `GET /api/config/season` on launch.

---

## Roadmap Summary

| Tier | Name | Status | Effort | Timeframe |
|------|------|--------|--------|-----------|
| 1 | Foundation | ✅ Complete | ~7 days | Done |
| 2 | Emotional Deepening | 🔵 Ready | ~9–11 days | Weeks 1–3 |
| 3 | Social Warmth | ⬜ Planned | ~8–10 days | Weeks 4–6 |
| 4 | Sensory Layer | ⬜ Planned | ~10–13 days | Weeks 7–10 |
| 5 | Admin & Operations | ⬜ Planned | ~8–10 days | Weeks 8–12 |

**Total remaining work:** ~35–44 days across one developer  
**Full AAA target:** ~10–12 weeks from today

---

## Priority Matrix

Items sorted by **emotional impact ÷ implementation effort**:

| Priority | Item | Tier | Effort | Impact |
|----------|------|------|--------|--------|
| P0 | Haptics | T2 | 1 day | Transformative — raises perceived quality of everything |
| P0 | Post-action completion moments | T2 | 2–3 days | Closes the biggest dead end in the emotional loop |
| P0 | Daily ritual narrative | T2 | 2 days | Highest retention mechanic on the roadmap |
| P0 | Follow notification poetry | T3 | 0.5 day | Free warmth — push is already wired |
| P0 | Server health dashboard | T5 | 1.5 days | Prevents user-discovered production incidents |
| P1 | Constellation micro-progress | T2 | 1 day | Makes every action feel counted |
| P1 | Titles system | T2 | 2–3 days | Social identity without follower counts |
| P1 | Anonymous witness circles | T3 | 1 day | Adds collective warmth to stories |
| P1 | Sky Circle home widget | T3 | 2 days | Ambient social awareness on home screen |
| P1 | Sticker post-witness prompt | T3 | 1.5 days | Makes a hidden feature discoverable |
| P1 | Ambient sound system | T4 | 2–3 days | Biggest perceptual quality jump after haptics |
| P1 | Campfire log as memory entry | T4 | 1.5 days | Turns ephemeral into precious |
| P1 | Seasonal Memory visual | T4 | 2–3 days | The reason to stay for a full season |
| P1 | Push notification composer | T5 | 1.5 days | Operators need to reach users without a deploy |
| P1 | Campfire room monitor | T5 | 1 day | Content moderation blind spot |
| P1 | Seasonal content editor | T5 | 3–4 days | Seasonal live ops without redeploys |
| P2 | Campfire ambience | T2 | 1 day | Deepens intimacy of the highest-intimacy space |
| P2 | Guides tab / Keepers programme | T3 | 2 days | Gives Discover's weakest tab a clear purpose |
| P2 | Shared element transitions | T4 | 2–3 days | Premium feel; high effort, high reward |
| P2 | Continuous sky gradient | T4 | 1 day | Living home screen; low effort, good return |

---

## The Emotional Loop Scorecard

How each tier closes the loop:

```
Feel something       → T2: Haptics + completion moments make expression tactile and celebrated
        ↓
Express it           → T4: Sound + motion give expression a sensory signature
        ↓
Be seen              → T3: Witness circles, stickers, Sky Circle create soft ambient presence
        ↓
Feel something again → T2: Daily ritual + titles + constellation progress invite return
        ↑_______________|
```

A user who completes this loop **twice** becomes a daily active user.  
A user who completes it **ten times** becomes an advocate.  
A user who completes it through a **full season** becomes a keeper of the community.

---

## One-Sentence Summary

> Sky Journal has the bones of something lasting — the work now is to make every moment inside it feel like it *mattered*, so users return not out of habit but out of genuine desire to be in their sky again.

---

*Last updated: June 3, 2026. Update this document when tiers are completed or priorities shift.*
