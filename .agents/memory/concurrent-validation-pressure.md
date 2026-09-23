---
name: Concurrent validation pressure
description: Avoid redundant whole-workspace checks when verifying a focused mobile UI change
---

For focused mobile changes, prefer one targeted typecheck and lint pass. If several automatic whole-workspace validation workflows are running together and resource pressure makes even simple commands time out, stop redundant checks before retrying a targeted check.

**Why:** Concurrent TypeScript and ESLint processes exhausted available memory and made otherwise healthy local services and short validation commands unresponsive. A targeted pass succeeded after redundant checks were stopped.

**How to apply:** Check workflow status and resource pressure before assuming a code regression when checks or the preview unexpectedly time out. Do not repeatedly launch duplicate checks.