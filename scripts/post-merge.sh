#!/bin/bash
set -e

# CI=true tells pnpm it is safe to remove node_modules non-interactively.
CI=true pnpm install

# Push any pending DB schema changes produced by the merged task.
pnpm --filter @workspace/db run push-force
