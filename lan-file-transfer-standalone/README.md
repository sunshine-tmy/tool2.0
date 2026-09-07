# 本地图片与文件工具（独立版）

这是从主项目中独立出来的本地工具包，只包含三个模块：

- 图片压缩：JPEG、PNG、WebP 批量压缩、尺寸调整和格式转换
- AI 图片处理：去水印、图片增强、商品图抠图
- 局域网文件传输：文件收发、分片续传、图文便签、预览和二维码

页面布局与主项目一致。项目不包含 Node.js 依赖、Python 虚拟环境、AI 模型和构建产物。

首次一键启动默认只安装并启动文件传输、图片压缩所需的 Node.js 依赖。未安装 Python 时，这两个模块仍可正常使用；进入“AI 图片处理”页面后会显示“未安装”，由用户主动点击按钮后才安装 Python、AI 依赖和模型。

## Windows 使用方法

必需环境：

- Node.js 20、22 或 24（推荐 Node.js 22 LTS）
- 首次启动文件传输和图片压缩时，需要可访问 npm 的网络
- Python 3.11 64 位仅在使用 AI 图片处理时需要

操作步骤：

1. 双击 `Windows一键启动.bat`。
2. 首次启动只安装前后端 Node.js 依赖并构建项目，随后文件传输和图片压缩即可使用。
3. 需要 AI 图片处理时进入对应页面，点击“安装 Python 与 AI 环境”。
4. 如果未安装 Python，系统会打开根目录中的 `python-3.11.9-amd64.exe`；按官方安装器提示完成后，项目会自动继续安装 AI 依赖和模型。
5. AI 环境安装完成后会自动启动推理服务；以后再次启动不会重复安装。
6. 不再使用时双击 `Windows一键停止.bat`。

启动窗口不会再自动闪退：无论成功或失败都会等待按键后关闭。启动失败时，完整错误同时保存到 `.runtime/launcher-error.log`，可以把该文件发给维护人员排查。

有可用 NVIDIA 显卡时，安装脚本自动使用 CUDA 版 PyTorch；没有 NVIDIA 显卡时自动安装 CPU 版，功能不受影响但 AI 处理速度会慢一些。

Windows 防火墙首次询问时，需要允许 Node.js 在“专用网络”中通信，否则其他设备无法访问局域网传输页面。

## Apple M 芯片 Mac 使用方法

必需环境：

- Node.js 20、22 或 24（推荐 Node.js 22 LTS）
- 文件传输和图片压缩仅需要 Node.js
- AI 图片处理需要 Apple Silicon（M1、M2、M3、M4 或后续 ARM64 芯片）和 Python 3.11 ARM64

推荐通过 Homebrew 安装环境：

```bash
brew install node@22 python@3.11
```

操作步骤：

1. 在 Mac 上直接解压 `lan-file-transfer-standalone-macos.tar.gz`，不要先在 Windows 解压后再传文件夹。
2. 按 `【macOS首次运行必读】.txt` 在终端解除一次隔离并启动。
3. 首次启动只安装 Node.js 依赖并构建文件传输和图片压缩模块。
4. 需要 AI 时进入“AI 图片处理”页面，点击一键安装。
5. 如果未安装 Python，系统会打开根目录中的 `python-3.11.9-macos11.pkg`；完成官方安装器后自动继续安装 ARM64 AI 依赖和模型。
6. 以后可直接双击 `macOS一键启动.command`。
7. 不再使用时双击 `macOS一键停止.command`。

AI 推理会优先使用 Apple 的 MPS 加速；当前 PyTorch/MPS 不支持的算子会自动回退 CPU。Real-ESRGAN 和 PaddleOCR 在 Mac 上使用 CPU，因此“变清晰”和文字区域识别通常比配备 NVIDIA 显卡的 Windows 电脑慢，但功能可以正常使用。

macOS 防火墙首次询问时，请允许 Node.js 接收入站连接。

## 首次安装说明

AI 依赖和模型只在 AI 页面主动点击安装后下载，具体耗时取决于网络和电脑性能，通常需要 10–30 分钟。安装过程中可以继续使用文件传输和图片压缩，但不要关闭 Python 安装窗口。安装成功后会写入 `.venv-image-ai/.ready` 标记；安装中断时可在 AI 页面重新点击安装。

默认启用可用于商业场景的 BiRefNet 抠图。BRIA RMBG 2.0 因许可证要求不会自动下载；只有明确接受其许可证并把 `DEPLOYMENT_USAGE` 设置为 `internal-noncommercial` 时才应手动配置。

## 配置

默认无需配置。如需修改端口、文件上限、保留天数或管理 PIN：

1. 复制 `.env.example` 为 `.env`。
2. 修改所需配置。
3. 运行对应系统的一键停止后重新启动。

默认端口：

- 网页：`5183`
- 后端 API：`3110`
- AI 工作进程：`3210`

macOS 启动脚本遇到端口占用时会自动选择备用端口；Windows 的 AI 端口占用时也会自动切换。

## 数据位置

- 局域网文件：`storage/lan-transfer/`
- 图片压缩结果：`storage/outputs/`
- AI 输入、结果和任务：`storage/image-ai/`
- AI 模型：`models/image-ai/`
- 运行日志：`.runtime/`

## 分享包

- Windows：`lan-file-transfer-standalone-source.zip`
- macOS：`lan-file-transfer-standalone-macos.tar.gz`

分享包不包含以下可自动生成内容：

- `node_modules/`
- `.venv-image-ai/`
- `models/image-ai/`
- `frontend/dist/`
- `backend/dist/`
- `packages/shared/dist/`
- `.runtime/`
- 用户上传、处理结果和其他运行时数据

分享包包含 Python 3.11.9 官方安装程序及对应的 `.sigstore` 元数据。Python 3.11.9 是 Python 3.11 系列最后一个提供官方 Windows 和 macOS 二进制安装程序的 bugfix 版本；安装包摘要记录在 `Python安装包校验信息.txt`。

## 手动开发命令

```bash
npm install
npm run dev
```

AI 工作进程需先运行对应系统的安装脚本，再使用虚拟环境中的 Python 启动 `scripts/image-ai-worker.py`。
