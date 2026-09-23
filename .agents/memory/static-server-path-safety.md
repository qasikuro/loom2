---
name: Static server path safety
description: Security boundary for standalone static servers that serve files selected by request URLs
---

Static servers should index files that exist under the static root at startup and serve request-selected entries from that allowlist, rather than reading a filesystem path built from the request.

**Why:** Path normalization and boundary checks can be correct but still be reported as traversal by static analysis when the request-derived path reaches `readFileSync`. Serving pre-indexed entries makes the filesystem boundary explicit and removes that ambiguous dataflow.

**How to apply:** Reject encoded traversal and backslashes before map lookup, use exact normalized relative keys, and never add request-derived paths to the index or filesystem.