---
name: Media privacy boundary
description: Ownership, live publicity, native read capabilities, and route-alias consistency for uploaded media.
---

Uploaded originals remain private storage objects. App-level anonymous access is derived from an exact owner-linked, currently eligible public reference, not from a permanent “was published” flag. Journals and galleries never establish publicity.

**Why:** The same original can be used in both private and deliberately public content; a visibility change must stop subsequent anonymous reads without rewriting every stored reference.

**How to apply:** Check authoritative ownership and current parent/profile visibility before serving bytes, ranges, HEAD responses, conditional responses, or disk fallback. Do not cache publicity decisions across requests.

Native media uses short-lived owner/asset-bound read capabilities because image and video loaders do not reliably send the app’s Bearer headers. Never put Clerk session tokens in media URLs, persist temporary read capabilities as content references, or reuse capability caches across accounts.

**Why:** Protecting a route with Bearer authentication alone breaks native private media; treating a transferable read capability as permanent content can expose it through public serializers.

**How to apply:** Keep persisted references canonical, renew owner capabilities through authenticated requests, isolate caches and in-flight work by account, and enforce live ownership at read time.

Ownership validation must recognize or reject every alias that the serving router accepts, including encoded filenames, case-insensitive route prefixes, and trailing slashes.

**Why:** A classifier that ignores an alias can skip ownership validation while the router still serves its canonical asset, allowing a foreign capability to be stored unchanged.

**How to apply:** Test normalization against actual routing behavior, not only string examples. Explicitly reject ambiguous managed-looking paths rather than treating them as external media.

Story and outfit music streams do not accept uploaded image/video media references.

**Why:** The current music feature selects external Audius streams. Accepting uploaded-media URLs there would allow a private read capability to be persisted and exposed through a public music object.

**How to apply:** If uploaded audio becomes a supported feature, add its ownership, publicity, and playback-renewal rules before relaxing this boundary; do not merely remove the input guard.