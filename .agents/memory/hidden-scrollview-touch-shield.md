---
name: Hidden native ScrollView touch shield
description: A visually hidden legacy scroll tree can leave a native development-build screen unable to receive touches.
---

Do not leave an inactive native `ScrollView` with a `RefreshControl` mounted behind an absolutely positioned interactive scene. Unmount the inactive tree rather than relying on `display: 'none'`.

**Why:** On the Sky Journal development build, the Home page was completely frozen (including scrolling), while the bottom tabs still worked. After the hidden legacy scroll tree was prevented from mounting and the build reloaded, the user confirmed that Home scrolling and buttons both worked. This is observed behavior; the exact native hit-testing mechanism was not independently measured.

**How to apply:** When a screen has a visible absolute-fill scroll area alongside a hidden legacy scroll area, remove or conditionally unmount the latter. Treat a visually hidden native refresh/gesture hierarchy as a possible touch interceptor, and verify on the affected native device.