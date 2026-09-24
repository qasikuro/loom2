---
name: Runtime join type mismatches
description: Why typed Drizzle joins may fail at runtime and make friend lists appear empty
---

Do not assume Drizzle's TypeScript types prove that joined columns have compatible PostgreSQL types in the running database. Check the actual database types or execute a read-only version of a new join before relying on it.

**Why:** A typechecked friend-list join failed at runtime because one side was UUID and the other text. The client treated the failed fetch as absent data, so Home showed zero friends even though follow relationships existed.

**How to apply:** When adding joins to social endpoints, validate them against the running database and check server logs for 500s if a list unexpectedly appears empty.