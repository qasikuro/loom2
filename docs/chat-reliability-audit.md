# Chat reliability audit

## Scope

Existing Expo chat, Express API, PostgreSQL, image handling, and SSE retained.
No UI redesign, calling features, new service, or dependency added. No production
publication or OTA was performed.

## Findings and changes

- Recent messages previously survived only in memory. Native history now uses
  existing encrypted SecureStore storage, with account/conversation isolation,
  atomic revisioned writes, bounded recent history (50 messages across eight
  recent conversations), and logout/chat-deletion invalidation.
- The native outbox persists separately from history eviction. A send is queued
  securely before transmission, and retains its client UUID through retries,
  restarts, and ambiguous HTTP failures. An unavailable keychain is not treated
  as an empty outbox.
- The screen uses available memory history immediately, hydrates device history
  asynchronously, and fetches the latest 50 messages in the background. A late
  device snapshot cannot replace an authoritative server response. Older
  history continues using the existing timestamp/UUID keyset pagination.
- The API now atomically deduplicates sends using the existing message UUID
  primary key. Matching replays return the original row; conflicting payloads
  are rejected. Deleted/hidden rows cannot be resurrected by a retry.
- Transient failures use bounded backoff, rate-limit guidance, and a POST
  timeout. Definitive permission/validation failures are held for explicit
  retry. Unblocking does not automatically send previously rejected messages.
- Message merges preserve existing row references and pending rows without
  duplicating confirmed sends. Conversation/account changes remount the
  conversation boundary rather than briefly displaying the prior thread.
- Inline photo footprints no longer change after decoding. Ready photos are
  not forcibly reloaded on every foreground transition. Historical sticker
  rows no longer replay entrance animations when virtualization remounts them.
- Sender-only deletion no longer tells the recipient's live UI to remove its
  retained copy. Repeating delete-for-me cannot reverse delete-for-everyone.
  Failed delete operations now report failure instead of silently disappearing.

## Principal files changed

- `artifacts/sky-journal/app/messages/[userId].tsx`
- `artifacts/sky-journal/utils/dmConversationCache.ts`
- `artifacts/sky-journal/utils/chatMessageHistory.ts`
- `artifacts/sky-journal/utils/dmRetryPolicy.ts`
- `artifacts/sky-journal/components/ChatPhoto.tsx`
- `artifacts/api-server/src/routes/messages.ts`
- `lib/api-spec/openapi.yaml` and regenerated API client/Zod outputs
- `artifacts/api-server/src/tests/messages-idempotency.test.ts`
- `artifacts/sky-journal/utils/__tests__/dmConversationCache.test.ts`
- `artifacts/sky-journal/utils/__tests__/dmConversationPersistence.test.ts`
- `artifacts/sky-journal/utils/__tests__/chatMessageHistory.test.ts`
- `artifacts/sky-journal/utils/__tests__/dmRetryPolicy.test.ts`

No database schema migration or new index was added. Existing bounded message
queries, directional conversation indexes, UUID primary key, and per-user
visibility fields were reused; the audit did not justify rebuilding these.

## Verification

- **20 API tests passed** across idempotency, photo access, and drawer/privacy
  suites. Temporary development database fixtures exercise separate participant
  identities; this is not a test of real Clerk login sessions or native UI.
- **25 mobile utility tests passed**, including simulated process restart,
  Unicode/chunk persistence, interrupted writes, unavailable keychain, account
  isolation, logout races, stale hydration, message merge integrity, and retry
  classification. SecureStore is mocked: these tests do not prove physical
  Keychain/Keystore behavior.
- API/shared-library type checks and a focused type check of the changed cache,
  history, and retry utilities passed.
- A full mobile check took several minutes and reported an expression-enum
  mismatch, which was corrected. The final full mobile check has **not** been
  rerun to completion. The diagnostic workload also delayed a workflow build;
  it was stopped and API/Expo workflows were restored.
- A local API fixture of 200 messages returned four non-overlapping 50-message
  pages in **32.5, 7.8, 7.0, and 6.3 ms**. These are local test HTTP timings,
  not production latency, phone timings, or a before/after speed comparison.
- An earlier broader API suite had five failing assertions in campaign audience
  counts and Discover media-URL expectations. Those unrelated areas were not
  changed; the complete repository suite is not claimed green.
- Screenshot attempts captured the startup overlay rather than authenticated
  chat. They do not establish chat UI correctness or native scroll performance.

## Remaining verification and rollout

Physical Android verification is still required for cold restart, actual
tap-to-first-message and synchronization timing, airplane-mode recovery,
response-lost retries, photo scrolling, frame drops, and two-account
blocking/deletion behavior. No “instant” or Telegram-level performance claim
has been established.

Publish the API idempotency implementation **before** releasing the mobile
automatic-retry changes. An older API that ignores client message IDs cannot
guarantee duplicate-free retries. Browser preview uses memory only and is not
evidence of native persistent history.
