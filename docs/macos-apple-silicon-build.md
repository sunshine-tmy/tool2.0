# Apple Silicon macOS 内部测试包

> 文档整理（2026-11-24）：目标和任务顺序以 [macOS 执行计划](macos-apple-silicon-implementation-plan.md) 为准，当前能力版本以应用内置的 Mac 目录为准。下文的十项能力及旧版本号属于当时的构建快照，不是当前机器或 Release 的实时状态。旧 manifest/SPDX 替换已在 2026-11-15 记录为完成，不应重复执行；[发布摘要](history-summary.md#macos-release) 和 [待验边界](history-summary.md#macos-acceptance) 区分已完成历史与仍需人工确认的事项。本次没有重新运行模型、设备或安装包验收。

本文记录 Apple Silicon macOS 的源码启动、能力资产和内部构建边界。完整任务矩阵和实测状态以执行计划及[执行台账](archive/macos-execution-status.md)为准；本文旧构建命令用于理解或再生成资产，不表示当前尚需从零制作所有能力。

## 当前源码启动入口

仓库根目录的 `start.command` 和 `stop.command` 是 Apple Silicon 源码开发入口，需要原生 arm64 macOS、Node.js 24、pnpm 11.7.0 和已安装的 workspace 依赖。从 Finder 双击前，若 ZIP 解压丢失执行权限，只给这两个入口补权限：

```sh
chmod u+x start.command stop.command
```

首次启动会先构建共享契约，再运行受管能力预检。缺少本地签名能力包时会一次列出缺失文件并停止；它不会自动安装依赖、下载能力包或按端口结束进程。确认发布源可访问后，显式运行 `corepack pnpm macos:prepare-resources` 下载目录声明的资源，并用 `corepack pnpm macos:resources-status` 检查大小与 SHA-256。全部能力可离线导入后，启动入口构建桌面源码并启动 Electron；日志写入 `.runtime/macos-source-launcher/desktop.log`。`stop.command` 只向该入口创建且身份仍匹配的独立进程组发送关闭信号。

Finder 使用的 PATH 若找不到 Node 或 pnpm，入口会说明所需版本；安装后重新打开 Finder/终端，或从已配置 PATH 的终端启动。Node 依赖缺失时需显式执行 `pnpm install --frozen-lockfile`。若 Electron 桌面运行时缺失，入口会在能力初始化前停止；显式运行 `node apps/desktop/node_modules/electron/install.js` 准备运行时后再试，启动器不会隐式联网获取它。Mac 图片 Worker 入口 `pnpm dev:ai` 已改用 `.venv-image-ai/bin/python`；启动前不会下载模型或安装 Python 包。

## 当前目标与范围

- Apple Silicon（`darwin-arm64`），目标最低 macOS 14；不支持 Intel Mac。M1 / 16 GB 是重型任务验收基线。尚未完成 macOS 14 干净设备与后续 M 系列设备验收，因此不把目标系统范围写成已验证支持。
- 当前 Mac 目录包含十类能力：Python 3.12、FFmpeg、Edge-TTS、Image AI、Chatterbox、XHS Browser、XHS Archive、XHS Translation、Douyin Archive 和 Video AI。Chatterbox MPS、STTN MPS 与 ProPainter Hybrid FP16 已完成相应模型/样本验收；Mac 目标不是 CPU-only。每项真实可用范围以执行计划和执行台账为准。
- 内部测试 DMG 目标使用 ad-hoc 签名，不做 Developer ID 签名/公证，也不启用自动更新。真实 DMG 尚未制作；打包后 macOS Gatekeeper 仍可能提示无法验证开发者，测试者需按系统“仍要打开”流程明确放行，不要全局关闭 Gatekeeper。
- AI 模型与 Python Worker 由“设置 → 能力管理”按需安装；当前本机已离线安装十项能力并通过生产自检，但不能替代安装版验收。
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
pnpm desktop:build
```

`pnpm desktop:build` 构建源码桌面，不制作安装包。`pnpm desktop:make` 会生成 DMG，并按现有打包规则递增产品版本；实际版本以 `apps/desktop/package.json` 为准。核对前置验收、源码版本和输出路径，并按用户明确指令打包后，才进入 M09-B03。手动 GitHub Actions workflow 同样不得被误当作能力资产制作、模型验收或干净设备安装证明。

图标由 `apps/desktop/assets/ecommerce-toolbox-icon-master-1024.png` 在 macOS 上转换为 `.icns`。桌面构建会在原生主机重建 `better-sqlite3`、`sharp`；Windows 打包目标仍为 x64 NSIS，维持原行为。

## 阶段 2：Mac 能力资产清单与再生成

再生成能力资产时，准备、签名和打包必须在 Apple Silicon 原生构建机完成。Windows wheel、Windows 浏览器与 `win32-x64` manifest 不得改名后复用。`.package/` 是本机临时工作区，不应提交 Git。旧发布操作已合并到 [发布历史摘要](history-summary.md#macos-release)，不再作为待执行的替换清单。

当前 Mac 目录有十个受管能力 ID：

| 能力 ID           | Mac 资产要点                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| `python-312`      | Python 3.12 共享运行时；配音、图片 AI、归档与翻译共用                       |
| `ffmpeg`          | 从固定 FFmpeg 官方源码在 Mac 原生构建静态 `ffmpeg`/`ffprobe`                |
| `edge-tts`        | Python 3.12 与 Mac wheelhouse                                               |
| `image-ai`        | Python 3.12、CPU PyTorch/Paddle、固定模型及哈希 wheelhouse                  |
| `chatterbox`      | Python 3.12、Chatterbox CPU wheelhouse 与固定声学模型                       |
| `xhs-archive`     | Python 3.12、XHS-Downloader 固定源码和 Mac wheelhouse                       |
| `xhs-translation` | Python 3.12、CTranslate2 CPU wheelhouse 与固定 OPUS-MT 模型                 |
| `xhs-browser`     | Playwright 固定版本对应的 Apple Silicon Chromium；系统 Chrome/Edge 可选复用 |
| `douyin-archive`  | Python 3.12、抖音匿名归档器和 Mac wheelhouse                                |
| `video-ai`        | Python 3.12、STTN MPS / ProPainter Hybrid FP16 序列资源                     |

`chatterbox-cuda` 不属于 Mac 目录；Chatterbox 使用 CPU/MPS 设备路径。图片压缩及局域网传输没有独立 Python 能力包，但仍属于 13 模块实机验收矩阵。

### 2.1 Python 与依赖锁

从准备器显示的固定 Astral URL 下载 Python 3.12 归档，再校验、解包。归档字节数和 SHA-256 已固定在准备器中：

```sh
mkdir -p .package/downloads
curl -fL 'https://github.com/astral-sh/python-build-standalone/releases/download/20260924/cpython-3.12.14%2B20260924-aarch64-apple-darwin-install_only_stripped.tar.gz' -o .package/downloads/python-312-mac-arm64.tar.gz
pnpm components:prepare-python-312 -- --archive .package/downloads/python-312-mac-arm64.tar.gz --stage .package/stage/python-312
```

准备器完成后会再次核验固定字节数和 SHA-256；下载成功不代表归档可信，校验失败时不要绕过检查。

准备器会验证 Python 自带的 SSL、SQLite、venv 等模块，并将官方运行时内部符号链接安全地实体化，保证最终能力归档不含符号链接。随后在 M 系列 Mac 上安装 Astral `uv` 并生成目标平台哈希锁：

```sh
pnpm components:lock-macos-dependencies \
  --python-312 .package/stage/python-312/python/bin/python3.12
```

锁文件写入忽略目录 `.package/macos-locks/`。Torch 后端选项使用 uv 的 preview 参数；在复现同一批能力资产时，应记录并沿用完全相同的 uv 版本，审核并留存构建锁作为产物记录。构建期间不应依赖开发机当前 Python、用户 site-packages 或 Homebrew。

### 2.2 原生资产与依赖顺序

本项目的 Mac 目录有十个能力 ID。再生成时先按执行计划的 M03-01 到 M03-04 准备共享 Python、依赖锁、原生工具、AI wheelhouse、Chromium 和经验证模型，再打包签名；Windows 归档、wheelhouse 和 manifest 不能重命名后复用。各定义、准备脚本与视频资源参数见[Apple Silicon 组件定义与准备说明](../scripts/component-definitions/README.md#apple-silicon-组件定义与准备)。

XHS 源码归档的文件名、字节数和 SHA-256 必须与准备脚本相符。XHS 翻译模型必须匹配固定的 OPUS-MT revision 与摘要，CTranslate2 转换锁也须来自同一 Apple Silicon Python 3.12 构建；不能复用 Windows 转换产物。以下命令仅说明翻译转换器准备顺序，不替代十项资产的完整生成矩阵：

```sh
uv venv --python .package/stage/python-312/python/bin/python3.12 .package/xhs-model-converter
uv pip install --python .package/xhs-model-converter/bin/python --require-hashes -r .package/macos-locks/xhs-translation.lock.txt
PATH="$PWD/.package/xhs-model-converter/bin:$PATH" pnpm prepare:xhs-model
pnpm components:prepare-xhs-translation -- --python .package/stage/python-312/python/bin/python3.12 --model .runtime/xhs-translation-model-cache/opus-mt-zh-en-ct2-int8 --stage .package/stage/xhs-translation
```

每个准备器成功结束后，必须检查暂存文件和其自检结果，再进入签名打包。当前十项正式候选与模型报告保存在执行台账指定的本机验收目录；没有新版本需求时不要重复下载、安装或推理。

### 2.3 签名与生成目录

使用组织管理的 Ed25519 私钥，不要把私钥写入仓库、DMG、日志或 GitHub artifact。签名包需上传到可访问的 HTTPS feed 后才可在线安装；本项目允许可变 Release，仍必须逐项核对签名与 SHA-256。每个资产需保留 `.manifest.json`、`.spdx.json`、所有 manifest 引用的归档和受信任公钥；签名/哈希验证不得关闭。

下面以一个能力为例。其余能力分别传入对应 definition 和 stage：

```sh
pnpm components:package -- \
  --definition scripts/component-definitions/python-312.json \
  --stage .package/stage/python-312 \
  --output .package/macos-component-feed \
  --github-release-url https://github.com/<org>/<repo>/releases/download/<mac-feed-version> \
  --signing-key-file <安全保存的 Ed25519 私钥文件>
```

全部 10 个包上传并完成远端大小/SHA-256 核对后，在 Mac 构建机生成并检查 Mac 专属目录：

```sh
pnpm components:catalog -- --platform darwin-arm64 --feed .package/macos-component-feed
```

该命令只接受 `darwin-arm64` manifest；核实清单签名、归档和 SBOM 后，才写入 `apps/api/src/modules/components/catalog.darwin-arm64.generated.ts`。当前源码目录已有十项正式信任密钥签名的 manifest。既有 `mac能力包` Release 中十二个归档和十个 SBOM 已匹配，十个远端 manifest 尚待替换；不需要重新上传归档和 SBOM。替换后必须核验远端摘要及在线安装，详情看执行台账。

在线安装 feed 发布前，先用 Mac 本地签名 feed 完成离线导入闭环：正常导入、重装、卸载、失败回滚、哈希篡改拒绝、签名错误拒绝、跨平台包拒绝、空间不足保护以及 Python venv 安装。确保 Mac 版应用只信任经审核的 Mac 密钥。

## 阶段 3：逐模块实机验收

完整的 13 模块、128 项任务和设备验收矩阵见执行计划第 6 节；不以本旧指南中的少量示例替代完整矩阵。完成后还需在干净 Apple Silicon 用户目录验证安装、首次启动、覆盖/移动/重装和数据保留；macOS 14 与后续 M 系列设备未实测前，不宣称目标范围已获实机验证。Apple Silicon CI runner 不能代替安装机验收。

## 当前实现与后续明确不做项

- 桌面壳构建入口、`.icns` 生成、arm64 原生依赖重建和手动 macOS 构建 workflow 已接入；M09-B02 的配置、workspace 构建、原生模块、staging 与 Electron ABI smoke 通过。真实 DMG 和安装验收尚未完成。
- Mac 专属目录现有十项正式签名 manifest；本机十项能力安装与自检通过。既有发布源仍待替换十个旧 manifest，并完成远端核验。
- 本机源码入口已通过两轮冷/热启动和停止；Finder 解压权限、原生窗口交互、真实移动设备与 Windows 备份迁移仍待验收。
- Developer ID 签名、公证、自动更新、Intel 支持和 Windows 历史数据自动迁移不在本轮范围。MPS 是本轮 Mac 目标能力的一部分，不等于 CUDA 支持。
- 正式公开分发另行加入 Developer ID 签名与 Apple 公证；更新版本需单独生成 DMG、ZIP 和 `latest-mac.yml` 并配好稳定更新源。

## 参考

- [Electron macOS 系统要求](https://www.electronjs.org/docs/latest/tutorial/support#supported-platforms)
- [Astral python-build-standalone 运行说明](https://github.com/astral-sh/python-build-standalone/blob/main/docs/running.rst)
- [FFmpeg 官方源码下载](https://ffmpeg.org/download.html)
- [Apple macOS 软件分发](https://developer.apple.com/macos/distribution/)
- [GitHub-hosted runner 规格](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
