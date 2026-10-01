# 多媒体归档接入验收证据

首次记录：2026-09-30；最近更新：2026-10-01。源码基线：`main` / `9f5cbf2`；工作分支：`codex/multimedia-archive`。

本文只记录实际执行结果，不将浏览器可打开、依赖可安装或 mock 测试通过等同于抖音归档功能上线。现有用户数据库、媒体、音色和平台登录 Profile 均未改动。

## MA01：解析验证（未完成）

### 已授权的真实样本

用户提供：`https://v.douyin.com/PrWnsoVIg78/`，作品文案“回理工。#日落 #晚霞 #火烧云”。

- 正常匿名浏览器最终页面：`https://www.douyin.com/note/7594644721835798635`。
- 真实类型：`awemeType=68`，含一张图片与对应动态视频的实况图文；不是普通视频，也不能用于证明多张图集排序。
- 标题、文案、作者与发布时间在正常页面可见；未执行登录、验证码绕过或读取现有用户 Cookie。

本轮新增两个用户授权样本：

| 样本                         | 分享短链                            | 最终作品 ID           | 真实媒体                             |
| ---------------------------- | ----------------------------------- | --------------------- | ------------------------------------ |
| 普通视频“2025新年快乐！”     | `https://v.douyin.com/D_DcsZsE5O8/` | `7464977705159691570` | 一段普通视频                         |
| 多张图集“时间和我都在往前走” | `https://v.douyin.com/vsMbcUyxOK4/` | `7685962392984216805` | 14 组实况：14 张图片及 14 段配对视频 |

图集不能作为“纯静态图集”的真实证明，但已覆盖多张图片顺序和多组实况配对；纯静态结构另有离线夹具回归。两条新样本无需重复提供。

### 固定版本候选验证

- 候选：DouK-Downloader 5.8，源码提交 `473c90ff70c663cfb69310fff2b8d5192f200661`。
- 固定源码地址：`https://codeload.github.com/JoeanAmier/TikTokDownloader/zip/473c90ff70c663cfb69310fff2b8d5192f200661`。
- ZIP：3,102,099 字节；SHA-256：`c652d0c6bef6f514d1a393046b205a446751a855406f2b22d73a21d81bc28789`。
- 安全列表检查：223 条路径，通过现有 `validateArchiveListing` 后解压。
- Windows x64、Python 3.12.11；隔离目录 `.package/ma01-douyin/`。
- 使用上游 `uv.lock` 执行 `uv --cache-dir .package/ma01-douyin/uv-cache sync --frozen --no-dev --project <固定源码目录> --python <3.12.11解释器>`，29 项依赖安装成功。
- 匿名 `Detail(..., detail_id="7594644721835798635").run()` 在 30 秒总超时内返回空列表，没有有效作品；不能将该候选判为接入验收通过。
- 对新增视频和图集 ID 分别复验，同样返回空列表。因此不采用该候选匿名 API 作为正式解析路径。
- 全局 uv/npm 缓存写入出现句柄错误，改用本项目 ignored 测试缓存成功；未清除或改写用户的全局缓存。

### 正常浏览器备选路径

通过 Playwright CLI 打开授权短链，页面能正常显示作品。页面使用流式 SSR，作品数据在 `self.__pace_f.push` 中，不在 `RENDER_DATA.app` 内。

进一步使用本项目固定 `@playwright/test@1.63.0` 的独立匿名 Chrome 154.0.8037.58 验证：仅用 `JSON.parse` 解析作品 ID 对应的 SSR 数据，不额外执行提取出的脚本；正常浏览器仍执行网站本身的代码。只提取显式白名单字段，不保存 `accountInfo`、Cookie、认证令牌或完整用户状态。图片与动态视频按同一图片项建立配对，不能把图集的顶层视频字段误认为普通视频。

以下媒体下载到 ignored 临时验证目录，响应均为 HTTP 200；重复下载的摘要一致：

| 媒体         |  字节数 | 实际尺寸          | SHA-256                                                            |
| ------------ | ------: | ----------------- | ------------------------------------------------------------------ |
| 图片 WebP    | 153,094 | 2160 × 2880       | `f4dbcfb36735d95dfd4976dc9313094bc00ed2ed8acdd419cab7486f4e72fd4f` |
| 配对视频 MP4 | 209,763 | 720 × 960，2.1 秒 | `9d9ca1a24bee59438449ce4f193a33ffadc5f2dad324ebe3a48fd3ad3cfb2052` |

本地 MP4 经 Chrome 加载、解码、播放和暂停成功；不依赖远程媒体 URL。图片尺寸与视频尺寸分别验证，不将图片尺寸误记为动态视频尺寸。图片为平台提供的 WebP 变体，不声称取得拍摄原始文件。

### 固定浏览器、适配器与完整媒体复验

新增 `backend/src/modules/media-archive/douyin-source.ts`，严格匹配作品 ID，兼容纯 JSON 流式 SSR、旧 `RENDER_DATA` 及普通浏览器实际收到的作品 API。普通视频有时 SSR 为空，必须等待合法作品 API，不能选择推荐作品冒充结果。无需生成签名，也不执行提取出的远程脚本。

新增 `pnpm --filter backend probe:douyin --url <分享链接> --browser <固定浏览器路径> --output <本项目.package内的新目录>`。它是独立验收 CLI，不注册生产接口、不写数据库、不复用用户登录 Profile。输出新目录不得覆盖；下载使用既有 DNS 固定与逐跳 SSRF 校验，限制单图 20 MiB/40 MP、单视频 200 MiB、总量 512 MiB，逐文件校验摘要、真实图片格式及本地视频解码。图片后缀由实际格式确定；下载或解码失败先清理暂存再回退，最终失败不能宣布通过。

Windows x64 固定组合与现有浏览器能力包一致：`playwright-core@1.63.0`，Chromium `153.0.8010.12` / revision `1243`；已有浏览器 ZIP 205,123,748 字节，SHA-256 `415968b02065d4a9e2c10b85f0ae9f489b8fba500e94d9d0a7b7c4852a7234c1`。使用已有测试解包目录，不重新下载或修改签名清单。

| 样本         | 本地媒体                           |   总字节数 | 本地播放/图片校验                    | 长短链接作品及顺序             |
| ------------ | ---------------------------------- | ---------: | ------------------------------------ | ------------------------------ |
| 普通视频     | 1 段 MP4，720 × 1280，14.933333 秒 |  6,090,655 | 加载、解码、播放、暂停通过           | 一致                           |
| 多张实况图集 | 14 张 WebP + 14 段 MP4             | 10,423,795 | 全部图片解码及 14 段视频本地播放通过 | 一致，图片/视频配对 index 0–13 |
| 单组实况     | 1 张 WebP + 1 段 MP4               |    362,857 | 固定 Chromium 153 复验通过           | 一致                           |

普通视频两次下载 SHA-256 一致：`7c0274bf1ef005275c7d3249e430cb7b34bab250a33f7eb3b21bf88a2f698e28`。最终 CLI 复验成功且使用正常浏览器作品 API，证明不是仅靠 SSR 才能通过。图集每个媒体的尺寸、字节数及摘要记录在 ignored 验收目录 `.package/ma01-douyin/gallery-final-153/result.json`；该报告 SHA-256 为 `dff43ba2f687efdc8334f2a711a8c6de187574293f8b6425a9197a40d08be849`。两次图集复验的全部 28 个媒体摘要均一致。单组实况摘要与前表一致。

图集首轮失败是 Windows libvips 缓存锁住暂存图片，诊断证据为 `EBUSY`/`EEXIST`，不是平台 404。改为在已受 20 MiB 上限约束的 Buffer 上验证图片后，全部 28 个媒体通过。失败报告保留，未覆盖为成功报告。

离线自动化：解析适配器 18 项、验收 CLI 16 项通过，覆盖普通视频、静态图片顺序、实况配对、媒体缺失、登录/私有明确标志、畸形 JSON、身份不符、解析上限、HTTP 回退、解码失败回退、格式后缀、脱敏错误、输出边界和正常浏览器 API 的来源/体积校验。定向覆盖命令：`pnpm --filter backend exec vitest run src/__tests__/douyin-probe.test.ts src/__tests__/douyin-source.test.ts --coverage --coverage.include=src/modules/media-archive/douyin-source.ts --coverage.include=src/modules/media-archive/douyin-probe.ts --coverage.reportsDirectory=../.package/ma01-douyin/final-adapter-coverage`。34 项通过；两文件行/语句 95.59%、分支 93.83%、函数 91.66%；解析适配器四项均 100%。验收后保留的本地播放器引用正式文件，不引用已移动的暂存路径。CLI 测试模拟网络和浏览器，不能取代前述在线验证。

工程复验：`pnpm typecheck`、`pnpm build`、格式及 ESLint 通过，`git diff --check` 通过；`pnpm check` 仍在原有 Knip 告警处停止，没有新增告警。`pnpm coverage` 首轮在原有组件并发范围下载测试超过 5 秒处失败；单独复跑后，原有组件测试及清理进程测试分别超过 5 秒/15 秒，未获得完整后端覆盖率通过结果。这两个测试及覆盖率配置相对 HEAD 未修改；不调大超时、不排除测试、不降低门槛，本轮不宣称全局覆盖率通过。共享覆盖率行/分支 92.38%/68.50%，前端 76.13%/78.32%，均达到既有门槛。

最终 `pnpm test:all` 复跑通过：共享 74、后端 286（跳过 5）、前端 128、桌面 39、桌面冒烟脚本 7、Python 14、工程脚本 39、差异覆盖率脚本 3 项。上述覆盖率超时测试在普通全量测试中分别用时 4.242 秒、12.855 秒通过；不能用普通测试通过替代覆盖率验收。

截至 2026-09-30 尚未完成：真实登录/失效登录、macOS 实测、受管 Profile/生命周期、生产浏览器网络安全策略和新签名能力包。后续进展见下节；不将 CLI 直接接入生产管线，MA01 仍为 `IN_PROGRESS`。

### 2026-10-01：浏览器网络与独立 Profile 收尾

新增 `browser-network.ts`：

- HTTPS CONNECT 网关仅绑定随机回环端口，每次启动生成临时代理凭据；不转发明文 HTTP、凭据 URL、非 443 端口或私网/保留地址。
- 每个隧道独立解析全部 DNS 地址，任一不安全则拒绝；拨号只消费这次已校验 IP，不再次解析主机名。TLS 不解密，原 Host/SNI/证书校验由 Chromium 保持。
- 相同主机后续连接和不同主机的新连接均重新校验；禁用 QUIC 和非代理 WebRTC UDP，取消 Chromium 默认回环代理绕过。
- 连接额度、响应头和隧道时间有界；关闭销毁本次所有隧道，并等待 socket 关闭。挂起的 DNS 不阻塞退出，稍后解析返回也不再建连。
- 运行指标仅计数，不包含目标路径、Cookie、代理凭据或本地目录；407 正常代理鉴权挑战与真正拒绝分别计数。

新增 `douyin-browser.ts`：

- 默认匿名新上下文；显式选择 Profile 才使用固定 `douyin-archive` 子目录，不复用小红书或日常 Chrome Profile，不导出 Cookie。
- 既有目录必须具有本项目 `platform=douyin`、`protocolVersion=1` 标记；未知目录、其他平台标记、错误版本、过大标记以及目录链接/Windows Junction 均拒绝。
- 单 Profile 独占；启动失败、用户关窗、取消、重复关闭和关闭异常均释放网关及独占锁。错误不回传代理密码或底层本地路径。
- 关闭自动下载和 Service Worker。Profile 数据只由 Chromium 在独立目录维护，标记文件不是“已登录”证明。

CLI 增加 `--profile <小写字母/数字/连字符名称>` 和 `--headed`。测试 Profile 仅位于 `.package/ma01-douyin/profiles/<名称>/douyin-archive`，不得用任意路径接管用户浏览器。`profileUsed=true` **只表示使用独立持久化目录，不表示认证已通过**。本轮复验使用新建匿名 Profile，没有扫码登录，也没有读取既有 Cookie。CLI 总超时以及 SIGINT/SIGTERM 通过 AbortSignal 取消浏览器和媒体下载，并移除信号监听。

真实证据：

| 验证                                  | 结果                                                    | 证据目录                                       |
| ------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| 普通视频经 DNS 固定网关解析/下载/播放 | 通过，摘要与前轮一致                                    | `.package/ma01-douyin/network-video-153`       |
| 14 组实况图集经网关完整下载           | 28 个媒体通过，全部摘要与前轮一致，顺序一致             | `.package/ma01-douyin/network-gallery-153`     |
| 新建独立匿名 Profile 获取普通视频     | 通过，未登录                                            | `.package/ma01-douyin/lifecycle-video-153`     |
| 关闭后复用同一独立 Profile 再次获取   | 通过，摘要一致，网关 `active=0`                         | `.package/ma01-douyin/profile-reuse-video-153` |
| 普通匿名浏览器首页访问                | 出现“验证码中间页”，未绕过，关闭测试窗口                | ignored Playwright CLI 日志                    |
| 只读登录字段结构探测                  | 页面导航 30 秒超时，没有取得认证证明，已关闭浏览器/网关 | `.package/ma01-douyin/auth-shape.ts`           |

已新增 `DOUYIN_CHALLENGE_REQUIRED` 与 `DOUYIN_RATE_LIMITED` 分类；仅真实验证页标题触发安全验证错误，不因作品正文包含“验证码”误判；HTTP 429 与登录要求分开处理，不猜测未知平台业务状态码。

自动化：网关 20、浏览器生命周期 15、解析 19、CLI 18，共 72 项定向测试通过。含 DNS rebinding、不同连接复验、混合私网 DNS、代理鉴权、并发额度、取消、窗口关闭、未知/跨平台 Profile、路径链接拒绝和启动失败恢复。定向四模块覆盖率行/语句 95.98%、分支 92.46%、函数 92%，门槛未降低。

本次最终 `pnpm test:all` 复验通过：共享 74、后端 324（跳过 5）、前端 128、桌面 39、桌面冒烟脚本 7、Python 14、工程脚本 39、差异覆盖率脚本 3 项。`pnpm build`（含预算/构建冒烟）、`pnpm typecheck`、格式、ESLint、`git diff --check` 均通过。`pnpm check` 仍仅在上一轮相同的 Knip 2 个文件/4 个依赖/5 个导出/16 个类型告警处停止；新增模块没有新增 Knip 告警，未将该命令标记通过。

覆盖率超时定位：原有范围并发测试用全 `0x5a` 的 2 MiB Buffer，JS 深比较在 V8 覆盖率下耗时约 5.4 秒，而且无法检出同内容分段被交换。仅优化该测试：保持原始数据体积、三个范围、完整字节比较及全部生产配置不变，各分段改为不同字节，故意让末段先返回，使用原生 `Buffer.equals` 检查全部字节。单场景覆盖运行耗时降为 76 ms；该单场景命令由于只执行一个测试，未满足整个组件模块覆盖率门槛，不能据此宣布全局覆盖率通过。完整组件测试 39 项另行通过。未调整任何超时/覆盖率门槛，生产下载逻辑未变。

随后完整执行 `pnpm coverage`，退出码 0：共享 74、后端 324（跳过 5）、前端 128 项通过，三个工作区均达到既有全局门槛。最新行/分支/函数覆盖率分别为共享 92.38%/68.50%/92.50%、后端 94.19%/73.13%/86.86%、前端 76.13%/78.32%/90.00%。后端总量包含生成的组件目录代码，不能据此推断业务代码覆盖率或性能提升。前节覆盖率失败为历史记录，本轮已完整复验通过；仍未消除的门禁问题是既有 Knip 告警。

实际后端回归：新建隔离 `.package/ma01-douyin/backend-regression-*` 数据目录，随机回环端口；`/health/live`、`/health/ready`、现有小红书列表接口均 HTTP 200，关闭成功。生产 storage、数据库、媒体、音色、现有平台登录目录及旧签名清单未改动。

此时仍待验收：用户在独立窗口正常完成抖音登录，并验证登录后获取、重启复用及失效会话；macOS 实测；正式运行时/能力包与生产接口挂接。该阶段曾询问扫码时间，不将匿名获取成功或任何 Cookie 存在当成认证成功。当时暂不推进 MA03；后续用户调整范围，见下节。

### 2026-10-01：按用户指示跳过抖音登录，推进 MA03

用户明确要求“跳过登陆相关内容，继续完成后续内容”。本期不再等待扫码，不实现抖音登录交互或宣称认证有效；匿名不可访问、需要登录、安全验证和限流继续明确失败。小红书既有登录行为不变。MA01 的匿名解析证据作为后续实现依据，macOS/能力包/最终安装验收没有豁免。

新增 `packages/shared/src/content-archive.ts`：中性归档、媒体、列表筛选、创建及任务 Schema；复用既有翻译和截帧结构，身份改为 `platform/contentId`。旧 `XhsArchiveItemSchema` 不扩展、不删除。兼容映射保持媒体 URL、顺序、时间及用户译文；抖音不能输出成旧 XHS DTO，敏感额外字段拒绝解码。

新增 `ContentArchiveRepository`，使用历史 `xhs_archives` 表，不操作媒体目录。真实列查找 `(platform, content_id)`，支持平台/类型/文案筛选与分页；同平台重复作品由唯一索引拒绝，同数字作品 ID 的跨平台记录可共存。本地归档 ID 不允许重绑定另一平台/作品，读取时同时检查载荷和真实列身份。此 Repository 尚未替换生产获取管线，挂接归 MA05。

Schema v6 为前向增量迁移：增加 `platform/content_id`、联合唯一索引和非空身份约束；旧 `noteId` 回填为小红书身份。整个 DDL、回填与版本号在一个事务内；旧 `payload_json`、媒体 ID、文件路径、翻译外键及媒体关联保持原样，重启仅验证身份，不重复改写。预检发现重复、缺少身份、未知平台、载荷/列分叉或未来 Schema 时拒绝启动，绝不自动删除或合并记录。

升级前通过 SQLite `serialize()` 创建包含已提交 WAL 的一致性整库快照，在数据库相邻 `migration-backups/schema-v6-<时间>-<随机值>` 保存数据库及 SHA-256 清单，fsync 完成后才执行迁移。默认数据库位于 storage，备份也位于 storage；自定义数据库路径时备份在其同级目录。备份失败不升级；失败的备份目录可保留诊断，但缺少有效清单的快照不能回滚。

运维命令：

- `pnpm db:migrate --dry-run` 使用只读连接报告 `schemaMigration`，不创建新数据库、备份或改写旧任务。
- `pnpm db:migrate` 升级并返回 `schemaBackupId`；实际首次启动也先备份再升级。未对用户实际数据库运行该命令。
- `pnpm db:verify` 改为只读校验，报告现有数据库实际 Schema 版本；完整性或外键错误时返回失败，不因校验而隐式迁移或恢复任务。
- 停止 Web/桌面应用后，`pnpm db:rollback --backup schema-v6-<完整 ID>` 验证摘要、Schema、完整性及外键后整库恢复；当前主库及 WAL/SHM 保存为 `*.before-schema-rollback-*`，不永久删除升级后数据。切换失败补偿恢复。
- 回滚后若要保持旧 Schema，应同时使用升级前应用版本；本分支再次启动会按规则备份并升级到 v6。既有旧 JSON 迁移备份与回滚命令继续支持。

最终自动化：共享契约 6、Repository 6、迁移/故障恢复 22，共新增 34 项通过。包括旧数据/截帧/手工译文保留、v1 缺失话题默认值、轻量列表 DTO、跨平台同 ID、唯一约束、空身份、幂等、WAL 快照、身份冲突、迁移中断、备份磁盘失败、摘要篡改、路径链接、并发写锁拒绝、切换失败补偿、只读校验和整库回滚。定向后端三模块覆盖率行/语句 98.06%、分支 91.08%、函数 100%；未改变覆盖率门槛。新增共享运行逻辑 `content-archive.ts`、`media-archive-link.ts` 纳入全局覆盖范围，不能按纯 DTO 排除；中性契约模块行/语句/函数 100%、分支 94.11%。

真实隔离验收目录 `.package/ma03-smoke-WDRIbk`，只读校验改动后复验为 `.package/ma03-smoke-Qv7A8I`：执行 CLI dry-run → migrate → verify → 启动/重启 → rollback → dry-run。v5→v6 完整性通过，健康、列表及详情均 200，截帧 PNG 预览 200/Range 206、ZIP 200 且包含按时间命名的截帧；回滚恢复 v5，升级库被保留，原 PNG 和 manifest 摘要均不变。首轮冒烟对 ZIP 名称错误期待 `frame.png` 而失败，已按既有中文截帧导出规则修正验收断言，未改业务导出逻辑；成功轮单独保留，没有覆盖首轮证据。外键故障测试初次因隔离夹具本身仍启用外键而无法构造坏库，已仅在该故障夹具中关闭外键，生产连接的外键配置未改。

最终全量复验：`pnpm test:all` 退出码 0，共享 80、后端 352（跳过 5）、前端 128、桌面 39、桌面冒烟脚本 7、Python 14、工程脚本 39、差异覆盖率脚本 3 项通过；日志 `.package/ma03-test-all-final.log`。`pnpm coverage` 退出码 0；日志 `.package/ma03-coverage-final.log`。最新全局行/分支/函数覆盖率为共享 93.29%/74.12%/93.47%、后端 94.22%/73.78%/87.11%、前端 76.13%/78.32%/90.00%，均达到既有门槛。后端总量仍含生成目录，不代表业务代码性能提升。开发期间有一轮全量复跑退出码 1，未取得完整失败分类；最终在代码固定后保存完整日志并复跑通过，不用较早结果替代最终验收。

`pnpm build`（含预算和构建冒烟）、`pnpm typecheck`、格式、ESLint、`git diff --check` 均通过。`pnpm check` 的 Knip 复跑与此前相同，仍为既有 2 个文件、4 个依赖、5 个导出、16 个类型告警，没有新增；不标记完整门禁通过。MA03 暂记 `IN_PROGRESS`，代码主体及隔离数据验收通过，但仍待全绿门禁与独立提交；正式抖音获取/浏览/翻译/截帧仍需 MA04–MA08。用户实际数据库、媒体、音色及登录目录没有被手动迁移或删除，未生成新安装包。

## MA02：产品更名与输入交互（部分完成）

已实现：

- 工具注册、导航、搜索来源、页面标题、首页最近工具与桌面设置分组统一为“多媒体内容归档”。
- 新入口 `/tools/media-archive`；旧 `/tools/xhs-archive` 跳转并保留 query/hash，稳定工具 ID、路由名、API 和磁盘路径不变。
- 自动识别/小红书/抖音来源选择，确切域名与作品路径识别；拒绝多链接、伪装域名、主页、直播、凭据与非标准端口，保留分享查询令牌。
- 抖音明确提示“接入验证中”，禁止交给小红书 Worker；按钮、回车、失败重试共用门禁，任务执行或等待登录时不重复创建任务。
- 删除确认使用中性文案。小红书原有登录、列表、媒体、翻译、截帧与导出实现未替换。

未完成：真正的平台筛选、记录徽标与抖音任务登录交互依赖 MA03–MA05 的中性数据/API。没有增加不可用的伪筛选；没有修改现有签名能力包中的平台专属名称。Web/桌面共用源码已更名，最终桌面安装包验收仍归 MA08。

### 自动化与实际运行

- `pnpm --filter @toolbox/shared test`：74 项通过，其中新增平台链接识别 20 项。
- `pnpm --filter frontend test`：128 项通过，新增路由兼容 2 项、输入门禁 2 项。
- `pnpm typecheck`：通过。
- `pnpm test:all`：通过；后端 252 项通过、5 项跳过，含小红书归档/截帧/刷新/删除回归；桌面单测 39 项、桌面冒烟脚本单测 7 项、Python 14 项、工程脚本 39 项和差异覆盖率脚本 3 项通过。
- `pnpm build`：通过，包含前后端、共享包、前端构建预算和构建冒烟。
- `pnpm check`：格式与 ESLint 通过，但在 Knip 停止；2 个未使用文件、4 个未声明依赖、5 个未使用导出、16 个未使用类型。这些涉及的配置与文件相对 HEAD 未修改，本轮没有新增 Knip 告警；完整门禁不能标记通过。
- `git diff --check`：通过。
- 隔离服务：API `127.0.0.1:3199`、Web `127.0.0.1:5199`，使用 `.package/ma02-smoke/storage`，不访问生产 storage。
- `/health/live`、`/health/ready`、旧 `/api/v1/tools/xhs-archive/items` 列表均 HTTP 200。
- 实际页面验证：旧入口跳转保留 `?item=old-id#frame`；新导航/标题显示正确；抖音分享识别后按钮禁用；小红书识别后可提交；选错平台明确提示并禁用；控制台无 Error/Warning。

2026-09-30 该阶段结论：MA01 和 MA02 均保留 `IN_PROGRESS`，当时不启动依赖 MA01 的数据库迁移或对外发布。2026-10-01 用户调整登录范围后，MA03 代码和隔离迁移已推进，详见前述最新验收；仍未对外开放正式抖音入口，不以局部测试通过取代完整节点验收。

## 2026-10-01 续：质量门禁收尾与 MA04 匿名读取服务

### 既有 Knip 问题已修复

- 图标生成脚本与桌面 preload 是真实构建入口，在对应 workspace 的 `entry` 中明确登记，不删除入口、不忽略整个目录。
- 根目录打包脚本直接使用 `tar`、`playwright-core`，根 `devDependencies` 补齐声明，固定为当前锁文件已有的 `7.5.22`、`1.63.0`。锁文件仅增加两个 importer 的六行声明，没有升级或重解析其他锁定依赖。
- 经全仓库引用核查，5 个函数/常量、16 个类型仅供本文件内部使用，移除多余 `export`，保持实现及被调用关系不变。未删除实际功能或测试。
- 安装时首次按 package 范围误选 `tar@7.5.7`，发现不等于现有锁定版本且有弃用警告，已中止该次解析并改为 `7.5.22`；旧版本未写入最终锁文件。一次离线安装因没有根直接依赖的缓存元数据而拒绝，随后按保留锁定版本安装成功。未跳过依赖声明检查。

最终 `pnpm check` 退出码 0，日志 `.package/ma04-check.log`。完整包含格式、ESLint、Knip、四工作区类型检查、全量测试、构建预算及构建冒烟。测试为共享 80、后端 377（跳过 5）、前端 128、桌面 39、桌面冒烟脚本 7、Python 14、工程脚本 39、差异覆盖率脚本 3 项通过。旧章节的 Knip 失败属于历史证据，现在不再作为阻塞。没有增加 ignore 或降低任何测试/覆盖率门槛。

隔离数据库再次验收目录 `.package/ma03-smoke-GkybQE`：CLI dry-run/migrate/verify、启动及重启的 `/health/live`、`/health/ready`、旧列表/详情、PNG 预览、Range 206、ZIP 包含截帧全部通过，整库回滚恢复 v5 并保留升级库，原媒体和 manifest 摘要不变。没有手动迁移或清理实际用户 storage。MA03 已通过实现及运行验收，并形成独立提交 `a6ca567`，现标记 `DONE`，不将后续生产挂接混入本节点。

### 可复用匿名读取服务

新增 `douyin-reader.ts`，由现有验收 CLI 实际调用，不是仅供测试的重复实现。其边界为读取已收到的普通浏览器 SSR/API，返回白名单 `DouyinSource`；不调用签名接口、不主动请求隐藏 API、不读取 Cookie、不写生产媒体或数据库。

- 输入要求 HTTPS 作品链接；短链解析后校验精确域名、端口、路径和数字作品 ID。长链接不允许被重定向成另一作品。
- API 只接受 `www.douyin.com` 对应作品详情，推荐作品的响应和错误不污染当前作品。短链导航期间按作品 ID 暂存，在最终身份确认后读取。
- SSR/API 解析上限仍为 4 MiB；API 先检查 Content-Length，再检查取得的实际字节数。并发 `body()` 最多 4 个、候选响应最多 16 个。浏览器原生响应体仍由 Chromium/Playwright 接收，不能把此解析上限宣称为浏览器进程的流式内存上限。
- 统一总时限覆盖导航、页面内容读取和轮询；外部取消立即结束等待，保留 `AbortError`/`TimeoutError`。不等待全部可能停滞的后台响应；结束时移除本函数监听、清理定时器和暂存结果，迟到响应不污染下一次读取。
- 页面和受管浏览器仍由调用方关闭；读取函数不擅自关闭其他调用者拥有的页面。验收 CLI 在最终清理中关闭浏览器和网络网关。
- 导航/API 的 429、401、404、403 和真实安全验证页面区分返回；未知 Playwright 异常转换为固定中文消息，防止泄漏路径、分享令牌或代理凭据。不新增登录流程或自动绕过。

新增离线回归 25 项，连同验收 CLI 18 项共 43 项通过；定向命令 `pnpm --filter backend exec vitest run src/__tests__/douyin-reader.test.ts src/__tests__/douyin-probe.test.ts`。读取模块定向覆盖率行/语句 98.49%、分支 95.74%、函数 100%，报告 `.package/ma04-reader-coverage`，原有门槛不变。测试 mock 曾遗漏新增 headers 字段的类型声明，已修正并通过最终完整类型检查。

### 新服务真实链接复验

使用 Playwright 技能与项目现有在线验收命令，沿用已固定的 Chromium 153.0.8010.12 和 DNS 校验连接网关，Windows x64、默认全新匿名上下文。输出只写本项目 `.package/ma04/output/playwright`，不覆盖旧验收证据或用户归档。首次用 `pnpm --filter` 传相对路径因 cwd 变为 backend，被输出路径保护拒绝，未启动浏览器；随后使用绝对路径复验成功。

| 样本                   | 结果   | 媒体与完整性                                                                            | 证据                                                                  |
| ---------------------- | ------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 普通视频 `D_DcsZsE5O8` | PASSED | 720×1280，14.933333 秒，6,090,655 字节，解码/播放通过，SHA-256 与此前一致，长短链接匹配 | `.package/ma04/output/playwright/reader-video-20261001/result.json`   |
| 图集 `vsMbcUyxOK4`     | PASSED | 14 组实况共 28 个媒体，全部下载、摘要及图片/视频解码通过，顺序与长链接匹配              | `.package/ma04/output/playwright/reader-gallery-20261001/result.json` |

两次均 `profileUsed=false`，没有导入登录态；关闭后网关 `active=0/rejected=0/failed=0`。网关 407 鉴权挑战计数分别 12、11，属于 Chromium 的正常代理协商，不是平台登录证明。

MA04 本轮完成可复用读取准备；正式能力包安装/修复/卸载挂接、支持平台验证仍未完成。MA05 的统一获取服务、新 API 与旧 XHS 薄适配尚未挂接，生产前端继续准确提示抖音未就绪。未生成或发布新的桌面安装包。

最终 `pnpm coverage` 退出码 0，完整共享/后端/前端测试与既有覆盖率门槛全部通过，日志 `.package/ma04-coverage.log`。行/分支/函数覆盖率分别为共享 93.29%/74.12%/93.47%、后端 94.23%/74.13%/87.14%、前端 76.13%/78.32%/90.00%。后端总量含生成目录，不能由此推断业务性能提升。`pnpm check`、全局覆盖率和定向覆盖率是分别完整运行的结果，不用局部模块的高覆盖率替代全量门禁；文档同步后再次执行格式检查与 `git diff --check`。

本地可回退提交：`534fe76`（质量门禁修复）、`a6ca567`（MA03 契约、平台链接边界与数据库迁移）、`27468de`（匿名读取、受管浏览器/网络基础及定向回归）。未推送远程。此前 MA02 的页面更名/输入交互等未提交改动保持在工作区，没有混入上述数据或运行时提交；MA04 仍为 `IN_PROGRESS`，不能把基础准备提交当成正式能力包/桌面集成完成。

## 2026-10-01 续：MA04 受管运行时与能力生命周期

### 已实现边界

- 增加共享 TypeBox 匿名运行状态和固定适配器协议；协议描述仅 308 字节，执行代码仍随应用发布，不复制业务源码。描述固定已提交读取实现 `27468deae565fcb3d5a074063703d9df88449aed`、Playwright 1.63.0 与 Chromium revision 1243 / 153.0.8010.12。
- 新增 `douyin-archive` 包定义与分发模板，依赖既有签名 `xhs-browser` 资产，不新增浏览器下载副本或 Python 环境。桌面安装自检验证描述与依赖，拒绝超大/不兼容描述；构建测试验证 Ed25519 签名、SBOM 和归档文件范围。
- `DouyinRuntimeManager` 只使用 ComponentManager 校验后的 generation 资产，校验协议、依赖及包版本，启动后再次校验 Chromium 实际版本。macOS 启动映射执行路径边界验证；不使用 PATH/系统浏览器或开发缓存回退。
- 状态检查只访问本地签名资产，不启动进程、联网或自动安装。新增 `GET /api/v1/tools/media-archive/runtime/douyin`，成功信封中的 `available/state` 表示可用性，不含绝对路径、Worker URL、Cookie、Profile 或虚假登录信息。
- 单运行时最多一个获取任务，资产检查前登记占用；120 秒总时限、外部取消、5 秒有界停止及幂等关闭接入应用退出。迟到解析结果不能在取消后作为成功返回；关闭失败脱敏并永久停止当前运行时，防止新增任务叠加未释放进程。
- 共享浏览器的资产可复用，但每次获取新建独立进程/匿名上下文，不传持久化 Profile，不读取或复用 XHS 登录状态。保留已有 CONNECT 网络网关与 DNS 校验后直连 IP 的策略。
- 能力重装/卸载受到运行占用保护，适配器仍安装时拒绝卸载浏览器依赖。卸载回调接入停止，不清理归档、媒体、翻译、截帧或永久音色。小红书原运行时、登录和页面获取流程没有被替换。

### 真实 Windows 隔离验收

命令：`pnpm --filter backend exec tsx F:/git仓库内容/tool2.0/.package/ma04-managed-smoke.ts`。
只写 `.package` 新临时目录；正式浏览器包使用既有受信任公钥与签名清单，适配器使用当次生成的测试 Ed25519 密钥。
测试私钥在生成产物后删除，测试公钥/包源未写入正式能力目录，未读取生产私钥、配置或 storage。

- 成功证据：`.package/ma04-managed-smoke-0E1LOC/output/playwright/result.json`，`PASSED`。从真实归档安装并完成 Chromium 原生自检，不直接使用 staging 可执行文件。
- 普通视频 `7464977705159691570` 通过普通浏览器 API 读取，媒体 1 个；图集/实况 `7685962392984216805` 通过 SSR 读取，14 组共 28 个媒体。全程 `profileUsed=false`。本轮验证受管资产读取，不重复声称完成媒体下载/解码；其下载/解码证据保留在前一节独立验收中。
- 两次浏览器均关闭，网络 `active=0/rejected=0/failed=0`；代理鉴权挑战分别为 11、10，是正常协商，不是登录证明。
- 破坏测试临时描述后状态与获取正确失败、没有启动额外浏览器；重装恢复新 generation、旧 generation 保留。浏览器依赖卸载被拒绝，随后按适配器→浏览器顺序卸载成功。测试历史媒体与永久音色哨兵原文不变。
- 首次在线尝试失败证据 `.package/ma04-managed-smoke-mzTE5S/output/playwright/result.json` 保留：`DOUYIN_PARSE_FAILED`，网关 `rejected=1/active=0`。单次拒绝没有足够诊断信息确定具体原因，不能归因于平台登录或代码回归；未放宽 SSRF 校验。复验成功不抹去首次失败，也不宣称任意网络环境均可访问。
- 页面无效附属请求的 `ERR_BLOCKED_BY_CLIENT` 在成功复验中出现，不影响目标作品 SSR/API 读取；没有绕过验证码或安全限制。

隔离旧库/真实 HTTP 启动复验：`.package/ma03-smoke-bRxqOv`。启动和重启共 12 项路由/媒体检查通过，含 `/health/live`、`/health/ready`、新匿名状态接口、旧小红书列表/详情、截帧、Range 206、ZIP；迁移 dry-run、完整性检查和整库回滚到 v5 通过，媒体及旧 manifest 摘要不变。未对实际用户库执行迁移。

### 未完成项与范围

MA04 保持 `IN_PROGRESS`：Windows 隔离签名生命周期已通过，但正式适配器 Release 资产上传/远端核验/嵌入目录登记，以及 macOS 原生构建和真实验收尚未完成。轻量协议包的 macOS 路径/自检离线测试不代表完整浏览器与作品的 macOS 实测。
正式目录没有新增测试条目，生产状态准确显示抖音未安装/不可用；前端仍不开放抖音获取。MA05 的统一归档获取/刷新任务管线与新 API、MA06–MA09 后续集成仍待实施。
登录相关内容按用户要求继续跳过。未对外发布或生成新桌面安装包，不能把本次能力生命周期准备等同于完整功能上线。

### 自动化门禁

新增共享契约 10 项、运行时 35 项、签名组件生命周期 3 项、安装自检 5 项，以及 2 项打包/模板工程回归。补强既有应用健康测试，新状态接口和已有接口在启动/退出流程中共同验证；Linux 等未支持平台明确返回不可用，不假定所有 CI 主机可安装能力。
运行时定向覆盖率：行/语句/函数 100%、分支 98.26%，报告 `.package/ma04-runtime-coverage-final`。没有降低既有全局或变更行门槛。

最终 `pnpm check` 退出码 0，日志 `.package/ma04-managed-check-final.log`：格式、ESLint、Knip、类型检查、全量测试、构建预算和构建冒烟全部通过。
测试为共享 90、后端 420（跳过 5）、前端 128、桌面 39、桌面脚本 7、Python 14、工程脚本 41、差异覆盖率脚本 3 项通过。`git diff --check` 通过。
首轮门禁和覆盖率在补充关闭竞态回归期间出现 1 个状态断言失败，记录保留在 `.package/ma04-managed-check.log` 与 `.package/ma04-managed-coverage.log`；最终冻结代码后完整重跑，不靠删除测试或降低门槛验收。

最终 `pnpm coverage` 退出码 0，日志 `.package/ma04-managed-coverage-final.log`；共享/后端/前端行、分支、函数分别为
93.58%/74.23%/93.61%、94.26%/74.91%/87.38%、76.13%/78.32%/90.00%，全部达到原有门槛。
代码与组件模板形成独立本地提交 `2d4d7a1`（接入抖音匿名受管运行时与签名能力生命周期），没有推送远程。
此前 MA02 页面更名/输入交互改动仍原样留在工作区，未混入此运行时提交。

## 2026-10-01 MA05：共享存储与旧接口兼容基础

本节点将原小红书存储实现迁入 `media-archive/ContentArchiveStore`；旧 `XhsArchiveStore` 只保留平台过滤和 DTO/URL 适配，共用同一实例、目录、SQLite 表和全局配额，不建立第二套存储。两平台同作品 ID 可共存，同平台身份不可改写；旧接口不能读取、删除、截帧或编辑抖音记录。

- 从数据库读取时校验平台、作品和本地 ID；读旧载荷时补缺省值，不改写旧清单。混合平台清单可恢复，损坏清单/恢复备份保留，不永久清除。单条写入不会删掉未载入内存的另一条数据库记录。
- 所有目录提交先验证 staging 边界及媒体文件名，再校验实际大小/摘要、fsync、同盘移动；领域记录和文件索引在一个 SQLite 事务内提交。旧目录移动失败时不清理旧目录；事务失败恢复旧媒体；提交后备份清理失败不回滚新数据。
- 最终配额复核与截帧保存按共享队列串行；单作品修改独立锁定，下载期间的手工译文更新不会被旧快照覆盖。刷新保留历史截帧，源文变化只将译文标为 stale，保留用户编辑。
- 截帧和译文保存改为清单备份/原子替换与数据库事务，索引写入失败还原原清单；不再吞掉文件登记错误。删除先移动到可恢复目录，数据库提交成功后才清除工件，失败则恢复。

### 定向验证与运行证据

新增 `content-archive-store.test.ts` 33 项；与小红书 API 9、Repository 6、翻译服务 1 项共 49 项通过。覆盖跨平台过滤、重复身份/媒体、路径拒绝、摘要/大小/缺失媒体、目录移动失败、索引/事务回滚、恢复备份保留、配额竞争、刷新保留用户内容及重启恢复。

定向命令：`pnpm --filter backend exec vitest run src/__tests__/content-archive-store.test.ts src/__tests__/xhs-archive.test.ts src/__tests__/content-archive-repository.test.ts src/__tests__/xhs-translation-service.test.ts`。
五个归档模块定向覆盖率行/语句 99.73%、分支 94.64%、函数 100%，报告 `.package/ma05-store-coverage-targeted`。存储单测的媒体字节为隔离夹具，不代表真实视频解码；图片解码与接口响应分别由现有小红书 API 测试和 HTTP 冒烟验证。

隔离运行：`pnpm --filter backend exec tsx F:/git仓库内容/tool2.0/.package/ma03-smoke.ts`，证据 `.package/ma03-smoke-o6LSnl/result.json`。旧库迁移 dry-run、完整性校验、启动/重启 12 项路由验证、健康检查、旧列表/详情、截帧 PNG 预览、Range 206、ZIP 及整库回滚至 v5 通过；旧媒体与 manifest 摘要不变。实际用户 storage、媒体、音色及迁移备份未操作。

首轮完整门禁/覆盖率各发现一项清理测试夹具不合法：`domain-consistency.test.ts` 的 `arch1` 长度低于既有公开 ID Schema 的 6 字符下限。仅将夹具换为合法 ID，未放宽生产 Schema、删除测试或降低覆盖率；原空发布时间是允许的字符串，并非失败原因。复验该组 8 项与存储 33 项共 41 项通过。失败日志保留在 `.package/ma05-store-check.log`、`.package/ma05-store-coverage.log`。

### 全量验收与独立提交

最终 `pnpm check`、`pnpm coverage` 退出码均为 0，`git diff --check` 通过；日志 `.package/ma05-store-check-final.log`、`.package/ma05-store-coverage-final.log`。格式、ESLint、Knip、类型检查、构建预算和构建冒烟均通过。
共享 90、后端 453（跳过 5）、前端 128、桌面 39、桌面脚本 7、Python 14、工程脚本 41、差异覆盖率脚本 3 项通过。
共享/后端/前端行、分支、函数分别为 93.58%/74.23%/93.61%、94.34%/75.90%/87.64%、76.13%/78.32%/90.00%，保持原门槛。

补充落盘与真实 HTTP 验证：`pnpm --filter backend exec tsx F:/git仓库内容/tool2.0/.package/ma05-store-http-smoke.ts`，证据 `.package/ma05-store-http-X8KtnD/result.json`。同作品 ID 的两平台记录落入隔离 SQLite，两个启动周期后仍有 2 条归档、4 条文件索引；完整性正常、无外键错误。旧接口仅返回小红书（抖音 ID 返回 404），旧 DTO/媒体 URL、PNG 原始字节与 ZIP 正常。该验证使用生成的真实 PNG，不涉及在线作品获取或视频播放。
补充脚本首次失败来自错误假定压缩包必大于 PNG，第二次失败来自测试环境未指定数据库路径而采用内存库；已修正脚本并复验，不将其报告为生产故障或抖音在线验收。

代码独立提交 `9a100d8`（抽取多媒体归档共享存储并保护文件事务与旧接口）；此前 MA02 前端/共享工具文案/README 改动未混入提交。文档记录与代码提交分开。

### 仍未完成

MA05 保持 `IN_PROGRESS`，本次只交付共享存储基础。统一获取服务、抖音下载/刷新任务、新中性 API、排队/取消/SSE 与重启中断恢复仍需接入；本轮没有开放抖音生产获取入口。MA04 正式能力发布/macOS 实测与 MA06–MA09 继续待完成。登录内容按用户要求跳过，未推送远程或生成新安装包。

## 2026-10-01 MA05 续：双平台获取管线与本地播放

本节替代上一节点的“管线尚未接入”现状说明，保留此前验收和失败证据。代码已独立提交 `ef68f54`（统一双平台归档获取管线并补齐取消与退出保护）；MA05 在正式能力目录与支持平台验收完成前仍为 `IN_PROGRESS`。

### 实现与兼容边界

- `ContentArchiveTaskService` 共用单并发 FIFO、16 个等待名额、任务 Repository 和下载网关。相同链接的活动任务去重；终态刚产生、临时目录尚未清理时立即重试可创建新任务。取消排队/运行任务会阻止迟到解析结果提交；原子提交阶段返回 409，避免误称已取消。
- 获取任务持久化到 SQLite，重启将 pending/running 标为 `ARCHIVE_INTERRUPTED`，不自动重新获取。SSE 投影不保存来源 URL、Cookie 或正文；终态重连立即发送状态并关闭连接。关闭操作有界、幂等，退出后拒绝新任务。
- 增加 `/api/v1/tools/media-archive` 获取、平台筛选列表、详情、刷新、删除、查询/取消任务，以及本地媒体预览/下载。请求和 JSON 响应使用共享 Schema；严格拒绝客户端 Cookie 等额外字段，不因 AJV 剥离字段而默许。LAN 管理会话、Origin/CSRF 与现有额度继续生效。
- 旧小红书 API 通过兼容 facade 复用同一管线，保持原 DTO、旧媒体 URL、登录与 Web 自动翻译，不开放另一套存储。兼容接口不能访问抖音记录；旧分享短链 `.com` 与 `.cn` 均继续受支持。
- 平台 Cookie/Worker Token 仅发送到本机小红书 Worker，不发送外部解析服务或媒体 CDN。抖音匿名适配器不读取 Cookie。下载与短链解析继续使用已校验 IP 的网关，重定向逐跳校验，不绕过平台限制。
- 媒体流式写入 staging，校验大小/摘要/格式后统一提交；抖音图片通过实际解码确定尺寸与 MIME，视频检测 MP4 容器头，完整解码由真实浏览器补验。任意必要媒体下载失败时不覆盖旧归档，下载失败/取消也终止该 CDN 连接。
- 刷新复用相同媒体的 ID/文件名，保留截帧、手工译文和历史来源；原文变化标记 stale。数据库文件摘要等待读取流 close，避免 Windows 句柄仍占用时移动目录。针对 WebP 校验后的 libvips 文件句柄缓存，在 Windows 关闭文件缓存，保留内存及运算缓存。
- Web 小红书自动安装预算继续使用 `XHS_INSTALL_TIMEOUT_MS`，另加五分钟获取预算；桌面受管/外部 Provider 与抖音不预留 Web 安装时间。翻译退出等待 pending enqueue、标记中断并取消读取，不让迟到进度/完成回调写入已关闭数据库；同毫秒创建的翻译任务使用独立 ID。

### 自动化验证

新增后端 77 项（任务/文件句柄 27、下载 16、平台适配 21、API 10、翻译退出 3），共享契约与短链回归 4 项。覆盖跨平台身份、旧 API 过滤、输入边界、下载全部/部分失败、配额不足、任务限流/提交冲突、超时/取消/重启、SSE 终态重连、刷新保留用户内容、翻译关闭竞态与同毫秒任务 ID。

定向命令：

```text
pnpm --filter backend exec vitest run src/__tests__/content-archive-task.test.ts src/__tests__/content-archive-api.test.ts src/__tests__/archive-download-gateway.test.ts src/__tests__/archive-platform-providers.test.ts src/__tests__/archive-translation-shutdown.test.ts src/__tests__/xhs-archive.test.ts src/__tests__/xhs-runtime.test.ts src/__tests__/short-video.test.ts
pnpm check
pnpm coverage
git diff --check
```

最终 `pnpm check`、`pnpm coverage` 退出码均为 0，`git diff --check` 与已暂存差异检查通过。格式、ESLint、Knip、类型检查、全量测试、构建预算和构建冒烟全部通过；未降低任何既有门槛。
日志：`.package/ma05-pipeline-check-final.log`、`.package/ma05-pipeline-coverage-final.log`。
全量通过：共享 94、后端 530（跳过 5）、前端 128、桌面 39、桌面脚本 7、Python 14、工程脚本 41、差异覆盖率脚本 3 项。
共享/后端/前端的行、分支、函数覆盖率分别为 93.62%/74.45%/93.87%、94.53%/77.92%/87.97%、76.13%/78.32%/90.00%。

上述八个测试文件定向共 117 项通过；九个管线/兼容模块覆盖率行/语句 98.47%、分支 96.27%、函数 100%，报告 `.package/ma05-pipeline-targeted-coverage`，日志 `.package/ma05-pipeline-targeted-coverage.log`。定向覆盖率通过 `--coverage.include` 指定本次模块，不能代替已经通过的全局门禁。

### 真实获取与播放证据

仅使用 `.package` 隔离目录、临时数据库和当次测试签名适配器，不改变正式能力目录，不操作用户实际 storage、归档、音色或模型。抖音登录按用户要求跳过。

真实管线命令：`pnpm --filter backend exec tsx F:/git仓库内容/tool2.0/.package/ma05-managed-pipeline-smoke.ts`。证据 `.package/ma05-managed-pipeline-CNFAIa/output/playwright/result.json` 为 `PASSED`：

- 用户普通视频 `7464977705159691570`：1 个视频，6,090,655 字节。
- 用户图集 `7685962392984216805` 实际为 14 组实况：28 个媒体，10,423,795 字节，静态图与实况片段完整保存。
- 共 29 个媒体实际大小/摘要和 Range 206 全部通过；任务、列表/详情、原始文案和重启读取通过。两次匿名浏览器退出后网络 active/failed/rejected 均为 0。

独立本地播放命令：`pnpm --filter backend exec tsx F:/git仓库内容/tool2.0/.package/ma05-preview-archive-smoke.ts`。使用 Playwright skill 的 CLI 在隔离测试页面执行真实播放、暂停、寻帧，并检查截图及控制台；不代表 MA06 完整业务页面已开放。
证据 `.package/ma05-managed-pipeline-hA1NyU/output/playwright/preview-result.json` 为 `PASSED`：29 个文件摘要、重启读取、SQLite 完整性与外键正常；实况视频 720×960、普通视频 720×1280 均 readyState=4、实际播放并暂停，error=null；图片 2160×2880 正常显示，控制台 0 错误/0 警告。截图 `.playwright-cli/page-2026-10-01T06-38-54-461Z.png` 已人工检查。

原管线 `hA1NyU` 的结果文件因首次 UI 初始化超时记录为 `FAILED`，不能被后续播放成功改写为管线通过；管线成功证据明确采用独立 `CNFAIa` 结果。此前真实 WebP 原子移动失败的 `6UBcHu`、`0INBWW`、`qrgbNL` 目录保留；锁问题已隔离确认并新增回归测试，没有通过改用非原子复制规避。

隔离旧库回归：`.package/ma03-smoke-tyTPbH/result.json`，冻结代码后再次通过 `.package/ma03-smoke-fhKnnr/result.json`。迁移 dry-run、完整性校验、v6→v5 整库回滚、两次启动共 12 项健康/旧 API/PNG/Range/ZIP 检查通过，旧媒体/清单不变。
混合平台落盘回归：`.package/ma05-store-http-alyduh/result.json`，冻结代码后再次通过 `.package/ma05-store-http-da5UTo/result.json`。两次启动均保持 2 个归档与 4 条文件索引，旧 API 仅返回小红书、抖音 ID 为 404，完整性与外键正常。

### 问题记录与下一节点

全量检查曾与覆盖率/浏览器初始化并行执行，一次已有维护清理测试在 15 秒内未完成；覆盖率同一测试通过。最终门禁冻结后独立重跑全部通过，不延长测试时限、不跳过测试。文档编辑后的一次格式检查及新增安装预算测试的首次重试断言失败均已修正：后者暴露终态清理期间去重返回旧任务，生产代码已修复并复验 43 项通过。

该节点结束时仍未完成：MA04 正式适配器发布/能力目录/macOS 原生验收；MA06 中性翻译/截帧/ZIP API 与双平台前端完整交互；MA07 综合权限/清理/安全验收；MA08 最终桌面安装包/升级验收；MA09 最终文档。当前前端抖音按钮仍禁用，不能把隔离新 API 通过等同于已发布可安装功能。没有推送远程或生成新桌面安装包，MA02 未提交更名改动保持独立。

## 2026-10-01 MA06：共享视频截帧与完整 ZIP 导出

代码提交：`1153665`。本次为 MA06 的独立验收节点，不代表整项完成；抖音登录继续按用户指示跳过。

### 实现范围

- 中性入口 `POST /api/v1/tools/media-archive/items/:id/frames` 和 `GET /api/v1/tools/media-archive/items/:id/download.zip` 支持两平台；旧小红书入口通过同一实现和过滤存储视图复用，继续返回旧 DTO/错误码，抖音记录不可通过旧入口访问。
- PNG 验证同时检查 MIME、文件签名、实际尺寸和完整像素解码；限制为 20 MiB、40 MP。不以尺寸可读作为文件有效的证明，损坏 IDAT 被拒绝；超像素在解码前拒绝。使用原共享存储的串行提交、配额、事务和回滚，不引入 FFmpeg。
- 截帧来源和时间保留，计入归档大小及文件索引；并发保存不会覆盖，失败恢复原清单/数据库并清理暂存。LAN 写接口仍需管理员会话、精确 Origin 和 CSRF，未新增访客豁免。
- ZIP 包含平台/作品身份、原始文案、中文文案、可用的英文/双语译文、元数据及全部本地媒体。用户编辑译文优先但不覆盖机器结果；过期译文不作为可用英文文案导出。抖音原文不套用小红书表情/话题清洗。
- 媒体命名保留类型/顺序；截帧含序号与毫秒时间；封面与静态图同序号时追加媒体 ID，避免 ZIP 内重名。导出预检文件存在/大小，异常返回 409；预检后的读文件异常终止流，不静默产生缺媒体的 ZIP。客户端断开会释放导出流。
- 移除旧导出重复代码及因此失去调用的两项导出。没有修改翻译服务行为、Schema、媒体物理路径或正式页面。

### 自动化门禁

新增 25 项测试：双平台截帧/导出 API 18 项、导出文本与命名 7 项。覆盖实际 PNG 校验、大小/像素/损坏输入、来源类型和跨归档来源、配额、并发、索引事务失败回滚、重启、下载/ZIP 实际字节、缺文件/大小异常及 LAN 权限。旧截帧并发测试按实际提交序号验收，不再假定两个异步解码请求必然按发起顺序完成；三个画面都必须出现在 ZIP 中。

```text
pnpm --filter backend exec vitest run src/__tests__/content-archive-artifacts.test.ts src/__tests__/content-archive-export.test.ts src/__tests__/xhs-archive.test.ts
pnpm check
pnpm coverage
pnpm --filter backend exec vitest run src/__tests__/content-archive-artifacts.test.ts src/__tests__/content-archive-export.test.ts src/__tests__/content-archive-api.test.ts src/__tests__/content-archive-store.test.ts src/__tests__/xhs-archive.test.ts --coverage --coverage.include=src/modules/media-archive/artifact-routes.ts --coverage.include=src/modules/media-archive/export.ts --coverage.include=src/modules/xhs-archive/media-routes.ts --coverage.reportsDirectory=../.package/ma06-artifacts-targeted-coverage
git diff --check
```

最终检查与覆盖率退出码均为 0，未降低门槛。首次三文件定向 34 项、五文件归档回归 77 项通过。三个截帧/导出模块行/语句 100%、分支 95.38%、函数 100%；该定向报告不能替代全局门禁。

全量通过：共享 94、后端 555（跳过 5）、前端 128、桌面 39、桌面脚本 7、Python 14、工程脚本 41、差异覆盖率脚本 3 项。
共享/后端/前端的行、分支、函数覆盖率分别为 93.62%/74.45%/93.87%、94.56%/78.54%/87.96%、76.13%/78.32%/90.00%。
日志：`.package/ma06-artifacts-check-final.log`、`.package/ma06-artifacts-coverage-final.log`、`.package/ma06-artifacts-targeted-coverage.log`。

### 真实视频与旧库补验

使用 Playwright skill 的 CLI 在隔离验收页面播放、暂停至 0.5 秒、读取浏览器解码画面并生成原分辨率 PNG，提交生产 API。仅复制上一节点隔离目录内已授权作品，不重新获取平台、不读取 Cookie、不操作用户 storage。

```text
pnpm --filter backend exec tsx ../.package/ma06-artifacts-browser-smoke.ts
pnpm --filter backend exec tsx ../.package/ma03-smoke.ts
pnpm --filter backend exec tsx ../.package/ma05-store-http-smoke.ts
```

真实截帧证据 `.package/ma06-artifacts-browser-A1aEQO/output/playwright/result.json` 为 `PASSED`：

- 实况视频截图 720×960，1,071,113 字节；普通视频截图 720×1280，1,053,473 字节。两者均暂停、时间 500 ms；PNG 下载摘要/解码尺寸与返回元数据一致。
- 实况归档原 28 媒体加截帧后为 29，ZIP 共 32 条；普通视频原 1 媒体加截帧后为 2，ZIP 共 5 条。中央目录完整、无重名、截帧解压字节与单张下载一致，导出元数据平台为 `douyin`。
- 重启保留两张截帧；健康接口均 200；SQLite integrity=ok、无外键错误。控制台 0 错误/0 警告，截帧 POST 200、视频 Range 206。
- 截图 `output/playwright/.playwright-cli/page-2026-10-01T08-04-07-874Z.png`（相对证据根目录）已人工检查，保存画面与暂停视频一致。此页面和徽标仅是验收夹具，不宣称完整产品前端已接入。

旧库证据 `.package/ma03-smoke-ZWM3J8/result.json`：dry-run、v5→v6 迁移、完整性、v6→v5 整库回滚、两次启动共 12 项健康/旧接口/PNG/ZIP 检查通过，原媒体与清单不变。
混合平台证据 `.package/ma05-store-http-iQB6il/result.json`：两次启动保持 2 个归档、4 条文件索引；旧 API 只返回小红书、抖音 ID 为 404，媒体预览/ZIP 和数据库正常。

首次门禁报告两项因抽取失去调用的导出，已删除后全量复验通过；首次旧并发测试暴露了发起顺序与完成顺序的非等价假设，已改为按实际提交结果验收并增加新并发/字节校验。LAN 夹具初次误用登录路径，修正为 `/api/v1/session` 后通过；浏览器夹具初始化的路由重复/依赖路径问题已修正，不归为生产业务通过证据。失败日志/隔离目录保留，不改写失败结果。CLI 的网络查看命令已按实际工具改用 `requests`。

### 下一节点与边界

该节点结束时计划继续 MA06 中性翻译接口、平台文本规则及编辑冲突验证，再接入完整双平台列表/详情/任务/截帧/导出前端。MA04 正式能力发布/macOS、MA07 安全清理、MA08 最终安装包及 MA09 最终文档仍待验收；正式抖音按钮没有开放。本次仅本地提交，不推送远程、不打包、不修改用户数据库，MA02 原有未提交更名改动仍保持独立。

## 2026-10-01 MA06：双平台共用翻译与异步一致性

代码提交：`e62446e`；差异基线 `4a66b94`。本次是中性翻译接口的独立验收节点，不把 MA06 整项标为完成；继续跳过抖音登录。

### 实现与保护边界

- 增加中性翻译运行时、单条/批次创建、任务查询、人工编辑及重置接口；请求和响应复用共享 Schema，不维护平行 DTO。旧小红书路由变为薄适配，处理同一存储与队列，只允许小红书 ID。
- 抖音使用完整原始文案，小红书继续独立清洗表情/话题。旧小红书 sourceHash 保持兼容；抖音原始文案与展示正文都参与版本判定，任一刷新变化会让旧结果过期，不改变媒体或原始文案。
- 入队串行去重，每批最多 100 条、等待队列最多 16 个作业、内存任务历史最多 500 条（仅淘汰终态）。批次包含其他正在运行项目时明确返回 409，不静默只返回首个已有任务而遗漏剩余作品。入队元数据失败释放去重键、标记已入队记录失败，可显式重试。
- 翻译完成及编辑都在逐条存储事务内核对原文哈希；翻译额外核对 taskId，拒绝刷新、删除或被新任务替代后的迟到结果。人工编辑仅针对 ready 且哈希一致的译文；未知/重复话题拒绝，未提交字段保持不变。
- 完成落库采用事务内最新人工编辑；运行期间重置过的话题编辑不会从旧快照恢复。机器译文和人工编辑独立保存；ZIP 及重启读取复用同一元数据。
- 中性缺失/过期补全支持平台、关键词和内容类型筛选，分页收集前 100 条；选中模式只处理显式 ID。AJV 移除额外字段前拒绝 Cookie、未知筛选或分页输入，不把非法请求静默转成合法请求。
- 混合平台任务向旧接口投影时过滤抖音 ID、当前作品 ID 和计数；纯抖音任务通过旧入口查询为 404。新平台任务使用 `media-archive-translation` 统一任务事件标识，小红书单平台保留原 `xhs-translation` 标识。
- 共用 Worker/模型及有界退出；两平台启动恢复只标记中断，不自动重跑。Web 可选自动翻译扩展到抖音，翻译失败不改变获取成功或媒体；桌面仍由能力管理安装翻译运行时。
- 服务拆为 HTTP 路由、领域队列、纯状态/版本规则和文本分段/Worker 网关；没有新增模型依赖、改变数据库 Schema 或媒体物理目录。

### 自动化与覆盖率

新增后端 44 项（API 19、异步一致性 13、执行网关 12），共享契约 3 项。覆盖平台原文、混合批次、旧接口隔离、筛选分页、权限/CSRF、去重/队列额度、Worker 异常输出、长正文分段、令牌仅附带本机、编辑/刷新/删除竞态、元数据故障、关闭恢复和重启。

```text
pnpm check
pnpm coverage
pnpm --filter backend exec vitest run src/__tests__/content-archive-translation.test.ts src/__tests__/archive-translation-concurrency.test.ts src/__tests__/archive-translation-engine.test.ts src/__tests__/archive-translation-shutdown.test.ts src/__tests__/xhs-translation-service.test.ts src/__tests__/xhs-archive.test.ts src/__tests__/content-archive-api.test.ts src/__tests__/content-archive-store.test.ts --coverage --coverage.include=src/modules/media-archive/translation-service.ts --coverage.include=src/modules/media-archive/translation-state.ts --coverage.include=src/modules/media-archive/translation-engine.ts --coverage.include=src/modules/media-archive/translation-routes.ts --coverage.include=src/modules/media-archive/text.ts --coverage.include=src/modules/xhs-archive/translation-service.ts --coverage.include=src/modules/xhs-archive/translation-routes.ts --coverage.reportsDirectory=../.package/ma06-translation-targeted-coverage
pnpm coverage:diff --base 4a66b94 --threshold 90 --lcov backend/coverage/lcov.info --lcov packages/shared/coverage/lcov.info --lcov frontend/coverage/lcov.info
git diff --check
```

最终全量检查、覆盖率及差异覆盖率退出码均为 0，未降低门槛。全量：共享 97、后端 599（跳过 5）、前端 128、桌面 39、桌面脚本 7、Python 14、工程脚本 41、差异覆盖率脚本 3 项通过。
共享/后端/前端行、分支、函数覆盖率为 93.87%/75.00%/94.44%、94.76%/79.48%/88.32%、76.13%/78.32%/90.00%。
八个文件定向 100 项通过；七个翻译/兼容模块行/语句 96.91%、分支 90.32%、函数 100%。本次提交变更可执行行 940/969，通过 90% 门槛（97.01%），未混入既有未提交 MA02 改动。
日志：`.package/ma06-translation-check-final.log`、`.package/ma06-translation-check-verified.log`、`.package/ma06-translation-coverage-final.log`、`.package/ma06-translation-targeted-final.log`。最后一次全量检查包含代码提交后的验收文档，退出码为 0。报告 `.package/ma06-translation-targeted-coverage`；独立暂存核对记录 `.package/ma06-translation-diff-coverage.json` 与正式提交后的差异门禁一致。

### 实际运行与数据补验

真实 HTTP 命令 `pnpm --filter backend exec tsx ../.package/ma06-translation-http-smoke.ts`，证据 `.package/ma06-translation-http-Tffvxg/result.json` 为 `PASSED`：后端实际监听回环，两个平台混合批次完成（2/2），人工编辑保存、过期哈希返回 409、ZIP 包含人工译文和完整媒体，重启后编辑仍存在；两次健康接口 200、SQLite integrity=ok、无外键错误。旧任务入口只返回小红书 ID/计数。

该验收 Worker 是独立本机固定协议夹具，6 次真实 HTTP Worker 请求验证令牌与输入输出链路；**不代表真实模型翻译质量已验收**。媒体为测试生成的 12×8 PNG，字节保持不变，不声称在线作品获取或完整产品页面通过。本次没有修改正式前端，不以固定 Worker 或单元测试代替后续实际页面/模型验收。

旧库命令 `pnpm --filter backend exec tsx ../.package/ma03-smoke.ts`，证据 `.package/ma03-smoke-4MwHnf/result.json`：dry-run、迁移校验、v6→v5 整库回滚及两次启动 12 项健康/旧接口/PNG/ZIP 检查通过，旧媒体/清单不变。
混合平台命令 `pnpm --filter backend exec tsx ../.package/ma05-store-http-smoke.ts`，证据 `.package/ma05-store-http-Pwc03k/result.json`：重启、4 条文件索引、旧接口隔离、PNG/ZIP 和数据库校验通过。

初次测试发现新夹具缺少 await 导致连接先关闭，以及 Worker 认证头断言误用 Authorization；修正夹具后重新通过。拆分时曾漏保留退出错误类的导入，已补齐并通过类型检查、关闭和全量回归。抖音 rawText 与展示正文不同步时的版本判定也已修正并补齐三类原文变化测试，没有放宽安全/覆盖率门槛。失败日志保留，不作为通过证据。

### 后续范围

该节点结束时，下一节点是双平台列表、详情、任务、翻译编辑、截帧和导出的前端接入。MA04 正式能力发布/macOS、MA07 综合安全清理、MA08 安装包/升级、MA09 最终文档仍待验收。前端抖音正式按钮保持禁用；用户数据库、媒体、音色和模型未触碰。该节点仅本地独立提交，不推送或生成安装包，MA02 当时的未提交更名改动保持独立；后续进度见下文。

## 2026-10-01 MA02 收尾、MA06 前端与 MA07 预览稳定性

独立提交：`a8d9aac`（更名与输入门禁）、`2e42a6b`（双平台前端）、`e4ec038`（流式断连额度）、`b4c3935`（抽屉动态宽度）。MA02 在源码与页面范围内标记完成；MA06/MA07 仍是局部验收，不等于抖音在线入口开放或安装包已更新。

### 本次实现

- 页面业务 API 改用 `/api/v1/tools/media-archive`，全部请求消费共享 Schema 并传递 AbortSignal。旧前端 `api.ts` 只保留小红书登录别名供短视频解析模块使用，不把抖音凭据送往小红书接口。
- 混合列表显示来源平台；平台、内容类型、关键词筛选共同约束未选择时的批量补译。显式选择只提交选中 ID；切换范围/分页清空选择，删除部分失败不谎报全部成功且失败项仍可重试。
- 抽取列表/详情 composable，取消旧请求并校验请求代际。抽屉关闭、页面卸载、筛选变化不会被迟到结果覆盖，也不会把取消当作业务失败。两平台运行时状态独立读取，能力未安装不隐藏本地归档。
- 详情与结果共用平台、作品 ID、作者、发布时间及原作品链接信息。抖音保留完整原始文案；只有小红书使用已有表情/话题清洗规则。复制、翻译、人工编辑/恢复和 ZIP 使用一致的数据与中性接口。
- 编辑弹窗固化打开时的 sourceHash；同一归档后台刷新不能重置未保存输入或让旧版本覆盖新原文。翻译 SSE 进入终态后读取详情，保留失败后的原文并刷新列表。
- 普通视频/实况视频共用 PNG 截帧。画布导出期间切换归档、切换视频、卸载或源摘要变化时，不上传旧画面；保存后的媒体数量与橙色截帧徽标同步更新。
- 实况图集只预加载选中视频缩略图，其余显示视频图标，图片延迟加载。详情抽屉采用 CSS `min(720px, 100vw)`，随窗口宽度实时变化，不依赖一次性 innerWidth 快照。
- 实际浏览器发现播放器取消流时可能只触发响应 close，而不触发 onResponse。并发额度现在在处理器完成后的 onSend 监听流式断连、幂等释放；不会因客户端提前断连而放行仍在执行的耗时任务。未调高或取消原有限流额度。

### 测试与门禁

前端归档定向 72 项通过，相比原模块净增 60 项；后端并发测试 3 项（新增真实 TCP 流中断及耗时处理器提前断连 2 项）。定向前端包含 13 个生产文件及 Vue 实现：行/语句 98.30%、分支 87.43%、函数 98.47%；并发模块行 97.95%、分支 89.47%、函数 100%。这些定向报告不替代全局门禁。

```text
pnpm check
pnpm coverage
pnpm --filter frontend exec vitest run src/modules/xhs-archive --coverage --coverage.include=src/modules/xhs-archive/*.ts --coverage.include=src/modules/xhs-archive/*.vue --coverage.reportsDirectory=../.package/ma06-frontend-targeted-coverage
pnpm --filter backend exec vitest run src/__tests__/request-quotas.test.ts --coverage --coverage.include=src/security/request-quotas.ts --coverage.reportsDirectory=../.package/ma07-preview-quotas-coverage
pnpm --filter frontend typecheck
git diff --check
```

前端差异基线 `a8d9aac`，正式差异覆盖率脚本验收 510/512 可执行变更行（99.61%），含 Vue；LCOV 的 SF 路径规范为 frontend 的真实绝对源码路径后再计算，未改变正式算法或门槛。后端独立提交新增可执行行 7/7（100%）。日志分别为 `.package/ma06-frontend-diff-final.log`、`.package/ma07-preview-quotas-diff-final.log`。

全量门禁与覆盖率通过，未降低门槛：共享 97、后端 601（跳过 5）、前端 188、桌面 39、桌面脚本 7、Python 14、工程脚本 41、差异覆盖率脚本 3 项。共享/后端/前端行、分支、函数分别为 93.87%/75.00%/94.44%、94.76%/79.51%/88.32%、78.35%/81.35%/91.15%。最终日志：`.package/ma06-frontend-check-final.log`、`.package/ma06-frontend-coverage-final.log`、`.package/ma06-frontend-targeted.log`、`.package/ma07-preview-quotas-test.log`。

### 真实产品页面验收

使用 Playwright skill CLI 验证真实构建后的生产 SPA 和真实 Fastify 接口，不是替代页面。复制 MA05 已获授权的隔离视频/实况归档；另建小红书兼容 DTO 夹具复用该视频，不宣称重新获取了真实小红书笔记。翻译 Worker 为本机固定协议夹具，仅验证调用、事件、编辑及持久化，不代表真实模型效果。

- 初次目录 `.package/ma06-frontend-browser-21s3Vs` 完成按平台补译、人工编辑/恢复、三类截帧及重启检查，但浏览器出现媒体 429。保留该失败证据，不将其控制台视为通过；根据此问题补齐按需预加载和流式额度释放。
- 修复后 `.package/ma06-frontend-browser-mVojkh/output/playwright/result.json` 为 `PASSED`。产品页面混合展示三条存档，平台筛选正确；普通视频 720×1280、实况视频 720×960、小红书兼容视频 720×1280 均可播放、暂停至 500 ms 并保存原分辨率 PNG。
- 三个归档各追加一帧；实况归档 29 个媒体、ZIP 34 条；两个视频归档各 2 个媒体、ZIP 各 7 条，均包含有效英文文件。刷新/重启保留截帧和译文；健康接口均为 200、SQLite integrity=ok、无外键错误。
- 修复后中性 API 记录无 4xx/5xx，视频 Range 为 206、截帧 POST 为 200、翻译创建为 202；控制台 0 错误/0 警告。旧页面链接保留查询参数/锚点跳转新入口；390px 下筛选工具栏可正常操作。CLI 网络命令按工具实际版本使用 `requests`。
- 截图 `live-photo-frame-final.png` 与 `mobile-archive-list.png`（相对上述 output/playwright 目录）已人工检查。响应式补验 `.package/ma06-drawer-resize-9qfyby` 使用最终构建及隔离数据副本：窗口从 390px 调整为 1280px 后，已打开抽屉宽度分别为 390px 和 720px，控制台无错误、列表与健康检查通过。

所有临时服务和本次专用浏览器已关闭。没有读取或修改用户实际 storage、永久音色或模型，没有生成安装包或推送远程。早期测试夹具的 DTO、传送门及 CLI 缓存问题已修正；失败记录留在隔离目录，不作为通过证据。

### 下一验收节点

MA04 正式签名能力发布及嵌入目录/macOS 实测仍待完成；MA05/MA06 的前端现在提供活动任务取消入口，并对原子提交不可取消和取消/完成竞态作出处理；但正式抖音在线入口的创建、刷新、取消/重试与平台流程仍须在能力发布后验收。MA07 已完成基础日志敏感信息收敛及 ENOSPC 刷新失败保护，尚需两平台权限、SSRF/限流、配额竞争与清理恢复专项；MA08 桌面安装/升级、MA09 最终文档仍未完成。继续跳过抖音登录，不以本轮本地页面成功替代上述验收。

### MA07 日志敏感信息收敛

统一日志脱敏配置遮蔽 Fastify 默认请求序列化中的 `req.url` 与认证/CSRF/Worker 凭据头；404 日志去掉查询串并限制路径长度。全局异常日志只记录受约束的异常类型、稳定错误码、HTTP 状态、requestId 和路由模板，不写入异常 message/stack，避免 URL 令牌、用户文本及本机绝对路径被记录。

新增 `backend/src/__tests__/log-sanitization.test.ts` 3 项测试，覆盖查询串/片段剥离、请求 URL 与凭据字段脱敏、异常消息和堆栈排除。定向 app + 脱敏测试 16 项通过；`pnpm --filter backend typecheck`、`pnpm check`、格式检查与 `git diff --check` 均通过。全量检查统计：后端 604 项通过、5 项既有跳过，前端 188 项通过，其他工作区与脚本检查通过，生产构建与 smoke 通过。

该项只完成日志边界收敛，不代表 MA07 完成；LAN 双平台授权负向、安全重定向/限流、配额和磁盘故障、清理恢复专项仍需验收。签名能力包暂不能在本机制作：当前环境未发现能力签名私钥配置或 `gh` 发布 CLI；macOS arm64 原生构建与实测也不能由 Windows x64 代替。

### MA07 磁盘写满失败保护

归档下载流遇到 `ENOSPC` 或 `EDQUOT` 时立即清理当前暂存文件并停止备用 CDN 重试，统一报告 HTTP 507 对应的 `ARCHIVE_DISK_SPACE_INSUFFICIENT`；外层任务管线也会规范化提交阶段的磁盘耗尽错误。旧归档刷新失败时不会替换清单、媒体或 SQLite 文件索引；小红书兼容任务将稳定错误码映射为 `XHS_DISK_SPACE_INSUFFICIENT`。API 文档已同步错误码说明。

新增网关/任务测试 2 项，验证停止重复请求、staging 清理、稳定错误信息，以及刷新失败后旧归档、清单和索引逐项保持。`pnpm --filter backend exec vitest run src/__tests__/archive-download-gateway.test.ts src/__tests__/content-archive-task.test.ts` 45 项通过；`pnpm --filter backend typecheck` 通过。完整 `pnpm check` 通过：共享 97、后端 606（5 项既有跳过）、前端 188、桌面 39、桌面脚本 7、Python 14、工程脚本 41、差异覆盖率脚本 3；构建预算与启动 smoke 通过。

### MA05/MA06 前端任务取消入口

代码提交：`5f1e059`。

归档任务卡现对 `pending`/`running` 任务显示“取消获取”。任务进入 `archiving` 原子提交阶段时隐藏取消按钮并解释不可取消，避免用户误以为文件提交可被中断；提交取消后显示忙碌状态，防止重复请求。页面调用中性任务取消 API，采用服务端返回的任务终态；若取消请求与正常完成竞争，以服务端结果为准并加载完成归档详情。提交阶段等原因导致取消失败时展示错误并重新读取任务状态。页面卸载继续由既有 AbortSignal 中止请求。

定向测试：`pnpm --filter frontend exec vitest run src/modules/xhs-archive/ArchiveTaskPanel.test.ts src/modules/xhs-archive/page.test.ts`，27 项通过；`pnpm --filter frontend typecheck` 通过。覆盖待处理/运行态取消入口、取消中禁用、归档提交期提示、失败终态隐藏入口、页面调用取消 API、取消成功反馈，以及取消与正常完成/原子提交冲突的竞态。定向 Vue 覆盖行/语句 96.19%、分支 76.15%、函数 95.23%；以 `5af15bf` 为基线的变更行门禁覆盖 43/46（93.48%，高于 90%）。

本次最终 `pnpm check`、`pnpm coverage` 与 `git diff --check` 均通过；全局行/语句、分支、函数覆盖率分别为：共享 93.87%/75.00%/94.44%，后端 94.78%/79.60%/88.35%，前端 78.38%/81.70%/91.15%，未调整任何门槛。真实浏览器补验 `pnpm test:e2e` 5/5 通过，新增取消流程确认页面发送一次 DELETE、展示“获取任务已取消”及重试入口；同时修正旧验收脚本仍使用旧标题/API 路径和缺少 `platform` 响应字段的问题。此功能不开放被 MA04/MA08 门禁保护的抖音在线获取，不代表 MA05/MA06 整体验收完成。

### MA07 LAN 归档写接口权限逐路由验收

扩展 `content-archive-api.test.ts` 的 LAN 安全场景，对创建、刷新、删除归档、取消任务、保存截帧、单条翻译、批量翻译、编辑译文和重置译文 9 个中性写接口逐一发送访客请求及管理员 Cookie + 非法 Origin 请求；9/9 访客请求均为 401，9/9 非法 Origin 请求均为 403。另验证正确 Origin 但缺少 CSRF Token 返回 403，而管理员会话、精确 Origin 和 CSRF Token 齐全时创建请求仍返回 202。媒体帧使用隔离生成的 PNG multipart，不访问在线平台或用户存档。

`pnpm --filter backend exec vitest run src/__tests__/content-archive-api.test.ts --reporter=dot` 10 项通过；`pnpm --filter backend typecheck` 与 `git diff --check` 通过。此处验证的是中性归档所有写接口，访客文件传输白名单不变；MA07 其他 SSRF、限流、配额和清理恢复专项仍需单独验收。

### MA07 归档获取路由速率限额验收

补充真实 Fastify 应用层的限流契约测试，不只验证限流插件本身：在单个隔离测试应用内，对中性归档创建路由连续提交 10 次请求均得到 202，第 11 次按 `REQUEST_QUOTAS.remoteFetch` 限额返回 429 和稳定 `RATE_LIMIT_EXCEEDED` 响应信封；限额触发后 `/health/live` 仍返回 200。测试使用临时 storage/SQLite 和模拟 Provider，不访问平台或真实用户数据。

```text
pnpm --filter backend exec vitest run src/__tests__/content-archive-api.test.ts --reporter=dot
pnpm check
git diff --check
```

定向 API 测试 11 项通过。该验收只证明归档获取路由的每分钟速率限额在实际 Fastify 装配中生效，不将其扩大解释为 LAN 上传、分片、批量下载、媒体预览及全部翻译/模型额度已逐路由验收；MA07 其余 SSRF、额度竞争与清理恢复专项仍待继续。
