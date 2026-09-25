---
name: OpenAPI generator version
description: Avoid incompatible generated Zod syntax when updating the API contract.
---

When regenerating the OpenAPI clients, use the Zod 3-compatible Orval version rather than assuming the currently resolved CLI is compatible. In this workspace, Orval 8.5.3 generated compatible output; 8.21.0 is the newer resolved dependency.

**Why:** The newer generator can emit Zod 4 methods, including top-level URL and UUID validators, while this workspace uses Zod 3. The older installed generator completed codegen and passed the shared library typecheck.

**How to apply:** Check the generator version and generated-output compatibility before accepting codegen changes. If the package script resolves to 8.21.0, use the installed 8.5.3 CLI for codegen and verify `pnpm run typecheck:libs`.