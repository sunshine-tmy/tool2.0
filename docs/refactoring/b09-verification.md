# B09：图片压缩测试隔离

日期：2026-10-23。状态：DONE。固定基线 55526ab，保留所有既有工作区修改；此任务先于 R07-A 源码移动单独实施。

证据与问题见 baseline-issues.md 的 B09：仅 STORAGE_ROOT 无法隔离 .env/runtime/models；一处测试未关闭应用。没有假定已发生业务数据损坏或压缩错误。

改动仅限 image-tools.test.ts 的创建/关闭/清理夹具：复用既有 createIsolatedAppFixture，不新增框架、依赖或全局环境修改。原用例、字节比较、输出元数据、ZIP 断言、超时与数量保持；测试目录由夹具在确认所有应用关闭后检查所有权再清理，失败关闭则保留证据。

验证：pnpm --filter backend test -- image-tools isolated-app-fixture：原压缩 5 项和已有夹具 5 项全部通过；pnpm typecheck、lint、deadcode 和 git diff --check 通过。AST 比较确认原 describe 下全部回调及断言只将 createApp() 替换为 fixture.start()，其余不变；本任务结束时 5 份压缩生产源码与开始捕获内容逐字节相同。

既有夹具 5 项覆盖路径/清理脚本所有权、拒绝宿主环境和 dotenv、配置拒绝后清理、晚启动时先 close 再删除、启动失败观察与清理，不新增平行实现。R07-A 后续全量回归仍需执行，不用这 10 项代替。未运行真实 Worker、模型或能力包安装。无提交、推送或发布。
