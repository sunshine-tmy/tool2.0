# R07-E 内容归档依赖核对与迁移顺序

状态：DONE。E1–E5 已逐项完成。起点为 R07-D7C 验收后的工作区，HEAD 55526ab、真实索引为空。
保留当前工作区的全部已有修改，不从 HEAD 覆盖实现，不涉及用户库或已签名内容。

## 当前证据与职责归属

迁移前 modules/media-archive 有 24 份 TypeScript，modules/xhs-archive 有 12 份。
不能按旧文件夹名称直接整体归为 core 或 compat：

| 当前实现                                                                                    | 实际职责 / 目标归属                                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| xhs-archive/auth、provider-item、runtime、runtime-process、runtime-install-gateway          | 小红书平台凭据、字段映射、运行时及安装适配，归 providers/xiaohongshu；不是旧 API 兼容代码               |
| media-archive/douyin-browser、douyin-reader、douyin-runtime、douyin-source、browser-network | 匿名抖音平台运行时与浏览器网络，归 providers/douyin；不读取小红书 Cookie                                |
| media-archive/douyin-probe                                                                  | 有顶层执行、信号和输出文件的验收 CLI；单独核对脚本/测试消费者后迁移，不能作为普通无副作用模块导入       |
| xhs-archive/translation-runtime                                                             | 两平台共用的翻译能力运行时，拟归 core；保留 XhsTranslationRuntime / Error 类名及单一身份，不重建 Worker |
| media-archive/platform-providers、runtime-routes                                            | 平台装配和系统路由，归领域装配层，不伪装成纯核心规则                                                    |
| media-archive 其余 16 份                                                                    | 统一任务、存储、翻译、文件提交、媒体预览、截帧及导出，归 core                                           |
| xhs-archive/store、task-service、translation-service、media-routes、translation-routes      | 复用统一管线的旧 DTO/调用适配，归 compat/xhs；不重建第二套存储或队列                                    |
| xhs-archive/routes                                                                          | 同时注册新旧路由并装配服务；机械迁移后再独立核对装配归属，不在搬目录时拆注册顺序                        |

具体反向依赖证据：media-archive/translation-service.ts 引用旧目录中的翻译运行时及错误类，
translation-state.ts 通过 instanceof 识别同一错误类；platform-providers.ts 引用小红书运行时、凭据及字段映射。
若先把整个 xhs-archive 搬入 compat，将制造 core → compat 依赖，并可能通过重复错误类破坏错误分类。
因此先安置真实 provider 和共享翻译运行时，再迁 core，最后整理兼容层与装配。这是迁移顺序细化，不改变功能范围。

## 独立迁移单元

1. E1：小红书 provider 的 5 份实现及直接消费者，只改模块路径。已完成，见 [E1 验收](r07e1-xhs-provider-layout-verification.md)。
2. E2：抖音 provider；验收 CLI 的顶层执行和入口路径单独核对。已完成，见 [E2 验收](r07e2-douyin-provider-layout-verification.md)，probe:douyin 命令保留，仅更新内部入口。
3. E3：共享翻译运行时归属，保持错误类身份、Worker 脚本、模型与能力路径。已完成，见 [E3 验收](r07e3-translation-runtime-layout-verification.md)，旧内部运行时路径不保留平行实现。
4. E4：统一核心目录迁移，禁止 core 反向导入 compat；任务、文件提交和翻译所有权保持。已完成，见 [E4 验收](r07e4-archive-core-layout-verification.md)。
5. E5：旧小红书适配与领域装配归属，保留 API 和初始化、注册及关闭顺序。已完成，见 [E5 验收](r07e5-archive-compat-assembly-verification.md)。先迁移再提取旧注册，两个独立单元分别验收。

每单元补迁移前断言、核对相对引用实际目标及其余语句等价，执行定向与全量门禁后才进入下一单元。
没有新增架构例外，不以兼容为理由长期保留第二套源码树。

## 不随源码迁移的标识

保留 /api/v1/tools/xhs-archive、/api/v1/tools/media-archive、旧页面地址、工具/任务 ID、数据库 kind xhs-archive、
归档和 profile 目录、作品稳定身份、媒体顺序、清单格式及备份格式。
保留 Worker 鉴权、远程 fetch 和 SSRF、匿名浏览器边界、下载配额、Range、刷新、截帧、译文任务归属及原文哈希校验。
保留当前原文/译文/媒体/截图的保留与删除恢复规则，不执行数据转换或重新生成内容。
已发布 Python 文件、锁、公钥、能力目录及签名资产不改；不新增模型、依赖或 HTTP API。

R07-E 内容归档及后续 LAN/最终复扫已完成，见 [R07 总验收](r07-verification.md)。R08–R12、B05/B07/B10 和真实模型/macOS/安装包专项仍待完成。
