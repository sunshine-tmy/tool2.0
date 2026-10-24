# R07-E2 抖音平台实现目录归属

状态：DONE。起点为 E1 全量验收后的工作区；HEAD 55526ab、真实索引为空，保留全部已有修改。
整体职责依据见 [归档依赖核对](r07e-archive-assessment.md)。

## 本单元范围与契约

browser-network、douyin-browser、douyin-reader、douyin-runtime、douyin-source 五份平台实现，
以及独立的 douyin-probe CLI 从 modules/media-archive 迁入 domains/content-archive/providers/douyin。
probe:douyin 是既有 backend 命令，本轮仅更新其内部入口路径，命令名、参数、退出码、提示和 .package 输出边界保持。
CLI 仍是独立顶层执行模块，不被应用装配或业务服务导入，不创建额外任务队列；旧六个位置无过渡源码副本。
不合并 XHS/抖音运行时，不读取 Cookie 或登录 profile，不改变匿名上下文、浏览器版本、能力安装/复用及占用规则。
DNS 固定、TLS/SNI、每连接鉴权、配额、取消、监听清理、错误类身份及脱敏策略保持。
原文、媒体顺序、归档身份、数据库 kind、清单、模型/Worker/能力资产及数据保留/删除/恢复规则不变。

## 迁移前断言与回归

新增 douyin-provider-compatibility 的 8 项和 browser-network 的 2 项在原实现通过：
构造不查资产、预先取消保留原原因且不占用、实例级永久关闭与 Promise、状态快照隔离及底层信息脱敏、
Unicode 80 字符标题与完整原文/候选顺序/不修改源数据、重复规范化的独立元数据、
两种缺参情形从异 cwd 执行真实 CLI 入口、两网关临时凭据/存活隔离和网络计数快照。
首次两项 CLI 新测试因 it.each 展开数组的夹具写法失败，改为对象行后在原实现重新全部通过，未改生产逻辑或业务预期。

新 CLI 测试后来显式传入 API tsconfig，保持异 cwd，防止测试依赖已有 shared/dist；
单独使用只读 Node 解析 Hook 拒绝 shared/dist 时，仍抵达原缺参 guard，未启动真实浏览器或下载。
该细化仅影响新增测试的运行器参数，不改变 probe:douyin 的公开参数或实现。
迁移后归档/XHS/抖音/网络定向 26 文件、397 项通过、1 原跳过；细化后新增兼容测试 8 项再次通过。
既有 CLI 17、读取 30、运行时 37、解析 20、浏览器 5 与网络 22 项均保留执行；
原故障/配额/签名安装生命周期用例使用自己的临时夹具，未安装真实用户能力包。

## 等价证明

23 文件涉及 29 条模块引用以及 1 处 package.json 的 CLI 内部入口。
使用 TypeScript AST 定位静态/动态 import、类型引用及 Vitest mock 的模块字符串；
根据迁移前目标重新计算相对路径，不能漏掉 mock 后意外启动真实浏览器。
同一 Prettier 配置下，明确替换后的完整预期文件与实际逐字/SHA-256 一致；
新增 CLI 测试的 tsconfig 运行器细化另行核对，所有其他语句保持。
迁移前再次核对全部原文件摘要及六个目标不存在，未整体搬移目录或忽略文件。
新生产文件摘要为：

- browser-network.ts：5bbd15c5027e1196e8938e8fb37e7ab9dbd82bc973a0f157c9d45235ce54c139
- douyin-browser.ts：535802adc879e77730e6e7589476618bdb84f4eff046fed6370e3e2f09cf42ab
- douyin-probe.ts：def9ce552ba8ef0c7d9fbbb607eacebbd44e1c129affc9732a2375535c0d3d35
- douyin-reader.ts：f2e57bff62e80f5e626187c70d7e2cc573276cdaced923a3e6f833e557222e59
- douyin-runtime.ts：fa868a2bc593d946e3c54e4d5af0e45a6b57cb6360c8e759a405333d8810d1de
- douyin-source.ts：664d25d37f8d526de69cc04bfde014f0f9f1bfca49e0cdd5510f727d54c4b5b5

## 门禁与后续

| 命令 / 检查                                                  | 本单元实际结果                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| pnpm typecheck / lint / deadcode / lint:architecture         | 全部通过；383 个生产/配置文件，原两项精确跨应用债务不变                                                 |
| pnpm test:contracts / test:architecture / test:diff-coverage | 4 / 5 / 16 项通过                                                                                       |
| pnpm coverage                                                | core 21、shared 130、API 1272、Web 389 通过；API 107 文件通过、1 原跳过，原 6 项跳过不变                |
| API / Web 覆盖率                                             | API 行 92.81%、分支 83.90%、函数 91.67%；Web 行 80.31%、分支 84.39%、函数 76.34%                        |
| pnpm build                                                   | 普通构建及全部隔离冒烟通过，源码/dist、冷热/异 cwd/无 Git ZIP、资源复用、分发布局及编译态商品图渲染保持 |
| pnpm --filter desktop build / test                           | main/preload 编译、95 单元及 7 冒烟脚本单元通过，无 stage、原生 rebuild 或安装包制作                    |
| 工程脚本 / Python runner / 既有测试 Python                   | 脚本 82 通过、1 原跳过；runner 5、pytest 8；Ruff 11、mypy 9 文件通过                                    |
| pnpm test:e2e                                                | 按 Playwright 技能复用原 5 项，15.9 秒通过，无真实模型                                                  |
| 固定基线差异覆盖率                                           | --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree；4389/4579，95.85%                           |
| 格式 / git diff --check / 索引和 HEAD                        | 通过，真实索引为空，HEAD 保持 55526ab                                                                   |

E2E 根 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r07e2-final-e2e-b6fee442b8b5454fa6c09030974acb4e` 保留，结束后恢复临时环境变量，不删除旧证据。
相对 E1 新增 10 项 API 回归，没有原测试减少；全局 75%/65%、差异 90%、入口/懒加载 153600/76800 字节预算保持。
新测试运行器细化后重新执行类型和 Lint，通过；原两项精确跨应用债务、预算、门槛及排除范围保持。
没有新业务缺陷、架构例外或生产过渡层，没有重新安装依赖或修改 lockfile。
下一单元 E3 为共享翻译运行时；统一 core、兼容/装配、LAN 和 R08–R12 尚未完成。
B05/B07/B10 继续独立登记；真实模型/浏览器平台抓取、真实能力安装、macOS 实机和安装包级验收未执行。
无用户数据、签名包或保留/删除/恢复规则修改，无新依赖、提交、推送、发布、签名或桌面安装包制作。
