---
name: Root route differs across environments
description: Why host-based root routing needs checks against both the workspace preview and the published site.
---

The workspace preview and published custom domain can route `/` to different artifacts. Root traffic may reach the Expo server or the API server, so do not assume one handler covers every deployment. In this project, Ximo keeps the default Expo root and Storigam must be selected only for the exact `www.storigam.com` host; Expo platform-manifest requests must retain priority.

**Why:** Published artifact routing may reflect a different build or artifact set than the current development proxy. A root redirect tested in one environment can miss the other, and publishing may change which artifact serves the main domain.

**How to apply:** For custom-domain root changes, identify every server that can receive `/`, test exact-host behavior and Expo manifest requests, keep artifact asset paths intact, and verify the live route again after publishing and DNS activation.