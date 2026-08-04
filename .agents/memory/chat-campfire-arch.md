---
name: Chat & Campfire architecture
description: Key patterns and constraints for the DM + Campfire messaging system added during the chat roadmap implementation.
---

## Message soft-delete
- `messages` table has `deleted_at TIMESTAMPTZ` + `deleted_for TEXT ('sender' | 'both')` added via startup migration
- Drizzle schema at `lib/db/src/schema/messages.ts` includes both columns
- GET endpoints filter with `isNull(messagesTable.deletedAt)` PLUS allow `deleted_for='sender'` rows to remain visible to the recipient
- DELETE endpoint: soft-deletes and emits SSE `message_deleted` to both `messages:fromUserId` and `messages:toUserId`

## Blocks
- `blocks` table (id, blocker_id, blocked_id, created_at, UNIQUE(blocker_id, blocked_id)) via startup migration
- Drizzle schema at `lib/db/src/schema/blocks.ts`
- `isBlocked(userA, userB)` helper exported from `artifacts/api-server/src/routes/blocks.ts` — checks both directions
- Block check runs in `POST /messages/:userId` before inserting; returns 403

## Rate limiting
- In-memory sliding window at `artifacts/api-server/src/middleware/messageLimiter.ts`
- 20 messages / 60s per (userId × channelId) key
- Shared by DM send (`POST /messages/:userId`) and campfire send (`POST /campfire/:roomId/messages`)
- Returns 429 with `Retry-After` header; mobile side currently drops the message silently (no user feedback)

## Campfire presence
- `GET /campfire/:roomId/presence` returns users who sent a message within the last 5 min, joined with character info
- Uses manual dedup loop (not DISTINCT) for Drizzle compatibility; result is userId-deduped list
- Mobile: soul count area is a `TouchableOpacity` → opens `Modal` that fetches presence on open

## Campfire reports
- Reuses existing `reportsTable` with `targetType: 'campfire_message'`
- `POST /campfire/:roomId/messages/:messageId/report` — inserts report with provided reason
- Admin panel does not yet have a view for campfire reports (only story/outfit/user types were in admin UI)

## @mention notifications
- Campfire POST parses `@username` patterns, looks up userId by `LOWER(username)`, sends push notification
- Capped at 5 mentions per message to prevent spam
- Push uses `sendPushNotification` from pushService, data type `campfire_mention`

## SSE gap-fill pattern
- Both DM screen and campfire room track `prevSseRef` to detect SSE reconnect (false→true transition)
- On reconnect: call `load()` / `fetchData(true)` to fill the gap
- DM screen also handles `message_deleted` and `typing` SSE event types

## Typing indicator
- Debounced 600ms POST to `POST /messages/:userId/typing` (no DB write, pure SSE fan-out)
- Server emits `typing` event to recipient's `messages:${toUserId}` SSE channel
- Mobile shows `•••` bubble for 4s, auto-clears via `typingClearRef` timeout

**Why:** All constraints derive from the pattern of using startup migrations (not drizzle-kit push) for schema changes.
