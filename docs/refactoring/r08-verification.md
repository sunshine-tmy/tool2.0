# R08 前端目录与复杂状态整理

## 范围与基线

2026-10-24 开始；HEAD 固定为 `55526abc4f67d04e99ba677b335c38b43b4584bb`，索引为空。
开始时 `git status --short` 为 568 条，包含 R00–R07 和独立缺陷修复；全部保留，未提交、推送或发布。
前端迁移前 `pnpm --filter frontend coverage`：85 个文件、389 项通过；行 80.31%、分支 84.39%、函数 76.34%。

本阶段只整理前端源码与验证，不修改 API、数据格式、留档/删除规则、模型、Python 或签名能力包。
真实模型、macOS 和安装包级验收按用户要求留到 R12 完成后。不得以源码检查冒充这些专项通过。

## 原子任务顺序

1. R08-A：机械迁移 features、shell、shared、desktop integration 和 app；保留模板、CSS 和语句，仅重定位导入与测试源码路径。
2. R08-B：音频库列表、分组、详情、回收站、上传与备份；API 与展示/偏好拆开，播放器保留应用级单例。
3. R08-C：商品图编辑的文档、背景文件、布局、保存轮询和离开保护。
4. R08-D：桌面偏好/迁移、能力操作/离线导入、固定白名单清理。
5. R08-E：图片历史分页筛选、选择/批量删除、详情预览。
6. R08-F：Shell 导航/搜索、服务诊断状态、LAN 地址与公开功能集成边界。
7. R08-G：全量代码级门禁、普通构建、浏览器回归与交付复核。

每个单元先验证再继续；失败和未验收项分别记录，不扩大忽略项或降低门槛。

## R08-A

已生成 197 个导入/定位等效变更，其中 195 个文件迁移、2 个入口导入更新。
新目录包括两个独立配音引擎与 speech/shared、image-ai 的 processing/product-image/history。
历史 API/组件标识与路由不改名；全局 CSS 的内容和顺序不改，样式拆分留待 R11。
197 项预期文件与迁移后文件经 Prettier 规范化后逐字节相同（除导入路径与测试源码定位外不变），旧源码不存在。
初次全量测试发现一处懒加载源码正则仍使用旧目录，已将断言定位更新至 integration，仍断言动态导入且禁止静态导入。
迁移前后测试收集仍为 85 个文件、389 项；架构边界、公开契约已通过，继续复验后再拆状态。

## R08-B 音频库

拆出 collection（列表/筛选/选择/请求代次/搜索防抖）、items（详情/队列同步/回收站及串行清理协调）、groups（分组/移动/撤销计时器）、transfers（上传草稿/重试/重复另存/备份恢复）。页面只组合，既有组件与模板/CSS 不变。
API 不再持有 localStorage 或展示函数；原 key、单位/精度、分组路径规则保留在 preferences/presentation，无 API 过渡转导出。
`player.ts` 单例及 App 挂载位置未变；离开页面不清空队列。恢复备份仍刷新现有队列面板，不替换播放器。
定向 76 项通过（新增 8）；全前端 397 项、行 81.99%、分支 84.38%、函数 78.48%；类型、ESLint、架构、diff 检查通过。

## R08-C 商品图编辑

文档/保存任务/幂等 key/轮询/离开保护由 useProductImageEditor 统一所有；背景文件与 URL 创建释放归 useProductImageBackground；布局与画布检查归 useProductImageLayout，选项为纯数据。
复用 useRequestScope，仍在离开时中止读取；请求、600/1400ms 轮询、失败重试提示、确认与成功事件顺序不变。
背景切换与重置通过明确方法连接，不在兄弟 composable 间交叉修改状态。未修改 Canvas 精修、后端提交和独立快照。
定向 17 项通过（新增 3），包括迟到读取、URL 替换/重置/卸载和取消不发布成功；全前端 400 项、行 82.31%、分支 84.39%、函数 78.78%；类型、ESLint、架构、diff 检查通过。

## R08-D 桌面设置

拆出偏好/迁移、能力操作/离线导入/订阅、固定低风险清理三个所有者。保留页面 mounted 中设置→能力→清理的调用顺序，以及同一 bridge 和固定 HTTP 方法。
清理仍限定 low + logs/temp、不默认选中、连续两次确认；能力卸载依赖保护、旧 Python 提示、离线完整分卷大小校验和迁移选择 ID 均未改。
新增验证使用模拟 bridge、SSE、HTTP 和合成文件，不调用真实安装、清理或数据迁移。happy-dom AbortController 为普通 JS 对象，测试显式 markRaw 对齐浏览器原生 host object 的非响应式身份，不改变生产实现。
定向 19 项（新增 6）通过；全前端 406 项、行 84.22%、分支 84.16%、函数 80.72%；类型、ESLint、架构检查通过。

## R08-E 图片历史

分页/筛选/选择及删除协调保留在同一 useImageAiHistory；避免把选择与删除拆成互相修改的两个状态机。
useImageAiHistoryDetail 独立拥有预览、请求代次和卸载失效；删除后通过明确 closeRemoved 通知，不共享可变详情对象。
纯展示映射归 presentation。既有单项/批量确认、固定选中 ID 串行删除、活跃任务排除、失败保留可重试以及历史下载规则均不变。
原 15 项面板测试和新增 3 项详情代次/删除/卸载测试通过；全前端 409 项、行 84.34%、分支 84.25%、函数 80.78%；类型、ESLint、架构检查通过。

## R08-F Shell 与集成边界

useShellNavigation 统一拥有搜索、响应式菜单、快捷键、body class 与最近工具；useShellServices 统一拥有健康/管理员会话/诊断轮询。
能力提示归 desktop integration 的 useDesktopCapabilityHint；LAN 卡片原有独立状态与按需加载保留，不强行重复抽取其小型状态。
ToolLayout 保留 mounted 中诊断启动→导航监听→Web 健康→桌面能力提示的执行顺序。定时器和 DOM 监听器仍由各所有者配对释放。

跨功能保存音频通过 `audio-library/integrations/speech`；应用根与诊断播放保护通过 `audio-library/integrations/playback`。
这两个窄出口只转交原组件/单例，不创建第二个播放器，不导出另一 feature 的页面内部状态；没有新增通用事件总线。
原来两个引擎共用的文案解析器移至 speech/shared，函数体不变。KeepAlive 原结构不变，新增真实挂载计数/双草稿保留断言。
image-ai 的 URL/下载 DOM 动作归 media-links；能力就绪计算归纯 capability-readiness；API 客户端不再混放这些 UI 动作。

架构规则新增：跨 feature 生产导入必须使用显式 integrations 出口；speech/shared 禁止反向依赖引擎内部实现；旧前端源码树不允许重新引入。
类型导入同样受约束，测试只在已有测试边界内可读取内部实现；两条已有桌面 diagnostic-journal 债务不扩大，留待 R09。
新增 2 项架构测试和 5 项 Shell 状态测试；公开出口身份、路由/旧跳转与根播放器挂载位置新增 3 项应用契约断言。

## R08-G 总回归（完成）

57 个原 Vue 文件的完整 template/style 块再次逐字节比对一致，没有调整级联、选择器或容差。
最终前端普通构建与预算检查已通过：按既有 level 9 口径入口 gzip 151801 字节（上限 153600），最大业务懒加载 53719 字节（上限 76800）。未提高预算。
桌面主进程/preload 编译通过；首次桌面测试发现图标测试仍读取 layouts/ToolLayout.vue，已只更新到 shell 路径，保留全部品牌断言；重跑 95 单元与 7 冒烟脚本单元通过。
工程脚本 82 通过、1 原跳过；Python runner 5、轻量 pytest 8、Ruff 11 文件、mypy 9 文件通过，不运行模型依赖专项。
最终全库类型、Lint、Knip、格式、契约 4、架构 9（408 生产/配置源文件）、差异门禁自身 16、diff 检查通过；原两条桌面 journal 债务不变。

Playwright 按既有工程测试机制执行；新增只读路由/设置/旧 URL 流程与双引擎未提交草稿切换测试，不安装 CLI、下载模型或发送生成请求。
最终 `pnpm test:e2e`：原 5 项与新增 2 项均通过（7/7，27.1 秒）。
隔离根保留为 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r08-e2e-2be69bbd9cdb4e728d3a75ac55450012`；数据库、上传和删除仅发生在本次专用临时布局，未使用用户数据。
按 Playwright 技能检查本机 npx 后，复用项目原有测试配置和已安装浏览器；没有安装新 CLI 或修改截图容差。

### 最终命令与结果

| 命令/检查                                                                                         | 结果                                                                                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm coverage`                                                                                   | runtime-core 21、shared 130、API 1341、Web 418 通过；API 原 6 项跳过不变                    |
| Web 全文件覆盖率                                                                                  | 90 测试文件；行 85.16%、分支 84.57%、函数 81.44%；开始时 85 文件/389 项，没有减少旧测试收集 |
| API 全文件覆盖率                                                                                  | 行 92.99%、分支 84.11%、函数 92.43%                                                         |
| shared / runtime-core 行覆盖率                                                                    | 98.85% / 100%                                                                               |
| `pnpm typecheck`、`pnpm lint`、`pnpm deadcode`、`pnpm format:check`                               | 全部通过，无关闭检查、放宽排除或新增依赖                                                    |
| `pnpm test:contracts`、`pnpm test:architecture`、`pnpm lint:architecture`                         | 4、9、408 文件检查通过                                                                      |
| `pnpm test:diff-coverage`                                                                         | 16 项通过，缺失报告仍失败                                                                   |
| `node scripts/check-diff-coverage.mjs --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree` | 6984/7343，95.11%，原 90% 门槛不变，未移动基线或暂存代码                                    |
| `pnpm --filter desktop build`、`pnpm --filter desktop test`                                       | 主进程/preload 编译、95 单元、7 冒烟脚本单元通过；未 stage/rebuild-native/make/package      |
| `pnpm test:scripts`、`pnpm test:python:runner`                                                    | 82 通过/1 原跳过；5 通过                                                                    |
| `.venv-refactor-tests/Scripts/python.exe -m pytest`、Ruff format/check、mypy                      | 8 项；11 文件；9 文件通过，不安装或修改能力环境                                             |
| `pnpm build`                                                                                      | 普通构建、预算及全部既有契约/渲染/路径/桌面开发布局冒烟通过                                 |
| `pnpm test:e2e`                                                                                   | 7 项通过；原有生成场景使用受 Schema 校验的替身，不触发真实模型                              |
| `git diff --check`、索引/HEAD 核验                                                                | 通过；索引仍为空、HEAD 仍为固定基线，未提交或推送                                           |

根构建的布局冒烟还核验：源码/dist、不同 cwd、无 Git ZIP、冷/再次启动、已有离线资源保留及 `resources/backend` / `resources/frontend` 映射。未用新数据根覆盖旧用户路径。

### 等效性复核

对五处原大型组件的 105 个具名函数体做 TypeScript AST 打印加统一格式化比对，102 个相同。
其余 3 个是明确委托连接：备份恢复用注入的 refreshQueue 替代页面 ref 读取；商品图加载把释放/重置背景委托给背景所有者；历史删除把预览失效与 deleted 事件委托给两个显式回调。
对应委托顺序和参数均有定向断言；没有改写删除、队列、保留或持久化算法。57 个原 Vue 模板与样式块保持相同。
旧 modules/pages/layouts/components/services/composables/utils/config 目录没有遗留文件；没有保留第二套源码或内部旧 import façade。
删除的仅为本次自建 9 个临时迁移/比对文件，证据结论已记录；没有清理用户缓存、模型、离线包、数据或既有测试证据根。

### 统一交付

- 任务编号：R08-A–G，全部完成；下一阶段为 R09，不在本次范围内自动启动。
- 本次完成/改动范围：前端目录、五组复杂状态、API/UI 职责、显式集成边界、架构规则和测试/当前文档；桌面只调整一个前端源码读取测试路径。
- 保持不变的契约：六入口全部路由/工具 ID/API、旧小红书重定向、KeepAlive、播放器单例、存储/保留/删除、能力包与 Worker、构建/启动命令、桌面分发资源名。
- 新增或调整的测试：29 项前端、2 项架构、2 项 E2E；旧测试仅随路径与职责迁移调整 Mock/读取定位，不删断言。
- 发现的独立缺陷：本次没有登记新的独立业务缺陷。迁移遗漏的懒加载源码正则/桌面图标测试定位，以及新测试的浏览器对象/缓存夹具假设，均已按原行为修正并重跑。
- 剩余过渡层：无内部旧源码兼容树；两个 audio-library integration 出口为长期明确接口，不是待删除的重复实现。两条桌面跨应用 journal 债务仍归 R09。
- 跳过与尚未验证：API 6、工程脚本 1 个原跳过；真实模型/已有 GPU、依赖能力环境的 Python Worker、macOS 实机、安装包级验收均未执行，不宣称通过。
- 下一任务及前置条件：R09 桌面编排/IPC，开始前重新核验工作区并保留本轮及已有修改；继续保持 sender 校验、逐方法桥接、退出/迁移/播放保护。R10–R12 尚未完成；专项验收按用户要求统一留到 R12 完成后。
