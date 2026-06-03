# Sky Journal — Product Strategy Document
**Role: CTO + UX Engineering Lead**
**Date: June 2026**
**Version: 1.0**

---

## North Star

> **"Every person has a story worth telling. Sky Journal makes telling it feel like magic — and being witnessed feel like belonging."**

The North Star metric is **Weekly Active Storytellers** — users who create *or* meaningfully engage with at least one story per week. This single number captures both supply (creators) and demand (readers), and it only grows when the experience is genuinely rewarding on both sides.

We are not building a social network. We are building a **creative sanctuary** — the place someone goes when they want to express something true, find someone who feels the same, and leave feeling less alone.

---

## The Emotional Loop (Core Design Philosophy)

Every feature must serve one or more stages of this loop:

```
CREATE → SHARE → BE WITNESSED → FEEL SEEN → WANT TO CREATE AGAIN
```

Each stage must have a clear emotional payoff:

| Stage | Desired Feeling | Design Signal |
|---|---|---|
| **Create** | Flow, control, delight | Tools feel responsive, expressive, forgiving |
| **Share** | Courage, hope | Soft friction before publishing — intentional, not fearful |
| **Be Witnessed** | Warmth, surprise | Notifications feel like gentle taps, not dopamine pings |
| **Feel Seen** | Belonging, recognition | Vibes match, comments resonate, Titles feel earned |
| **Create Again** | Inspiration, momentum | Discover surfaces stories that make you want to respond |

If a feature does not move someone along this loop, cut it or redesign it.

---

## Current Strengths (What's Working)

- **Aesthetic cohesion** — The sky gradient system, lavender palette, and manga panel aesthetic are distinctive and emotionally coherent.
- **Privacy-first default** — Journal is always private; stories are opt-in public. This is the right call.
- **"Witnessed" instead of likes** — Philosophically correct. Removes anxiety-driven engagement.
- **Constellation progression** — XP + constellation map is a strong retention skeleton.
- **Discovery algorithm** — Mood match + following + recency is thoughtful and humane.

---

## Critical Gaps (Ranked by User Impact)

### 1. The Creation Cliff
The panel editor is powerful but intimidating. There is no guided path from "I want to create something" to "I published a story." First-time users face a blank canvas with 12 layout options, font controls, overlay tools, and visibility settings all at once.

**Impact:** High drop-off before first publish. If the first story never ships, the user never enters the emotional loop.

### 2. The Discovery Desert
The Discover feed requires the user to already know their mood, follow someone, or scroll cold content. There is no moment of serendipity — no "this was made for you" feeling. The algorithm is good; the presentation of it is flat.

**Impact:** Users who don't find something resonant in the first session churn before forming a habit.

### 3. The Silent Witness Problem
Being witnessed triggers a count increment. That's it. The creator gets a number. There is no texture to the feedback — no sense of *who* witnessed, *when*, or *why this story moved them*. This undermines the "feel seen" stage entirely.

**Impact:** Creators don't feel rewarded for publishing. Story output slows.

### 4. The Empty Profile Wall
A new user's profile is hollow — no constellation progress, no titles, no stories. There is nothing to look at and nothing to want. The progression system exists but is invisible at the start.

**Impact:** New users don't understand what they're building toward. Churn in week 1.

### 5. Continuity Breaks
SSE drops on background return, stale data shows briefly on tab switch, image upload failures show a blank error. Each individually small — together they erode the sense that the app is alive and trustworthy.

**Impact:** Subconscious distrust. Users stop treating the app as their primary creative space.

---

## Recommended App Structure

### Information Architecture (Revised)

```
Tab 1: HOME          — Personalized, time-aware landing
Tab 2: JOURNAL       — Private sanctuary (diary + moments)
Tab 3: CREATE (+)    — Floating, always accessible
Tab 4: DISCOVER      — Social reading + community
Tab 5: PROFILE       — Identity + progression + wardrobe
```

The tab order is correct. The *experience within each tab* needs rearchitecting.

---

## Recommendations by Area

---

### AREA 1: HOME TAB
**Current state:** Sky hero, quick actions, recent entries.
**Problem:** Generic. Doesn't adapt to user state.

#### R1.1 — Time + Mood Aware Welcome
Show a different sky gradient and greeting based on time of day AND the user's last recorded mood. "Good evening, [name]. You felt peaceful last time you were here."

#### R1.2 — Daily Invitation Card
One card, every day. Not a prompt list — a single beautiful invitation to create. Examples:
- *"Something changed today. What was it?"*
- *"Draw the sky you woke up to."*
- *"Write a line to your past self."*

Rotate from a curated set of ~60, weighted by the user's mood history. Tap → goes to create flow pre-filled with the prompt.

#### R1.3 — Constellation Pulse
A small animated visual on the home screen showing the user's constellation progress — not a percentage bar, but the actual star map, dimly glowing. Tap to see full profile. This makes progression ambient and desirable without being pushy.

**Priority: P1 | Effort: 3 days**

---

### AREA 2: CREATION FLOW
**Current state:** Full panel editor on first open. Powerful but steep.
**Problem:** No onboarding ramp. No expression templates. No quick-start.

#### R2.1 — Creation Mode Chooser (NEW)
Before the panel editor, show three modes:

```
[ Quick Moment ]    [ Chapter ]    [ Vibe Post ]
  1 image + caption  Multi-panel    Text + mood only
  2 taps to publish  Full editor    No image needed
```

This collapses 80% of creation anxiety. Most users want Quick Moment. Power users want Chapter. Both are now respected.

#### R2.2 — Guided First Story Flow
On first publish attempt, run a 3-step guided overlay:
1. "Pick a mood — this is how your story feels"
2. "Add one image or draw a scene"
3. "Write one line — it doesn't have to be perfect"

No skip. Gentle, story-driven UX copy. Result: a beautiful, publishable story in under 2 minutes.

#### R2.3 — Panel Templates (Gallery)
Before the blank canvas, offer a scrollable row of 8–10 pre-composed layouts with placeholder imagery. "Start from here" vs. "start from nothing." Templates include: dialogue scene, solo reflection, action moment, season memory, twin panels, full bleed cinematic.

#### R2.4 — Auto-Save + Draft Recovery Banner
Currently auto-saves to AsyncStorage. Make this *visible* with a soft "Draft saved" toast. On re-entry, show a "Continue your story?" banner before the create screen loads. This is a powerful retention mechanic — incomplete creative work is psychologically compelling.

**Priority: P1 | Effort: 5 days**

---

### AREA 3: DISCOVER FEED
**Current state:** Four tabs (Stories, Guides, Vibes, People). Algorithmically sound but visually flat.
**Problem:** No serendipity, no emotional hook on entry, cold-start problem for new users.

#### R3.1 — Mood Door Entry
Replace the flat tab bar entry with a "What are you in the mood for?" moment — shown once per session on first Discover open. Five large, beautiful mood tiles. Tap one → feed filters to that mood. Dismiss → default For You. This is not a filter toggle; it's an emotional doorway.

#### R3.2 — Story Card Redesign
Current: title, author, witnessed count.
Proposed: First panel as full-width visual card (like a book cover). Below it: chapter title in styled type, author handle, mood badge, and a single "pull quote" from the story text — the most evocative line, auto-extracted (client-side, pick longest or most punctuated sentence). This makes every card feel like a book you want to open.

#### R3.3 — "Resonates With Me" Reaction (Single Vibe Echo)
Replace the generic sticker system on the feed card with one single action: **Resonate**. A soft ripple animation, no count shown to the reader, but the creator gets a "Someone resonated with your story" notification. No social performance anxiety. Pure signal.

#### R3.4 — Sequential Reading Flow
After finishing a story, show: "Continue reading — [Next story by mood match]" with a gentle slide-in. Netflix-style but calm. Zero friction to the next read. This drives session depth without algorithmic manipulation.

#### R3.5 — Guides Tab Elevation
Constellation Guides are an underused feature. Give each Guide a "Wisdom Card" — a stylized profile tile with their current guide topic and a recent post excerpt. Follow is one tap from the card. Make it feel like discovering a mentor, not browsing a list.

**Priority: P1 (R3.1–R3.3) P2 (R3.4–R3.5) | Effort: 6 days**

---

### AREA 4: THE WITNESS SYSTEM (Emotional Reward)
**Current state:** Witnessed count increments. Silent.
**Problem:** Creators get no qualitative feedback. "Witnessed" is a number, not a feeling.

#### R4.1 — Witness Notification Redesign
Current: badge count.
Proposed: "3 people witnessed your story last night" — with a soft sky animation (light beams or floating stars). Shown on home screen, not push notification. Feels like waking up to something beautiful.

#### R4.2 — Witness Mosaic (Creator View Only)
When a creator opens their own story, show a subtle mosaic of the last 6–8 witness avatars (default character icons if no photo) arranged like a constellation. Not a list — a visual impression. "These people were here."

#### R4.3 — Milestone Witness Rewards
At 10, 50, 100, 500 witnesses on a single story — trigger a private reward moment for the creator:
- 10: Aura boost, custom "Resonant" title unlocked
- 50: Constellation star unlocked, "Storyteller" badge
- 100: Sky Journal featured nomination eligibility
- 500: "Legend" title + profile shimmer effect

Each milestone shown as a full-screen moment (like an achievement unlock), then quietly stored on profile.

**Priority: P1 | Effort: 4 days**

---

### AREA 5: PROFILE + PROGRESSION
**Current state:** Constellation map, XP system, wardrobe, aura ring.
**Problem:** New users see an empty profile. Progression is invisible. Titles are not discoverable.

#### R5.1 — Onboarding Story (First 5 Minutes)
After sign-up, before reaching the home tab — a 5-screen interactive story written in the Sky Journal aesthetic:
- "Every sky has a wanderer..."
- Choose your starting mood (→ sets initial character mood)
- Choose your constellation type (→ visual theme, not mechanical)
- Write your first journal line
- "Your sky is ready."

This takes 90 seconds, creates emotional investment, and populates the profile immediately.

#### R5.2 — Living Profile Header
The aura ring + mood background already exists. Add:
- Current constellation name (not just level)
- A "Today's Intention" one-liner (user-set, like an Away message — optional, clears at midnight)
- Current title displayed beneath username

This turns the profile from a stats page into a *living presence*.

#### R5.3 — Title Preview (Before Earning)
Show all titles in a browsable gallery — locked ones are displayed as silhouettes with unlock criteria visible. "Write 10 stories → unlock Storyweaver." Aspiration over mystery. Lets users self-direct their journey.

#### R5.4 — Seasonal Events Integration
The admin events system is built but invisible to users. Surface the current active event on the home tab as a beautiful banner with a countdown. Event-specific story prompts should auto-populate the creation flow during events. Limited-time inventory should feel like a festival, not a store.

**Priority: P1 (R5.1) P2 (R5.2, R5.3) P2 (R5.4) | Effort: 7 days**

---

### AREA 6: RELIABILITY + TRUST
**Current state:** Several known breakage points (SSE drop, blank image errors, type mismatches).
**Problem:** Each glitch breaks the spell. A creative sanctuary must feel completely trustworthy.

#### R6.1 — SSE Reconnection on Resume
Auto-reconnect SSE within 2 seconds of app foreground. Show a soft "Reconnecting..." state in campfire rooms. Never silently fail.

#### R6.2 — Graceful Image Upload Failure
On upload failure: show the image locally optimistically, display "Saving..." state, retry silently up to 3 times, then show "Could not save image — tap to retry" inline. Never a blank error.

#### R6.3 — Stale Data Indicator
When background refresh is in progress, show a subtle "Updating..." pulse on the feed — not a spinner, just a gentle glow on the header. Users feel the app is alive, not frozen.

**Priority: P0 — fix before any new features | Effort: 3 days**

---

## Full Priority Roadmap

### PHASE 0 — Foundation (Week 1)
*Ship nothing new. Fix everything broken.*

| Task | Owner Area | Days |
|---|---|---|
| SSE reconnection on app resume | API + App | 1 |
| Image upload retry + graceful error | App | 1 |
| TypeScript notification type fix | App | 0.5 |
| Stale data refresh indicator | App | 0.5 |
| **Total** | | **3 days** |

---

### PHASE 1 — Emotional Core (Weeks 2–4)
*Make the loop work end-to-end. One great creation, one great witness moment, one great discovery.*

| Feature | Area | Days | Emotional Payoff |
|---|---|---|---|
| Onboarding story (first 5 min) | Profile | 2 | Instant belonging |
| Creation mode chooser (Quick/Chapter/Vibe) | Create | 2 | Removes first-publish fear |
| Guided first story flow | Create | 1.5 | First publish = success |
| Witness notification redesign | Discover | 1 | Creator feels seen |
| Milestone witness rewards | Discover | 2 | Retention + pride |
| Daily invitation card (home) | Home | 1 | Daily return habit |
| Mood door entry (Discover) | Discover | 1 | Serendipitous discovery |
| Story card pull quote + visual redesign | Discover | 1.5 | Stories feel compelling |
| **Total** | | **12 days** | |

---

### PHASE 2 — Depth + Delight (Weeks 5–7)
*Make experienced users fall deeper in love.*

| Feature | Area | Days | Emotional Payoff |
|---|---|---|---|
| Panel templates gallery | Create | 2 | Power user flow state |
| Draft recovery banner | Create | 0.5 | Incomplete work = return trigger |
| Sequential reading flow | Discover | 1 | Session depth |
| Witness mosaic (creator view) | Stories | 1.5 | Intimacy without exposure |
| Title preview gallery (locked/unlocked) | Profile | 1.5 | Aspiration + self-direction |
| Living profile header (intention + title) | Profile | 1 | Identity expression |
| Seasonal event banner + event prompts | Home + Events | 2 | FOMO + community rhythm |
| Guides elevation (Wisdom Cards) | Discover | 1.5 | Mentorship + discovery |
| Constellation pulse on home | Home | 1 | Ambient progression |
| **Total** | | **12 days** | |

---

### PHASE 3 — Scale Readiness (Weeks 8–10)
*Prepare for growth without losing intimacy.*

| Feature | Area | Days |
|---|---|---|
| Resonate reaction (replaces sticker for feed) | Discover | 2 |
| Discover feed tests (follow/unfollow, feed ranking) | API | 2 |
| Admin seasonal item visibility dashboard | Admin | 1.5 |
| Validate guides endpoint (safe payloads) | API | 1 |
| Story/journal corruption error states | App | 1 |
| **Total** | | **7.5 days** | |

---

## Total Estimate

| Phase | Calendar Time | Engineering Days |
|---|---|---|
| Phase 0 — Foundation | Week 1 | 3 days |
| Phase 1 — Emotional Core | Weeks 2–4 | 12 days |
| Phase 2 — Depth + Delight | Weeks 5–7 | 12 days |
| Phase 3 — Scale Readiness | Weeks 8–10 | 7.5 days |
| **Grand Total** | **~10 weeks** | **~34.5 days** |

Assumes one full-stack engineer. Parallelise Phase 1 app + Phase 0 API tasks for faster delivery.

---

## What We Are NOT Building (And Why)

| Rejected Feature | Reason |
|---|---|
| Comments / replies on stories | Creates performance anxiety. Witness + Resonate is sufficient signal. |
| Follower/following counts visible on profiles | Turns identity into a number. Contradicts the social philosophy. |
| Trending / hot stories list | Algorithmic pressure. Favors loud over meaningful. |
| Read receipts on messages | Surveillance feeling. Kills safety in campfire rooms. |
| Notification badges on tab bar for Discover | Conditions users to check out of anxiety, not interest. |

---

## Definition of Done

A feature is "done" when:
1. A first-time user can complete the intended action without instructions
2. The interaction has a clear emotional payoff — something that makes the user feel something
3. It does not introduce a new anxiety, social pressure, or performance metric
4. It works offline (or fails gracefully with a recoverable state)
5. It does not break the existing emotional loop

---

## CTO Sign-Off Note

The architecture is sound. The database schema is clean. The API is well-structured. The risk is not technical — it is experiential. We have built an excellent skeleton and a beautiful skin. What is missing is the **nervous system**: the moment-to-moment emotional texture that makes a user feel the app understands them.

That is what Phase 1 delivers. Everything else follows.

*The goal is not to be the biggest story platform. It is to be the one people come back to when they need to feel something real.*
