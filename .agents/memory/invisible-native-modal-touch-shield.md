---
name: Invisible native Modal touch shield
description: A React Native Modal can block every underlying touch while its content is transparent during async initialization.
---

Mount a full-screen native Modal only after its async content is ready. A Modal with an opacity-zero child still owns a separate native window, so `pointerEvents="none"` on the child cannot let touches reach the screen underneath.

**Why:** Onboarding draft hydration mounted the Modal before the fade animation began, leaving Home visually present but completely untappable while the draft promise was pending or failed.

**How to apply:** Gate `Modal.visible` with an explicit hydration/readiness flag, and resolve that flag on both success and failure. Keep temporary root and handler touch logs until a real Android/iOS device confirms the event path.