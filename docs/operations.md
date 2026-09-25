# 运维与发布手册

本文档描述当前 `/api/v1` 服务的启动、权限、存储迁移、隔离区处理和 standalone 发布流程。接口字段以 [API 参考](./api.md) 和共享 Schema 为准；发生冲突时以运行时 Schema 与本文档的实际命令为准。

## 1. 启动模式与健康检查

项目只支持本机和可信局域网两种部署模式，不应直接暴露到公网。

```powershell
Copy-Item .env.example .env
# 默认 local：API 127.0.0.1:3100，前端 127.0.0.1:5173
pnpm install --frozen-lockfile
pnpm dev
```

局域网模式必须显式配置管理员 PIN；启动时缺少 PIN 会直接失败：

```dotenv
DEPLOYMENT_MODE=lan
ADMIN_PIN=请替换为高熵本地 PIN
```

三个健康端点用途不同：

| 端点                 | 成功          | 用途                                            |
| -------------------- | ------------- | ----------------------------------------------- |
| `GET /health/live`   | `200`         | 仅表示 Node 进程仍存活，不检查数据库或目录      |
| `GET /health/ready`  | `200` / `503` | 检查 SQLite 可用性及必需 storage 目录的读写权限 |
| `GET /api/v1/health` | `200`         | 返回不含绝对路径和 Worker URL 的能力摘要        |

反向代理或进程守护应使用 `/health/live` 作为存活探针、`/health/ready` 作为就绪探针；就绪失败时不要自动删除 storage 或数据库。

## 2. 权限与会话

`local` 模式为本机可信环境，管理员钩子不阻挡写请求；仍建议只监听回环地址。`lan` 模式下所有非安全方法默认要求管理员会话，只有明确标记为访客传输的路由例外。

| 能力                               | local | lan 访客                                                | lan 管理员 |
| ---------------------------------- | ----- | ------------------------------------------------------- | ---------- |
| 健康、工具、任务和历史读取         | 允许  | 允许                                                    | 允许       |
| 普通文件上传、分片上传、图文上传   | 允许  | 由 `LAN_TRANSFER_GUEST_MODE` 的 `upload-only/full` 决定 | 允许       |
| 文件/图文预览、下载、批量下载      | 允许  | 由 `download-only/full` 决定                            | 允许       |
| 删除文件、删除图文、批量删除       | 允许  | 拒绝                                                    | 允许       |
| 延期、过期清理、维护清理           | 允许  | 拒绝                                                    | 允许       |
| AI、翻译、配音、归档、配置类写操作 | 允许  | 拒绝                                                    | 允许       |

全局管理员会话流程：

1. `POST /api/v1/session` 提交 `{ "pin": "..." }`。
2. 服务返回短期 CSRF token，并设置 HttpOnly、SameSite=Strict 的 `toolbox_admin` Cookie。
3. 后续写请求必须同时发送该 Cookie、`X-CSRF-Token` 和精确的 `Origin`；Origin 必须在 `CORS_ORIGINS` 中。
4. `DELETE /api/v1/session` 退出并清除 Cookie；会话默认 12 小时过期。

局域网文件传输的 `POST /api/v1/tools/lan-transfer/access` 使用独立的可选 `LAN_TRANSFER_PIN`，只解锁访客传输能力，不授予删除、清理、延期或其他管理员权限。`LAN_TRANSFER_GUEST_MODE=disabled` 时未认证设备不具备传输能力。PIN、Cookie、Authorization、CSRF token、文本内容和本地路径不会写入结构化日志。

## 3. 限流与并发

所有请求共享每个来源默认 `300 次/分钟` 的全局限流；下表是高成本路由的独立额度。触发任一额度都返回 `429`，稳定错误码为 `RATE_LIMIT_EXCEEDED` 或 `CONCURRENCY_LIMIT_EXCEEDED`，客户端应依据 `requestId` 和 `details.limit` 展示重试提示。

| 类别                         |     速率 | 并发 |
| ---------------------------- | -------: | ---: |
| 管理员/局域网登录            |   5/分钟 |    2 |
| 普通上传、图文上传、分片会话 |  30/分钟 |    4 |
| 分片写入                     | 120/分钟 |   16 |
| 批量下载                     |  10/分钟 |    2 |
| 远程抓取（视频/归档媒体）    |  10/分钟 |    4 |
| 短视频媒体预览（Range 分片） | 240/分钟 |    8 |
| AI 图片任务                  |  10/分钟 |    2 |
| 单条翻译/翻译编辑            |  20/分钟 |    2 |
| 翻译批次                     |   5/分钟 |    1 |
| Edge-TTS/Chatterbox 任务     |  30/分钟 |    4 |

JSON body 全局上限为 1 MiB；上传路由另有文件大小、文件数、像素、时长和解压后体积限制。不要通过提高全局上限来解决单个业务上传失败。

## 4. 统一 API 约定

除二进制流、SSE 和导出文件外，JSON 响应都使用统一信封：

```json
{ "success": true, "data": {}, "message": "ok", "requestId": "req-..." }
```

```json
{
  "success": false,
  "error": { "code": "STABLE_ERROR_CODE", "message": "可读错误", "details": {} },
  "message": "可读错误",
  "requestId": "req-..."
}
```

耗时操作创建接口返回 `202` 和 `data.taskId`；使用 `GET /api/v1/tasks/:taskId` 查询，优先订阅 `GET /api/v1/tasks/:taskId/events` 的 SSE。断线、页面隐藏或代理不支持 SSE 时，前端回退为带 AbortSignal 的轮询。取消请求不会被显示为业务失败。

## 5. SQLite、迁移与回滚

SQLite 唯一事实源为 `storage/toolbox.db`，启用 WAL、外键、`busy_timeout`、参数化语句和事务；媒体仍保存在 storage。升级或首次发现旧 JSON/manifest 时遵循以下流程：

```powershell
pnpm db:migrate --dry-run   # 只扫描并报告，不创建数据库或备份
pnpm db:migrate             # 复制备份后执行单事务导入
pnpm db:verify              # integrity_check、foreign_key_check 和统计
pnpm db:rollback --backup <backup-id>
```

迁移前会把旧元数据和清单复制到 `storage/migration-backups/<timestamp>`，校验大小与 SHA-256 后才导入临时数据库。临时库通过记录数、外键、抽样摘要和 WAL checkpoint 后才原子切换为正式库；任何解析、校验或磁盘错误都会拒绝启动，不留下半迁移数据库。旧 JSON、媒体和旧备份至少保留一个发布周期，迁移不会删除它们。

回滚前必须先运行备份校验。CLI 会先把当前数据库及其 `-wal`/`-shm` 移到带时间戳的 `before-rollback` 备份，再原子恢复指定备份；恢复失败会把当前数据库放回原位。不要手工删除 WAL/SHM，也不要在服务运行时复制数据库文件。

## 6. 一致性检查与隔离区恢复

启动时会检查元数据登记的文件及残留 staging/partial 文件。缺失、大小或 SHA-256 不匹配、危险路径和孤立文件会移动到 `storage/quarantine/<timestamp>/files/`，并写入 `audit_events`；不会永久删除未登记的历史媒体。

人工恢复建议：

1. 停止服务并完整复制 `storage/quarantine/` 到离线备份，保留审计事件和原始目录结构。
2. 通过 `pnpm db:verify` 确认数据库本身完整，再根据 `storage.file_metadata_consistency` 或 `storage.consistency_check` 事件中的 `relativePath`、`reason` 和摘要定位对象。
3. 先对隔离文件重新计算 SHA-256；只有与备份或原始记录一致时，才把副本恢复到原相对路径。保留隔离副本，确认应用能够读取后再按发布周期清理。
4. 对已被移除元数据的文件，优先通过正常上传/导入流程重新登记，避免手工编辑 SQLite；需要保留原 ID 时，应在停服、备份和代码审查后执行一次性事务恢复。

如果隔离目录或数据库备份本身损坏，停止自动清理并保留现场，使用最近一次迁移备份回滚；不要用“清空 storage”作为修复手段。

## 7. Windows 桌面数据与迁移

Windows 安装版的应用管理持久数据根默认是用户在安装向导选择的最终安装根下 `data/`；Electron 设置、登录会话、日志、崩溃转储和临时目录也尽量归入该根。安装向导会执行当前用户写入测试，因此不能选择需要管理员权限的 `Program Files` 等受保护位置，也不能通过提权给安装目录放宽权限。NSIS 安装目录中的程序文件、`resources` 和 `app.asar` 不作为用户数据存放位置。面向普通用户的说明见[Windows 桌面应用使用帮助](./desktop-application-help.md)。

首次启动检测到旧版 `%LOCALAPPDATA%\\EcommerceToolboxData` 时，应用会显示来源、目标、所需空间和文件数；用户必须选择完整迁移或明确以空数据开始，选择前业务界面不开放。迁移在目标目录的同盘临时区逐文件校验 SHA-256、记录切换日志并支持中断恢复；迁移完成后旧目录仍保留作回退。该旧路径仅作为兼容旧版的迁移来源，不再是新版 Windows 安装版的默认数据位置。

“桌面设置与数据迁移”页的“导入旧版 storage”是另一项用户主动操作，只导入业务 storage 内容并保留导入前备份；不要将其与首次启动的完整根迁移混为一谈。如需回滚，请使用同一页面的回滚功能。迁移日志或摘要校验不一致时应停止操作并先复制新安装根下的 `data/`；不要通过资源管理器移动或清理迁移备份。

## 8. Windows 签名安装器与自动更新

正式 Windows 桌面版本只能通过 `v<major>.<minor>.<patch>` tag 触发 `.github/workflows/desktop-release.yml`。工作流需要 repository secrets `WINDOWS_SIGNING_CERTIFICATE_BASE64`、`WINDOWS_SIGNING_CERTIFICATE_PASSWORD`，以及 repository variable `WINDOWS_SIGNING_SUBJECT`；任一项未配置都会失败，不会发布未签名安装器。

发布后，GitHub Release 必须同时含有 `EcommerceToolboxSetup.exe`、`EcommerceToolboxSetup.exe.blockmap`、`latest.yml` 及其 `.sha256` 文件。安装版将其更新源固定为当前仓库的 `releases/latest/download`；`electron-updater` 会读取 `latest.yml`、校验其中记录的 SHA-512 后下载 NSIS 安装器。不要手工替换同名资产、修改 `latest.yml` 或省略 `.blockmap`，否则已有用户的更新检查会失败。

桌面设置页可启用/停用自动检查或手动检查。只有从已签名 NSIS 安装器安装、且带有受控 `app-update.yml` 的包会检查更新；开发启动和直接解压的输出目录均不会检查。下载完成后用户可选择立即重启安装，应用会先停止本地后端。发布 CI 会检查安装器和安装目录中的所有 `.exe` Authenticode Subject，必须与受控 `WINDOWS_SIGNING_SUBJECT` 完全一致。

发布 job 在全新的 Windows runner 中验收来自签名打包 job 的真实资产。若存在较早稳定语义版本 Release，且它同时含桌面安装器和 SHA-256 sidecar，会下载并校验 Authenticode 后执行旧版安装 → 当前版升级 → 启动健康检查；没有可升级的旧安装器时仅跳过升级用例。之后通过真实本地 API 安装并自检已签名的 Edge-TTS 与共享 Python 3.11 包，再分别卸载，确认能力运行时写入安装根 `data/components/` 且不会删除数据哨兵。最后验证静默卸载保留安装根 `data/`、同目录重装仍可读取原数据，再通过匹配本应用两次确认文本的临时 UI 自动化验证显式删除。验收安装目录位于临时目录且包含空格。工作流中的 `release` job 明确要求 `package` 与 `clean-vm-acceptance` 成功；任一失败或跳过都不会创建/更新 GitHub Release。验收 JSON 作为独立 CI artifact 保存，不混入用户下载的发布资产。

## 9. standalone 构建与发布

standalone 源码始终从当前提交的 `git archive HEAD` 生成，不包含未提交或未跟踪文件。构建命令：

```powershell
pwsh ./scripts/package-standalone.ps1 -Platform windows
pwsh ./scripts/package-standalone.ps1 -Platform macos
```

输出位于 `.package/standalone/`：双平台归档、归档 `.sha256`、`toolbox-<platform>.build-manifest.json`、`toolbox-<platform>.third-party-licenses.json` 及其校验文件。依赖清单和 SPDX SBOM 用于内部资产盘点、问题定位与版本追溯，不是许可审批流程；桌面能力包清单继续记录固定来源、摘要、签名及逐包 SBOM，生成嵌入式目录前须在 Release 中确认签名 manifest 引用的全部资产已上传。内部用途不免除摘要与签名验证。`v*` tag 工作流会验证所有文件后创建或更新 GitHub Release；手动 workflow_dispatch 不发布 Release。

发布前必须在干净 checkout 执行 `pnpm check`，再从真实 ZIP/TAR.GZ 解压目录执行 `pnpm install --frozen-lockfile`、`pnpm build` 和 `scripts/smoke-standalone.mjs`。冒烟必须覆盖 `/health/ready`、前端预览、上传、下载、删除和有界退出；不得直接把 staging 目录当成分发测试对象。

CI 的 `enterprise-acceptance` job 会在所有静态检查、Node/Python 测试、E2E、构建审计和双平台归档冒烟成功后，使用隔离临时 `STORAGE_ROOT` 重跑迁移 dry-run、初始化、`db:verify` 和 10,000 条数据基准；它不会触碰开发机的现有 storage。重构分支已合并到 main，F06 变更行覆盖率 90% 已对每个 Pull Request 生效。

## 10. 常见故障定位

| 现象                              | 首先检查                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| 浏览器全部接口 404                | 前端 `VITE_API_BASE` 是否误指向旧 `/api`；开发环境应使用 Vite `/api` 代理，正式接口为 `/api/v1` |
| `401 ADMIN_SESSION_REQUIRED`      | `lan` 模式是否已登录全局 `ADMIN_PIN` 会话                                                       |
| `403 CSRF_VALIDATION_FAILED`      | 写请求是否同时带当前 `X-CSRF-Token` 和 `CORS_ORIGINS` 中的精确 `Origin`                         |
| `429`                             | 查看稳定错误码和 `details.limit`，等待窗口后重试，不要并发重放                                  |
| `503 NOT_READY`                   | 检查 `storage/toolbox.db`、必需目录权限和磁盘空间；不要删除数据库                               |
| 任务重启后为 `failed/INTERRUPTED` | 这是有意的副作用保护；确认输入和空间后由用户显式重试                                            |
