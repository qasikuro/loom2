---
name: ObjectStorageService vs objectStorageClient
description: The raw GCS client and the service wrapper are different exports — methods like getObjectEntityUploadURL live only on the service instance.
---

In `artifacts/api-server/src/lib/objectStorage.ts`:

- `objectStorageClient` = `new Storage(...)` — the raw Google Cloud Storage GCS client. Only has low-level GCS methods (`.bucket()`, etc.).
- `ObjectStorageService` = a class that wraps the GCS client and adds app-level helpers: `getObjectEntityUploadURL()`, `normalizeObjectEntityPath()`, `getObjectEntityFile()`, `trySetObjectEntityAclPolicy()`, etc.

**Rule:** Always instantiate `new ObjectStorageService()` to call any of the app-level helpers. Never call them directly on `objectStorageClient`.

**Why:** TypeScript will silently fail to catch this at import time because `Storage` is a large GCS type — the missing methods only surface at compile time via TS2339.

**How to apply:** Any new route or service that needs presigned upload URLs or path normalization should `import { ObjectStorageService }` and call `new ObjectStorageService().getObjectEntityUploadURL()`.
