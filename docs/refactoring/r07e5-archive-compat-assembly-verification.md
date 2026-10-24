# R07-E5 旧小红书适配与领域装配

状态：DONE。2026-10-24，HEAD 55526ab、真实索引为空，保留已有全部修改。

## 职责与执行顺序

核对发现旧 xhs-archive/routes 同时装配两平台服务和注册旧 API，不能整份放入 core 或仅按旧目录名误判为 compat。
先机械迁移 8 份生产源码：5 份适配归 compat/xhs，混合路由和平台装配归领域根目录。
19 文件共 61 条模块引用；所有 import 替换后全文经同一 Prettier 格式化，SHA-256 与预期一致，旧源码均不存在。
目录迁移通过定向 29 文件、433 项、1 原跳过，以及类型、Lint、Knip、架构、契约、格式和 diff 检查后，才开始职责提取。

第二单元从领域 routes 单独提取 registerLegacyXhsArchiveRoutes 到 compat/xhs/routes。
原初始化前缀、全部旧路由注册语句及末尾两条关闭 Hook 与提取前逐字核对相同，仅以一次直接函数调用替代注册代码块。
不新增 Fastify register 层，不改作用域、服务所有权、初始化、注册或关闭顺序。
单一 ContentArchiveStore / TaskService / TranslationService 保持；旧 DTO、错误前缀及平台过滤继续复用该核心。
公开函数 registerXhsArchiveRoutes 和新旧 HTTP 方法、路径、字段、错误码不改，不新增 API。

维护 purgeAll 仍针对共享物理存储，普通旧视图删除只针对小红书；不静默缩小或扩大已有删除范围。
成功留档、原文、翻译、媒体、截帧、失败回滚、源哈希和任务归属检查均不变。
无数据库迁移、用户文件操作、新依赖、签名内容修改或生产过渡 façade。

## 新增回归

archive-compat-assembly.test.ts 新增 8 项，先在原实现通过：

- 单一核心 store、翻译继承和精确哈希函数身份。
- 三种错误前缀投影，去除 platform、不修改原对象；抖音任务不能从旧视图读取。
- 缺失项删除不触发核心删除；明确维护委托仍保留。
- 任务关闭失败仍执行翻译 shutdown，保留原异常。
- 同一 Fastify 实例上先初始化/恢复、再统一路由、再旧路由；真实 close 的反向 Hook 顺序不变。

合成任务、隔离空运行时与内存数据库，不访问平台、模型或已安装能力。
新增测试曾错误假设 purgeAll 返回对象；类型门禁指出原契约为 number，已仅修正测试替身并在迁移前重跑，不修改生产返回值。

## 验证结果

提取后定向 archive/xhs/douyin/browser-network/refactor-contracts/domain-consistency/maintenance：32 文件、446 项通过、1 原跳过。
类型、Lint、Knip、架构通过；384 个生产/配置文件，新增的 1 份仅为旧路由注册所有者，原 2 项精确债务不变。
契约 4、架构夹具 5、差异检查器 16 通过。
普通构建及源码/dist、冷热、异 cwd、无 Git ZIP、离线资源复用、原分发映射和商品渲染冒烟通过。
桌面 main/preload 编译及 95 单元、7 冒烟单元通过；脚本 82 通过、1 原跳过。
Python runner 5、既有测试环境 pytest 8、Ruff 11、mypy 9 文件通过，不安装依赖或运行真实模型。
全量 coverage：core 21、shared 130、API 1308、Web 389 通过；API 110 文件通过、1 原跳过，原 6 项跳过不变。
API 行/分支/函数 92.96% / 83.97% / 92.28%；Web 80.31% / 84.39% / 76.34%。
原 5 项 E2E 全部通过，15.8 秒；隔离根 toolbox-r07e5-final-e2e-770198480b7d4d0f8d22bb61bd606bda 保留在系统 Temp 下。
固定基线 --worktree 差异覆盖率 4457/4647，95.91%；全库格式、git diff --check、空索引及 HEAD 检查通过。
全局 75%/65%、差异 90%、入口/懒加载 153600/76800 字节预算不变，不接受新快照掩盖差异。

无新增独立业务缺陷、权限扩大、生产过渡 façade 或检查豁免。
后续为 F LAN 和 R07 总验收，不进入 R08。真实平台抓取/模型/GPU、macOS、真实能力安装及安装包级验收未执行。
无提交、推送、发布、真实签名或安装包制作。
