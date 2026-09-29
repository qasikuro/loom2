---
name: Non-destructive Drizzle schema updates
description: Avoid data loss when schema push presents unrelated prompts.
---

Never use a force/truncate option just to get an unrelated Drizzle schema prompt out of the way. Inspect the affected rows and apply only the intended schema change through the development database flow, keeping existing data intact. Treat production schema changes as a separate publish-managed step.

**Why:** Drizzle push can stop on pre-existing schema drift and offer to truncate populated tables, even when the requested change is only additive.

**How to apply:** If an interactive push cannot safely continue, do not choose a destructive fallback. Confirm the target change is additive, check affected data first, and use a non-destructive development-only path; leave production untouched.