# 电商工具箱

一个本地优先、免账号登录的电商素材处理工作台。项目以 pnpm workspace 管理 Vue 前端、Fastify API、共享 TypeScript 契约和可选 Python AI Worker，适合个人电脑或可信局域网部署。

> [!WARNING]
> 本项目包含文件上传、下载、删除和高计算量 AI 接口。`local` 模式默认只监听 `127.0.0.1`；`lan` 模式必须配置 `ADMIN_PIN`，管理写操作使用 HttpOnly 会话 Cookie、CSRF Header 和精确 Origin 校验，访客传输权限仍由 guest mode 控制。不要把 API 或 AI Worker 直接暴露到公网。

## 功能矩阵

| 模块           | 前端路由                | API 命名空间                   | 能力                                                                        |
| -------------- | ----------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| 图片压缩       | `/tools/image-compress` | `/api/v1/tools/image-compress` | JPEG/PNG/WebP 批量压缩、缩放和格式转换                                      |
| AI 图片处理    | `/tools/image-ai`       | `/api/v1/tools/image-ai/*`     | 去水印、清晰度增强、商品图抠图，本地模型推理                                |
| 局域网文件传输 | `/tools/lan-transfer`   | `/api/v1/tools/lan-transfer/*` | 文件断点续传、剪贴板粘贴上传、图文快传、图片/视频/PDF/Office 预览和过期清理 |
| 视频文本解析   | `/tools/video-text`     | `/api/v1/tools/video-text/*`   | 本地音频提取、Whisper 转写、时间轴、摘要、历史和导出                        |
| 多国语言配音   | `/tools/edge-tts`       | `/api/v1/tools/edge-tts/*`     | Edge-TTS 在线配音与 Chatterbox V3 本机声音克隆                              |
| 短视频解析     | `/tools/short-video`    | `/api/v1/tools/short-video/*`  | 抖音/小红书/TikTok 公开分享链接解析及媒体下载代理                           |
| 小红书内容归档 | `/tools/xhs-archive`    | `/api/v1/tools/xhs-archive/*`  | 小红书图文、视频、Live Photo 本地归档、预览与中英翻译                       |

短视频解析会把分享链接发送给配置的第三方解析服务；其可用性、隐私政策和使用条款不由本项目控制。

## 技术架构

```text
Browser
  └─ Vue 3 + TypeScript + Vite + Naive UI
       └─ /api（开发/预览由 Vite 反向代理）
            └─ Fastify + TypeScript
                 ├─ Sharp：图片压缩与输出清洗
                 ├─ ffmpeg + faster-whisper：视频转写（可选）
                 ├─ Python AI Worker：抠图、增强、去水印（可选）
                 ├─ Chatterbox V3 Worker：参考音色克隆（可选）
                 ├─ XHS-Downloader Worker：按首次使用安装的小红书解析适配器
                 ├─ SQLite（storage/toolbox.db）：元数据、任务与审计事实源
                 └─ storage/：媒体、模型、临时文件与迁移备份
```

```text
frontend/                 Vue 前端
backend/                  Fastify API、任务与存储逻辑
packages/shared/          前后端共享类型、响应结构和领域工具
scripts/                  启动、安装、Python Worker、测试和构建冒烟脚本
storage/                  SQLite、媒体、临时文件和迁移备份（不提交 Git）
packaging/standalone/     由发布流水线使用的启动器与分发模板
models/                   本地模型权重（不提交 Git）
docs/api.md               API 说明
docs/operations.md        启动、权限、迁移、隔离区与发布运维手册
docs/enterprise-optimization-backlog.md  企业级优化实时任务与验收清单
```

## 环境要求

必需：

- Node.js `>=24 <25`
- pnpm `>=11 <12`，项目锁定 `pnpm@11.7.0`

按功能可选：

- PowerShell 5.1+：Windows 一键启动与环境安装脚本
- ffmpeg：视频音频提取
- Python 3.10–3.12（推荐 3.11）：视频转写和图片 AI
- NVIDIA CUDA：可显著加速 Whisper、Real-ESRGAN 等模型；没有 CUDA 时可使用 CPU 配置

## 快速启动

### Windows 一键启动

```powershell
Copy-Item .env.example .env
.\start.bat
```

启动器会校验 lockfile、自动探测当前局域网 IPv4、首次安装轻量 Edge-TTS 环境、启动前后端，并启动已经安装的图片 AI 与 Chatterbox 本地 Worker。Chatterbox 体积较大，不会在普通一键启动时自动安装。重复点击时，如果服务已经健康运行，会直接复用并打开页面；如果检测到本项目遗留的部分进程，会自动清理后重新启动。端口被其他程序占用时仍会安全退出并显示进程信息；只有显式运行 `scripts/start-dev.ps1 -ForceRestart` 才会清理陌生进程。

需要完全关闭项目并释放前端、后端和本地 AI Worker 占用的 CPU、内存及显存时，双击或运行：

```powershell
.\stop.bat
```

关闭脚本会识别本项目的进程树并释放 `3100`、`5173`、`3210`、`3220` 端口，不会结束恰好占用这些端口的其他程序。

如需清空缓存、构建产物、日志和工具运行期间生成的本地数据，可双击：

```powershell
.\一键清理缓存和运行数据.bat
```

脚本会先按分类显示文件数量和预计释放空间，再让你用编号多选并二次确认。小红书永久存档属于高风险项且默认不选；`node_modules`、Python 环境、模型、`.env` 和小红书登录态始终保留。macOS 可双击 `macOS一键清理缓存和运行数据.command`，命令行也可运行 `pnpm clear:generated` 清理默认安全项。

需要把源码交付给其他人时，双击：

```powershell
.\package-source.bat
```

脚本通过 `git archive HEAD` 在 `.package/ecommerce-toolbox-source.zip` 生成可复现源码包，只包含当前提交；未提交和未跟踪文件不会进入产物，中文 Git 路径也不会被转义破坏。接收方解压后运行 `start.bat` 即可按需重新安装运行环境。

### 通用命令行启动

```bash
pnpm install --frozen-lockfile
pnpm dev
```

- 本机访问：<http://127.0.0.1:5173>
- API 健康检查：<http://127.0.0.1:3100/api/v1/health>
- 局域网访问：使用启动日志显示的 `http://<LAN-IP>:5173`

开发前端通过 `/api` 代理到本机 API，因此无需把 3100 端口暴露给局域网客户端。

## 配置

复制 `.env.example` 为 `.env`。常用变量如下：

| 变量                                         | 默认值                  | 说明                                                 |
| -------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `API_HOST`                                   | `127.0.0.1`             | API 监听地址；仅在明确需要直连 API 时改为 `0.0.0.0`  |
| `API_PORT`                                   | `3100`                  | API 端口，启动时校验范围                             |
| `DEPLOYMENT_MODE`                            | `local`                 | `local` 仅本机；`lan` 面向可信局域网并强制管理员 PIN |
| `ADMIN_PIN`                                  | 空                      | `lan` 模式必填；用于建立浏览器管理员会话             |
| `VITE_API_BASE`                              | 空                      | 空值使用同源 `/api`；分离部署时填写完整 API 地址     |
| `VITE_API_PROXY_TARGET`                      | `http://127.0.0.1:3100` | Vite 开发/预览代理目标                               |
| `CORS_ORIGINS`                               | localhost/127.0.0.1     | 允许直连 API 的精确浏览器 Origin，逗号分隔           |
| `STORAGE_ROOT`                               | `./storage`             | 运行数据目录；相对路径始终基于仓库根目录解析         |
| `DATABASE_PATH`                              | `storage/toolbox.db`    | SQLite 元数据数据库；通常无需覆盖                    |
| `LAN_TRANSFER_MAX_FILE_BYTES`                | `21474836480`           | 局域网单文件上限，默认 20 GiB                        |
| `LAN_TRANSFER_RETENTION_DAYS`                | `3`                     | 局域网文件和图文便签保留天数                         |
| `LAN_TRANSFER_UPLOAD_RETENTION_HOURS`        | `24`                    | 未完成分片上传的保留时间                             |
| `LAN_TRANSFER_CLEANUP_INTERVAL_MINUTES`      | `15`                    | 过期文件和废弃分片的自动清理周期                     |
| `LAN_TRANSFER_MAX_STORAGE_BYTES`             | `107374182400`          | 文件、图文图片与活动上传总配额，默认 100 GiB         |
| `LAN_TRANSFER_WEB_PORT`                      | `5173`                  | 生成局域网分享地址时使用的前端端口                   |
| `LAN_TRANSFER_PIN`                           | 空                      | 可选管理 PIN；留空保持免登录模式                     |
| `LAN_TRANSFER_GUEST_MODE`                    | `full`                  | `full`、`upload-only`、`download-only` 或 `disabled` |
| `LAN_OFFICE_PREVIEW_URL`                     | 空                      | kkFileView 对浏览器公开的预览根地址                  |
| `LAN_OFFICE_PREVIEW_SOURCE_BASE_URL`         | 空                      | kkFileView 拉取本项目临时 Office 源文件的后端地址    |
| `LAN_OFFICE_PREVIEW_TICKET_LIFETIME_SECONDS` | `300`                   | 单文件 Office 源地址的有效期（30–3600 秒）           |
| `REMOTE_FETCH_TIMEOUT_MS`                    | `120000`                | 远程媒体建立连接并收到响应头的超时                   |
| `REMOTE_MEDIA_MAX_BYTES`                     | `2147483648`            | 远程媒体最大 2 GiB；同时校验响应头和实际流量         |
| `SHORT_VIDEO_PARSE_API_URL`                  | BugPk 示例地址          | 可信的短视频解析服务                                 |
| `SHORT_VIDEO_PARSE_TIMEOUT_MS`               | `20000`                 | 单次短视频解析请求超时                               |
| `SHORT_VIDEO_CACHE_TTL_MS`                   | `300000`                | 解析结果本地短缓存时间；`0` 表示关闭                 |
| `SHORT_VIDEO_PARSE_RETRIES`                  | `1`                     | 网络、限流或 5xx 的额外重试次数                      |
| `SHORT_VIDEO_TIKTOK_OEMBED_FALLBACK`         | `true`                  | 主解析失败时启用 TikTok 官方预览降级                 |
| `XHS_PROVIDER_URL`                           | 空                      | 可选的兼容解析适配器地址；留空使用隔离本机运行时     |
| `XHS_PROVIDER_PORT`                          | `5556`                  | 本机小红书解析 Worker 端口，仅监听 `127.0.0.1`       |
| `XHS_INSTALL_TIMEOUT_MS`                     | `1200000`               | 首次安装小红书解析环境的最长等待时间                 |
| `XHS_ARCHIVE_MAX_STORAGE_BYTES`              | `107374182400`          | 小红书永久存档配额，默认 100 GiB                     |
| `XHS_TRANSLATION_MODEL_URL`                  | 固定 Release Asset      | 本地 OPUS-MT CTranslate2 INT8 模型地址               |
| `XHS_TRANSLATION_PROVIDER_PORT`              | `5557`                  | 本地翻译 Worker 端口，仅监听 `127.0.0.1`             |
| `EDGE_TTS_RETENTION_DAYS`                    | `3`                     | 生成语音、字幕和任务记录的保留天数                   |
| `EDGE_TTS_QUEUE_LIMIT`                       | `20`                    | 等待和执行中的语音任务总上限                         |
| `EDGE_TTS_CONCURRENCY`                       | `2`                     | 同时生成的语音任务数量                               |
| `CHATTERBOX_WORKER_URL`                      | `http://127.0.0.1:3220` | 本机 Chatterbox Worker，保持 loopback                |
| `CHATTERBOX_WORKER_TIMEOUT_MS`               | `1200000`               | 单次本地声音克隆超时                                 |
| `CHATTERBOX_RETENTION_DAYS`                  | `3`                     | 克隆结果与任务记录保留天数                           |
| `CHATTERBOX_QUEUE_LIMIT`                     | `50`                    | 等待和执行中的克隆文案段总上限                       |
| `CHATTERBOX_DEVICE`                          | `auto`                  | 自动选择 CUDA，或显式设置 `cuda` / `cpu`             |
| `CHATTERBOX_MODEL_IDLE_MINUTES`              | `10`                    | 空闲多久后卸载模型并释放显存；`0` 表示常驻           |
| `IMAGE_AI_WORKER_URL`                        | `http://127.0.0.1:3210` | 本地 AI Worker，必须保持 loopback                    |
| `IMAGE_AI_QUEUE_LIMIT`                       | `20`                    | AI 活跃任务与预留槽总上限                            |
| `IMAGE_AI_RETENTION_HOURS`                   | `24`                    | AI 输入、结果和任务保留时间                          |
| `DEPLOYMENT_USAGE`                           | `commercial`            | `internal-noncommercial` 才允许使用 BRIA RMBG 2.0    |

小红书翻译模型默认先尝试固定 Release Asset；当该资源不可用时，会自动切换到固定提交的 Hugging Face CTranslate2 预转换恢复源，并逐文件校验摘要。Windows 上如果 Node 无法继承系统代理或 PAC 设置，模型下载会自动改用系统网络通道。若自行设置 `XHS_TRANSLATION_MODEL_URL`，则只使用该地址，不会静默替换自定义配置。

完整变量及注释见 [.env.example](./.env.example)。所有整数配置都会在 API 启动时校验，非法值会直接终止启动，避免带错误配置运行。

局域网部署必须设置 `DEPLOYMENT_MODE=lan` 和 `ADMIN_PIN`，否则 API 拒绝启动。`LAN_TRANSFER_PIN` 与 `LAN_TRANSFER_GUEST_MODE` 只控制访客文件传输能力；删除、清理、AI、翻译、配音、归档和配置写操作始终要求管理员会话。

局域网传输中的图片、视频和 PDF 由浏览器直接安全预览；Word、Excel 和 PowerPoint 使用本机部署的 kkFileView。不要使用停更的旧容器镜像：请部署当前维护版本，并在 kkFileView 中仅信任 `LAN_OFFICE_PREVIEW_SOURCE_BASE_URL` 的主机、禁用文件上传。Windows 直接运行 kkFileView 时 source 地址可填写 `http://127.0.0.1:3100`；若在 Docker Desktop 中运行，填写 `http://host.docker.internal:3100`。局域网设备访问预览时，`LAN_OFFICE_PREVIEW_URL` 必须填写本机 LAN IP（例如 `http://192.168.1.10:8012`）。应用会为每次 Office 预览签发一个仅绑定该文件、默认 5 分钟过期的源地址，不会暴露存储目录或管理员 Cookie。

## 可选能力安装

### 小红书内容归档

首次点击“获取并存档”时，模块会优先复用 Python 3.12；若本机没有，则通过固定版本 uv 把受管 Python、虚拟环境和固定提交的 XHS-Downloader 2.7 安装到 `.runtime/xhs-downloader`。普通项目启动不会安装或等待该环境。解析 Worker 只监听回环地址，媒体获取完成后立即写入 `storage/xhs-archive`。

遇到访问限制时，可在页面点击“登录小红书并重试”。登录窗口使用本机 Chrome 或 Edge，状态仅保存在 `.runtime/xhs-browser-profile`，不会进入日志、接口响应、源码包或 Git。模块不会绕过验证码。第三方来源和许可证信息见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

获取完成后会在后台使用固定版本的 `Helsinki-NLP/opus-mt-zh-en` 在本机 CPU 翻译标题、正文和话题。翻译运行时和模型只在首次生成英文时安装到 `.runtime/xhs-translate`，失败不会影响中文存档；历史存档可在内容存档页选择“补全未翻译内容”或“翻译所选”。英文支持人工修订，ZIP 会在英文就绪时增加 `Content-English.txt` 和 `内容-中英双语.txt`。模型构建可使用 `node scripts/prepare-xhs-translation-model.mjs`，模型产物不会提交 Git。

### 多国语言配音

在线自然音色支持马来语（`ms-MY`）、美式英语（`en-US`）、英式英语（`en-GB`）和巴西葡萄牙语（`pt-BR`）。巴西葡语推荐 Francisca 女声与 Antonio 男声，支持语速、音量、音调调整及 MP3/SRT 导出。请直接输入葡萄牙语文案，选择音色不会自动翻译文本。参考音色克隆也支持马来语、英语和巴西葡萄牙语。

一键启动会在首次使用时自动创建 `.venv-edge-tts`。也可以手动安装：

```powershell
.\scripts\setup-edge-tts.ps1 -Python python
```

Edge-TTS 不需要 API Key，但会把输入文案发送到微软在线语音服务，因此必须联网。生成的 MP3、可选 SRT 和任务元数据保存在 `storage/edge-tts/tasks/`，默认 3 天后自动清理。

#### Chatterbox Multilingual V3 声音克隆

需要 Python 3.11、ffmpeg，推荐 NVIDIA CUDA GPU。首次单独安装并下载模型：

```powershell
.\scripts\setup-chatterbox.ps1 -DownloadModel
```

安装完成后重新执行 `start.bat`，启动器会在 `127.0.0.1:3220` 启动常驻 Worker，模型仅在首次生成时加载，并默认在空闲 10 分钟后卸载以释放显存。页面支持马来语、英语与巴西葡萄牙语，参考录音限制 5–30 秒、20 MB，推荐使用 10–20 秒单人清晰录音。只有本人声音或已取得明确授权的声音才能使用。参考音色克隆支持最多 30 个有序文案段、每段独立 MP3、按顺序拼接的总 MP3、批量 ZIP、原文/中文/双语 SRT、详情管理及单段安全重新生成；单段最多 1,200 字符，批次总计最多 20,000 字符。字幕使用最终 MP3 的实际时长累计偏移，可选择段内按完整句子分段或每段一个字幕块。详情中的单段重生成可单独覆盖情绪强度、音色遵循、随机度和种子。上传的音频可以保存到永久音色库，支持跨批次选择、试听和手动删除，不参与 3 天过期清理；批次临时参考音色和生成结果仍默认 3 天后清理。生成音频保留 Chatterbox 内置的 PerTh AI 水印。

巴西葡语克隆在接口和音色库中使用 `pt-BR`，Worker 会映射为当前通用多语言模型支持的 `pt`。请使用已获授权的巴西葡语参考录音并输入葡语文案，以引导巴西口音；语言选项不会自动翻译，也不能单独保证地域口音。

每段文案可以额外保存最多 2,000 字符的中文翻译。该翻译不参与语音生成和文案字符统计，原文 SRT、中文 SRT 和原文在上中文在下的双语 SRT 分开提供下载，ZIP 内也会同时包含。字幕以批次随机 ID 的前 8 位作为稳定哈希后缀，例如 `马来语-aB12cd34.srt`、`中文字幕-aB12cd34.srt` 与 `双语字幕-aB12cd34.srt`；总音频命名为 `总音频-aB12cd34.mp3`。选择按句分段时，原文与中文句数相同会逐句对应；句数不同时，该文案段的中文字幕及双语字幕会合并为一个完整字幕块，避免遗漏或错配中文。

### 视频文本解析

1. 安装 ffmpeg，并确认 `ffmpeg -version` 可运行。
2. 创建独立 Python 环境：

```powershell
.\scripts\setup-video-text.ps1 -Python py
```

3. 在 `.env` 中设置转写命令：

```dotenv
VIDEO_TEXT_TRANSCRIBE_COMMAND=.venv-video-text/Scripts/python.exe scripts/video-transcribe-faster-whisper.py --input {input} --output {output} --model large-v3-turbo --language zh --device cuda --compute-type int8_float16
```

无 CUDA 时改为 `--device cpu --compute-type int8`。命令模板会被解析为独立参数并通过 `execFile` 执行，不经过 shell；请不要使用管道、重定向或 `&&`。

### AI 图片处理

```powershell
.\scripts\setup-image-ai.ps1 -Python py
pnpm dev:ai
```

- Worker 仅监听 `127.0.0.1:3210`。
- 商业或未声明用途强制使用 MIT 许可的 BiRefNet 路线。
- BRIA RMBG 2.0 需要自行接受其非商用许可、放置本地快照并配置摘要；安装脚本不会自动下载 BRIA。
- 模型文件可能占用数 GiB 磁盘，首次健康检查和首次推理会明显较慢。

## 开发与质量命令

| 命令                                | 用途                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                          | 并行启动前端和 API                                   |
| `pnpm dev:web` / `pnpm dev:api`     | 单独启动某一侧                                       |
| `pnpm test`                         | 运行全部 TypeScript/Vue 测试                         |
| `pnpm coverage`                     | 执行 75/65 全局覆盖率门槛                            |
| `pnpm test:python`                  | 运行无需模型的 faster-whisper 单元测试               |
| `pnpm lock:python`                  | 生成 Python 3.11/Windows x64 Worker 哈希锁           |
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

图片 AI 的可选环境测试：

```powershell
.\.venv-image-ai\Scripts\python.exe scripts\image_ai_worker_test.py
```

## 生产构建与部署

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm build` 会清理旧产物、生成：

- `packages/shared/dist`：可直接导入的 ESM 与声明文件
- `backend/dist/server.js`：可运行 API 入口
- `frontend/dist`：静态站点

构建末尾会从真实产物导入 shared、创建 Fastify 应用并调用 `/api/v1/health`，防止“编译成功但产物无法运行”。`pnpm start` 只启动 API；生产环境还需要静态服务器托管 `frontend/dist`，并把 `/api` 反向代理到 `127.0.0.1:3100`。本地验证可在另一个终端运行 `pnpm preview:web`。

Standalone 不是第二套源码。运行 `pwsh ./scripts/package-standalone.ps1 -Platform windows` 或 `-Platform macos` 会从当前提交生成平台包、SHA-256、构建清单和第三方许可证清单；Release CI 另行生成 SBOM，并从 Python 官方固定地址下载安装器后校验摘要。

## SQLite 迁移与回滚

首次启动会检测局域网文件、便签、分片上传和小红书归档的旧索引，先复制到 `storage/migration-backups/<timestamp>` 并校验大小与 SHA-256。正式数据库尚不存在时，迁移会在同目录临时数据库中以单事务导入，完成完整性与外键检查、WAL checkpoint 和 `fsync` 后才原子切换为 `storage/toolbox.db`；解析或校验失败时拒绝启动且不会留下半迁移数据库。各任务目录中的旧 manifest 继续由对应 Repository 首次初始化时导入。媒体文件路径不变，旧元数据至少保留一个发布周期且不会作为新写入目标。SQLite 使用 WAL、外键、`busy_timeout` 和参数化语句；异常中断的任务在重启后标记为 `failed/INTERRUPTED`，必须由用户显式重试。

服务启动后会对局域网文件记录执行轻量一致性检查。缺失文件、大小不一致、危险存储名和无记录文件不会被永久删除，而是连同可恢复元数据移动到 `storage/quarantine/<timestamp>`，并在 SQLite 中写入审计事件。

升级前建议先运行 `pnpm db:migrate --dry-run`；预检不会创建数据库或备份。迁移后用 `pnpm db:verify` 检查完整性；需要恢复时运行 `pnpm db:rollback --backup <id>`。回滚会先验证整份备份，再原子替换旧索引；校验失败时保留当前数据库。不要手工删除数据库的 `-wal` 或 `-shm` 文件。

生产部署应额外做到：TLS、可信网络访问控制、磁盘配额、日志轮转、备份和进程守护。若要暴露公网，必须先增加身份认证、授权、CSRF/速率限制和审计日志。

## 数据、安全与隐私

- API 默认不反射任意 Origin；`CORS_ORIGINS` 只接受精确来源。
- 远程媒体只允许 HTTP(S) 80/443，不允许凭证；会解析 A/AAAA，拒绝环回、私网、链路本地和保留地址，并逐跳复查最多 3 次重定向。
- 图片压缩限制 20 MiB/4000 万像素，真实内容由 Sharp 解码校验，输出采用流式下载。
- 视频任务的原视频、WAV 和转写中间文件在处理结束后立即删除，仅保留结果 JSON。
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

1. 在 `packages/shared/src/tools.ts` 注册工具元数据和稳定 ID。
2. 在 `packages/shared` 定义可复用 DTO、校验与响应契约，避免前后端复制类型。
3. 后端模块只在 `/api/v1/tools/<tool-id>` 下注册路由，并为上传大小、像素、超时、并发和磁盘占用设置独立上限。
4. 前端在 `frontend/src/modules/<tool-id>` 内维护页面、API 与纯函数，路由使用动态 import。
5. 对路径、远程 URL、文件签名、失败清理和并发竞态补测试。
6. 运行 `pnpm check`，确认 dead-code、生产构建和冒烟全部通过。

## 常见问题

### 端口 3100、5173 或 3210 被占用

本项目上次启动遗留的进程会被自动识别和清理。若端口属于其他程序，启动器会显示 PID、程序名和命令行后安全退出；确认可以结束该程序时才使用 `scripts/start-dev.ps1 -ForceRestart`。

### 局域网设备打不开页面

确认 Windows 防火墙允许 5173、设备处于同一网络，并使用启动日志检测到的 LAN IP。默认不需要开放 3100。

### 视频解析提示未配置转写

确认 ffmpeg、`.venv-video-text` 和 `VIDEO_TEXT_TRANSCRIBE_COMMAND`。先用 CPU `int8` 验证链路，再启用 CUDA。

### 图片 AI 健康检查失败

查看 `.logs/image-ai-worker.error.log`，确认 `.venv-image-ai`、模型目录、磁盘空间和 `DEPLOYMENT_USAGE`。Worker 冷启动可能需要几十秒。

### 构建成功但部署页面调用不到 API

生产静态服务器必须把 `/api` 代理到 API；若前后端不同域，则在构建前设置 `VITE_API_BASE`，并把前端 Origin 加入 `CORS_ORIGINS`。

## 许可证

仓库当前未声明统一项目许可证。在对外分发或商用前，请补充根许可证文件，并分别核对 ffmpeg、Whisper、各 AI 模型及第三方短视频服务的条款。
