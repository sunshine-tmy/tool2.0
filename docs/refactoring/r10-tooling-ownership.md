# R10：工程实现、公开入口与分发边界

本说明记录 2026-10-24 的代码归属，不代表安装包、macOS 实机或真实模型验收。

## 目录与所有者

| 位置                                | 职责                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `scripts/`                          | 保留已有公开命令入口；Worker Python、依赖锁、requirements、能力定义、生成资源清单保持原位置     |
| `tooling/source/`                   | Windows 初始化、开发启动/停止、诊断入口、原生库检查、资源清单生成、旧环境 setup 及清理实现      |
| `tooling/components/`               | 能力准备、组包、目录汇编、固定下载、平台锁生成及 Worker Python 版本策略；不存放真实签名包或密钥 |
| `tooling/build/`                    | 源码/standalone 归档、桌面资源 staging/打包/图标，以及明确的运行脚本分发清单                    |
| `tooling/quality/`                  | 架构、覆盖率、格式与分包预算检查；原 source-policy 和门槛保持不变                               |
| `tooling/testing/`                  | 构建/契约/布局冒烟、工程测试发现、安装验收脚本实现及现有 Python 测试 runner                     |
| `tooling/lib/process-discovery.ps1` | 四个经 token 审计等效的只读进程识别函数                                                         |
| `apps/desktop/scripts/`             | 保留五个公开工程入口与原安装冒烟单元测试；Electron 工具仍由此 workspace 解析                    |

52 个 Node 工程实现（47 个根脚本、5 个桌面脚本）、14 个 PowerShell 实现及一个 TypeScript 初始化实现归入 tooling。原公开文件继续转发参数、导出和 CLI 判断。15 个仅供构建内部调用、没有 CLI 主体或其他消费者的 `scripts/smoke-*-contract`/布局辅助包装已移除；实际实现位于 testing，由构建冒烟组合，不维护平行树。

`scripts/start-standalone.mjs` 继续作为已有独立运行时入口；`scripts/cleanup-message.ps1`、Python、锁文件、requirements 和能力 JSON 不迁移。原已很薄的 `test-python-workers.mjs` 继续委托现有 runner。

## 路径和命令保持方式

迁移实现显式定位原公开入口 URL 或 `$EntryScriptRoot`，保留原文件系统锚点、默认参数和 CLI 身份。不改用当前工作目录推算模型、缓存或用户数据。原本依赖 cwd 的命令也不在本轮更改语义。

Windows 公开入口保留原参数块、校验属性和命名参数转发。迁移后的 PowerShell 文件使用单个 UTF-8 BOM，保证 Windows PowerShell 5.1 读取中文源码；真实 5.1 解析、运行和无 Node 的 ZIP 预检由测试保护。`lock-worker-dependencies.ps1` 默认输出仍是原 scripts 目录。

Node/pnpm 固定版本和摘要以 `tooling/source/bootstrap-windows.ps1` 为权威；资源清单生成器读取这些明确赋值，拒绝缺失、重复或不合法的 pin。`scripts/source-resources.generated.json` 与下载文档继续由既有生成命令产出，当前内容不变。运行 PowerShell 的 Plan/ListResources 不需要 Node、Git、pnpm 或生成过程。

桌面 stage/package 的入口负责加载本 workspace 的 `@electron/rebuild` / `@electron/packager`，私有 `run` 接收固定工具。没有把 Electron 构建依赖提升到根工作区，也没有更新版本。Knip 显式声明这两项跨 workspace 调用的根工程入口；没有新增 ignore 或整体 tooling 排除。

## 进程策略不合并

共享 `Get-ProcessSnapshot`、`ConvertTo-NormalizedCommandLine`、`Get-PortListenerProcessIds`、`Get-ProjectTreeRootProcessId`。启动仍拥有原默认参数、强占端口、等待及退出策略；停止仍拥有服务标记、祖先进程保护、visited 去重及自己的进程树遍历。

原 `Contains(root)` 识别和 URL 解码行为保持原样，不在此阶段顺便改变进程信任边界。测试仅以合成进程表和替身 Stop-Process 核验所属/外部进程、当前 PID、重复监听者、祖先与子孙顺序；不实际终止用户进程。

## 显式运行时闭包

`tooling/build/runtime-scripts.json` 维护两组文件：

- maintenance：两个原 scripts 入口和两个 `tooling/source` 实现。
- workers：原位置的六个 Worker/生命周期 Python 文件，提供原来的运行时脚本能力；不修改签名能力包内脚本。

stage 通过 `copyRuntimeScripts` 逐文件复制这 10 项。安装资源仍叫 `backend`、`frontend`、`scripts`；增加的 `resources/tooling/source` **只含两个维护实现**，package 的 extraResource 显式携带这个小目录，不复制整个 tooling。清单/复制器本身只在构建端使用，不是运行时依赖。

隔离 API 测试夹具只复制 maintenance 闭包，以保留 Worker 缺失、替身进程等已有测试条件。独立分发夹具复制完整闭包，在无仓库数据、中文空格路径、外部 cwd 下实际执行列表、dry-run 和指定日志清理；永久图片 sentinel 保持不变。

清理分类、目标、风险标记、默认选项、YES 确认、白名单以及参考音色/音频库保护均保持原实现，不增加删除范围。

## 测试与 CI

`pnpm test:scripts` 委托 `scripts/test-scripts.mjs`，递归发现 scripts、tooling、apps/desktop/scripts 中的 `.test.mjs`。不执行普通 smoke 命令，不收集 Python/模型测试或桌面安装程序；跳过符号链接，空集合失败，转发 Node 测试参数及退出状态。`--list` 只列清单，不运行测试。

原 83 项工程测试全部保留；原来另行执行的架构 11、契约 4、Python runner 5、桌面安装冒烟脚本单元 7 也纳入主工程入口。独立命令仍保留供定向运行，CI 不再只靠手工列举几个脚本判断覆盖完整。

CI 的 Linux Node job 和新增 Windows source job 都执行自动发现入口，enterprise gate 要求 Windows job 成功；桌面安装验收的已有路径过滤包含 tooling，macOS 内部工作流也采用同一工程测试入口。这里只修改配置，未触发任何远程工作流、发布或安装包制作。

后续新增工程实现放入相应 tooling 目录；只有公开命令保留 scripts 薄入口。新增分发依赖必须加入运行闭包并通过独立夹具，不能以复制整个开发目录兜底。
