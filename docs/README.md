# 文档导航

2026-11-24 已整理当前说明、专项交付和历史归档。当前操作说明随代码维护；历史报告保留原日期、基线、失败及当时数字，不能据此证明当前版本已经验收。

## 当前操作与开发

| 入口                                                        | 用途                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| [项目 README](../README.md)                                 | 新电脑、完整离线资源、启动、配置、开发和用户自行打包                      |
| [离线资源清单](source-resources.md)                         | 从签名目录与启动器生成，以清单中的固定版本和完整分卷为准，不手改版本 |
| [架构与开发指南](architecture.md)                           | 真实目录、所有权、依赖边界、保留入口及新功能落点                          |
| [API 参考](api.md)                                          | `/api/v1`、健康检查及业务接口                                             |
| [运维手册](operations.md)                                   | LAN 权限、备份、存储一致性、隔离区及受控发行流程                          |
| [启动诊断](startup-diagnostics.md)                          | 服务状态、只读 doctor 与诊断报告                                          |
| [桌面帮助](desktop-application-help.md)                     | 安装、能力管理、数据位置、升级和卸载                                      |
| [数据备份与恢复](module-data-backup.md)                     | 模块导出、合并/替换导入、恢复点及失败处理 |
| [UI 规范与资源](design/ui-v2/README.md)                     | 设计规范、轻量评审页和正式图片资源映射 |
| [音频库](audio-library.md)、[配音批次](edge-tts-batches.md) | 用户操作和既有保留/恢复规则                                               |
| [JSON 格式化](json-format.md)                               | 本地校验、格式化、压缩、导入及下载，输入不持久化                          |
| [Base64 编解码](base64.md)                                  | 文本、文件与 URL 安全格式编解码，保留原始字节                             |
| [URL 编解码](url-codec.md)                                  | URL 组件、完整 URL 和表单字段值，严格校验与本地复制下载                   |
| [UUID 生成](uuid-generator.md)                              | 安全随机 UUID v4、批量生成、格式调整和复制下载                            |
| [macOS 内部测试](macos-apple-silicon-build.md)              | 当前平台限制与实机门槛，不表示全模块可用                                  |
| [重构当前状态](refactoring/README.md)                       | R00–R12 状态及逐阶段证据                                                  |
| [R12 后专项验收](refactoring/post-r12-acceptance.md)        | 真实模型、能力环境、macOS、安装包及跨设备检查，未执行项明确保留           |

## 专项方案与交付

- [STTN / ProPainter 接入](video-ai-sttn-propainter-plan.md)：非商用视频去字幕扩展的资产、依赖、能力包、时序处理、资源门槛和 S00～S07 阶段证据。
- [时序引擎交付与验收](video-ai-sequence-release.md)：实现范围、复现命令、升级兼容矩阵及历史审阅阶段，不能将旧审阅包状态当作当前发布状态。
- [视频去字幕安装记录](video-ai-local-installation.md)：保留 1.1.0 本地试用包的安装过程；当前安装版本以应用签名目录为准。
- [2026-11-24 Windows 能力包交付](diagnostics-capability-release-20261124.md)：参考音色克隆和视频基础包新版的发布、源码接入及验收边界。
- 当前视频去字幕交付范围见[发布交接文档](video-ai-release-handover.md)；旧模块方案已合并到[历史摘要](history-summary.md#video-subtitle)，不能根据早期估算认定模型或档位已经验收。

## 历史材料

- [历史方案与待验事项摘要](history-summary.md)：替代重复的项目/UI/企业优化/归档/备份规划、旧 macOS 发布表和停用设计记录，保留尚未完成的验收边界。
- [历史归档](archive/README.md)：保留 78 份重构过程报告、macOS 台账和归档验收台账，原始日期、失败及检查范围不变。
- [Python 统一迁移](python-runtime-unification.md)、[桌面原始矩阵](desktop-release-matrix.md)、`adr/`：保留版本迁移和架构决策；不表示当前机器已经运行过专项验证。
- 重构状态看 `refactoring/README.md`，详细过程报告位于 `archive/refactoring/`；旧报告中的“下一步”“待完成”和测试数量属于报告时点。固定基线是 `55526abc4f67d04e99ba677b335c38b43b4584bb`，不随 HEAD 前移。自动检查读取的五份 JSON 留在 `refactoring/` 原位置。

维护文档时同步更新 [文档分类清单](documentation-map.json)。`pnpm test:scripts` 会检查当前文档的本地链接、退役源码路径、启动文件清单及历史标识；不访问外部网站，不读取 `.env` 或运行业务任务。
