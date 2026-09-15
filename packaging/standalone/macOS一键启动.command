#!/bin/bash
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
cd "$root"
corepack enable
pnpm install --frozen-lockfile
pnpm build
exec pnpm standalone:start
