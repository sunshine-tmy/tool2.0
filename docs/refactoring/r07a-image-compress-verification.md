# R07-A：图片压缩领域归属

日期：2026-10-23。状态：DONE。固定基线 55526abc4f67d04e99ba677b335c38b43b4584bb；开始时真实索引为空，1130 条既有工作区状态均保留，不提交、推送、发布或制作安装包。

## 本次任务与范围

R07 按业务领域分别实施，本原子任务只整理图片压缩，不同时更换算法、任务状态机或其他领域。当前已确认 image-tools 的泛化入口只有 image-compress 一个消费者；输入、压缩服务、文件/ZIP 网关及路由分散为 5 个生产文件。

先独立完成既有测试隔离 B09，见 b09-verification.md。然后先补迁移前兼容断言，再机械归属到 apps/api/src/domains/image-compress；所有消费者更新，不长期保留第二套源码树。普通原子提交仍复用 storage/file-commit-gateway，不搬动用户存储或输出文件。

## 改动范围与等价证明

| 旧源码（apps/api/src/ 下）             | 新源码（apps/api/src/ 下）                   |
| -------------------------------------- | -------------------------------------------- |
| modules/image-compress/routes.ts       | domains/image-compress/routes.ts             |
| modules/image-tools.ts                 | domains/image-compress/compression-routes.ts |
| modules/image-compress-input.ts        | domains/image-compress/input.ts              |
| modules/image-compress-file-gateway.ts | domains/image-compress/file-gateway.ts       |
| modules/image-compress-service.ts      | domains/image-compress/service.ts            |

仅应用装配与新增测试引用新路径；原 registerImageCompressRoutes 入口、参数及调用顺序保留。泛化内部名称 registerSingleImageToolRoute/RegisterImageToolRoutesOptions 改为具体的 registerImageCompressHandlers/RegisterImageCompressRoutesOptions，不再作为可复用通用图片框架。

在开始捕获的 5 份源码上做 AST 对比：除两个内部名称及 import 位置，全部运行语句相同；逐条解析的 31 个 import 目标、binding 和顺序等价。旧 5 个文件不存在，apps/packages/scripts/tooling/e2e/CI 中没有残余旧生产路径引用；历史文档不强行改写。未移动忽略目录、数据、.env、模型、缓存或输出。

## 保持不变的契约

接口、响应/错误码、默认 PNG、quality/width 规则、JPEG/PNG/WebP 实际字节、负节省值、输入大小/像素限制、任务先运行后提交终态、输出命名、可下载文件、ZIP 选择/去重/命名和清理行为均冻结。签名包、Python、模型、数据库 Schema、TTL、启动和分发路径不变。

## 测试与验证结果

新增 image-compression-compat.test.ts 的 24 项在移动前通过，移动后与原压缩 5、文件提交 2、契约 2 共 33 项通过。分组为：解析/规范化 7、负节省与默认 PNG 字节 1、缩放/不放大与旧尺寸字段 2、上传失败及终态 4、20 MiB 限制 1、完整 ZIP 字节/选项/重名 1、空选择 4、ZIP 丢任务/丢文件 2、文件提交及元数据先于成功终态 1、旧非致命元数据登记失败 1。没有删除旧测试或增加超时。

收口复核将提交顺序断言放在元数据回调外：该服务原本会捕获登记异常，不能把 expect 放在可被吞掉的回调内。补强后的 24 项、API 类型与 Lint 再次通过；生产源码未改。最终完整 API coverage 按这一测试版本重跑。

| 命令/检查                                                    | 本任务实际结果                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| pnpm coverage                                                | core 21、shared 130、API 898、Web 389 通过；API 原 6 跳过保留，84 个文件通过、1 个原文件跳过                   |
| 最终版本 API coverage                                        | 898 通过、6 项原跳过；行/语句 92.58%、分支 82.88%、函数 91.14%，最终测试版本完整重跑通过                       |
| pnpm typecheck / lint / deadcode / lint:architecture         | 通过；367 个生产/配置源码，原跨应用债务不变                                                                    |
| pnpm test:contracts / test:architecture / test:diff-coverage | 4 / 4 / 16 项通过；273 个 API/健康路径冻结通过                                                                 |
| pnpm test:scripts                                            | 82 通过、1 项原跳过                                                                                            |
| pnpm test:python:runner / 现有开发环境 pytest                | 5 / 8 项通过，无依赖安装                                                                                       |
| 现有开发解释器 Ruff / mypy                                   | 11 个文件格式及 Lint 通过，9 个源码类型检查通过                                                                |
| pnpm --filter desktop build / test                           | main/preload 编译、95 单元及 7 个冒烟脚本单元通过；未运行 root desktop:build、stage/native rebuild             |
| pnpm build                                                   | 完整普通构建和全部隔离冒烟通过，含冷/热启动、ZIP 无 Git、异 cwd、已有离线资源复用及源码/分发映射；未制作安装包 |
| pnpm test:e2e                                                | 按 Playwright 技能复用原 5 项，全通过，15.4 秒；无新增浏览器测试或真实模型任务                                 |
| 固定基线 --worktree 差异门禁                                 | 2878/3058，94.11%；累计 R00 至本单元未提交改动，原 90% 门槛和声明审核范围不变                                  |
| 格式 / git diff --check / 索引                               | 全库格式、diff 检查通过，真实索引为空，HEAD 仍为 55526ab                                                       |

以上均为本任务实际命令，不用旧 R06 数字代替。现有 API 跳过项、全局 75%/65%、差异 90% 和入口/懒加载体积预算均未调整。

入口 gzip 151744/153600 字节，懒加载阈值仍为 76800 字节。API 原 6 跳过为 3 个 macOS 专项、1 个 Windows 符号链接用例及 2 个显式在线 Edge-TTS 用例，未扩大匹配或增加跳过。

浏览器数据根为 C:\Users\tangmy\AppData\Local\Temp\toolbox-r07a-final-e2e-3459fc6be2534fbdbb2370264305382f；TEMP/TMP 与 TOOLBOX_LEGACY_DATA_ROOT 在 finally 恢复，该合成目录保留，没有重试删除此前被保留的证据目录。5 项覆盖基础健康、LAN 续传/批量删除、固定替身配音、归档失败重试及确认取消，没有对外业务服务或真实推理调用。

## 独立缺陷

B09 测试夹具已先单独完成，见 [B09 验收](b09-verification.md)。B10 在迁移前复现并登记：64×48 输入缩为 32×24 后响应仍为 64×48；本单元冻结旧字段，未修复此 API 展示语义。B05/B07 继续独立待办，没有混修。详见 [独立问题清单](baseline-issues.md)。

## 剩余过渡层

没有旧路径转导出或第二套源码树。routes.ts 保留既有具体领域入口，compression-routes.ts 持有原处理器，两者不是新通用框架；文件提交仍只有原网关实现。其他业务结构、状态所有权及测试发现规则未修改。

## 未验证与下一任务

不执行真实模型、已安装能力环境的 Worker 框架专项、真实能力包安装、macOS 实机或安装包级验收。未读取私钥、修改签名内容、迁移用户数据库或更改 TTL/删除恢复策略；无提交、推送、发布或安装包制作。

本原子单元 R07-A 已完成，R07 整阶段仍为 IN_PROGRESS。

下一任务为 R07-B AI 图片领域：重新核验工作区，先审查 task-manager 的持久化投影、队列、source lease、容量预留、幂等提交/删除锁与成功终态顺序，再分原子单元迁移及职责提取，不能同时改算法或数据保留。R07 其他配音、音频库、内容归档和 LAN 单元及 R08–R12 仍未完成，不把本单元通过写成 R07 整阶段完成。
