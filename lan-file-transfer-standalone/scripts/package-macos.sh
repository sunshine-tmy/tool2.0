#!/bin/bash

set -e

root="$(cd "$(dirname "$0")/.." && pwd)"
parent="$(dirname "$root")"
name="$(basename "$root")"
output="$parent/lan-file-transfer-standalone-macos.tar.gz"
stage="$(mktemp -d /tmp/standalone-package.XXXXXX)"

case "$stage" in
  /tmp/standalone-package.*) ;;
  *) echo "不安全的临时目录：$stage" >&2; exit 1 ;;
esac

cleanup() {
  rm -rf "$stage"
}
trap cleanup EXIT

cd "$parent"
tar -cf - \
  --exclude="$name/node_modules" \
  --exclude="$name/*/node_modules" \
  --exclude="$name/frontend/dist" \
  --exclude="$name/backend/dist" \
  --exclude="$name/packages/shared/dist" \
  --exclude="$name/.runtime" \
  --exclude="$name/.venv-image-ai" \
  --exclude="$name/models" \
  --exclude="$name/storage" \
  --exclude="$name/scripts/__pycache__" \
  --exclude="*.tsbuildinfo" \
  --exclude="$name/.env" \
  "$name" | tar -xf - -C "$stage"

find "$stage/$name" -type d -exec chmod 755 {} +
find "$stage/$name" -type f -exec chmod 644 {} +
chmod 755 "$stage/$name"/*.command "$stage/$name"/scripts/*.sh

tar -czf "$output" -C "$stage" "$name"
echo "macOS 分享包已生成：$output"
