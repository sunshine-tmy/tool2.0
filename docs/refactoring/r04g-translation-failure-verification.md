# R04-G：翻译失败事务内更新去重

日期：2026-10-23。状态：DONE。

仅将运行过程的两处相同 updateTranslation/catch 链移为私有 markTranslationFailed。taskId 与 source hash 检查仍位于仓储 updater 回调内，读取当时的 ownership；未预先缓存归属，没有改变错误映射、吞掉元数据失败的旧策略、active 释放及终态顺序。入队失败分支规则不同，保持原实现。

先新增 3 项回归并在提取前通过：失败提交回调前瞬间发生 taskId 接管、原文变化均保留新编辑；元数据写入失败保留原错误且允许显式重试。提取后并发、关闭、引擎、双平台路由及旧入口测试共 52 项通过。AST 证明提取回调与基线两份失败回调完全一致，其他仓储回调不变。第一次 AST 辅助脚本误选 installing 回调，修正为精确匹配 failedTranslation 后通过；并非业务或测试失败。最终全量 coverage、类型/Lint/Knip/架构、构建及固定基线差异门禁通过，统一结果见 [R04 总验收](r04-verification.md)。没有 HTTP/Schema/存储/保留规则变化。
