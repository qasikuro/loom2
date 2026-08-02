# Proposed Tasks — 2026-08-02

46 tasks in PROPOSED state as of today.

| # | Ref | Title |
|---|-----|-------|
| 1 | #21 | Show a seasonal countdown so players know when the current season ends |
| 2 | #22 | Give the admin panel visibility into which seasonal items are live right now |
| 3 | #23 | Let admins add or edit seasonal items without redeploying the server |
| 4 | #26 | Show earned titles on other players' profiles in the Discover feed |
| 5 | #27 | Let users preview what each title means before choosing it |
| 6 | #32 | Ease in the progress bars more smoothly when returning to the profile tab |
| 7 | #33 | Stagger the progress bar rows so each one enters slightly after the last |
| 8 | #60 | Split the About section into a more manageable size |
| 9 | #61 | Keep journal and story cards consistent when switching themes |
| 10 | #65 | Show who else is in a campfire room right now |
| 11 | #66 | Keep SSE working when the app wakes up after being in the background |
| 12 | #67 | Add a live 'unread' badge to the Messages tab when a new message arrives via SSE |
| 13 | #70 | Validate the guides endpoint so guide data can't silently break the app |
| 14 | #71 | Show a clear error message when story or journal data looks corrupted |
| 15 | #72 | Fix the TypeScript notification type mismatch in the app layout |
| 16 | #73 | Reset staleness timestamps when the user saves or deletes their own content |
| 17 | #74 | Show a subtle 'Refreshing…' indicator when stale data is being quietly updated |
| 18 | #75 | Cover the data-loading error paths so corrupted API responses don't silently disappear |
| 19 | #76 | Add tests for the discover feed and follow/unfollow flows |
| 20 | #77 | Prevent image upload failures from showing a blank error to the user |
| 21 | #96 | Show connection status when the app has no internet |
| 22 | #97 | Retry failed story panel images from a tap on the panel itself |
| 23 | #98 | Prevent stale data from flashing when switching between tabs quickly |
| 24 | #99 | Show constellation type on profiles and let users update it |
| 25 | #100 | Offer a gentle re-onboarding when users clear the app or log in on a new device |
| 26 | #109 | Let readers skip forward to a specific panel without scrolling through the whole story |
| 27 | #110 | Show a preview of the pull quote on the story creation screen so authors can see what readers will see |
| 28 | #111 | Let the event banner auto-dismiss when the event ends — without a restart |
| 29 | #112 | Surface the active event inside the story reader — so readers know which event a story was made for |
| 30 | #113 | Prevent the event prompt from being lost if the user hits 'back' mid-story creation |
| 31 | #114 | Prevent the Resonate button from double-firing if tapped rapidly |
| 32 | #115 | Let creators see how their resonated story led someone to them (Resonate analytics) |
| 33 | #116 | Make sure the existing API test suite doesn't fail silently due to missing database columns |
| 34 | #117 | Catch banned-user stories that could slip into the Discover feed |
| 35 | #141 | Clear the bell dot only after the user actually sees their notifications, not before |
| 36 | #156 | Remove the APK diagnostic logging once Google Sign-In is confirmed fixed |
| 37 | #157 | Confirm a second Google Sign-In on the same device loads fresh data correctly |
| 38 | #164 | Confirm the profile page still loads correctly when all three fetches succeed |
| 39 | #165 | Show level and XP on the Discover feed profile previews, not just full profiles |
| 40 | #166 | Prevent a stale profile from being cached after a user deletes their account |
| 41 | #175 | Confirm the discard guard holds when the user swipes to dismiss a modal journal entry |
| 42 | #176 | Extend discard-guard coverage to the story editor and vibe-post publish flow |
| 43 | #182 | Cover the add-journal-entry and add-outfit rollbacks so failed saves don't leave ghost content |
| 44 | #183 | Confirm the story cache never saves local file:// image URIs after a delete-and-retry cycle |
| 45 | #184 | Make sure concurrent deletes on the same item don't double-restore it |
| 46 | #189 | Confirm draft and prompt don't conflict when returning to a half-finished entry |
