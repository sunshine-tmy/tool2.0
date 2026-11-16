#!/bin/bash
set -u

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请安装 Node.js 24，然后重新打开终端或 Finder。"
  echo "https://nodejs.org/"
  exit 1
fi

node "$PROJECT_ROOT/scripts/macos-project.mjs" start
STATUS=$?
if [[ -t 0 ]]; then
  if [[ "$STATUS" -ne 0 ]]; then
    echo "启动未完成；按回车关闭此窗口。"
  else
    echo "启动命令已完成；应用可在后台运行。按回车关闭此窗口。"
  fi
  read -r _
fi
exit "$STATUS"
