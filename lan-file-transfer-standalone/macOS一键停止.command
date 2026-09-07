#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
/bin/bash "$SCRIPT_DIR/scripts/stop-macos.sh"
status=$?

if [ "$status" -ne 0 ]; then
  echo
  read -r -p "停止失败，按回车键关闭窗口……"
fi

exit "$status"
