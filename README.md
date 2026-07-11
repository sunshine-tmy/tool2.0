# 电商工具箱

一个本地优先、免账号登录的电商素材处理工作台。项目以 pnpm workspace 管理 Vue 前端、Fastify API、共享 TypeScript 契约和可选 Python AI Worker，适合个人电脑或可信局域网部署。

> [!WARNING]
> 本项目包含文件上传、下载、删除和高计算量 AI 接口，但没有用户账号与权限系统。默认 API 仅监听 `127.0.0.1`，并使用精确 CORS 白名单。不要把 API 或 AI Worker 直接暴露到公网；局域网部署也应只在可信网络中使用。

## 功能矩阵

| 模块           | 前端路由                | API 命名空间                | 能力                                                 |
| -------------- | ----------------------- | --------------------------- | ---------------------------------------------------- |
| 图片压缩       | `/tools/image-compress` | `/api/tools/image-compress` | JPEG/PNG/WebP 批量压缩、缩放和格式转换               |
| AI 图片处理    | `/tools/image-ai`       | `/api/tools/image-ai/*`     | 去水印、清晰度增强、商品图抠图，本地模型推理         |
| 局域网文件传输 | `/tools/lan-transfer`   | `/api/tools/lan-transfer/*` | 大文件分片上传、断点续传、预览、下载、筛选和过期清理 |
| 视频文本解析   | `/tools/video-text`     | `/api/tools/video-text/*`   | 本地音频提取、Whisper 转写、时间轴、摘要、历史和导出 |
| 短视频解析     | `/tools/short-video`    | `/api/tools/short-video/*`  | 抖音/小红书公开分享链接解析及媒体下载代理            |

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

启动器会校验 lockfile、自动探测当前局域网 IPv4、启动前后端，并在已安装图片 AI 环境时启动本地 Worker。端口被其他程序占用时默认安全退出，不会强制结束陌生进程；只有显式运行 `scripts/start-dev.ps1 -ForceRestart` 才会清理占用端口的进程。

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

| 变量                          | 默认值                  | 说明                                                |
| ----------------------------- | ----------------------- | --------------------------------------------------- |
| `API_HOST`                    | `127.0.0.1`             | API 监听地址；仅在明确需要直连 API 时改为 `0.0.0.0` |
| `API_PORT`                    | `3100`                  | API 端口，启动时校验范围                            |
| `VITE_API_BASE`               | 空                      | 空值使用同源 `/api`；分离部署时填写完整 API 地址    |
| `VITE_API_PROXY_TARGET`       | `http://127.0.0.1:3100` | Vite 开发/预览代理目标                              |
| `CORS_ORIGINS`                | localhost/127.0.0.1     | 允许直连 API 的精确浏览器 Origin，逗号分隔          |
| `STORAGE_ROOT`                | `./storage`             | 运行数据目录；相对路径始终基于仓库根目录解析        |
| `LAN_TRANSFER_MAX_FILE_BYTES` | `21474836480`           | 局域网单文件上限，默认 20 GiB                       |
| `LAN_TRANSFER_RETENTION_DAYS` | `7`                     | 局域网文件保留天数                                  |
| `REMOTE_FETCH_TIMEOUT_MS`     | `120000`                | 远程媒体请求总超时                                  |
| `REMOTE_MEDIA_MAX_BYTES`      | `2147483648`            | 远程媒体最大 2 GiB；同时校验响应头和实际流量        |
| `SHORT_VIDEO_PARSE_API_URL`   | BugPk 示例地址          | 可信的短视频解析服务                                |
| `IMAGE_AI_WORKER_URL`         | `http://127.0.0.1:3210` | 本地 AI Worker，必须保持 loopback                   |
| `IMAGE_AI_QUEUE_LIMIT`        | `20`                    | AI 活跃任务与预留槽总上限                           |
| `IMAGE_AI_RETENTION_HOURS`    | `24`                    | AI 输入、结果和任务保留时间                         |
| `DEPLOYMENT_USAGE`            | `commercial`            | `internal-noncommercial` 才允许使用 BRIA RMBG 2.0   |

完整变量及注释见 [.env.example](./.env.example)。所有整数配置都会在 API 启动时校验，非法值会直接终止启动，避免带错误配置运行。

## 可选能力安装

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
- 局域网分片先合并到同盘临时文件，校验大小并 `fsync` 后原子提交；失败不会破坏原分片。
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

启动器会显示冲突端口并退出。优先手动关闭对应服务；确认可以结束占用进程时才使用 `scripts/start-dev.ps1 -ForceRestart`。

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
