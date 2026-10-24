# R07-E3 共享翻译运行时目录归属

状态：DONE。2026-10-24，起点为 E2 全量验收后的工作区；HEAD 55526ab、真实索引为空，保留全部已有修改。
整体职责依据见 [归档依赖核对](r07e-archive-assessment.md)。

## 范围与保持不变的契约

仅将 modules/xhs-archive/translation-runtime.ts 迁入 domains/content-archive/core/translation-runtime.ts。
它已经服务于两平台，不创建新运行时、队列或服务实例；保留 XhsTranslationRuntime 与 XhsTranslationRuntimeError 名称及唯一身份。
应用装配、统一翻译、旧 XHS 适配和测试均直接引用新位置，不保留旧内部路径的平行源码或转发层。
不改安装 Promise、子进程所有权、健康探测、退出/停止、取消边界、进度、错误分类或错误提示。
模型 ID/revision、Python 要求、受管能力/包内资产名称、下载校验和现有恢复源逻辑保持原文。
脚本仍从 config.runtime.scriptsRoot 定位；配置、标记、虚拟环境和独立模型路径不跟随源码迁移。
不改变已归档原文、译文、媒体、截帧及其保留、删除、恢复规则，不迁移数据库或用户文件。

## 前置断言与测试边界

新增 archive-translation-runtime-layout.test.ts 的 18 项在原实现通过，覆盖：

- 全部五种 RuntimeError 的类身份、name/code/message 及领域 errorCode 分类；伪装为同名错误仍不被接纳。
- 中文/空格运行时和独立模型目录，固定模型元数据，构造不创建目录或联网。
- scriptsRoot 缺脚本在 spawn 前拒绝；构造器标记/文件存在性与真实模型校验保持分层。
- 外部端点直接复用与预先取消，受管能力缺失三种错误映射，不自动安装或启动。
- 固定包内资产名称、解析后的 Python/Worker/模型路径、signal 及 installing 80 → ready 100 原顺序。
- 已健康本机服务和原认证头的复用、状态快照隔离、目录查询失败保留旧状态。

全部使用既有隔离夹具、合成占位文件/资产元数据、网络和启动替身，不加载真实模型、不下载或安装能力。
文件存在性夹具仅断言原构造器行为，不能当作模型可推理或真实能力健康的验收。
首次全库类型检查发现新增测试修改 modelId 字面量不符合现有类型；改用可变 message 和进度断言快照隔离，
同时保留 modelId 固定值断言。未改 Schema、生产类型、门槛或原测试预期；修正后 18 项及完整类型检查重新通过。
迁移后定向 archive/xhs/douyin/browser-network 27 文件、415 项通过、1 原跳过，原翻译并发/退出/错误/媒体生命周期测试未减少。

## 等价核对与过渡层

11 个文件共 15 条模块引用，按 TypeScript AST 定位后根据旧目标重新计算相对路径。
同一 Prettier 配置格式化明确替换后的完整预期源码，与实际全文及 SHA-256 一致；
新增测试的类型校正另行显式核对，所有生产语句保持原文，不把已有缺陷混作重构修复。
迁移前核对原文件摘要及目标不存在，迁移后旧源码位置不存在，不搬动任何忽略目录。
translation-runtime.ts 的迁移后 SHA-256：ee59f0fa70494751652220687a63b5c092d66f3fe9c642230845577bcb27ed51。
没有新生产过渡层；其余统一 core 和旧 XHS 适配仍待后续独立单元迁移。

## 门禁与后续

| 命令 / 检查                                                  | 本单元实际结果                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| pnpm typecheck / lint / deadcode / lint:architecture         | 全部通过；383 个生产/配置文件，原两项精确跨应用债务不变                                                 |
| pnpm test:contracts / test:architecture / test:diff-coverage | 4 / 5 / 16 项通过，原 Worker/锁/签名元数据受保护摘要保持                                                |
| pnpm coverage                                                | core 21、shared 130、API 1290、Web 389 通过；API 108 文件通过、1 原跳过，原 6 项跳过不变                |
| API / Web 覆盖率                                             | API 行 92.96%、分支 83.95%、函数 92.27%；Web 行 80.31%、分支 84.39%、函数 76.34%                        |
| pnpm build                                                   | 普通构建及全部隔离冒烟通过，源码/dist、冷热/异 cwd/无 Git ZIP、资源复用、分发布局及编译态商品图渲染保持 |
| pnpm --filter desktop build / test                           | main/preload 编译、95 单元及 7 冒烟脚本单元通过，无 stage、原生 rebuild 或安装包制作                    |
| 工程脚本 / Python runner / 既有测试 Python                   | 脚本 82 通过、1 原跳过；runner 5、pytest 8；Ruff 11、mypy 9 文件通过                                    |
| pnpm test:e2e                                                | 按 Playwright 技能复用原 5 项，18.7 秒通过，无真实模型                                                  |
| 固定基线差异覆盖率                                           | --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree；4396/4586，95.86%                           |
| 格式 / git diff --check / 索引和 HEAD                        | 通过，真实索引为空，HEAD 保持 55526ab                                                                   |

E2E 根 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r07e3-final-e2e-2310363b8ce9490fa2d7497516a4d009` 保留，结束后恢复临时环境变量，不删除旧证据。
相对 E2 新增 18 项 API 回归，没有原测试减少；全局 75%/65%、差异 90%、入口/懒加载 153600/76800 字节预算保持。
无新业务缺陷或架构例外；原两项精确跨应用债务、预算、检查排除保持。
下一单元 E4 为统一归档 core 目录迁移，之后 E5 兼容/装配；LAN、R08–R12 和 B05/B07/B10 尚未完成。
真实 Worker/模型/GPU/在线平台抓取、真实能力安装、macOS 实机及安装包级验收未执行。
无新依赖、签名包/用户数据/数据规则修改，无提交、推送、发布、真实签名或安装包制作。
