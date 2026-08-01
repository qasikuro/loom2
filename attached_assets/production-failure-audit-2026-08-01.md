# GameJo — Production Failure Audit
**Date:** August 1, 2026  
**Scope:** What breaks when 10,000 users install the app tomorrow  
**Method:** Static code analysis — every finding is verified against source with file and line references  
**Companion:** See also *GameJo UX Audit (August 1, 2026)* for user-experience issues  

---

## Executive Summary

The UX audit covered *frustration*. This audit covers *breakage*.

The two biggest risks before a real user surge are:

1. **The backend has no per-endpoint rate limiting on its three most expensive operations** — image upload, story creation, and the "ping friends" push notification fan-out. A single motivated user can saturate the server or spam thousands of followers with no throttle in place.

2. **Profile, outfit, and character saves are permanently lost after one failed network retry.** The app silently reports success while the server never received the data. Users will see their customisation "saved" on one device and missing on every other.

Everything below is verified against the codebase. Unverified speculation is excluded.

---

## 🔴 Critical — Can crash the server, corrupt data, or permanently lose user content

---

### C-1 · No rate limit on push-notification fan-out
**File:** `artifacts/api-server/src/routes/notifications.ts:61–118`  
**What happens:** `POST /notify/ping-friends` sends a push notification to every follower of the calling user. It has no cooldown, no idempotency key, and no rate limit beyond the global 500-requests-per-15-minutes ceiling that applies to the entire API. A user with 500 followers can call this endpoint 500 times in 15 minutes and deliver 250,000 push notifications — enough to get the Expo push service to block the project's sender token. There is no deduplication check.  
**At scale:** Coordinated or accidental spam takes down push delivery for every user.  
**Fix:** Add a per-user cooldown (e.g. once per 30 minutes) stored in Redis or as a DB timestamp. Deduplicate with an idempotency key.

---

### C-2 · 50 MB JSON body limit enables memory-exhaustion DoS
**File:** `artifacts/api-server/src/app.ts:97–98`  
**What happens:** The Express JSON body parser is configured to accept payloads up to 50 MB. Node.js buffers the entire body in memory before parsing. Sending 20 concurrent 50 MB requests consumes 1 GB of heap before a single byte is processed.  
**At scale:** Five concurrent malicious (or just careless) clients can crash the server process.  
**Fix:** Set the JSON body limit to 1 MB (or 10 MB at most for media-heavy endpoints). Use streaming multipart for file uploads instead of base64 JSON.

---

### C-3 · Story milestone rewards have no transaction — partial grants are permanent
**File:** `artifacts/api-server/src/routes/stories.ts:373–431`  
**What happens:** When a story hits a witness milestone, the server executes these steps sequentially with no database transaction: (1) grant XP reward, (2) update story record, (3) update character traits, (4) insert purchase record, (5) send notification. If any step fails mid-sequence, the steps before it are committed and the steps after are not. A user can receive XP without the story being marked as claimed, or receive a cosmetic without the XP counter updating.  
**At scale:** At volume, network blips and DB timeouts happen constantly. Every partial failure creates an inconsistent reward state that cannot be automatically reconciled.  
**Fix:** Wrap the entire milestone processing block in a single database transaction using Drizzle's `db.transaction()`.

---

### C-4 · No rate limit on image upload — CPU and storage exhaustion
**File:** `artifacts/api-server/src/routes/upload.ts:100–134`  
**What happens:** `POST /api/upload` accepts a base64 image, decodes it, runs it through Sharp (CPU-intensive compression), and streams the result to object storage. The only limit is the global 500 req/15 min rate limit shared with every other endpoint. A single user submitting back-to-back image uploads can saturate one CPU core and fill storage quotas.  
**At scale:** Image uploads are the most expensive operation in the system. Without a dedicated limit they will crowd out all other traffic under load.  
**Fix:** Add a per-user rate limit of ~10 uploads per minute specifically on the upload route. Validate that the payload is an actual image (magic bytes check — see C-5) before touching Sharp.

---

### C-5 · Images are passed to Sharp without type validation
**File:** `artifacts/api-server/src/routes/upload.ts:131`  
**What happens:** The upload route decodes the incoming base64 string into a Buffer and passes it directly to Sharp for compression without first checking that it is actually an image. Sharp will throw on non-image input, but arbitrary binary data (including files that exploit Sharp's underlying libvips) can be submitted.  
**At scale:** Sharp crashes on malformed input propagate as unhandled promise rejections. Malicious payloads targeting libvips vulnerabilities are a known attack surface.  
**Fix:** Check the first 12 bytes of the buffer against known image magic bytes (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `52 49 46 46`) before calling Sharp. Reject anything that doesn't match.

---

### C-6 · Local `file://` URIs can reach the database as image URLs
**Files:** `artifacts/sky-journal/app/panel-editor.tsx:367–403`, `artifacts/sky-journal/app/create-journal-entry.tsx:237`, `artifacts/sky-journal/context/AppContext.tsx:1344, 1513`  
**What happens:** Three separate upload paths can persist a local device `file://` URI to the server database instead of a server-hosted URL:

- **Panel editor:** Optimistic preview uses local URIs. If the upload hasn't finished and the user saves, `DraftStore` captures the local URI and it flows through to `addStory`.
- **Journal editor:** `handleSave` does not block if a concurrent `persistImageUri` is still in flight when the user taps Save.
- **AppContext:** `addJournalEntry` and `addOutfit` write the provided `imageUri` directly to AsyncStorage and the API without confirming it is a server URL.

**At scale:** Every other user who views that story, journal entry, or outfit sees a broken image. The broken URI is permanently stored in the database.  
**Fix:** In `addStory`, `addJournalEntry`, and `addOutfit`, reject any `imageUri` that starts with `file://`. Block Save in all editors until all uploads have resolved.

---

## 🟠 High — Silent data loss or significant reliability gap

---

### H-1 · Profile, outfit, and character changes are permanently lost after one retry
**File:** `artifacts/sky-journal/context/AppContext.tsx:1226 (setCharacter), 1532 (addOutfit), 1545 (updateOutfit), 1566 (deleteOutfit), 1606 (setActiveCosmetic), 1624 (setActiveOutfitId)`  
**What happens:** These mutations update local state and AsyncStorage immediately, then attempt a server sync. On failure they show one toast and attempt exactly one retry. If the retry also fails (user is on a slow connection, server is under load, they backgrounded the app), the change is never re-queued. The local UI shows the data as saved. The server never has it. On the next device or after a reinstall, all changes are gone.  
**At scale:** Mobile network conditions guarantee this scenario happens regularly. Profile customisation is a core retention mechanic — silent loss is a trust-destroying bug.

---

### H-2 · Witness/save count can be double-incremented
**File:** `artifacts/api-server/src/routes/stories.ts:349–360`  
**What happens:** `POST /stories/:id/witness` increments `witnessedCount` on the story row. The increment is a raw `UPDATE stories SET witnessedCount = witnessedCount + 1`. There is no check for whether this user has already witnessed this story in this session. Rapid double-taps, network retries from the client, or a user re-entering the story reader all trigger a fresh increment.  
**At scale:** Story witness counts and the milestone rewards attached to them become inflated and meaningless.

---

### H-3 · Journals and outfits show success locally when the server never received them
**File:** `artifacts/sky-journal/context/AppContext.tsx:1341 (addJournalEntry), 1509 (addOutfit)`  
**What happens:** Both functions update local state and AsyncStorage before the API call. If the API fails, they log a warning toast but **do not revert the local state**. The journal entry or outfit appears to exist on the device. It does not exist on the server. `addStory` (line 1402) has a correct rollback — these two do not.  
**Contrast:** Confirmed working: `addStory` reverts correctly on failure (line 1441).

---

### H-4 · Image uploads have no timeout — editors can be permanently locked
**File:** `artifacts/sky-journal/utils/persistImage.ts`  
**What happens:** Both `uploadNative` (using `FileSystem.uploadAsync`) and `uploadWeb` (using `fetch`) have no timeout configured. On a stalled or dropped connection, the upload request hangs indefinitely. In the panel editor this keeps `uploadingSet.size > 0`, permanently disabling the Save button. The user is soft-locked in the editor with no way to proceed or cancel.  
**Fix:** Add a 30-second `AbortController` timeout to both upload paths. On timeout, clear the uploading state and show a retry option.

---

## 🟡 Medium — Degrades reliability or correctness under normal load

---

### M-1 · N+1 push notification delivery in ping-friends
**File:** `artifacts/api-server/src/routes/notifications.ts:95–111`  
**What happens:** The loop inside `ping-friends` calls the Expo push API once per follower in a `for` loop rather than batching. Expo's push API accepts up to 100 tokens per request. A user with 1,000 followers triggers 1,000 individual HTTP requests to Expo from a single handler call.  
**Fix:** Batch follower tokens into groups of 100 and send one request per batch.

---

### M-2 · User search causes full table scans
**File:** `artifacts/api-server/src/routes/social.ts:41–48`  
**What happens:** The People search uses `ilike(characterTable.name, '%${q}%')`. A leading wildcard (`%q%`) cannot use a standard B-tree index and forces a sequential scan of the entire `character` table on every keystroke.  
**At scale:** Response time grows linearly with user count. At 10,000 users, search is noticeably slow. At 100,000 it becomes unusable.  
**Fix:** Add a `pg_trgm` GIN index on `character.name` and `character.username`. Switch to `%` trigram matching.

---

### M-3 · Non-atomic cosmetic toggle can overwrite concurrent changes
**File:** `artifacts/sky-journal/context/AppContext.tsx:1593–1615 (setActiveCosmetic)`  
**What happens:** `setActiveCosmetic` reads the current `activeCosmetics` object, modifies one key, then writes the entire object back to AsyncStorage and to the server. If the user toggles two different cosmetics within the same React render cycle (or across two devices), the second write overwrites the first, silently dropping one of the changes.

---

### M-4 · `setCharacter` and `updateStory` don't invalidate their TTL cache
**File:** `artifacts/sky-journal/context/AppContext.tsx:1201 (setCharacter), 1469 (updateStory)`  
**What happens:** After saving a character edit or story update, the app does not reset the fetch timestamp for `character` or `stories`. `softLoadData` respects the 5-minute TTL and will not re-fetch. If the user opens the app on a second device within the TTL window, they see the old version and any edit they make on that device overwrites the new version.

---

### M-5 · AsyncStorage large-object writes have no atomic safety net
**File:** `artifacts/sky-journal/context/AppContext.tsx:1058, 1424, 1447, 1472`  
**What happens:** The entire stories array or journal array is serialised to a single AsyncStorage key (`stories_v1`, `journal_v2`) as one large JSON string. AsyncStorage's `setItem` is not atomic — if the app is killed mid-write, the key contains truncated JSON. The read path has corruption guards (`isValidStoryRecord`) but these only drop the corrupted entry silently; the user loses that content permanently.  
**At scale:** As history grows, these strings get larger and the write window grows, increasing the probability of a partial write on low-memory devices.

---

### M-6 · `/events/active` fetched on every Home tab mount
**File:** `artifacts/sky-journal/app/(tabs)/index.tsx:1133–1140`  
**What happens:** The Home tab fetches `/events/active` every time it mounts, with no TTL or deduplication. Switching from Home → Discover → Home triggers two fetches for data that changes at most once a week.  
**At scale:** With 10,000 active users, this endpoint receives ~5× more traffic than its data freshness requires.

---

### M-7 · Story save/unsave count can desync
**File:** `artifacts/api-server/src/routes/stories.ts:601–617`  
**What happens:** `DELETE /stories/:id/save` runs two operations via `Promise.all`: decrement `savedCount` on the stories row and delete the record from `storySavesTable`. If one succeeds and the other fails, the count and the actual save records diverge permanently (a user has no save record but the count was decremented, or vice versa). This is not wrapped in a transaction.

---

### M-8 · SSE message polling runs alongside active SSE connection
**File:** `artifacts/sky-journal/app/messages/[userId].tsx:251–290, 321–325`  
**What happens:** The DM screen establishes an SSE connection for real-time messages *and* also polls the messages endpoint every 30 seconds. Both run simultaneously. When both return at the same time, the UI may briefly show the list in two different states, causing a visible flicker.

---

## 🔵 Low — Edge case or minor exposure

---

### L-1 · Username endpoint enables account enumeration
**File:** `artifacts/api-server/src/routes/character.ts:146–166`  
**What happens:** `GET /users/check-username` returns whether a username is taken. It has no rate limit. An attacker can enumerate all real usernames by scripting sequential requests.

---

### L-2 · SSE buffer can grow unbounded on malformed server data
**File:** `artifacts/sky-journal/hooks/useSSE.ts` (stream loop)  
**What happens:** The SSE parser accumulates unparsed bytes in a `buf` string. If the server sends a burst of malformed (non-JSON) data, the buffer grows without bound until the connection resets. On the Hermes JS engine used by React Native, large string accumulations are not GC'd quickly.

---

### L-3 · Orphaned files accumulate on object storage
**File:** `artifacts/api-server/src/routes/upload.ts:91`  
**What happens:** Files are written to object storage the moment the upload route processes them. If the subsequent story or outfit creation call fails (crash, network drop), the uploaded file has no database reference and is never cleaned up. There is no periodic purge job.

---

### L-4 · Scroll-to-end timeout in campfire has no cleanup
**File:** `artifacts/sky-journal/app/campfire/[roomId].tsx:409, 447, 467`  
**What happens:** A `setTimeout` for `scrollToEnd` (80ms) is called on incoming messages with no cleanup in the effect return. If the user navigates away in the 80ms window, the callback attempts to call `scrollToEnd` on an unmounted ref, causing a no-op warning on Android and a potential crash on older Hermes versions.

---

## Summary Table

| ID | Severity | Area | Finding |
|---|---|---|---|
| C-1 | 🔴 Critical | Backend | Push notification fan-out has no rate limit or cooldown |
| C-2 | 🔴 Critical | Backend | 50 MB JSON body limit enables memory exhaustion DoS |
| C-3 | 🔴 Critical | Backend | Story milestone rewards have no DB transaction |
| C-4 | 🔴 Critical | Backend | Image upload has no dedicated rate limit |
| C-5 | 🔴 Critical | Backend | Images passed to Sharp without type validation |
| C-6 | 🔴 Critical | Mobile | Local `file://` URIs can be stored in the database as image URLs |
| H-1 | 🟠 High | Mobile | Profile/outfit/character saves permanently lost after one retry |
| H-2 | 🟠 High | Backend | Witness count can be double-incremented |
| H-3 | 🟠 High | Mobile | Journal and outfit creation shows success when server never received data |
| H-4 | 🟠 High | Mobile | Image uploads have no timeout — editors can be permanently locked |
| M-1 | 🟡 Medium | Backend | N+1 HTTP calls in push notification fan-out loop |
| M-2 | 🟡 Medium | Backend | User search causes full table scans (missing pg_trgm index) |
| M-3 | 🟡 Medium | Mobile | Cosmetic toggle is non-atomic — concurrent changes silently overwrite |
| M-4 | 🟡 Medium | Mobile | setCharacter and updateStory don't invalidate TTL cache |
| M-5 | 🟡 Medium | Mobile | Large AsyncStorage writes have no atomic safety |
| M-6 | 🟡 Medium | Mobile | /events/active fetched on every Home tab mount with no TTL |
| M-7 | 🟡 Medium | Backend | Story save count and save records can desync |
| M-8 | 🟡 Medium | Mobile | DM polling runs alongside active SSE connection |
| L-1 | 🔵 Low | Backend | Username endpoint enables account enumeration |
| L-2 | 🔵 Low | Mobile | SSE buffer can grow unbounded on malformed server data |
| L-3 | 🔵 Low | Backend | Orphaned files accumulate on object storage after failed uploads |
| L-4 | 🔵 Low | Mobile | Campfire scroll timeout has no cleanup |

---

## Recommended Fix Order

**Before any public launch:**
1. C-1 — Rate limit `/notify/ping-friends` (one afternoon of work)
2. C-2 — Reduce JSON body limit to 1 MB (one line change)
3. C-4 — Add per-user rate limit on image upload (one afternoon)
4. C-5 — Add magic-byte validation before Sharp (30 minutes)
5. C-6 — Block `file://` URIs from reaching the database (half day)
6. C-3 — Wrap story milestone processing in a DB transaction (half day)

**Before first marketing push:**
7. H-1 — Persistent offline mutation queue for profile/outfit saves
8. H-2 — Deduplicate witness increments per user per story
9. H-3 — Roll back journal and outfit local state on API failure
10. H-4 — Add upload timeout with cancel + retry UI

**Before scale (1,000+ DAU):**
11. M-1 — Batch Expo push notification calls
12. M-2 — Add pg_trgm index on character name/username
13. M-3, M-4 — Fix cosmetic atomicity and TTL invalidation

---

*This audit covers what the codebase contains as of August 1, 2026. Infrastructure-level concerns (database connection pooling, deployment redundancy, CDN configuration) are outside the scope of this static analysis.*
