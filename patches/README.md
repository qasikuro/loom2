# Dependency security patches

`pnpm-workspace.yaml` is the source of truth for dependency patches.
They are applied by normal and frozen-lockfile installations, including CI.

- `braces@3.0.3.patch`: caps parser nesting and recursive compile, expand,
  and stringify traversal at 128 levels. This prevents stack exhaustion
  from deeply nested patterns and directly supplied ASTs (CVE-2026-93687).
  Excessive nesting throws a deliberate `RangeError` instead of exhausting
  the process stack.
- `node-forge@1.4.0.patch`: rejects extra elements inside RSA PKCS#1 v1.5
  DigestAlgorithm sequences and nonempty NULL parameters. Valid SHA-256
  signatures, including absent optional NULL parameters, remain supported
  (CVE-2026-85393 / incomplete fix for CVE-2026-33894).
- The existing `expo-av.patch` is retained for native compatibility.
- `metro@0.83.3.patch`: reads image assets into buffers before passing them
  to image-size 2, whose filename-based API was removed. This retains asset
  bundling without changing React Native/Expo native versions.

The first two packages currently have no patched registry release. Version-only
dependency scanners will still report them; do not suppress those warnings or
claim a clean audit. Replace these backports with official fixed releases when
available and rerun the regression tests.

UUID versions below 11 are upgraded to 11.1.1 (retains CommonJS named exports).
Image-size 1 is upgraded to 2.0.3 (retains Metro's default function export).

Run the installed-dependency regressions:

```sh
node --test scripts/dependency-security.test.cjs
```
