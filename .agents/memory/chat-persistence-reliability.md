---
name: Native chat persistence and retry safety
description: Privacy and rollout rules for persistent conversation history and reliable queued sends.
---

Keep persistent private chat text and queued sends in encrypted native device storage, isolated by both signed-in account and conversation. Clear both at logout/account deletion and clear that conversation's queue when its chat is deleted. Browser preview memory behavior is not evidence of native restart persistence.

**Why:** The user requested that chats survive app restarts without weakening account privacy or introducing another storage service. Plaintext general-purpose local storage is not appropriate for private message history.

**How to apply:** Preserve immediate memory rendering and background native hydration; never replace an authoritative fresh response with a late disk snapshot. Test process restarts, interrupted storage writes, and account changes separately from browser rendering.

Every retry of one outgoing message must reuse its original client identity, and the database must arbitrate that identity atomically. Deleted/hidden messages must not be resurrected by a delayed replay.

**Why:** A lost HTTP response does not mean the server failed to commit the message. Retrying with a new identity can duplicate delivery.

**How to apply:** Publish server-side idempotency support before distributing mobile automatic-retry changes. An older server that ignores the client identity cannot guarantee duplicate-free retries. Hold permission/validation failures for an explicit user action; unblocking must not automatically send previously rejected drafts.
