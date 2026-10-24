# R05：后端装配、配置与数据库职责拆分

日期：2026-10-23。状态：DONE，仅 R05 完成。固定基线仍为 55526abc4f67d04e99ba677b335c38b43b4584bb；接续 R04 已验收工作区，保留已有未提交文件，真实索引为空。没有进入 R06。

## 原子任务与顺序

1. A：诊断错误构造移到无副作用独立文件，深检不再运行时回引服务主体。
2. B：应用创建、服务创建、写请求保护、基础插件、响应策略、存储准备/一致性、系统路由、业务装配和退出 Hook 拆分。全部使用普通函数调用，不增加 Fastify register 封装层级；注册/关闭顺序不变。
3. C：配置按部署、存储、LAN、归档、图片和配音分组。既有 AppConfig 与 getConfig 入口不变，保持字段求值顺序、env/空值优先级、默认数据路径和报错顺序。
4. D：数据库内部拆出既有迁移、行映射、文件元数据和审计，ToolboxDatabase façade 保留连接、事务和公开方法。SQL、Schema 版本、启动恢复条件、事务嵌套均不得改变。
5. E：阶段全量门禁、普通构建、桌面编译/单测与隔离浏览器回归；报告未验证事项。本轮不进入 R06。

每个单元先执行兼容断言，再做机械提取与定向测试；阶段收口统一执行全量门禁。发现业务差异则暂停该单元，不能通过改测试或改数据规则接受变化。B05、B07 独立待办，不混入本阶段。

## 保护清单

保留 createApp/startBackend、依赖注入参数、273 条路由、插件根作用域、认证/配额/维护保护范围、SSE preClose、数据库最后关闭以及构造失败关闭逻辑。保留全部配置名称、路径、Schema、用户数据与恢复/删除规则，不新增模型/Python 依赖或修改签名包。不读取私钥，不提交、推送、发布、stage/native rebuild 或制作桌面安装包。

验证结果随各单元补充，不以历史 R04 结果冒充本阶段运行结果。

## 已完成单元

A：诊断错误构造已原样归属 errors.ts；服务与深检分别直接导入，深检只保留服务 type import，不再运行时回引。新增 4 项兼容测试在移动前后通过，与原诊断测试共 20 项通过；类型、Lint、架构及 diff 检查通过。

B：原 app.ts 拆为 10 个实际职责文件，入口保留 createApp 与失败 close/rethrow。逐块机械提取，23 个原 Fastify Hook/插件/系统路由注册的 AST 顺序及首参数相同，没有把 helper 注册成 Fastify 子插件。拆分前新增 4 项断言通过；拆分后相关 48 项测试通过，再补活跃 SSE 关闭用例，5 项装配测试全通过。后者验证 preClose 结束流、注销订阅后才关闭 Worker 和数据库。类型、Lint、Knip、340 个源码架构、冻结契约及 diff 检查通过。全量 coverage/构建在阶段收口运行。

C：配置 façade 仍返回原 AppConfig；分组只返回原连续字段片段，再按原顺序合成。77 个字段表达式及顺序经 AST 对比不变；隔离 VM 对比 167 组合成配置，完整 JSON 输出、属性顺序及首个错误文案均相同。VM 的 dotenv 为固定合成字符串，不读取用户 .env 或存储。新增 8 项测试在提取前通过，提取后与既有配置、路径、启动和装配测试共 22 项通过。没有更改默认目录、env 空值优先级、托管能力路径隔离或保留期限。

D：ToolboxDatabase 保留连接与事务所有权、构造/失败关闭、启动恢复和实体 façade；内部迁移、表映射、行映射、文件记录和审计各有唯一实现。FileMetadata 的原导出入口保留。4 项新测试在移动前通过：跨实体/文件/审计回滚、嵌套 savepoint、路径冲突时 createdAt 保留、SQL NULL 与 JSON null。提取后与旧迁移/一致性/维护/装配共 54 项通过。AST 证明构造、连接、事务、恢复及其他未拆方法不变，全部 SQL 字面量相同，4 个迁移实现只改显式 connection 与私有 helper 调用。未新增迁移或 Schema 版本；不是对用户数据库执行数据迁移。

## 当前文件所有权

- app.ts：公开 createApp、初始化/失败清理编排；app/ 下按创建、服务、保护、生命周期、插件、响应、存储、系统路由、业务路由分工，options 只存类型。
- config.ts：原 getConfig 与 AppConfig 导出 façade；core/config/ 下为无 import 副作用的配置类型/环境原语/六个解析分组。分组返回原连续字段，不引入服务定位器。
- database/toolbox-database.ts：连接、事务、实体接口和恢复；migrations/schema/row-mapping/file-records/audit/types 为内部实现。迁移由原构造流程调用，原事务边界仍在 façade。
- modules/diagnostics/errors.ts：独立错误构造；deep-checks 对 service 只保留类型依赖。

## 阶段总回归

| 命令/检查                                            | 本阶段实际结果                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| pnpm coverage                                        | core 21、shared 130、API 836、Web 389 通过；API 原 6 项跳过保留，78 个 API 测试文件通过、1 个原文件跳过 |
| pnpm typecheck / lint / deadcode / lint:architecture | 通过；355 个生产/配置源码，原两条桌面诊断跨应用债务未扩大                                               |
| pnpm test:contracts / test:architecture              | 各 4 项通过；273 条路由保护在 API 全量测试中保持                                                        |
| pnpm test:scripts                                    | 最终 82 通过、1 项既有跳过；包含 B08 新增 5 项测试                                                      |
| pnpm test:diff-coverage                              | 最终 16 项通过，含缺失业务 LCOV 拒绝与真实未覆盖行保留                                                  |
| pnpm test:python:runner                              | 5 项通过                                                                                                |
| .venv-refactor-tests/Scripts/python.exe -m pytest    | 已有开发环境中 8 项通过，未安装依赖                                                                     |
| pnpm build                                           | 完整普通构建及全部隔离冒烟通过，含冷热启动、ZIP 无 Git、异 cwd、既有离线资源复用和源码/分发映射         |
| 原体积预算                                           | 入口 gzip 151744/153600 字节；懒加载 76800 字节门槛未改变                                               |
| pnpm --filter desktop build / test                   | main/preload 编译通过，95 单元、7 冒烟脚本单元通过；未运行 root desktop:build、stage 或 native rebuild  |
| pnpm test:e2e                                        | 按 Playwright 技能复用现有 5 项测试，全部通过，16.2 秒；无新增浏览器测试或真实模型任务                  |
| 固定基线 --worktree 差异门禁                         | 最终 1970/2074，94.99%，原 90% 不变；统计覆盖 R00 至 R05 的全部未提交改动，非仅本阶段                   |
| 格式、git diff --check、真实索引                     | 格式及 diff 检查通过，真实索引为空，HEAD 仍为 55526ab                                                   |

API 新增 21 项测试（诊断 4、装配 5、配置 8、数据库 4），没有减少既有测试或调整其超时/阈值。未重新设计页面或改变 CSS。临时 E2E 根为 C:\Users\tangmy\AppData\Local\Temp\toolbox-r05-final-e2e-44991ad3e63f4317af77817e5c2257f3；进程 TEMP/TMP 与 TOOLBOX_LEGACY_DATA_ROOT 结束后恢复，合成目录保留，没有重试删除此前保留目录。

## 独立缺陷 B08 与恢复验收

首次差异门禁 88.74% 未通过，随即暂停 R05 验收并单独登记 B08：已有声明排除策略没有应用到 LCOV 的累计统计。独立修复后补足先失败后通过夹具、声明 AST 审核与 CLI 集成测试，再恢复阶段验收；没有新增排除项或放宽任何门槛，AppOptions/ConfigContext 仍按原范围保守统计。详见 [B08 验收](b08-verification.md)。

B08 期间唯一涉及 API 的改动是将纯类型引用明确为 import type；重新编译后全部 API JS 分包与此前完整构建逐文件 SHA-256 相同，故全量测试/E2E 的运行时代码仍是同一版本。B05、B07 仍为独立待办，本阶段未混入修复。

## 未验证与下一阶段

真实模型推理、已安装能力环境专项、macOS 实机及安装包级验收不在自动执行范围；不得将源码通过等同于这些验收。没有新增依赖、删除原测试、放宽阈值或改清理白名单。没有读取私钥、修改签名包、提交、推送、发布或制作安装包。

原 createApp/startBackend、getConfig/AppConfig、ToolboxDatabase/FileMetadata 入口为有消费者的兼容 façade，必须保留，不属于无用过渡层。没有留第二套平行实现。

R05 已完成。R06–R12 尚未完成：能力管理器、业务领域、前端状态、桌面编排、工程脚本/CI、样式和最终文档/全项目回归。下一任务为 R06 的第一个纯类型/规范化原子单元，前置条件是重新核验工作区、保留现有修改并阅读安装状态机测试；本轮未提前开始。
