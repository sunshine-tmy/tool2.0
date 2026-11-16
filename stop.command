#!/bin/bash
set -u

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js 24。请从已配置 Node 的终端运行 stop.command。"
  exit 1
fi

node "$PROJECT_ROOT/scripts/macos-project.mjs" stop
STATUS=$?
if [[ -t 0 ]]; then
  read -r -p "按回车关闭此窗口。" _
fi
exit "$STATUS"
