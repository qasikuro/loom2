---
name: Nested story image URI normalization
description: Prevents device-only broken images when story readers prefer nested page panel data.
---

Resolve image URIs in every nested story page panel, not only in the top-level panel array.

**Why:** Story readers prefer page-based panel data when pages exist. Relative image paths left inside nested pages work poorly or fail on native devices even when the duplicate top-level panel URI was normalized correctly.

**How to apply:** Whenever story or Discover response mapping changes, normalize both top-level panels and every pages[].panels[] image URI with the same runtime API base, and keep a mapper regression test for relative image paths.