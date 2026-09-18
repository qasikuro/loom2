---
name: Audius story music
description: Durable integration choices for story soundtrack search, persistence, and playback
---

Story soundtracks use Audius' public discovery-provider API through the authenticated API server. The client does not need an Audius credential; it receives normalized metadata and a stable stream endpoint whose redirect is resolved when playback starts.

**Why:** Keeping provider access server-side avoids mobile CORS/provider coupling, while storing stable track metadata avoids persisting short-lived signed redirect URLs.

**How to apply:** Preserve the story `music` object through create, update, story mapping, Discover mapping, and reader playback. Keep preview ownership centralized when rendering multiple track rows so only one track can play at a time.