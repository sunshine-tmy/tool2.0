# R02-A 公共运行时路径包验收

日期：2026-10-22；固定差异基线仍为 `55526abc4f67d04e99ba677b335c38b43b4584bb`。

本文件保留 R02-A 完成时的验收状态；后续独立 B04 修复见 [B04 验收记录](b04-verification.md)，不回写历史测试期望冒充当时已修复。

## 任务编号与本次完成

R02-A：`DONE`。提取 Node 专用 `@toolbox/runtime-core`，不搬迁业务目录、不改变路径语义。
开始时重新核验并保留 R00/R01 全部未提交修改；这里仅报告本阶段增量，不代表整个重构完成。

## 改动范围

- 新包拥有 `RuntimeLayout`、`createRuntimeLayout`、`resolveRuntimePath`，提供源码测试、声明与 ESM 构建、覆盖率配置。
- 后端原路径模块保留应用根目录推导及现有导出 façade，函数实现复用公共包；未改 `getConfig`。
- 桌面布局及后端监督器改用公共包；跨应用精确依赖登记从 7 条减至 5 条。
- 应用构建显式内联新包，避免分发时新增源码树运行依赖；preload 权限不变。
- `build:shared` 同时准备既有 shared 与 runtime-core，原公开命令和启动脚本调用方式不变。
- TypeScript/Vitest、架构边界和 CI LCOV 接入新包；禁止 shared/web 运行时加载该 Node 包，禁止该包反向引用应用。
- 构建冒烟新增 dist-only 隔离消费者：没有源码、`.git`、`.env` 或 workspace 链接，在中文空格工作目录验证导出与显式路径，确认不创建数据目录。
- 锁文件仅新增 12 行 workspace/importer 配置，`packages` 和 `snapshots` 内容逐字节与基线一致。安装器最初重算的无关可选依赖已撤回，未接受该变更。

没有移动或删除被忽略的 `.env`、storage、模型、能力包、离线资源或缓存，没有扩大清理白名单。

## 保持不变的契约

布局字段、相对路径展开、默认子目录名称、应用侧根目录锚点均保留。
配置仍按环境变量、选定 `.env`、默认值的优先级处理；`dotenvPath:false`、缺失文件、显式路径及 `:memory:` 语义保持不变。
桌面 Windows/macOS 数据根策略，以及 `resources/backend`、`resources/frontend`、`resources/scripts` 名称不变。
不改变 API、页面、原 workspace 包名、签名元数据、Worker/锁文件或数据保留、删除、恢复规则。

## 新增或调整的测试

- 后端布局测试从 3 项增至 7 项；先在原实现通过，再提取，之后复验通过。
- 新包 3 项覆盖默认值、独立覆盖、输入不变性及相对/绝对/空路径，行/分支/函数覆盖率均 100%。
- 桌面布局从 4 项增至 6 项，覆盖开发锚点、中文空格路径及分发/数据隔离。新增测试曾因期望未规范化末尾分隔符失败，已按原有 normalize 语义修正期望，不改生产行为。
- dist 消费冒烟额外冻结 B04 的既存编译态默认值及显式布局覆盖，不用正确的新期望掩盖旧缺陷。
- 架构反例补充新公共包的依赖方向限制。

## 执行的命令及结果

| 命令/检查                                                                       | 结果                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 原实现的后端布局测试                                                            | 7 项通过，先固定行为                                                     |
| 提取后布局与 API 保护定向测试                                                   | 9 项通过；273 条方法/路径不变                                            |
| `pnpm coverage`                                                                 | runtime-core 3、shared 91、backend 724（6 跳过）、frontend 377，全部通过 |
| `pnpm --filter @toolbox/runtime-core coverage`                                  | 3 项通过，行/分支/函数均 100%                                            |
| `pnpm coverage:diff --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree` | 22/22 可执行变更行覆盖，100%，门槛仍为 90%                               |
| `pnpm --filter desktop test`                                                    | 71 项单测、7 项冒烟脚本单测通过                                          |
| `pnpm test:scripts`                                                             | 71 通过、1 项既有条件跳过                                                |
| `pnpm test:contracts`                                                           | 2 项通过，受保护字节不变                                                 |
| `pnpm lint:architecture` / `pnpm test:architecture`                             | 306 个生产/配置文件及 4 项边界测试通过                                   |
| `pnpm test:python:runner`                                                       | 5 项通过                                                                 |
| `pnpm test:python` / `pnpm lint:python`（独立 venv）                            | pytest 8 项通过，Ruff 通过，mypy 9 个文件通过                            |
| `pnpm typecheck` / `pnpm lint` / `pnpm deadcode`                                | 通过                                                                     |
| `pnpm format:check`                                                             | 通过                                                                     |
| `pnpm test:e2e`                                                                 | Playwright 既有 5 项通过（36.5 秒），未安装浏览器或增加测试场景          |
| `pnpm build`                                                                    | 共享/公共包、API、Web、预算、独立 dist 和合成商品图冒烟通过              |
| `pnpm --filter desktop build`                                                   | 主进程与 preload 编译通过，不是安装包制作                                |
| API/桌面构建产物扫描                                                            | 没有 runtime-core 外部运行时导入                                         |
| `pnpm install --offline --frozen-lockfile --ignore-scripts`                     | 通过，未升级依赖                                                         |
| `git diff --check`                                                              | 通过                                                                     |

前端行/分支/函数仍为 79.59% / 84.05% / 75.48%；原门槛及包体预算未降低。

## 跳过与尚未验证的项目

未执行真实模型生成、能力包重建、安装包制作、发布或真实新电脑安装。
未搬迁前后端，R02-B/C 的整工程 ZIP 冷/热启动、离线复用与目录迁移验收仍待执行；新包无 `.git` 消费不能冒充整工程 ZIP 验收。
本阶段未重跑原依赖下 27 项 Worker 契约，R01 实际通过记录保留；本阶段不改 Worker。
Windows 本机与 macOS 路径分支测试不能代替 macOS 实机验收。

## 发现的独立缺陷

B04：原编译态默认根目录比源码态高一级。证据与兼容建议见 `baseline-issues.md`。
本阶段保持既有语义，没有顺手改变配置或默认数据位置。

## 剩余过渡层

后端路径模块仍负责应用锚点与兼容导出，不存在第二份路径函数实现；公共包不推导仓库根、不读配置、不创建目录。
剩余 5 条跨应用依赖由 R02-C/R03/R09 处理，不扩大本阶段范围。
既有清理命令未增加新包 dist 路径，清理工具职责留待 R10，不因新产物扩大删除范围。

## 下一任务及前置条件

R02-A 完成。R02-B 前先独立处理 B04：只读确认实际默认配置/数据位置，明确兼容策略后再决定根目录修复。
不得直接更改 URL 深度后让历史数据不可见，不自动搬迁、删除或转换业务数据；B04 修复不得混入后端目录搬迁。
本轮未提交、推送、发布或制作桌面安装包，已有未提交修改全部保留。
