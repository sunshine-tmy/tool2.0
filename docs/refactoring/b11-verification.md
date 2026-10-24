# B11：AI 图片 API 测试完整隔离

日期：2026-10-23。状态：DONE。固定基线 55526ab；本独立测试任务先于 R07-B1 源码移动。

问题证据见 baseline-issues.md 的 B11。此问题是既有测试隔离风险，不宣称已发生用户数据损坏或推理错误。

仅复用已有 createIsolatedAppFixture：为明确的 DATABASE_PATH、IMAGE_AI_WORKER_URL、DEPLOYMENT_USAGE 增加测试选项类型；原默认不变。每项测试持有独立完整布局及同根文件数据库，24 次创建/重启由同一夹具追踪，禁止继承 .env 与未指明环境变量，恢复清理由夹具拥有。原模拟 Worker 的地址、请求与结果、重启行为、20 项原断言和超时保留，不增加生产配置入口。

新增 1 项夹具测试：显式回环 Worker、同根数据库和原部署用途在两次启动中复用，不继承或覆盖宿主配置。pnpm --filter backend test -- image-ai.test isolated-app-fixture：原 API 20 项、夹具原 5 项及新增 1 项全通过，共 26 项；pnpm typecheck、lint、deadcode 和 git diff --check 通过。

AST 比较确认原 20 个回调及全部断言只将 24 个 createApp 调用改为受追踪 startApp，其余保持；共享夹具运行时 AST 与原实现相同，仅类型选项增加。7 份生产源码在此任务完成时逐字节相同、未移动。Windows 命令行长度限制曾阻止一次大体积只读 AST 诊断，已改为逐文件检查与已核实相同的固定基线读取，不通过文件落地或扩大任何豁免解决。

R07-B1 后续全量回归仍需执行，本记录不代替领域迁移验收。未安装依赖，未启动真实模型、读取私钥或修改签名内容；不提交、推送、发布或制作安装包。
