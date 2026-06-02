# Sky Journal — Recommendations

A complete task list organized by category. Each item is self-contained and ready to build.

---

## 🐛 Bugs

1. **Fix TypeScript notification type mismatch in app layout**
   `app/_layout.tsx` references `shouldShowAlert`, `shouldShowBanner`, `shouldShowList`, and `NotificationPermissionsStatus.granted` using outdated Expo notification API shapes. The pre-existing TS errors cause noise in every typecheck run and could mask real regressions.

2. **Usernames are permanent — allow users to change their handle**
   `routes/character.ts` explicitly blocks username updates once set. Users who regret a name have no recourse. Add a 30-day cooldown between renames and wire up the profile UI to show the "change username" option when the cooldown has passed.

3. **Story layout falls back silently to layout `'1'` for unknown types**
   `app/story/[id].tsx` uses `fallbackKey = '1'` whenever a `pageLayoutKey` isn't recognised. Stories with unsupported layouts show the wrong format with no indication something went wrong. Map unknown keys to a sensible generic layout and log a warning.

4. **SSE connection does not reconnect after the app wakes from deep background**
   `hooks/useSSE.ts` tears down the SSE connection on blur and re-opens on focus, but the exponential backoff state is not reset between focus/blur cycles. After several background/foreground cycles the reconnect delay grows to 30 s, making messages feel broken. Reset the backoff counter on each fresh focus event.

5. **Campfire messages past their `expiresAt` are never pruned**
   The `campfire_messages` DB table has an `expiresAt` column, but there is no server-side cleanup. Old messages accumulate indefinitely. Add a lightweight scheduled job (setInterval or cron route) that DELETEs rows where `expiresAt < NOW()` once per hour.

6. **Weather proxy has no caching — prone to rate-limit 502s**
   `GET /api/weather` is a raw passthrough to `wttr.in` with no TTL cache. High traffic or wttr.in downtime surfaces directly to users. Add a 10-minute in-process cache (same pattern as the discover cache) and return a neutral "clear" fallback if the upstream times out.

7. **Drift AI defaults to `"dummy"` API key when env var is missing**
   `routes/drift.ts` silently falls back to `"dummy"` if `ANTHROPIC_API_KEY` is unset. API calls then fail at runtime with a cryptic 401 rather than a clear startup error. Add a startup guard that throws on missing key and surface a "Lumi is offline" message to the client instead of an unhandled rejection.

8. **Optimistic follow/unfollow can desync if the API call fails**
   `app/(tabs)/discover.tsx` applies an optimistic UI update but silences errors, so a failed network call leaves the button in the wrong state permanently until the next full reload. On API failure, revert the optimistic state and show a brief toast.

---

## ✨ New Features

### Social & Community

9. **Show who else is in a campfire room right now**
   The SSE `presence_update` event already emits a live `soulCount`. Surface this as an avatar-count badge on each room card in `campfire/index.tsx` and as a glowing "X souls here" indicator inside the room. No backend changes required.

10. **Live unread badge on the Messages tab**
    When a new DM arrives via SSE while the user is on another tab, increment a local unread count badge on the Messages tab bar icon. Clear it when the user opens the inbox. Requires wiring `useSSE` into the tab layout and a shared badge state.

11. **Show a "typing…" indicator in DMs**
    Add a `typing` SSE event type. When the user starts typing in the message box, emit a debounced `POST /api/messages/:userId/typing`. The recipient's SSE stream receives it and shows a pulsing bubble for 3 seconds. Pure UX delight, minimal backend work.

12. **User blocking — hide content and messages from blocked users**
    Add a `blocks` table (blocker_id, blocked_id). Block from the `user/[userId].tsx` profile page via the report sheet. Blocked users' stories are filtered from Discover and messages are silently dropped. Essential safety feature.

13. **"Find people with similar traits" matching**
    The `traits` JSONB array on the `character` table enables a similarity query. Add a `GET /api/users/similar` endpoint that returns users sharing 2+ traits with the current user. Surface as a "People like you" section inside the Discover People tab.

14. **Guide booking / scheduling system**
    The `character` table already stores `is_guide`, `guide_topics`, and `guide_availability`. Build a "Book a Guide" flow: users browse guides on a `guides/index.tsx` screen, see their availability calendar, and send a booking request that creates a dedicated DM thread.

### Journaling & Creation

15. **Mood trend dashboard — visualise your emotional journey over time**
    Journal entries and stories both store a `mood` field. Add a "Reflections" screen that shows a weekly/monthly mood chart (line or area chart) using the existing data. No new API calls needed beyond the already-fetched journal entries.

16. **AI journal summarisation using Drift/Lumi**
    Wire the existing `POST /api/drift/analyze` endpoint to accept a set of journal entry IDs. Return a short, warm paragraph summarising the user's week. Surface as an optional "Weekly Reflection from Lumi" card on the Home screen every Monday.

17. **Save Drift session plans to the database**
    `POST /api/drift/analyze` generates plans but discards them. Add a `drift_sessions` table (id, user_id, plan JSONB, created_at) and a `GET /api/drift/sessions` history endpoint. Show past plans in a "Lumi's Notes" drawer on the Home screen.

18. **Story editing — let authors update chapters they've already published**
    `PATCH /api/stories/:id` exists on the backend but there is no UI entry point for it. Add an "Edit" button to the story viewer when `authorUserId === myUserId`. Reuse the panel editor flow pre-populated with the existing panels.

19. **Export journal as a PDF or image**
    Let users long-press a journal entry and choose "Save as image" — render the `JournalCard` at 2× resolution and share it via the native share sheet. Could also batch-export all entries for a given month.

### Gamification & Progression

20. **Seasonal events shop and limited-time cosmetics**
    The `events`, `user_purchases`, and `user_rewards` tables provide the full foundation for a seasonal shop. Build the user-facing "Event" banner on the Home screen that links to the event's themed shop items. The admin events system can drive it with no extra backend work.

21. **Constellation streak protection ("Star Shield")**
    The `constellation_progress` table tracks `streak`. Add a consumable "Star Shield" item in the shop that protects one missed day. When the daily task runs and finds a missed day, check if the user owns a shield before breaking the streak.

22. **Daily login reward**
    Grant a small star bonus (1–3 stars) for each consecutive day the user opens the app. Store the last-login date in `constellation_progress`. Show a brief `RewardBanner` on the Home screen greeting.

---

## 🎨 Polish & UX

23. **Empty states for all tabs**
    Journal, Discover, and Wardrobe tabs show blank screens for new users. Design and add illustrated empty states ("Your journey begins here…") for each tab with a clear call-to-action button.

24. **Pull-to-refresh on all data screens**
    `log.tsx`, `discover.tsx`, `profile.tsx`, and `wardrobe.tsx` do not implement `RefreshControl`. Add pull-to-refresh that calls `reloadData()` and shows the existing loading indicator while fetching.

25. **Skeleton loading cards instead of spinner**
    Replace the full-screen loading spinner with per-card skeleton placeholders (grey shimmer boxes in the shape of `JournalCard`, `DiscoverCard`, etc.). Improves perceived performance and feels more native.

26. **Haptic feedback on key interactions**
    Add subtle haptics (light impact) on: starring a story, witnessing a chapter, sending a message, and completing a constellation node. Use `expo-haptics` which is already available in the SDK.

27. **Keyboard-avoiding layout in all modals**
    Some creation modals (`create-journal-entry.tsx`, `create-outfit.tsx`) still scroll behind the keyboard on certain Android devices. Audit and wrap all text-input modals with `KeyboardAvoidingView` + `react-native-keyboard-controller`.

28. **Dark mode support end-to-end**
    `ThemeContext` already tracks Light/Dark/Auto preference but several screens (notably `campfire/[roomId].tsx` and `messages/[userId].tsx`) use hardcoded `#FDFAF7` backgrounds that ignore the theme. Audit all screens and wire them through `useColors()`.

29. **Notification permission prompt at the right moment**
    Push token registration is skipped in Expo Go. In a production build, the permission prompt fires on first launch before the user understands the value. Move the permission request to the first time the user receives a campfire invitation or DM, so the ask is contextual.

30. **Onboarding flow — interactive tutorial for first-time users**
    `OnboardingOverlay.tsx` exists but its trigger logic is unclear. Design a 3-step tooltip tour (Journal → Create → Discover) that fires only on the user's very first sign-in and can be replayed from Profile settings.

---

## ⚙️ Infrastructure & Technical Debt

31. **Complete migration from local disk image storage to GCS**
    `app.ts` serves old images from local disk as a fallback during a GCS migration. This means images are lost on server restart in non-persistent environments. Backfill existing local images to GCS and remove the disk fallback route.

32. **Multi-instance SSE via Redis Pub/Sub**
    `sseEmitter.ts` is an in-process broadcaster. If the API server ever scales to more than one instance, DM and campfire SSE events will only reach users connected to the same instance. Replace the in-memory emitter with a Redis Pub/Sub channel so all instances fan out correctly.

33. **Add rate limiting to the upload endpoint**
    `POST /api/upload` accepts base64 payloads up to 50 MB with no per-user rate limit. A malicious user could spam uploads to exhaust disk/GCS quota. Add a per-user 10-uploads/minute rate limit using the existing Express middleware pattern.

34. **Paginate the journal, stories, and discover feeds**
    All list endpoints return every row for the user with no pagination. As power users accumulate hundreds of entries, these queries will slow down and the app will churn through memory deserialising large arrays. Add `limit` + `cursor` query params and infinite-scroll on the client.

35. **Cover the API server routes with integration tests**
    The mapper unit tests (Task #64) cover client-side logic. The API server has zero automated tests. Add an integration test suite (using `supertest` + a test DB) for at minimum: auth middleware, character CRUD, journal CRUD, and the discover scoring algorithm.

36. **Fix push notifications in production builds**
    `app/_layout.tsx` explicitly skips `expo-notifications` token registration in Expo Go. Wire up the full registration flow for production builds (EAS Build) so campfire mentions and DM notifications actually reach users' devices.

---

## 🛡️ Admin & Moderation

37. **Content moderation queue — surfaced in the admin panel**
    Reports submitted via `ReportSheet.tsx` go to the DB but the admin panel (`artifacts/admin`) has no report review UI. Build a "Reports" page listing open reports with one-click hide/unhide actions.

38. **Admin server health dashboard**
    Show live metrics in the admin panel: SSE subscriber count (from `sseEmitter`), discover cache size and hit/miss ratio (from `cache.ts`), DB row counts per table, and server uptime. No new backend infrastructure needed — expose a `GET /api/admin/health/stats` endpoint.

39. **Automated ban on repeated reports**
    If a user accumulates 5+ unresolved reports in 30 days, auto-flag the account and email the admin (or create a high-priority item in the moderation queue). Prevents bad actors from slipping through if the admin panel isn't checked daily.
