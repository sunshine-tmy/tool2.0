# R07 各业务领域结构整理总验收

任务编号：R07-A–F；本次续作 E4、E5、F 及 R07 收口。
状态：DONE，R07-A–F 全部完成；2026-10-24 最终全量门禁及浏览器回归通过，不进入 R08。

后续独立修复 B05/B07/B10 已完成代码级回归，见 [B05](b05-verification.md)、[B07](b07-verification.md)、[B10](b10-verification.md)。本报告的测试数量和结果仍保留 R07 收口时点，不用后续结果覆盖历史验收。
本次再次复核 R07 无结构任务遗漏，见 [完成状态复核](r07-completion-recheck.md)。按用户最新要求，真实模型/GPU、macOS 及安装包级验收留到 R12 完成后，继续如实标记未执行。
2026-10-24，固定基线 55526abc4f67d04e99ba677b335c38b43b4584bb；真实索引保持为空。
本次开始即保留 R00–R07-E3 的全部未提交源码及未跟踪实现，不从 HEAD 回填旧文件，不提交、推送、发布或制作安装包。

## 本次完成及整个阶段归属

| 单元       | 当前归属 / 状态所有权                                                                                       | 验收记录                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A 图片压缩 | domains/image-compress：输入、文件、服务和路由；格式/质量/尺寸/ZIP 不变                                     | [A](r07a-image-compress-verification.md)                                                                                                             |
| B AI 图片  | domains/image-ai：投影、持久化、推理、商品图、历史查询/删除；manager 继续协调状态/租约/预留/锁              | [B7 收口](r07b7-image-ai-history-removal-verification.md)                                                                                            |
| C 配音     | domains/speech 的两个引擎与 shared；各引擎队列、任务及参考音色独立                                          | [C3 收口](r07c3-chatterbox-layout-verification.md)                                                                                                   |
| D 音频库   | domains/audio-library：只读素材来源端口、分组、回收站、预设、配额、清单、恢复与备份合并；store 继续串行提交 | [D7C 收口](r07d7c-audio-library-backup-merge-verification.md)                                                                                        |
| E 内容归档 | domains/content-archive：core、providers、compat/xhs 和领域装配；单一任务/存储/翻译核心                     | [E 依赖及完成清单](r07e-archive-assessment.md)、[E4](r07e4-archive-core-layout-verification.md)、[E5](r07e5-archive-compat-assembly-verification.md) |
| F LAN      | domains/lan-transfer 负责传输；system/lan-access 负责全业务共享地址；桌面网关保持原运行时所有者             | [F 核对](r07f-lan-assessment.md)、[F 验收](r07f-lan-layout-verification.md)                                                                          |

本次 E4 迁移 16 份核心，E5 先迁移 8 份适配/装配再独立提取旧路由注册，F 迁移 11 份 LAN 源码。
逐单元核对原摘要、目标不存在、AST 模块目标、Prettier 格式化后的完整预期源码及实际 SHA-256，不把其他工作区改动重写为 HEAD 版本。
E5 的混合职责事先说明并在机械迁移验收后才提取；原初始化、全部旧注册语句和关闭 Hook 原文保持，不新增 Fastify encapsulation。
没有将不同业务任务、仓储、上传器或状态机统一成通用框架。

## 保持不变的契约

- 六业务入口、273 项既有 API/健康方法路径、页面路由、旧小红书兼容入口、workspace 包名及公开命令不变。
- 数据库 Schema/kind、任务 ID、源归属和原文哈希、文件命名/清单/备份格式、Worker 协议不变。
- 图片成功/部分成功长期留档、无结果临时任务过期、独立商品图快照、lease、幂等提交、删除锁及先持久化后终态不变。
- 两种配音的队列/取消/批次和参考音色保留不变；音频库永久独立副本、回收站/恢复及串行提交/日志/SQLite 镜像职责不变。
- 两平台作品稳定身份、原文/翻译/媒体/截帧、刷新/Range、更新失败回滚及旧 API 平台过滤不变。
- LAN 访客、管理员/PIN/CSRF、乱序续传/去重、容量预留、延期/过期/清理、活动会话排除不变。
- 用户数据、storage/runtime/model/offline 位置和 resources/backend / frontend / scripts 分发名称不随源码改名。
- Worker 源码/锁/签名公钥/能力归档和摘要不改，不读私钥、不迁移用户数据库或清理用户数据。

## 新增或调整的测试

本次增加 30 项 API 测试：E4 10、E5 8、F 12，分别先在原实现通过再迁移；原测试/跳过不减少。
详见各单元，使用合成字节、内存数据库、隔离临时目录和受控替身，不将模型健康或磁盘文件存在性等同于真实推理可用。
E5 新测试的 purgeAll 替身类型错误仅修正为原 number 契约，不修改生产返回值或降低检查。

架构夹具新增 2 项：core 经 type/export/dynamic import 不能反向依赖 compat；已退出的十类旧目录不能重新被生产引用。
先加入夹具确定性得到预期失败，补最小路径规则后验证阻断有效；没有豁免测试失败。
旧音频库正向夹具的内部类型引用同步到当前 domains 位置，同样的允许行为仍验证；旧目录负向断言保留。
共 7 架构测试，含 90 组旧目录/入口/后缀/依赖形式组合；原 2 项精确跨应用债务和所有门槛不变。

## 复扫与剩余过渡层

受 Git 管理及非忽略未跟踪源码核对：已迁移的业务 modules 树及 LAN 两个旧入口不再有生产源码副本。
API 源码中旧业务 modules 路径引用为零；历史文档、前端尚待 R08 的 modules、分发/用户/能力内部路径不误删。
当前六领域 TypeScript 数：压缩 5、AI 图片 14、配音 33、音频库 13、归档 37、LAN 10；归档内 core 17、compat 6。
不删除可能仍含忽略文件的空旧目录，不用递归清理替代源码迁移。

对领域源码的具名函数/方法体做逐字 SHA-256 重复扫描（至少 250 字符，不含模糊和短谓词）：仅得到一组两个配音 update 方法。
它们分别调用不同 this.write：Edge 写 JSON 元数据、SQLite 和投影，Chatterbox 有自己的设备/恢复/文件元数据规则；清理也有不同活动任务边界。
依计划保留独立引擎仓储和协调状态，不为消除十行相似编排引入通用 Repository；不宣称全库完全无重复。
原公开 façade、旧 XHS 适配、历史 readCatalog/error 导出等有实际消费者的兼容入口保留；没有新增内部旧路径转发层。

## 执行的命令及结果

| 执行的命令 / 检查                                                                  | 本次最终实际结果                                                                                          |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| pnpm typecheck / lint / deadcode / lint:architecture                               | 全通过，384 生产/配置文件，原 2 项精确债务不变                                                            |
| pnpm test:contracts / test:architecture / test:diff-coverage                       | 4 / 7 / 16 通过；原签名/Worker/锁等受保护摘要不变                                                         |
| pnpm coverage                                                                      | runtime-core 21、shared 130、API 1320、Web 389 通过；API 111 文件通过、1 原跳过，原 6 项跳过不变          |
| API / Web 行、分支、函数                                                           | API 92.99% / 84.10% / 92.43%；Web 80.31% / 84.39% / 76.34%                                                |
| pnpm build                                                                         | 普通构建与全部隔离冒烟通过；源码/dist、冷热/异 cwd/无 Git ZIP、既有离线资源复用、原分发映射、商品渲染保持 |
| pnpm --filter desktop build / test                                                 | main/preload 编译、95 单元及 7 冒烟脚本单元通过，无 stage/rebuild/package/make                            |
| pnpm test:scripts / test:python:runner                                             | 脚本 82 通过、1 原跳过；runner 5 通过                                                                     |
| .venv-refactor-tests 的 pytest / Ruff / mypy                                       | pytest 8、Ruff 11、mypy 9 文件通过；未修改能力环境、默认收集规则或安装依赖                                |
| pnpm test:e2e                                                                      | 按 Playwright 技能运行原 5 项，全通过，17.1 秒；不改测试预期或截图容差                                    |
| check-diff-coverage.mjs --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree | 4467/4657，95.92%；使用原真实基线，不前移 HEAD                                                            |
| pnpm format:check / git diff --check / git diff --cached --quiet                   | 通过，真实索引为空，HEAD 保持 55526ab                                                                     |

根 coverage 包含与普通 Vitest 相同的原测试集合；桌面和工程脚本另行显式执行，不声称另跑了未执行的测试命令。
原全局 75%/65%、差异 90%、入口/懒加载 153600/76800 字节预算及排除集合不变。
最终 E2E 隔离根 C:\\Users\\tangmy\\AppData\\Local\\Temp\\toolbox-r07-final-e2e-e3204a03a226425ab688a1e8c1e68913 保留，临时环境变量已恢复。
E4/E5 先各自完成全量及浏览器验收；F 和 R07 最终复扫共用同一最终状态门禁，不把之前通过当作最终通过。

## 跳过、独立缺陷与后续

真实 Worker 环境依赖专项、模型/GPU 推理、在线平台抓取/配音、真实能力安装、macOS 实机及安装包级验收未执行。
轻量 Python、runner 和编译/布局夹具不能替代这些专项；无依赖下载、签名包重建或用户数据变更。
R07 收口时单独登记的 B05（桌面开发静态资源根）、B07（原 Chatterbox 失败断言清理）、B10（压缩缩放响应尺寸）后续已由用户授权分别修复，不混入 R07 结构迁移；详见本页开头的修复记录。
本次无新增独立业务缺陷。R07 收口后不进入 R08；剩余 R08 前端、R09 桌面、R10 工程脚本、R11 样式、R12 最终文档/全项目回归。
下一任务：R08，前置条件为用户继续指示及重新核对全部工作区修改；本轮不会自动执行。
