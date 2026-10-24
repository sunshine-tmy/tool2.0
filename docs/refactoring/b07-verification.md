# B07 Chatterbox 测试隔离与失败清理

状态：DONE，代码级定向、故障及后端回归通过。2026-10-24；HEAD 55526ab、索引为空。

## 改动与保持不变

chatterbox.test 原先只有成功路径末尾 close，afterEach 先关闭模拟 Worker 再删除目录，断言失败可能留下活动数据库。
现复用既有 createIsolatedAppFixture：13 次应用创建全部被追踪，布局明确、dotenvPath:false、环境显式传入。
SQLite 重启仍复用本测试 storage/toolbox.db；Worker URL/10000 ms 超时和 PATH 上既有 ffmpeg/ffprobe 明确指定，不继承本机 .env/能力目录。
不安装工具、启动真实模型或更改配音生产实现。

在既有夹具中分离 closeApps，仅暴露“关闭本夹具创建的应用，不删文件”；dispose 仍复用相同关闭和路径保护后清理。
afterEach 顺序为应用/数据库 → 模拟 Worker → dispose 自有目录。应用关闭失败仍尝试关 Worker，但保留目录；Worker 关闭失败也不继续删除目录。
正常测试保留原显式 close；失败和重复关闭由同一所有者兜底，不另建应用追踪数组。

对修改前完整测试文件按明确的创建入口、配置、路径及类型替换核对全文，原 16 项业务断言、超时和模拟 Worker 逻辑保持。
没有删测试、加 skip、加长超时、忽略 EBUSY 或修改任何用户数据/业务保留规则。

## 故障及定向回归

夹具新增 3 项：显式 Chatterbox 配置不继承/改写宿主环境；两个未关闭应用在断言失败后关闭但目录保留供外部夹具收尾；关闭失败报告原异常并保留目录。
新增关闭阶段测试在旧夹具得到预期失败，补实现后 9 项夹具测试通过；原 Chatterbox 16 项全部通过。

额外使用一次性 Vitest transform，在原真实 Chatterbox 用例应用创建后注入确定性 expect 失败，没有复制或修改原测试源码。
预期退出码 1、唯一标记 B07_EXPECTED_ASSERTION_ABORT；实际观察到 APPS_CLOSED → WORKER_CLOSED → ROOT_REMOVED，无 EBUSY。
系统 Temp 内的 toolbox-app-isolated-Cd3SQ9 根已确认不存在；这是本次合成夹具，不是用户数据。
临时 .b07-failure-probe.config.ts 已移除，不进入默认测试收集；故障探针筛选导致的 15 项跳过不计入正常测试跳过数。
不重试删除之前遗留的证据目录。

最终后端 coverage：1341 项通过、原 6 项跳过；112 文件通过、1 原跳过，无原测试减少。
API 行/分支/函数 92.99% / 84.09% / 92.43%；新增 3 项夹具和 B10 的 18 项解释全部数量变化。
全工作区类型、Lint、Knip、架构、契约门禁及普通构建通过；桌面编译/95 单元/7 冒烟单元、脚本 82 通过/1 原跳过。
固定基线 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree 差异覆盖率 4469/4659，95.92%，门槛不变。
全库格式、git diff --check、空索引和 HEAD 未变核对通过。
本次重新执行后端覆盖率，没有重跑未受影响的 Web/shared 单元、Python 或浏览器 E2E；没有把旧结果冒充为本次运行。
真实模型、macOS/安装包专项未执行，未推进 R08，未提交、推送或发布。
