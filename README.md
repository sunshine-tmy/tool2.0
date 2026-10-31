# 电商工具箱

启动异常时可从顶部状态或设置进入“启动与环境诊断”；开发环境运行 `pnpm run doctor`（只读，不会安装、清端口或修改配置）。详细说明见 [启动与环境诊断](docs/startup-diagnostics.md)。

一个本地优先、免账号登录的电商素材处理工作台，提供 Windows 桌面安装版、Apple Silicon macOS 内部测试包和 Web/开发版。项目以 pnpm workspace 管理 Vue 前端、Fastify API、共享 TypeScript 契约和可选 Python AI Worker，适合个人电脑或可信局域网部署。

> [!WARNING]
> 本项目包含文件上传、下载、删除和高计算量 AI 接口。`local` 模式默认只监听 `127.0.0.1`；`lan` 模式必须配置 `ADMIN_PIN`，管理写操作使用 HttpOnly 会话 Cookie、CSRF Header 和精确 Origin 校验，访客传输权限仍由 guest mode 控制。不要把 API 或 AI Worker 直接暴露到公网。

## 目录

- [功能矩阵](#功能矩阵)
- [选择使用方式](#选择使用方式)
- [技术架构](#技术架构)
- [开发环境要求](#开发环境要求)
- [新克隆项目首次初始化](#新克隆项目首次初始化)
- [手动初始化与 Worker 开发](#手动初始化与-worker-开发)
- [快速启动](#快速启动)
- [配置](#配置)
- [可选能力安装](#可选能力安装)
- [全功能验收清单](#全功能验收清单)
- [开发与质量命令](#开发与质量命令)
- [构建 Windows 桌面安装包](#构建-windows-桌面安装包)
- [Apple Silicon macOS 内部测试包](#apple-silicon-macos-内部测试包)
- [生产构建与部署](#生产构建与部署)
- [SQLite 迁移与回滚](#sqlite-迁移与回滚)
- [数据、安全与隐私](#数据安全与隐私)
- [API 与响应约定](#api-与响应约定)
- [新工具接入规范](#新工具接入规范)
- [常见问题](#常见问题)
- [项目范围与第三方资产](#项目范围与第三方资产)

## 功能矩阵

| 模块           | 前端路由                | API 命名空间                    | 能力                                                                                                                                                          |
| -------------- | ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 图片压缩       | `/tools/image-compress` | `/api/v1/tools/image-compress`  | JPEG/PNG/WebP 批量压缩、缩放和格式转换                                                                                                                        |
| AI 图片处理    | `/tools/image-ai`       | `/api/v1/tools/image-ai/*`      | 去水印、清晰度增强、商品图抠图，本地模型推理                                                                                                                  |
| 局域网文件传输 | `/tools/lan-transfer`   | `/api/v1/tools/lan-transfer/*`  | 文件断点续传、剪贴板粘贴上传、图文快传、图片/视频/PDF/Office 预览和过期清理                                                                                   |
| 多国语言配音   | `/tools/edge-tts`       | `/api/v1/tools/edge-tts/*`      | Edge-TTS 在线配音与 Chatterbox V3 本机声音克隆                                                                                                                |
| 直播音频库     | `/tools/audio-library`  | `/api/v1/tools/audio-library/*` | 克隆结果一键永久归档、本地上传、双语检索、分类分组、队列播放与备份恢复；[使用说明](docs/audio-library.md)                                                     |
| 多媒体内容归档 | `/tools/media-archive`  | `/api/v1/tools/media-archive/*` | 小红书、抖音与 TikTok 内容获取、本地存档、翻译、截帧及导出；支持[批量上传本地视频](docs/local-video-archive.md)，继续配乐和水印编辑；线上获取仅接受可访问作品 |

## 选择使用方式

| 使用方式                     | 适用场景                                    | 数据位置                                              | 说明                                                                                    |
| ---------------------------- | ------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Windows 桌面安装版           | 日常使用，不需要 Node.js 或 Python 开发环境 | 安装向导所选目录下的 `data/`                          | 从 GitHub Releases 获取 `EcommerceToolboxSetup.exe`；可选能力在“设置 → 能力管理”中安装  |
| Apple Silicon macOS 内部测试 | M 系列 Mac 上验证桌面壳与 Mac 原生能力包    | `~/Library/Application Support/EcommerceToolboxData/` | 通过 GitHub Actions 手动构建内部 DMG；未生成并签名 Mac 能力包前，不代表全部业务模块可用 |
| Web/开发版                   | 开发、调试或在可信局域网内共享工具          | 默认仓库根目录的 `storage/`                           | 使用 `start.bat` 或 `pnpm dev` 启动；可选 Worker 与模型按需配置                         |

桌面版安装、数据迁移、能力离线导入、升级和卸载说明见[桌面应用使用帮助](./docs/desktop-application-help.md)。桌面安装器是交互式安装程序，不是免安装便携版；安装时可选择目录，但应选择当前 Windows 用户有写入权限的位置。

Apple Silicon macOS 首版边界、DMG 构建、原生能力包准备顺序及实机验收门槛见[macOS 迁移与内部测试指南](./docs/macos-apple-silicon-build.md)。当前 Mac 能力目录在经过签名与实机验收前保持为空。

## 技术架构

下图中的 `storage/` 路径描述 Web/开发版。Windows 桌面安装版把应用管理的持久数据放在安装根目录下的 `data/`，见下方桌面安装说明。

```text
Browser
  └─ Vue 3 + TypeScript + Vite + Naive UI
       └─ /api（开发/预览由 Vite 反向代理）
            └─ Fastify + TypeScript
                 ├─ Sharp：图片压缩与输出清洗
                 ├─ Python AI Worker：抠图、增强、去水印（可选）
                 ├─ Chatterbox V3 Worker：参考音色克隆（可选）
                 ├─ XHS-Downloader Worker：开发版可按需配置；桌面版由能力管理安装
                 ├─ SQLite（storage/toolbox.db）：元数据、任务与审计事实源
                 └─ storage/：媒体、模型、临时文件与迁移备份
```

```text
apps/web/                 Vue 前端
apps/api/                  Fastify API、任务与存储逻辑
apps/desktop/             Electron 桌面应用
packages/shared/          前后端共享类型、响应结构和领域工具
packages/runtime-core/    Node 专用路径、配置原语及诊断日志
scripts/                  公开命令入口、Python Worker、锁文件与能力定义
tooling/                  启动、构建、能力准备、质量与测试的工程实现
storage/                  SQLite、媒体、临时文件和迁移备份（不提交 Git）
packaging/standalone/     由发布流水线使用的启动器与分发模板
models/                   本地模型权重（不提交 Git）
docs/api.md               API 说明
docs/operations.md        启动、权限、迁移、隔离区与发布运维手册
docs/architecture.md      当前目录、依赖边界与新功能落点
docs/refactoring/README.md R00–R12 重构进度与各阶段验收
docs/enterprise-optimization-backlog.md  历史优化验收记录（非当前任务清单）
```

前后端源码已迁至 `apps/api/` 和 `apps/web/`，workspace 包名仍为 `backend`、`frontend`，既有 `pnpm --filter ...`、启动和打包命令不变。
配置、`storage/`、`.runtime/`、模型及 `offline-resources/` 不随源码迁移；旧 `backend/`、`frontend/` 中被忽略的数据或缓存不会自动搬动、删除。
桌面分发资源仍使用 `resources/backend`、`resources/frontend`。分阶段改造记录见 [重构进度](docs/refactoring/README.md)。
当前代码归属、保留入口及三类路径的映射见 [架构与开发指南](docs/architecture.md)；文档状态及历史记录的阅读方式见 [文档导航](docs/README.md)。

## 开发环境要求

以下是从源码运行或构建项目所需的环境：

- Node.js `>=24 <25`
- pnpm `>=11 <12`，项目锁定 `pnpm@11.7.0`

Web/开发版按功能可选：

- PowerShell 5.1+：Windows 一键启动与环境安装脚本
- FFmpeg / ffprobe：配音音频处理、合并及时长探测；需能从终端调用，或配置对应可执行文件路径
- Python 3.12：配音和图片 AI
- NVIDIA GPU 与兼容驱动：可选加速条件；当前源码安装脚本默认安装 CPU 依赖，仅有显卡不会自动获得 CUDA 推理能力

Windows 桌面安装版不要求用户预装 Node.js 或 Python；可选能力会在设置中显示所需运行时、下载量和空间估算。模型和大型 Worker 不包含在基础安装器内。

## 新克隆项目首次初始化

本指南面向**没有旧项目、旧模型、虚拟环境、离线包或业务数据的新用户**。以下完整流程以 **Windows x64、CPU 推理、默认商业用途**为基线；GPU 加速是可选增强，BRIA 非商用模型不是使用抠图功能的前提。macOS 当前仍是内部测试路径，不承诺照此达到全部功能可用。

两条路径任选其一，不要混用运行环境：

- **只使用软件**：按[桌面版从零安装全部业务能力](#windows-桌面安装版)操作，无需克隆源码，也无需系统 Node.js 或 Python。
- **换电脑继续开发或从源码运行**：克隆源码，准备下方清单中的本地能力包，再双击 `start.bat`；最后按[全功能验收清单](#全功能验收清单)逐项验证。

先安装 [Git for Windows](https://git-scm.com/install/windows)，克隆并进入项目目录：

```powershell
git clone https://github.com/sunshine-tmy/tool2.0.git
Set-Location .\tool2.0
```

### 双击 start.bat 前要准备什么

1. **完整源码目录**：根目录应有 `start.bat`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.env.example`、`scripts/`、`tooling/`、`apps/api/`、`apps/web/`、`apps/desktop/` 和 `packages/`。保留 Git clone 或 GitHub ZIP 中的全部源码及配置，不要只复制启动文件；公开脚本会调用 `tooling/` 中的实现。
2. **当前版本的 CPU 能力包**：按[逐文件下载清单](docs/source-resources.md)用浏览器或可信下载工具下载 9 项能力的 **11 个 `.tar.gz` 文件**，全部放进项目根目录的 `offline-resources/components/`。保持文件名，**不解压**。Python、FFmpeg、Chromium、图片/配音/翻译模型和 Python 离线依赖都在这些包内，不需要另找模型文件。
3. **Node/pnpm 可选离线包**：已有 Node 24 x64 会复用；没有时启动器可自动准备。若自动下载也不稳定，将清单中的 `node-v24.22.1-win-x64.zip` 和 `pnpm-11.7.0.tgz` 放进 `offline-resources/bootstrap/`，同样不解压。

目录示例（这些压缩包被 Git 忽略，不上传到源码仓库）：

```text
tool2.0/
├─ start.bat
├─ .env.example
├─ offline-resources/
│  ├─ bootstrap/                 # 可选；已安装工具或有效缓存可复用
│  │  ├─ node-v24.22.1-win-x64.zip
│  │  └─ pnpm-11.7.0.tgz
│  └─ components/                # 必备：清单中 11 个 CPU 能力归档
│     ├─ python-312-3.12.14-20260901.tar.gz
│     ├─ image-ai-1.0.0-py312-cpu1.tar.gz
│     ├─ chatterbox-1.0.0-py312-cpu1.tar.gz
│     ├─ chatterbox-1.0.0-py312-cpu1-model-t3.tar.gz
│     ├─ chatterbox-1.0.0-py312-cpu1-model-s3gen.tar.gz
│     └─ ...其余文件见逐文件下载清单
├─ scripts/
├─ tooling/                       # 启动器及其他工程实现，不能省略
├─ apps/                          # api、web、desktop
└─ packages/                      # shared、runtime-core
```

也支持将已有离线备份按 `offline-resources/components/能力ID/版本/文件名` 原样复制进来；无须改为平铺。只认当前源码内置的签名版本，不会扫描其他磁盘或猜测旧包是否可用。新电脑不需要旧项目的 `.env`、Python 3.11、`.venv-*`、`node_modules`、私钥或登录态。不要直接迁移带原电脑绝对路径的已安装环境。

如果不知道缺什么，可直接双击 `start.bat`：它会在下载 Node、安装源码依赖或导入能力前，**一次列出所有缺失/大小不符的能力文件、下载地址和实际放置目录，然后停止**；不会反复尝试下载大文件。也可用不依赖 Node、无写入的清单命令：

```powershell
.\start.bat -ListResources
```

### 准备好资源后，一条命令启动

双击根目录 `start.bat`，或执行：

```powershell
.\start.bat
```

**需要 NVIDIA 参考音色克隆 GPU 加速时：11 个 CPU 包还不够，需再准备 4 个 GPU 归档，共 15 个。** 将[下载清单](docs/source-resources.md)中 GPU 小节的全部 `chatterbox-cuda` 文件放到同一个 `offline-resources/components/` 目录，保持原名、不解压，然后双击根目录 **`start-gpu.bat`**，或执行：

```powershell
.\start.bat -WithCuda
```

GPU 入口复用已有 CPU 能力与模型，只补装缺少或版本不符的扩展；不重复下载模型，不修改驱动。**只放入 GPU 包再双击普通 `start.bat`，不会自动安装扩展。** 已启动 CPU 实例时，先通过 `stop.bat` 正常停止，再使用 GPU 入口；安装过程中不得同时启动另一个实例。需要兼容的 NVIDIA 显卡和驱动，普通虚拟机或无 NVIDIA 显卡的电脑仍使用 CPU 入口；安装完成不等于真实 GPU 生成已通过验证。此扩展仅加速参考音色克隆，不会把当前 CPU 图片能力改为 GPU 版本。

无需预先在系统安装 Node、pnpm、Python 或 FFmpeg。Windows x64 一键入口依次执行：

1. 检查平台、独占启动锁及服务端口；已有实例或端口被占用时提示停止，不自动结束未知进程。
2. 从 `.env.example` 创建缺少的 `.env`，已有配置保留。
3. 复用系统已有 Node 24 或已校验缓存；否则优先从 `offline-resources/bootstrap/` 准备固定版本 Node/pnpm，缺少本地包才尝试固定来源下载。Node 使用 SHA-256、pnpm 使用 SHA-512 校验；本地包校验失败就停止，不静默改走网络。只修改当前启动进程及子进程的 PATH，不全局安装，不提权。
4. 按锁文件安装源码依赖，实际验证 SQLite 内存读写和 Sharp 图片编码，再构建共享契约；不接触业务数据库和素材。
5. 从本地能力包按依赖顺序离线导入九项 CPU 基础能力，校验签名、大小、摘要与文件清单，创建 Python 3.12 隔离环境并执行安装自检。源码启动入口禁止自动联网下载能力包；已安装且版本、状态正常的能力复用，没有本地归档也可正常日常启动。
6. 由 API 管理受管 Worker，启动前后端并在就绪后打开浏览器。安装自检不代表第三方服务、平台登录和真实素材生成已验收。

能力归档合计数 GiB，建议至少 16 GB 内存，并为离线包、安装目录和临时解压预留数十 GB 可用空间。首次本地解压和安装 Python 依赖可能持续数分钟；终端显示真实阶段、归档字节和文件数量，不制造百分比。失败后修正文件或磁盘问题，再执行同一命令，复用已完成能力；原始离线包会保留，不重新从 GitHub 下载。

构建 Python 环境时单独显示五个子步骤、已解析依赖数、最近解析的依赖及最近安装器输出时间，不再用 `0/141` 这类归档文件数表示 Python 安装进度。依赖解析完成不等于安装完成；写入大量文件和处理字节码仍可能耗时数分钟，没有新输出时也不会伪造百分比或宣称安装器已卡死。终端不直接打印安装器原始路径、凭据或未知输出。

**普通源码依赖仍由 pnpm 按锁文件安装，可能联网**，本流程不是全离线开发工具链。遇到 npm 或 Electron 依赖下载问题，按实际错误检查对应来源；不能用换 npm 镜像解决能力包来源问题，也不要关闭 TLS 校验或删除锁文件。`-BuildDesktop` 只准备构建工具和源码依赖，不要求先准备业务模型包；桌面打包工具的首次获取也可能联网。

一键模式使用 `.runtime/bootstrap/` 中的工具和 `.runtime/packages/` 中的签名能力；业务数据仍默认在 `storage/`，保留 `.env` 指定的存储、数据库及网络配置。**不启动、不删除旧 `.venv-*`，也不使用 `.env` 中自定义的 Python/Worker/模型路径**；需要编辑 Python Worker 源码时使用下面的手动开发路径。已安装能力包内的脚本不是当前 `scripts/` 文件的实时副本。

启动后仍须按页面指引完成本人平台登录、必要的系统网络授权，并做实际业务验收。在线自然配音与在线归档仍需联网；一键安装不能绕过验证码、限流或保证外部服务一直可用。停止时运行 `stop.bat`，不要直接删除运行目录。

可选参数（都通过同一个入口）：

| 命令                             | 用途                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `.\start.bat -PlanOnly`          | 只显示计划，不下载、不安装、不启动，也不修改文件；不是完整环境检查                        |
| `.\start.bat -ListResources`     | 列出当前源码要求的文件、下载地址和放置目录；不依赖 Node，不下载、不安装、不修改文件       |
| `.\start.bat -PrepareOnly`       | 准备全部 CPU 基础能力后退出，不启动业务服务                                               |
| `.\start.bat -NoBrowser`         | 正常准备及启动，但不自动打开浏览器                                                        |
| `.\start.bat -WithCuda`          | 明确追加克隆 GPU 加速包；需自行准备兼容的 NVIDIA 显卡与驱动，不会修改驱动                 |
| `.\start-gpu.bat`                | 可直接双击的 GPU 入口，等价于 `start.bat -WithCuda`；首次共需 15 个能力归档               |
| `.\start-gpu.bat -ListResources` | 列出 CPU 与 GPU 全部 15 个归档；不下载、不安装                                            |
| `.\start.bat -BuildDesktop`      | 使用同一套 Node/pnpm 构建桌面测试安装包，不下载业务能力或启动服务；仅明确执行该命令才打包 |

换电脑时，重新克隆源码并复制/下载本节清单对应版本的离线包，再用默认命令即可。UI/API 支持源码开发；若需修改 Python Worker 本身、调试安装细节或自行管理运行时，使用下节，不要误以为能力包内 Worker 会随 `scripts/` 自动热更新。

维护者更新内置签名能力目录后，应执行 `pnpm source:resources`，同步启动前置清单和下载文档；自动化测试会拒绝与签名目录或 Node/pnpm 固定版本不一致的清单。

## 手动初始化与 Worker 开发

本节是高级开发替代路径，**不是一键启动的前置步骤**；不要与已运行的一键受管实例并行启动。此路径需自行安装 Node 24、pnpm 11.7.0、Python 3.12 和 FFmpeg，首次需联网访问依赖及模型来源。

### 1. 安装源码运行所需工具

以下命令在 **PowerShell** 中执行，不是在 Git Bash 中执行。

1. 安装 [Git for Windows](https://git-scm.com/install/windows)。
2. 从 [Node.js 下载页](https://nodejs.org/en/download)选择 **24.x、Windows x64**，不要直接选其他主版本。
3. 安装 pnpm，并重新打开终端验证：

```powershell
npm install --global pnpm@11.7.0
git --version
node --version
pnpm --version
```

4. 从 [Python Windows 下载页](https://www.python.org/downloads/windows/)安装 Python 安装管理器，再按[官方 Windows 安装说明](https://docs.python.org/3/using/windows.html)安装 **Python 3.12 x64**。已经有能运行 `py -3.12` 的完整 3.12 环境可跳过安装。不要选 32 位、嵌入式包或把 Python 3.13+ 当作替代。

```powershell
# 这条安装命令适用于新的 Python 安装管理器，不适用于旧版 Python Launcher。
py install 3.12
py -3.12 --version
py -3.12 -m pip --version
```

5. 从 [FFmpeg 下载页](https://ffmpeg.org/download.html)的 Windows 构建入口获取含 `ffmpeg.exe` 和 `ffprobe.exe` 的 x64 可执行包，解压到固定目录，把其 `bin` 目录加入**当前用户** PATH 后重新打开终端。FFmpeg 官网的源码压缩包不是可直接运行的 Windows 工具。

```powershell
ffmpeg -version
ffprobe -version
```

6. 准备可用的 Chrome 或 Edge，供小红书登录使用；抖音归档使用单独下载的受管 Chromium。无需自行安装系统 CUDA，也无需安装 Python 3.11。

不同使用目的的环境区别如下；本节后续步骤按“源码全功能”准备：

| 用途                        | 必要准备                                                           | 不必提前准备                                     |
| --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| 启动基础 Web/开发版         | Git、Node.js 24、pnpm 11.7.0、项目依赖、`.env`                     | Python、模型、离线能力包、签名私钥               |
| 开发版使用配音或图片 AI     | 上述环境，加 Python 3.12 和对应模块环境；配音还需 FFmpeg / ffprobe | 不使用的模块环境、CUDA 加速依赖                  |
| 构建 Windows 桌面测试安装包 | Windows x64、上述 Node.js / pnpm 与项目依赖；可访问构建依赖下载源  | 预先运行 API、源码 AI 环境和模型、能力包签名私钥 |
| 仅安装和使用已有桌面安装包  | Windows 及安装包；按需安装或离线导入能力                           | Git、Node.js、pnpm、系统 Python                  |

### 2. 克隆并进入仓库根目录

```powershell
git clone https://github.com/sunshine-tmy/tool2.0.git
Set-Location .\tool2.0
```

后续命令都应在包含 `package.json`、`pnpm-workspace.yaml` 和 `.env.example` 的仓库根目录执行。若克隆时提示无法连接 `github.com:443`，先看[克隆或依赖下载失败](#克隆或依赖下载失败)，不是通过删除源码或重新安装 Python 解决。

### 3. 创建本机配置并安装锁定依赖

```powershell
# 新克隆目录从示例创建本机配置；重复执行时不覆盖已有配置。
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
pnpm install --frozen-lockfile
pnpm build:shared
pnpm doctor
```

每条命令成功后再执行下一条。`pnpm doctor` 只诊断，不会自动修复；尚未启动 API、可选组件未安装时会有相应提示，不代表依赖安装失败。`pnpm build:shared` 生成共享包，首次初始化或修改共享契约后可重新执行。

首次安装可能下载 Electron、Sharp、SQLite 等依赖或预编译文件，需要联网。原生依赖构建白名单已配置在 `pnpm-workspace.yaml`；不要通过 `--ignore-scripts` 跳过必要安装步骤，也不要盲目放行所有依赖脚本。安装失败先处理网络、Node 版本或具体原生依赖错误，不要删除锁文件改装另一组依赖。

当前锁定的 `better-sqlite3 13.x` 随 npm 包提供支持平台的 Node-API 原生文件，因此明确禁止它的隐式安装期 `node-gyp` 构建。若旧源码配置在干净电脑上提示 `gyp ERR! find Python`，先更新项目的 `pnpm-workspace.yaml` 及一键入口相关文件后重试；这不是要求用户为了运行数据库额外安装系统 Python 或 Visual Studio。其他依赖的必要安装脚本仍保留，桌面打包时显式执行的原生重建也没有因此被禁用。

默认 `.env` 适合本机使用，无需填写 API Key。保留 `DEPLOYMENT_MODE=local`、同源 API 配置和默认数据目录即可；局域网共享与自定义端口见[配置](#配置)。

### 4. 安装三个源码 Python 环境并下载模型

在仓库根目录、同一个 PowerShell 窗口中，逐条执行；任一步失败先处理错误，不要继续把整个初始化当作成功：

```powershell
$Python312 = (& py -3.12 -c "import sys; print(sys.executable)").Trim()
& $Python312 -c "import sys, struct; assert sys.version_info[:2] == (3, 12) and struct.calcsize('P') == 8; print(sys.executable)"

# 在线自然配音环境。
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-edge-tts.ps1 -Python $Python312

# 参考音色克隆 CPU 环境；会下载并实际加载模型。
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-chatterbox.ps1 -Python $Python312 -DownloadModel

# 图片 AI CPU 环境；下载去水印、增强、抠图及 OCR 所需模型。
# OCR 缓存与默认 Worker 使用相同位置，避免初始化到另一个用户缓存目录。
$env:PADDLE_PDX_CACHE_HOME = Join-Path (Get-Location).Path 'storage\image-ai\cache\paddlex'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-image-ai.ps1 -Python $Python312
```

若没有 `py` 命令，可直接将 `$Python312` 设为自己安装的 Python 3.12 `python.exe` 完整路径，再执行验证和三个安装命令。三个 `.venv-*` 是同一 Python 3.12 的隔离依赖环境，不是要求安装三个 Python 版本。

第一次安装不要使用 `-SkipModels`。依赖安装成功不等于权重已下载成功，尤其应留意模型下载、摘要校验及预加载的错误输出。图片 OCR 初次实际使用仍可能准备额外缓存；先保持联网完成验收。上述 OCR 缓存命令适用于默认配置，若另设 `IMAGE_AI_STORAGE_ROOT` 或 `PADDLE_PDX_CACHE_HOME`，初始化与运行必须使用同一路径。

### 5. 启动前后端及两个 Worker

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1 -NoInstall
```

前面已手动装好依赖，此处 `-NoInstall` 避免重复安装。它仍会启动已安装的源码图片 AI、Chatterbox Worker，再启动 API 和前端；不是禁用模型加载或把所有功能切为离线。以后继续用此命令开发 Worker；`start.bat` 是另一条签名能力路径，不会自动复用这些源码虚拟环境。

打开 <http://127.0.0.1:5173>，检查 API 健康地址 <http://127.0.0.1:3100/api/v1/health>。基础服务会创建数据目录和 SQLite 数据库，无需手工建库。启动日志中的图片 Worker `http://127.0.0.1:3210/health` 和克隆 Worker `http://127.0.0.1:3220/health` 应能响应；健康接口正常仍需下一步的实际业务验证。

`pnpm dev` 仅用于单独开发前端/API，不会启动这两个 Worker，不能替代这里的全功能启动方式。不要同时执行多个启动命令。源码方式的启动终端需要保持开启；关闭时运行 `stop.bat`。桌面应用关闭与源码进程管理是两套独立生命周期。

### 6. 完成归档、浏览器和翻译的首次初始化

这些资源不由上面的三个 Python 安装脚本准备，需要在服务正常后通过页面完成：

1. 打开“多媒体内容归档”，选择小红书，用自己有权保存、公开可访问的作品链接执行“获取并存档”。开发版首次任务会下载固定源码、uv 及所需依赖到 `.runtime/xhs-downloader`；若需登录，按页面“登录小红书并重试”完成本人账号登录，不绕过验证码。
2. 在成功的中文存档上执行“生成英文”或列表中的补译操作，等待 `.runtime/xhs-translate` 中的翻译环境与固定模型安装，并确认英文已生成。首次存档后也可能自动触发后台翻译，需等到翻译完成，而不只是中文已保存。
3. 选择抖音，用公开且允许匿名访问的作品链接执行获取。Windows 开发版会按内置签名清单依次安装受管 Chromium 与抖音匿名归档能力，不复用先前创建的三个 Python 环境。等待安装和任务结束，再检查媒体、截帧与下载。
4. 如需另一台设备访问，完成[局域网配置](#开发版局域网与自定义端口配置)并重启，再从另一台设备执行上传和下载测试。本机页面打开不代表跨设备网络已验证。

平台限制、网络拦截或模型下载失败都可能导致初始化未完成；请按页面原因处理后重试，不要据此宣称所有模块已就绪。完成后继续执行[全功能验收清单](#全功能验收清单)。

所有环境和模型都能按上述流程重新获取，**不需要任何旧目录或原作者的签名私钥**。运行产生的 `.env`、`.venv-*`、模型、数据和缓存不会提交到 Git；后续备份自己的数据即可。源码 Python 环境与桌面受管能力不同，不要互相复制替代。

## 快速启动

### Windows 桌面安装版

这条路径同样面向没有任何开发环境和旧资源的新电脑，**不用先执行源码初始化**。

1. 从 [GitHub Releases](https://github.com/sunshine-tmy/tool2.0/releases) 中下载 Windows 桌面发行版的 `EcommerceToolboxSetup.exe`，不是 GitHub 自动生成的 Source code ZIP，也不是 `.tar.gz` 能力包。若当前没有可用的桌面发行资产，按[桌面构建说明](#构建-windows-桌面安装包)从源码生成测试安装器，不能把源码 ZIP 直接当作安装器。
2. 运行安装器，在向导中选择当前用户可写、空间充足的目录。此模式不支持 Program Files 等受保护目录。首次联网安装需要同时保留包下载、临时解压和安装后的空间，以能力卡片提示为准。
3. 从快捷方式启动，等待顶部显示基础服务正常，再进入“设置 → 能力管理”，按下表依赖顺序安装。为了使用全部业务功能，表中基础能力不能只挑一部分安装。

| 顺序 | 安装能力                                               | 用途与依赖                                                                 |
| ---- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1    | Python 3.12 共享运行时、FFmpeg 共享媒体运行时          | 后续配音、图片及小红书能力的基础依赖；不用在系统另装 Python / FFmpeg       |
| 2    | AI 图片处理（CPU）                                     | 依赖 Python 3.12，包含去水印、增强、商业抠图和 OCR 模型                    |
| 3    | 参考音色克隆（CPU）、在线自然配音（Edge-TTS）          | 都依赖 Python 3.12 和 FFmpeg；自然配音合成时仍需联网                       |
| 4    | 小红书内容归档运行时、小红书中英离线翻译               | 依赖 Python 3.12；翻译模型随能力安装，在线获取仍需联网                     |
| 5    | 小红书登录浏览器（Chromium）、抖音公开内容归档（匿名） | 先浏览器后抖音；即使系统有 Chrome/Edge，抖音仍需要受管 Chromium            |
| 可选 | 参考音色克隆 GPU 加速                                  | 先装克隆 CPU 能力，另需兼容的 NVIDIA 显卡与驱动；不安装也可用 CPU 完成克隆 |

每次安装都应等到校验、自检结束，再安装依赖它的下一项；仅显示“已安装”不能替代实际业务验收。CPU 路径即可覆盖当前六个业务模块，不要求每台机器都支持 GPU 或非商用专用模型。

4. 安装下载失败时，无需已有离线包：在任意网络可用的电脑打开能力卡片提供的 [能力发布页](https://github.com/sunshine-tmy/tool2.0/releases/tag/components-v1)，下载该卡片要求的**全部同版本 `.tar.gz` 文件**，传到目标电脑，通过卡片“离线导入”一次选中。不要改名、解压、混版或凭文件名猜版本；共享依赖也要先分别导入。离线导入只能解决安装资源获取，不能让在线配音和在线归档在断网时工作。
5. 首次小红书获取如需认证，在桌面主机按页面指引登录本人账号；抖音仅测试匿名公开作品。然后逐项执行[全功能验收清单](#全功能验收清单)，包括实际生成、预览和下载，而不只是能力列表变绿。
6. 如需局域网使用，从顶部网络入口或“设置 → 局域网访问”复制实际地址，在另一台可信设备验证。无需修改源码 `.env`；安装能力、平台登录及诊断修复仍在桌面主机完成，使用期间保持桌面应用开启。

应用管理的数据默认保存在 `<安装目录>\data`。如果检测到旧版 `%LOCALAPPDATA%\EcommerceToolboxData`，首次启动会先询问是否迁移；旧源保留不删除。普通卸载、静默卸载和升级默认保留数据，只有在交互卸载中主动选择并再次确认才会删除。详见[桌面应用使用帮助](./docs/desktop-application-help.md)。

### Windows 一键启动（源码/开发版）

首次和日常使用均可执行，不需要先手动准备 Node / Python / 模型：

```powershell
.\start.bat
```

这是[一键初始化与启动](#新克隆项目首次初始化)入口，复用签名能力及受管 Worker。正在启动/运行时再次点击会提示使用已有窗口，不会并发重装；已有服务或其他程序占用端口时会停止并提示，不自动终止进程。原 `scripts/start-dev.ps1` 继续保留给[手动源码环境开发](#手动初始化与-worker-开发)，不要把它的参数直接当成 `start.bat` 的参数。

需要完全关闭项目并释放前端、后端和本地 AI Worker 占用的 CPU、内存及显存时，双击或运行：

```powershell
.\stop.bat
```

关闭脚本会识别本项目的进程树并释放 `3100`、`5173`、`3210`、`3220` 端口，不会结束恰好占用这些端口的其他程序。

如需清空缓存、构建产物、日志和工具运行期间生成的本地数据，可双击：

```powershell
.\一键清理缓存和运行数据.bat
```

脚本会先按分类显示文件数量和预计释放空间，再让你用编号多选并二次确认。小红书永久存档属于高风险项且默认不选；`node_modules`、Python 环境、模型、`.env` 和小红书登录态始终保留。macOS 可双击 `macOS一键清理缓存和运行数据.command`。

> [!WARNING]
> 清理脚本的“打包产物”类别会清理整个 `.package/`，`pnpm clear:generated` 的默认项也包含该目录。若其中保存了离线能力包、构建源资源或需要保留的缓存，先备份到仓库外，并在交互清理时取消该类别；不要把整个 `.package/` 视为无用临时文件。运行数据类也应逐项确认，不要用清空数据解决启动故障。

需要把源码交付给其他人时，双击：

```powershell
.\package-source.bat
```

脚本通过 `git archive HEAD` 在 `.package/ecommerce-toolbox-source.zip` 生成可复现源码包，只包含当前提交；未提交和未跟踪文件不会进入产物，中文 Git 路径也不会被转义破坏。Windows x64 接收方解压后可运行 `start.bat` 联网初始化；这仍不是自带全部运行环境的免安装包，首次需要下载依赖与能力。

### 通用命令行启动（Web/开发版）

以下仅启动前端和 API，适合基础开发；首次仍需创建 `.env`。要使用全部功能，请走前面的[完整初始化与 Worker 启动流程](#新克隆项目首次初始化)，不要到这里就结束安装。

```bash
pnpm install --frozen-lockfile
pnpm build:shared
pnpm dev
```

- 本机访问：<http://127.0.0.1:5173>
- API 健康检查：<http://127.0.0.1:3100/api/v1/health>
- 局域网访问：需先完成下方局域网配置，再使用启动日志显示的 `http://<LAN-IP>:5173`；默认本机模式不向局域网开放

开发前端通过 `/api` 代理到本机 API，因此无需把 3100 端口暴露给局域网客户端。

## 配置

Web/开发版复制 `.env.example` 为 `.env`。下表列出常用变量；Windows 桌面安装版的持久数据路径由安装位置决定，能力 Worker 则由桌面运行时管理，不依赖开发目录中的 `.runtime` 路径。

| 变量                                    | 默认值                  | 说明                                                 |
| --------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `API_HOST`                              | `127.0.0.1`             | API 监听地址；仅在明确需要直连 API 时改为 `0.0.0.0`  |
| `API_PORT`                              | `3100`                  | API 端口，启动时校验范围                             |
| `DEPLOYMENT_MODE`                       | `local`                 | `local` 仅本机；`lan` 面向可信局域网并强制管理员 PIN |
| `ADMIN_PIN`                             | 空                      | `lan` 模式必填；用于建立浏览器管理员会话             |
| `VITE_API_BASE`                         | 空                      | 空值使用同源 `/api`；分离部署时填写完整 API 地址     |
| `VITE_API_PROXY_TARGET`                 | `http://127.0.0.1:3100` | Vite 开发/预览代理目标                               |
| `CORS_ORIGINS`                          | localhost/127.0.0.1     | 允许直连 API 的精确浏览器 Origin，逗号分隔           |
| `STORAGE_ROOT`                          | `./storage`             | 运行数据目录；相对路径始终基于仓库根目录解析         |
| `DATABASE_PATH`                         | `storage/toolbox.db`    | SQLite 元数据数据库；通常无需覆盖                    |
| `LAN_TRANSFER_MAX_FILE_BYTES`           | `21474836480`           | 局域网单文件上限，默认 20 GiB                        |
| `LAN_TRANSFER_RETENTION_DAYS`           | `3`                     | 局域网文件和图文便签保留天数                         |
| `LAN_TRANSFER_UPLOAD_RETENTION_HOURS`   | `24`                    | 未完成分片上传的保留时间                             |
| `LAN_TRANSFER_CLEANUP_INTERVAL_MINUTES` | `15`                    | 过期文件和废弃分片的自动清理周期                     |
| `LAN_TRANSFER_MAX_STORAGE_BYTES`        | `107374182400`          | 文件、图文图片与活动上传总配额，默认 100 GiB         |
| `LAN_TRANSFER_WEB_PORT`                 | `5173`                  | 生成局域网分享地址时使用的前端端口                   |
| `LAN_TRANSFER_PIN`                      | 空                      | 可选管理 PIN；留空保持免登录模式                     |
| `LAN_TRANSFER_GUEST_MODE`               | `full`                  | `full`、`upload-only`、`download-only` 或 `disabled` |
| `REMOTE_FETCH_TIMEOUT_MS`               | `120000`                | 远程媒体建立连接并收到响应头的超时                   |
| `REMOTE_MEDIA_MAX_BYTES`                | `2147483648`            | 远程媒体最大 2 GiB；同时校验响应头和实际流量         |
| `XHS_PROVIDER_URL`                      | 空                      | 可选的兼容解析适配器地址；留空使用隔离本机运行时     |
| `XHS_PROVIDER_PORT`                     | `5556`                  | 本机小红书解析 Worker 端口，仅监听 `127.0.0.1`       |
| `XHS_INSTALL_TIMEOUT_MS`                | `1200000`               | 首次安装小红书解析环境的最长等待时间                 |
| `XHS_ARCHIVE_MAX_STORAGE_BYTES`         | `107374182400`          | 小红书永久存档配额，默认 100 GiB                     |
| `XHS_TRANSLATION_MODEL_URL`             | 固定 Release Asset      | 本地 OPUS-MT CTranslate2 INT8 模型地址               |
| `XHS_TRANSLATION_PROVIDER_PORT`         | `5557`                  | 本地翻译 Worker 端口，仅监听 `127.0.0.1`             |
| `EDGE_TTS_RETENTION_DAYS`               | `3`                     | 生成语音、字幕和任务记录的保留天数                   |
| `EDGE_TTS_QUEUE_LIMIT`                  | `20`                    | 等待和执行中的语音任务总上限                         |
| `EDGE_TTS_CONCURRENCY`                  | `2`                     | 同时生成的语音任务数量                               |
| `CHATTERBOX_WORKER_URL`                 | `http://127.0.0.1:3220` | 本机 Chatterbox Worker，保持 loopback                |
| `CHATTERBOX_WORKER_TIMEOUT_MS`          | `1200000`               | 单次本地声音克隆超时                                 |
| `CHATTERBOX_RETENTION_DAYS`             | `3`                     | 克隆结果与任务记录保留天数                           |
| `CHATTERBOX_QUEUE_LIMIT`                | `50`                    | 等待和执行中的克隆文案段总上限                       |
| `CHATTERBOX_DEVICE`                     | `auto`                  | 自动选择 CUDA，或显式设置 `cuda` / `cpu`             |
| `CHATTERBOX_MODEL_IDLE_MINUTES`         | `10`                    | 空闲多久后卸载模型并释放显存；`0` 表示常驻           |
| `IMAGE_AI_WORKER_URL`                   | `http://127.0.0.1:3210` | 本地 AI Worker，必须保持 loopback                    |
| `IMAGE_AI_QUEUE_LIMIT`                  | `20`                    | AI 活跃任务与预留槽总上限                            |
| `IMAGE_AI_RETENTION_HOURS`              | `24`                    | AI 输入、结果和任务保留时间                          |
| `DEPLOYMENT_USAGE`                      | `commercial`            | `internal-noncommercial` 才允许使用 BRIA RMBG 2.0    |

小红书翻译模型默认先尝试固定 Release Asset；当该资源不可用时，会自动切换到固定提交的 Hugging Face CTranslate2 预转换恢复源，并逐文件校验摘要。Windows 上如果 Node 无法继承系统代理或 PAC 设置，模型下载会自动改用系统网络通道。若自行设置 `XHS_TRANSLATION_MODEL_URL`，则只使用该地址，不会静默替换自定义配置。

完整变量及注释见 [.env.example](./.env.example)。所有整数配置都会在 API 启动时校验，非法值会直接终止启动，避免带错误配置运行。

局域网部署必须设置 `DEPLOYMENT_MODE=lan` 和 `ADMIN_PIN`，否则 API 拒绝启动。`LAN_TRANSFER_PIN` 与 `LAN_TRANSFER_GUEST_MODE` 只控制访客文件传输能力；删除、清理、AI、翻译、配音、归档和配置写操作始终要求管理员会话。

### 开发版局域网与自定义端口配置

仅本机使用无需改配置。需要可信局域网共享时，在根目录 `.env` 修改以下项目（替换 PIN 和示例 IP，保留配置文件其他内容）：

```dotenv
DEPLOYMENT_MODE=lan
ADMIN_PIN=请替换为自己的高熵PIN
API_HOST=127.0.0.1
CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://192.168.1.100:5173
LAN_TRANSFER_WEB_PORT=5173
```

使用 `start.bat` 时，启动器会根据 `lan` 模式让前端监听局域网；API 和 Worker 可以继续只监听回环，由前端代理转发。使用纯命令行时，分别在两个终端执行 `pnpm dev:api` 和 `pnpm --filter frontend dev:lan`。其他设备访问 `http://<主机局域网IP>:5173`，在页面建立管理员会话后才能使用受保护的写操作；IP 改变时同步更新精确的 `CORS_ORIGINS`。Windows 如提示网络访问权限，仅允许实际需要的可信网络，不关闭防火墙或把 Worker 端口对外开放。

若 API 改为其他端口，例如 `API_PORT=3200`，需把示例配置中已有的 `VITE_API_PROXY_TARGET` 同步改为 `http://127.0.0.1:3200`，然后重启前后端；不要只改其中一个。自定义前端端口使用 `VITE_DEV_PORT`，同时调整 `CORS_ORIGINS` 与 `LAN_TRANSFER_WEB_PORT`。通常保持 `VITE_API_BASE` 为空，避免局域网浏览器把 `127.0.0.1` 误当作服务主机。

诊断详情和深度检查限本机使用，请在服务主机通过 `http://127.0.0.1:5173/settings/diagnostics` 打开；从局域网 IP 访问被拒绝不是缺少 Python 或管理员 PIN。

局域网传输仅保留浏览器原生的图片、视频和 PDF 预览。Word、Excel、PowerPoint、音频、文本和其他文件仍可上传、筛选与下载，但不再启动额外转换服务。

## 可选能力安装

“可选”表示模块可以独立安装；若目标是全部业务功能可用，则应完成与六个模块对应的全部基础能力。下面是各模块的详细行为和使用限制，不替代前面的从零安装顺序。

Windows 桌面版的能力必须在“设置 → 能力管理”中由用户主动安装、重装或卸载；打开工具页或提交任务不会静默下载依赖。下载失败时，可使用能力卡片提供的 GitHub 来源和“离线导入”，并选择同一版本清单中的全部离线包。卸载能力只移除对应运行时和模型，不删除作品、任务历史、个人素材或登录状态。详细步骤见[桌面应用使用帮助](./docs/desktop-application-help.md)。

### 多媒体内容归档

归档视频支持[配乐编辑与图集生成视频](./docs/archive-video-music.md)：原声和背景音乐独立调音量，试听后保存为最新成品，可反复换音乐或恢复原片。原“直播音频库”升级为“音频素材库”，共用配音与背景音乐的上传、分组和备份，已有数据及地址保留。

支持通过 Excel `.xlsx` 或 CSV 批量导入作品链接：点击“表格批量归档”，下载空白 Excel 或 CSV 模板并填写“作品链接”和可选“平台”，校验预览后确认执行。每批最多 100 条、文件最大 2 MiB；默认跳过已归档作品，支持停止后续任务、重试失败项及导出结果。删除批次记录不会删除作品。

支持自定义作品分组：在列表上方创建、重命名、筛选分组，将所选作品移入分组或移回未分组，表格导入时也可指定成功结果的目标组。删除分组只解除关系，作品及媒体保留。详见[表格批量归档与分组说明](./docs/archive-spreadsheet-import.md)。

支持 [TikTok 主页批量归档](./docs/tiktok-profile-archive.md)：安装现有归档浏览器后，输入用户主页、发现并核对公开作品，再选择全部或部分作品和目标分组，自动按每批最多 100 条顺序归档。需要登录、验证或处理隐私提示时，在运行服务电脑的独立浏览器中正常完成；列表未确认完整时须明确确认只归档已发现部分。保留进度，重启后手动继续，不自动重新抓取。

若程序自动窗口始终显示“出错了”，而普通浏览器或无痕窗口可以看到视频，可展开“自动窗口仍然出错？使用普通浏览器采集”，下载独立 HTML 助手，将采集链接拖到书签栏后，在普通浏览器的 TikTok 主页采集并分批导出 CSV，再通过现有“表格批量归档”预览和确认。无需安装扩展、提供 Cookie 或新增能力包。自动窗口当前仍有返回空响应的兼容问题；助手只收集页面实际显示的链接，也不保证取得账号全部作品。

页面入口为 `/tools/media-archive`，旧 `/tools/xhs-archive` 收藏链接自动跳转并保留查询参数及锚点。页面通过中性 `/api/v1/tools/media-archive/*` 接口浏览小红书、抖音及 TikTok 本地存档，支持平台/内容类型/关键词筛选、预览、英文翻译与人工修订、暂停保存 PNG 截帧和 ZIP 导出。批量补译只处理当前筛选范围或显式选中 ID；切换筛选/分页会清空选择，删除失败的记录保留选择以便重试。小红书仍使用独立文本规范化及原有平台流程，不把这些规则应用到其他平台原文。

TikTok 单条入口支持公开视频、图集及 `vt.tiktok.com` / `vm.tiktok.com` 短链，也可粘贴包含单个链接的分享文案。选择“自动识别”或“TikTok”后点击“获取并存档”。原文、作者、话题、视频/封面或有序图片保存到现有归档目录，复用原有配额、翻译、截帧、刷新及删除机制。单条获取无需新增 Python、模型或能力包；原有中译英模型及翻译限制保持不变，不增加其他语言模型。主页请使用独立的主页批量入口；单条读取仍不支持直播、私密或要求登录/验证的作品，平台拒绝访问时返回失败，不生成缺少媒体的归档。公开作品仍可能受网络、地区和 CDN 限制。

若访问 TikTok 需要代理，程序依次使用 `.env` 中的 `TIKTOK_HTTPS_PROXY`、进程环境的 `HTTPS_PROXY` / `HTTP_PROXY`、Windows 已启用的系统 HTTP 代理。macOS/Linux 使用前两种配置；不读取浏览器代理扩展或 PAC 脚本。代理只作用于 TikTok 请求，不改系统设置，不接受代理账号密码。例如 `TIKTOK_HTTPS_PROXY=http://127.0.0.1:7897`（端口应与本机代理一致），设置 `direct` 可强制直连，修改后重启 API。代理模式通过 HTTPS 公共 DNS 解析目标，并固定到经过校验的公网地址；每次重定向继续校验地址，不接受私网或保留地址。运行时“就绪”只表示服务可用，不能代替实际联网获取验证。

公开商品视频缺少播放地址时，默认通过 TikWM 备用解析服务发送该作品的公开链接，以补充视频地址；不发送 Cookie 或本地数据。可设置 `TIKTOK_SHOP_FALLBACK=off` 并重启 API 关闭。备用请求串行限速，取得地址后仍校验作品身份、下载文件及视频轨道；登录受限或私密作品不使用此回退。第三方服务故障时可手动重试，详见 [TikTok 商品视频备用解析](./docs/tiktok-archive.md#2026-10-31商品视频备用解析)。

首次使用此版本时，原有 SQLite 自动备份后升级至 Schema v7，以允许 TikTok 平台身份；不改变历史记录、媒体目录或保留规则。回退旧代码前应停止服务并使用匹配的升级前备份恢复；回退会丢弃备份之后的数据库变更，先完整备份数据库及媒体目录。不能仅替换旧程序去读取 v7 数据库。实现及验证记录见 [TikTok 归档说明](./docs/tiktok-archive.md)。

小红书在线获取保留。抖音归档能力包已发布到 `components-v1`，当前 Windows 源码目录已嵌入正式签名清单：Web/开发版首次获取时自动安装，Windows 桌面版须先在“设置 → 能力管理”中安装 Chromium 与抖音归档能力。抖音归档只支持匿名可访问的公开作品，不绕过登录、验证码或平台限流。旧安装包不会自动获得新的内置能力清单；找不到对应卡片时应更新应用，不能随意导入其他版本绕过校验。两平台解析环境状态独立显示，环境未安装不阻断已有存档浏览；旧小红书版本化 API 保留为平台受限兼容入口。能力包发布不等于每种安装/升级场景都已通过实机验收，仍须按下方清单验证当前安装，macOS 也不属于当前全功能承诺范围。

Web/开发版首次点击“获取并存档”时，模块会优先复用 Python 3.12；若本机没有，则通过固定版本 uv 把受管 Python、虚拟环境和固定提交的 XHS-Downloader 2.7 安装到 `.runtime/xhs-downloader`。普通项目启动不会安装或等待该环境。桌面版须先从能力管理中安装对应能力。解析 Worker 只监听回环地址，媒体获取完成后写入当前运行模式的数据目录。

遇到访问限制时，可在页面点击“登录小红书并重试”。Web/开发版登录状态保存在 `.runtime/xhs-browser-profile`；桌面版使用安装目录 `data/profile` 下的受管浏览器状态。登录信息不会进入日志、接口响应、源码包或 Git。模块不会绕过验证码。第三方来源和许可证信息见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

获取完成后会在后台使用固定版本的 `Helsinki-NLP/opus-mt-zh-en` 在本机 CPU 翻译标题、正文和话题。Web/开发版翻译运行时和模型只在首次生成英文时安装到 `.runtime/xhs-translate`；桌面版需先在能力管理中安装翻译能力。失败不会影响中文存档；历史存档可在内容存档页选择“补全未翻译内容”或“翻译所选”。英文支持人工修订，ZIP 会在英文就绪时增加 `Content-English.txt` 和 `内容-中英双语.txt`。模型构建可使用 `node scripts/prepare-xhs-translation-model.mjs`，模型产物不会提交 Git。

### 多国语言配音

在线自然音色支持马来语（`ms-MY`）、美式英语（`en-US`）、英式英语（`en-GB`）和巴西葡萄牙语（`pt-BR`）。巴西葡语推荐 Francisca 女声与 Antonio 男声，支持语速、音量、音调调整及 MP3/SRT 导出。请直接输入葡萄牙语文案，选择音色不会自动翻译文本。参考音色克隆也支持马来语、英语和巴西葡萄牙语。

`start.bat` 自动准备已签名的在线配音能力，不创建 `.venv-edge-tts`。桌面版请先在“设置 → 能力管理”安装在线自然配音能力。仅手动开发 Worker 时才使用以下命令（`python` 必须指向 3.12，否则用 `-Python` 传入实际解释器路径）：

```powershell
python --version
ffmpeg -version
ffprobe -version
.\scripts\setup-edge-tts.ps1 -Python python
```

Edge-TTS 不需要 API Key，但会把输入文案发送到微软在线语音服务，因此必须联网。生成的 MP3、可选 SRT 和任务元数据保存在当前运行模式的数据目录下，默认 3 天后自动清理。

#### Chatterbox Multilingual V3 声音克隆（Web/开发版）

以下脚本仅用于 Web/开发版源码环境，需要 Python 3.12 和 ffmpeg，推荐 NVIDIA CUDA GPU。桌面版请先在“设置 → 能力管理”安装声音克隆能力。源码环境首次单独安装并下载模型：

```powershell
.\scripts\setup-chatterbox.ps1 -DownloadModel
```

脚本默认通过 `py -3.12` 查找解释器；未安装 Python Launcher 时，使用 `-Python` 传入 Python 3.12 的实际可执行文件路径。`-DownloadModel` 会下载并实际加载模型，需要预留磁盘和内存，不是轻量环境检查。当前脚本安装 CPU 依赖；如要 CUDA 加速，需另行配置兼容的 GPU 依赖，不能仅把 `CHATTERBOX_DEVICE` 改成 `cuda`。

手动环境安装后，运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1 -NoInstall`，会在 `127.0.0.1:3220` 启动源码 Worker，并以 `--eager-load` 提前加载模型；一键受管模式则由 API 在动态 loopback 端口启动能力包内的 Worker，不运行这个源码虚拟环境。默认空闲 10 分钟后卸载模型资源。页面支持马来语、英语与巴西葡萄牙语，参考录音限制 5–30 秒、20 MB，推荐使用 10–20 秒单人清晰录音。只有本人声音或已取得明确授权的声音才能使用。参考音色克隆支持最多 30 个有序文案段、每段独立 MP3、按顺序拼接的总 MP3、批量 ZIP、原文/中文/双语 SRT、详情管理及单段安全重新生成；单段最多 1,200 字符，批次总计最多 20,000 字符。字幕使用最终 MP3 的实际时长累计偏移，可选择段内按完整句子分段或每段一个字幕块。详情中的单段重生成可单独覆盖情绪强度、音色遵循、随机度和种子。上传的音频可以保存到永久音色库，支持跨批次选择、试听和手动删除，不参与 3 天过期清理；批次临时参考音色和生成结果仍默认 3 天后清理。生成音频保留 Chatterbox 内置的 PerTh AI 水印。

巴西葡语克隆在接口和音色库中使用 `pt-BR`，Worker 会映射为当前通用多语言模型支持的 `pt`。请使用已获授权的巴西葡语参考录音并输入葡语文案，以引导巴西口音；语言选项不会自动翻译，也不能单独保证地域口音。

每段文案可以额外保存最多 2,000 字符的中文翻译。该翻译不参与语音生成和文案字符统计，原文 SRT、中文 SRT 和原文在上中文在下的双语 SRT 分开提供下载，ZIP 内也会同时包含。字幕以批次随机 ID 的前 8 位作为稳定哈希后缀，例如 `马来语-aB12cd34.srt`、`中文字幕-aB12cd34.srt` 与 `双语字幕-aB12cd34.srt`；总音频命名为 `总音频-aB12cd34.mp3`。选择按句分段时，原文与中文句数相同会逐句对应；句数不同时，该文案段的中文字幕及双语字幕会合并为一个完整字幕块，避免遗漏或错配中文。

### AI 图片处理

以下脚本用于 Web/开发版源码环境；桌面版需在“设置 → 能力管理”安装 AI 图片处理能力。

```powershell
.\scripts\setup-image-ai.ps1 -Python python
pnpm dev:ai
```

- `python` 必须指向 Python 3.12；也可给 `-Python` 传入该版本的完整解释器路径。不要直接把 `py` 当成版本选择，它可能默认选择其他已安装版本。
- 默认安装依赖并下载、预加载模型；已有完整模型时可用 `-SkipModels` 跳过这一步，但它不会验证所有模型均已就绪，也不等于完全离线安装。
- `pnpm dev:ai` 在独立终端运行，前端和 API 仍需另行启动；也可用 `scripts/start-dev.ps1 -NoInstall` 统一启动源码环境。`start.bat` 使用独立签名能力，不启动这个虚拟环境。
- Worker 仅监听 `127.0.0.1:3210`。
- 商业或未声明用途强制使用 MIT 许可的 BiRefNet 路线。
- BRIA RMBG 2.0 需要自行接受其非商用许可、放置本地快照并配置摘要；安装脚本不会自动下载 BRIA。
- 模型文件可能占用数 GiB 磁盘，首次健康检查和首次推理会明显较慢。

## 全功能验收清单

无论使用桌面版还是源码版，都需用自己的测试素材逐项验证。**页面可打开、HTTP 健康检查正常、能力显示已安装，都不等于全部业务已经验证通过。** CPU 基线不要求 GPU；商业抠图使用 BiRefNet，不要求开启 BRIA。

| 模块 / 场景    | 实际操作                                                          | 通过标准                                                           |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| 基础服务       | 打开首页、设置和启动诊断；查看服务状态                            | API 与数据库就绪，没有阻断性启动错误；未执行的在线深检不能当作通过 |
| 图片压缩       | 上传一张测试图片，压缩并下载                                      | 能打开下载结果，格式和尺寸符合选择                                 |
| AI 图片处理    | 分别测试抠图、清晰度增强、去水印和文字智能提示                    | 实际产生并能下载结果，OCR 能返回提示；不是仅显示 Worker 在线       |
| 在线自然配音   | 选择支持的音色，用短文案生成至少两段批次，试听并导出 MP3 / SRT    | 每段、总音频和字幕均可用，无外部合成错误；此项需联网               |
| 参考音色克隆   | 上传符合限制且已授权的参考录音，用短文案生成、试听并下载          | 批次完成，音频与字幕可用；CPU 首次生成较慢不等于失去响应           |
| 直播音频库     | 上传音频，将一条生成结果加入音频库，测试分组、单独/队列播放及下载 | 两种来源均可保存和播放；测试前确认音量适当、没有其他播放冲突       |
| 小红书归档     | 获取一条有权保存的作品，按需完成本人登录，生成英文并下载 ZIP      | 中文、媒体和英文均可查看；仅中文成功不算翻译通过                   |
| 抖音归档       | 获取一条匿名可访问的公开作品，预览媒体并对视频暂停截帧、导出 ZIP  | 媒体、截帧和导出可用；图文作品不要求视频截帧                       |
| 局域网文件传输 | 在另一台可信设备打开共享地址，上传并下载测试文件                  | 跨设备传输成功、下载内容正确；源码 LAN 模式按权限建立管理员会话    |
| 重启后的持久化 | 正常停止并重新启动当前运行方式，查看测试音频库与存档              | 已保存内容仍存在，已安装环境可继续使用，不重复执行全量安装         |

局域网共享地址：桌面版从顶部网络入口或设置中复制；源码版按[局域网配置](#开发版局域网与自定义端口配置)设置并启动。没有第二台设备时只能将跨设备项标记为“未验证”，不要记为通过。只测试本机上传也不能验证路由器隔离或防火墙是否放行。

诊断深检会实际占用资源或访问在线服务，仅在没有业务任务和播放时手动选择执行；它是辅助检查，不能代替上表的生成、归档、播放、下载验收。失败时按具体原因补齐环境或处理联网问题，见[常见问题](#常见问题)，不要反复重装全部组件。

### 全功能可用的边界

- **CPU 与 GPU**：CPU 是完整基础路径，GPU 是可选加速；不把 GPU 不可用误写为所有功能不可用，也不保证任意内存和素材规模都可完成任务。
- **在线与离线**：本地图片处理、克隆、已安装的本地翻译和已保存素材可离线使用；在线自然配音、平台获取/登录必须能够访问对应服务。首次下载资源时也需要网络。
- **第三方平台**：403、登录要求、验证码、限流、内容下架和第三方接口变化可能使具体在线任务不可用；安装齐全不能保证任何作品都能抓取或外部服务始终可用。
- **用途许可**：参考声音和素材须获授权；BRIA 非商用路径需要另行满足许可条件，不属于默认商业全功能初始化要求。
- **平台与验证范围**：本指南完整路径针对 Windows x64。macOS 内部测试、不同硬件、实际桌面安装/升级及外部服务状态应单独验收，不能因为文档写全就声称已在所有全新电脑验证。

## 开发与质量命令

| 命令                                | 用途                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                          | 并行启动前端和 API                                   |
| `pnpm dev:web` / `pnpm dev:api`     | 单独启动某一侧                                       |
| `pnpm test`                         | 运行全部 TypeScript/Vue 测试                         |
| `pnpm coverage`                     | 执行 75/65 全局覆盖率门槛                            |
| `pnpm test:python`                  | 运行无需模型的 Worker 单元测试                       |
| `pnpm lock:python`                  | 生成 Python 3.12/Windows x64 Worker 哈希锁           |
| `pnpm audit:python`                 | 审计四组 Python Worker 运行时依赖                    |
| `pnpm lint`                         | ESLint（TypeScript + Vue）                           |
| `pnpm deadcode`                     | Knip 未使用文件、依赖与导出检查                      |
| `pnpm typecheck`                    | 全 workspace 严格类型检查                            |
| `pnpm format` / `pnpm format:check` | Prettier 写入/校验                                   |
| `pnpm build`                        | 顺序构建 shared、backend、frontend，并执行产物冒烟   |
| `pnpm check`                        | CI 同款完整质量门禁                                  |
| `pnpm clean`                        | 删除构建与覆盖率产物                                 |
| `pnpm clear:generated`              | 清空缓存、构建产物、日志和运行时生成数据（保留依赖） |
| `pnpm db:migrate --dry-run`         | 预检旧 JSON 元数据迁移                               |
| `pnpm db:verify`                    | 校验 SQLite 完整性、外键和记录统计                   |
| `pnpm db:benchmark`                 | 以 10,000 条元数据验证列表/详情 P95 预算             |
| `pnpm db:rollback --backup <id>`    | 从指定迁移备份恢复旧元数据                           |
| `pnpm smoke:standalone`             | 验证分发包安装、启动、上传、下载和清理               |
| `pnpm desktop:build`                | 构建桌面资源和 Electron 应用目录                     |
| `pnpm desktop:make`                 | 在 Windows x64 上构建 NSIS 安装器                    |
| `pnpm --filter desktop test`        | 运行 Electron 主进程、迁移和安装验收相关测试         |

图片 AI 的可选环境测试：

```powershell
.\.venv-image-ai\Scripts\python.exe scripts\image_ai_worker_test.py
```

## AI 图片处理结果留档

“AI 图片处理 → 处理记录”可按处理类型、状态、原文件名或任务编号查询历史任务，查看原图与结果对比，下载单张 PNG 或整批 ZIP。支持勾选记录、全选当前页后批量删除，切换页码或筛选条件会清空选择，不会误删其他页面的记录。批量删除会确认数量并逐条执行，失败项目单独提示，仍可删除的失败记录保留选中以便重试。任务结果写入本地数据库和应用数据目录，页面刷新及服务重启不会丢失记录；查看与下载不需要重新加载 AI 模型。

只要任务产生了成功结果（包括部分成功、取消或中断前已完成的图片），记录、结果、对应原图和蒙版就会**长期保留，直到手动删除**。此前尚未清理的旧结果也会保留；已经被旧版清理的文件无法恢复。没有成功结果的失败、取消或中断任务仍按 `IMAGE_AI_RETENTION_HOURS`（默认 24 小时）清理。

删除记录需要确认，会一起删除该任务在应用内保存的文件和元数据，不会删除您电脑中另外保存的原图；正在排队或处理的任务不能删除。长期留档会持续占用磁盘空间，请按需下载备份、手动删除。备份应同时保留数据库文件（默认文件名为 `toolbox.db`）和对应的 `image-ai/` 目录，使用设置中的实际数据位置；自定义数据库路径时以生效配置为准，并在正常停止服务后备份。仅备份源码或模型能力包不包含处理记录。清理脚本中的“AI 图片处理数据”是显式的业务数据清理，会删除留档文件，默认缓存清理不会包含它。

### 商品图编辑：换背景、标准化与精修

在“抠图”的成功结果上点击“编辑商品图”，或在“处理记录”详情中点击“继续编辑”。支持透明、纯色及本机图片背景；方形/横版/竖版或自定义画布、主体占比、居中/底对齐和拖动布局；精修支持擦除、从原图恢复、笔刷强度、撤销/重做及重置精修。检查底色只用于查看边缘，不写入成品。

编辑预览最长边为 2048px，最终图片由后端使用原分辨率素材本地渲染。自定义画布宽高各 256～4096px，总像素不超过 1600 万；背景支持单帧 JPG/PNG/WebP，最大 20 MiB。不会生成 AI 场景或自动提高商品细节，普通插值放大可能变模糊。精修撤销历史有 64 MiB 预算，超大单笔可能无法撤销；可以用“重置精修”恢复初始前景。

点击“保存并留档”才会创建任务，不会自动开始处理或覆盖旧图片。保存时复制独立的前景、可用原图、背景、精修蒙版及配方，因此删除来源记录不影响已保存版本。独立快照会额外占用磁盘，仍按成功结果长期保留、手动删除的规则管理，失败且无结果的任务沿用原临时保留期。读取/复制来源素材期间会拒绝同时删除该来源，请稍后再试。原图缺失或方向/尺寸不能安全对应时禁用恢复，不会猜测坐标。

已有结果的编辑和本地合成不需要 Python Worker 在线，不新增模型、Python 依赖或签名能力包。保存走现有任务队列；取消会等待当前本地渲染收敛后清理临时输出，不会删除来源图片。草稿只存在于当前页面，离开或刷新前请保存。最终 PNG 留档后可选择 PNG/JPEG/WebP 下载；透明结果导出 JPEG 时必须确认白底填充。保存的尺寸预设属于通用规格，不承诺符合特定平台的最新上传规则。

## 构建 Windows 桌面安装包

Windows x64 新克隆目录可以直接运行 `start.bat -BuildDesktop`，入口会准备 Node/pnpm 及构建依赖后打包，不下载业务能力、不启动模型。此参数必须明确指定，默认 `start.bat` 不打包。若已自行安装 Node.js 24.x、pnpm 11.7.0，也可使用原命令构建本地测试安装包：

```powershell
pnpm install --frozen-lockfile
pnpm desktop:make
```

默认产物为 `apps/desktop/out/make/nsis/EcommerceToolboxSetup.exe`。没有设置 Release 签名配置时，此产物是**未签名测试安装包**，不会自动发布到 GitHub Release。安装前仍须确认目标目录可由当前用户写入。

### 桌面版本号

桌面产品版本以 `apps/desktop/package.json` 的 `version` 为唯一基准，独立于根目录、前后端和能力包的版本。采用[语义化版本](https://semver.org/lang/zh-CN/)的三段格式 `主版本.次版本.修订号`：问题修复递增修订号，兼容的新功能递增次版本并将修订号归零，不兼容的大改动递增主版本并将后两段归零。不会逢 10 自动进位，例如 `0.1.9 → 0.1.10`。

日常执行 `pnpm desktop:make` 或 `pnpm desktop:package`，默认递增修订号；**只有完整打包成功后才写回版本**。下载、编译或安装器生成失败均不递增，直接重试原命令即可。`start.bat -BuildDesktop` 调用同一打包流程。普通 `pnpm build`、`pnpm desktop:build`、启动和测试不会变更版本。

以下命令以当前 `0.1.0` 为例，互为独立选项，每次选用一种：

| 命令                                | 版本结果 | 使用情形               |
| ----------------------------------- | -------- | ---------------------- |
| `pnpm desktop:make`                 | `0.1.1`  | 日常修复与打包         |
| `pnpm desktop:make --bump minor`    | `0.2.0`  | 增加兼容功能           |
| `pnpm desktop:make --bump major`    | `1.0.0`  | 不兼容的大版本变更     |
| `pnpm desktop:make --version 1.2.0` | `1.2.0`  | 明确指定高于当前的版本 |
| `pnpm desktop:make --keep-version`  | `0.1.0`  | 对同一版本重建产物     |

`desktop:package` 同样支持以上参数。若先执行 `desktop:package`，再制作同一版本安装器，第二步使用 `desktop:make --keep-version`；已修改产品内容时应使用新版本。版本同时写入应用内部元数据、可执行文件版本和安装器，安装器文件名仍保持现有名称。

成功打包产生的 `apps/desktop/package.json` 版本改动应随源码一起提交，换电脑时从这个版本继续递增；流程不会自动提交或推送，也不联网查询 GitHub 的最新版本。正式 Release 配置 `DESKTOP_RELEASE=1` 时，严格使用 tag 流程提供的 `DESKTOP_VERSION`，不额外递增、不写回源码，保持现有签名、更新源和验收流程。

打包过程使用 `apps/desktop/.desktop-package.lock` 防止并行打包相互覆盖。正常成功或失败均释放该锁；如果进程被强制结束，先确认相关打包进程已退出，再手动移除残留锁重试。锁与版本写入临时文件均不进入 Git 或应用产物。

### 打包资源与验收

`desktop:make` 会依次构建 shared、API、前端、桌面资源并重建桌面原生依赖，无需先运行 `start.bat` 或启动模型。首次执行会按需下载 Electron、NSIS 等构建资源，`apps/desktop/.electron-cache` 等缓存由构建流程生成，不需要从别人电脑拷贝。若原生依赖无法使用预编译文件、回退本机编译，应按具体构建错误补齐工具链，不把系统 Python 或全部 AI 环境当作所有打包场景的固定前置条件。

普通打包使用仓库已提交的签名能力清单 `apps/api/src/modules/components/catalog.generated.ts`，**不需要**先执行 `components:prepare-*`、制作离线能力包或重新生成清单，也不需要原作者的签名私钥。大型能力在安装后由能力管理下载，或从卡片指向的发布页获取后离线导入，不需要塞进安装器。只有发布新能力版本时，才涉及能力包构建、签名和清单更新。

仓库提供独立的 Windows 安装验收工作流 [desktop-install-acceptance.yml](./.github/workflows/desktop-install-acceptance.yml)：在干净 Windows Runner 上构建测试安装器，执行安装、启动、健康检查、旧数据迁移、卸载和数据保留检查；该工作流不签名、不创建 Release。正式发布走 tag 触发的桌面发行流程，并额外执行签名与干净环境验收。

## Apple Silicon macOS 内部测试包

当前内部流程面向 Apple Silicon、macOS 13+，通过 GitHub Actions 中的 `macOS Apple Silicon internal desktop build` 手动生成不含 Developer ID 签名/公证的测试 DMG（使用 ad-hoc 签名）。该流程只验证应用壳、桌面资源、类型和桌面单测；它不会自动制作或发布 Python、FFmpeg、AI 模型、浏览器等能力包。Mac 能力目录现为空，因此不能把该 DMG 宣称为“全部业务模块可用”。完整步骤和阶段门禁请按[macOS 迁移与内部测试指南](./docs/macos-apple-silicon-build.md)执行。

## 生产构建与部署

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm build` 会清理旧产物、生成：

- `packages/shared/dist`：可直接导入的 ESM 与声明文件
- `packages/runtime-core/dist`：Node 专用公共运行时基础包
- `apps/api/dist/server.js`：可运行 API 入口
- `apps/web/dist`：静态站点

构建末尾会从真实产物导入 shared、创建 Fastify 应用并调用 `/api/v1/health`，防止“编译成功但产物无法运行”。`pnpm start` 只启动 API；生产环境还需要静态服务器托管 `apps/web/dist`，并把 `/api` 反向代理到 `127.0.0.1:3100`。本地验证可在另一个终端运行 `pnpm preview:web`。

Standalone 不是第二套源码。运行 `pwsh ./scripts/package-standalone.ps1 -Platform windows` 或 `-Platform macos` 会从当前提交生成平台包、SHA-256、构建清单和第三方许可证清单；Release CI 另行生成 SBOM，并从 Python 官方固定地址下载安装器后校验摘要。

## SQLite 迁移与回滚

首次启动会检测局域网文件、便签、分片上传和小红书归档的旧索引，先复制到 `storage/migration-backups/<timestamp>` 并校验大小与 SHA-256。正式数据库尚不存在时，迁移会在同目录临时数据库中以单事务导入，完成完整性与外键检查、WAL checkpoint 和 `fsync` 后才原子切换为 `storage/toolbox.db`；解析或校验失败时拒绝启动且不会留下半迁移数据库。各任务目录中的旧 manifest 继续由对应 Repository 首次初始化时导入。媒体文件路径不变，旧元数据至少保留一个发布周期且不会作为新写入目标。SQLite 使用 WAL、外键、`busy_timeout` 和参数化语句；异常中断的任务在重启后标记为 `failed/INTERRUPTED`，必须由用户显式重试。

服务启动后会对局域网文件记录执行轻量一致性检查。缺失文件、大小不一致、危险存储名和无记录文件不会被永久删除，而是连同可恢复元数据移动到 `storage/quarantine/<timestamp>`，并在 SQLite 中写入审计事件。

升级前建议先运行 `pnpm db:migrate --dry-run`；预检不会创建数据库或备份。迁移后用 `pnpm db:verify` 检查完整性；需要恢复时运行 `pnpm db:rollback --backup <id>`。回滚会先验证整份备份，再原子替换旧索引；校验失败时保留当前数据库。不要手工删除数据库的 `-wal` 或 `-shm` 文件。

生产部署应额外做到：TLS、可信网络访问控制、磁盘配额、日志轮转、备份和进程守护。若要暴露公网，必须先增加身份认证、授权、CSRF/速率限制和审计日志。

## 数据、安全与隐私

- API 默认不反射任意 Origin；`CORS_ORIGINS` 只接受精确来源。
- 远程媒体只允许 HTTP(S) 80/443，不允许凭证；会解析公网地址，拒绝环回、私网、链路本地和保留地址，并逐跳复查重定向。默认最多 3 次，TikTok 仅允许 HTTPS、最多 5 次。
- 图片压缩限制 20 MiB/4000 万像素，真实内容由 Sharp 解码校验，输出采用流式下载。
- Chatterbox 参考音频只在本机标准化和推理，生成完成或失败后立即删除；服务端强制要求声明授权来源并确认合法使用权。
- 局域网分片先合并到同盘临时文件，校验大小并 `fsync` 后原子提交；失败不会破坏原分片。
- 图文快传按纯文本展示，图片限制为 JPG/PNG/GIF/WebP/AVIF 并校验文件签名；图片随便签过期或删除。
- 文本预览强制 `text/plain`；PDF 需要 `%PDF-` 文件签名并在严格 sandbox iframe 中预览；响应包含 `nosniff` 和 CSP。
- `storage/`、`models/`、`.env` 与 Python 虚拟环境均被 Git 忽略。

## API 与响应约定

健康检查：

```http
GET /api/v1/health
```

统一响应：

```json
{
  "success": true,
  "message": "ok",
  "data": {},
  "requestId": "req-..."
}
```

```json
{
  "success": false,
  "message": "可读错误信息",
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "可读错误信息",
    "details": {}
  },
  "requestId": "req-..."
}
```

完整端点见 [docs/api.md](./docs/api.md)。

## 新工具接入规范

1. 在 `packages/shared/src/common/tools.ts` 注册工具元数据和稳定 ID。
2. 在 `packages/shared` 定义可复用 DTO、校验与响应契约，避免前后端复制类型。
3. 后端业务放入 `apps/api/src/domains/<domain>/`，由 `app/business-routes.ts` 装配；新增工具只在 `/api/v1/tools/<tool-id>` 下注册路由，并为上传大小、像素、超时、并发和磁盘占用设置独立上限。系统能力沿用现有归属，不借新增工具改写既有接口。
4. 前端业务归入 `apps/web/src/features/`（配音位于 `speech/edge-tts` 与 `speech/chatterbox`），路由继续使用动态 import。页面负责组合，复杂状态与生命周期放入各 feature 的 composable；公共 UI、HTTP 与工具归 `shared/`，导航归 `shell/`，桌面桥接归 `integrations/desktop/`。跨 feature 使用明确的 integration 出口，不读取另一功能的页面内部状态。
5. 对路径、远程 URL、文件签名、失败清理和并发竞态补测试。
6. 运行 `pnpm check`，确认 dead-code、生产构建和冒烟全部通过。

工程实现归 `tooling/`，保留现有 `scripts/` 公开入口；需要随桌面分发的脚本逐项登记到 `tooling/build/runtime-scripts.json`。详细边界及测试选择见 [架构与开发指南](docs/architecture.md#新增或修改功能的步骤)。

## 常见问题

### 克隆或依赖下载失败

`Failed to connect to github.com:443` 表示这次 Git HTTPS 连接未建立，不是项目代码或 Python 环境错误。先确认网络及代理客户端是否运行；浏览器能访问 GitHub，不代表 Git、pnpm、pip 和 Electron 下载都使用同一个代理。

如果本机已有可信的 HTTP 代理，可只对本次克隆指定代理。例如下方 `7897` 只是端口示例，必须换成代理软件实际的 HTTP / mixed 端口：

```powershell
git -c http.proxy=http://127.0.0.1:7897 clone https://github.com/sunshine-tmy/tool2.0.git
```

该命令不修改 Git 全局配置，也不会替 pnpm 或 Python 配置代理。克隆失败后先检查目标目录是否已有文件，不要直接覆盖或删除已有项目。依赖下载失败时按错误中的目标服务分别检查代理与网络；不要关闭 TLS 证书校验、使用来历不明的镜像或删除 `pnpm-lock.yaml` 绕过错误。

### 新克隆后提示 Python 或模型不存在

这是未随 Git 分发的运行环境，不是源码缺失。源码开发版按[完整初始化流程](#新克隆项目首次初始化)创建 Python 3.12 环境并下载模型；桌面版从能力管理安装/离线导入，不需要向原作者索要私有目录。如果只执行了 `pnpm dev`，应补完 Worker 安装和统一启动，而不是认为全部功能已经启用。

若 PowerShell 阻止 `.ps1` 执行，可使用上文 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...` 方式仅对当前进程运行可信仓库脚本，不必永久放宽系统执行策略。若被阻止的是 `npm.ps1` / `pnpm.ps1`，Windows 命令可改用 `npm.cmd` / `pnpm.cmd`，参数保持一致。

### 前端出现 ECONNREFUSED 或在线配音返回 403

`ECONNREFUSED` 表示代理连接的 API 地址没有接受连接：检查 API 终端中的首个启动错误、`API_PORT` 与 `VITE_API_PROXY_TARGET` 是否匹配，再运行 `pnpm doctor`。不要把前端页面已打开等同于 API 已就绪。

在线配音合成返回 403 则是外部语音请求被拒绝，与本地 API 未启动不同。先核对当前 Edge-TTS 版本、服务可达性及诊断结果，不盲目重装 Python 或全部模型；桌面版能力未安装、已安装但进程失败、外部服务拒绝请求也应分别处理。

### 端口 3100、5173 或 3210 被占用

此处说明适用于 Web/开发版。本项目上次启动遗留的进程会被自动识别和清理。若端口属于其他程序，启动器会显示 PID、程序名和命令行后安全退出；确认可以结束该程序时才使用 `scripts/start-dev.ps1 -ForceRestart`。

### 局域网设备打不开页面

Web/开发版请确认 Windows 防火墙允许 5173、设备处于同一网络，并使用启动日志检测到的 LAN IP。默认不需要开放 3100。桌面版局域网访问也应使用应用显示的地址，并确认 Windows 防火墙允许前端端口。

### 图片 AI 健康检查失败

Web/开发版查看 `.logs/image-ai-worker.error.log`，确认 `.venv-image-ai`、模型目录、磁盘空间和 `DEPLOYMENT_USAGE`。桌面版请在“设置 → 能力管理”检查安装状态与空间；Worker 冷启动可能需要几十秒。

### 构建成功但部署页面调用不到 API

生产静态服务器必须把 `/api` 代理到 API；若前后端不同域，则在构建前设置 `VITE_API_BASE`，并把前端 Origin 加入 `CORS_ORIGINS`。

### 编译态启动提示 LEGACY_RUNTIME_ROOT_DETECTED

源码与编译产物现在都从项目根定位只读脚本、前端资源及默认配置。旧版编译态曾错误地使用项目父目录；若该旧位置存在 `.env`、`storage`、`.runtime` 或 `models`，程序会停止启动，避免静默切换数据库或漏读旧数据，不会自动搬迁或删除文件。

先核实旧位置究竟属于本项目还是其他应用，再显式选择要使用的数据根目录。例如：

```powershell
$env:TOOLBOX_LEGACY_DATA_ROOT = 'D:\已核实的旧数据根目录'
pnpm start
```

该目录应是包含 `.env`、`storage`、`.runtime`、`models` 的根目录，而非 `storage` 文件夹本身；必须是已存在的绝对目录。设置仅作用于当前终端，不修改系统环境变量。此选项只从进程环境读取，不能写入 `.env`，因为程序必须先确定去哪读取 `.env`。

选定后，配置及默认数据/能力/模型位置继续使用该根目录，但只读脚本和前端资源使用当前项目。已有 `STORAGE_ROOT`、`DATABASE_PATH` 等覆盖项及环境变量优先级不变。若已确认要使用当前项目的数据，可以将选项设为当前项目绝对路径；不要在尚未确认旧数据位置时直接这样做。
桌面显式布局不受此选项影响；无需为正常桌面启动设置它。未遇到该提示的新用户也无需设置。

### Windows 桌面端后台运行

点击窗口的最小化按钮会收起到右下角系统托盘，已运行的后台服务和任务继续运行。单击或双击托盘图标，或者右键选择“显示主窗口”，即可恢复；再次启动程序也会恢复同一个窗口。托盘图标可能位于 Windows 的隐藏图标区域。

右键托盘选择“退出电商工具箱”会执行正常的任务检查和安全退出；窗口关闭按钮也仍按此流程退出。数据切换、能力安装等关键操作未完成时，会按原规则阻止退出。若托盘初始化失败，应用保留普通最小化方式，避免隐藏后无法恢复。macOS 保持原有 Dock 和窗口最小化行为。

### 桌面端导入旧版数据

需要在设备之间迁移指定模块时，使用桌面设置 → **数据备份与恢复**：支持六个业务模块单选/多选导出 ZIP、导入预检、合并或替换、自动恢复点和手动回滚。只恢复所选模块，保留其他模块；模型、运行环境和登录状态不随业务备份迁移。详细步骤与保留规则见[数据备份与恢复](docs/module-data-backup.md)。

桌面版首次启动时的完整迁移会检测固定旧路径 `%LOCALAPPDATA%\EcommerceToolboxData`。设置页中的“导入旧版数据”是独立功能，需选择旧项目或备份中的 `storage` 文件夹本身；它会替换当前业务数据，但会先备份当前内容以便回滚。没有使用过旧版或没有旧数据备份时，不需要操作。

### Chatterbox 显示运行就绪、生成时载入模型

这表示 Worker 可用，但模型还没有载入内存；桌面端在首次生成时载入，空闲后会卸载以释放内存。等待首次生成完成后，页面状态会自动更新。桌面版的设备选择与源码一键启动可能不同；当前桌面运行时默认使用 CPU。

## 项目范围与第三方资产

本项目当前按组织内部使用维护。依赖来源、版本、签名清单、SPDX/SBOM 和第三方说明用于资产追溯、故障排查与内部运维，不是用户安装或内部验收的审批步骤。在线配音等外部服务的数据传输边界见[数据、安全与隐私](#数据安全与隐私)。
