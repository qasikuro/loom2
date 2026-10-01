---
name: Storigam brand identity
description: Canonical branding, uploaded logo fidelity, and compatibility during visual rebrands
---

Use Storigam for visible names, logos, splash/loading visuals, notifications, and share copy. Do not use Gamejo, Mobilejo, Ximo, Sky Journal, or Loom Journal as alternate app names.

**Why:** The user explicitly corrected inconsistent branding and identified Storigam as the app's name.

**How to apply:** Treat supplied Storigam logo artwork as authoritative; preserve its shape and typography rather than recreating the wordmark with a font. Keep logo assets sharp at the largest rendered size and use contrast variants for dark and light surfaces.

Keep existing native package/bundle identifiers and persisted storage keys unless the user specifically requests an identity or data migration.

**Why:** Changing native identifiers makes a build install as a separate app rather than update an existing install. Renaming persisted keys can discard saved settings even when only visible branding was meant to change.

**How to apply:** Rebrand display names, artwork, and user-facing copy without renaming implementation-only directories, package names, or compatibility keys.