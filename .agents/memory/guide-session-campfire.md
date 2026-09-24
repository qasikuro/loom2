---
name: Guide sessions use Campfire rooms
description: Architecture decision for scheduled guide sessions and their shared live chat
---

Each scheduled guide session owns one Campfire room; attendees join the session record and enter that same room when it starts. Do not build a separate group-chat implementation for guide sessions.

**Why:** Campfire already provides shared real-time messaging, SSE reconnect handling, presence, moderation, and mention notifications. Reusing it keeps session chat behavior consistent and avoids parallel messaging systems.

**How to apply:** Store scheduling, attendance, capacity, and reminder state in guide-session records, while using the associated Campfire room ID for start-time notification deep links and live conversation.