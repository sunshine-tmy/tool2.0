# Windows 能力包准备与发布

## 抖音公开内容归档（匿名，MA04）

固定解析代码随应用发布，能力包仅包含受签名保护的协议描述，不复制第二套业务源码、不安装 Python。模板位于
`packaging/components/douyin-archive/adapter/manifest.json`；描述固定匿名模式、读取实现提交
`27468deae565fcb3d5a074063703d9df88449aed`、Playwright 1.63.0、Chromium revision 1243 / 153.0.8010.12。
共享浏览器资产沿用历史能力 ID `xhs-browser`，独立进程和全新内存会话不读取或复用小红书 Profile/Cookie。
本期不提供抖音登录、验证码绕过或环境变量 Cookie 注入。

在对应原生构建机上生成产物；Windows x64、macOS arm64 不能互相替代构建和实测：

```powershell
pnpm components:package -- `
  --definition scripts/component-definitions/douyin-archive.json `
  --stage packaging/components/douyin-archive `
  --output .package/component-feed `
  --github-release-url https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/ `
  --signing-key-file <受保护位置中的 Ed25519 私钥路径>
```

Windows x64 生成并复核后，需上传以下三个文件到既有 `components-v1` GitHub Release（生成目录为 `.package/component-feed`）：

```text
douyin-archive-1.0.0-anonymous-27468de.tar.gz
douyin-archive-1.0.0-anonymous-27468de.manifest.json
douyin-archive-1.0.0-anonymous-27468de.spdx.json
```

不要上传私钥。打包器输出的 `trusted-keys/<keyId>.pem` 是用于构建时登记受信任公钥的文件；只有在生成并审核
嵌入目录时将公钥加入应用，在线安装才会信任该 manifest。将三个 Release 资产和本地 feed 核对无误后，
还须在完整组件 feed 上运行 `pnpm components:catalog -- --feed .package/component-feed` 并重新构建应用；
仅上传 Release 文件不会更新已安装应用内的受信任目录。Mac arm64 必须在原生 Mac 构建机生成独立平台包和目录，不能复用 Windows 资产。

安装自检只校验本地协议/资产，不访问抖音；读取任务单次占用受管浏览器。桌面端由能力管理显式安装；
网页端不提供安装入口，在内嵌目录包含完整签名包时，首次归档会先安装 Chromium 依赖、再安装抖音适配器，
进度显示在归档任务中。状态检查本身不下载；所有在线安装仍由 ComponentManager 校验签名、归档摘要和文件清单。
浏览器已就绪后的匿名读取总时限为 120 秒，任务占用期间拒绝重装和卸载；适配器仍安装时禁止卸载浏览器依赖。
缺少目录条目、损坏或协议/实际浏览器版本不匹配时返回稳定错误，不回退系统浏览器。
卸载不清理归档、媒体、译文、截帧或永久音色。

运行状态接口为 `GET /api/v1/tools/media-archive/runtime/douyin`。状态查询成功不代表解析可用，应检查
`data.available`、`data.state` 与 `data.installMode`。`installMode=automatic` 表示网页首次归档可自动安装，
`managed` 表示桌面端由能力管理安装，`unavailable` 表示此构建未包含适配平台的完整签名目录。未安装时仍返回
`not-installed`，但只有前两种模式允许继续创建任务。响应不包含绝对路径、Profile 或认证状态。

截至 MA04 当前验收，只有隔离临时签名包与 Windows 生命周期/匿名读取验证通过；正式 Release 资产、
嵌入目录登记和 macOS 原生验收尚未完成。不要将测试公钥或测试包源写入正式目录，不要在正式资产发布前宣称旧安装包可用。
按现有发布流程上传清单、归档、SBOM 和公钥、核验远端资产后再生成正式目录，并重打桌面安装包。

AI 图片 CPU 包通过命令 pnpm components:prepare-image-ai -- --python .package/stage/python-311/python/python.exe --stage .package/stage/image-ai 准备。脚本使用哈希锁定的 CPU wheelhouse、固定 Hugging Face 模型提交和 SHA-256 固定权重，并将 worker、Real-ESRGAN、Big-LaMa、BiRefNet 与 PP-OCRv5 中文模型打入一个可离线自检的能力包。已缓存的上游模型文件可放在默认 .package/image-ai-source-assets 目录；每个文件都会在进入暂存目录前重新校验 SHA-256。准备后以 scripts/component-definitions/image-ai.json 生成签名产物，完成 Release 上传和核验前不会登记到嵌入式能力目录。

参考音色克隆 CPU 包通过 `pnpm components:prepare-chatterbox -- --python .venv-chatterbox/Scripts/python.exe --stage .package/stage/chatterbox` 准备。脚本验证 Python 环境中的 `chatterbox-tts` 元数据来自固定官方提交 `65b18437192794391a0308a8f705b1e33e633948`，并校验哈希锁定 wheelhouse 与 Hugging Face revision `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18` 下的全部模型文件。源码以 `vendor/` 随包发布；用户安装时仍在最终目标目录由共享 Python 3.11 运行时和锁定 wheelhouse 创建独立 venv，不打包构建机的 `.venv`。模型自动归入两个签名分片，但设置中仍作为一个 Chatterbox 能力管理。准备后使用 `scripts/component-definitions/chatterbox.json` 生成签名产物。当前锁定资产实际生成的三个归档约 3.4 GB；单个最大模型分片约 1.98 GB，小于 GitHub Release 单文件上限。

桌面 NVIDIA GPU 加速是独立可选扩展，不替换 CPU 基础包，也不再次下载模型。扩展 ID 为 `chatterbox-cuda`，依赖已安装的 `chatterbox` 与共享 `python-311`；卸载扩展会自动回退 CPU。该扩展锁定 PyTorch/torchaudio `2.6.0+cu124`，此组合见 [PyTorch 官方安装文档](https://docs.pytorch.org/get-started/previous-versions/)；需要 NVIDIA GPU 与兼容驱动，但不会安装或修改显卡驱动。CUDA 包只有在签名归档、SBOM 上传到既有 `components-v1` Release 并更新嵌入式目录后，才会出现在桌面版“设置 → 能力管理”中；已有安装包不会凭此源码改动自动获得 CUDA 包。

Windows PyTorch CUDA wheel 可能超过 GitHub Release 的单资产大小限制。准备器会把超限的 Torch wheel 切成有序分片，签名清单同时固定每片及完整 wheel 的大小和 SHA-256；桌面安装器校验所有分片后重组完整 wheel，校验整体 SHA-256，再离线安装并删除临时分片。不要手动改名、排序或替换这些分片。

构建 CUDA 扩展需准备一个安装了固定 Chatterbox 官方提交及 PyTorch CUDA 12.4 的 Python 3.11 环境（当前构建环境为 `.venv-chatterbox`），然后生成锁文件和 wheelhouse：

```powershell
pnpm lock:python
New-Item -ItemType Directory -Force .package/chatterbox-cuda-wheelhouse | Out-Null
.\.venv-chatterbox\Scripts\python.exe -m pip download `
  --require-hashes `
  --no-deps `
  --index-url https://pypi.org/simple `
  --extra-index-url https://download.pytorch.org/whl/cu124 `
  --dest .package/chatterbox-cuda-wheelhouse `
  -r scripts/chatterbox-cuda.lock.txt

pnpm components:prepare-chatterbox-cuda -- `
  --python .venv-chatterbox/Scripts/python.exe `
  --stage .package/stage/chatterbox-cuda `
  --wheelhouse .package/chatterbox-cuda-wheelhouse

# 将下面路径替换为安全保存的 Ed25519 私钥实际路径；不要把私钥加入暂存目录、仓库或 Release。
pnpm components:package -- `
  --definition .package/stage/chatterbox-cuda-definition.generated.json `
  --stage .package/stage/chatterbox-cuda `
  --output .package/component-feed `
  --github-release-url https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/ `
  --signing-key-file <受保护位置中的 Ed25519 私钥路径>
```

`--require-hashes` 必须保留，下载完成后准备器会再次按 lock 摘要校验 wheel 与上游仅发布为 sdist 的依赖，并将 Torch 与各 NVIDIA 运行时 wheel 分为单独签名归档。安装时在最终目录从 wheelhouse 离线创建新 venv，并检查 Torch CUDA 运行时确为 12.4；不要求打包构建机本身具备 NVIDIA GPU。完成能力归档与 SBOM 上传、远端资产核验后，再用 `pnpm components:catalog -- --feed .package/component-feed` 更新目录。最后重新构建/安装桌面应用，在“设置 → 能力管理”安装 GPU 加速扩展并运行真实短样例验收。不要在 CUDA 包与目录尚未发布时宣称现有桌面版本已可用 GPU。

共享 Python 运行时固定使用 Astral `python-build-standalone` 的 `20260901` Windows x64 `install_only_stripped` 资产。准备脚本会校验资产长度和 SHA-256，再验证 `python.exe`、`venv`、`ensurepip`、SSL 与 SQLite；不要把本机 `.venv` 复制进能力包。

| 能力        | 固定版本           |         下载大小 | SHA-256                                                            |
| ----------- | ------------------ | ---------------: | ------------------------------------------------------------------ |
| Python 3.11 | `3.11.16-20260901` | 25,189,257 bytes | `06cbe479e039f5b9cb5640c286d790074d63f549f92a32d599a3748293bd4510` |

官方上游资产：[python-build-standalone 20260901](https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz)。

准备阶段产物都放在被 Git 忽略的 `.package` 下：

```powershell
node scripts/prepare-python-311-runtime.mjs `
  --archive .package/python-311-upstream-stripped.tar.gz `
  --stage .package/stage/python-311

node scripts/prepare-edge-tts-component.mjs `
  --python .package/stage/python-311/python/python.exe `
  --stage .package/stage/edge-tts
```

两个准备脚本只生成暂存目录；Python wheelhouse 由 `scripts/edge-tts.lock.txt` 的哈希约束并仅允许 Windows wheel。签名私钥必须保存在受保护目录，不能放入暂存目录、Release 资产或 Git。

用 `scripts/component-definitions/python-311.json` 和 `edge-tts.json` 分别调用 `scripts/build-component-package.mjs`，输出目录都指定为 `.package/component-feed`，Release 地址固定为 `https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/`。每个版本需要上传其 `.manifest.json`、`.spdx.json` 和清单引用的全部 `.tar.gz` 文件；普通包通常是一个归档，大模型包可由多个归档分片组成。所有 GitHub Release 资产都必须上传，不得上传私钥。构建器会拒绝达到 2 GiB 的单个 GitHub 归档，并为分片清单签名每个资产摘要及互不重叠的文件路径。文件全部上传后，再运行：

```powershell
node scripts/assemble-component-catalog.mjs --feed .package/component-feed
```

该步骤会核验本地归档、SBOM、公钥 ID 和 Ed25519 签名，并更新后端嵌入式能力目录。合并目录变更前，先确认 GitHub Release 中存在清单引用的同名资产。

## 小红书归档、翻译与登录浏览器（阶段 6）

小红书桌面能力仅由“设置 → 能力管理”显式安装，不会因打开页面、提交任务或点击登录而下载运行时。Python 3.12 固定为 Astral `3.12.14+20260901` Windows x64 stripped build；XHS-Downloader 固定提交 `afaf2fb459980fccef9eec74e304a39af2c49cab`（2.7）；离线翻译固定 OPUS-MT `cf109095479db38d6df799875e34039d4938aaa6`；可选登录浏览器固定 Playwright 1.63.0 对应的 Chromium revision 1243 / `153.0.8010.12`。所有入包文件均经固定长度、SHA-256 或逐模型文件摘要验证。

Python 与 Chromium 上游归档固定信息：

| 资产                     |              大小 | SHA-256                                                            | 来源                                                                                                                                                                              |
| ------------------------ | ----------------: | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python 3.12 Windows x64  |  21,980,728 bytes | `7c45c9622400d578709a9b2cddbe8124cc21d382409d9f13406d706d28e31b14` | [Astral 20260901](https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.12.14%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz) |
| XHS-Downloader 源码 zip  |   3,470,287 bytes | `58155970bd3a246bb6bd692f6833ef4645c44a4d39c1080e93ce9c2a4d651004` | [固定提交归档](https://codeload.github.com/JoeanAmier/XHS-Downloader/zip/afaf2fb459980fccef9eec74e304a39af2c49cab)                                                                |
| Chromium Windows x64 zip | 205,123,748 bytes | `415968b02065d4a9e2c10b85f0ae9f489b8fba500e94d9d0a7b7c4852a7234c1` | [Chrome for Testing 153.0.8010.12](https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/win64/chrome-win64.zip)                                                 |

锁文件由 `scripts/lock-xhs-dependencies.ps1` 从固定 XHS 源码 `uv.lock` 导出，并为归档与翻译分别生成 Python 3.12 / Windows x64 哈希锁。需要更新依赖时先审核固定提交与锁差异，再重新准备包；不要手改锁文件，也不要把构建机虚拟环境打进能力包。一次性准备命令如下（归档路径必须使用上述同名文件）：

```powershell
Invoke-WebRequest `
  -Uri 'https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.12.14%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz' `
  -OutFile '.package/python-312-upstream-stripped.tar.gz'
Invoke-WebRequest `
  -Uri 'https://codeload.github.com/JoeanAmier/XHS-Downloader/zip/afaf2fb459980fccef9eec74e304a39af2c49cab' `
  -OutFile '.package/xhs-downloader-afaf2fb459980fccef9eec74e304a39af2c49cab.zip'
Invoke-WebRequest `
  -Uri 'https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/win64/chrome-win64.zip' `
  -OutFile '.package/chrome-for-testing-153.0.8010.12-win64.zip'

pnpm components:prepare-python-312 -- `
  --archive .package/python-312-upstream-stripped.tar.gz `
  --stage .package/stage/python-312
pnpm components:lock-xhs-dependencies -- `
  -SourceArchive .package/xhs-downloader-afaf2fb459980fccef9eec74e304a39af2c49cab.zip `
  -PythonExecutable .package/stage/python-312/python/python.exe
pnpm components:prepare-xhs-archive -- `
  --python .package/stage/python-312/python/python.exe `
  --archive .package/xhs-downloader-afaf2fb459980fccef9eec74e304a39af2c49cab.zip `
  --stage .package/stage/xhs-archive
pnpm components:prepare-xhs-translation -- `
  --python .package/stage/python-312/python/python.exe `
  --model <已准备并通过 manifest 校验的 opus-mt-zh-en-ct2-int8 模型目录> `
  --stage .package/stage/xhs-translation
pnpm components:prepare-xhs-browser -- `
  --archive .package/chrome-for-testing-153.0.8010.12-win64.zip `
  --stage .package/stage/xhs-browser
```

模型目录由 `pnpm prepare:xhs-model` 准备；准备脚本按固定 Hugging Face revision 下载并转换成 CPU int8 CTranslate2 格式。翻译验收必须以阶段暂存的 Python 创建全新 venv，从离线 wheelhouse 执行 `pip install --no-index --require-hashes`、`pip check`，再运行 `pnpm components:test-xhs-translation-smoke` 做中文→英文真实样例，不要用开发机已有 venv 代替。

四项签名包上传并登记目录后，在 Windows x64 构建机运行 `pnpm components:test-xhs-lifecycle`。该离线集成脚本会从本地签名 feed 经 `ComponentManager` 安装 Python 3.12、归档、翻译和 Chromium，执行安装自检；启动归档 Worker 两次并核对回环令牌与数据目录；用安装后新建的翻译 venv 做真实翻译；随后重装、验证共享 Python 依赖阻止卸载、卸载全部能力并检查独立数据哨兵未被删除。脚本在系统临时目录建立隔离测试根并于结束时清理，不访问小红书账号，也不修改用户现存数据。增加 `--online` 可从签名 manifest 的 GitHub Release URL 实际下载（需要出网；桌面应用启动时自动解析 Windows 系统 HTTPS 代理，独立手工运行时可通过临时环境变量 `TOOLBOX_COMPONENT_HTTPS_PROXY` 指定 HTTP(S) 代理）：

```powershell
$env:TOOLBOX_COMPONENT_HTTPS_PROXY = 'http://代理主机:端口'
pnpm components:test-xhs-lifecycle -- --online
```

签名包定义分别是 `python-312.json`、`xhs-archive.json`、`xhs-translation.json`、`xhs-browser.json`。沿用本目录前文的 `pnpm components:package` 命令格式，将四个包分别输出到 `.package/component-feed`，版本/清单文件名由定义文件决定；每个包都要上传 `.manifest.json`、`.spdx.json` 与清单引用的 `.tar.gz` 到既有 `components-v1` GitHub Release。最后核对远端资产清单与本地 feed 一致，再运行 `pnpm components:catalog -- --feed .package/component-feed` 更新嵌入目录。不能在资产尚未上传时发布引用它们的目录。

能力卸载不会删除归档、任务历史、翻译结果、Cookie 或浏览器 profile。归档 Worker 的上游 `Volume` 强制通过 `XHS_VOLUME_DIR` 指向用户数据目录；登录 Cookie 与持久化浏览器 profile 写入 `data/profile/xhs-archive`。浏览器包可选：检测到已安装 Chrome/Edge 或可复用的既有 Playwright 浏览器时，无需另装 Chromium；能力包只为没有现成浏览器的用户提供固定 Chromium，不会触发 Playwright 在线下载。
