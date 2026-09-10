#!/bin/bash
set -u
cd "$(dirname "$0")" || exit 1
printf '\033c'
echo "电商工具箱 - 精细化清理"
echo "======================="
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 后重试。"
  read -r -p "按回车键关闭窗口……"
  exit 1
fi
node scripts/clear-generated.mjs --interactive
status=$?
echo
read -r -p "按回车键关闭窗口……"
exit "$status"
