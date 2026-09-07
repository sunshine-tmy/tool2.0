#!/bin/bash

# Compatible with the Bash 3.2 bundled with macOS.
root="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$root/.runtime"
service_pid_file="$runtime_dir/services.pid"
ai_pid_file="$runtime_dir/image-ai.pid"
ports_file="$runtime_dir/ports.env"
service_log="$runtime_dir/services.log"
service_error_log="$runtime_dir/services-error.log"
ai_log="$runtime_dir/image-ai.log"
ai_error_log="$runtime_dir/image-ai-error.log"

fail() {
  echo "错误：$1" >&2
  exit 1
}

read_env_value() {
  local name="$1"
  local fallback="$2"
  local value
  local line
  value="$(printenv "$name" 2>/dev/null || true)"
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi
  if [ -f "$root/.env" ]; then
    line="$(grep -E "^[[:space:]]*${name}[[:space:]]*=" "$root/.env" | head -n 1 || true)"
    if [ -n "$line" ]; then
      value="${line#*=}"
      value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      case "$value" in
        \"*\") value="${value#\"}"; value="${value%\"}" ;;
        \'*\') value="${value#\'}"; value="${value%\'}" ;;
      esac
      printf '%s' "$value"
      return
    fi
  fi
  printf '%s' "$fallback"
}

port_is_used() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

find_available_port() {
  local candidate="$1"
  local excluded_one="${2:-0}"
  local excluded_two="${3:-0}"
  local attempts=0
  while [ "$attempts" -lt 200 ]; do
    if [ "$candidate" -gt 65535 ]; then candidate=10240; fi
    if [ "$candidate" -ne "$excluded_one" ] &&
      [ "$candidate" -ne "$excluded_two" ] &&
      ! port_is_used "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
    attempts=$((attempts + 1))
  done
  return 1
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
      *"$expected_command"*) kill_tree "$process_id" ;;
      *) echo "忽略已过期的进程记录 $process_id，避免停止其他程序。" ;;
    esac
  fi
  rm -f "$record_file"
}

api_is_ready() {
  curl --silent --fail --max-time 3 "$health_url" 2>/dev/null |
    grep -q '"name":"standalone-toolbox-api"'
}

web_is_ready() {
  curl --silent --fail --max-time 3 "$local_url" 2>/dev/null |
    grep -q 'content="lan-file-transfer-standalone"'
}

ai_is_ready() {
  curl --silent --fail --max-time 5 "$ai_url/health" 2>/dev/null |
    grep -q '"success":true'
}

[ "$(uname -s)" = "Darwin" ] || fail "此脚本仅用于 macOS。Windows 请双击 Windows一键启动.bat。"
command -v node >/dev/null 2>&1 || fail "未找到 Node.js，请先安装 Node.js 20、22 或 24。"
command -v npm >/dev/null 2>&1 || fail "未找到 npm，请重新安装 Node.js。"
command -v curl >/dev/null 2>&1 || fail "未找到 macOS 自带的 curl。"
command -v lsof >/dev/null 2>&1 || fail "未找到 macOS 自带的 lsof。"

node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
case "$node_major" in ''|*[!0-9]*) fail "无法读取 Node.js 版本。" ;; esac
if [ "$node_major" -lt 20 ] || [ "$node_major" -ge 25 ]; then
  fail "当前 Node.js 主版本为 $node_major，本项目需要 Node.js 20、22 或 24。"
fi

api_port="$(read_env_value API_PORT 3110)"
web_port="$(read_env_value LAN_TRANSFER_WEB_PORT 5183)"
ai_port="$(read_env_value IMAGE_AI_WORKER_PORT 3210)"
case "$api_port" in ''|*[!0-9]*) fail "API_PORT 必须是有效端口。" ;; esac
case "$web_port" in ''|*[!0-9]*) fail "LAN_TRANSFER_WEB_PORT 必须是有效端口。" ;; esac
case "$ai_port" in ''|*[!0-9]*) fail "IMAGE_AI_WORKER_PORT 必须是有效端口。" ;; esac

if [ -f "$ports_file" ]; then
  recorded_api_port="$(grep -E '^API_PORT=[0-9]+$' "$ports_file" | tail -n 1 | cut -d= -f2 || true)"
  recorded_web_port="$(grep -E '^LAN_TRANSFER_WEB_PORT=[0-9]+$' "$ports_file" | tail -n 1 | cut -d= -f2 || true)"
  recorded_ai_port="$(grep -E '^IMAGE_AI_WORKER_PORT=[0-9]+$' "$ports_file" | tail -n 1 | cut -d= -f2 || true)"
  [ -n "$recorded_api_port" ] && api_port="$recorded_api_port"
  [ -n "$recorded_web_port" ] && web_port="$recorded_web_port"
  [ -n "$recorded_ai_port" ] && ai_port="$recorded_ai_port"
fi

local_url="http://127.0.0.1:$web_port/tools/lan-transfer"
health_url="http://127.0.0.1:$api_port/api/health"
ai_url="http://127.0.0.1:$ai_port"
venv_python="$root/.venv-image-ai/bin/python"
ai_runtime_installed=0
if [ -x "$venv_python" ] && [ -f "$root/.venv-image-ai/.ready" ]; then
  ai_runtime_installed=1
fi

echo
echo "本地图片与文件工具 - macOS Apple Silicon"
echo "========================================="
echo

if api_is_ready && web_is_ready; then
  echo "服务已经运行：$local_url"
  [ "${LAN_TRANSFER_NO_BROWSER:-0}" = "1" ] || open "$local_url" >/dev/null 2>&1 || true
  exit 0
fi

stop_recorded_process "$service_pid_file" "npm run serve"
stop_recorded_process "$ai_pid_file" "image-ai-worker.py"
rm -f "$ports_file"

requested_api_port="$api_port"
requested_web_port="$web_port"
requested_ai_port="$ai_port"
if port_is_used "$api_port"; then
  api_port="$(find_available_port "$((api_port + 1))" "$web_port" "$ai_port")" ||
    fail "未找到可用的 API 端口。"
fi
if [ "$web_port" -eq "$api_port" ] || port_is_used "$web_port"; then
  web_port="$(find_available_port "$((web_port + 1))" "$api_port" "$ai_port")" ||
    fail "未找到可用的网页端口。"
fi
if [ "$ai_port" -eq "$api_port" ] || [ "$ai_port" -eq "$web_port" ] || port_is_used "$ai_port"; then
  ai_port="$(find_available_port "$((ai_port + 1))" "$api_port" "$web_port")" ||
    fail "未找到可用的 AI 工作进程端口。"
fi
if [ "$api_port" -ne "$requested_api_port" ] ||
  [ "$web_port" -ne "$requested_web_port" ] ||
  [ "$ai_port" -ne "$requested_ai_port" ]; then
  echo "默认端口被占用，已自动改用 API $api_port、网页 $web_port、AI $ai_port。"
fi

export API_PORT="$api_port"
export LAN_TRANSFER_WEB_PORT="$web_port"
export IMAGE_AI_WORKER_URL="http://127.0.0.1:$ai_port"
export PYTORCH_ENABLE_MPS_FALLBACK=1
local_url="http://127.0.0.1:$web_port/tools/lan-transfer"
health_url="http://127.0.0.1:$api_port/api/health"
ai_url="$IMAGE_AI_WORKER_URL"

mkdir -p "$runtime_dir"
printf 'API_PORT=%s\nLAN_TRANSFER_WEB_PORT=%s\nIMAGE_AI_WORKER_PORT=%s\n' \
  "$api_port" "$web_port" "$ai_port" >"$ports_file"
cd "$root" || fail "无法进入项目目录。"

echo "[1/4] 检查 Node.js 依赖……"
if [ ! -f "$root/node_modules/.package-lock.json" ]; then
  echo "首次运行，正在安装前后端依赖，可能需要几分钟……"
  npm ci --no-audit --no-fund || fail "前后端依赖安装失败，请检查网络连接和 npm 输出。"
else
  echo "前后端依赖已安装。"
fi

echo "[2/4] 检查前后端构建……"
if [ ! -f "$root/frontend/dist/index.html" ] || [ ! -f "$root/backend/dist/server.js" ]; then
  npm run build || fail "构建失败，请检查上方输出。"
else
  echo "构建产物已存在。"
fi

rm -f "$service_log" "$service_error_log" "$ai_log" "$ai_error_log"

echo "[3/4] 检查可选的 AI 图片处理服务……"
ai_pid=""
ai_ready=0
if [ "$ai_runtime_installed" -eq 1 ]; then
  nohup "$venv_python" "$root/scripts/image-ai-worker.py" \
    --host 127.0.0.1 --port "$ai_port" >"$ai_log" 2>"$ai_error_log" </dev/null &
  ai_pid=$!
  printf '%s\n' "$ai_pid" >"$ai_pid_file"

  attempt=0
  while [ "$attempt" -lt 120 ]; do
    sleep 0.5
    kill -0 "$ai_pid" 2>/dev/null || break
    if ai_is_ready; then ai_ready=1; break; fi
    attempt=$((attempt + 1))
  done
  if [ "$ai_ready" -ne 1 ]; then
    kill_tree "$ai_pid"
    ai_pid=""
    rm -f "$ai_pid_file"
    echo "AI 环境已安装但服务未启动，文件传输和图片压缩仍会继续运行。"
  fi
else
  echo "AI 图片处理尚未安装，已跳过；需要时可在 AI 页面一键安装。"
fi

echo "[4/4] 启动前端和后端服务……"
nohup npm run serve >"$service_log" 2>"$service_error_log" </dev/null &
service_pid=$!
printf '%s\n' "$service_pid" >"$service_pid_file"

ready=0
attempt=0
while [ "$attempt" -lt 60 ]; do
  sleep 0.5
  kill -0 "$service_pid" 2>/dev/null || break
  if api_is_ready && web_is_ready; then ready=1; break; fi
  attempt=$((attempt + 1))
done
if [ "$ready" -ne 1 ]; then
  kill_tree "$service_pid"
  [ -n "$ai_pid" ] && kill_tree "$ai_pid"
  rm -f "$service_pid_file" "$ai_pid_file" "$ports_file"
  [ -f "$service_log" ] && tail -n 40 "$service_log"
  [ -f "$service_error_log" ] && tail -n 40 "$service_error_log"
  fail "前端或后端服务未能启动。"
fi

echo
echo "本地图片与文件工具已启动。"
echo "本机地址：$local_url"
ifconfig | awk '$1 == "inet" { print $2 }' | while IFS= read -r ip; do
  case "$ip" in 127.*|169.254.*) continue ;; esac
  echo "局域网地址：http://$ip:$web_port/tools/lan-transfer"
done
if [ "$ai_ready" -eq 1 ]; then
  echo "AI 服务已启动，优先使用 Apple MPS；不支持的算子会自动回退 CPU。"
else
  echo "AI 图片处理未安装或未运行，可进入 AI 页面按需安装。"
fi
echo "双击 macOS一键停止.command 可停止全部服务。"

[ "${LAN_TRANSFER_NO_BROWSER:-0}" = "1" ] || open "$local_url" >/dev/null 2>&1 || true
