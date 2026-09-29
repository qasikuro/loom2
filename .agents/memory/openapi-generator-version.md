---
name: OpenAPI generator version
description: Avoid incompatible generated Zod syntax when updating the API contract.
---

When regenerating the OpenAPI clients, use the Zod 3-compatible Orval version rather than assuming the currently resolved CLI is compatible. The workspace resolves Orval 8.21.0, while `pnpm dlx orval@8.5.3 --config ./orval.config.ts` from `lib/api-spec` generates compatible output without changing project manifests.

**Why:** The newer generator can emit Zod 4 methods, including top-level URL and UUID validators, while this workspace uses Zod 3. Orval 8.5.3 completed codegen and passed the shared library typecheck.

**How to apply:** Check the generator version and generated-output compatibility before accepting codegen changes. If the package script resolves to 8.21.0, invoke Orval 8.5.3 with `pnpm dlx` and verify `pnpm run typecheck:libs`.