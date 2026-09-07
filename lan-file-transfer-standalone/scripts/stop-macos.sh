#!/bin/bash

root="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$root/.runtime"

fail() {
  echo "错误：$1" >&2
  exit 1
}

kill_tree() {
  local process_id="$1"
  local children
  local child
  children="$(pgrep -P "$process_id" 2>/dev/null || true)"
  for child in $children; do
    kill_tree "$child"
  done
  kill -TERM "$process_id" 2>/dev/null || true
}

stop_recorded_process() {
  local record_file="$1"
  local expected_command="$2"
  local label="$3"
  local process_id
  local process_command
  [ -f "$record_file" ] || return
  process_id="$(cat "$record_file" 2>/dev/null || true)"
  case "$process_id" in
    ''|*[!0-9]*) rm -f "$record_file"; return ;;
  esac
  if kill -0 "$process_id" 2>/dev/null; then
    process_command="$(ps -p "$process_id" -o command= 2>/dev/null || true)"
    case "$process_command" in
      *"$expected_command"*)
        kill_tree "$process_id"
        echo "$label 已停止。"
        ;;
      *) echo "忽略 $label 的过期进程记录，避免停止其他程序。" ;;
    esac
  fi
  rm -f "$record_file"
}

[ "$(uname -s)" = "Darwin" ] || fail "此脚本仅用于 macOS。"

if [ ! -f "$runtime_dir/services.pid" ] && [ ! -f "$runtime_dir/image-ai.pid" ]; then
  rm -f "$runtime_dir/ports.env"
  echo "没有找到正在运行的服务记录。"
  exit 0
fi

stop_recorded_process "$runtime_dir/services.pid" "npm run serve" "前端和后端服务"
stop_recorded_process "$runtime_dir/image-ai.pid" "image-ai-worker.py" "AI 图片处理服务"
rm -f "$runtime_dir/ports.env"
echo "全部服务已停止。"
