# Sky Journal — Task Overview
**What We're Building & Why**
*June 2026*

---

## What We're Trying to Achieve

Sky Journal's North Star is **Weekly Active Storytellers** — people who create or meaningfully engage with at least one story every week. Every task in this list moves us closer to that number.

The full emotional loop we're engineering is:

> **Create → Share → Be Witnessed → Feel Seen → Want to Create Again**

Each phase of work closes a gap in that loop. We start by making the app trustworthy (Phase 0), then make creation and discovery emotionally rewarding (Phase 1), then deepen the experience for returning users (Phase 2), then harden it for scale (Phase 3). The AI creator sits last — the aspirational ceiling that gives users something to grow toward.

---

## Phase 0 — Foundation
*Fix everything broken before shipping anything new. One glitch breaks the spell.*

---

### Task #81 — Fix SSE, Image Upload, Type Errors & Stale Data Indicator
**What we're achieving:** Trust. A creative sanctuary must feel completely reliable. Right now, three silent failures erode that trust: campfire chat breaks when the app comes back from the background, image upload errors show a blank screen, and a TypeScript mismatch causes the app layout to compile with warnings. We also have no visible signal when background data is refreshing — the app looks frozen when it isn't.

**What changes:**
- Campfire SSE reconnects automatically within 2 seconds of the app returning from the background. Users see "Reconnecting…" instead of silence
- Image uploads retry silently up to 3 times. On final failure, users see "Could not save image — tap to retry" inline. Never a blank screen again
- The TypeScript notification type mismatch in the app layout is resolved with zero compiler errors
- A soft animated pulse appears on the Discover and Journal headers while background data refreshes, then fades out when done — the app feels alive

**Why it's first:** Every other task builds on the assumption that the app works. This makes that assumption true.

---

## Phase 1 — Emotional Core
*Make the loop work end-to-end. One great creation, one great witness moment, one great discovery.*

---

### Task #82 — Onboarding Story — First 5 Minutes After Sign-Up
**What we're achieving:** Instant belonging. New users currently land on an empty profile with no progression visible, nothing to aspire to, and no emotional investment. A new user who doesn't feel something in the first 5 minutes rarely returns.

**What changes:**
- After sign-up, new users experience a 5-screen sky-themed interactive story (takes ~90 seconds): a welcome narrative, a mood picker, a constellation type chooser, a space to write their very first journal line, and a "Your sky is ready" reveal moment
- The chosen mood seeds their character profile. The first journal line is saved as their first real entry. The constellation type sets a visual theme on their profile
- After onboarding, the profile is no longer empty — it has a starting constellation, a mood, and an entry. There is something to look at and something to build on
- Returning users never see the onboarding again

**Why it matters:** First-session emotional investment is the single strongest predictor of D7 retention. If users don't feel something in session one, they churn before seeing what the app can become.

---

### Task #83 — Creation Mode Chooser + Guided First Story Flow
**What we're achieving:** A first published story for every new creator. The current panel editor is powerful but opens to a blank canvas with 12 layout choices, font controls, overlay tools, and visibility settings all at once. Most new users close it without publishing anything.

**What changes:**
- Tapping Create now shows a mode chooser with three clear options: **Quick Moment** (1 image + caption, 2 taps to publish), **Chapter** (the full multi-panel editor, unchanged), and **Vibe Post** (text + mood only, no image required)
- Quick Moment gets users from "I want to share something" to "published" in under 2 minutes
- On a user's first publish attempt in any mode, a 3-step guided overlay walks them through: pick a mood → add content → write one line. Fast, friendly, cannot fail
- The first-publish flag is stored so the overlay never repeats

**Why it matters:** The first publish is the hardest. Once someone has published once, the second time is dramatically easier. This task ensures the first time succeeds.

---

### Task #84 — Witness Notifications + Milestone Rewards
**What we're achieving:** Making creators feel seen — not just counted. Being witnessed currently increments a silent number. The creator gets no warmth, no texture, no sense of who was moved by their work. This kills the "Feel Seen" stage of the loop.

**What changes:**
- Instead of a badge count, the home screen shows "3 people witnessed your story last night" with a soft floating-stars animation — something to wake up to
- When a creator views their own story, a subtle mosaic of up to 8 constellation icons (representing witnesses) is arranged like a small star cluster below the panel count. Not a list — a feeling
- At 10, 50, 100, and 500 witnesses on a single story, a full-screen milestone moment fires for the creator: animated sky burst, reward name, and a CTA to view their profile
  - **10 witnesses** → Aura boost + "Resonant" title unlocked
  - **50 witnesses** → Constellation star unlocked + "Storyteller" badge
  - **100 witnesses** → Sky Journal featured nomination eligibility
  - **500 witnesses** → "Legend" title + profile shimmer effect
- Milestones are tracked server-side and only fire once per story per threshold

**Why it matters:** Creators only keep creating if creating feels rewarding. This task closes the feedback loop between publishing and feeling recognised.

---

### Task #85 — Daily Invitation Card + Mood Door Entry for Discover
**What we're achieving:** A daily reason to open the app, and a moment of emotional intention before browsing. Both fight the single biggest retention enemy: having no compelling reason to come back today.

**What changes:**
- The home tab shows one beautiful "Daily Invitation" card every day — a single creative prompt (e.g. "Something changed today. What was it?"). The prompt rotates at midnight and is weighted toward the user's recent mood history. Tapping it opens the creation flow pre-filled with the prompt and mood
- On the first Discover open per app session, a "What are you in the mood for?" full-screen overlay shows 5 large mood tiles. Selecting one filters the feed to that mood. Dismissing shows the default For You feed. The overlay resets each session — it is a ritual, not a filter menu
- ~60 curated prompts live as a local constant; no server call required for the daily card

**Why it matters:** Daily habit formation requires a daily trigger. The invitation card is that trigger. The mood door turns mindless scrolling into an intentional act — which makes the content feel more resonant when it appears.

---

## Phase 2 — Depth & Delight
*Make experienced users fall deeper in love with what they've built.*

---

### Task #86 — Story Card Visual Redesign + Sequential Reading Flow
**What we're achieving:** Making every story on the Discover feed feel like a book worth opening, and making it effortless to read one more story after finishing one.

**What changes:**
- Each Discover card now shows the first story panel as a full-bleed visual (like a book cover). Below it: chapter title in styled type, author handle, mood badge, and a single "pull quote" — the most evocative sentence auto-extracted from the story's panel text (client-side, longest sentence from narrations)
- Stories with no images show a gradient coloured by mood as the card background
- After reading the last panel of a story, a "Continue Reading" card slides in from the bottom, showing the next mood-matched story. Tap to continue reading; swipe down or ignore to dismiss. No auto-play — the user always chooses

**Why it matters:** A flat card with a title and a number does not make anyone feel anything. A visual cover with a pull quote makes a story feel worth reading before the first panel loads. Sequential reading turns a single story visit into a session.

---

### Task #87 — Panel Templates Gallery + Draft Recovery Banner
**What we're achieving:** Removing the blank-canvas fear for Chapter creators, and turning abandoned drafts into a return-to-app trigger.

**What changes:**
- Choosing "Chapter" in the mode chooser now first shows a template picker: 8–10 illustrated layout cards (Full Bleed Cinematic, Dialogue Scene, Solo Reflection, Action Moment, Season Memory, Twin Panels, 2×2 Grid, Triptych, Cover Page). Tapping one pre-fills the editor with that structure; "Start blank" remains available
- When a user has a saved Chapter draft and re-opens the Create tab, a banner appears: "Continue your story — [title]" with a Resume button. Dismissing clears it for that session. Incomplete creative work is psychologically compelling — this banner converts that psychology into a re-open

**Why it matters:** Templates solve the cold-start problem for intermediate creators. Draft recovery is one of the highest-ROI retention mechanics available — it works on users who are already invested.

---

### Task #88 — Title Preview Gallery + Living Profile Header
**What we're achieving:** Making progression visible and aspirational from day one, and turning the profile from a stats page into a living presence.

**What changes:**
- The profile screen adds a "Titles" gallery section: all titles displayed, locked ones as silhouettes with their unlock criteria visible ("Write 10 stories → Storyweaver"). Earned titles show in full colour with a glow. Tapping an earned title sets it as the user's active displayed title
- The profile header shows the active title beneath the @username in small styled type
- An optional "Today's Intention" one-liner appears on the profile (tap to edit, max 80 chars, clears at midnight). Visible to anyone who views the profile. Turns a static profile into something that changes daily

**Why it matters:** Users who can see what they're working toward stay engaged with the progression system. Users who cannot see it treat it as invisible. The intention field gives regular visitors a reason to check someone's profile daily.

---

### Task #89 — Seasonal Event Banner + Event-Linked Story Prompts
**What we're achieving:** Making the admin events system visible and emotionally resonant for app users. Events currently exist in the database but are completely invisible in the app — they generate no community excitement.

**What changes:**
- When an event is active, the home tab shows a beautiful themed banner: event title, short description, live countdown ("3 days left"), and a theme-specific gradient (spring/summer/autumn/winter/special). Dismissing hides it for the rest of the day
- Tapping the banner opens an event detail sheet with the full description, active inventory item names, and a "Create a story for this event" CTA
- Tapping the CTA opens the creation flow pre-filled with the event's prompt and closest matching mood — making it one tap from "I see the event" to "I'm creating for it"
- A new public `/api/events/active` endpoint is added (requires user auth, no admin auth)

**Why it matters:** Seasonal events create community rhythm — a shared reason to create and read at the same time. Without app visibility, the events admin system is value sitting unused.

---

### Task #90 — Guides Wisdom Cards + Constellation Pulse on Home
**What we're achieving:** Making Constellation Guides feel like real mentors worth following, and making personal progression feel ambient and alive on the home screen.

**What changes:**
- The Guides tab replaces the flat list with "Wisdom Cards" — large tiles showing each Guide's constellation icon, name, current topic badge, a one-sentence excerpt from their most recent story, and a one-tap Follow button with a glow border in their constellation colour
- The home screen adds a small, dim, ambient constellation map (read-only subset of the user's own constellation) with a slow breathing animation. Tapping it navigates to the profile's constellation section
- The constellation on the home screen updates as the user earns new stars — visible progress without having to visit the profile

**Why it matters:** Guides are an underused mentorship mechanic. The flat list makes them feel like a directory. Wisdom Cards make them feel like people. The home constellation pulse makes progression feel present in everyday use, not just when you visit the profile tab.

---

## Phase 3 — Scale Readiness
*Harden the experience for growth without losing intimacy.*

---

### Task #91 — Resonate Reaction — Replaces Sticker Picker on Feed
**What we're achieving:** Removing social performance anxiety from the discovery feed and replacing it with a single, quiet signal that feels good to give and meaningful to receive.

**What changes:**
- The sticker picker on Discover feed cards is removed entirely
- Each card now has one action: **Resonate** — a soft ripple icon. Tapping it plays a local ripple animation and calls the API fire-and-forget. The button shows a filled state for that session only (not persisted — no "likes" counter anxiety)
- No resonate count is shown publicly, anywhere
- The creator's home screen shows "Someone resonated with your [story title]" as a warm notification card — no identity, no number, just a feeling

**Why it matters:** The sticker system creates pressure: which sticker is the right one? How many did my story get? Resonate collapses this to a single human gesture. It feels like nodding at someone across a room — acknowledged without performance.

---

### Task #92 — Discover Feed + Follow/Unfollow Automated Tests
**What we're achieving:** Confidence that the ranking algorithm and follow system work correctly as the codebase evolves. These flows are core to retention but have no test coverage — a silent bug in ranking or follow state degrades the entire social experience.

**What changes:**
- Integration tests added for the discover endpoint: verifies public-only results, self-exclusion, followed-author stories ranked higher, mood-matched stories ranked higher, and stale stories ranked lower
- Integration tests added for follow/unfollow routes: follow, unfollow, idempotent duplicate follow, self-follow rejection, and correct following list response
- All tests run in CI (`pnpm --filter @workspace/api-server run test`)

**Why it matters:** Discovery is what keeps non-creators engaged. If the algorithm quietly breaks, non-creators churn first — and without readers, creators stop getting witnessed, and they churn next. Tests protect the entire loop.

---

### Task #93 — Admin Live Event Panel + Guides Endpoint Validation
**What we're achieving:** Giving admins real-time visibility into what's live right now, and protecting the app from corrupted guide data ever reaching users.

**What changes:**
- The admin Events page adds a "Live Now" section at the top: any event currently within its start/end window, showing inventory item names, time remaining, and an "End Early" button that immediately sets the event to ended
- The guides API endpoint validates each guide record against a Zod schema before sending; malformed records are filtered out and logged server-side; the app never receives corrupted guide data
- The Guides tab shows a gentle "Some guides are resting for now — check back soon" illustrated empty state if the list is empty, rather than a blank screen

**Why it matters:** Admins currently have no way to see what's live without querying the database directly. Guide data corruption (missing fields, wrong types) currently reaches the app silently. Both are operational risks that grow with scale.

---

### Task #94 — Story + Journal Corruption Error States
**What we're achieving:** Ensuring bad data never silently disappears or crashes the app. When a story or journal entry has a malformed payload, users currently see either a blank screen or a crash — with no way to recover.

**What changes:**
- Server-side Zod validation on story and journal list endpoints filters out malformed records before they leave the API; invalid records are logged with their ID for ops visibility
- Client-side parse guards in AppContext drop any item missing required fields and set a `hasCorruptedData` flag on that state slice
- A soft dismissible banner appears on the Journal and Discover tabs if any data was dropped: "Some entries couldn't be loaded — pull to refresh"
- The story reader shows a full-screen "This story couldn't be opened" state with a back button if the story object is invalid — always navigable, never a dead end

**Why it matters:** Data corruption is rare but inevitable at scale. The current silent-failure behaviour means users lose content with no explanation and no recovery path. These error states turn corruption from a crash into a recoverable moment.

---

## Paywall Tier — Coming Soon

---

### Task #95 — AI Story Creator from Pictures — Tiered Paywall (Coming Soon)
**What we're achieving:** The aspirational ceiling of the Sky Journal creative experience. A user uploads photos — memories, sketches, moments — and AI transforms them into a finished, publishable story. Manga-stylised, or in a style they define. This is for the creator who has a feeling but not the craft, and it is the strongest possible reason to upgrade.

This task is **behind a paywall** and **Tier 4 is not yet accessible** — it will be unlocked in a future release. The infrastructure is built, the gate is real, and the waitlist is live.

---

**The Four Tiers:**

#### Tier 1 — Free *(already exists)*
Everything that exists today. Manual panel creation, up to 12 panels, all three creation modes. No AI. No change to what free users have now.

#### Tier 2 — Wanderer *(Standard, paid)*
The first step into AI assistance — gentle and non-intimidating.
- **AI Caption Suggestions**: upload a panel image and receive 3 narration suggestions to pick from or edit; user still writes and arranges everything
- **Mood Auto-Detection**: AI reads the uploaded image and suggests a matching story mood
- **Prompt Expansion**: tap any daily invitation prompt to receive 3 AI-expanded variations

#### Tier 3 — Dreamer *(Pro, paid)*
For creators who want AI as a creative partner, not just a helper.
- **AI Manga Stylisation**: upload any real photo → receive a manga/anime-stylised version as a panel asset; keep the original or use the stylised version
- **Panel Sequence Suggestions**: upload 2–6 photos → AI suggests a narrative order and transition captions to build a coherent story arc
- **Style Presets**: 5 visual styles applied to uploaded images — Soft Watercolour, Ink Line Art, Dreamy Glow, Night Sky, Classic Manga

#### Tier 4 — Constellation *(AI Premium — Coming Soon, not yet accessible)*
The full creative transformation. Upload your memories. Get back a story.
- **Full AI Story Generation**: upload 1–10 photos → choose a story style (manga, illustrated diary, cinematic, fairytale, poetic) → AI generates a complete multi-panel story: stylised images, narration for each panel, chapter title, mood tag, and location — ready to publish or edit
- **Batch Generation**: generate up to 3 story drafts from one photo set; choose the best one
- **Dialogue + Speech Bubble Generation**: AI places dialogue into speech bubbles on panels, fully editable
- **Custom Style Training** *(future)*: upload 5+ of your own drawn panels and AI learns your personal visual style

The Tier 4 card in the paywall UI shows a beautiful locked state — starfield background, "Coming Soon" badge, and a "Join the waitlist" field. The waitlist is live from day one; the feature ships when the AI integration is production-ready.

---

**What the paywall UI achieves:**
- Free users see all four tiers clearly described, with locked states for Tier 2+; the aspiration is visible even before upgrading
- The upgrade prompt appears inline when a locked feature is tapped — never as a cold paywall on open
- Subscription state is validated server-side on every AI endpoint; no client-side trust

---

## Summary Table

| # | Task | Phase | What It Achieves |
|---|---|---|---|
| #81 | Fix SSE, uploads, type errors & stale indicator | 0 | App trustworthiness |
| #82 | Onboarding story | 1 | First-session belonging |
| #83 | Creation mode chooser + guided first story | 1 | First publish success |
| #84 | Witness notifications + milestone rewards | 1 | Creator feels seen |
| #85 | Daily invitation card + mood door | 1 | Daily habit trigger |
| #86 | Story card redesign + sequential reading | 2 | Discover session depth |
| #87 | Panel templates + draft recovery | 2 | Creator retention |
| #88 | Title gallery + living profile header | 2 | Visible progression |
| #89 | Seasonal event banner + prompts | 2 | Community rhythm |
| #90 | Guides wisdom cards + constellation pulse | 2 | Mentorship + ambient progress |
| #91 | Resonate reaction | 3 | Anxiety-free social signal |
| #92 | Discover + follow/unfollow tests | 3 | Algorithm confidence |
| #93 | Admin live event panel + guide validation | 3 | Operational visibility |
| #94 | Story + journal error states | 3 | Corruption recovery |
| #95 | AI story creator — tiered paywall | Paywall | Aspirational ceiling + monetisation |

---

## Dependency Order

Tasks are designed to build on each other in this order:

```
#81 (Foundation)
  ├── #82 Onboarding
  ├── #83 Creation modes ──────── #87 Templates
  │         └── #86 Story cards ─── #91 Resonate ── #92 Tests ──┐
  ├── #84 Witness rewards ──── #88 Titles                        │
  └── #85 Home + mood door ─── #89 Seasonal events ── #93 Admin ─┤
            └── #90 Guides                                        │
                                       #94 Error states ──────────┤
                                                                   ▼
                                                         #95 AI Paywall
```

Phase 0 must ship before anything else. Phase 1 tasks can run in parallel with each other. Phase 2 tasks each depend on one or two Phase 1 tasks. Phase 3 tasks and the AI paywall close the sequence.
