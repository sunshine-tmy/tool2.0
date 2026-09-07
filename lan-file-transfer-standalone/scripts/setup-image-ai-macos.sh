#!/bin/bash

root="$(cd "$(dirname "$0")/.." && pwd)"
venv="$root/.venv-image-ai"
models="$root/models/image-ai"
requirements="$root/scripts/image-ai-requirements-macos.txt"
ready_marker="$venv/.ready"
runtime="$root/.runtime"
progress_file="$runtime/image-ai-install-progress.json"
install_started_at="${IMAGE_AI_INSTALL_STARTED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
install_progress=8

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

fail() {
  write_progress "failed" "$install_progress" "AI 图片处理环境安装失败：$1"
  echo "错误：$1" >&2
  exit 1
}

[ "$(uname -s)" = "Darwin" ] || fail "该安装脚本仅适用于 macOS。"
[ "$(uname -m)" = "arm64" ] || fail "当前独立版 AI 环境仅支持 Apple Silicon（M1/M2/M3/M4 等 ARM64 芯片）。"

python_command=""
for candidate in python3.11 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11; do
  if command -v "$candidate" >/dev/null 2>&1; then
    python_command="$(command -v "$candidate")"
    break
  fi
done
[ -n "$python_command" ] || fail "未找到 Python 3.11。请先双击项目根目录的 python-3.11.9-macos11.pkg 安装，或执行 brew install python@3.11。"

python_version="$("$python_command" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
[ "$python_version" = "3.11" ] || fail "AI 图片处理需要 Python 3.11，当前检测到 $python_version。"

write_progress "environment" 10 "正在创建 Apple Silicon 专用 Python 环境"
echo "正在创建 Apple Silicon 专用 Python 环境……"
rm -f "$ready_marker"
"$python_command" -m venv "$venv" || fail "创建 Python 虚拟环境失败。"
venv_python="$venv/bin/python"
write_progress "environment" 15 "正在更新 Python 安装工具"
"$venv_python" -m pip install --upgrade pip wheel setuptools || fail "更新 pip 失败。"

write_progress "pytorch" 20 "正在安装 Apple Silicon 版 PyTorch"
echo "正在安装 Apple Silicon 版 PyTorch 与 AI 依赖，首次安装可能需要较长时间……"
"$venv_python" -m pip install torch==2.6.0 torchvision==0.21.0 || fail "安装 PyTorch 失败。"
write_progress "dependencies" 38 "正在安装图片 AI 推理依赖"
"$venv_python" -m pip install -r "$requirements" || fail "安装 AI 推理依赖失败。"

mkdir -p "$models"
export TORCH_HOME="$models/torch"
export U2NET_HOME="$models/rembg"
export PYTORCH_ENABLE_MPS_FALLBACK=1

write_progress "model-weights" 58 "正在下载 Real-ESRGAN 清晰化模型"
echo "正在下载 Real-ESRGAN 官方模型……"
curl -fL --retry 3 "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth" \
  -o "$models/RealESRGAN_x2plus.pth" || fail "下载 RealESRGAN_x2plus 模型失败。"
curl -fL --retry 3 "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth" \
  -o "$models/RealESRGAN_x4plus.pth" || fail "下载 RealESRGAN_x4plus 模型失败。"

write_progress "birefnet" 68 "正在下载并预加载 BiRefNet 抠图模型"
echo "正在预加载 BiRefNet 模型……"
"$venv_python" -c "from rembg import new_session; new_session('birefnet-general'); print('BiRefNet ready')" \
  || fail "预加载 BiRefNet 失败。"

write_progress "lama" 78 "正在下载并预加载 LaMa 去水印模型"
echo "正在预加载 LaMa 模型……"
"$venv_python" -c "from simple_lama_inpainting import SimpleLama; SimpleLama(); print('LaMa ready')" \
  || fail "预加载 LaMa 失败。"

write_progress "ocr" 88 "正在下载并预加载 PaddleOCR 检测模型"
echo "正在预加载 PaddleOCR 模型……"
"$venv_python" -c "from paddleocr import PaddleOCR; PaddleOCR(lang='ch', device='cpu', use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False); print('PaddleOCR ready')" \
  || fail "预加载 PaddleOCR 失败。"

write_progress "finalizing" 97 "正在完成环境校验和写入配置"
printf 'ready\n' >"$ready_marker"
write_progress "completed" 100 "AI 图片处理环境安装完成"
echo "Apple Silicon AI 图片处理环境安装完成。"
