---
name: Landing page language bridge
description: How to carry the selected mobile-app language into the public landing page
---

The public landing page cannot read a language preference saved inside the Expo app. Carry an explicitly selected app language into an external-browser landing link through a `lang` query parameter; the web page can then retain its own language selection. For visitors arriving independently, use their browser language when no web preference exists.

**Why:** Expo AsyncStorage and browser localStorage are separate storage contexts, even on the same device. Assuming they sync would show visitors a different language than the one selected in the app.

**How to apply:** Whenever adding an in-app link to the public landing page, include the app's current supported locale code in the link, without relying on browser/device language alone. Preserve the landing page's own language switcher for direct visitors.