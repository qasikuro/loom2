---
name: expo-notifications PermissionResponse type gap
description: NotificationPermissionsStatus doesn't expose .granted or .status directly via TS; cast pattern required
---

In this workspace, `NotificationPermissionsStatus` extends `PermissionResponse` from `'expo'`, but that base type's `granted` and `status` fields don't resolve in the TS config used here. TypeScript reports "Property 'status' does not exist" even though both properties exist at runtime.

**The fix:**
```ts
type PermRes = { granted?: boolean; ios?: { status: number } };
const granted = (perms as unknown as PermRes).granted
  ?? (perms.ios?.status === 1 || perms.ios?.status === 3);
```
- `ios.status === 1` = AUTHORIZED
- `ios.status === 3` = PROVISIONAL

**Why:** The `PermissionResponse` base type is re-exported via `expo` → `expo-modules-core`, but the chain doesn't resolve in this workspace's tsconfig module resolution. This is a project-level TS config gap, not a real runtime issue.

**How to apply:** Any file that calls `getPermissionsAsync()` or `requestPermissionsAsync()` from expo-notifications must use this cast instead of `.granted` or `.status` directly.
