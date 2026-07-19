# 电商工具箱

一个本地优先、免账号登录的电商素材处理工作台。项目以 pnpm workspace 管理 Vue 前端、Fastify API、共享 TypeScript 契约和可选 Python AI Worker，适合个人电脑或可信局域网部署。

> [!WARNING]
> 本项目包含文件上传、下载、删除和高计算量 AI 接口，默认不启用账号系统；局域网传输可选管理 PIN 和访客权限。默认 API 仅监听 `127.0.0.1`，并使用精确 CORS 白名单。不要把 API 或 AI Worker 直接暴露到公网；局域网部署也应只在可信网络中使用。

## 功能矩阵

| 模块            | 前端路由                | API 命名空间                  | 能力                                                 |
| --------------- | ----------------------- | ----------------------------- | ---------------------------------------------------- |
| 图片压缩        | `/tools/image-compress` | `/api/tools/image-compress`   | JPEG/PNG/WebP 批量压缩、缩放和格式转换               |
| AI 图片处理     | `/tools/image-ai`       | `/api/tools/image-ai/*`       | 去水印、清晰度增强、商品图抠图，本地模型推理         |
| 局域网文件传输  | `/tools/lan-transfer`   | `/api/tools/lan-transfer/*`   | 文件断点续传、图文快传、预览、下载、筛选和过期清理   |
| 视频文本解析    | `/tools/video-text`     | `/api/tools/video-text/*`     | 本地音频提取、Whisper 转写、时间轴、摘要、历史和导出 |
| 马来语/英语配音 | `/tools/edge-tts`       | `/api/tools/edge-tts/*`       | Edge-TTS 在线配音与 Chatterbox V3 本机声音克隆       |
| 短视频解析      | `/tools/short-video`    | `/api/tools/short-video/*`    | 抖音/小红书/TikTok 公开分享链接解析及媒体下载代理    |
| 竞品拆解        | `/tools/video-insights` | `/api/tools/video-insights/*` | 本地竞品卡片、规则拆解、可编辑话术与模型增强         |

短视频解析会把分享链接发送给配置的第三方解析服务；其可用性、隐私政策和使用条款不由本项目控制。

竞品拆解默认将卡片和转写结论保存在 `storage/video-insights/`，不会复制原始视频。未配置模型时，仍会基于标题、文案和可用的本地转写生成钩子、结构、关键词、话术与风险提示；只有配置模型服务后，才会将用户选择的文本与必要元数据发送给该服务。

除分享链接外，工作台也支持直接上传本地视频。上传分析依赖 `VIDEO_TEXT_TRANSCRIBE_COMMAND`；视频只作为转写过程中的临时输入，分析完成或失败后都会删除原视频、提取音频和临时转写文件，卡片仅保存文件元数据、转写和拆解结果。

规则引擎 v3 采用“证据优先”策略：每个脚本关键点都会关联原文、时间位置、判定信号和证据充分度。引擎会区分带货转化、观点共鸣、知识讲解和故事叙事；除拆解钩子、观点、冲突、卖点证据链和脚本骨架外，还会输出按优先级排列的具体修改建议、规则优化终稿和完整改动清单。每条建议包含当前问题、具体动作、改写示例、预期影响和可用原文证据。最终稿只允许重排或压缩已有证据；缺少证明、报价或事实时使用明确占位符，不会自动编造。

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
                 └─ storage/：本地运行数据
```

```text
frontend/                 Vue 前端
backend/                  Fastify API、任务与存储逻辑
packages/shared/          前后端共享类型、响应结构和领域工具
scripts/                  启动、安装、Python Worker、测试和构建冒烟脚本
storage/                  运行时上传、输出、任务和索引（不提交 Git）
models/                   本地模型权重（不提交 Git）
docs/api.md               API 说明
```

## 环境要求

必需：

- Node.js `>=20 <25`（CI 使用 Node 24）
- pnpm `>=10 <12`，项目锁定 `pnpm@11.7.0`

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

### 通用命令行启动

```bash
pnpm install --frozen-lockfile
pnpm dev
```

- 本机访问：<http://127.0.0.1:5173>
- API 健康检查：<http://127.0.0.1:3100/api/health>
- 局域网访问：使用启动日志显示的 `http://<LAN-IP>:5173`

开发前端通过 `/api` 代理到本机 API，因此无需把 3100 端口暴露给局域网客户端。

## 配置

复制 `.env.example` 为 `.env`。常用变量如下：

| 变量                                    | 默认值                  | 说明                                                 |
| --------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `API_HOST`                              | `127.0.0.1`             | API 监听地址；仅在明确需要直连 API 时改为 `0.0.0.0`  |
| `API_PORT`                              | `3100`                  | API 端口，启动时校验范围                             |
| `VITE_API_BASE`                         | 空                      | 空值使用同源 `/api`；分离部署时填写完整 API 地址     |
| `VITE_API_PROXY_TARGET`                 | `http://127.0.0.1:3100` | Vite 开发/预览代理目标                               |
| `CORS_ORIGINS`                          | localhost/127.0.0.1     | 允许直连 API 的精确浏览器 Origin，逗号分隔           |
| `STORAGE_ROOT`                          | `./storage`             | 运行数据目录；相对路径始终基于仓库根目录解析         |
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
| `SHORT_VIDEO_PARSE_API_URL`             | BugPk 示例地址          | 可信的短视频解析服务                                 |
| `SHORT_VIDEO_PARSE_TIMEOUT_MS`          | `20000`                 | 单次短视频解析请求超时                               |
| `SHORT_VIDEO_CACHE_TTL_MS`              | `300000`                | 解析结果本地短缓存时间；`0` 表示关闭                 |
| `SHORT_VIDEO_PARSE_RETRIES`             | `1`                     | 网络、限流或 5xx 的额外重试次数                      |
| `SHORT_VIDEO_TIKTOK_OEMBED_FALLBACK`    | `true`                  | 主解析失败时启用 TikTok 官方预览降级                 |
| `VIDEO_INSIGHTS_MODEL_BASE_URL`         | 空                      | 可选 OpenAI 兼容或本地 HTTP 模型服务地址             |
| `VIDEO_INSIGHTS_MODEL_NAME`             | 空                      | 可选模型名称；未配置时仅使用规则引擎                 |
| `VIDEO_INSIGHTS_MODEL_API_KEY`          | 空                      | 服务端密钥，只应写入 `.env`，不会返回到前端          |
| `EDGE_TTS_RETENTION_DAYS`               | `3`                     | 生成语音、字幕和任务记录的保留天数                   |
| `EDGE_TTS_QUEUE_LIMIT`                  | `20`                    | 等待和执行中的语音任务总上限                         |
| `EDGE_TTS_CONCURRENCY`                  | `2`                     | 同时生成的语音任务数量                               |
| `CHATTERBOX_WORKER_URL`                 | `http://127.0.0.1:3220` | 本机 Chatterbox Worker，保持 loopback                |
| `CHATTERBOX_WORKER_TIMEOUT_MS`          | `1200000`               | 单次本地声音克隆超时                                 |
| `CHATTERBOX_RETENTION_DAYS`             | `3`                     | 克隆结果与任务记录保留天数                           |
| `CHATTERBOX_QUEUE_LIMIT`                | `10`                    | 等待和执行中的克隆任务总上限                         |
| `CHATTERBOX_DEVICE`                     | `auto`                  | 自动选择 CUDA，或显式设置 `cuda` / `cpu`             |
| `CHATTERBOX_MODEL_IDLE_MINUTES`         | `10`                    | 空闲多久后卸载模型并释放显存；`0` 表示常驻           |
| `IMAGE_AI_WORKER_URL`                   | `http://127.0.0.1:3210` | 本地 AI Worker，必须保持 loopback                    |
| `IMAGE_AI_QUEUE_LIMIT`                  | `20`                    | AI 活跃任务与预留槽总上限                            |
| `IMAGE_AI_RETENTION_HOURS`              | `24`                    | AI 输入、结果和任务保留时间                          |
| `DEPLOYMENT_USAGE`                      | `commercial`            | `internal-noncommercial` 才允许使用 BRIA RMBG 2.0    |

完整变量及注释见 [.env.example](./.env.example)。所有整数配置都会在 API 启动时校验，非法值会直接终止启动，避免带错误配置运行。

要启用局域网管理保护，请同时设置 `LAN_TRANSFER_PIN`，并把 `LAN_TRANSFER_GUEST_MODE` 设为 `upload-only`、`download-only` 或 `disabled`。保持 `full` 表示所有局域网设备仍拥有完整权限。

## 可选能力安装

### 马来语 / 英语配音

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

安装完成后重新执行 `start.bat`，启动器会在 `127.0.0.1:3220` 启动常驻 Worker，模型仅在首次生成时加载，并默认在空闲 10 分钟后卸载以释放显存。页面支持马来语与英语，参考录音限制 5–30 秒、20 MB，推荐使用 10–20 秒单人清晰录音。只有本人声音或已取得明确授权的声音才能使用；参考音频在任务完成或失败后立即删除，MP3、按完整句子分段并与生成音频对齐的可选 SRT 和元数据默认保留 3 天。长句只在同一个字幕块内换行，不会拆成多个时间段；旧版结构不正确的 SRT 会在再次下载时按音频总时长自动重建。生成音频保留 Chatterbox 内置的 PerTh AI 水印。

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

| 命令                                | 用途                                               |
| ----------------------------------- | -------------------------------------------------- |
| `pnpm dev`                          | 并行启动前端和 API                                 |
| `pnpm dev:web` / `pnpm dev:api`     | 单独启动某一侧                                     |
| `pnpm test`                         | 运行全部 TypeScript/Vue 测试                       |
| `pnpm test:python`                  | 运行无需模型的 faster-whisper 单元测试             |
| `pnpm lint`                         | ESLint（TypeScript + Vue）                         |
| `pnpm deadcode`                     | Knip 未使用文件、依赖与导出检查                    |
| `pnpm typecheck`                    | 全 workspace 严格类型检查                          |
| `pnpm format` / `pnpm format:check` | Prettier 写入/校验                                 |
| `pnpm build`                        | 顺序构建 shared、backend、frontend，并执行产物冒烟 |
| `pnpm check`                        | CI 同款完整质量门禁                                |
| `pnpm clean`                        | 删除构建与覆盖率产物                               |

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

构建末尾会从真实产物导入 shared、创建 Fastify 应用并调用 `/api/health`，防止“编译成功但产物无法运行”。`pnpm start` 只启动 API；生产环境还需要静态服务器托管 `frontend/dist`，并把 `/api` 反向代理到 `127.0.0.1:3100`。本地验证可在另一个终端运行 `pnpm preview:web`。

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
GET /api/health
```

统一响应：

```json
{
  "success": true,
  "message": "ok",
  "data": {}
}
```

```json
{
  "success": false,
  "message": "可读错误信息",
  "error": {
    "code": "STABLE_ERROR_CODE",
    "details": {}
  }
}
```

完整端点见 [docs/api.md](./docs/api.md)。

## 新工具接入规范

1. 在 `packages/shared/src/tools.ts` 注册工具元数据和稳定 ID。
2. 在 `packages/shared` 定义可复用 DTO、校验与响应契约，避免前后端复制类型。
3. 后端模块只在 `/api/tools/<tool-id>` 下注册路由，并为上传大小、像素、超时、并发和磁盘占用设置独立上限。
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
