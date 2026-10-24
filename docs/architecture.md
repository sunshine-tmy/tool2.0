# 架构与开发指南

本文描述 R00–R12 重构后的实际归属，基线为 `55526abc4f67d04e99ba677b335c38b43b4584bb`，整理日期 2026-10-24。功能入口、接口字段和操作以 [README](../README.md)、[API 参考](api.md)与现有 Schema 为准。阶段证据见 [重构记录](refactoring/README.md)，本页不代替专项验收。

## 工作区与三类路径

| 源码位置                | 包名及职责                                                     | 构建或分发映射                                                          |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/api`              | `backend`；Fastify、任务、安全、持久化及 Worker 适配           | `dist/server.js`、`dist/desktop-entry.js`；桌面仍为 `resources/backend` |
| `apps/web`              | `frontend`；Vue 页面与浏览器状态                               | `dist/`；桌面仍为 `resources/frontend`                                  |
| `apps/desktop`          | `desktop`；Electron 主进程、窗口、IPC 与后端监督               | `dist/main.js`、`dist/preload.cjs`                                      |
| `packages/shared`       | `@toolbox/shared`；浏览器安全的契约、Schema 和纯函数           | 保留根、edge-tts、chatterbox，增加各领域子路径出口                      |
| `packages/runtime-core` | `@toolbox/runtime-core`；Node 路径、环境解析原语、诊断日志     | 独立 ESM/声明；调用方传入根目录，不由公共包位置猜根                     |
| `scripts`               | 公开 CLI/运行时入口，既有 Python、锁文件、能力定义及生成清单   | 参数、退出码及 Worker 包内路径保持原约定                                |
| `tooling`               | source / components / build / quality / testing / lib 工程实现 | 桌面只复制运行脚本清单中的闭包，不复制整个 tooling                      |

源码、分发资源和用户数据是三套路径。根目录 `.env`、`storage/`、`.runtime/`、`models/`、`offline-resources/` 不跟随源码迁移；Windows 安装数据仍在所选安装根下 `data/`，macOS 仍在原 Application Support 根。旧目录中被忽略的文件不属于源码迁移的删除目标。

`apps/api/src/project-root.ts` 是 API 的源码/编译态根锚点，`apps/desktop/src/runtime-layout.ts` 是桌面的真实路径实现，两者不是可删除的转发文件。启动不依赖 `.git` 或调用者 cwd；历史根歧义仍要求显式选择，不能静默换库。

## 后端所有权

```text
apps/api/src/
  app/                 创建服务、插件/安全、系统/业务路由、关闭顺序
  core/config/         分组解析，仍返回兼容 AppConfig
  core/workers/        Node HTTP/认证/超时传输，领域保留错误映射
  domains/
    image-compress/    输入、编码、文件网关、路由
    image-ai/          processing、product-image、history；manager 协调
    speech/            edge-tts、chatterbox、shared
    audio-library/     独立资产、副本、清单、恢复、串行提交
    content-archive/   core、providers/xiaohongshu、providers/douyin、compat/xhs
    lan-transfer/      乱序分片、续传、访客与管理边界
  system/lan-access/   跨模块共享局域网地址与入口
  database/            façade、迁移、行映射、审计、一致性与备份
  storage/ security/ lifecycle/ tasks/ runtime/
                       已有底层实现及稳定生命周期入口
  modules/components/  能力编排 façade 与已拆出的下载/归档/generation/job 适配
  modules/maintenance.ts
                       现有系统维护入口
```

上表是实际目录，不把计划示意中的每个未来目录创建为空壳。能力管理和诊断/runtime 等仍保留既有稳定落点；R05/R06 已拆职责，没有为目录外观额外迁移其公开 façade、生成签名目录或路径锚点。业务 modules 旧树已退役，不能往其中恢复图片、配音、归档或 LAN 实现。

应用装配可以组合领域，领域可依赖底层和明确端口；`core` 不反向依赖领域/系统。音频库通过只读 speech-source port 取得素材，仍保存独立副本；归档核心不反向依赖 XHS 兼容层。数据库 façade、领域队列和 manager 继续拥有原事务、并发及终态顺序，不建立通用 Repository、万能任务或上传状态机。

Fastify 插件作用域与注册顺序、SSE 结束后再关闭数据库、安装失败保留旧 generation、图片文件及记录完成后才公布成功，均是行为契约。不同路径信任边界、普通原子提交与带回滚替换不得合并为一个宽松工具。

## 前端与桌面所有权

前端采用 `app/` 装配和路由、`shell/` 导航与全局服务状态、`shared/` UI/HTTP/纯工具、`integrations/desktop/` 固定桥接，以及 `features/` 业务目录。speech 内含两种引擎与 shared，image-ai 内分 processing / product-image / history。跨 feature 使用明确 `integrations/` 出口，不读另一个页面的私有状态。

页面只组合；每个 composable 完整拥有一组状态、迟到请求处理、取消和卸载清理。Object URL 的创建与释放归同一所有者。配音 KeepAlive 状态、应用级音频播放器单例及播放保护不能移到页面生命周期。API 文件只做通信，偏好设置和展示映射单独归属。

样式入口保留 `tokens → foundation → components` 层级和全局加载顺序；`global.css` / `redesign.css` 是有序 import 清单。feature 分片不会改为异步或 scoped 加载；细节见 [R11 样式归属](refactoring/r11-style-ownership.md)。

桌面 `app/` 拥有应用级状态及唯一退出协调；`ipc/` 注册固定能力，`windows/` 拥有窗口，`backend/` 监督本应用子进程，`data/` 维护迁移恢复，`updates/` 管理受控更新，`security/` 校验来源。统一的 shared desktop 类型不扩大 preload 权限，不能暴露通用 invoke 或任意路径/进程控制。boot 重试不重建应用状态，退出不按端口或进程名误杀外部进程。

## 保留入口与旧路径分类

| 类别                                       | 保留原因 / 检查方式                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 公开脚本薄入口                             | 用户命令和 CI 调用继续有效；工程实现只有一份，新增运行依赖加入 `tooling/build/runtime-scripts.json` |
| 公共包与类型出口                           | 保留既有导入和 dist 消费，不能只依据相对导入数量判断无消费者                                        |
| Edge-TTS index、audio-library integrations | 仍有生产装配/跨功能消费者，是明确边界                                                               |
| XHS API、DTO 与页面重定向                  | 已有调用方的兼容层，复用归档核心，不是冗余业务副本                                                  |
| manager/store/database façade              | 状态与生命周期所有者；提取工具不意味着删除协调者                                                    |
| 分发资源与已发布包路径                     | 与用户已有安装兼容，不能按新源码目录重命名                                                          |
| 固定基线快照、旧路径测试夹具、历史报告     | 验证迁移或记录真实历史，允许出现旧名称；覆盖率旧路径仅显式兼容，不能掩盖新报告缺失                  |

退役的源码目录不能因为磁盘上还有被忽略的空目录/缓存就重新纳入 workspace。审计应使用受 Git 管理和非忽略未跟踪的现存文件，排除构建产物，不扫描用户媒体或把模型当重复代码。

## 新增或修改功能的步骤

1. 先读相关实现、测试和保留规则，检查工作区，明确修改所属领域；发现独立业务缺陷先登记并单独验收。
2. DTO / Schema 放入 `packages/shared/src/<domain>/`，保持浏览器安全；公共根出口和旧子路径仍兼容，不改变 optional、nullable、默认值或未知字段处理。
3. Node 跨应用的小型基础逻辑才进入 runtime-core；禁止 import 时启动服务、建目录或读取用户配置。领域状态留在领域，不做共享全局 store。
4. 在既有任务、文件提交、安全和持久化流程内扩展；前端保持 HTTP、请求作用域、任务事件、确认及选择工具。工程代码归相应 tooling 目录；Python 和签名包另行专项。
5. 用合成媒体、独立临时数据库、受控 Worker 替身补回归；删除/故障测试先证明目录归属。测试收集不得减少，不能用忽略/放宽超时和覆盖率完成验收。
6. 定向测试后执行类型、Lint、格式、架构、Knip、全量单元/脚本、Python 轻量验证、覆盖率、普通构建和受影响 E2E；命令见 [README](../README.md#开发与质量命令)。Node 全量可用 `pnpm check`，但它不包含浏览器 E2E、真实模型或安装包验收。
7. 差异覆盖率继续以固定开始基线执行 `node scripts/check-diff-coverage.mjs --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree`；需要所有相关 LCOV 先成功产出。全局 75%/65%、差异 90%、入口 150 KiB / 懒加载 75 KiB gzip 不降低。
8. 桌面源码验证使用 `pnpm --filter desktop build` 和 `pnpm --filter desktop test`。根 `desktop:build` 会暂存资源，`desktop:make` 会制作安装器，不能把它们当成普通 TypeScript 编译命令。专项检查另见 [R12 后验收](refactoring/post-r12-acceptance.md)。

架构门禁解析静态导入、字面量动态导入、require 和类型引用，当前跨应用豁免为零；它不是任意计算导入或完整运行时循环证明。Knip、生命周期测试、分发夹具与人工审查共同补充边界证据。
