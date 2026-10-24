# R09 桌面职责与生命周期

本文说明当前代码归属；真实模型、macOS 和安装包验收仍按项目计划留到 R12 完成后。

| 位置                                                | 所有权与边界                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/desktop/src/main.ts`                          | 原仓库/安装/数据、图标和 preload 路径锚点；只创建并启动一个 application              |
| `apps/desktop/src/preload.ts`                       | 原固定桥接方法与诊断事件；无通用 invoke、任意文件/进程控制                           |
| `apps/desktop/src/runtime-layout.ts`                | 实际布局与根路径实现；直接被 Node 构建冒烟导入，故保留根级，不是转发副本             |
| `app/application.ts`、`launch.ts`                   | 私有应用级状态、单实例/事件注册和 boot；状态不随窗口/重试重建                        |
| `app/startup-diagnostics.ts`、`startup-progress.ts` | 独立于后端的启动诊断与重试状态；只在已确认可重试时提供恢复                           |
| `app/startup-migration-flow.ts`                     | 首次迁移窗口、选择状态与完成 promise；数据算法不在 UI 流程内                         |
| `app/maintenance.ts`                                | 维护/更新的停止与重启协调；通过最小显式后端 port，不持有第二套后端状态               |
| `app/quit-flow.ts`、`quit-coordinator.ts`           | 应用唯一退出协调、播放/维护保护、停止失败后的已确认退出重试                          |
| `ipc/`                                              | 设置/播放/诊断报告/数据迁移/首次迁移/启动诊断固定能力；按各自信任边界校验            |
| `windows/`                                          | 业务窗口、首次迁移与诊断页面、关闭进度窗口；保留原 sandbox/contextIsolation/导航策略 |
| `backend/`                                          | 后端监督、Windows Job 归属、退出等待、系统代理解析；不按名称或端口结束外部进程       |
| `data/`                                             | 原设置、数据迁移/恢复、根迁移算法及路径初始化；不改数据格式或删除范围                |
| `updates/`                                          | 原受控更新源与更新器，CJS 加载及应用级缓存保留                                       |
| `security/`                                         | 原窗口 URL/外链判定，不合并不同信任上下文                                            |
| `packages/runtime-core/src/diagnostic-journal.ts`   | Node 共用白名单日志，类声明无 import 时文件操作；不依赖 API/Electron                 |

## 关键顺序与生命周期

- 路径锚点由 main 计算并传入 application；`initializeDesktopPaths` 仍在 `whenReady` 前执行。Win/macOS 数据根及打包资源名称不变。
- 单实例成功：注册 second-instance → 发起 boot → 注册 window-all-closed / before-quit。失去锁时不启动后端、不接管另一实例。
- boot：诊断/存储 → 首次选择 → 未完成迁移恢复 → 代理 → 受控后端 → 固定 IPC → 后端 ready → 业务窗口加载 → 进入完成态 → 更新检查。
- boot 重试不重新创建 application、诊断或 IPC。后端状态未知时不报告可安全重试；只有原退出保护已确认的失败路径允许重试。
- 维护：冻结/检查 → clean stop → 数据操作 → restart → monitor → reload → 释放互斥。操作失败仍先恢复服务；若重启也失败，保留原重启错误优先规则。
- 更新：维护/播放保护 → 检查 → clean stop → 标记 quitting → 原 quitAndInstall。未准备或停止异常时不安装。
- 退出：维护/播放/任务确认与二次冻结 → 清计时器并销毁业务 renderer 停止播放 → 停止拥有的后端/后代 → 确认后退出。失败保留 committed 协调器，下一次关闭只重试回收。

## IPC 与安全

`ipc/register-desktop-ipc.ts` 明列原 9 个业务频道和顺序；版本、首次迁移和诊断继续分别注册。preload 只暴露原逐方法 API。
主窗口调用同时检查当前窗口、webContents、mainFrame 与当前 backendOrigin。启动诊断保留主 frame 和 data 页面校验；首次迁移保留其原窗口身份校验，不能悄悄换成另一类窗口的宽松或更严格规则。
目录选择表仅在主进程维护一次性、10 分钟过期的选择 ID；renderer 不提供原始路径。保存诊断仍通过用户文件对话框，不提供通用写文件能力。

架构门禁不再存在跨应用豁免；旧桌面平铺实现不能通过类型/运行时导入回流。preload 不得导入 Node、runtime-core 或应用内部实现，固定暴露集合另由完整桥接测试锁定。

## 本次未做

不重写队列、恢复、Job Object、退出或更新状态机；不修改签名包、Worker、模型、用户数据、安装器身份或分发资源路径。
普通编译、构建布局和模拟测试不等同于真实桌面安装/退出/macOS 验收。R10 工程脚本、R11 样式与 R12 收口仍待后续阶段。
