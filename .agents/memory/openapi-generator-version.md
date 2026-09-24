---
name: OpenAPI generator version
description: Avoid incompatible generated Zod syntax when updating the API contract.
---

When regenerating the OpenAPI clients, use the existing Zod 3-compatible Orval version rather than assuming the currently resolved CLI is compatible. A newer Orval release emits Zod 4 methods, including top-level URL and UUID validators, while this workspace uses Zod 3.

**Why:** Running the newer code generator completed without an error but made the shared library typecheck fail; regenerating with the older installed version restored compatibility. The newer generator also reformatted many unrelated generated files.

**How to apply:** Check the generator version and generated-output compatibility before accepting codegen changes. Prefer aligning the generator dependency with the existing Zod major version before future contract updates.