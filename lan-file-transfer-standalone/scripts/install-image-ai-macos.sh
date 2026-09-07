#!/bin/bash

root="$(cd "$(dirname "$0")/.." && pwd)"
installer="$root/python-3.11.9-macos11.pkg"
runtime="$root/.runtime"
progress_file="$runtime/image-ai-install-progress.json"
install_started_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
install_progress=0
export IMAGE_AI_INSTALL_STARTED_AT="$install_started_at"

write_progress() {
  local stage="$1"
  install_progress="$2"
  local message="$3"
  local updated_at
  updated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  mkdir -p "$runtime"
  printf '{"stage":"%s","progress":%s,"message":"%s","startedAt":"%s","updatedAt":"%s"}\n' \
    "$stage" "$install_progress" "$message" "$install_started_at" "$updated_at" >"$progress_file"
}

find_python311() {
  local candidate
  for candidate in \
    python3.11 \
    /usr/local/bin/python3.11 \
    /Library/Frameworks/Python.framework/Versions/3.11/bin/python3.11 \
    /opt/homebrew/bin/python3.11; do
    if command -v "$candidate" >/dev/null 2>&1 &&
      "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)' 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

fail() {
  write_progress "failed" "$install_progress" "AI 图片处理环境安装失败：$1"
  echo "错误：$1" >&2
  exit 1
}

[ "$(uname -s)" = "Darwin" ] || fail "该安装脚本仅适用于 macOS。"
[ "$(uname -m)" = "arm64" ] || fail "AI 图片处理仅支持 Apple Silicon ARM64。"
write_progress "preparing" 2 "正在检查 Python 和本机安装环境"

if ! find_python311; then
  [ -f "$installer" ] || fail "未找到 Python 3.11，也未找到随包附带的 python-3.11.9-macos11.pkg。"
  write_progress "python" 4 "等待完成 Python 3.11 安装"
  echo "正在打开 Python 3.11 官方安装程序，请在安装器中完成安装……"
  open "$installer" || fail "无法打开 Python 安装程序。"

  attempts=0
  while [ "$attempts" -lt 900 ]; do
    if find_python311; then break; fi
    sleep 2
    attempts=$((attempts + 1))
  done
  find_python311 || fail "30 分钟内未检测到 Python 3.11，安装可能已取消。"
fi

write_progress "environment" 8 "Python 3.11 已就绪，准备创建独立环境"
echo "Python 3.11 已就绪，开始安装 AI 依赖和模型……"
bash "$root/scripts/setup-image-ai-macos.sh" || {
  echo "错误：AI 环境安装失败。" >&2
  exit 1
}
install_progress=97
[ -f "$root/.venv-image-ai/.ready" ] || fail "AI 环境安装未完成。"
echo "AI 图片处理环境安装完成。"
