# R09 桌面编排与 IPC

## 边界、基线与任务顺序

2026-10-24 开始；HEAD 仍为 `55526abc4f67d04e99ba677b335c38b43b4584bb`，索引为空，`git status --short` 为 569 条（不是文件总数）。保留 R00–R08 和缺陷修复的全部已有修改。
本次基线：桌面 95 单元、7 冒烟脚本单元及类型检查通过。禁止 stage、rebuild-native、package、make、签名、提交、推送或发布。

原子任务：A 共享安全日志消除最后跨应用债务；B 桌面职责目录机械迁移；C 按固定能力拆 IPC；D 窗口/数据路径/维护与退出编排；E 应用启动与生命周期装配；F 全量代码级回归。
每个单元先测试与检查再继续；不重写后端监督、退出协调器、数据迁移算法或更新状态机。

明确保留 `src/runtime-layout.ts` 作为实际路径入口：`scripts/smoke-desktop-development.mjs` 直接用 Node 导入其 TypeScript 文件，它同时需要在源码与 bundled dist 的 `import.meta.url` 环境正确定位。移入子目录会改变源码锚点，并导致新相对模块依赖不适用于原生 Node TS 消费。
该文件不变成旧路径转发 façade、不新增第二份布局实现；main/preload 同样保留根级公开编译入口。其他实现按真实职责迁入 app、ipc、windows、backend、data、updates、security。

主窗口的 sender/webContents、mainFrame 和当前 backendOrigin 检查保持；首次迁移窗口与诊断窗口保留各自原有信任规则，不机械改成一个通用宽松判断。
应用级状态只创建一次，不随窗口或启动重试重建；IPC 注册 guard、退出协调器、迁移互斥、播放保护和受控进程归属均保留。

真实模型/已有 GPU、macOS 实机及安装包级验收仍留到 R12 完成后，不把本轮源码和模拟测试视为实机验收。

## R09-A（完成）

将 API 与桌面实际共用的 DiagnosticJournal 原实现移入 Node 专用 runtime-core；它只声明类，import 不读配置、不创建目录、不加载 Electron，也不持有应用状态。
构造时的 bootId 继承、日志白名单、5 MiB 轮转、500 条内存上限、不可写时保留摘要、仅消费固定错误码均不变。
更新四处运行时/测试消费者，删除两条精确跨应用架构豁免，不保留 API 内部旧文件转发。

runtime-core 26 项（新增日志 5）与全部覆盖率 100% 通过；桌面 95/7、相关 API 21 项通过。全库类型、Lint、Knip、架构 10/408 文件、契约 4、diff 检查通过。
独立 dist 消费夹具已补 journal 构造不创建目录断言，随最终普通构建验证。

## R09-B（完成）

28 个实现/测试文件归入职责目录，main 导入同步更新；29 项文件经过 Prettier 规范化后与仅改 import 的预期逐字节一致，旧文件不存在。
根级 main/preload/runtime-layout（真实路径入口）、安装器/产物配置测试保留；不移动 storage、缓存或忽略数据。窗口 HTML、进程保护 PowerShell、迁移算法、更新器均未改内容。
迁移后桌面原 95 项/7 冒烟脚本单元、类型、Lint、架构和主进程/preload 编译通过。

## R09-C（完成）

将固定桌面 IPC 按设置、播放、诊断报告、数据迁移提取；注册点仍显式列出原 9 个频道且顺序不变。每个方法独立保留授权/参数校验；目录选择 ID 私有、一次性、10 分钟过期，不接受 renderer 提供任意目录。
主窗口 guard 继续同时检查窗口、webContents、mainFrame 和当前后端 origin；启动诊断 IPC 已独立，进度与日志仍由原 StartupDiagnostics 实例持有。
新增 7 项 IPC 回归，当前桌面 102/7、类型、Lint、架构通过；首次迁移流程与其 IPC 接着单独迁移。

首次迁移的 4 个固定 IPC 也已归 ipc；仍保留其原窗口身份校验，不静默扩展/削弱为另一类窗口策略。注册 once guard 由同一应用级首次迁移流程拥有。
preload 未修改，原 20 个固定调用加事件订阅的完整契约测试继续运行；没有新增通用 invoke、路径、URL 或进程接口。

## R09-D（完成）

首次迁移流程只管理原窗口/状态/完成 promise 和注册 guard；HTML 单独移入 windows，模板内容不改。原数据复制、校验、切换/恢复算法留在 data，不重写。
新增 5 项：单次注册、隔离 session、迁移并发/关闭保护、空数据选择与取消、错误恢复/窗口加载失败；桌面 107/7 通过。

业务窗口与路径初始化分别拥有固定 Electron 设置、导航/权限策略及可写检查。窗口先发布给应用状态，再关闭首次迁移窗口，再 loadURL；ready/close 仍读取同一应用级状态。
新增 6 项检查原路径映射、重叠拒绝、macOS/开发分支以及导航/关闭策略；桌面 113/7、类型、Lint 通过。
图标来源测试随实际窗口创建点定位至两个实现文件，仍严格断言两处使用原图标；安装器身份、配置、路径未改。

维护/更新以显式最小后端 port 组合，但后端监督与进程保护类的状态/算法不变。迁移仍 inspect(false)→clean stop→operation→restart→monitor→reload，操作失败仍先重启再抛原错误，重启错误优先；更新保留播放/维护保护，clean stop 后才 quitAndInstall。
退出流程仍懒创建一个 QuitCoordinator 和 ShutdownWindow；确认后先停止 renderer 播放、清理计时器，再回收拥有的后端，确认后才 exit；失败保持 committed 状态供重试。
新增维护 6 项、退出装配 4 项；桌面 123/7、类型、Lint、架构与 diff 检查通过。没有按进程名或端口结束进程。

## R09-E（完成）

main 仅保留原根路径/图标/preload 锚点与单次应用创建；application 工厂私有持有原全部应用级状态，main 只创建一次，不在窗口或 boot 重试时重建。
launch 保留 Model ID、单实例锁、second-instance/boot/window-all-closed/before-quit 原顺序；应用启动保留路径初始化在 whenReady 之前，以及恢复→代理→受控后端→窗口→ready→更新顺序。
菜单独立但 Windows 无菜单、macOS 原 app/edit/window roles 不变；仅单测模拟 macOS 分支，不宣称实机通过。
新增启动装配 7、launch 2、菜单 2、后端失败/迟到 guard 回归 2；桌面当前 136/7 通过。明确验证 retry 复用同一 diagnostics/IPC，替换已失败且终止的后端；未知终止状态不允许报告可重试。

## R09-F（完成）

最终复核包含全库覆盖率/静态门禁、普通根构建及独立 dist/资源布局、桌面编译、脚本与现有浏览器回归。架构新增旧平铺实现回流和 preload 越界拦截；不增加豁免、不降低门槛。

### 等效性与当前落点复核

- 14 个迁移后的生产实现文件（除主入口与已提取诊断控制器）与 import-only 预期逐字节一致，包括两个数据迁移算法、后端监督、退出协调器、Job Object、更新器与窗口 URL 规则。
- 新 runtime-core DiagnosticJournal 与固定基线 `backend/src/runtime/diagnostic-journal.ts` 经统一格式化后完全一致，未改变日志内容或轮转/脱敏规则。
- 主入口原 17 个具名函数：9 个函数体的 AST/统一格式结果保持相同（目录初始化、迁移完成、HTML、更新调度、迁移选项、设置验证、错误消息、写入探测、路径重叠）；8 个为明确的上下文/职责委托（可写条件、boot、两类注册、首次窗口、维护、安装更新、业务窗口），其顺序、参数和失败分支由新增测试保护。
- 首次迁移 HTML 模板原始内容相同；未调整 CSP、窗口文案或 CSS。preload 文件未改，全部原逐方法映射与订阅释放断言继续通过。
- main 根级仅保留 main/preload/runtime-layout 实际入口和原根级配置/产物测试；不存在第二套平铺实现或内部旧路径转发。R09 的实际结构见 [桌面职责说明](r09-desktop-ownership.md)。
- ADR-003 只同步实现位置并区分历史验收时点；数据协议与卸载/保留规则未改，不执行历史记录提到的 NSIS 操作。

### 最终命令与结果

| 命令/检查                                                                                         | 结果                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm --filter desktop build`                                                                     | 主进程/preload 编译通过，输出仍为 dist/main.js、dist/preload.cjs；未 stage/rebuild-native/package/make |
| `pnpm --filter desktop test`                                                                      | 26 测试文件、136 单元通过；原 17 文件/95 项完整保留，新增 41；冒烟脚本单元 7 通过，不是实际安装验收    |
| `pnpm coverage`                                                                                   | runtime-core 26、shared 130、API 1341、Web 418 通过；API 原 6 项跳过不变                               |
| runtime-core / shared 行覆盖率                                                                    | 100% / 98.85%；新增日志已单独覆盖全部语句/分支/函数                                                    |
| API 行/分支/函数覆盖率                                                                            | 92.99% / 84.15% / 92.41%；共享日志移到 runtime-core 后仍在独立包完整统计                               |
| Web 行/分支/函数覆盖率                                                                            | 85.16% / 84.57% / 81.44%；90 文件/418 项，本次没有更改 Web 代码                                        |
| `pnpm typecheck`、`pnpm lint`、`pnpm deadcode`、`pnpm format:check`                               | 全库通过，无 any、关闭规则、扩排除或依赖升级                                                           |
| `pnpm test:architecture`、`pnpm lint:architecture`、`pnpm test:contracts`                         | 11、427 文件、4 项通过；两条跨应用债务已删除，没有新豁免                                               |
| `pnpm test:scripts`、`pnpm test:diff-coverage`                                                    | 82 通过/1 原跳过；16 通过                                                                              |
| `pnpm test:python:runner`                                                                         | 5 通过，不安装能力/模型依赖                                                                            |
| `.venv-refactor-tests/Scripts/python.exe -m pytest`、Ruff format/check、mypy                      | 8 项、11 文件、9 文件通过，只使用既有独立测试环境                                                      |
| `node scripts/check-diff-coverage.mjs --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree` | 6986/7345，95.11%；原 90% 门槛及真实基线不变                                                           |
| `pnpm build`                                                                                      | 普通构建、独立 dist 契约、运行时包无副作用、资源/根路径、合成商品图及桌面开发布局冒烟全部通过          |
| 分包预算                                                                                          | 入口 gzip 151801 / 153600 字节，最大业务懒加载 53719 / 76800；原 level 9 口径，无提高预算              |
| `pnpm test:e2e`                                                                                   | 现有 7 项通过，31.3 秒；在线生成场景仍使用固定替身，不是模型/外部服务验收                              |
| `git diff --check`、索引/HEAD                                                                     | 通过；索引仍为空，HEAD 仍为 55526ab，未提交、推送或发布                                                |

普通根构建复验实际 source/dist、不同 cwd、无 Git ZIP、冷/再次启动、已有离线资源复用，以及 resources/backend / resources/frontend 布局；没有因源码迁移改用户数据位置。
浏览器按 Playwright 技能先检查 npx，复用现有测试/浏览器，不安装 CLI 或改变截图容差。隔离根保留为 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r09-e2e-e2261edcf0a94342ab68ae4eb9647b09`，测试中的数据库、上传/删除和归档仅使用本次专用临时布局。
已移除本次自建 9 个迁移/比对临时文件；没有清理任何既有离线包、缓存、模型、用户数据或历史测试证据目录。

### 统一交付

- 任务编号：R09-A–F，全部代码级工作完成；不自动进入 R10。
- 本次完成：桌面目录、固定能力 IPC、窗口/路径/首次迁移、维护/更新/退出编排、单次应用装配；共享日志移入 runtime-core，最后两条跨应用依赖归零。
- 改动范围：桌面源码/测试、runtime-core 及 API 的日志消费者、架构/构建验证脚本与当前定位文档；不改业务队列、数据库、Worker 或能力包。
- 保持不变的契约：原 API/页面/命令、安装器身份、Windows/macOS 路径策略、分发资源名、固定 preload 方法、各类 sender 校验、进程归属、持久化/保留/删除/恢复及更新/退出语义。
- 新增/调整测试：41 桌面单元、5 runtime-core 日志、2 架构回归；原测试仅随职责迁移更新 import/Mock/源码读取定位，没有减少收集或删除断言。
- 发现的独立缺陷：未登记新的独立业务缺陷。迁移中的类型/源码定位及新测试 Mock 泛型问题均按原行为修正、重跑，不借此改变业务或放宽校验。
- 剩余过渡层：无旧平铺实现 façade；保留 root runtime-layout 是原生 Node/source/dist 的真实路径实现，不是过渡副本。主应用与各职责采用明确的小型上下文，不是通用 DI/事件总线。
- 跳过与尚未验证：API 6、脚本 1 个原跳过；真实模型/已有 GPU、依赖能力环境的 Python Worker、macOS 实机、安装器/真实 Electron 运行验收均未执行，不宣称通过。
- 下一任务及前置条件：R10 工程脚本/启动停止/CI，开始前重新核验工作区并保留所有已有修改；不移动运行时 Python/锁文件/已发布包内部路径，显式核对需要进入分发产物的脚本依赖。R11/R12 和统一专项验收仍待完成。
