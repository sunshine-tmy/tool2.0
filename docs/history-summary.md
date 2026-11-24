# 历史方案与待验事项摘要

整理日期：2026-11-24。

本页合并已被现行说明替代的早期规划、旧发布清单及停用设计记录。这里只整理原有结论，没有重新执行验收，也不把旧报告中的测试数量或机器状态写成当前结果。完整过程报告位于 [历史归档](archive/README.md)；功能使用以 [文档导航](README.md) 和实际代码为准。

<a id="planning"></a>

## 早期项目与 UI 规划

最初的项目规划、UI 重构计划、企业优化清单，以及 `superpowers` 中的初始设计/实施计划已从源码工作区移除。它们的现行职责分别由项目 README、[架构说明](architecture.md)、根目录设计规范及 [R00–R12 状态入口](refactoring/README.md) 承接。

企业优化原记录中的 P0–P4 实现已标记完成，但该历史结论不代表当前版本通过完整回归。重构阶段的原日期、基线、失败和检查范围完整保留在归档报告中。

<a id="archive"></a>

## 多媒体归档

旧 MA00–MA09 方案中的已实现行为以当前 API、归档使用说明和代码为准，不再维护一份平行功能规划。2026-10-02 的原记录明确保留了 MA08：干净 Windows Runner/虚拟机中的 NSIS 安装、同目录升级数据保留及安装后关键操作；随后才是 MA09 最终文档验收。相关事实见 [原验收台账](archive/multimedia-archive-validation.md)。

这些是原记录留下的验收边界，本次没有运行安装器、迁移数据库或修改用户媒体，不能因删除旧计划就标记通过。

<a id="video-subtitle"></a>

## 视频去字幕

旧模块方案中的速度、显存、默认档位和许可估算不再作为操作说明。当前范围见 [发布交接](video-ai-release-handover.md)、[STTN/ProPainter 接入](video-ai-sttn-propainter-plan.md) 和 [时序引擎说明](video-ai-sequence-release.md)。原先未完成的真实画质、平台及安装包验收，仍按这些现行交付材料处理。

<a id="data-backup"></a>

## 模块数据备份

旧 DBK 方案记录 DBK-00～DBK-05 功能实现，以及 DBK-06 自动回归、普通构建和分发夹具已完成；安装包、跨设备真实体量和 macOS 验收仍有待实机确认。本次未重新验证这些结果。

现行入口、合并/替换语义、数据范围、恢复点、取消和失败处理统一维护在 [数据备份与恢复](module-data-backup.md)，不再保留重复实施方案。

<a id="macos-release"></a>

## macOS 发布历史

六份旧上传、签名清单及替换操作表已合并为此摘要，旧本机绝对路径不再作为上传指引。

- 旧 `mac能力包` Release 已被用户指定的 `mac-ability-pack-2026-11-12-01` 目标取代。
- 2026-11-15 原记录确认：tag01 的 32 个资产与当时正式候选大小、SHA256 一致，10 份 manifest 正式验签通过，20 个 manifest/SPDX 元数据已完成替换；12 个归档当时无需重传。
- 该数字是当时十项能力的历史快照，不是今天的资产数量，也不表示应再次替换同名文件。当前能力版本及下载地址以应用内置平台目录为准。
- 不上传私钥；能力目录随主程序构建，不把 catalog 当成能力包上传。

完整来源见 [macOS 历史台账](archive/macos-execution-status.md)。当前构建边界见 [macOS 指南](macos-apple-silicon-build.md)，不再执行旧清单里已经完成的替换步骤。

<a id="macos-acceptance"></a>

## 从原台账保留的 macOS 待验边界

截至原台账 2026-11-16 的记录，下列事项未形成完整通过结论；本次整理没有改变其状态：

- TikTok 主页列表受平台限制，F07-05 曾按用户要求暂时跳过。
- M06/M07 部分原生输入、权限、防火墙、设备与 LAN 扩展场景仍待人工验证；原窗口、全屏及播放退出保护已确认的部分不退回未完成。
- M08-02 已完成真实 Windows 备份导入和抽样再编辑，但提供的备份没有 CUDA 视频历史，不能替代该项跨平台降级验收。
- 真实 DMG、干净 macOS 设备安装/升级与分发验收仍不能由源码或目录版应用的检查代替。

后续应以新证据更新 [执行计划](macos-apple-silicon-implementation-plan.md) 和当前说明，不能根据早期日志中已经被后续记录覆盖的“待完成”重复实施。

<a id="retired-images"></a>

## 停用设计记录

`hero-workstation`、`hero-creative-assistant` 和 `brand-logo-light` 的独立历史生成 JSON 已移除。它们没有当前图片引用；正式资源映射和维护规则分别见 [运行时资源清单](design/ui-v2/implementation-assets.json) 与 [资源维护说明](design/ui-v2/asset-maintenance.md)。当前图标、首页插画、设计规范及轻量评审页继续保留。

## 追溯原文

本次移除的原文件名和整理前摘要记录在 [归档清单](archive/manifest.json)。原提交 `83332021bf84aec8eaf2fac95ba5357c1860f9e0` 保留了这些已提交文档，必要时可在完整 Git 历史中使用 `git show <提交>:<原文档路径>` 查阅。当前工作区中的历史过程报告仍可直接通过归档目录阅读，无需联网。
