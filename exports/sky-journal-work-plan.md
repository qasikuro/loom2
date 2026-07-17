# Sky Journal — Remaining Work Plan
  **Generated:** 17 July 2026
  **App:** Expo React Native mobile app (iOS + Android + Web preview)
  **Stack:** Expo SDK 54 · Express API · PostgreSQL/Drizzle · Clerk Auth · pnpm monorepo

  ---

  ## 1. STATUS SNAPSHOT

  | Status     | Count | Task refs |
  |------------|-------|-----------|
  | ✅ Merged / Done | built across ~88 tasks | continuous delivery |
  | 🔵 In Progress | 1 | #85 |
  | 🟡 Pending (committed) | 6 | #86, #89, #91, #92, #93, #94 |
  | 🟠 Proposed (suggested) | 8 | #96–#100, #106–#108 |
  | ❌ Cancelled | 8 | #87, #90, #95, #101, #102, #103, #104, #105 |

  ---

  ## 2. IN PROGRESS

  ### #85 — Daily Invitation Card + Mood Door Entry
  **Priority:** High · **Effort:** Medium (2–3 days)
  The home tab currently shows a generic layout that does not adapt to the
  user's state or time of day. The Discover feed opens cold with no emotional
  entry point.

  **Deliverables:**
  - Rotating daily invitation card on the home tab (one writing prompt per day,
    weighted by the user's current mood)
  - "Mood door" overlay on Discover tab — user picks how they feel before the
    feed loads; the choice filters and re-ranks the feed for the session
  - Persistence of the mood door choice in AsyncStorage across app restarts
  - Animated entrance for the card (fade + rise) when it first appears each day

  **Why it matters:** Turns the home tab from a static launcher into a gentle
  ritual. Mood door gives users agency over their feed and reduces the cold-
  start problem.

  ---

  ## 3. PENDING (COMMITTED WORK)

  ### #86 — Story Card Visual Redesign + Sequential Reading Flow
  **Priority:** High · **Effort:** Medium (2–3 days)

  Discover feed cards currently show only a title, author, and witness count —
  not enough to pull a reader in. Redesigning each card to use the first panel
  as a full-width visual cover with a pull quote makes every story feel like a
  cinematic preview.

  **Deliverables:**
  - Full-bleed first-panel cover image on each DiscoverCard
  - Pull quote overlay (first panel's narration text, truncated elegantly)
  - Author avatar + handle in a bottom-left overlay pill
  - Mood/vibe tag badge in a top-right corner pill
  - Smooth sequential "next story" swipe at the end of a story reader
  - Swipe gesture: reach end of panels → swipe right to load next story in feed

  **Why it matters:** The feed is the primary retention loop. Every improvement
  here directly impacts daily active usage.

  ---

  ### #89 — Seasonal Event Banner + Event-Linked Story Prompts
  **Priority:** Medium · **Effort:** Medium (2–3 days)

  The admin events system (database, API, admin UI) is fully built but
  completely invisible to app users. Surfacing active events on the home tab
  and injecting event-specific prompts into the creation flow closes the loop
  between admin-managed events and the user experience.

  **Deliverables:**
  - Home tab banner showing active event: name, theme illustration, countdown timer
  - "Write for this event" CTA that opens the chapter editor pre-filled with
    the event's AI-generated prompt
  - Event badge shown on stories submitted during an active event
  - Graceful no-event state (banner simply hidden when no active event)

  **Why it matters:** Events are the primary content-cadence mechanism. Without
  surfacing them in-app, the entire admin events system has no user-facing value.

  ---

  ### #91 — Resonate Reaction (Replaces Feed Stickers)
  **Priority:** Medium · **Effort:** Small (1–2 days)

  The current sticker system creates social performance anxiety — visible
  counts, choosing between sticker types, and public totals. Replacing it with
  a single "Resonate" action (soft radial ripple, no public count) aligns with
  the app's philosophy of calm, ambient social feedback.

  **Deliverables:**
  - New "Resonate" button on DiscoverCard (replaces sticker picker)
  - Soft radial animation on tap (no heavy haptic, subtle glow)
  - No public resonance count visible — only the author sees aggregate signals
  - Remove sticker picker modal + associated state from discover flow
  - DB schema: add resonate_count to stories table (existing sticker counts can
    be migrated or zeroed)

  **Why it matters:** Reduces friction and anxiety in the social layer. A
  single gentle action is more likely to be used than a picker menu.

  ---

  ### #92 — Discover Feed + Follow/Unfollow Automated Tests
  **Priority:** Medium · **Effort:** Small-Medium (1–2 days)

  The discover feed ranking algorithm and follow/unfollow flows are core to
  retention but have no automated test coverage. A bug in the ranking logic or
  follow state silently degrades the entire social experience.

  **Deliverables:**
  - Integration tests for /api/discover ranking algorithm
    (followed authors score ×4, mood match ×2, engagement bonus, recency decay)
  - Tests for /api/follows POST, DELETE, GET endpoints
  - Tests for optimistic follow state in the app (locally updates before API confirms)
  - Edge cases: self-follow prevention, duplicate follow, unfollow a non-followed user

  **Why it matters:** The feed ranking is the product's social engine. Regressions
  here are silent and hard to notice until user retention drops.

  ---

  ### #93 — Admin Live Event Panel + Guides Endpoint Validation
  **Priority:** Low-Medium · **Effort:** Small (1 day)

  Admins currently have no way to see which seasonal items are live right now
  without querying the database directly. The guides endpoint also lacks
  server-side validation.

  **Deliverables:**
  - Admin events page: "Live Now" status badge with exact hours remaining
  - Admin panel: list of users who received a grant (with timestamp)
  - Server-side Zod validation on guide profile update endpoint
  - Return 400 with field-level errors when guide data is malformed

  **Why it matters:** Operational visibility for admins; prevents corrupted guide
  data reaching the app silently.

  ---

  ### #94 — Story + Journal Corruption Error States
  **Priority:** Medium · **Effort:** Small (1 day)

  When API responses return unexpected shapes, the app silently discards data
  or crashes without explanation. Users see a blank screen with no recovery path.

  **Deliverables:**
  - Defensive parsing layer for /api/stories and /api/journal-entries responses
  - Error boundary UI: "Something went wrong loading this entry — tap to retry"
  - Corrupt panel data (missing imageUri AND text): render a placeholder panel
    rather than crashing the story reader
  - Toast notification when a single entry fails to parse (not a full-screen error)

  **Why it matters:** Data corruption edge cases are rare but catastrophic when
  they occur. Users losing access to their journals with no explanation is the
  worst possible outcome for a journalling app.

  ---

  ## 4. PROPOSED (SUGGESTED, NOT YET COMMITTED)

  These are improvements suggested by the system based on known pain points.
  They are not committed — review and approve/cancel each one.

  ---

  ### #96 — Global Offline Status Indicator
  **Priority:** Low · **Effort:** Small (half-day)

  The app shows an offline banner only on some screens. When fully offline,
  users see stale data with no explanation.

  **What to build:**
  - Subtle "No connection" pill at top of screen when device is offline
  - Covers all tabs (rendered in root _layout, not per-tab)
  - Auto-dismisses when connection restores
  - Does not block interaction (users can still read cached content)

  ---

  ### #97 — Tap-to-Retry on Failed Panel Images
  **Priority:** Low · **Effort:** Small (half-day)

  When an image upload fails in the panel editor, the retry button in the
  error banner is small and easy to miss.

  **What to build:**
  - Dedicated "⟳ Tap to retry" overlay on the specific failed panel
  - Tapping the panel itself triggers re-upload (not a separate button)
  - Shows upload progress indicator directly on the panel cell

  ---

  ### #98 — Prevent Stale Data Flash on Tab Switch
  **Priority:** Low · **Effort:** Small (half-day)

  softLoadData() fires every time the app returns from background. If the user
  switches tabs rapidly or returns while a fetch is already in-flight, there
  can be a brief "old data replaced by new data" flash.

  **What to build:**
  - Debounce or cancel in-flight requests before starting a new softLoadData
  - Use request generation counters or AbortController to discard stale responses

  ---

  ### #99 — Constellation Type on Profiles
  **Priority:** Low-Medium · **Effort:** Small (1 day)

  Onboarding saves the user's constellation type (Wanderer / Keeper / Dreamer)
  but it is never shown in the app after onboarding completes.

  **What to build:**
  - Show constellation type badge on own profile (Profile tab, under name)
  - Show on public profiles (/user/[userId]) below the handle
  - "Change constellation" option in profile settings drawer
  - Validated against allowed values server-side

  ---

  ### #100 — Gentle Re-Onboarding for New Devices
  **Priority:** Low · **Effort:** Small-Medium (1 day)

  The onboarding completion flag lives in AsyncStorage and resets when the user
  clears app data or signs in on a new phone.

  **What to build:**
  - Server-backed onboarding completion flag (column on character table)
  - If local flag is missing but server says complete → silently skip onboarding
  - If genuinely new device AND no server record → offer "restore your profile"
    flow (pre-fills name/bio from existing character data)
  - Do not force-replay full onboarding for users who have stories/journal entries

  ---

  ### #106 — Re-open Mood Door Without Restarting
  **Priority:** Low · **Effort:** Small (half-day)

  The mood door overlay shows only once per app session. There is no way to
  revisit it if the user wants to switch their mood filter mid-session.

  **What to build:**
  - Persistent entry point in the Discover tab header (small mood icon button)
  - Tapping it re-opens the mood door overlay
  - Choosing a new mood re-ranks the feed immediately

  ---

  ### #107 — Pre-fill Journal Form Without Overwriting User Text
  **Priority:** Low · **Effort:** Small (half-day)

  The Daily Invitation card pre-fills the journal entry form with the prompt
  text via route params. If the user navigates away and back, the route param
  re-applies and overwrites any text the user has already typed.

  **What to build:**
  - Only apply route param pre-fill when the text field is empty
  - If text field already has content, ignore the incoming route param
  - Add a "Using today's prompt" label that disappears once the user edits

  ---

  ### #108 — Animate Daily Invitation Card Entrance
  **Priority:** Low · **Effort:** Small (half-day)

  The Daily Invitation card sits statically on the home screen. A subtle
  entrance animation when the card first appears each day would reinforce the
  ritual feeling.

  **What to build:**
  - Fade + slight upward rise animation on first render each day
  - Animation keyed to the prompt date (only plays once per calendar day)
  - Respects prefers-reduced-motion / Accessibility settings

  ---

  ## 5. CANCELLED TASKS (FOR REFERENCE)

  | Task | Title | Reason |
  |------|-------|--------|
  | #87  | Panel Templates Gallery + Draft Recovery Banner | Deferred — panel editor is functional; templates add scope without fixing a user pain point |
  | #90  | Guides Wisdom Cards + Constellation Pulse | Deferred — guides feature underused; redesign before guides grow adds unnecessary risk |
  | #95  | AI Story Creator (Paywall) | Deferred — requires Stripe/RevenueCat integration + stable AI pipeline; scope too large for current phase |
  | #101 | Quick Moment + Vibe Post Draft Auto-Save | Superseded by direct save pattern; Quick Moment is short-form enough that loss is low-stakes |
  | #102 | Dedicated Completion Screens for Quick Moment + Vibe Post | Cancelled — completion screen language updated globally; per-format screens over-engineer the UX |
  | #103 | Show Active Title + Intention on Other Users' Profiles | Delivered as part of Task #88 fix |
  | #104 | Surface Active Titles in Discover Feed Author Cards | Superseded — merged into #88 scope |
  | #105 | Prevent Stale Title Gallery State | Superseded — real-time constellation data load implemented |

  ---

  ## 6. UNDERRATED / UNDERSCOPED AREAS

  These are not tracked as tasks yet but represent meaningful gaps
  identified during development.

  ### A. Keyboard & Input Polish
  The app uses react-native-keyboard-controller but several forms (journal
  entry, intention field, chapter editor) still have moments where the keyboard
  covers the active input on older Android devices. A systematic keyboard-
  avoidance audit across all modals and forms would prevent a common source of
  negative reviews.

  ### B. Image Loading States
  Panel images, outfit photos, and avatar images use expo-image with
  memory-disk cache, but there are no shimmer/skeleton placeholders shown
  while images load on first open. On slow connections the UI feels broken
  before images appear.

  ### C. Story Draft Persistence
  The chapter editor saves drafts to AsyncStorage, but drafts are lost if the
  user is signed out or signs in on a different device. A server-backed draft
  save (auto-saved as a private/unpublished story) would prevent losing complex
  multi-panel work across devices.

  ### D. Push Notification Deep Links
  Push notifications are registered and tokens saved, but the notification
  types (follow, witness, milestone) only navigate to the correct screen on
  cold start. If the app is already open and in the foreground, deep links from
  notifications are silently dropped. The NotificationDeepLinkHandler only runs
  on startup.

  ### E. Discover Feed Pagination
  /api/discover returns the top 50 scored stories — no pagination. As content
  grows this becomes a bottleneck: the response size increases, and the 51st
  story is permanently invisible. Adding cursor-based pagination with an
  infinite scroll trigger in the feed would future-proof the social layer.

  ### F. Username Availability UX
  Username availability is checked on blur (when the user leaves the field).
  On slow connections the user may tap Save before the check returns, causing a
  confusing race condition. A debounced inline check-as-you-type with a spinner
  would remove this friction entirely.

  ### G. Story Reader Accessibility
  The manga story reader is not accessible to screen readers. Panel images have
  no alt text, narration text is in an overlay that is not announced, and the
  Witness/Save buttons lack accessibility labels in all cases. Adding proper
  accessibilityLabel and accessibilityRole attributes throughout would be a
  significant improvement.

  ### H. Admin User Lookup
  The admin panel has event management but no user lookup tool. Admins cannot
  search for a user by username or email to inspect their data, manually grant
  rewards, or investigate a report. A lightweight admin user search with read-
  only profile view would be the minimum viable moderation tool.

  ---

  ## 7. EFFORT SIZING SUMMARY

  | Category | Tasks | Rough total effort |
  |----------|-------|-------------------|
  | In Progress | 1 | ~2 days remaining |
  | Pending (committed) | 6 | ~10–14 days |
  | Proposed (if approved) | 8 | ~5–7 days |
  | Underrated gaps (if actioned) | 8 areas | ~10–15 days |
  | **Total remaining estimate** | | **~27–38 developer-days** |

  ---

  ## 8. RECOMMENDED PRIORITY ORDER

  1. **#85** (in progress) — finish the daily invitation + mood door
  2. **#86** — story card redesign (highest retention impact)
  3. **#89** — surface events in-app (closes the admin→user loop)
  4. **#94** — corruption error states (prevents data-loss perception)
  5. **#91** — resonate reaction (social philosophy alignment)
  6. **#92** — automated tests (safety net before further social work)
  7. **#93** — admin operational tooling
  8. **Proposed #96–#108** — review and approve as a batch
  9. **Underrated gaps** — prioritise D (push deep links), E (pagination),
     then B (image skeletons) based on user feedback

  ---

  *Document compiled from live project task records.*
  *Sky Journal monorepo — artifacts/sky-journal, artifacts/api-server, artifacts/admin, lib/db*
  