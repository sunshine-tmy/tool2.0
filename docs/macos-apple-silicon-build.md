# Apple Silicon macOS 内部测试包

本文记录 Windows 桌面版向 Apple Silicon macOS 的迁移边界和可重复构建顺序。当前代码包含 macOS 桌面壳、能力包平台隔离和若干 Mac 原生资产准备器；**它尚不等于七模块可用的发布包**。必须先在 Apple Silicon Mac 构建、签名、安装并实测全部必需能力包，再将 Mac feed 嵌入应用。

## 首版范围

- Apple Silicon（`darwin-arm64`），macOS 13+；不支持 Intel Mac。
- 内部测试 DMG，不做 Developer ID 签名/公证，也不启用自动更新。构建使用 ad-hoc 签名；macOS Gatekeeper 仍可能提示无法验证开发者，测试者需按 macOS 的“仍要打开”流程明确放行，不要全局关闭 Gatekeeper。
- Chatterbox 仅提供 CPU 推理；Mac 端不列出 CUDA/GPU 能力。
- 使用轻量桌面壳，AI 模型与 Python Worker 由“设置 → 能力管理”按需安装。
- 持久数据位于 `~/Library/Application Support/EcommerceToolboxData`，不从 Windows 自动迁移；替换或移动 `.app` 不应移动此目录。

## 阶段 1：构建桌面壳

在 Apple Silicon Mac 上安装 Xcode Command Line Tools、Node.js 24、pnpm 11.7.0 与 Git；用户机器不需要预装 Python 或 Homebrew。克隆项目后：

```sh
pnpm install --frozen-lockfile
pnpm --filter @toolbox/shared typecheck
pnpm --filter backend typecheck
pnpm --filter frontend typecheck
pnpm --filter desktop typecheck
pnpm --filter desktop exec vitest run --exclude .stage/** --exclude out/** --exclude scripts/**
pnpm desktop:make
```

DMG 输出到 `apps/desktop/out/mac-arm64/EcommerceToolbox-mac-arm64.dmg`。也可以在 GitHub Actions 手动运行 `macOS Apple Silicon internal desktop build` 工作流下载 14 天保留的内部构建产物。工作流目前只构建桌面壳；它不会生成 Mac 能力资产，也不代表模型推理已通过。

图标由 `apps/desktop/assets/ecommerce-toolbox-icon-master-1024.png` 在 macOS 上转换为 `.icns`。桌面构建会在原生主机重建 `better-sqlite3`、`sharp`；Windows 打包目标仍为 x64 NSIS，维持原行为。

## 阶段 2：准备 Apple Silicon 能力资产

所有以下准备、签名、打包操作都必须在 Apple Silicon 原生构建机完成。Windows wheel、Windows 浏览器与现有 `win32-x64` manifest 不得改名后复用。`.package/` 是本机临时工作区，不应提交 Git。

Mac 首版有 11 个可构建的受管能力 ID：

| 能力 ID           | Mac 资产要点                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| `python-311`      | Python 3.11 共享运行时；图片 AI、视频转写、配音使用                         |
| `python-312`      | Python 3.12 共享运行时；小红书归档/翻译使用                                 |
| `ffmpeg`          | 从固定 FFmpeg 官方源码在 Mac 原生构建静态 `ffmpeg`/`ffprobe`                |
| `whisper-small`   | 固定 revision 的 Whisper small 模型；可供转写能力离线使用                   |
| `edge-tts`        | Python 3.11 与 Mac wheelhouse                                               |
| `video-text`      | Python 3.11、faster-whisper 与 FFmpeg                                       |
| `image-ai`        | Python 3.11、CPU PyTorch/Paddle、固定模型及哈希 wheelhouse                  |
| `chatterbox`      | Python 3.11、Chatterbox CPU wheelhouse 与固定声学模型                       |
| `xhs-archive`     | Python 3.12、XHS-Downloader 固定源码和 Mac wheelhouse                       |
| `xhs-translation` | Python 3.12、CTranslate2 CPU wheelhouse 与固定 OPUS-MT 模型                 |
| `xhs-browser`     | Playwright 固定版本对应的 Apple Silicon Chromium；系统 Chrome/Edge 可选复用 |

`chatterbox-cuda` 不属于 Mac 首版。图片压缩、短视频公开链接解析及局域网传输没有独立 Python 能力包，但仍须在 Mac 上验证真实模块任务和防火墙/手机访问。

### 2.1 Python 与依赖锁

从准备器显示的固定 Astral URL 下载 Python 3.11/3.12 归档，再校验、解包。归档字节数和 SHA-256 已固定在准备器中：

```sh
mkdir -p .package/downloads
curl -fL 'https://github.com/astral-sh/python-build-standalone/releases/download/20260924/cpython-3.11.16%2B20260924-aarch64-apple-darwin-install_only_stripped.tar.gz' -o .package/downloads/python-311-mac-arm64.tar.gz
curl -fL 'https://github.com/astral-sh/python-build-standalone/releases/download/20260924/cpython-3.12.14%2B20260924-aarch64-apple-darwin-install_only_stripped.tar.gz' -o .package/downloads/python-312-mac-arm64.tar.gz
pnpm components:prepare-python-311 -- --archive .package/downloads/python-311-mac-arm64.tar.gz --stage .package/stage/python-311
pnpm components:prepare-python-312 -- --archive .package/downloads/python-312-mac-arm64.tar.gz --stage .package/stage/python-312
```

准备器完成后会再次核验固定字节数和 SHA-256；下载成功不代表归档可信，校验失败时不要绕过检查。

准备器会验证 Python 自带的 SSL、SQLite、venv 等模块，并将官方运行时内部符号链接安全地实体化，保证最终能力归档不含符号链接。随后在 M 系列 Mac 上安装 Astral `uv` 并生成目标平台哈希锁：

```sh
pnpm components:lock-macos-dependencies \
  --python-311 .package/stage/python-311/python/bin/python3.11 \
  --python-312 .package/stage/python-312/python/bin/python3.12
```

锁文件写入忽略目录 `.package/macos-locks/`。Torch 后端选项使用 uv 的 preview 参数；在复现同一批能力资产时，应记录并沿用完全相同的 uv 版本，审核并留存构建锁作为产物记录。构建期间不应依赖开发机当前 Python、用户 site-packages 或 Homebrew。

### 2.2 原生资产与依赖顺序

先准备共享运行时和依赖锁，再按下列顺序制作能力暂存目录。Python 目录与 wheelhouse 都必须来自上一步 Mac 构建：

```sh
pnpm components:prepare-ffmpeg -- --stage .package/stage/ffmpeg
pnpm components:prepare-whisper-small -- --stage .package/stage/whisper-small
pnpm components:prepare-edge-tts -- --python .package/stage/python-311/python/bin/python3.11 --stage .package/stage/edge-tts
pnpm components:prepare-video-text -- --python .package/stage/python-311/python/bin/python3.11 --stage .package/stage/video-text
pnpm components:prepare-image-ai -- --python .package/stage/python-311/python/bin/python3.11 --stage .package/stage/image-ai
pnpm components:prepare-chatterbox -- --python .package/stage/python-311/python/bin/python3.11 --stage .package/stage/chatterbox
pnpm components:prepare-xhs-archive -- --python .package/stage/python-312/python/bin/python3.12 --archive .package/downloads/xhs-downloader-afaf2fb459980fccef9eec74e304a39af2c49cab.zip --stage .package/stage/xhs-archive
pnpm components:prepare-xhs-browser -- --stage .package/stage/xhs-browser
```

固定 XHS 源码归档的文件名、长度和 SHA-256 必须与准备脚本相符。翻译模型须在 Mac 上用同一锁文件准备的 CTranslate2 转换器生成，不能复用 Windows 转换产物：

```sh
uv venv --python .package/stage/python-312/python/bin/python3.12 .package/xhs-model-converter
uv pip install --python .package/xhs-model-converter/bin/python --require-hashes -r .package/macos-locks/xhs-translation.lock.txt
PATH="$PWD/.package/xhs-model-converter/bin:$PATH" pnpm prepare:xhs-model
pnpm components:prepare-xhs-translation -- --python .package/stage/python-312/python/bin/python3.12 --model .runtime/xhs-translation-model-cache/opus-mt-zh-en-ct2-int8 --stage .package/stage/xhs-translation
```

每个准备器成功结束后，必须检查暂存文件和其自检结果，再进入签名打包。

### 2.3 签名与生成目录

使用组织管理的 Ed25519 私钥，不要把私钥写入仓库、DMG、日志或 GitHub artifact。签名包需上传到 Mac 专用、不可变的 HTTPS feed 后才可在线安装。每个资产需保留 `.manifest.json`、`.spdx.json`、所有 manifest 引用的归档和受信任公钥；签名/哈希验证不得关闭。

下面以一个能力为例。其余能力分别传入对应 definition 和 stage：

```sh
pnpm components:package -- \
  --definition scripts/component-definitions/python-311.json \
  --stage .package/stage/python-311 \
  --output .package/macos-component-feed \
  --github-release-url https://github.com/<org>/<repo>/releases/download/<mac-feed-version> \
  --signing-key-file <安全保存的 Ed25519 私钥文件>
```

全部 11 个包上传并完成远端摘要核对后，在 Mac 构建机生成并检查 Mac 专属目录：

```sh
pnpm components:catalog -- --platform darwin-arm64 --feed .package/macos-component-feed
```

该命令只接受 `darwin-arm64` manifest、核实清单签名、归档和 SBOM 后，才写入 `backend/src/modules/components/catalog.darwin-arm64.generated.ts`。审核生成 diff，然后重新运行 Mac 内部 DMG 工作流。未完成这一步时 Mac 能力目录为空，界面不会错误显示 Windows 包。

在线安装 feed 发布前，先用 Mac 本地签名 feed 完成离线导入闭环：正常导入、重装、卸载、失败回滚、哈希篡改拒绝、签名错误拒绝、跨平台包拒绝、空间不足保护以及 Python venv 安装。确保 Mac 版应用只信任经审核的 Mac 密钥。

## 阶段 3：逐模块实机验收

在干净的 Apple Silicon Mac 用户目录安装 DMG，允许首次运行提示，启动、退出后再次启动；移动或替换 `.app` 后确认设置、SQLite、素材、浏览器登录资料、模型与能力仍在 Application Support 数据目录。macOS 13 与当前 macOS 各有一台实机验收后，才能对外宣称支持这两个系统范围。Apple Silicon CI runner 不能代替旧系统实机测试。

| 模块           | 最小真实任务                                                                           |
| -------------- | -------------------------------------------------------------------------------------- |
| 图片压缩       | 压缩 JPG、PNG、WebP 并检查结果与历史记录                                               |
| AI 图片处理    | CPU 推理完成一次修复、增强、抠图或 OCR；模型自检通过                                   |
| 视频文本解析   | 由 FFmpeg 提取音频，Whisper small 离线转写并导出                                       |
| 多国语言配音   | Edge-TTS 在线生成；Chatterbox CPU 成功克隆马来语/英语/巴葡短音频；界面不出现 CUDA 选项 |
| 短视频解析     | 验收分享链接解析及“提取文案”联动；系统浏览器登录路径不依赖 PowerShell                  |
| 小红书归档     | 实测登录、归档、媒体保存、离线翻译与受管 Chromium 启动                                 |
| 局域网文件传输 | Mac 防火墙允许后，用 iPhone/Android 扫码访问、上传、下载和图文快传                     |

安装、自检、在线安装/离线导入、重装、卸载和拒绝异平台包都要在真实 Mac 上通过。若任一必需资产、模块真实任务或权限检查失败，暂停发布“七模块可用”版本，并将问题作为该阶段阻塞项处理。

## 当前实现与后续明确不做项

- 桌面壳构建入口、`.icns` 生成、arm64 原生依赖重建和测试 DMG 已接入；Mac 持久数据和设置页按 Application Support 布局。
- 共享 manifest schema、能力打包/目录生成、运行时、自检和离线导入具备平台字段与隔离；Mac 专属生成目录尚为空。
- Python、FFmpeg、模型下载、Mac 依赖哈希锁、Mac Chromium 等资产准备脚本已有入口，但尚未在 Apple Silicon 实机完整制作/验收。
- Mac 签名与公证、自动更新、Intel、GPU、Windows 历史数据迁移均不在首版范围。
- 正式公开分发另行加入 Developer ID 签名与 Apple 公证；更新版本需单独生成 DMG、ZIP 和 `latest-mac.yml` 并配好稳定更新源。

## 参考

- [Electron macOS 系统要求](https://www.electronjs.org/docs/latest/tutorial/support#supported-platforms)
- [Astral python-build-standalone 运行说明](https://github.com/astral-sh/python-build-standalone/blob/main/docs/running.rst)
- [FFmpeg 官方源码下载](https://ffmpeg.org/download.html)
- [Apple macOS 软件分发](https://developer.apple.com/macos/distribution/)
- [GitHub-hosted runner 规格](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
