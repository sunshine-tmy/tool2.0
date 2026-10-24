# 文档导航

本页于 2026-10-24 的 R12 收口时整理。当前操作说明随代码维护；历史记录保留原日期、基线、失败及当时数字，不能拿旧报告证明当前版本已验收。

## 当前操作与开发

| 入口                                                        | 用途                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| [项目 README](../README.md)                                 | 新电脑、完整离线资源、启动、配置、开发和用户自行打包                      |
| [离线资源清单](source-resources.md)                         | 从签名目录与启动器固定版本生成，CPU 11 个归档，CUDA 另加 4 个；不手改版本 |
| [架构与开发指南](architecture.md)                           | 真实目录、所有权、依赖边界、保留入口及新功能落点                          |
| [API 参考](api.md)                                          | `/api/v1`、健康检查及业务接口                                             |
| [运维手册](operations.md)                                   | LAN 权限、备份、存储一致性、隔离区及受控发行流程                          |
| [启动诊断](startup-diagnostics.md)                          | 服务状态、只读 doctor 与诊断报告                                          |
| [桌面帮助](desktop-application-help.md)                     | 安装、能力管理、数据位置、升级和卸载                                      |
| [音频库](audio-library.md)、[配音批次](edge-tts-batches.md) | 用户操作和既有保留/恢复规则                                               |
| [macOS 内部测试](macos-apple-silicon-build.md)              | 当前平台限制与实机门槛，不表示全模块可用                                  |
| [重构当前状态](refactoring/README.md)                       | R00–R12 状态及逐阶段证据                                                  |
| [R12 后专项验收](refactoring/post-r12-acceptance.md)        | 真实模型、能力环境、macOS、安装包及跨设备检查，未执行项明确保留           |

## 历史材料

- [原始项目规划](project-plan.md)、[UI 规划](ui-ux-redesign-plan.md)、[早期设计和实施计划](superpowers/specs/2026-07-06-lightweight-ecommerce-toolbox-design.md)：保留原始需求与旧目录，新增功能以当前架构落点为准。
- [企业优化记录](enterprise-optimization-backlog.md)：保留当时基线与验收，不再作为实时任务清单。
- [归档接入规划](multimedia-archive-plan.md)及[验收证据](multimedia-archive-validation.md)：保留每次检查的真实范围，不改写早期失败或未验收记录。
- [Python 统一迁移](python-runtime-unification.md)、[桌面原始矩阵](desktop-release-matrix.md)、`adr/`：保留版本迁移和架构决策；不表示当前机器已经运行过专项验证。
- `refactoring/` 中的阶段与独立问题报告：仅入口 README 的最新状态代表进度；各报告中的“下一步”“待完成”和测试数量属于报告时点。固定基线是 `55526abc4f67d04e99ba677b335c38b43b4584bb`，不随 HEAD 前移。

维护文档时同步更新 [文档分类清单](documentation-map.json)。`pnpm test:scripts` 会检查当前文档的本地链接、退役源码路径、启动文件清单及历史标识；不访问外部网站，不读取 `.env` 或运行业务任务。
