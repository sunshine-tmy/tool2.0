# 企业级优化剩余任务与验收清单

> 本文档是企业级优化工作的唯一实时进度文档。历史背景保留在 `docs/project-plan.md`，但不再从该文件读取任务状态。

## 1. 当前基线

- 分支：`codex/enterprise-refactor`
- 基线提交：`76c65b6`
- `pnpm check`：通过
- 测试：共享 50、后端 140、前端 102、Python 7；在线测试跳过 1
- 覆盖率（行/分支）：共享 93.10%/70.39%，后端 78.79%/67.43%，前端 88.91%/78.04%
- 生产依赖：无已知漏洞
- SQLite：完整性正常、无外键错误、Schema v5（D01/D02 已完成）
- 10,000 条数据基准：列表 P95 16.73 ms，详情 P95 0.04 ms
- 仓库：无 standalone 业务源码副本和 Python 安装二进制
- 当前主要大文件：Edge-TTS 后端 748 行、LAN 页面容器 555 行、小红书页面容器 470 行、视频文本页面容器 469 行（AI 图片页 308 行）

原方案状态：P0 已完成；P1 主体完成，发布可复现性和 Release 发布待收尾；P2 SQLite 基线完成，领域关系、统一文件提交和部分模块分层未完成；P3 安全基线和 `/api/v1` 完成，完整契约、LAN 管理权限和审计统一未完成；P4 工具链和全局覆盖率完成，前端拆分、请求取消、E2E 和差异覆盖率未完成。

## 2. 状态与统一验收规则

状态只使用：`TODO`、`IN_PROGRESS`、`BLOCKED_BY_BASELINE`、`DONE`、`FAILED`。任意时刻只允许一个架构或数据任务处于 `IN_PROGRESS`；安全测试和文档同步可以并行，但必须独立提交。

每个任务是独立验收节点，默认对应一个可回退、以任务 ID 标识的提交。只有同时满足下列条件才能标记为 `DONE`：

1. 定向测试通过，新增行为具备对应自动化测试。
2. `pnpm check` 与 `git diff --check` 通过。
3. 后端任务验证 `/health/live`、`/health/ready` 和至少一个受影响接口。
4. 前端任务通过实际页面操作，不出现新增控制台或网络错误。
5. 数据任务执行迁移 dry-run 和完整性校验；涉及 Schema 时验证回滚。
6. 不删除现有媒体、音色、归档或旧迁移备份。
7. 验收日志记录完成日期、提交、测试命令和结果。同一提交内以 `[任务 ID]` 提交标题作为稳定引用，哈希在后续日志维护时补录。
8. 任一可用性回归必须先修复，不能带入下一个任务。

全局覆盖率保持行/语句/函数 75%、分支 65%，不得通过降低门槛验收。

## 3. 剩余原子任务

### A. 运行安全与工程基线

| ID  | 状态 | 任务                    | 依赖 | 验收重点                                                                                      |
| --- | ---- | ----------------------- | ---- | --------------------------------------------------------------------------------------------- |
| A01 | DONE | 修复 Python CI 审计任务 | 无   | Python Job 直接运行审计脚本或显式安装 pnpm；Linux CI 可独立通过                               |
| A02 | DONE | 收紧 LAN 管理权限边界   | 无   | LAN 模式下删除、清理、延期和批量管理必须使用管理员会话；仅明确访客上传/下载路由放行           |
| A03 | DONE | 后端有界优雅退出        | 无   | `SIGINT/SIGTERM` 调用 `app.close()`；队列、Worker、计时器、SSE、数据库在超时内结束            |
| A04 | DONE | LAN 审计迁移至 SQLite   | A02  | 停止新增 `audit.jsonl`；登录、上传、下载、删除、延期和清理写入 `audit_events`，旧日志只读保留 |
| A05 | DONE | 统一限流与并发矩阵      | A02  | 登录、上传、分片、远程抓取、AI、翻译、配音和批量下载均有独立额度及 429 契约测试               |

### B. API 契约与类型边界

| ID  | 状态 | 任务                                              | 依赖     | 验收重点                                                                                     |
| --- | ---- | ------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| B01 | DONE | 接入 Fastify TypeBox 类型提供器                   | 无       | Schema 同时生成路由输入输出类型，逐步删除手工泛型和重复 DTO                                  |
| B02 | DONE | 补齐系统、图片、视频、短视频和维护接口响应 Schema | B01      | 所有 JSON 状态码具备成功/失败 Schema 和契约测试                                              |
| B03 | DONE | 补齐 LAN 文件、图文和分片接口 Schema              | B01、A02 | LAN 全部 JSON 路由具备请求、响应和错误契约                                                   |
| B04 | DONE | 补齐 Edge-TTS 与 Chatterbox 剩余 Schema           | B01      | 主任务、批次、音色及失败响应均由共享 Schema 导出                                             |
| B05 | DONE | 补齐小红书归档、媒体和翻译 Schema                 | B01      | 获取任务、列表、详情、翻译编辑及运行时状态均受运行时校验                                     |
| B06 | DONE | 前端共享 Schema 解码                              | B02–B05  | HTTP 层对所有 JSON 响应执行共享 Schema 校验，删除平行接口类型                                |
| B07 | DONE | 固化统一响应结构                                  | B06      | 成功为 `{success,data,message?,requestId}`；错误为 `{success:false,error,message,requestId}` |

### C. 后端四层架构收尾

| ID  | 状态 | 任务                           | 依赖 | 验收重点                                                                                   |
| --- | ---- | ------------------------------ | ---- | ------------------------------------------------------------------------------------------ |
| C01 | DONE | 拆分 Edge-TTS 后端             | B04  | 拆为路由、任务服务、Repository、Python 网关和有界队列；公共接口不变，核心文件不超过 500 行 |
| C02 | DONE | 拆分 LAN 普通文件路由          | B03  | 上传、列表、预览、下载、删除和批处理从入口模块移出                                         |
| C03 | DONE | 拆分 LAN 分片上传路由          | C02  | 会话、分片、完成和取消独立；并发、重传、低磁盘测试保持通过                                 |
| C04 | DONE | 抽取小红书获取任务服务         | B05  | 路由不再维护任务 Map、远程解析、媒体下载和 staging 提交                                    |
| C05 | DONE | 拆分小红书运行时安装网关       | C04  | 下载、摘要校验、安装、进程启动和状态管理分离；首次使用流程不变                             |
| C06 | DONE | 继续拆分 Chatterbox 批处理路由 | B04  | 将重生成、排序/删除、下载导出分组，主批处理路由不超过 500 行                               |
| C07 | DONE | 拆分短视频 Provider 与缓存     | B02  | HTTP 路由、Provider、重试缓存和下载代理分层，SSRF 行为不变                                 |
| C08 | DONE | 分离图片压缩服务和文件网关     | B02  | 路由只解析 multipart 和返回 DTO；Sharp、原子输出和 ZIP 进入服务层                          |

### D. SQLite 与文件一致性

| ID  | 状态 | 任务                    | 依赖     | 验收重点                                                                  |
| --- | ---- | ----------------------- | -------- | ------------------------------------------------------------------------- |
| D01 | DONE | 建立 Schema v4 领域关系 | C01–C06  | 为小红书媒体/翻译、Chatterbox 分段增加关联列和外键；保留旧 `payload_json` |
| D02 | DONE | 启用统一文件元数据表    | D01      | 各领域登记相对路径、大小、摘要、媒体类型和所有者                          |
| D03 | DONE | 抽取原子文件提交网关    | D02      | 统一同盘 staging、校验、fsync、原子移动和数据库事务；失败清理 staging     |
| D04 | DONE | 扩展启动一致性检查      | D02、D03 | 覆盖所有领域；异常文件移入隔离区并写审计，不永久删除                      |
| D05 | DONE | 完善迁移与故障恢复测试  | D01–D04  | 覆盖 v3→v5、幂等、中断、磁盘不足、损坏、回滚、断电式提交和并发写入        |

### E. 前端结构、取消和错误恢复

| ID  | 状态 | 任务                             | 依赖     | 验收重点                                                                  |
| --- | ---- | -------------------------------- | -------- | ------------------------------------------------------------------------- |
| E01 | DONE | 为全部 HTTP API 支持 AbortSignal | B06      | 所有方法与上传均可取消，取消不显示为业务失败                              |
| E02 | DONE | 页面生命周期接入请求取消         | E01      | 路由切换、卸载和任务取消时终止请求，释放轮询与 SSE                        |
| E03 | DONE | 拆分 LAN 页面                    | C02、C03 | 页面容器不超过 600 行，队列、分享信息和批量管理进入 composable/子组件     |
| E04 | DONE | 拆分 Chatterbox composable       | C06      | 拆为编辑器、音色、任务事件和批次操作 composable；单文件不超过 400 行      |
| E05 | DONE | 拆分 Chatterbox 展示面板         | E04      | 表单、进度、批次列表和详情弹窗独立；主面板不超过 500 行                   |
| E06 | DONE | 完成小红书页面拆分               | C04      | 结果区和详情抽屉独立，页面不超过 600 行                                   |
| E07 | DONE | 拆分视频文本页面                 | E01      | 来源输入、任务进度、结果和历史独立，视觉与流程不变                        |
| E08 | DONE | 拆分 AI 图片页面                 | E01      | 输入配置、预览、结果和下载区独立，Object URL 全部正确释放                 |
| E09 | DONE | 收敛 ToolLayout 与全局样式       | E03–E08  | CSS 按基础、布局、组件和响应式分层，保持加载顺序和视觉快照                |
| E10 | DONE | 统一错误体验                     | B07、E01 | 区分取消、离线、429、5xx 和不可恢复错误，展示错误码、requestId 和重试建议 |

### F. 测试、安全与性能

| ID  | 状态                | 任务                         | 依赖                     | 验收重点                                                                         |
| --- | ------------------- | ---------------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| F01 | TODO                | 补齐小红书运行时测试         | C04、C05                 | 覆盖登录、安装失败、模型摘要、翻译批次、编辑冲突、重定向和恢复                   |
| F02 | TODO                | 完整安全负向测试             | A02、A05、B07            | 覆盖路径穿越、CRLF、恶意文件名、超大请求、越权删除、CSRF、登录爆破和敏感日志泄漏 |
| F03 | TODO                | SSRF 与归档供应链专项测试    | C05、C07                 | 验证连接固定到已校验 IP、逐跳重定向复验及安装包安全限制                          |
| F04 | TODO                | 建立 Playwright 关键流程 E2E | E03–E10                  | 覆盖启动、上传/断点续传、批量删除、配音、小红书列表和任务重试；隔离 storage      |
| F05 | TODO                | 流式与 SSE 性能验收          | D03、E02                 | 大文件上传内存稳定；任务进度 1 秒内到达；断线后轮询恢复                          |
| F06 | BLOCKED_BY_BASELINE | 启用变更行覆盖率 90%         | 当前分支合并形成新基线后 | 从 PR base 与 LCOV 计算新增/修改可执行行，低于 90% 阻止 CI                       |

### G. 可复现分发与发布

| ID  | 状态 | 任务                       | 依赖 | 验收重点                                                   |
| --- | ---- | -------------------------- | ---- | ---------------------------------------------------------- |
| G01 | TODO | 实现确定性 standalone 归档 | A01  | 同一提交同一平台连续构建两次 SHA-256 一致                  |
| G02 | TODO | 校正 SBOM 与许可证产物范围 | G01  | 从最终 staging/归档生成，并随产物发布                      |
| G03 | TODO | 发布到 GitHub Release      | G02  | `v*` 标签上传双平台包、SHA-256、SBOM 和许可证清单          |
| G04 | TODO | 从最终压缩包执行双平台冒烟 | G01  | 解压真实归档后验证安装、构建、启动、健康、传输、删除和退出 |

### H. 文档与最终验收

| ID  | 状态 | 任务                | 依赖          | 验收重点                                                             |
| --- | ---- | ------------------- | ------------- | -------------------------------------------------------------------- |
| H01 | TODO | 同步 API 与运维文档 | B07、D05、G03 | API、错误码、权限、迁移/回滚、隔离恢复和发布流程与实现一致           |
| H02 | TODO | 最终企业级验收      | 全部任务      | 干净 checkout 完成全部门禁、迁移、基准、E2E 和双平台分发，媒体不丢失 |

## 4. 接口与数据决策

- 正式接口继续仅使用 `/api/v1`，不恢复旧 `/api`。
- 架构拆分不得改变接口路径、页面视觉和现有数据格式。
- 成功响应保留可选 `message`；`data` 与 `requestId` 必须存在。
- SQLite 是唯一元数据事实源；JSON/manifest 仅作为只读迁移输入或媒体恢复清单。
- Schema v4 前向迁移前自动备份；回滚恢复数据库及 WAL/SHM，不删除旧 JSON。
- LAN 访客只获得显式上传或读取能力，绝不获得删除、清理、延期或配置管理权限。
- 不重写 Git 历史，不加入公网多租户、高可用或云数据库，不擅自添加许可证。
- 变更行覆盖率 90% 在本分支合并形成新基线后启用。

## 5. 验收日志

| 任务 ID | 状态                | 完成日期   | 提交      | 定向测试                                                                                                                       | 全量门禁          | 实际运行验证                                                                    | 备注                                                                                                              |
| ------- | ------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 基线    | DONE                | 2026-09-14 | `76c65b6` | 共享 41；后端 123；前端 82；Python 7                                                                                           | `pnpm check` 通过 | live/ready/API 可用                                                             | 在线测试跳过 1                                                                                                    |
| A01     | DONE                | 2026-09-14 | `[A01]`   | `python scripts/audit-worker-dependencies.py`                                                                                  | `pnpm check` 通过 | 不涉及运行时接口                                                                | Python Job 不再依赖未安装的 pnpm                                                                                  |
| A02     | DONE                | 2026-09-14 | `[A02]`   | `pnpm --filter backend test -- src/__tests__/lan-transfer.test.ts`（27 项）                                                    | `pnpm check` 通过 | live/ready、访客上传下载、管理员删除                                            | 管理操作使用全局管理员会话与 CSRF                                                                                 |
| A03     | DONE                | 2026-09-14 | `[A03]`   | 生命周期、Worker 退出及受影响模块定向测试 43 项                                                                                | `pnpm check` 通过 | live/ready/API、信号关闭与超时强退                                              | SSE、队列、计时器、Worker、数据库纳入关闭链路                                                                     |
| A04     | DONE                | 2026-09-15 | `[A04]`   | `lan-transfer.test.ts` 28 项；SQLite 审计动作断言                                                                              | `pnpm check` 通过 | live/ready、上传下载删除清理接口                                                | 旧 `audit.jsonl` 内容保持不变                                                                                     |
| A05     | DONE                | 2026-09-15 | `[A05]`   | 配额及模块定向测试 50 项                                                                                                       | `pnpm check` 通过 | live/ready、LAN/AI/配音/归档接口                                                | 稳定 `RATE_LIMIT_EXCEEDED`/`CONCURRENCY_LIMIT_EXCEEDED`                                                           |
| B01     | DONE                | 2026-09-15 | `[B01]`   | `lan-transfer.test.ts` 28 项；后端 TypeScript 类型检查                                                                         | `pnpm check` 通过 | live/ready、LAN 信息接口                                                        | LAN 请求体、查询和路径参数由 TypeBox Schema 直接推导                                                              |
| B02     | DONE                | 2026-09-15 | `[B02]`   | 共享 Schema 2 项；系统/图片/视频/短视频定向测试 41 项                                                                          | `pnpm check` 通过 | live/ready、维护、图片与短视频接口                                              | JSON 状态码补齐成功/失败 Schema；二进制流保持原契约                                                               |
| B03     | DONE                | 2026-09-15 | `[B03]`   | LAN 共享契约 3 项；`lan-transfer.test.ts` 28 项                                                                                | `pnpm check` 通过 | live/ready、列表、分片创建与取消                                                | 文件、图文、分片及错误响应均使用共享 Schema                                                                       |
| B04     | DONE                | 2026-09-15 | `[B04]`   | 配音共享 Schema 2 项；Edge-TTS/Chatterbox 定向测试 18 项                                                                       | `pnpm check` 通过 | live/ready、双配音健康与缺失音频接口                                            | 主任务、批次、音色类型由 Schema 推导；流式错误契约补齐                                                            |
| B05     | DONE                | 2026-09-15 | `[B05]`   | 小红书共享 Schema 3 项；归档、媒体与翻译定向测试 5 项                                                                          | `pnpm check` 通过 | live/ready、双运行时、列表及缺失任务                                            | 归档、媒体、翻译与任务类型由 Schema 推导；额外字段拒绝                                                            |
| B06     | DONE                | 2026-09-15 | `[B06]`   | HTTP 解码 5 项；前端全量 83 项                                                                                                 | `pnpm check` 通过 | 真实构建页面 200、live/ready；前端 API 调用全量带 Schema                        | 成功/失败信封与 data 均运行时校验；Schema 运行时独立分包且预算通过                                                |
| B07     | DONE                | 2026-09-15 | `[B07]`   | 共享 Schema 5 项；后端 app 11 项；前端 HTTP 6 项                                                                               | `pnpm check` 通过 | live/ready、未知路由 404、请求校验 400 均返回统一信封                           | 成功 `message` 可选且保留 `ok()` 兼容提示；所有统一信封绑定当前 requestId                                         |
| C01     | DONE                | 2026-09-15 | `[C01]`   | Edge-TTS 定向 9 项；后端全量 132 项（在线 1 项跳过）                                                                           | `pnpm check` 通过 | live/ready、Edge-TTS health/voices/task/audio 流程通过                          | 路由、任务服务、Repository、Worker 网关、有界队列和文件网关独立；入口路径保持不变                                 |
| C02     | DONE                | 2026-09-15 | `[C02]`   | LAN 定向 28 项；后端全量 132 项（在线 1 项跳过）                                                                               | `pnpm check` 通过 | live/ready、普通上传/列表/预览/下载/删除及批处理通过                            | 普通文件路由、契约定义和解析工具独立；分片上传仍由入口保留，留给 C03                                              |
| C03     | DONE                | 2026-09-15 | `[C03]`   | LAN 分片定向 28 项；后端全量 132 项（在线 1 项跳过）                                                                           | `pnpm check` 通过 | live/ready、会话/分片/合并/取消及断点重传流程通过                               | 分片上传路由独立；并发锁、重传、低磁盘检查和 staging 行为保持不变                                                 |
| C04     | DONE                | 2026-09-15 | `[C04]`   | `pnpm --filter backend test -- xhs-archive`（5 项）                                                                            | `pnpm check` 通过 | live/ready、小红书 runtime/list/get/refresh/media 流程通过                      | 获取任务 Map、远程解析、媒体下载和 staging 提交移入独立任务服务；路由接口保持不变                                 |
| C05     | DONE                | 2026-09-15 | `[C05]`   | `pnpm --filter backend test -- xhs-runtime`（2 项）                                                                            | `pnpm check` 通过 | live/ready、小红书 runtime 状态和首次安装流程保持可用                           | 安装网关、源码摘要校验、Worker 启停与健康检查分离；缓存复用逻辑保持不变                                           |
| C06     | DONE                | 2026-09-15 | `[C06]`   | `pnpm --filter backend test -- chatterbox`（9 项）                                                                             | `pnpm check` 通过 | live/ready、批次生成/重生成/排序/删除/取消/导出流程通过                         | 下载导出与批次项操作独立；批处理入口 186 行，接口路径和文件产物保持不变                                           |
| C07     | DONE                | 2026-09-15 | `[C07]`   | `pnpm --filter backend test -- short-video`（12 项）                                                                           | `pnpm check` 通过 | live/ready、短视频解析/重试/缓存/下载代理流程通过                               | Provider、缓存和下载代理独立；SSRF 校验、重试及 TikTok 兜底行为保持不变                                           |
| C08     | DONE                | 2026-09-15 | `[C08]`   | `pnpm --filter backend test -- image-tools`（5 项）                                                                            | `pnpm check` 通过 | live/ready、图片压缩/原子输出/批量 ZIP 下载流程通过                             | multipart 输入、Sharp 压缩、原子 staging 输出和 ZIP 网关独立；接口与字节结果保持不变                              |
| D01     | DONE                | 2026-09-15 | `[D01]`   | `pnpm --filter backend test -- database`（7 项）                                                                               | `pnpm check` 通过 | live/ready、Schema v3→v4、外键完整性和级联行为通过                              | 小红书媒体/翻译、Chatterbox 批次/分段/音色关系列和索引启用；旧 payload 保留                                       |
| F06     | BLOCKED_BY_BASELINE | —          | —         | —                                                                                                                              | —                 | —                                                                               | 当前大规模重构合并形成新基线后启用                                                                                |
| D02     | DONE                | 2026-09-15 | `[D02]`   | `pnpm --filter backend test -- database image-tools lan-transfer edge-tts chatterbox xhs-archive video-text image-ai`（86 项） | `pnpm check` 通过 | live/ready、图片/LAN/视频/配音/小红书/AI 流程通过；文件元数据登记与删除验证     | `files` 表启用 owner、实体索引和 SHA-256；统一仓库通过流式哈希登记相对路径，旧媒体与 JSON 未删除                  |
| D03     | DONE                | 2026-09-15 | `[D03]`   | `pnpm --filter backend test -- file-commit-gateway image-tools lan-transfer chatterbox edge-tts`（54 项）                      | `pnpm check` 通过 | live/ready、图片/LAN/分片/Chatterbox/Edge-TTS 流程通过；staging 失败清理验证    | 新增统一同盘 staging、文件/目录同步和原子提交网关；输出与上传接口保持不变                                         |
| D04     | DONE                | 2026-09-15 | `[D04]`   | `pnpm --filter backend test -- file-consistency`（1 项）                                                                       | `pnpm check` 通过 | 启动时 live/ready 及文件元数据一致性检查通过；损坏/临时文件进入隔离区           | 扩展到图片、LAN、视频、AI、Edge-TTS、Chatterbox、小红书目录；未登记历史媒体保持不变                               |
| D05     | DONE                | 2026-09-15 | `[D05]`   | `pnpm --filter backend test -- database`（10 项）                                                                              | `pnpm check` 通过 | v4→v5 升级、幂等重启、事务回滚、完整性和现有迁移回归通过                        | 保留旧媒体/JSON；验证异常不会留下半写入元数据；D03 原子提交测试覆盖断电式 staging 清理                            |
| E01     | DONE                | 2026-09-15 | `[E01]`   | `pnpm --filter frontend test -- http`（7 项）                                                                                  | `pnpm check` 通过 | HTTP 客户端各方法透传 AbortSignal；取消不显示为业务失败                         | 取消统一为 `REQUEST_ABORTED`，`cancelled=true` 且不可重试；上传配置保持兼容                                       |
| E02     | DONE                | 2026-09-15 | `[E02]`   | `pnpm --filter frontend test -- useRequestScope useTaskEvents chunk-uploader`（14 项）                                         | `pnpm check` 通过 | 构建 smoke 通过；任务 SSE/轮询、作用域释放和分片上传取消测试通过                | 新增页面作用域 AbortController；路由卸载关闭 EventSource、清理重连计时器并中止轮询；上传保留可续传会话            |
| E03     | DONE                | 2026-09-15 | `[E03]`   | `pnpm --filter frontend test -- LanSharePanel LanUploadPanel`（2 项）                                                          | `pnpm check` 通过 | LAN 页面构建、后端 smoke 与页面面板行为测试通过                                 | 页面容器 555 行；分享/访问、上传队列和文件批量操作分别移入子组件与 composable，路由和视觉流程不变                 |
| E04     | DONE                | 2026-09-15 | `[E04]`   | `pnpm --filter frontend test -- useChatterboxPanel chatterbox-api`（9 项）                                                     | `pnpm check` 通过 | Chatterbox 面板、音色、批次和任务事件回归通过                                   | 编辑器 312 行、音色 113 行、批次 333 行、主 composable 120 行；保留原面板返回 API 和生成流程                      |
| E05     | DONE                | 2026-09-15 | `[E05]`   | `pnpm --filter frontend test -- ChatterboxCurrentBatch`（1 项）                                                                | `pnpm check` 通过 | 前端生产构建、bundle budget、构建 smoke 通过                                    | 面板拆为编辑器表单、当前进度、批次历史和详情弹窗；主面板 34 行；共享响应式上下文避免改变现有 props/API            |
| E06     | DONE                | 2026-09-15 | `[E06]`   | `pnpm --filter frontend test -- XhsResultPanel XhsDetailDrawer`（2 项）                                                        | `pnpm check` 通过 | 小红书前端构建、后端归档/翻译回归、构建 smoke 通过                              | 结果区和详情抽屉提取为受控子组件；页面容器 470 行；路径、任务流、视觉与现有数据格式保持不变                       |
| E07     | DONE                | 2026-09-15 | `[E07]`   | `pnpm --filter frontend test -- VideoInputPanel VideoResultPanel VideoHistoryPanel`（3 项）                                    | `pnpm check` 通过 | 视频文本前端构建、上传/SSE/历史/导出回归、构建 smoke 通过                       | 来源输入与状态、历史列表、结果时间轴分别提取为子组件；页面容器 469 行；请求时序和 Object URL 生命周期不变         |
| E08     | DONE                | 2026-09-15 | `[E08]`   | `pnpm --filter frontend test -- ImageAiBatchPicker ImageAiTaskStatusCard`（2 项）                                              | `pnpm check` 通过 | AI 图片前端构建、三种操作/任务取消/结果下载回归、构建 smoke 通过                | 拆分水印面板、通用批处理面板、批量选择器、任务卡和结果画廊；批量预览与结果源 Object URL 在卸载时释放              |
| E09     | DONE                | 2026-09-15 | `[E09]`   | `pnpm format:check`；`pnpm --filter frontend typecheck`                                                                        | `pnpm check` 通过 | 前端生产构建、bundle budget（入口 gzip 144233/153600）、构建 smoke 通过         | 新增集中式 styles/index.css，固定 tokens→foundation→components 层顺序；global/redesign 标注基础、组件和响应式职责 |
| E10     | DONE                | 2026-09-15 | `[E10]`   | `pnpm --filter frontend exec vitest run src/services/http.test.ts src/composables/useTaskEvents.test.ts`（13 项）              | `pnpm check` 通过 | 前端生产构建、bundle budget 和构建 smoke 通过；主要页面错误入口已接入统一格式化 | 新增离线/超时/429/5xx/客户端错误分类、稳定错误码与请求 ID 展示；取消请求静默处理，不显示为业务失败                |
