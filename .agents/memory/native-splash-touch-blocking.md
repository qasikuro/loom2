---
name: Native splash touch blocking
description: Development-build tap failures caused by a transparent splash overlay retaining native pointer events.
---

An absolute splash overlay must release pointer events when dismissal begins, not only after its fade animation completion callback. Native development builds can delay or fail that callback while the underlying screen is already visible.

**Why:** A transparent overlay with pointer events enabled intercepts every tap, making Home and the tab bar appear broken even though navigation handlers are present.

**How to apply:** Keep a separate touch-blocking state for the splash. Set it false before starting the fade, and use `pointerEvents="none"` for the rest of the fade/unmount period.