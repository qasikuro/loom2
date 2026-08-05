---
name: Mutation queue stale full-character snapshots
description: The mutation queue stores full character bodies. A queued mutation from a session where only mood/bio changed (name="Sky Child") replays on foreground and silently overwrites a newer DB value, reverting the name.
---

## The Rule
Always call `clearMutation('/character', 'PUT')` after a successful `setCharacter` PUT so the drain can never replay a stale full-character snapshot.

**Why:** The queue stores the ENTIRE character body at the time of the failed PUT, not just the changed field. If the user changed mood in session A (name was "Sky Child"), the PUT failed, and the mutation was queued with `{name: "Sky Child", mood: "NewMood"}`, then in session B the user successfully changed their name to "MyName" (direct PUT → 200), but the OLD queued mutation with `{name: "Sky Child"}` was still in the queue. On next foreground event, `drainMutationQueue` replayed it and wrote "Sky Child" back to DB — **even though the direct PUT had already succeeded**.

**How to apply:**
1. After any successful PUT for character (or any other full-body idempotent resource), call `clearMutation(url, method)` to evict the stale snapshot.
2. When a queue key version bump is needed to evict entries for all existing users, change `QUEUE_KEY` (e.g. `pending_mutations_v2`).
3. The dedup-by-URL+method logic only protects within the same session. Cross-session stale entries must be cleared by `clearMutation` on success.

## Diagnosis tip
`DB.updatedAt` changes but the name field doesn't → a drain is replaying a mutation body that already had that name. Check AsyncStorage key `pending_mutations_v*` to inspect what's in the queue.
