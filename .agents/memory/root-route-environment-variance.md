---
name: Root route differs across environments
description: Why host-based root routing needs checks against both the workspace preview and the published site.
---

The development preview's root request has reached the Expo artifact, while the previously published site's root has served the API artifact's landing page. Do not assume one handler covers both.

**Why:** Published artifact routing may reflect a different build or artifact set than the current development proxy. A root redirect tested in one environment can miss the other, and publishing may change which artifact serves the main domain.

**How to apply:** For custom-domain root changes, probe development and the existing published domain separately, preserve the normal-domain behavior in whichever root handlers may receive traffic, and verify the live routes again after publishing and DNS activation.