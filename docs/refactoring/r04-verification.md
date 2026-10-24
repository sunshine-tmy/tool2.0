# R04：已证实等效的重复实现提取

日期：2026-10-23。状态：DONE，仅 R04 完成，不代表全项目重构完成。固定基线 `55526abc4f67d04e99ba677b335c38b43b4584bb`；保留既有未提交改动，真实 Git 索引为空。按最新要求，本阶段完成后暂停，不进入 R05。

## 完成范围与归属

| 单元 | 实现与验证记录                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------ |
| A    | [SRT 时间纯函数](r04a-subtitle-time-verification.md)，保留单条/批次时长与换行差异                      |
| B    | [备份替换](r04b-file-replacement-verification.md)，包括最终 batch-queue 重复清理；持久提交网关独立保留 |
| C    | [批次字幕/双语片段](r04c-batch-subtitles-verification.md)，Edge-TTS 不再读取 Chatterbox 私有字幕实现   |
| D    | [文件名与下载头](r04d-speech-file-names-verification.md)，保留不同引擎/单条/批次规则                   |
| E    | [容量展示及 LAN 分类](r04e-presentation-verification.md)，保留不同精度/单位，模板和样式不变            |
| F    | [普通 JSON 临时替换](r04f-json-file-verification.md)，不改为 fsync 或备份策略                          |
| G    | [翻译失败事务内更新](r04g-translation-failure-verification.md)，归属/hash 保护仍在仓储回调中           |
| H    | [Worker HTTP 传输](r04h-worker-transport-verification.md)，错误映射、协议和串行范围仍由领域保留        |

新增 API 回归共 74 项、Web 回归 4 项；没有删除原测试、扩大排除范围或调整阈值。共享函数只保留一个实现，不新增无消费者 façade。最终复扫确认 Edge-TTS 已无 `../chatterbox` 私有引用；字幕时间、普通 JSON、配音下载头、备份替换、Worker 失败信封均各归一个实际所有者。

有意保留不同实现：应用通用下载头的换行/引号/反斜线规则、音频库 KiB 单位、AI 图片容量精度、单条配音文件名默认值、持久文件提交与备份替换。图片预取消与 Chatterbox 生成预检查也按原语义保留，未借提取增强规则。

## 验证命令与结果

- `pnpm coverage`：core 21、shared 130、API 815、Web 389 通过；API 原 6 项跳过不变。最终备份函数残留提取后再次执行整个 API coverage，815 通过、6 跳过，163.05 秒；测试收集未减少。
- `pnpm --filter backend exec vitest run ...`：翻译相关 52 项；Worker 33 项新测试加原客户端/会话共 45 项；最后备份故障及原配音共 25 项通过。
- `pnpm typecheck`、`pnpm lint`、`pnpm deadcode`、`pnpm lint:architecture`：通过，329 个生产/配置源码；原两条桌面诊断依赖债务未扩大。
- `pnpm test:contracts`、`pnpm test:architecture`：各 4 项通过，命令、冻结 Worker/Python/签名元数据未变。
- `pnpm test:scripts`：77 通过、1 项既有跳过；`pnpm test:python:runner` 5 通过；已有 `.venv-refactor-tests/Scripts/python.exe -m pytest` 8 通过，未安装任何依赖。
- `pnpm --filter desktop build`、`pnpm --filter desktop test`：main/preload 编译通过；95 单元、7 冒烟脚本单元通过。未运行 root desktop:build、stage、native rebuild 或安装包命令。
- `pnpm build`：通过，全部隔离构建冒烟通过，包括源码/分发映射、无 Git 的 ZIP、异 cwd、冷热启动、既有离线资源保留和商品图渲染。入口 gzip 151744 字节，小于原 153600 字节；懒加载原 76800 字节预算保留。
- `pnpm format:check`、`git diff --check`：通过；未降低全局 75%/65%、差异 90% 或体积预算。
- `node scripts/check-diff-coverage.mjs --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree`：560/572，97.90%；统计从固定开始基线到当前全部未提交重构，而非只统计最后一单元。Worker 传输 45/45、翻译提取 20/20、备份替换 20/20、JSON 写入 8/8；无缺失 LCOV 的静默跳过。使用临时索引，不改真实暂存区。
- 隔离 `pnpm test:e2e`：5 项全部通过，20.0 秒；按 Playwright 技能复用既有测试，包含 live/ready、LAN 分片续传/批量删除、双语配音产物、归档重试与取消终态。未扩充模型依赖或真实任务。

本次 E2E 进程专用根为 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r04-final-e2e-31eb55207c8048a3bc6bc977a2aef706`，临时设置 TEMP/TMP 与 TOOLBOX_LEGACY_DATA_ROOT，结束后恢复进程环境。保留该合成测试目录，不绕过此前临时目录清理限制，不清理用户资源。

## 不变边界、独立事项与暂停点

API/页面地址、273 条路由契约、公开命令、包名、数据与清单格式、能力包及签名、引用文件保留、成功结果长期留档、删除/恢复和文件提交顺序均不变。不读取私钥，不清理用户数据，不新增模型、Python 依赖、功能或框架。

独立未修复事项：B05 桌面开发静态资源根；B07 既有配音测试提前失败时应用清理。C02 已落实为区分持久提交与备份策略，并合并真正相同的两个备份实现。没有把既存问题或不同策略静默修正。

尚未验证：真实模型推理、能力环境 Worker 专项、macOS 实机、Windows/macOS 干净电脑与最终安装包级验收。无提交、推送、发布或签名包重建。

本阶段已通过并暂停。R05–R12 尚未实施：后端装配/配置/数据库、能力管理器、业务领域结构、前端复杂状态、桌面编排、工程脚本/CI、样式等效整理及全项目最终收口。恢复时先核验工作区，再按原子任务进入 R05；本轮没有提前开展。
