---
name: Fail-open onboarding checks
description: Avoiding invisible or incorrect onboarding modals when authenticated profile hydration fails.
---

Onboarding eligibility must be decided only from a successful profile response. If authentication or profile hydration fails transiently, leave the signed-in app usable and retry later instead of opening a full-screen modal.

**Why:** A failed native API response can happen while cached Home content is already visible; showing onboarding in that state makes the app look loaded but intercepts every touch.

**How to apply:** Treat network errors, unexpected status codes, empty transport results, and token timing failures as a no-op for the onboarding gate. Only show onboarding when the server confirms a fresh/default profile.