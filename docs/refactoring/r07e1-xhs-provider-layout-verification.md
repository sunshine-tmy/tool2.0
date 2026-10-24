# R07-E1 小红书平台实现目录归属

状态：DONE。起点为 D7C 全量验收后的工作区；HEAD 55526ab、真实索引为空，保留已有修改。
整体职责依据见 [归档依赖核对](r07e-archive-assessment.md)。

## 本单元范围与契约

仅将 auth、provider-item、runtime、runtime-process、runtime-install-gateway 五份 Node 实现从 modules/xhs-archive
迁入 domains/content-archive/providers/xiaohongshu；旧位置不保留平行实现或过渡 re-export。
仍由同一管理器持有登录、安装 Promise 和子进程状态，不改变浏览器、Cookie、安装/复用、健康探测及进程结束策略。
Python Worker 路径仍由 config.runtime.scriptsRoot 决定，数据、profile、源码及虚拟环境仍由原配置决定。
不移动翻译运行时、任务、存储或路由实现，不改变 API、错误类、错误码和数据规则。

## 前置断言与等价核对

新增 xhs-provider-compatibility.test.ts 的 14 项在迁移前原实现通过，迁移后保留全部断言：
中文/空格运行时根、固定源码及解释器路径、当前/旧 Cookie 优先级和损坏 JSON 原行为、凭据过滤/顺序/不回写、
外部端点不安装或启动、预先取消、两种 HTTP 健康结果及认证头、健康网络异常、缺脚本不启动 Python、
状态快照隔离、已有完整运行时识别、停止委托及统一错误类身份。
仅使用既有隔离夹具和合成文件，fetch 替身控制网络，不启动浏览器或 Python，不读取真实凭据。

五个生产文件及八个消费者共 13 文件、33 条模块引用，通过 TypeScript AST 定位模块字符串，
按迁移前实际目标重新计算引用，所有其他文本保留。相同 Prettier 配置格式化明确替换后的预期全文，
与每份迁移后全文逐字一致；五个旧源码位置均不存在，没有整目录移动任何忽略文件。
消费者包括应用装配、平台读取网关、旧任务/路由适配及四份测试，未修改前端、工程命令或分发资源名称。
迁移后归档/XHS/抖音定向 24 文件、367 项通过，1 原跳过，未减少原测试。

## 门禁与后续

| 命令 / 检查                                                  | 本单元实际结果                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| pnpm typecheck / lint / deadcode / lint:architecture         | 全部通过；383 个生产/配置文件，原两项精确跨应用债务不变                                         |
| pnpm test:contracts / test:architecture / test:diff-coverage | 4 / 5 / 16 项通过                                                                               |
| pnpm coverage                                                | core 21、shared 130、API 1262、Web 389 通过；API 106 文件通过、1 原跳过，原 6 项跳过不变        |
| API / Web 覆盖率                                             | API 行 92.81%、分支 83.93%、函数 91.67%；Web 行 80.31%、分支 84.39%、函数 76.34%                |
| pnpm build                                                   | 普通构建和全部隔离冒烟通过；源码/dist、冷热启动、异 cwd、无 Git ZIP、离线复用与分发资源布局保持 |
| pnpm --filter desktop build / test                           | main/preload 编译、95 单元及 7 冒烟脚本单元通过；没有 stage、原生 rebuild 或安装包制作          |
| 工程脚本 / Python runner / 既有测试 Python                   | 脚本 82 通过、1 原跳过；runner 5、pytest 8；Ruff 11 及 mypy 9 文件通过                          |
| pnpm test:e2e                                                | 按 Playwright 技能复用原 5 项通过，20.2 秒，无真实模型                                          |
| 固定基线差异覆盖率                                           | --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree；4384/4574，95.85%                   |
| 格式 / git diff --check / 索引和 HEAD                        | 全部通过，真实索引为空，HEAD 保持 55526ab                                                       |

E2E 根 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r07e1-final-e2e-351c3e6f32554103981433e0925b2d08` 保留，结束后恢复临时环境变量，没有删除旧证据。
本单元 API 比 D7C 增加 14 项，无原测试减少；原全局 75%/65%、差异 90% 和入口/懒加载 153600/76800 字节预算不变。
无新增业务缺陷或架构例外，不修改门槛、体积预算、检查排除或原测试预期。
没有新增生产过渡层；旧目录仅保留尚未迁移的翻译与兼容/装配实现，不包含这五份 provider 的副本。
下一单元 E2 为抖音 provider，尚余共享翻译运行时、统一核心、兼容/装配、LAN 和 R08–R12。
真实 Worker/模型/GPU/在线配音、真实能力安装、macOS 与安装包级验收未执行。
无新依赖、用户数据、签名包及保留/删除/恢复规则修改，无提交、推送、发布或安装包制作。
