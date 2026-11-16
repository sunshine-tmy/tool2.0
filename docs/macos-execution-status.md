# macOS Apple Silicon 实施执行台账

> 执行依据：[Apple Silicon 全功能适配计划](macos-apple-silicon-implementation-plan.md)。只记录已核实事实；模型输出、人工画质、登录样本和安装结果未实测时均保持未验证。

## 当前基线

- 计划文档版本：1.0；计划代码基线：`78e714a486f6372b08af65c90f066682b3108dbb`。
- 当前 checkout：`main` / `413fa1c5759e76dd8d94b05d1ac8b326d7fbedc9`（`优化传输`）；M00-01 初始检查时工作区干净，之后的计划改动均保留且未提交。
- GitHub 最新代码核验（2026-11-16）：`git ls-remote origin refs/heads/main` 确认远端为 `413fa1c5759e76dd8d94b05d1ac8b326d7fbedc9`，随后 fetch 并以 `git merge --ff-only origin/main` 快进了原来落后 1 个提交的本地 `main`。更新提交改动 5 个 LAN/desktop 文件，与当时 140 个跟踪文件修改及 99 个未跟踪文件无路径重叠；更新前后工作区均为 206 个变更条目，无暂存变更，原有改动保留。受影响回归通过：API 3 文件 35/35，web LAN transfer 12 文件 27/27；frontend 与 backend typecheck 均通过。详见 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M00-01-github-sync-latest-main-20261116.json`。
- 基线关系：`HEAD~3` 精确等于计划基线。基线到当前 HEAD 共 3 个提交：`d192c9e` 增加本计划并更新 README/旧 Mac 指南；`6972f58` 增加局域网列表同步和对应测试；`413fa1c` 优化局域网接口筛选/优先级、传输分片限流与分享地址选择，并将 desktop 版本更新至 1.0.11。仓库 Git 历史仍为浅克隆。
- 当前源代码入口按计划第 3 节核对：M00 基线时 Mac 生成目录为空、依赖锁只有 5 组、视频准备器只允许 Windows；M03-01 已新增十个独立 Mac 定义、六组哈希锁和原生准备器。M01 验证 bundle 继续保持 `adapterReady:false`；Mac 生产支持定义仅在 M01/M04 验收完成后声明 STTN MPS 与 ProPainter Hybrid FP16 可用。正式签名能力包和应用嵌入 catalog 已在 M03-04 完成 tag01 线上安装验收。Chatterbox Worker 已支持显式 CPU/CUDA/MPS 请求，MPS 经 M01-03 完整推理验证；STTN 与 ProPainter 均经固定权重、合成视频和正式 Worker 路径完成 MPS 计算验证，用户已接受 STTN 真实样本和 ProPainter Hybrid FP16 画质，并接受后者约 28.5 分钟耗时。ProPainter 显式使用 deform-conv 与 fold/col2im 两个 CPU 岛。图片 AI 画质已通过 F02 验收；Chatterbox 三语 MPS 听感已在 M05-02/F03 通过人工验收；API/UI 设备契约已完成 M04-01。
- 范围：目标为 Apple Silicon、macOS 14+、16 GB 验收基线和 13 个业务模块；按计划规定的修正顺序执行。保留 Windows 行为、算法/输入契约、非商用限制、现有用户数据和安装代际；不新增业务模块，不自动提交、推送、发布或制作安装包。

## M00-01：重新核验工作区和入口

任务：M00-01
状态：完成
依据：HEAD `6972f58cd668fbf8b2e2f9040d4ae60d3fc8ee44`；工作区干净；Apple M1 / macOS 15.6.1；代码差异见上方基线关系。
完成内容：读取本计划与旧 Mac 构建指南；核对根脚本及各 workspace scripts、桌面构建/资源暂存、能力目录与生成规则、Mac 依赖锁、FFmpeg/视频能力准备器、序列资源清单与 bundle、模型验证脚本、Worker 入口、共享配音契约、桌面能力解析和生命周期入口及对应测试清单。未修改业务代码。
改动范围和保持不变的契约：本任务只新增执行台账；未触碰 `.env`、用户数据、模型、已安装能力或工作区外文件。没有改变平台、API、Worker 协议或 Windows 行为。
执行命令、退出码、用例数量、报告位置：执行 `git status --short --branch`、`git rev-parse HEAD`、`git diff --check` 和计划第 2.2 节主机诊断命令；只读核对退出码均为 0，`sysctl.proc_translated` 返回 `0`。本项未运行测试；诊断事实在“主机与现有安装”记录中。
真实模型与人工验收：未进行。
失败/跳过/未验证及原因：pnpm 主机版本与仓库钉定版本不一致（见主机记录）；未进行依赖安装、模型下载、推理或 DMG 构建。基线 commit 起初不在浅克隆对象中，已只读加深到它并核实 `HEAD~2` 相等。
下一任务与前置条件：M00-02；M00-01 初始检查时工作区干净，后续实施改动保留在当前工作区。

最新代码同步补录（2026-11-16）：按用户最初的 GitHub 同步请求重新检查 origin/main，发现远端新增 1 个提交。确认与全部未提交路径无重叠后执行 fast-forward，不 stash、丢弃或提交现有修改；随后回归新增 LAN quota/interface/share URL 影响范围的 API 与 web 用例，分别 35/35、27/27 通过，frontend/backend typecheck 均退出码 0。Git 同步与回归报告：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M00-01-github-sync-latest-main-20261116.json`（SHA-256 `e9b27e39d62e9e6f3d5352b162500fcdf8891372d0a76e3cde543af14b45329c`）。

## 主机与现有安装

| 项目             | M00-01 实测                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 架构 / 芯片      | `uname -m=arm64`；`machdep.cpu.brand_string=Apple M1`                                                                                      |
| macOS            | 15.6.1，build 24G90                                                                                                                        |
| 内存             | 17,179,869,184 bytes（16 GiB）                                                                                                             |
| Rosetta 翻译     | `sysctl.proc_translated=0`                                                                                                                 |
| Node             | `darwin-arm64 v24.18.0`，符合仓库 Node 24 范围                                                                                             |
| pnpm             | 主机默认 `11.25.0`；已用 Corepack 固定执行仓库要求的 `11.7.0`                                                                              |
| Xcode 命令行工具 | `/Library/Developer/CommandLineTools`                                                                                                      |
| 安装应用 / 数据  | `/Applications/EcommerceToolbox.app`、`~/Applications/EcommerceToolbox.app`、`~/Library/Application Support/EcommerceToolboxData` 均不存在 |
| 运行进程         | 进程名检查未发现 EcommerceToolbox、项目 Worker、Python 或 FFmpeg 进程；命中的是 macOS `fontworker` / `mdworker_shared`                     |
| 本地验证资源目录 | `.package`、`.runtime` 当前均不存在；没有本地 Mac 模型/能力安装可复用                                                                      |
| 凭据文件         | 仅检查 `.env` 是否存在，当前不存在；未读取凭据内容                                                                                         |

## 修正后的阶段顺序与原子任务状态

顺序：M00 → M09-A → M02-01 → M01 → M02-02 → M04 → M03 → M05 → M06 → M07 → M08 → M09-B → 最终逐项审计。M01 的 MPS/CPU/混合结论未通过前，不制作完整能力目录或开放高级档位。

| 任务     | 状态                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| M00-01   | 完成                                                                                                                          |
| M00-02   | 完成                                                                                                                          |
| M09-A01  | 完成                                                                                                                          |
| M09-A02  | 完成                                                                                                                          |
| M02-01   | 完成                                                                                                                          |
| M01-01   | 完成                                                                                                                          |
| M01-02   | 完成                                                                                                                          |
| M01-03   | 完成                                                                                                                          |
| M01-04   | 完成                                                                                                                          |
| M01-05   | 完成                                                                                                                          |
| M01-06   | 完成                                                                                                                          |
| M02-02   | 完成                                                                                                                          |
| M04-01   | 完成                                                                                                                          |
| M04-02   | 完成                                                                                                                          |
| M04-03   | 完成                                                                                                                          |
| M04-04   | 完成                                                                                                                          |
| M03-01   | 完成                                                                                                                          |
| M03-02   | 完成                                                                                                                          |
| M03-03   | 完成                                                                                                                          |
| M03-04   | 完成（tag01 审计、十项在线安装及同轮离线导出/导入、重启复核通过）                                                              |
| M05-01   | 完成                                                                                                                          |
| M05-02   | 完成                                                                                                                          |
| M05-03   | 部分完成（F07-05 暂缓）                                                                                                       |
| M05-04   | 完成                                                                                                                          |
| M06-01   | 完成（Cmd+M/Cmd+W、原生最小化、Dock/状态栏恢复、全屏、播放中退出保护及播放中隐藏/恢复均已验） |
| M06-02   | 部分完成（进程回收、文件选择/临时保存及同网手机 LAN 图文和图片上传下载已验；防火墙提示仍待验）               |
| M07-01   | 部分完成（自动回归通过；Computer Use 授权并可读取 Finder/应用，真实键盘与触控板人工验收仍待完成）                             |
| M07-02   | 部分完成（基础手机图文/图片传输已验；后续功能测试按用户要求暂停，待用户桌面端逐项验证）                                                                              |
| M08-01   | 完成（76 项备份回归通过；临时挂载 APFS 卷上的路径与恢复回归通过）                                                             |
| M08-02   | 部分完成（真实包隔离导入与抽样再编辑通过；CUDA 历史样本为 0）                                                                 |
| M09-B01  | 完成（macOS `.command` LaunchServices 冷启动、10/10 离线自检、HTTP 200 健康检查及正常停止通过；未声称物理双击或可视画面验收） |
| M09-B02  | 部分完成（全 workspace 构建、原生模块、staging、Electron ABI smoke 和目录 `.app` 构建通过；未制作 DMG）                       |
| M09-B03  | 未开始                                                                                                                        |
| 最终审计 | 未完成（2026-11-16 已按计划 §8.1 核对 7 项；未满足项及证据见文末）                                                            |

## M00-02：冻结功能、资源和样本矩阵

任务：M00-02
状态：完成
依据：计划第 6 节 18 组用例；`.package/macos-validation/20261109T085328Z-e00daf0c/cases.json`；对应资源与样本摘要见同目录 `environments.json`。
完成内容：把 F01–F13、F07-E、F07-L、S01–S03 展开为 128 项独立检查；逐组指定合成、人工只读媒体、联网/登录、物理设备或人工听感/画质样本类别；为每组预留报告路径。记录仓库 Windows 目录 12 个能力版本、Mac 目标 10 个 ID、模型/源码/依赖锁 SHA-256，以及历史成功媒体属性。准备了 `host.json`、`environments.json`、`cases.json` 和隔离的 `reports/`、`logs/`、`media/`、`storage/`、`temp/` 目录。
改动范围和保持不变的契约：只新增本台账及 `.gitignore` 已忽略的验证目录；未复制用户媒体、下载模型、改能力目录、安装/修改业务数据或改源代码。所有报告 SHA-256 在真实报告产生前为 null。
执行命令、退出码、用例数量、报告位置：用 Node 验证 18 组、128 项无重复检查、18 个唯一报告路径及 9 个资源 SHA-256；验证退出码 0。`git diff --check` 退出码 0。没有运行功能测试；报告预留在 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/`。
真实模型与人工验收：未进行；Mac 模型输出和人工判断保持 `not_run`。
失败/跳过/未验证及原因：未连接 Windows 设备，故 Windows 已安装版本待 Windows 验收；这里只记录当前仓库生成目录中的版本。历史媒体样本引用 [多媒体归档历史记录](multimedia-archive-validation.md)，只作候选属性、不作本轮验收，原媒体当前不在本机。视频能力 definition 与 Windows 生成目录版本存在两项差异：`video-ai` 与 `video-ai-cuda` 均相差一个小版本，已登记供后续资源制作阶段核查。
下一任务与前置条件：M09-A01；主机为原生 Apple Silicon 且已具备 Xcode Command Line Tools，先将 pnpm 固定为 11.7.0，再按计划执行冻结安装与原生依赖检查。

## M09-A01：原生工具链和源码基线检查

任务：M09-A01
状态：完成
依据：HEAD `6972f58cd668fbf8b2e2f9040d4ae60d3fc8ee44`；Apple M1/macOS 15.6.1；详细机器报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-A01.json`，SHA-256 `f394d98e78a5d1067fc0ad0bf775fc18f4434ed094f343c4424e80f8d7edecb7`。
完成内容：用 Corepack 执行 pnpm 11.7.0；`install --frozen-lockfile` 成功，安装 780 个包且 lockfile 未变。better-sqlite3 3.53.4 完成内存库写入/读取，Sharp 0.35.4 / libvips 8.18.6 完成 1×1 PNG 生成/读取。完成计划第 7 节门禁及 API、web、desktop workspace 基线；为递归测试遇首个 workspace 失败即停止的行为，分别补跑了 web、desktop Vitest 和 desktop node:test smoke。仅为 deadcode 检查本地构建 shared/runtime-core 包，不是产品或安装包构建。
改动范围和保持不变的契约：不改业务源码、lockfile、用户数据、`.env`、模型或 Mac 能力；未制作应用或安装包。安装依赖与生成的 `node_modules`、shared/runtime-core `dist` 位于 Git 忽略目录；tracked 项目文件没有改动，台账为唯一未跟踪工作区文件。
执行命令、退出码、用例数量、报告位置：`test:scripts --list` 退出码 0，发现 29 个测试文件；`format:check` 退出码 1（4 个既有归档 Vue 文件未格式化）；`lint`、`lint:architecture`（582 个源码通过）、`deadcode`（先本地生成共享包 dist 后通过）和 `typecheck` 均为 0。短规范 TMPDIR 下 `pnpm test` 在 API workspace 结束：145 文件通过、4 失败、4 跳过；1814 项通过、20 失败、64 跳过。`test:scripts`：159 通过、7 失败、26 跳过；`test:python:runner`：6 通过。web 独立运行：141 文件通过、6 失败；992 项通过、20 失败，另有 1 个未处理异常。desktop 默认脚本因 Vitest 发现 node:test 文件而失败；直接 Vitest：27 文件通过、4 失败，180 项通过、5 失败、2 跳过；独立 desktop smoke：7 项通过。`git diff --check` 退出码 0。完整日志在 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/`。
真实模型与人工验收：未进行；`environments.json` 保持 `modelValidation: not_run`，未下载模型、准备 Python AI 环境或启动应用。
失败/跳过/未验证及原因：基线失败已按报告分类保留，没有修无关代码。主要为四个既有格式问题；API 中 Chatterbox 请求前置和 Mac Python fixture、缺失 ffmpeg、路由清单漂移；脚本中的 Windows-only CUDA、能力包/锁 fixture 与来源摘要断言漂移；web 组件断言和一个配置未处理异常；desktop 的 Windows 路径/资源、应用装配和 updater fixture，以及默认脚本的 Vitest/node:test 发现冲突。Windows 安装态、真实模型、网络/登录媒体和 GUI 验收仍待后续阶段或对应设备。
下一任务与前置条件：M09-A02；原生 arm64 Node 24、Xcode Command Line Tools 和冻结的 workspace 依赖已就绪。验证入口必须先支持 `--help` 和严格参数测试，预检不能触碰网络、模型、应用或业务数据。

## M09-A02：为 M01 准备可复现验证入口

任务：M09-A02
状态：完成
依据：计划 M09-A02 验收要求；实现和定向报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-A02-tooling.json`，SHA-256 `b521b02300739b4fd045a8a9df7f4d99bb484d2ebb2baf95ab73d1079b95e787`；改动源码摘要由验证入口在每次运行写入 `runnerSourceSha256`。
完成内容：新增公开命令 `pnpm validate:macos`、`--help`、严格参数解析、Node 24/macOS 14+/arm64/Python 3.12 原生架构检查、资产清单与逐文件 SHA-256 检查、只接受全新输出目录的预检和 JSON 报告。Python case 单进程隔离运行，限制 stdout/stderr、可调超时、SIGINT/SIGTERM 取消及直接子进程 RSS 采样。首个 case `M01-01-python-runtime` 只检查 SSL/SQLite、内存数据库往返和无 pip venv，不加载模型。新增 `docs/macos-runtime-validation.md` 使用指南。
改动范围和保持不变的契约：仅新增根脚本注册、验证工具/测试、Python stdlib 探针和指南；未修改业务 Worker、能力目录、模型、`.env`、应用数据或用户媒体。预检只写入显式指定的新输出目录，不下载/安装/加载模型、不启动应用。退出报告固定为 `modelValidation: not_run`，不作为推理或画质验收。
执行命令、退出码、用例数量、报告位置：定向测试 `node --test tooling/testing/macos-runtime.test.mjs` 退出码 0，17/17 通过，覆盖 `--help`、参数、平台/版本、缺失资产、错摘要、路径逃逸、缺解释器、旧输出、子进程成功/非零/输出截断/超时/取消和 `modelValidation`。`test:scripts --list` 退出码 0，30 个测试文件；全量 `test:scripts` 退出码 1（176 通过、7 失败、26 跳过），7 个失败与 M09-A01 记录的基线一致。`lint`、`lint:architecture`（582 源）、`deadcode`、变更文件 Prettier 检查、Python AST 语法检查、公开命令 `--help` 与 `git diff --check` 均为 0。日志见同目录 `logs/test-macos-runtime-final.log`、`logs/test-scripts-m09a02-final.log` 和 `logs/test-scripts-list-m09a02-final.log`。
真实模型与人工验收：未进行；没有 Python 3.12 环境，主机仅有 Python 3.9.6，故没有实际执行本机预检或 case。合法预检行为由测试夹具验证，报告明确为 `modelValidation: not_run`；M01-01 会准备 Python 3.12 后再做原生预检和 SSL/SQLite/venv 检查。
失败/跳过/未验证及原因：全量脚本测试保留 7 个既有能力包/错误顺序/来源摘要断言失败。当前只注册 Python runtime case；媒体与模型 case 将随 M01 加入并要求显式输入/掩码或验证过的合成夹具。RSS 是 macOS `ps` 直接子进程采样；MPS 峰值为空，真实模型性能与用户质量判断待 M01。
下一任务与前置条件：M02-01 已完成，进入 M01-01；Xcode Command Line Tools、Node 24 和依赖基线可用。

## M02-01：固定外部编码库与构建配置

任务：M02-01
状态：完成
依据：计划 M02-01；Apple M1 / macOS 15.6.1；源码锁 `tooling/components/macos-media-sources.json` SHA-256 `979820184858901ea4e099f127cc53b96bb3b3043a2573281104e2ebd8b23820`；机器报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M02-01.json` SHA-256 `33c4264e1f9362564711076c7cd774073bf1cce47f45d308cafd343a976c07f4`。
完成内容：新增固定 FFmpeg 8.1.2、x264 commit `0480cb05fa188d37ae87e8f4fd8f1aea3711f7ee`、LAME 4.0、libogg 1.3.6、libvorbis 1.3.7、libopus 1.6.1 的源码锁和许可证记录。准备器以独立 `DESTDIR` 构建外部媒体库静态链接的 arm64 FFmpeg/FFprobe，关闭自动探测，仅使用本地 pkg-config 前缀；PNG 透明叠加所需 zlib 显式链接 macOS 系统库。构建支持中文和空格输出路径，并把临时构建路径从 provenance 中移除。
改动范围和保持不变的契约：新增 `tooling/components/prepare-ffmpeg-component.mjs` 的 Mac arm64 构建、审计与 smoke 流程，保留既有 Windows PowerShell 准备器不变。没有安装系统库或借用 Homebrew 媒体库；Homebrew 仅提供 pkg-config 工具。候选 stage 位于 `.package/macos-validation/20261109T085328Z-e00daf0c/media/FFmpeg macOS arm64 验证/`，包含 ffmpeg、ffprobe、源码锁、构建 provenance、能力清单、9 份许可证/NOTICE 和 smoke 结果。
执行命令、退出码、用例数量、报告位置：`pnpm components:prepare-ffmpeg -- --stage '.package/macos-validation/20261109T085328Z-e00daf0c/media/FFmpeg macOS arm64 验证'` 最终退出码 0；arm64、`lipo`、`otool -L`、`LC_BUILD_VERSION minos 14.0`、构建配置路径和能力清单审计通过。ffmpeg SHA-256 `f47a8ffd2d3110d1b3c0a4cfa1bf72973f0d7ce8432a2af56bc61e8c9407aa72`，ffprobe SHA-256 `89f24747ebef1def4820fefbe68cd3fdf289d9f3f5ea08644e2076dca6427867`；H.264/AAC MP4、MP3、Vorbis Ogg、Opus Ogg 合成编码/读取 smoke 全部通过。`node --test tooling/components/prepare-ffmpeg-component.test.mjs` 10/10 通过；`git diff --check` 退出码 0。最终日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/m02-01-build-final11.log`。
真实模型与人工验收：不适用；本项只有候选工具和合成媒体 smoke，不作为 M01 模型或 M02-02 真实业务媒体验收。
失败/跳过/未验证及原因：前两次构建被审计发现并修复：一次是 `otool` 文件名首行被误认成临时路径引用；另一次发现关闭自动探测时 PNG decoder 缺少 zlib 依赖。对应日志保存在同 run `logs/m02-01-build-final9.log` 和 `final10.log`；最终构建通过。M02-02 仍未执行。
下一任务与前置条件：M01-01；使用既有固定 Python 3.12 下载/校验准备器，生成 macOS 平台依赖锁并在验证目录为图片、配音、视频分别创建环境。

## M01-01：原生 Python 与依赖闭包

任务：M01-01
状态：完成
依据：计划 M01-01；依赖 M02-01 已完成；Apple M1、macOS 15.6.1、Node 24.18.0；固定 Python 3.12.14 arm64 和 uv 0.13.7。Paddle OCR 依赖采用 PaddlePaddle 3.0.0：实测更新候选 wheel 内的 `libcommon` 最低系统版本为 macOS 14.5，不符合本项目 macOS 14 基线；3.0.0 随附原生库最高 `minos` 为 14.0，且符合 [PaddleOCR Quick Start 对 PaddlePaddle 3.0+ 的要求](https://paddlepaddle.github.io/PaddleOCR/main/en/quick_start.html)。
完成内容：Python 运行时 case `M01-01-python-runtime` 通过。为 image-ai、chatterbox、video-ai 建立了三个独立 Python 3.12 环境，共锁定 309 个 wheels、1,144,437,446 字节；每个环境的 `pip check` 均为 `No broken requirements found`，组件导入探针全部通过，且未启用用户 site-packages。共审计 1,292 个 Mach-O 对象，均包含 arm64、最低系统版本不高于 macOS 14.0；视频环境修复 141 个 wheel load command，图像环境修复 1 个，配音环境无须修复。图像和视频环境均实际加载了 Paddle `libblas.dylib` 与 `liblapack.dylib`。BasicSR 1.4.2 和 antlr4-python3-runtime 4.9.3 均从固定源代码构建，两次构建所得 SHA-256 分别一致：`4a9af5771dfdaa9852fc02f9d22fe25cb5fe5e2ae68d14cfec351e6490fab312`、`c58068bafb119566be88d8877a36794c96d52da62e50a1dc3a345ecdfdf955f3`。
改动范围和保持不变的契约：新增 Mac 专用 requirements、Python/uv 固定工具链、Mac arm64 锁文件生成器、AI 环境准备器、原生库审计与验证工具；为 Paddle 的 BLAS/LAPACK 运行时随包提供带许可证的 OpenBLAS，并规范化 wheel 中的动态库引用。所有 Python 环境均隔离且不使用系统 site-packages；没有修改 Windows requirements、用户模型或应用数据。
执行命令、退出码、用例数量、报告位置：源码指纹变更后重跑的 Python runtime case 状态为 `pass`、退出码 0，详见 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-01-python-runtime-rerun-after-image-ai/report.json`（SHA-256 `aab884ef41d2805d31e74acde5f0be6593abb8e0c5f7def27b2fddd3b61aae0e`，新 runner 源码 SHA-256 `593e43a0aec544038b5d5cd12cb2e80ab30d7281b86a891f70b1f4c71b7c2aeb`）。更新后的环境汇总报告为 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-01-python-environments-rerun-after-image-ai.json`（SHA-256 `400b74055ed9febfb4bd0c11409324b5cec820352c99612fa3ee5ca4c270fe34`）；逐环境清单：image-ai `python-environments-macos-paddle300/MANIFEST.json`（SHA-256 `e51e7a9dfa55943f41ae16c5b02a7f8ba9d8ac0631ea5bdfd03eb835a49bb1e7`）、chatterbox `python-environments-chatterbox-final/MANIFEST.json`（SHA-256 `b0f3907435236973919f93cded210cb11e7a07d1a0192956057693237aa49712`）、video-ai `python-environments-video-paddle300/MANIFEST.json`（SHA-256 `67ff777dd3cbda772cb7959a8e925f89cd711894e70ea0790d16ba0f2d39d5cc`）。`node --test tooling/components/prepare-macos-ai-environments.test.mjs`：11/11 通过；`node --check`、Prettier 和 `git diff --check` 通过。此前聚合报告留作历史记录。
真实模型与人工验收：未进行；所有环境清单及 Python runtime case 明确记录 `modelValidation: not_run`。模型推理质量、MPS/CPU 能力和峰值 MPS 内存不属于本项结论。
失败/跳过/未验证及原因：准备过程中发现并修复了 Paddle wheel 的系统版本门槛、OpenBLAS/GCC 动态库引用、wheel 重叠 RECORD 所有权及模块探针名称等问题；早期失败候选目录保留在同一验证 run 以供追溯，最终使用的三个清单均通过。依赖环境闭包本身已经完成，不表示模型或 MPS 能力已验收。
下一任务与前置条件：M01-02、M01-03 已完成；进入 M01-04，先核对固定 STTN 资产来源、原始推理入口和当前视频处理契约，再在隔离验证路径实现真实模型探针。

## M01-02：图像与 OCR 真实推理

任务：M01-02
状态：完成
依据：计划 M01-02；前置 M01-01 已完成；当前 HEAD `6972f58cd668fbf8b2e2f9040d4ae60d3fc8ee44`，Apple M1/macOS 15.6.1；固定权重与 SHA-256 来自 `tooling/components/prepare-image-ai-component.mjs`。
完成内容：在 `.package/macos-validation/20261109T085328Z-e00daf0c/assets/M01-02-image-ai/` 生成固定合成商品图、OCR 图和修复 mask；16 项资产 manifest 与 source provenance 验证了 2×/4× Real-ESRGAN、Big-LaMa、BiRefNet、6 个 PaddleOCR 模型文件、样本、图像环境锁/清单和来源记录。模型摘要全部匹配代码固定值；PaddleOCR 的官方 Paddle 3.0.0 det/rec 归档分别为 4,935,680 与 16,834,560 字节，其解包文件 SHA-256 与代码固定值一致。两份 Hugging Face 镜像的文件 SHA-256 与固定上游完全相同： [Big-LaMa 镜像](https://huggingface.co/uwg/modelz_base/blob/main/big-lama.pt)、[BiRefNet 镜像](https://huggingface.co/Jay0515/BiRefNet/blob/main/BiRefNet-general-epoch_244.onnx)；实际来源和固定上游均记录在 `source-provenance.json`。
改动范围和保持不变的契约：新增 M01-02 CPU 模型探针、确定性合成样本生成器、manifest/provenance 生成器和显式验证文档/测试；未修改业务 Worker、Windows 行为或用户数据。模型、合成输入与运行产物限定在 `.package/macos-validation/20261109T085328Z-e00daf0c/`。背景移除沿用 commercial 配置使用 BiRefNet，不启用仅供 internal-noncommercial 的 BRIA。
执行命令、退出码、用例数量、报告位置：`node --test tooling/testing/macos-runtime.test.mjs tooling/image-ai/create-macos-validation-manifest.test.mjs`：22/22 通过；Prettier、`node --check`、Python `py_compile` 通过。模型验证命令 `pnpm validate:macos --case M01-02-image-ai ... --timeout-ms 3600000` 退出码 0；汇总报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-02-image-ai-complete-run1/report.json` SHA-256 `0838f09146189cf38037164fdff9a52ce761846b63e84479ede100ad319e1897`，探针结果 SHA-256 `7fe74fdcc60f624cae1cce82fbc5efd1e23afd9ec9b3c8c83ab72dc2b8d530c6`。资产 manifest SHA-256 `f370dc54677647dd5644f1bfa93f69a57da71d5515bfd2b5b967eb73c4108dfd`；source provenance SHA-256 `3a8cdcb8fa279ca6de499d0de4e494422428c56bab811d248c7a2fee5ca01f11`。另在 Real-ESRGAN 2× 执行期间受控发送 SIGINT，报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-02-image-ai-cancel-run1/report.json` SHA-256 `e836c3f3af6528bf1bd08b254ffcda6800d1821478c5aa82a1a00f502577570d`，状态 `blocked/modelValidation: blocked`，峰值 RSS 3,106,209,792 字节，子进程组退出。
真实模型与人工验收：CPU 推理状态 `pass`，完整运行用时 490,636 ms，峰值 RSS 5,741,412,352 字节。包版本：PyTorch 2.6.0、TorchVision 0.21.0、PaddlePaddle 3.0.0、PaddleOCR 3.7.0、Real-ESRGAN 0.3.0、rembg 2.0.84、ONNX Runtime 1.23.2、Pillow 12.3.0。PaddleOCR 检出 3 个文本框并识别 `SALE`、`128`、`COFFEE`（525 ms）；Big-LaMa 输出 512×512 RGB（6,193 ms）；Real-ESRGAN 2× 输出 1024×1024（58,048 ms），4× 输出 2048×2048（353,971 ms）；BiRefNet 输出 512×512 RGBA、alpha extrema `[0,255]`（49,516 ms）。Worker 模型引用和推理锁释放检查全部通过。以上是合成样本的模型运行证据；人工画质判断仍为 pending，留待 F02 验收。
失败/跳过/未验证及原因：一个第三方 Big-LaMa 副本与固定 SHA-256 不符，已拒绝并清理；随后使用摘要完全一致的镜像。Hugging Face 直连曾超时，已用可达镜像完成同内容权重获取。安装 aria2 1.37.0_3 仅用于本机验证下载。没有执行商业/非商业之外的模型配置，也未进行人工画质确认。
下一任务与前置条件：M01-03 已完成；进入 M01-04，使用固定 STTN revision 和独立视频环境验证 encoder、时序 attention、decoder 及原尺寸分块组装。

## M01-03：Chatterbox CPU / MPS 真实推理

任务：M01-03
状态：完成
依据：计划 M01-03；前置 M01-01、M01-02 已完成；Apple M1 / macOS 15.6.1 / 16 GiB；Chatterbox 源码 commit `65b18437192794391a0308a8f705b1e33e633948`、模型 revision `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`。
完成内容：固定四份 Chatterbox 权重、源码归档、运行环境锁/清单及三种合成参考音频均已记录 SHA-256。运行探针分别通过 CPU 与原生 MPS 的马来语、英语、巴葡生成；验证实数/复数张量迁移与计算、模型参数设备、Worker 采样、TorchAudio WAV 写入及解码、有限值/非静音/有效时长、引用和推理锁释放。实测 MPS 模型参数位于 `mps:0`，且关闭 PyTorch MPS CPU fallback。Worker 已接受显式 `mps` 请求；MPS 不可用时返回 `CHATTERBOX_MPS_UNAVAILABLE`，不会静默回落 CPU；卸载时同步并清理 MPS cache。自动设备仍保持原 CPU/CUDA 选择。
改动范围和保持不变的契约：新增 `tooling/chatterbox/` 的样本、manifest/provenance 生成工具、真实 CPU/MPS 探针及验证文档；扩展 `scripts/chatterbox-worker.py` 的 MPS 请求、可用性、健康状态和缓存释放；补充 Worker 单测。未改 Windows CPU/CUDA 路径、默认设备、MPS UI/API 契约或用户音频。API/UI 的完整设备选择、健康解析及历史数据兼容按计划留在 M04-01。
执行命令、退出码、用例数量、报告位置：最终真实模型命令 `pnpm validate:macos --case M01-03-chatterbox ... --timeout-ms 3600000` 退出码 0，报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-03-chatterbox-run6/report.json` SHA-256 `4341f3cf550dbb6e6a1d437abc19603dd89ead081e126917c9e4933249176926`，探针结果 SHA-256 `df8cfef07cd52ce358f3586da14f73a9ae672470aac630aa83966798bbc3dfe6`；资产 manifest SHA-256 `812cad5707a2a0dfb53034bfc78a80f264a3b43d0f2ce7c297524098425b92d7`。真实模型执行 233,950 ms，峰值 RSS 5,896,093,696 字节；MPS 状态 `pass`，Worker 请求 schema 支持 MPS，释放检查全部通过。2026-11-16 又通过正式安装 Worker 完成独立英文 MPS 内存采样（57 字符文本、4.16 秒输出，100 ms 间隔、516 个样本，覆盖模型加载和推理）：MPS driver allocation 峰值 10,765,238,272 字节，MPS 当前张量分配峰值 3,515,421,952 字节，Worker 峰值 RSS 3,125,657,600 字节。该采样只覆盖英文短样本，不代表三种语言或整机统一内存峰值。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-03-chatterbox-mps-memory-20261116/report.json` SHA-256 `04f4e2bb7c902c506bb63fdc45928ed4a539bfc9cfa1c85281c8fd1d9dcb9e04`。包版本：PyTorch/TorchAudio 2.6.0、Transformers 5.17.0、safetensors 0.8.0、NumPy 1.26.4、librosa 0.11.0、diffusers 0.38.0、resemble-perth 1.0.1，Chatterbox 源码 commit 如上。`python scripts/chatterbox-worker.test.py`：18/18 通过；`node --test tooling/testing/macos-runtime.test.mjs tooling/chatterbox/*.test.mjs`：26/26 通过；Prettier、Python AST、`git diff --check` 均通过。运行器源码更新后，M01-01 runtime 又以相同的 `runnerSourceSha256` `2649ae68ada0e047a38839aef23777e2242ffe885d85d0ad1aa580aafbd27135` 通过，报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-01-python-runtime-rerun-after-chatterbox-mps/report.json` SHA-256 `f5f4eec8c370b57aa42c79a65eb592053b094a0685840c35dd582ec92cc45024`，`modelValidation: not_run`。
真实模型与人工验收：六个语言/设备组合均生成可解码的 24 kHz mono WAV，CPU 时长 ms/en/pt-BR 为 4.28/3.78/5.02 秒，MPS 为 4.52/3.66/5.14 秒；全部 finite、非静音。MPS 的实数/复数迁移通过，模型参数和 buffer 均在 MPS，fallback 关闭。各阶段模型引用清空且 Worker 锁释放。报告峰值 RSS 为 5.90 GB。音色自然度、巴葡/马来语可懂度仍为 `pending`，需人工听测。
失败/跳过/未验证及原因：早期探针运行中修正了发行包元数据前置、英语句子分块计数和 MPS 设备名规范化问题；最终 run6 已在修正后的源码下完整通过。Python Ruff 未运行：当前独立验证环境未安装 Ruff；语法、Worker 行为单测与项目 Prettier/差异检查均已通过。UI/API 对 MPS 的端到端请求仍未实现，按 M04-01 执行。
下一任务与前置条件：进入 M01-04；使用固定 STTN 权重和现有 video-ai Python 3.12 环境，先拆分验证 encoder、时序 attention、decoder，再验证原尺寸分块与合成视频完整闭环。

## M01-04：STTN MPS 完整视频路径

任务：M01-04  
状态：完成；用户已接受合成与真实样本 STTN 画质  
依据：计划 M01-04；前置 M01-01 至 M01-03 已完成；Apple M1 / macOS 15.6.1 / 16 GiB；STTN `researchmm/STTN` revision `f39f62c5bbbe3e3eba084c487353a2c651bfdcde`，MIT；权重固定 SHA-256 `25b0c2c30042d82efd1893bd42ec726764262d94115393a1718f8d65d2a7817b`。

完成内容：新增只用于验证的 MPS-first STTN adapter、固定资源清单、资产准备器和视频探针，均位于 `tooling/video-ai/`；当前 Windows adapter、Worker 业务代码、能力 generation 与 `adapterReady` 未改变。探针注入独立 adapter 后走仓库 Worker 的解码、mask、时序调度、帧校验、MP4 写入与原音轨复用路径。完整素材为 10.041667 秒、1280×720、24 fps、241 帧、2 个 Worker 可识别场景，含 4 个字幕区间（相邻区间、跨镜头区间、末帧区间）与无 mask 时段。Encoder、temporal attention、decoder 均在 MPS FP32 完成 64 次切块调用，所有模型参数/buffer 位于 `mps:0` 且关闭 CPU fallback。原尺寸 tile 为 432×240、overlap 64；STTN 窗口 center/before/after/history/references 为 4/2/2/12/2。视频输出帧数、顺序标记、维度、`uint8`/有限值及最后一帧均通过；解码后的原音轨 PCM SHA-256 与输出完全相同。首个 tile 后取消测试确认没有最终或中间输出，模型引用已释放。

执行命令、退出码、用例数量、报告位置：运行器最终源码下的命令 `node scripts/validate-macos-runtime.mjs --case M01-04-sttn ... --timeout-ms 3600000` 退出码 0。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-sttn-mps-post-propainter-final/report.json` SHA-256 `0b89793543df333d55c2853fc20dbadf9769536be6760492a996cbbff942c2c0`；探针结果 `probe-result.json` SHA-256 `6da40ec5b8a40bb7b9ac9e5fda2a4f6e0bad9555390cf8628a7bd418d1d55bfa`；资源 manifest SHA-256 `b872b9d39870720f5c53e4d1c87e6a93509e9f152cf70be677d46df9aa2dd5ae`；runner source SHA-256 与本台账记载的 M01-05 最终指纹相同。`node --test tooling/testing/macos-runtime.test.mjs`：21/21 通过；Node 检查、Python AST 语法检查、Prettier 与 `git diff --check` 通过。

真实模型与人工验收：模型状态 `pass`，设备 MPS，最终运行器下执行 119,365 ms；峰值 RSS 1,322,401,792 字节，峰值 MPS driver allocation 2,336,489,472 字节。阶段累计 encoder 2,153.643 ms、attention 79,450.837 ms、decoder 19,295.995 ms，权重装载 72.774 ms。输入 SHA-256 `5de11fd93e31b7f5962cd880b2714e71760e09e3c7311ac9ae9b7bd975e49929`；输出 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-sttn-mps-post-propainter-final/mps/sttn-worker-output.mp4` SHA-256 `2c9460d5fba755ca888564a8220575011e9750f83da19f530ceffa19ae5a209f`。音频 PCM SHA-256 `62a3159e7b34192ca97c05be9750d183f6e0840b13c32bd2db6b0853f5ec71b8`，964,608 字节。取消断言全部通过。人工预览图 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-sttn-mps-final/review-contact-sheet.png` SHA-256 `fb60f672e1100770cbc3b3f19d6a5cc22e9f727cdc6ac7c20bd5184c46b6e2c8`；用户已确认该合成预览与后述 STTN 真实样本预览可接受。

失败/跳过/未验证及原因：早期运行分别发现了探针模块命名和合成场景切换亮度不足问题，失败/取消报告保留在同一验证 run 下的 `M01-04-sttn-mps-run1`、`run2`、`run3` 目录；最终 run4 与 final 均在修正夹具后完整通过。真实样本 STTN 的 70 px 遮罩版本起初经内部查看发现影响字幕下方包装小字；用户随后复核并接受该预览。62 px 遮罩运行完成模型帧处理，但 FFmpeg mux 以退出码 254 失败，没有最终文件。该路径现已重新可读，但内容已替换为新样本（SHA-256 `8c0cb15adeb6724d6cfd55de1307613fd55dd0cb1f16be0cbc83a6dfe8091272`）；旧报告继续对应旧 SHA，不与新样本混用。为后续重跑定位 mux 失败，隔离真实媒体探针的错误报告已补充保留部分模型指标、Worker progress 和 FFmpeg stderr；旧 run2 的 stderr 与中间文件不可追补。

真实样本补充（2026-11-10）：用户授权源片 SHA-256 `7507992b7de4f00cdc9b0217f7c1f390a8647532ca784f622a3aa070f2d00820`；23.866667 秒、576×1024、30 fps、716 帧、HEVC/AAC，含运动画面及可见镜头变化。STTN 70 px 遮罩运行 report SHA-256 `923806fd69757dcc2e535778f921e26b93d8b1256e7fa13032e2ca4e21dd7d9e`，原始探针报告因场景数断言标成 fail；独立完整媒体核对报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-real-video-run1/output-verification.json` SHA-256 `5fc6d2d2a4e7a8b3ffef6ed0bff13df30c6b06f3509826b3c2099245921d8cee`，状态 `pass_with_scene_detection_note`：成品 H.264/AAC，分辨率、时长、716 帧、PTS 与源片一致，解码音频 PCM SHA-256 完全相同；模型运行在 MPS。保守场景检测仅识别 1 个场景。成品 SHA-256 `2ec441ea95d61a1cc797dc27bc64c3e585d21a4fba71513c93a1d33f661ed838`；复核图 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-real-video-run1/real-media-review-contact-sheet.png` SHA-256 `a8aa45e5e41dab6cb54441045cbfa73d9e67865f75f18b0f96f33d43028a517e`；用户于 2026-11-10 回复该预览可接受。原始探针未保存峰值 MPS/RSS 指标。62 px 遮罩重跑 report SHA-256 `93425c06419b0681579be148b740c5e34512f54f72c2ca2d2e21ccdbcfd45015`，Worker 在 mux 阶段返回 `MUX_FAILED`；没有成品，报告也未捕获该次模型峰值指标。原始运行和辅助核对报告均保留在隔离验证目录。

真实样本补充（当前版本，2026-11-10）：同一路径现为新源片 SHA-256 `8c0cb15adeb6724d6cfd55de1307613fd55dd0cb1f16be0cbc83a6dfe8091272`，16.439002 秒、576×1024、30 fps CFR、493 帧、HEVC/AAC。STTN 使用固定矩形 mask `(60,680,456,105)` 覆盖全片，Worker 在 MPS FP32 返回成功；encoder/attention/decoder 各 744 次，累计阶段时间 29,226.459/1,093,336.812/284,795.746 ms，权重加载 109.647 ms；峰值 MPS allocation 2,408,448,000 字节，进程峰值 RSS 513,409,024 字节，adapter 已释放且 MPS fallback 关闭。调度提交 493 帧、124 窗口、缓存峰值 18 帧；保守场景检测只识别 1 个场景。原探针报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-real-video-run3/report.json` SHA-256 `7486491d98ff680e0079bd40bb2a7f31598bfa7f6931a902040655d231b6d1bf` 因 21 秒固定抽帧点超出新视频而以 `fail` 退出；模型和 Worker 已成功，部分指标已保存。修正抽帧逻辑后，独立完整媒体核对报告 `output-verification/output-verification.json` SHA-256 `28ac0073618ed0c8d1b40a280586025ab74c7452b15612b5566d9c39cabc37b8` 状态 `pass_with_scene_detection_note`：输出 H.264/AAC，493 帧、分辨率、时长和 PTS 与源片一致（最大偏差 0），解码原音频 PCM SHA-256 相同。成品 SHA-256 `71233cf491dc29f7ee4d49336f9f8f78179cae7f28e5797ac6fc1bbc44d0e3ed`；复核图 `output-verification/real-media-review-contact-sheet.png` SHA-256 `a6d981a1fd718eaa39d23737baf15fa98080bb41221d808db61ab3b296ddfc8b`。用户于 2026-11-10 回复此新源片 STTN 成品可接受。

下一任务与前置条件：继续 M01-05，在同一获准源片上运行 ProPainter，并完成人工画质复核。M01-04 已完成；M01-05 完成后才能开始 M01-06。

## M01-05：ProPainter MPS 与显式混合执行

任务：M01-05  
状态：完成；用户接受 FP16 真实样本画质及约 28.5 分钟耗时（2026-11-10）  
依据：计划 M01-05；M01-01 至 M01-04 计算路径已验证；Apple M1 / macOS 15.6.1 / 16 GiB；`sczhou/ProPainter` revision `326782529a63d997cab80ab21439b92ed422b3d3`；按本地非商用验证范围保留 NTU S-Lab License 1.0 条款。三份权重 SHA-256：ProPainter `12c070c4b48f374c91d8a2a17851140b85c159621080989f9e191bbc18bd6591`、RAFT `fcfa4125d6418f4de95d84aec20a3c5f4e205101715a79f193243c186ac9a7e1`、flow completion `22939a1a7900da878dbe1ccd011d646b1bfb30b8290039d8ff0e0c2fefbfd283`。

完成内容：新增隔离的 ProPainter 资源验证清单/准备器、MPS adapter 与 Worker 探针，均位于 `tooling/video-ai/`；生产 Worker、Windows adapter、资源生成和 `adapterReady` 未改变。49 项固定资源、源码、权重、环境、FFmpeg/FFprobe 摘要均通过校验。RAFT 双向连续帧流、flow completion 和修复网络的 FP32 模型参数均在 `mps:0`；稀疏参考帧只进入修复的外观上下文，不进入相邻 RAFT 光流对。探针捕获并拒绝任何未登记 MPS fallback 警告；`torchvision.ops.deform_conv2d` 和 `fold`/`col2im` 作为两个明确 CPU 岛执行，记录张量搬运、调用次数与时间。模型包 descriptor 的 `adapterReady` 始终为 `false`。

改动范围和保持不变的契约：仅新增本机验证工具与文档；ProPainter 仍受其非商用许可证条款约束，验证结果不构成商用授权或生产可用声明。沿用现有 720p 总像素量限制、96 px 上下文、640×480 crop 上限、单边上限和 8 像素补边；超限返回 `RESOLUTION_TOO_HIGH`，不缩小输入。完整处理仍走仓库 Worker 解码、mask、序列窗口、帧校验、视频写入与音轨复用。

执行命令、退出码、用例数量、报告位置：最终 `node scripts/validate-macos-runtime.mjs --case M01-05-propainter-video ... --timeout-ms 3600000` 退出码 0，完整用时 93,657 ms。报告 SHA-256 `c3b8abd8f92f5739e17925179945ba76607367f3775aa510d23776e432e10adb`；探针结果 SHA-256 `bafbc4f1d6b22197473aca58b05df4a64da467ed4ace7376db53ef818b1acdb5`；资源 manifest SHA-256 `0469a657687fb9ef4b8309c7d78dfccbd659289a3cc6c8c78dfcc7bd8c7056cd`；复核图 SHA-256 `5ec9d9e33782274408e4147167386b2b1d93d7b3464a0225d3fd4e2b861e02fa`。runner source SHA-256 `9ab64290541066bc608689f5d01c22f17e6b56114f6923ecbaddc4fd90f6e8fd`。`node --test tooling/testing/macos-runtime.test.mjs`：21/21 通过；Node 语法、Python AST/编译、Prettier 与 `git diff --check` 通过。

真实模型与人工验收：最终 MPS/显式混合执行 `pass`，无未登记 fallback 警告；峰值 RSS 1,772,732,416 字节、MPS driver allocation 6,266,535,936 字节。10.041667 秒、1280×720、24 fps、241 帧、两场景的完整合成视频走过 121 个序列窗口，2 个活跃修复窗口均触达精确最大 crop `(312,112,952,592)`（640×480）；视频帧序和末帧通过，964,608 字节解码音频 PCM 与输入完全一致。累计 RAFT 12 次、flow completion/组合/图像传播/修复各 2 次；CPU deform-conv 28 次、累计搬运 910,702,592 字节，用时 2,697.922 ms；CPU fold/col2im 34 次、累计搬运 2,736,875,520 字节，用时 1,952.522 ms。报告峰值和阶段数据位于 `selectedRun`。

FP16 同窗试验保持 RAFT FP32，仅将 flow completion 和修复切为 FP16，两个 CPU 岛内部使用 FP32，再传回 MPS FP16。匹配窗口阶段耗时从 FP32 12,737.686 ms 降到 FP16 11,208.667 ms（12.00%）；MPS 峰值从 5,184,372,736 字节降到 3,494,887,424 字节（32.59%）。掩码像素绝对差均值 0.134、P95 为 1、最大 9。该同窗差异属于数值比较，不能替代观感验收。

附加场景：720×1280 竖版 13 帧与 1 帧场景均通过；模型引用均释放。取消在完成一个修复窗口后生效，没有最终/中间成功文件，引用释放通过。增大一个像素以上的区域被 Worker 拒绝为 `RESOLUTION_TOO_HIGH`，未自动缩小且释放模型通过。完整视频输入 SHA-256 `bb29fe113981c7c135cbca05cdf323831e7ef2b9594633a6c68246f349d22c3a`；输出 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-05-propainter-mps-final/full/propainter-worker-output.mp4` SHA-256 `1a84086f6ba5d5a356925c1bef4b9bfe982e99e7d350cf7f4db1602e416d72ae`；contact sheet 在同目录的 `review-contact-sheet.png`。用户于 2026-11-10 回复合成预览可接受。真实 ProPainter 运行待完成。

失败/跳过/未验证及原因：`run1` 暴露探针 case ID 配置不一致；`run2` 暴露 RAFT 的 `int64` 计数 buffer 被过严 dtype 校验误拒；`run3` 首次完整计算发现 PyTorch 对 `aten::col2im` 发出 CPU 回退警告，该结果没有作为最终通过。随后将 `fold`/`col2im` 改为显式 CPU 岛，并把未登记 fallback 警告提升为失败。最终 `run4` 与 `final` 均通过，完整报告保留在同一 run 的各目录。用户提供的当前源片 SHA-256 `8c0cb15adeb6724d6cfd55de1307613fd55dd0cb1f16be0cbc83a6dfe8091272` 已用于本地真实样本处理。未启用生产 adapter，也未更改任何商业授权。

真实样本补充（2026-11-10）：使用获准源片 SHA-256 `8c0cb15adeb6724d6cfd55de1307613fd55dd0cb1f16be0cbc83a6dfe8091272`，16.439002 秒、576×1024、30 fps、493 帧、HEVC/AAC。ProPainter 使用 FP32 MPS、固定矩形 mask `(64,680,448,105)` 与全片范围，输出完整 H.264/AAC 成品。模型参数均在 MPS 且 fallback 关闭；RAFT 双向 1,476 次、flow completion/combination/image propagation/repair 各 247 次；阶段耗时分别为 848,805.672/163,846.444/667.939/25,946.590/923,116.089 ms，权重加载 1,880.022 ms。MPS 峰值 4,633,395,200 字节、RSS 峰值 962,576,384 字节、全流程 2,007,871 ms（约 33.5 分钟）。显式 deform-conv CPU 岛 3,440 次、传输 68,445,085,696 字节、耗时 216,338.361 ms；fold/col2im CPU 岛 4,199 次、传输 201,981,413,376 字节、耗时 126,550.472 ms。247 个窗口提交全部 493 帧，adapter 已释放；保守场景检测只识别 1 个场景。模型报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-05-real-video-run1/report.json` SHA-256 `ab000088b5aa80681230466478a4bab8bc9a4a17d295b0b0dc7e3f77fe651d94`，状态 `pass_with_scene_detection_note`；独立媒体核验报告 `output-verification/output-verification.json` SHA-256 `1cef73ca70dd85863533bb97b9212b26b58be5f9bf6851250f1844c250a6b4b6`，状态 `pass_with_scene_detection_note`，493 帧、分辨率、时长、PTS（最大偏差 0）均匹配，解码 AAC PCM 与输入一致，failures 为空。成品 SHA-256 `a1d87a9323323bff3b1c599b6defc90adbddb967a9579740d029190f834f4e67`；复核图 `output-verification/real-media-review-contact-sheet.png` SHA-256 `6a7d858b8df8f0daa9a8696ea631a7ee49d59ede60ae3b1416b1a77aa3390b41`。模型命令最终返回 1，是执行后才修正的探针退出码判断错误（仅把 `pass` 视为成功）；报告本身与独立验证均记录成功。原运行报告的 `sampleSeconds` 字段仍写着旧常量 `[3.5,9.5,15,21]`，而实际 contact sheet 标注为 `[2.0,5.9,10.5,14.8]`；已修复探针以按时长生成并记录抽帧时点。该报告元数据问题不改变已生成媒体和独立核验结果；FP32 仅保留为精度对照，冻结采用经用户接受的 FP16。

真实样本 FP16 对照（2026-11-10）：同一源片、mask 和 493 帧范围上，以 `--precision fp16` 运行 ProPainter；RAFT 保持 FP32，flow completion/repair 用 FP16，两个 CPU 岛继续 FP32。模型报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-05-real-video-fp16-run1/report.json` SHA-256 `264ab43674406629626b2a701580d53bdc155942a4e46ef89bb2d533f6b47208` 与独立核验 `output-verification/output-verification.json` SHA-256 `9cd6c8cd9604ef7718cb6cfe12b06709c2a1234f762fab0e666984e4e77a5d7c` 均为 `pass_with_scene_detection_note`，完整 493 帧、PTS 与输入一致且 AAC 解码 PCM 相同，fallback 关闭，adapter 已释放。FP16 用时 1,711,976 ms（约 28.5 分钟），比 FP32 2,007,871 ms 快 14.74%；MPS 峰值 3,446,439,936 字节，比 FP32 低 25.62%；RSS 峰值 1,078,345,728 字节，比 FP32 高 12.03%。显式 CPU 岛保留 FP32，tensor transfer 量与 FP32 相同。全 493 帧、mask 区域 `(64,680,448,105)` 的 FP32/FP16 输出绝对像素差均值 1.482、P95 5、最大 194（69,572,160 个通道样本）；差异报告 `output-verification/fp32-fp16-comparison.json` SHA-256 `8d9e523ade5ab0ce8e833db1022cb835b4881a0cf75bd5a89acb5f70999216cd`。输入、FP32、FP16 三栏比较图 `output-verification/fp32-fp16-comparison-contact-sheet.png` SHA-256 `3ebabd5b3f06334ed6ec1577d3e7680d4ef36255a05142b476b0f25816716ca1`。由于两引擎均只识别 1 个 Worker 场景，另以低分辨率相邻帧灰度差列出 9 个切镜候选，并生成 `output-verification/fp32-fp16-cut-candidate-contact-sheet.png`（候选图 SHA-256 `877b0b3bfedb3ed3a0cc7097dda65455a447deba9f3ee2094128a713f6af3c2b`）供重点检查。用户于 2026-11-10 确认 FP16 画质及约 28.5 分钟耗时可接受。

切镜附近字幕带放大对照（2026-11-10）：为便于逐处复核 mask 区域，按输入帧号 60、98、146、188、250、299、377、437、464（依次为 2.000、3.267、4.867、6.267、8.333、9.967、12.567、14.567、15.467 秒）从输入、FP32、FP16 视频裁出 `y=640..819` 字幕带并排生成 `output-verification/fp32-fp16-cut-mask-band-contact-sheet.png`；列顺序为输入、FP32、FP16，行顺序为上述时点。SHA-256 `9a15f5b3c548c5ae0993912ad8882422a2e7b4418b74957a8ec3b1b3a83cb8db`。此图仅为复核辅助图，不改变模型输出与核验结论；用户已确认 FP16 画质及耗时可接受。

下一任务与前置条件：M01-05 已完成；进入 M01-06 汇总并冻结各模型运行时配置。ProPainter 受本地验证范围的非商用许可约束；验证结果不构成商用授权。

## M01-06：冻结原生运行配置

任务：M01-06  
状态：完成（M01 视频配置已冻结；图片与配音人工验收随后分别在 M05-01/F02、M05-02/F03 完成）  
依据：计划 M01-06；M01-01 至 M01-05 模型/媒体报告；Apple M1、16 GiB、macOS 15.6.1；2026-11-10 用户确认 ProPainter FP16 真实样本画质与约 28.5 分钟耗时可接受。  
完成内容：新增 `docs/macos-runtime-validation.md` 的 M01-06 冻结摘要，区分计算正确性、人工质量和性能结论，冻结图片 AI CPU、Chatterbox CPU 基线及单独待听测的 MPS 路径、STTN MPS FP32、ProPainter Hybrid FP16。记录固定源码/框架版本、时间窗口、tile/crop、显式 CPU 岛、峰值资源、失败边界和许可证；未发现需要升级 Mac Torch 版本的证据。M01 视频 gate 通过，进入 M02-02。  
改动范围和保持不变的契约：仅更新 `docs/macos-runtime-validation.md` 与本台账；未更改生产 AI Worker、设备 Schema、能力目录、`adapterReady`、Windows 版本线或依赖锁。STTN/ProPainter 适配器仍仅用于隔离验证；冻结当时 Chatterbox 听感和图片观感尚未验收，后续已在 M05-01/F02、M05-02/F03 完成人工验收；ProPainter 仍限本地非商用许可范围。  
执行命令、退出码、用例数量、报告位置：`pnpm exec prettier --check docs/macos-execution-status.md docs/macos-runtime-validation.md`、`python3 -m py_compile tooling/video-ai/macos-real-media-probe.py tooling/video-ai/verify-macos-real-media-output.py`、`git diff --check` 均通过（退出码 0）；冻结报告依据 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-02-image-ai-complete-run1/report.json`、`M01-03-chatterbox-run6/report.json`、`M01-04-sttn-mps-post-propainter-final/report.json`、`M01-04-real-video-run3/`、`M01-05-real-video-fp16-run1/`。
真实模型与人工验收：图片 AI CPU 五模型输出、Chatterbox CPU/MPS 三语推理、STTN MPS FP32 及 ProPainter MPS/CPU 显式混合推理均有运行报告。STTN 合成及真实样本预览已由用户接受；ProPainter 合成预览及 FP16 真实样本预览已接受，用户并确认约 28.5 分钟耗时可接受。图片 AI 观感已在 M05-01/F02 通过；Chatterbox MPS 马来语、英语和巴西葡萄牙语听感已在 M05-02/F03 通过人工验收；Chatterbox MPS peak memory 未采样。
失败/跳过/未验证及原因：M01-04 当前真实片原始探针报告的状态受已修复前固定 21 秒抽帧越界影响；独立媒体核验通过且 Worker 完成 493 帧推理，报告按实际证据说明而未覆盖原始失败状态。保守场景检测只识别 1 个 Worker 场景。用户未单独给 STTN、图片 AI 或 Chatterbox 提供运行时长阈值，不将其写成性能接受。M01-02/M01-03 后续图像/音频主流程仍分别按 F02/F03 验收。  
下一任务与前置条件：M01-06 完成，进入 M02-02。实际候选 FFmpeg 已在 M02-01 固定；通过 Node 业务/Worker 入口执行计划要求的真实媒体矩阵后，才可进入 M04。

## M02-02：完整媒体业务链路 smoke

任务：M02-02  
状态：完成（候选 FFmpeg 真实业务矩阵 61/61 通过；字幕 Worker 媒体验证通过）  
依据：计划第 5、6、7 节；M01-06 已冻结 STTN MPS FP32 与 ProPainter Hybrid FP16；M02-01 候选 FFmpeg 8.1.2/FFprobe 固定于 `.package/macos-validation/20261109T085328Z-e00daf0c/media/FFmpeg macOS arm64 验证/bin/`，二进制 SHA-256 分别为 `f47a8ffd2d3110d1b3c0a4cfa1bf72973f0d7ce8432a2af56bc61e8c9407aa72` 与 `89f24747ebef1def4820fefbe68cd3fdf289d9f3f5ea08644e2076dca6427867`。

完成内容：以候选二进制运行 `audio-convert.test.ts`、`audio-extract.test.ts`、`archive-watermark-render.test.ts`、`archive-audio-range-render.test.ts`，4 个文件 61/61 通过。实际 Node 服务覆盖 MP3 编码、OGG Vorbis/Opus 与 FLAC 解码转换、MP4/MOV/MKV/AVI/WebM 音轨提取及兼容原编码输出；生产归档 renderer/slideshow 覆盖 AAC 混音、透明 PNG 叠加、水印轨迹/预览连续性、图集 H.264 视频、旋转竖屏、无音轨输入和配乐。新增 ffprobe 断言核对 H.264/AAC、yuv420p、CFR 10 fps、30 帧、严格递增且间隔 0.1 秒的 PTS、音画时长差小于 0.1 秒；新增损坏容器拒绝且无输出，以及活动候选 FFmpeg 子进程取消并等待退出。视频去字幕及原 AAC 复用由 M01-04 的真实 STTN Worker 路径覆盖；Worker 返回完整 493 帧，独立 verifier 核对输入/输出帧和 PTS、H.264/AAC、原音频 PCM 完全相同，状态 `pass_with_scene_detection_note`。

改动范围和保持不变的契约：只改 `audio-extract.test.ts` 的夹具生成器选择和 `archive-watermark-render.test.ts` 的真实媒体断言，并新增隔离报告；未改生产 Node renderer、Worker、Windows 行为、媒体业务参数或已有用户数据，不创建安装包。候选 FFmpeg 缺少仅用于测试夹具的 libvpx VP9 encoder，因此经用户授权安装 Homebrew FFmpeg 9.0.2_1/libvpx 1.17.0，且只用于生成 WebM VP9 与双声道 Vorbis 测试输入；服务实际处理及全部 renderer/Worker 输出仍使用 M02-01 候选，未将 Homebrew FFmpeg 链入项目或候选目录。

执行命令、退出码、用例数量、报告位置：最终命令为 `pnpm --filter backend exec vitest run src/__tests__/audio-convert.test.ts src/__tests__/audio-extract.test.ts src/__tests__/archive-watermark-render.test.ts src/__tests__/archive-audio-range-render.test.ts`，候选绝对路径分别经 `TEST_FFMPEG`/`TEST_FFPROBE`、`TEST_FFMPEG_PATH`/`TEST_FFPROBE_PATH` 注入，夹具变量为 `TEST_FIXTURE_FFMPEG=/opt/homebrew/bin/ffmpeg`、`TEST_FIXTURE_VORBIS_ENCODER=vorbis`；退出码 0，4/4 文件、61/61 用例通过，Vitest 3.2.7 用时 13.30 秒。最终日志 `.package/macos-validation/20261110T050006Z-6c26b884/reports/M02-02-media-matrix-final/vitest.log` SHA-256 `c32a899b5271e4a102f12e2e16f57e066f2d878a1f6488b77c864fece98bcac4`；机器报告 `report.json` SHA-256 `5aacc28656f449f81343587ea89b9fbd5620578b6f9f2d14a5bb1a19dd59f1f0`。字幕 Worker 报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-real-video-run3/report.json` 原始状态为 `fail`，因为旧报告固定尝试抽取第 630 帧而样片只有 493 帧；模型/Worker 完成 mux，独立完整媒体核验 `output-verification/output-verification.json` SHA-256 `28ac0073618ed0c8d1b40a280586025ab74c7452b15612b5566d9c39cabc37b8`，`failures=[]`，未掩盖原始状态。候选 hash 与 M01 Worker 报告中的 FFmpeg/FFprobe hash 一致。

真实模型与人工验收：M02-02 不需新增人工画质门槛；STTN 与 ProPainter 用户验收均已在 M01-04/M01-05 记录。去字幕成品为 H.264/AAC，16.439 秒、493 帧、30 fps，源片与成品 PTS 最大差 0，AAC 解码 PCM 相同。独立场景检测只识别 1 个 Worker 场景，因此将其保留为限制说明；用户仍已接受成品预览。

失败/跳过/未验证及原因：早期尝试曾让候选生成 VP9 WebM 夹具而失败（候选按清单不含 libvpx），随后将夹具生成与被测工具分开；Homebrew 原生 Vorbis encoder 首次未指定双声道也导致夹具创建失败，添加 `-ac 2` 后最终矩阵全通过。未以 mocked `archive-video-edit.test.ts` 代替真实媒体证据。M01-04 原始报告的抽帧失败和保守场景检测限制如上记录，独立媒体核验通过并未覆盖原报告状态。

下一任务与前置条件：M02-02 和 M01-06 已通过，进入 M04-01，开始实现向后兼容的设备契约；图片 AI 画质与 Chatterbox 听感仍是后续 F02/F03 业务验收项。

## M04-01：向后兼容的设备契约

任务：M04-01  
状态：完成  
依据：计划第 4.3、5 节；M01-06 和 M02-02 媒体 smoke 已通过。

完成内容：先完成 Chatterbox 与视频设备契约只读盘点，再完成共享 Schema、DTO、Worker 请求/健康校验、API 路由与映射、前端设备选择和批次再生成改造。Chatterbox 统一支持 `cpu | cuda | mps`；Worker 在协议 v1 下输出可选 `mpsBuilt`、`mpsAvailable`、`mpsUnavailableReason`、`supportedDevices`，未知设备被拒绝。API 保留旧 Worker 健康数据的 CPU/CUDA 推导规则和旧请求默认值；显式设备按当前能力拒绝，批次段落可单独记录再生成设备而不覆盖历史批次的 CUDA 值。前端按 Worker 报告的能力显示设备及提示，不读取 `navigator.platform` 决定支持项；历史 CUDA 批次打开后使用当前设备，再生成时明确传入选择。视频引擎健康 schema/client 接受可选 `supportedDevices` 与 `executionMode`，旧响应仍有效，并在面板显示 Worker 声明的设备/CPU、CUDA、MPS 或混合模式。

改动范围和保持不变的契约：修改 Chatterbox 共享 Schema/Worker/API/前端及相关测试；为视频引擎健康 Schema、client 验证与 UI 展示新增可选元数据。保留 Worker protocol version 1、旧 CPU/CUDA 请求语义、未扩展 Worker 健康响应的兼容解析、Windows 默认 CUDA 语义、视频档位 ID 和 API 路径。未知设备不会折叠成 CPU；显式 MPS 失败不会自动回退。没有更改生产 STTN/ProPainter adapter、视频 `adapterReady`、模型资源或 Mac 能力目录。

执行命令、退出码、用例数量：`pnpm typecheck` 退出码 0；shared 定向 Vitest 3 个文件、10/10 通过；backend Chatterbox 18/18、video-ai 27/27，另有设备兼容测试 2/2，合计 47/47 通过；frontend 定向 4 个文件、56/56 通过；使用既有 Chatterbox Python 3.12 venv 和禁网隔离运行器执行 `node scripts/test-python-workers.mjs --python <受管 Python 3.12 绝对路径> --suite chatterbox --vendor <该 venv 的 site-packages 绝对路径>`，19/19 通过。工作区所有变更的 TS/Vue/JS/JSON/Markdown 文件经 Prettier `--check` 通过，`git diff --check` 退出码 0。

失败/跳过/未验证及原因：初次后端 MPS 不可用断言的 fake Worker 没有显式返回 `mpsAvailable: false`，按兼容规则其 `device: mps` 会被解释为旧 Worker 的已选设备；补全新 Worker 健康夹具后定向后端用例全部通过。前端表单夹具最初未提供能力选项，视频历史编辑测试沿用了已被页面更新的旧按钮文案；更新夹具/断言后 56 项通过。直接调用系统 Python 3.9 的测试命令因缺少 FastAPI 未执行测试代码；随后使用既有受管 Python 3.12 和离线隔离 runner 全部通过，没有向系统 Python 安装依赖。全仓 `pnpm format:check` 因 4 个未修改的内容归档 Vue 文件格式告警返回 1：`ArchiveBatchImport.vue`、`ArchiveGroups.vue`、`ArchiveLocalVideoUpload.vue`、`ArchiveTaskPanel.vue`；本任务改动文件的 Prettier 检查通过。未运行全仓测试或构建；只验证本任务相关工作区。

下一任务与前置条件：M04-01、M04-02、M01-06 和 M02-02 均已完成；进入 M04-03，完成 Mac 单包资源解析与能力判定。

## M04-02：正式视频 adapter 与设备验证

任务：M04-02  
状态：完成；正式适配器的完整合成及真实样本验证通过  
依据：计划第 4.3、5 节；M04-02 依赖 M04-01，M04 阶段整体依赖 M02-02。

完成内容：新增设备策略与严格的 MPS fallback 拒绝、设备缓存清理；STTN 按选定设备分配 FP32 张量并保留 Windows CUDA 12.4 与 3 GiB 检查；ProPainter 接入 MPS Hybrid FP16，RAFT 仍为 FP32，deform-conv、fold/col2im 显式使用 FP32 CPU 岛，保留 Windows CUDA 12.4 混合精度和 3 GiB 检查。M01 合成探针和真实媒体入口现调用正式 adapters，同时仍把 M01 bundle 的 `adapterReady` 留在 false；S01 兼容验证器增加显式 `--device cpu|cuda|mps`，CUDA 仍为默认值。STTN 与 ProPainter 完整 MPS 合成样本已通过；正式 ProPainter FP16 真实样本耗时 28.18 分钟，正式 STTN FP32 真实样本耗时 24.45 分钟，两者输出均与用户已接受成品逐像素相同。S01 STTN CPU/MPS 与 ProPainter CPU FP32/MPS FP16 四项短测均通过。M04-02 验收通过。

改动范围和保持不变的契约：改动集中在视频 Worker、设备策略、STTN/ProPainter adapter、M01 probe、S01 验证器、隔离测试 runner 与台账。保留 Worker protocol v1、Windows CUDA 12.4、STTN FP32、ProPainter RAFT FP32 与 flow/repair FP16、3 GiB 显存检查、空间/裁剪边界和已验收的媒体尺寸/帧率/音频契约；MPS 禁止隐式 CPU fallback，缓存清理按设备执行。M01 的两份重复 MPS adapter 已删除，验证探针现在直接调用正式 adapter。

执行命令、退出码、用例数量：`python3 -m py_compile` 对改动的 Worker、adapter、probe、验证器与 Python 测试文件通过；使用受管 Python 3.12 视频 venv 和禁网隔离 runner 执行 `node scripts/test-python-workers.mjs --python <video venv> --suite video`，60 项通过，唯一跳过项为 Windows 文件共享回归（平台专属）。安装 pytest 9.2.0 仅用于该 `.package/macos-validation/` 测试 venv，未修改项目运行依赖。`node --test tooling/testing/macos-runtime.test.mjs` 22/22 通过；相关 JavaScript/Markdown Prettier 检查及 `git diff --check` 通过。S01 验证器 `--device` 显式短测 STTN CPU/MPS FP32、ProPainter CPU FP32 与 MPS FP16 全部通过；MPS ProPainter 的 deform-conv/fold CPU 岛分别调用 8/17 次，外部 mask 像素保持不变。正式 STTN MPS 完整合成探针报告为 pass：241 帧、两场景、1280×720、24 fps、原 PCM 音频一致、MPS fallback disabled、取消和释放通过，报告位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M04-02-production-sttn-run1/`。正式 ProPainter MPS 完整合成探针报告为 pass：全片、竖屏、单帧、FP16 对照、两 CPU 岛、取消和超限释放通过，未注册 MPS fallback 警告 0 次，遮罩像素差异均值 0.134/P95 1，报告位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M04-02-production-propainter-run1/`。正式 ProPainter 真实样本报告为 pass with scene note：493 帧、247 窗、28.18 分钟、PTS 0 漂移、PCM audio identical、MPS peak 3,446,407,168 bytes；输出 SHA-256 与 M01 用户接受成品相同，解码后 493 帧比较所有 872,349,696 个通道值差异为 0。报告和成品位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M04-02-production-propainter-real-fp16-run1/`。正式 STTN FP32 真实样本报告为 pass with scene note：493 帧、124 窗、24.45 分钟、PTS 最大偏差 0、PCM audio identical、MPS peak 2,408,448,000 bytes，报告和成品位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M04-02-production-sttn-real-fp32-run1/`；输出 SHA-256 `71233cf491dc29f7ee4d49336f9f8f78179cae7f28e5797ac6fc1bbc44d0e3ed` 与此前已接受的 STTN 成品相同，解码比较 872,349,696 个通道值差异为 0。用户的先前画质验收适用于本次逐像素相同输出。M01 重复 adapter 文件已删除，运行器已验证探针直接导入生产 adapter。

下一任务与前置条件：M04-03 进行中，完成 Mac 单包资源解析与能力判定；M01 验证 bundle 的 `adapterReady` 仍保持 false。

## M04-03：Mac 单包资源解析与能力判定

任务：M04-03  
状态：完成  
依据：计划第 4.3、5 节；M04-03 依赖 M04-02；资源验收输入来自锁定的 `tooling/video-ai/sequence-sources.json` 和 M01-06 冻结配置。
完成内容：新增 Mac 时序支持定义 `tooling/components/macos/video-ai-sequence-support.json`，固定 darwin-arm64、Worker 协议、Torch/TorchVision 版本、STTN MPS 和 ProPainter Hybrid FP16 能力、源码来源和精确权重摘要。API 解析器只从验签的 `video-ai` generation 定位引擎，检查 platform/protocol/revision/namespace/adapterReady、源码与许可证 provenance、权重集合和逐文件摘要/大小、文件闭包、路径与链接边界；单引擎缺失只关闭对应档位。安装自检验证两个已签名引擎资源和支持定义，不加载模型。Worker 的 macOS 路径要求定义文件摘要、资源归属、固定运行时版本、资源来源/权重与 MPS 探针同时匹配，并拒绝回退旧 `MODELS_ROOT/engine.py`。轻健康保持无模型加载；新增独立单帧模型深检路由和诊断 UI/API 目标，深检响应遵守 Worker 协议且持有现有诊断维护门。Windows CUDA overlay 路径保持原状。M03-01 已将固定支持定义接入 Mac `video-ai` 构建门，并要求两个已通过冻结定义的引擎 bundle 同时进入包。
改动范围和保持不变的契约：仅扩展视频资源解析、桌面安装自检、Worker 运行时准入/深检和诊断入口，新增签名定义及对应测试。保留 Worker 协议版本、档位 ID、Windows CUDA 解析及旧 CPU 基础能力；Mac 不接受开发机路径、任意 `PYTHONPATH`、用户自设引擎根目录或 CUDA 扩展作为资源来源。未修改模型、用户数据、`.env`、能力 generation、安装包或远端资源。
执行命令、退出码、用例数量、报告位置：API 定向测试 `pnpm --filter backend exec vitest run src/__tests__/video-ai-sequence-assets.test.ts src/__tests__/diagnostics.test.ts` 退出码 0，2 个文件、33 项通过；backend 与 frontend `typecheck` 均为 0；变更范围 Prettier 检查通过。使用隔离的 Python 3.12.14 视频环境运行 `scripts/test_video_ai_engine_assets.py`，6/6 通过；`scripts/test_video_ai_worker.py`，65 项通过、1 项跳过。Ruff 0.13.3 的变更文件格式和 lint 检查均通过；`git diff --check` 退出码 0。Ruff 安装在忽略的 `.package/macos-validation/20261109T085328Z-e00daf0c/temp/ruff-0.13.3/`，未进入能力环境或版本控制。
真实模型与人工验收：本项使用签名清单/小型闭包夹具验证准入逻辑，不加载或重新推理模型。MPS 模型计算、STTN 真实样本画质以及 ProPainter Hybrid FP16 画质和约 28.5 分钟耗时沿用 M01-04/M01-05 报告和 2026-11-10 用户确认；`adapterReady` 的生产资源声明以 M01-06 结果为准。
失败/跳过/未验证及原因：当前正式能力包 generation 尚未由 M03 构建，因此未对真实打包 generation 做安装验收；后续 M03-03 将使用真实十项签名包生成 Mac 目录并完成离线安装验收。没有重新执行重型模型推理或画质复核。其余本项目标通过定向夹具、静态检查和类型检查验证。
下一任务与前置条件：M04-01、M04-02、M04-03、M02-02 和 M01-06 均已完成；进入 M04-04，实施共享重型资源协调、Worker 卸载确认、取消/崩溃/睡眠恢复和排队提示。

## M04-04：资源协调、取消与恢复

任务：M04-04  
状态：完成  
依据：计划第 4.4、5 节；M04-01 至 M04-03、M02-02、M01-06 已完成。

本项目标：Mac 图片 AI、Chatterbox、视频 OCR/修复和显式模型深检共用一个 API 进程内 FIFO 重型推理 lease。队列等待期间允许列表、播放和轻量健康；排队取消立即移除；任务运行期间取消在安全边界释放 lease；异常、Worker 崩溃、卸载超时和应用退出均不得留下 lease 或造成重型模型并行。获得下一项 lease 前，必须要求上一个空闲 Worker 卸载并确认。睡眠唤醒后先轻检现有本地 Worker，只有确认死亡才走受管路径恢复；不能因超时重复启动或重装。Windows 默认不启用协调器。

完成内容：新增 API 进程内 FIFO 重型推理协调器，仅在 macOS 且桌面托管能力启用时生效；Windows 和普通开发运行保持 no-op。图片 AI（含 OCR 建议）、Chatterbox、视频检测/处理及显式模型深检通过共享 lease 排队。排队取消会立即移除 waiter；lease 已授予后的取消会等 Worker 到达安全边界再释放。任务结束、异常、关闭时均在 finally/有序关闭路径释放 lease。切换 Worker 前调用上一个空闲 Worker 的卸载接口，并检查 `modelLoaded=false`、`busy=false` 后才授予下一项；卸载超时会阻塞交接，不会并行加载。三个 Python Worker 的卸载路径均复用各自现有模型锁。图片、视频和 Chatterbox 页面显示等待状态，Chatterbox 批次取消也会中止排队项。macOS 原生唤醒事件由 Electron 转发给 API，先轻检本地 Worker；仅确认连接拒绝时才走受管恢复，普通超时不会触发重装或重复启动。诊断深检超时/取消会等待 Worker 安全退出后再交还资源。

改动范围和保持不变的契约：新增共享协调器、轻健康探测和对应类型；扩展 Worker HTTP 客户端与三个 Worker 的 `/unload` 路由，并接入图片 AI、Chatterbox、视频 AI、诊断和桌面唤醒/关闭生命周期。Worker protocol 的现有任务语义及 Windows/CUDA 路径保持不变；`ECONNREFUSED` 与 HTTP 超时分别处理，只有前者允许尝试受管恢复。排队仍允许轻量健康和只读请求。

执行命令、退出码、用例数量：backend、frontend、desktop `typecheck` 均通过；相关 TypeScript/Vue Prettier 检查、Python Ruff format/lint、6 个 Python 文件 `py_compile` 和 `git diff --check` 均通过。API 定向回归 8 个文件、136 项通过；前端 3 个文件、53 项通过；桌面 2 个文件、18 项通过。Python 图片 Worker 14 项运行、1 项跳过，其余通过；Chatterbox Worker 20 项通过；视频 Worker pytest 全部通过、1 项跳过。覆盖 FIFO 切换、排队与已授予 lease 的取消语义、异常释放、确认崩溃恢复、卸载超时阻断交接、唤醒轻检、忙碌 Worker 等待、关闭拒绝 waiter 和非 macOS no-op。

真实模型与人工验收：M01-06 已用用户提供的 16.44 秒真实视频验证 STTN；本轮 ProPainter 使用 MPS FP16，493 帧约 28.18 分钟，用户确认画质与约 28.5 分钟耗时可接受。M04-04 本身不重新推理模型。唤醒恢复与 Worker 崩溃分支通过自动化模拟验证；没有在本轮主动让机器进入真实睡眠，也没有同时启动三个真实重型模型做压力验收。

失败/跳过/未验证及原因：Python 图片 Worker 1 项因 Paddle 的 Unicode 路径兼容测试仅适用于 Windows 而跳过；视频 Worker 1 项因 Windows 文件共享回归仅适用于 Windows 而跳过。真实系统睡眠/唤醒及多类模型同时到达的硬件压力场景未执行，协调、恢复和安全交接由定向单元/集成测试覆盖。Worker 卸载若超时会保守地保持队列等待，不进行强制并发切换。

下一任务与前置条件：M04 系列完成；M03-01 现已完成，进入 M03-02，检查 Mach-O 架构、Chromium framework、链接实体化、加载路径和签名顺序。真实签名包与安装验收留在 M03-03。

## M03-01：Mac 准备器和元数据收口

任务：M03-01  
状态：完成  
依据：计划第 4.5、5 节；M01-06、M04-02、M04-03 已完成。真实 STTN 与 ProPainter Hybrid FP16 画质/耗时采用用户 2026-11-10 验收结论。

完成内容：新增十项 `darwin-arm64` 独立定义：`python-312`、`ffmpeg`、`edge-tts`、`chatterbox`、`image-ai`、`xhs-browser`、`xhs-archive`、`xhs-translation`、`douyin-archive`、`video-ai`。六份 Mac Python 哈希锁统一放在受版本控制的 `tooling/components/macos/locks/`，生成器默认写回该目录；Edge-TTS、AI 环境、XHS 归档/翻译、Chromium 与匿名抖音描述都有平台准备入口。抖音准备器只复制并逐字段校验应用中既有的匿名适配器描述，依赖 Chromium，不复制第二套解析代码。Mac `video-ai` 使用共享 Python 3.12 与原生 Torch/TorchVision 锁，准备器检查 wheel 架构、最低系统版本、冻结 STTN/ProPainter bundle 的 revision、许可证、逐文件来源和权重摘要；打包器还要求 M01 冻结支持定义逐字节一致且两个 MPS 引擎均通过准入。Mac 构建目录不能包含 `.exe`、DLL、Windows wheel 或开发机路径；构建拒绝跨平台目标、Python 3.11 和 CUDA 组件。主归档、分卷、manifest/review、SPDX 文件名带 `-darwin-arm64`，SPDX package 标签为 `darwin-arm64`；Windows 文件名和 SPDX 标签维持旧格式。builder 返回所有归档总字节数及下载加安装预留量，catalog 生成默认要求十项齐全、签名有效且依赖闭合。安装端 manifest 校验同步拒绝 Mac 上的 Windows 文件路径、旧 Python 和 CUDA。

改动范围和保持不变的契约：新增 `scripts/component-definitions/macos/`、Mac 锁、抖音准备器和视频准备门；扩展包生成器/catalog 校验及安装端 manifest 校验。Windows 打包命名、CUDA 包、已有 Windows 能力定义和匿名适配器实现均未变。ProPainter S-Lab 非商业研究许可继续写入 Mac video 定义。没有改写正式目录、生成或上传 Release 资产，也未读取正式签名私钥。

执行命令、退出码、用例数量：Mac 包构建/目录、锁生成、抖音复用和视频准入定向测试 26/26 通过；API `component-manager.test.ts` 57/57 通过；backend `typecheck` 退出码 0；变更 JavaScript `node --check` 与 `git diff --check` 通过。覆盖 Mac/Windows 文件命名、SPDX 标签、分卷闭包与空间合计、跨平台拒绝、非原生文件/路径拒绝、十项定义、Python 依赖闭包、Mac 目录完整性、未验收视频资源门禁及安装 manifest 拒绝路径。测试只在隔离临时目录使用临时 Ed25519 密钥。

真实模型与人工验收：复用此前验收，不重复推理。用户已接受 STTN 真实样本画质；ProPainter MPS FP16 用户接受画质和约 28.5 分钟处理时间。没有重新处理用户视频。

失败/跳过/未验证及原因：本项测试证明生成器与拒绝门，不代表真实十项能力已完成打包。当前未发现可直接输入 M03 包制作的 STTN/ProPainter 生产 bundle；所以没有生成真实 Mac feed，也没有测量各真实包的压缩体积、完整安装峰值空间或执行安装 generation 自检。M03-03 需用 M01 冻结的实际资源、真实十项归档和受保护的正式签名流程完成这些检查；如暂时没有正式私钥，只生成不可交付的未签名候选并明确标记。Chromium framework、Mach-O 签名与链接布局留待 M03-02 原生审计。

下一任务与前置条件：M03-02 已完成；进入 M03-03。真实十项能力归档和安装验收尚未开始。

## M03-02：原生二进制、Chromium framework 与签名顺序

任务：M03-02  
状态：完成（2026-11-10）；真实 Chromium 最终布局已签名、深度验证并启动，五条 Framework 链接白名单、manifest、安装重建和拒绝测试均已落地  
依据：计划第 4.5、5、M03-02 节；Apple M1 / macOS 15.6.1；目标系统 macOS 14.0。

完成内容：Python 3.12 runtime 中 13 个 Mach-O 均为 arm64、最低系统目标 macOS 11.0，解释器、共享库均通过 `codesign --verify --deep --strict`，runtime 无符号链接。FFmpeg/FFprobe 均为 arm64、最低目标 macOS 14.0、签名有效、无符号链接；依赖只有系统库。与当前 Mac 锁定 `paddlepaddle==3.0.0` 相符的 image-ai venv 候选包含 575 个含 arm64 slice 的 Mach-O，最低目标不高于 macOS 14.0；其中 64 个原先缺失或未通过 strict code signature。新增 `ensureStrictCodeSignature`：在 venv 最终布局上保留有效签名，只为无效/缺失签名的原生扩展生成 ad-hoc 签名，并刷新 wheel `RECORD` 摘要；对一份真实 `libquadmath.0.dylib` 临时副本完成了签名与 strict 验证。重新准备 AI 环境时该逻辑会覆盖全部 `.so`/`.dylib`，本次没有重建或改写 M01 已验证的环境。

Chromium 来源锁定为 Playwright 1.63.0、revision 1243、Chrome for Testing 153.0.8010.12，[官方 mac-arm64 ZIP](https://storage.googleapis.com/chrome-for-testing-public/153.0.8010.12/mac-arm64/chrome-mac-arm64.zip) 大小 190,970,181 bytes、SHA-256 `930e2a2c15addbaca1fe9b07bfa520667bced556d7988707186819cb4279ef3b`，ZIP 完整性检查通过。app 中有 17 个唯一 Mach-O 文件，另有一个指向 framework 可执行文件的内部别名；均含 arm64 slice，逐文件 `vtool -show-build` 显示 `LC_BUILD_VERSION`，最低系统目标为 macOS 12.0 或 13.0，低于目标 macOS 14.0。动态依赖均为系统库，app 的 `LSMinimumSystemVersion=13.0`。本轮复查更正了先前“7 个 helper 缺少最低系统 load command”的记录：直接检查这些对象均存在 `LC_BUILD_VERSION`。

链接和签名实验确认 Chromium Framework 使用以下 5 条相对内部链接：`Resources → Versions/Current/Resources`、`Versions/Current → 153.0.8010.12`、`Libraries → Versions/Current/Libraries`、framework 可执行文件别名 `Google Chrome for Testing Framework → Versions/Current/Google Chrome for Testing Framework`、`Helpers → Versions/Current/Helpers`。保留这些链接的真实 Chromium app 已在最终暂存布局上 ad-hoc 深度签名；`codesign --verify --deep --strict` 通过，headless `about:blank` 的 `--dump-dom` 返回 HTML，暂存资产大小 375,981,990 bytes。将链接实体化会让 `codesign --force --deep --sign -` 报 `bundle format is ambiguous (could be app or framework)`，因此采用下面的封闭链接格式。将签名 app 复制到独立的模拟 generation 路径后，深度签名和 headless 启动仍通过，且链接数和目标保持精确。

改动范围和保持不变的契约：新增 `tooling/components/macos-code-signing.mjs` 及测试；AI 环境准备器为无效 Mach-O 补签并更新 wheel `RECORD`；Chromium 准备器在最终暂存路径保留链接、清理签名敏感元数据、深度重签并使用 `--no-shell`。单一策略文件 `tooling/components/macos/chromium-framework-links.json` 将规则限定在固定 `darwin-arm64` `xhs-browser` 版本及五条指定路径/目标。builder 只把普通文件写入 tar；链接目标写入 Ed25519 manifest 并在 SPDX 中列出；安装器仍拒绝 tar 内任何链接，只在解压后重建签名清单中的五条链接，再验证路径、字面目标、真实目标闭合和普通文件摘要。Mac manifest 拒绝漏项、额外项、错误版本、错误目标及与文件路径冲突；其他组件和 Windows 继续拒绝所有链接。没有更改已安装能力、正式目录或信任密钥。

受限链接机制已实现并通过隔离测试：builder 暂存扫描只接受固定五条相对链接，并检查全部目标真实解析到 Framework 内的现存文件/目录；manifest 中 `links` 数组由 Ed25519 签名覆盖，普通 tar 归档仍只有 File/Directory；SPDX 为每个链接登记 UTF-8 目标文本摘要。安装端验证 manifest 白名单，严格检查 tar 类型，解压完成后按相对目标重建链接，之后同时核验五条链接和完整普通文件清单。安装测试覆盖签名清单、无链接归档、精确重建、链接改写拒绝；builder 测试覆盖签名、SBOM、归档无链接及额外链接拒绝。未放宽全局链接规则。

执行命令、退出码、用例数量：Chromium ZIP SHA-256/大小及 ZIP 测试通过；Python/FFmpeg Mach-O 架构、最低系统版本、链接与签名检查通过。`node scripts/prepare-xhs-browser-component.mjs --stage /tmp/toolbox-xhs-browser-stage-20261110` 退出码 0；最终路径深度签名和 headless 自检通过。模拟 generation 复制后 `codesign --verify --deep --strict`、headless HTML 与恰好五条链接检查均通过。`node --test scripts/build-component-package.test.mjs` 16/16、`pnpm --filter backend exec vitest run src/__tests__/component-manager.test.ts` 58/58、`node --test tooling/components/macos-code-signing.test.mjs` 6/6、backend `typecheck` 均通过；`git diff --check` 通过。

失败/跳过/未验证及原因：将 `.app` 放在当前 Desktop 工作区的 File Provider 路径时，系统会重新加上 `com.apple.FinderInfo`，`codesign` 明确拒绝该布局；准备器在该路径安全失败。改用本地 `/tmp` 隔离暂存后最终签名、复核和启动通过，README 已记录路径要求。没有生成 Chromium component package、Mac signed catalog 或执行真实离线安装；M03-03 所需真实十项包、STTN/ProPainter 生产 bundles、完整磁盘空间测量和安装后业务自检仍未验收。本轮未读取正式签名私钥或创建正式目录。

下一任务与前置条件：进入 M03-03；需先将 M01 冻结的真实 STTN/ProPainter bundles 与其他 Mac 依赖放入对应准备阶段，再按测试密钥/正式密钥边界验证真实包、离线安装、自检和回滚。M03-02 的实测只证明 Chromium 本机最终布局和封闭链接契约，不代表完整十项 feed 可交付。

## M03-03：Mac 测试目录、离线安装与真实业务验收

任务：M03-03  
状态：完成（十项测试包、完整目录、离线安装、自检、重启复用与真实业务 smoke 均通过；测试 feed 不可交付）  
依据：计划第 5 节 M03-03；M01-06 冻结的真实 STTN / ProPainter bundle；M04-02 用户已接受的 ProPainter FP16 样本与约 28.5 分钟耗时。

完成内容：在 `.package/macos-validation/20261109T085328Z-e00daf0c/m03-03-test-feed-1794312790039/` 建立非交付测试 feed，使用临时 Ed25519 密钥 `ed25519-de06b16b5ab316b4aaede6e5` 为 Python 3.12、FFmpeg、Edge-TTS、Chatterbox、Image AI、XHS Chromium、XHS Downloader、Douyin 匿名 adapter 和 Video AI 共 9 项真实 Mac 资产生成签名 manifest、tar.gz 与 SPDX SBOM；归档总量约 5.98 GB。签名 URL 使用 `example.invalid`，测试公钥只存在该 feed 的 `trusted-keys/`，未加入应用正式信任目录；临时私钥在签包后删除。`assembleComponentCatalog` 重新验证了所有签名、资产摘要和 SBOM，9 项依赖图的 9 条边全部闭合；`assertCompleteMacCatalog` 明确拒绝该目录，并只报告缺少 `xhs-translation`。

通过 `ComponentManager.startOfflineImport` 和生产 desktop self-test，从本地归档导入上述 9 项到独立 `/tmp/toolbox-m03-03-offline-install-179431/` 数据根，全程注入拒绝网络下载的下载器。9 项首次安装均为 `ready/healthy`；Python 3.12、FFmpeg、视频 85 个锁定 wheel、Chatterbox 92 个锁定 wheel、Image AI 132 个锁定 wheel 均由签名归档离线构建；Chatterbox 的 3 个分片、XHS Chromium framework 的五条受限内部链接均完成真实导入与验证。新建 ComponentManager 重启后再次读取 9 项全部健康，逐项解析的运行文件摘要与签名 manifest 一致。独立安装 generation 的 Video AI 再次执行真实 ProPainter FP16 工作流：493 帧 / 247 个窗口，MPS fallback 关闭，PTS 偏差 0，PCM 音频一致；耗时 29.1 分钟，输出 SHA-256 `7247fb0286c69dc44c031420e0029dcbd640d2fcf199479ea2418edc828547db` 与此前用户已接受的 M04-02 成品完全相同，故复用原画质确认。

本任务中修正的安装问题：Mac 文件清单的构建器、目录生成器和运行时曾把 Python 标准库文件 `popen_spawn_win32.py` 错认成 Windows wheel；现将 Windows tag 检查限定为 `.whl`，继续拒绝 `.exe`、`.dll` 和真正的 Windows wheel。Python runtime 准备器会从 Mac 暂存件中移除 6 个无用的 distlib Windows launcher，同时保留 `popen_spawn_win32.py` 等源码。Mac Video AI 自检曾因通用 sequence loader 文件而额外要求 Windows 支持 JSON；现在仅 Windows 执行该通用验证，Mac 按签名的 Mac 支持定义验证。Video AI 准备器也将 Worker 所需的 `video_ai_device.py` 纳入包内，否则安装后的 `--check` 会因模块缺失失败。以上均有回归验证。

执行命令、退出码、用例数量与报告：`node --test scripts/build-component-package.test.mjs scripts/video-ai-sequence-preparation.test.mjs scripts/image-ai-component-preparation.test.mjs tooling/components/prepare-python-312-runtime.test.mjs` 通过（25 通过、6 项 Windows-only 跳过）；backend `component-manager.test.ts`、`desktop-component-self-test.test.ts`、`video-ai-sequence-assets.test.ts` 共 94/94 通过；`pnpm exec tsc -p tsconfig.json --noEmit`、Prettier 检查、`git diff --check` 通过。真实安装后推理报告位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-03-installed-propainter-real-fp16-run2/report.json`，与已接受成品的哈希比对位于同目录 `comparison-with-accepted-m04-output.json`；9 项安装清单与摘要检查位于测试安装根 `restart-reuse-check.json`；总测试 feed 报告位于 `reports/M03-03-test-only-package-feed.json`。附加 Worker contract runner 需要 pytest，而生产环境刻意未安装该开发测试依赖，因此 runner 在测试开始前退出；本任务的视频包安装自检及真实业务工作流均已通过。

失败/跳过/未验证及原因：`xhs-translation` 固定 Hugging Face 模型 revision `cf109095479db38d6df799875e34039d4938aaa6` 与项目固定 GitHub release 资产在 2026-11-10 均无法建立 HTTPS 连接（8 秒超时），本机没有可复用模型缓存；未改用未知镜像或替换模型，因而未伪造第十项包。当前目录是临时测试签名目录，不具备正式信任或在线发布资格；尚未验证正式密钥签名、线上地址与在线安装。记录 M03-03 时图片画质和 Chatterbox 听感尚待 M05 验收，后续已分别在 M05-01/F02 和 M05-02/F03 通过；平台登录与外部平台网络调用也未在本项运行。

最新完成更新（2026-11-10）：上文“9/10”记录是首次直连超时后的阶段状态，现已补齐。通过 GitHub API release asset ID 588014485 下载固定翻译包，完整 181,112,891 字节的 SHA-256 与 API 公布值 d77a05e293b5a391f93c35b43bcc72d6a01e1a65e2140676f17f0b5beb1813a2 一致；仅提取 revision cf109095479db38d6df799875e34039d4938aaa6 的模型，8 个文件的 manifest 大小与 SHA-256 全部匹配。Mac 锁生成 17 个 Python 3.12 arm64 wheels；Production builder 生成 28 文件、156,178,982 字节的 XHS Translation Mac 归档。使用第二把仅限测试目录的 Ed25519 密钥签名；两把临时私钥均已删除，正式信任目录未变。十项目录及 10 条依赖边通过；生产 ComponentManager 离线安装后 10/10 ready/healthy，重启后仍健康。已安装翻译 Worker 实际把“你好，这是小红书离线翻译能力测试。”译为“Hello, this is a little red book offline translation test.” 报告：.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-03-complete-test-only-package-feed.json；M03-03 feed 使用 example.invalid 和测试密钥，不能用于交付或在线安装。

下一任务与前置条件：离线闭环已完成；M05-01 至 M05-04 已回归。当前 M03-04 目标为用户指定的 tag01；上传后还需替换 10 个 manifest 和 10 个 SPDX 文件，再做远端核验及 tag01 URL 在线安装复验。

## M03-04：离线导出、独立导入与跨平台拒绝

任务：M03-04  
状态：完成（离线闭环通过；tag01 远端 32 项资产审计、正式签名目录和十项真实在线安装、自检均通过）  
依据：计划 M03-04；M03-03 的 10 项 test-only Mac catalog；独立数据根 `/tmp/toolbox-m03-04-independent-import-179431/`。

完成内容：从已安装且签名清单一致的 Mac generation 导出 `xhs-translation-1.0.0-ct2-cf109095-darwin-arm64.1.toolbox-capabilities.zip`，文件 280,687,271 字节、SHA-256 `4b4fd428172a145b81f007e5123c97e5a54c99aa87c1b274f6e6862a4e769d23`。ZIP 包含 Python 3.12 与 XHS Translation 两项、均标记 `darwin-arm64`。通过生产 `ComponentManager` 导入独立 Mac 数据根；下载器只允许从 M03-03 本地签名 test feed 取恢复 Python 缓存所需的原归档，离线导入过程未访问网络。新建 Manager 后两项均 `ready/healthy`，签名资源解析通过；真实翻译 smoke 将“你好，这是小红书离线翻译能力测试。”译为“Hello, this is a little red book offline translation test.”

跨平台验证：生产管理器将实际 Mac `edge-tts` 离线包（157,886,655 字节）提交到 Windows platform manager 后，以 `COMPONENT_IMPORT_INVALID` 拒绝；未调用网络下载器、未留下 current generation。自动化离线包测试现覆盖 Windows→Mac 与 Mac→Windows 两个方向的签名 catalog/ZIP 元数据不匹配拒绝，两方向均不联网、不创建安装代；Mac fixture 同时使用符合 Mac 目录契约的 Python 3.12 路径。

改动范围和保持不变的契约：增加双向拒绝单测及 Mac fixture 的正确 Python 解释器路径；没有改导出/导入生产逻辑、正式能力目录或信任密钥。测试包和独立导入均使用 M03-03 临时测试公钥；正式信任目录未变。

执行命令、退出码、用例数量、报告位置：`pnpm --dir apps/api exec vitest run src/__tests__/component-offline-bundle.test.ts` 退出码 0，1 个文件、22/22 通过。离线导出/独立导入/真实翻译报告：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-offline-export-import-xhs-translation.json`；Mac→Windows 真实生产拒绝报告：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-cross-platform-reject.json`；导出 ZIP 与哈希见报告及其记录。

正式 Release 线上安装（2026-11-15）：用户替换 tag01 的 10 份 manifest 与 10 份 SPDX 后，远端 32/32 资产的大小及 SHA-256 均与正式候选一致；10/10 manifest 使用正式 Ed25519 key、archive 和 SBOM URL 指向 tag01，10/10 SBOM 摘要匹配且无占位 URL。生产 `ComponentManager` 从真实 HTTPS Release 地址下载、验签、摘要校验、解包、构建环境并自检十项能力，最终 `installed=true / health=healthy`。最终报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-online-install-current-release-tag01-attempt4-20261115/report.json`；四项已在首次 tag01 安装成功，五项在后续修正自检依赖解析器后成功，视频 AI 最终安装及自检通过。失败/中断的尝试分别保留为 attempt1–attempt3，没有覆盖通过报告。M03-04 完成。Catalog 已同步到 `apps/api/src/modules/components/catalog.darwin-arm64.generated.ts`，SHA-256 `fd476da571a28b6c0a13e5205c519af97d99a1b398ba44e1d2d86e726bac70ba`；Catalog 由应用源码承载，不上传到 GitHub Release。

上传材料盘点（2026-11-11）：已生成 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-pending-upload-inventory.json`。对本地 test feed 的 10 份组件清单、10 份 SPDX SBOM 和 12 个归档逐字节计算 SHA-256；12 个归档合计 6,133,503,214 字节，所有归档哈希与源报告相符，10 份清单的临时测试签名均通过公钥校验。清单同时记录原始文件哈希和规范化清单哈希；源报告对 xhs-translation 使用规范化清单哈希，对另外 9 项使用清单文件原始字节哈希。

GitHub Release 远端核验（2026-11-12）：用户确认已上传至 `https://github.com/sunshine-tmy/tool2.0/releases/tag/mac%E8%83%BD%E5%8A%9B%E5%8C%85`。远端有 32 项资产（12 归档、10 组件 manifest、10 SPDX SBOM）；既有逐项大小和 SHA-256 核验记录在 `reports/M03-04-github-release-upload-verification.json`。本轮再次读取 GitHub Release API，资产数与上次一致，`updated_at` 仍为 `2026-11-11T15:13:26Z`、`immutable=false`；响应快照在 `reports/M03-04-github-release-current-state-20261112.json`。当前仍需替换 10 个 test-only manifest：回读的 Chatterbox manifest 使用旧测试 key `ed25519-de06b16b5ab316b4aaede6e5`，且 archive/SBOM URL 指向 `example.invalid`。Catalog 按项目架构嵌入应用，不作为 Release 资产。用户提供的正式 Ed25519 私钥 key ID 为 `ed25519-f372f170675a31f5015c6a38`，与现有正式信任 key 相同；本地权限已从 `644` 收紧为 `600`。用该密钥重签 10 份组件 manifest，把 archive、分片和 SBOM URL 指向当前 Release；10/10 签名通过。生成完整 Mac catalog 到 `apps/api/src/modules/components/catalog.darwin-arm64.generated.ts`，10 项的签名均由嵌入公钥验证。候选目录与报告：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed/`、`reports/M03-04-formal-github-release-feed-candidate.json`；10 个 manifest 的精确路径见 [docs/macos-github-release-signed-manifests.md](macos-github-release-signed-manifests.md)。

在线安装与自检（2026-11-12）：使用真实生产 `ComponentManager`、正式密钥生成的 embedded Mac catalog 和既有 `mac能力包` Release 下载 URL，在隔离数据目录 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-online-install-current-release-run2/component-manager-data/` 安装十项组件。Python 3.12、FFmpeg、Edge-TTS、Chatterbox、Image AI、XHS Browser、XHS Archive、XHS Translation、Douyin Archive、Video AI 全部完成归档验签/摘要核对、解包、运行环境构建及生产自检，最终十项 `installed=true`、`health=healthy`。Video AI 首轮因验收脚本漏传生产使用的 FFmpeg/Python 解析器而误报；使用与应用服务一致的解析器复验通过。最终报告：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-online-install-current-release-run5/report.json`（SHA-256 `bfe78c9f56c811e39941c9df8112fb4ceb167c69f2c4db4eca92b82373db8d8d`），状态 `online_install_all_ten_pass_mutable_release`。这项在线安装证明归档可从当前 Release 获取并通过正式目录验证，但远端 manifest 仍需替换成正式签名版本。

新 tag 正式 feed 候选（2026-11-12）：用户指定 tag `mac-ability-pack-2026-11-12-01`。远端 `refs/tags/mac-ability-pack-2026-11-12-01` 已存在，指向 `6972f58cd668fbf8b2e2f9040d4ae60d3fc8ee44`，与当前 HEAD 一致。用正式签名 key `ed25519-f372f170675a31f5015c6a38` 生成绑定新 tag 的 10 份 manifest，并更新 10 份 SPDX 根包 `downloadLocation`；10/10 签名通过，归档/SBOM 摘要校验通过，assembler 验证完整 10 项 catalog 通过。发现旧 SBOM 根下载地址仍含 `example.invalid`，已在新候选中修正。候选 feed：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/`；报告 SHA-256 `b7fd287e8bc76ce7b245cab6b2c0258822331f2fe2321ffe7612d457206da2bd`；生成 catalog SHA-256 `fd476da571a28b6c0a13e5205c519af97d99a1b398ba44e1d2d86e726bac70ba`。32 个待上传资产的绝对路径、字节数和 SHA-256 见 [新 tag 上传清单](macos-github-release-upload-list-mac-ability-pack-2026-11-12-01.md)；10 份 manifest 的 SHA-256 及验签状态见[新 tag 正式签名 manifest 清单](macos-github-release-signed-manifests-mac-ability-pack-2026-11-12-01.md)。本地 tag01 候选 catalog 尚未替换应用源码中的正式 catalog，因为对应 Release 仍无资产。

新 tag Release 当前状态（2026-11-12，历史决策快照）：GitHub Releases API 返回 tag `mac-ability-pack-2026-11-12-01` 对应的已发布 Release：`draft=false`、`immutable=false`、资产数 `0`，发布时间 `2026-11-12T02:30:22Z`。当时按不可变发布前提把候选绑到该 tag；2026-11-14 用户取消了不可变要求，当前改用已有 `mac能力包` Release。API 去敏快照：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-github-release-tag01-current-state-20261112.json`，SHA-256 `a44b14a3a0b5baf73777d2d1149a43814005694771aa1786a31bb68118d75231`；公开页面：[tag01 Release](https://github.com/sunshine-tmy/tool2.0/releases/tag/mac-ability-pack-2026-11-12-01)。

执行要求更新（2026-11-14）：用户明确不强制 Release immutability，并且当前 TikTok 主页列表 F07-05 暂时跳过。重新读取 GitHub API 并逐项比对本地旧 Release 正式 feed 候选：既有 `mac能力包` Release 有 32 项资产，其中 12/12 归档和 10/10 SPDX SBOM 的大小/SHA-256 均匹配，只有 10/10 manifest 仍是测试签名。比较报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-existing-release-formal-candidate-comparison-20261114.json`（SHA-256 `92a35bb25acd80a721763435cf9e4f975f63822e8a8a112454f9b95f462a6060`）。当前不使用空的 tag01 Release；用户只需在[10 项 Manifest 替换清单](macos-github-release-manifest-replacement-list.md)中删除同名旧 manifest、上传正式签名候选。上传后核验远端 32 项资产，并复用已有真实 ComponentManager 在线安装通过证据，完成正式目录闭环。

远端与候选续核（2026-11-14）：GitHub API 当前 Release 仍为 `updated_at=2026-11-11T15:13:26Z`、32 项资产、`immutable=false`。替换清单中的 10 个正式 manifest 文件均存在，实际字节数和 SHA-256 全部与清单一致；远端同名 10 个 manifest 均存在，但摘要与本地正式候选均不匹配，仍待上传替换。另读取 `refs/heads/main`，远端 SHA 与当前 checkout `6972f58cd668fbf8b2e2f9040d4ae60d3fc8ee44` 一致，无新提交需要拉取。

状态续核（2026-11-15）：GitHub Releases API 再次返回 `mac能力包` 同一 Release（`updated_at=2026-11-11T15:13:26Z`、32 项资产），十个远端 manifest 中 0 个与正式候选摘要相同；本地 10 个候选均存在、字节数与 SHA-256 匹配清单，签名验证记录均为通过。新 tag `mac-ability-pack-2026-11-12-01` 仍为 0 项资产；由于用户再次确认豁免不可变发布要求，本次仍以 `mac能力包` 为目标，不需要向新 tag 重传 6.13 GB 归档。最新 GitHub API 读取确认上述资产数、更新时间和远端 manifest 摘要仍未变化。去敏状态报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-github-release-current-state-20261115.json`（SHA-256 `c44dc2faa3f65ea80dac1c6a0febccabf4c435d54ccb5f6f0c2f0734f1684ac4`）。`main` SHA 仍与 checkout 一致；对 Downloads、Desktop 和 `/tmp` 的文件名复查未发现可识别的 Windows 导出备份 ZIP。

上传前续核记录（2026-11-15，状态已由下方上传后复核覆盖）：当时 tag01 仍为空；M03-04 暂以既有 `mac能力包` Release 为目标。后续用户已将 32 个资产上传到 tag01。

tag01 上传后首次复核（2026-11-15，后续替换已修正）：用户已上传至 `mac-ability-pack-2026-11-12-01`。首次检查发现 12/12 归档匹配，但 20 个元数据文件来自旧 feed。已生成[tag01 元数据替换记录](macos-github-release-replacement-list-tag01.md)及首次报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-tag01-post-upload-audit-20261115.json`。

tag01 替换后复核（2026-11-15）：用户已替换 10 个 manifest 与 10 个 SPDX 文件。GitHub API 确认 Release 有 32 项资产，逐项大小/SHA-256 32/32 匹配候选；重新下载验证 10/10 manifest 的正式签名、tag01 archive/SBOM URL，10/10 SPDX 摘要及根包 URL 均通过。机器报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-tag01-post-replacement-audit-20261115.json`。随后生产 `ComponentManager` 从 tag01 真实 HTTPS 地址完成十项在线安装及自检，最终报告见上文。12 个归档无需重传。

十项离线导出/再导入补验（2026-11-16）：以应用当前正式 darwin-arm64 Catalog 和 M03-04 隔离正式 Release 安装根为源，逐项调用生产 `ComponentManager.createOfflineExport` 导出十个包含其依赖闭包的能力包，再由 `createSourceComponentManager` 导入全新隔离目标根。十项导出 ZIP 合计 8,091,181,113 字节；每个包都完成签名目录、归档摘要校验、安装环境构建及注册的生产自检。恢复 Python 缓存时只读取 `offline-resources/components` 中的七个本地正式归档；导入端下载器硬拒绝网络，拦截次数为 0。所有十项均通过；退出运行进程后新建 Manager，十项仍 `ready/healthy`，且各解析一个签名资源成功。完整清单、单包大小/SHA-256、作业 ID、导入依赖闭包、重启复核和禁止网络计数见 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-ten-ability-offline-roundtrip-20261116/report.json`（SHA-256 `a6b320c0ceb2db8a8325c3c28a7ae7ef6d6f953a135daffbe8f70ad7768c6f59`）；十个导出包保留在同目录 `offline-bundles/`。M03-04 的“十类 Mac 能力离线导出再导入”单轮证据缺口已补齐。

下一任务与前置条件：M05-01、M05-02 和 M05-04 已完成；M05-03 除用户要求暂缓的 F07-05 TikTok 主页列表项外已验收，F07-05 仍未通过。M03-04 已完成 tag01 远端审计、正式 Catalog 同步及十项在线安装；继续 M06-01 桌面原生界面验收。

## M05-01：图片压缩与 AI 图片业务回归

任务：M05-01  
状态：完成（F01、F02 自动化和人工画质验收通过）  
依据：计划第 6 节 F01/F02；M01-02 图片模型与合成商品图；Mac 已安装的 Image AI generation。

完成内容：修正图片上传在 macOS 下的文件名扩展名：根据经校验 MIME 使用 `.jpg`、`.png`、`.webp`，使 PaddleOCR 能按受支持扩展读取输入；背景移除规范化输出使用真实 `.normalized.png` 文件路径。商品图文件归属检查先按配置目录的词法路径验证，再处理 `/var` 与 `/private/var` 别名，仍拒绝任务根目录以外路径和子路径符号链接。新增遮罩编辑器回归，覆盖 OCR 多边形坐标、手动画笔指针坐标及 PNG mask 输出。

图片压缩页面新增逐项取消当前上传；取消时 AbortController 中止请求，条目回到待处理状态并可重试，不展示为失败。页面离开时中止活动上传并释放本地预览。同步修正整批摘要只统计真实失败项，避免用户取消最后一项后看到“全部失败”。原同步图片压缩 API、文件保存与输出格式契约保持不变。

执行与证据：F01 独立隔离 API smoke 的报告位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/F01.json`（SHA-256 `03ee16b09d5f396712680a116de416e7463fcff10b8a07a2973cb76250f0bb39`），其中 JPG/PNG/WebP 输入、输出格式和宽度、透明 PNG alpha、4 项 ZIP、压缩后体积增大、错误 MIME 均有记录。前端页面/API/预设测试 9/9 通过，包含取消后重试；`pnpm --filter frontend typecheck` 通过。此前 image-ai / history removal / image-compression compat / dimensions API 回归 85/85 通过，MaskEditor 组件测试 1/1 通过；对应代码测试包括 `apps/api/src/__tests__/image-ai.test.ts`、`image-ai-history-removal.test.ts`、`image-compression-compat.test.ts`、`image-compression-dimensions.test.ts`。

F02 报告位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/F02.json`（SHA-256 `36cc14b5253670788b82de7535d92c942049aad03f1fb3ff868b7b1241d5e9ab`）。固定离线模型真实 Worker/API 已生成修复、2×/4×、抠图、主图标准化和二次编辑输出；抠图及两张商品图输出保留 alpha。实际执行源结果删除后，原下载返回 404，编辑快照继续可读并完成二次编辑。F02-07 历史批量删除保护测试通过。画质验收 contact sheet 位于 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M05-01-real-api-run2/image-ai-review-contact-sheet.png`，SHA-256 `88ed397fbe290391e99c8542fd96194dc2bdba5fff39326e017819c8e01e5320`。

人工验收：用户于 2026-11-10 回复“可接受”，确认修复、2×/4×、抠图、标准化与二次编辑画质；F02 报告 SHA-256 更新为 `36cc14b5253670788b82de7535d92c942049aad03f1fb3ff868b7b1241d5e9ab`，用例矩阵同步登记。

执行限制：完整图像 Worker smoke 已写出产品精修结果，但未生成原定的汇总 `report.json`；F02 证据报告记录逐项成功 guard、留存输出和该限制。用户已确认画质可接受，M05-01 已冻结。正式 signed feed 在线安装随后于 2026-11-15 由 M03-04 在 tag01 完成。

下一任务与前置条件：M05-02 已完成；进入 M05-03 多媒体归档回归。M03-04 正式 tag01 在线安装验证随后于 2026-11-15 完成。

## M05-02：配音与音频业务回归

任务：M05-02  
状态：完成（F03-11 三语人工听感验收通过；F03、F04、F05、F06 均通过）  
依据：计划第 6 节 F03–F06；M01-03 Chatterbox CPU/MPS 三语真实推理；本地 FFmpeg 8.1.2 能力包。

**F03 多语配音：** 在线 Edge-TTS 实际生成两段英语语音和 SRT，经 `/api/v1/tools/edge-tts/batches` 入库。Chatterbox CPU 与 MPS 的马来语、英语、巴西葡语在 M01-03/run6 均生成可解码、非静音 WAV；另经真实 API 批次路径生成三语 MPS 样本，保存、试听并复用永久音色，验证每批两段的原文、中文和双语字幕顺序，然后将段落导入素材库。自动回归覆盖队列顺序、取消、单段重生成、历史批次和设备拒绝。CPU/MPS 数值与输出散列见 `reports/M01-03-chatterbox-run6/report.json`；真实 API 输出及摘要见 `reports/M05-02-audio-api-smoke-run12/report.json`，在线语音见 `reports/M05-02-edge-tts-online-smoke/report.json`。

**F04 音频素材库：** 实际 API 流程验证背景音乐/配音用途、分组、重复上传去重、音频 Range 试听、WAV 裁剪并保存为独立素材、保留重复项顺序的播放预设、完整备份重复恢复，以及回收站恢复。生成语音从 Chatterbox 和 Edge-TTS 两种来源独立入库。前端回归覆盖单播放器、队列、音量/静音、裁剪波形和素材管理。

**F05 音频提取：** 用合成媒体通过实际 API 提取 MP4、MKV、AVI、MOV、WebM 音轨；双音轨夹具分别选择不同语言轨，分别导出 MP3 与原编码。无音轨 MP4 被明确拒绝；已入库输出在提取任务删除后仍可试听。自动回归覆盖批量选择、去重、取消、范围请求和独立副本。

**F06 音频转换：** 实际 API 将 OGG Vorbis、OGG Opus、FLAC 转为 MP3，验证 128/320 kbps 参数、按文件内容和码率去重、试听、入库与删除转换任务后的独立副本。使用本地合成且获授权的测试密钥构造 MusicEx v1 MFLAC 与 QTag MGG 夹具：MFLAC 缺钥时返回 `AUDIO_CONVERT_KEY_REQUIRED`，手动密钥重试成功；MGG 内嵌密钥转换成功。密钥不出现在 API/持久化任务响应中，流程没有读取账号登录数据。1000 条选择上限及确定顺序由后端夹具与前端 1000 项回归验证。

**自动化和报告：** 音频 API 回归 17 个文件、268/268 通过；前端 Chatterbox、素材库、提取与转换回归 26 个文件、163/163 通过；`pnpm --filter frontend typecheck` 通过。真实 API/媒体报告：

- F03：`reports/F03.json`，SHA-256 `996f2c9947e3f1725a62798920e4a668b2ec01f904a110886dca27209157f8f3`；F03-01 至 F03-11 全部通过。
- F04：`reports/F04.json`，SHA-256 `4ee7138cf3556f0cf9c866d52dbca9fe8e48880baf3e6b0b3ec8b1ce220ef407`。
- F05：`reports/F05.json`，SHA-256 `b44661daa669ef6d21713b2c4fb819a5d834cd19bde23effb5f034bc0b701f84`。
- F06：`reports/F06.json`，SHA-256 `7945e532f3e7728eb5184dd5a598c9bf3a0a52b91e1adc4a2c2970be14e6350f`。

**人工听感：** 2026-11-11 用户试听 Chatterbox MPS 马来语、英语、巴西葡萄牙语三个真实 API 样本后回复“三段都可接受”。样本均通过 MP3 解码和非静音电平检查，摘要记录在 `reports/F03.json`。验收样本：

- 马来语：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M05-02-audio-api-smoke-run12/chatterbox-previews/chatterbox-ms-mps.mp3`
- 英语：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M05-02-audio-api-smoke-run12/chatterbox-previews/chatterbox-en-mps.mp3`
- 巴西葡语：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M05-02-audio-api-smoke-run12/chatterbox-previews/chatterbox-pt-BR-mps.mp3`

执行限制：首轮完整测试重跑使用了本机 FFmpeg 不支持的 `libvorbis` 夹具编码名，1 项夹具生成失败；改用本机编码器名 `vorbis` 后重新完整运行，17 个文件、268 项全部通过。M05-02 自动回归和三语人工听感均已通过，F03 已冻结；正式 signed feed 在线安装随后于 2026-11-15 由 M03-04 在 tag01 完成。

下一任务与前置条件：M05-02 已冻结；进入 M05-03。此处记录形成时，M03-04 已从既有可变 Release 通过；正式 tag01 的 10 个 manifest 替换、远端复核及在线安装随后于 2026-11-15 完成。

## M05-03：多媒体归档业务回归

任务：M05-03  
状态：部分完成（F07-01、F07-E、F07-L 通过；F07-05 因 TikTok 主页列表访问受限，由用户决定暂时跳过并继续后续阶段，保留待补验）  
依据：计划第 6 节 F07、F07-E、F07-L；M05-02 已完成；M03 Mac 离线安装闭环已通过。

范围：三平台作品获取与归档、本地视频及表格批量导入、TikTok 主页历史、分组/列表/详情、归档编辑的配乐与水印、图集转视频、翻译与 ZIP 导出。保持公开匿名访问和既有登录流程，不绕过验证码或访问限制；真实平台样本仅取公开且可播放的代表作品，必要登录样本需用户授权。

自动回归：归档/平台后端 46 个测试文件、628/628 通过；前端归档 29 个文件、308/308 通过；`pnpm --filter frontend typecheck` 通过。完整日志位于 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M05-03-api-regression-final.log`、`M05-03-web-regression-final.log` 和 `M05-03-frontend-typecheck-final.log`。覆盖本地视频批量上传的分组/去重/1000 条上限与限流、XLSX/CSV 模板导入、主页发现及逐条重试/成功回填、分组/发布筛选/排序/50/100/200/500 分页、三类文案复制、截帧、独立删除、翻译与 ZIP，以及音乐全长试听/换曲、水印设置/轨迹/预设、图集生成和逐条预览。

真实匿名抖音：通过真实生产归档 API 与匿名 Chromium 读取三条既有公开作品：普通视频 `7464977705159691570`、14 组实况图集 `7685962392984216805`、Live Photo `7594644721835798635`；所有归档下载均返回 200，字节数和 SHA-256 与归档媒体清单相同。浏览器使用 M03-03 已验证的本机测试目录资产；隔离 API 测试夹具只将受管运行时资产解析指向该已验证浏览器，数据库和业务存储均为临时目录，任务结束后移除。抖音报告分别为 `reports/M05-03-douyin-api-live/report.json`（SHA-256 `5d01ab2658df2abcb170bc3a7d38dcf1b81f23d49e684eade14e1272d97dd778`）和 `reports/M05-03-douyin-gallery-live/report.json`（`9a17e26c9ab2e178112a4f7db114f555191d9876e00802e497cac89137827c5d`）。

真实小红书：用户提供公开作品 `6af2d90a000000001802b98a`，通过真实归档 API 匿名获取并下载 1 个视频（7,232,690 字节）；下载 SHA-256 与归档清单相同：`ccbcd6a1174b416b3ee36466e5c95f24d85490ca362996c0a4cf893ea04b695a`。分享 URL 的 `xsec_token` 未写入报告；API 使用 M03-03 测试专用签名目录中已验证的依赖，数据库和媒体存储均为临时目录。样本证据 `reports/M05-03-user-platform-samples-live-run7/report.json`（SHA-256 `06855297354a03bb207222e10eacc9a36acbe4e4c582b22e00c051daff8481c4`）。

真实 TikTok 单条：用户提供短链 `https://vt.tiktok.com/ZSp5UAqUw/` 在 macOS 系统 HTTPS 代理下返回作品元数据，但未提供本项目接受的公开视频地址，任务失败码 `TIKTOK_MEDIA_INVALID`；TikTok shop 回退关闭，未使用第三方解析服务。另以 TikTok 官方开发文档公开示例 `@scout2015/video/6718335390845095173` 经系统代理完成匿名归档，视频与封面均返回 HTTP 200，合计 3,006,757 字节，下载摘要与归档摘要匹配。报告 `reports/M05-03-tiktok-official-public-with-system-proxy-run1/report.json`（SHA-256 `c9a8b4074bcee472f67f379d27d9b3beb3f611f02e92ac48ea5d3ddeeb6bd1b5`）。系统代理端点已脱敏，未传代理凭据，也未改动系统代理设置。

真实 TikTok 主页：匿名读取用户提供的 `@ceali311` 与官方公开作品示例作者 `@scout2015` 均未发现作品。使用生产主页读取器和匿名 Chromium 重试后，独立网络诊断确认 `www.tiktok.com/api/post/item_list/` 返回 HTTP 403；未使用登录态、Cookie、挑战绕过或 shop 回退。主页用例 F07-05 保持部分完成。新用户样本 `@supernutrisilite` 经两次匿名读取均未发现作品；多个只读诊断共记录 403、200、403、403；两个 403 响应体为空且没有作品发现，第二次元数据探针报告 `reports/M05-03-tiktok-profile-supernutrisilite-metadata-run2/report.json`（SHA-256 `b8b15b4c731c0f6955ab51868d8739ee0d6673f5bb9dc0ac32d1aed30109938e`），只保存响应元数据；此前首次运行报告 `reports/M05-03-tiktok-profile-supernutrisilite-run1/report.json`（SHA-256 `5939162189735a8f6afb98a8db93d9979d40a461fc7bd9241f786cb63c90812b`）和 `reports/M05-03-tiktok-profile-supernutrisilite-metadata-run1/report.json`（SHA-256 `456fb1731f32a417463eae9aafcccd6585ae325ec278c7c31369e980052e818c`），分享 URL 查询参数未写入报告。随后在同一 Mac 用直连出口只读重试 `@supernutrisilite`，没有观察到主页列表响应，仍为 0 条；报告 `reports/M05-03-tiktok-profile-supernutrisilite-direct-run1/report.json`（SHA-256 `25b35428bfa9b15e76b2230975f6b16078794f03ed44c62ce9a9432a336bdb01`）。生产探针报告 `reports/M05-03-tiktok-official-profile-system-proxy-run1/report.json`（SHA-256 `4e738008ee4877913d1b11d9570852818ae2c4ca0c7e4bdc1f532536fd231ca7`）；HTTP 诊断 `reports/M05-03-tiktok-profile-http-diagnostic-run1.json`（SHA-256 `f801b5663287eb7c9cd0f842e85d215b16df2c0a5fd149a3893b6f7b3be11c01`）。

真实视频编辑：真实抖音视频完成 14.93 秒全长配乐试听和带水印保存，输出 H.264/AAC、720×1280、原片摘要保存不变，已保存配乐摘要与上传库素材一致。编辑报告 `reports/M05-03-douyin-video-edit-live-run2/report.json`（SHA-256 `2080f448f7e33c4a624c29688e1e1acb2e75f32146d209ee21e88a75a750a724`）；前后对照图 `reports/M05-03-douyin-video-edit-live-run2/edit-before-after-contact-sheet.png`（SHA-256 `8cc53ea7f6e8dcd05100b28cdfe1545c812cbbffe8821b6c2d9f8e08c65d1b9a`）。用户已回复“可接受”，F07-E 画面验收已冻结。另用真实 Fastify API 与合成视频完成本地视频上传、背景音乐/水印库、版本保存、原片保留及音乐快照验证，报告 `reports/M05-03-archive-video-api-smoke-run2/report.json`（`10b9b3a22ff1914d84bb2352394dbd1ee9b4ac31307534b0e94b4a852d0065de`）。

报告状态：`cases.json` 中 F07-01、F07-E、F07-L 为通过；F07-05 主页匿名读取未完成，因此 F07 与 M05-03 保持部分完成。用户已要求暂时跳过 F07-05 并继续后续阶段，该项不阻断后续任务，也不记为通过。F07 报告 SHA-256 `0f8eeded78ebfccb6b5b5b086d84487c46892cc40c6d00a5fff6761cc6df96a2`，F07-E SHA-256 `db8a4a73fc260b448de3f41677242dacb1fa9cc095923ab3f1b6e717da01f461`，F07-L SHA-256 `5b9342c10fd22caacbb879106a32daaee424f1f84f4c2e07fe080b3598f9092e`。另修正 Mac Chromium 版本校验以接受已安装版本 `1.63.0-chromium-1243-darwin-arm64.1`；定向回归 1 个文件、4/4 通过，日志 SHA-256 `925daace61cf028c3caa9adb1aa49719694a53353a4d5f23af3cd46678a0b1aa`；TikTok 列表 HTTP 403 未完成状态回归 1 个文件、16/16 通过，日志 SHA-256 `c854d5d8e41c08936a14ff9ee4662fc1f2d58b67b42865302ad95dfd195d0bf8`。按“不得绕过第三方访问限制”的计划要求，Mac 主页浏览器现保留 Chromium 自动化标记默认值，Windows 启动参数不变；浏览器/主页读取器联合定向回归 3 个文件、24/24 通过，日志 SHA-256 `4ed931ccbc0399e67e0bf5102b2fb372a42b3a5fabd5438c0407eb3c5866a3cb`。移除该参数后用用户再次提供的 `@ceali311` 匿名重试，仍未发现作品（0 条）；随后对同一用户主页做状态码只读诊断，确认列表接口连续两次返回 HTTP 403，报告 `reports/M05-03-user-tiktok-profile-status-run1/report.json`（SHA-256 `c4ea16072a748dcaaed5a7a5ac16090ce935cf198e694bd4ac5c7b08d1d390d5`）；仅记录 host/path/status，不保存查询参数和响应体。旧版 @scout2015 的 HTTP 403 诊断发生于参数移除前，历史报告已标注 `--disable-blink-features=AutomationControlled` 曾隐藏自动化标记；Mac 后续重试不再使用该参数。单条与三平台归档样本的成功和失败尝试均已留证。

媒体元数据说明：本次抖音视频 API 提供的尺寸字段为 2160×3840，但对已下载且摘要相同的 MP4 执行 ffprobe 得到 720×1280；编辑器和渲染器使用实际视频媒体信息。本报告记录该上游字段与文件编码尺寸的差异，不以平台字段替代已检查的输出文件尺寸。

改动范围：更新归档上传上限回归断言，使其匹配 UI 在 1000 项时禁用选择控件；修正 TikTok 主页浏览器对已验证 Apple Silicon Chromium 包版本 `1.63.0-chromium-1243-darwin-arm64.1` 的兼容校验，并添加 Mac 版本回归断言；Mac 启动参数不再关闭 `AutomationControlled`，保留默认自动化标记以遵守不绕过平台访问限制的要求，Windows 启动参数保持原样。

执行变更（2026-11-12）：用户要求暂时跳过 F07-05 并继续 M05-04。此前匿名列表 API 多次 HTTP 403/空响应的证据仍保留；不再重复探测、不把该用例记为通过。M05-03 维持部分完成，最终审计前再判断能否补验。当前进入 M05-04。

## M05-04：视频与开发工具业务回归（完成）

任务：M05-04 完成；依用户 2026-11-12 指示，F07-05 暂时跳过，不阻断本项。F08–F12 自动回归通过；真实视频/API 闭环通过；本地开发工具离线本地处理已核对。

- F08 视频去字幕：后端 6 个测试文件 64/64 通过，前端 9 个测试文件 70/70 通过。`/Users/zyh/Downloads/video.mp4` 的生产 API 流程检测到 12 个可编辑区间；用此前已验收的手动矩形提交 ProPainter FP16 后，原片摘要不变，输出为 H.264、576×1024、30 fps、493 帧及 AAC 双声道；原片/成品都可再次检测。API 成品 SHA-256 `7247fb0286c69dc44c031420e0029dcbd640d2fcf199479ea2418edc828547db` 与 2026-11-10 用户已接受的 FP16 成品逐字节相同，复用该次人工画质确认及独立媒体/原音核验。极速档预览和自动检测框直接交 ProPainter 的诊断记录保留，但不影响经编辑区域完成的 F08 主路径。报告：`reports/F08.json`、`reports/M05-04-video-api-live-run7/report.json`。

- 快速档真实 API 补验（2026-11-16）：同一只读样本通过正式 API 与 tag01 安装 Worker 完成 `fast`/LaMa 任务，493 帧、H.264 576×1024/30 fps、AAC 双声道；原片摘要仍为 `8c0cb15adeb6724d6cfd55de1307613fd55dd0cb1f16be0cbc83a6dfe8091272`，原片与输出均可重新检测。输出 SHA-256 `5127ada55d73e0109283beac473e9e192d57e2eeda5c11ff27cf61aaa7c9311d`，耗时约 24 分钟。前后对照图 `reports/M05-04-video-api-live-fast-run2/source-vs-fast-contact-sheet.png` 已提供用户复核；该模式画质状态暂记 pending，主路径 F08 仍依据用户已接受的 STTN 与 ProPainter FP16 实际输出通过。完整报告 `reports/M05-04-video-api-live-fast-run2/report.json`（SHA-256 `f17f2716667efdf40cc141231a188112eaa296bbbcf3d8334e496de21e38460d`）。
- F09 JSON：3 个测试文件 56/56 通过，格式化/校验、文件导入、复制/下载与错误输入均在本地完成；用例报告 `reports/F09.json`。
- F10 Base64：3 个测试文件 50/50 通过，文本/二进制往返、URL-safe 编码、大小边界及下载均在本地完成；用例报告 `reports/F10.json`。
- F11 URL：3 个测试文件 46/46 通过，现有编码模式、Unicode/保留字符、非法转义及下载均在本地完成；用例报告 `reports/F11.json`。
- F12 UUID：3 个测试文件 39/39 通过，数量边界、随机源、复制/下载及状态清理均在本地完成；用例报告 `reports/F12.json`。

依据：计划第 6 节 F08–F12；自动回归日志为 `logs/M05-04-regression-run1/backend-vitest.log` 与 `logs/M05-04-regression-run1/frontend-vitest.log`。JSON、Base64、URL、UUID 页面/处理器未调用网络 API，转换和输出由浏览器本地处理。`cases.json` 已将 F08–F12 记为通过。用户批准暂时跳过 F07-05 后继续。

## M06：桌面窗口与进程生命周期

状态：部分完成。M06-02 的自动回归、打包 Python/FFmpeg 深检以及 Python/FFmpeg/Chromium 活跃 Worker 的打包集成强杀验收通过；2026-11-16 已用隔离打包应用验证原生文件选择器读取 Downloads 并导入用户批准的视频，页面预览无法播放；脱敏诊断报告已通过原生保存面板写入 Desktop 与 Downloads 下的临时子目录并校验。本机私网地址的 health 请求返回 200；系统防火墙当前关闭，因此未出现入站提示，也未更改防火墙设置。2026-11-16 用户确认同网手机可打开 `http://192.168.3.79:5173/`，并从手机发布虚构图文；隔离 API 核实标题 `LAN验收-1116`、正文 `隔离测试内容，无个人信息` 且计数为 1。手机已上传页面截图；用户确认列表可见并能打开/下载。隔离 API 文件记录为 `IMG_4485.png`、198,612 字节，下载接口返回 HTTP 200 和有效 PNG；合成图文/文件均已通过 API 删除，列表及占用归零。防火墙提示仍待验收，M06-02 暂不标完成。M06-01 的隔离源码 Electron 窗口 CUA 已恢复可读；Cmd+M/Cmd+W、窗口激活恢复、原生最小化、物理 Dock 恢复及状态栏显示/隐藏/退出已验证，退出后应用会话返回码 0 且端口关闭。M06-01 的全屏进入/退出已由用户实机确认并经 CUA 读取原生窗口控件复核；五分钟音频播放中触发原生退出提示，用户选择继续后同一音频仍播放至 3:28；用户随后以实体 Cmd+W 隐藏窗口，确认播放继续，再经状态栏恢复并由 CUA 读到同一音频仍播放至 1:45。M06-01 完成；S03-03、S03-04 通过，真实睡眠/唤醒仍待验，S03 保持部分完成。

源码窗口与 Dock/状态栏实测（2026-11-16）：用户确认 Mac 已解锁后，CUA 读取到源码 Electron 的“电商工具箱”主窗口、13 个工具入口以及原生关闭/全屏/最小化控件；点击 AX 最小化按钮后 Finder 回到前台，隔离 Electron 仍运行，`/api/v1/health` 返回 HTTP 200。用户随后物理点击 Dock 图标并确认窗口恢复；状态栏菜单显示“显示主窗口/隐藏主窗口/退出电商工具箱”，用户逐项点击并确认隐藏、恢复、退出均通过。CUA 重新读取恢复后的窗口；退出动作的首个检查处于 graceful close 过程中，随后 pnpm 会话退出码 0、56812/5173 端口均关闭且隔离进程消失。之前同日已验证 Cmd+M/Cmd+W、激活恢复和原生 Quit。五个测试专用数据根已清理，未访问默认 Application Support。随后在隔离源码实例中进入全屏并尝试 Control+Command+F 退出；该次 CUA 应用级截图/AX 未能确认状态变化，遂用 Cmd+Q 正常退出并清理该隔离根。之后用户在当前隔离实例中实机确认全屏可退出并回到普通窗口，CUA 随后读到标准窗口及原生全屏/最小化/关闭控件；全屏进入/退出现记为通过，活动任务退出保护仍待验。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-native-window-controls-retest-20261116.json`（SHA-256 `6ea38fb4f5c09a6c69863ca0efd130fc3447ffcf8b4ee67bb88b902b932fef7a`）。

播放中退出保护验收准备（2026-11-16）：当前另一个隔离源码实例位于 `/private/tmp/toolbox-m06-01-manual-next-20261116`，应用健康接口返回 HTTP 200。通过本机 API 在隔离音频库加入 60 秒低音量合成 WAV（条目 `_s2jv5NZcOmNmGHryZdNI`，SHA-256 `0b3131fb64dadd8e0ceb5d420768e08eb9e77bdd81f99770cff73c3d2a777c05`）；原始生成文件已删除。待用户完成全屏退出后，将用该条目播放并检查原生退出确认框；播放保护的首轮人工验收中，用户确认退出提示出现并选择继续使用；60 秒样本在随后读取时已空闲，无法排除自然播完。五分钟合成样本复测中，原生退出提示再次出现；用户选择继续后 CUA 读取到同一音频仍播放至 3:28，S03-04 记为通过。播放中隐藏/恢复已验；当前隔离实例转用于同网手机 LAN 实测，实例及隔离数据根尚未清理。之后对 Electron 的 CUA 只读状态查询在 60 秒超时并重置内核；同一时点本机 health 仍为 200、Electron/renderer/backend 进程仍存活，故不据此判断全屏操作结果，也未发送输入事件。

M06-01 覆盖 application/launch/menu/tray/window/startup-diagnostics：6 个测试文件、32/32 通过。M06-02 覆盖 backend supervisor、shutdown wait、quit flow、maintenance 与 process guard。为 Mac 增加独立 Bash watcher，持续采样 utility process 的子树，保存 PID、进程启动时间和 comm 指纹；关闭管道或 EOF 后仅对身份仍匹配的已观测进程发送 TERM/KILL，并等待进程消失确认。Watcher 使用私有临时目录，不开放监听端口，不按程序名或端口终止进程。

桌面生命周期自动回归续测（2026-11-15）：11 个测试文件 57/57 通过，2 项 Windows Job Object 用例在 Mac 跳过；桌面类型检查退出码 0。日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M06-desktop-lifecycle-regression-20261115-final.log`（SHA-256 `5911e7128d724368d9de624908e474080ae6e24f3a310c08796d636ff4b88c03`），报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-desktop-lifecycle-regression-20261115-final.json`（SHA-256 `9d52214602443046d4b740387016994e136e6c8c26d38a0b3b19f2e4337f1a6b`）。原 56 项回归报告仍保留：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-desktop-lifecycle-regression.json`（SHA-256 `3488c7a848c236030c22618c88524ea97d606272a10b2b55e71e6b6d0cbc2a78`）。

打包应用进程验收（2026-11-15）：为安全启动目录 `.app`，增加仅显式双开关启用、只允许 macOS 打包应用且拒绝经符号链接落入当前用户主目录的数据路径覆盖；普通启动继续使用 Electron 默认 Application Support。4 项隔离路径回归和桌面类型检查通过。重建 Electron 44.4.3 / 版本 1.0.9 `.app` 后，在独立 `/tmp` 数据根启动，`/health/ready` 与 `/api/v1/health` 均返回 200，设置 API 的数据根指向规范化后的隔离目录。强杀 Electron 主进程后，观察到的两个 Utility、GPU、Renderer 和 watcher 进程均退出；独立 Node 对照进程存活。最终报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-packaged-process-20261115-run5.json`（SHA-256 `8b71e62ddb6559ead94427635c4a14efa0066a9bd8ad4d3ee1eedb8da6dc7e63`）。测试临时数据根已清理，未启动到用户现有数据目录。run4 仅因脚本未规范化 macOS `/var` 与 `/private/var` 路径别名而失败；修正比较并清理临时目录后，run5 通过。

真实 Worker 进程类型补验（2026-11-15）：用生产 `guardBackendProcess` 守护一个真实 Node 根进程，让它启动本地 Python 3.12、FFmpeg 8.1.2 和 Chromium 153.0.8010.12；强杀根进程后，三个实际子进程及其已采样后代均确认退出，无关 Node 进程保持存活。该用例已纳入上方 57 项完整桌面回归，并单独记录于日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M06-02-real-worker-guard-20261115.log`（SHA-256 `90a7113e942bcde9ebdc470a714e55133d53fcea746025c9ca3af2b99e0f633e`）及报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-real-worker-guard-20261115.json`（SHA-256 `440241cb7c1b863dff7a8178e58785e288d4793ee3e5fc72b088d02cada65c45`）。该真实 Worker 回收测试的 root 是 Node harness，不是打包应用后端 Utility；因此已验证进程类型和同一 watcher 的清理行为，但仍需在打包应用任务运行期间触发这些 Worker 后再强杀主进程验证集成链路。

打包 Chromium Worker 集成补验（2026-11-15）：从项目本机签名组件缓存将 `xhs-browser` 当前版本复制到一次性隔离数据根；打包应用通过本机 diagnostics `integrity-xhs-browser` 深检，实际由 Electron 后端 Utility 启动 headless Chromium。强杀 Electron 主进程前，报告记录的进程链为 Electron main → 后端 Utility → Google Chrome for Testing，生产 watcher 的 `known` 清单含活跃 Chromium PID。强杀后所有已采样受管进程退出，无关 Node 存活；临时应用数据和组件副本已清理。没有访问平台页面、使用登录态或改动项目组件缓存。最终报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-packaged-browser-worker-20261115-run3.json`（SHA-256 `a2b39de234be1d81f06621fc7d414b05d86080ce7eb67f4f87c478249f3f8459`）。该项证明真实 Chromium 已接入打包应用的 watcher 回收链，但 Python 与 FFmpeg 目前仍在独立 Node guard 测试中运行，尚未在 Electron 后端 Utility 下完成对应集成强杀。

打包 Python/FFmpeg 深检与缓存修复（2026-11-15）：此前一次隔离样本验收发现 `.runtime/packages/python-312` 当前 generation 有 176/2133 个签名文件摘要不匹配，原因是 Python 自检曾改写 `__pycache__`。已修正生产 `cleanEnvironment()`，加入 `PYTHONDONTWRITEBYTECODE=1`，并新增回归断言；`desktop-component-self-test.test.ts` 定向用例 21/21 通过，backend 类型检查通过。随后通过生产 `ComponentManager.startOfflineImport` 从本地正式签名离线归档恢复 Python generation，无网络下载且保留旧 generation；恢复后的 2133 个文件全部匹配 manifest，Python 自检通过。修复报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-python-runtime-repair-20261115.json`（SHA-256 `c1ab2b9d4d08abe80116c9c699786b9a44b1d925cee071311e264ff83d8170f7`）。

打包 Python/FFmpeg Worker 集成复验（2026-11-15）：重新构建 Electron 44.4.3 目录版 `.app`（验证构建版本 1.0.10；源码版本号恢复为 1.0.9；未制作 DMG）。生产深检在 Electron 后端 Utility 下的 Python 3.12 与 FFmpeg 自检均为 `ok`；Python 签名 bytecode 样本在自检前后摘要相同。该次强杀前仍活跃的 Chromium 被 watcher 记录，强杀后所有已观测受管进程退出，无关 Node 存活。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-packaged-workers-20261115-run3.json`（SHA-256 `4a5413e1c63f079d956639b28118c711be9da7bd480f5185b93fcb3ec8d73616`）。

打包真实视频 Worker 强杀集成验收（2026-11-15）：使用用户批准的 `/Users/zyh/Downloads/video.mp4` 和临时隔离数据目录，从生产 video-AI 任务 API 启动真实本地任务。强杀 Electron 主进程前，采样到的进程链为 Electron main → 后端 Utility → Python 3.12 → FFmpeg 8.1.2；watcher 的已知 PID 清单同时包含 Python 与 FFmpeg。强杀后所有受管进程在 15 秒观察窗口内退出，独立 Node 对照进程保持存活，临时数据根已清理。生产 Python/FFmpeg 深检均 `ok`，签名 Python bytecode 自检前后 SHA-256 相同。最终报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-packaged-video-worker-20261115-run5.json`（SHA-256 `3dbad64a0bebeb646a4da2a5d9d1b4396a74c55aa41b2a5310d5ee17e62ca804`），状态 `passed`。此前试跑曾因 diagnostics 维护锁和业务页初次查找时序失败；调整验收脚本等待维护释放并轮询 DevTools 业务页后，真实任务复验通过。早期一次试跑残留的 Python 进程已基于已核实的测试进程链精确结束；本次通过结果没有遗留受管进程。

未完成及原因（截至本次 2026-11-15 探测）：原生窗口红黄绿按钮、Dock/菜单栏恢复、全屏行为和文件/系统权限对话框当时仍未人工检查。此前多次 CUA `getState` 超时；2026-11-15 Node Repl `@oai/cua` 初始化可枚举应用，但 Finder `get_app_state` 45 秒超时并重置内核，Codex 自身窗口因 Computer Use 安全限制被拒。该次没有任何鼠标/键盘操作或截图，因此当时 M06-01 不作 UI 通过结论。此时点结论已由 2026-11-16 解锁后的源码窗口与 Dock/状态栏实测更新，当前结果见下文。访问续试记录 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-access-20261115-resume.json`（SHA-256 `cd9df806c25bca3ef65c72eb6b5ffef22f5b0c693e4d62fb5b1e16d0265efe44`).

原生界面访问续试（2026-11-15）：本轮 CUA 状态清单读取成功，但仅列出其他应用；连接构建目录 `.app` 路径时运行时 30 秒超时并重置，按 bundle ID `com.electron.ecommercetoolbox` 连接时 60 秒超时并重置。`computer.launch_app` 在实际运行时不可用；Finder 本地化名称无法解析。最后一次 Finder bundle ID 连接在用户中断后未返回结果。记录 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-access-20261115-final.json`。未进行鼠标/键盘操作、未返回截图；M06-01 仍等待可读桌面进行真实 UI 验收。

Computer Use 权限续试（2026-11-15）：用户同意重试 Finder 读取后，CUA `getApp("com.apple.finder")` 立即返回 `Computer Use permissions are not granted`；本次未读取 Finder 状态、未截图、未进行输入操作。用户反馈 macOS“屏幕与系统音频录制”中没有 Computer Use 条目，添加列表也找不到；桌面设置截图显示 ChatGPT「电脑操控 → 任意应用」已开启。后续系统设置截图明确显示 macOS「录屏与系统录音」列表中的 ChatGPT 开关已开启；辅助功能授权状态未截图确认。此后尝试通过 `mcp__node_repl` 重读 Finder时，当前运行时没有 `cua` 对象（`cua is not defined`）；本轮工具清单仍未提供 `mcp__cua_repl`，因此没有实际复试。用户另提供 Finder“应用程序”目录截图；当前可见区域未见 ChatGPT/Codex 图标，但截图未展示完整应用列表，不能据此判断应用未安装。最新 Finder 上下文菜单截图显示选中项目名称为“ChatGPT”；截图未包含“显示简介”中的完整路径和种类，故仅确认 Finder 中有该名称的项目，路径/类型待确认。未创建新的应用授权或降低系统安全设置。

CUA 恢复后实测（2026-11-15）：用户提供的后续系统设置截图显示 ChatGPT 的“录屏与系统录音”开关、ChatGPT 与 Codex Computer Use 的“辅助功能”开关均已开启。通过 `@oai/cua` 成功初始化并读取 Finder；“ChatGPT 简介”AX 状态显示 ChatGPT 为 Apple 芯片应用，位于 Macintosh HD/应用程序，版本 `26.1111.21308`。目录版 `EcommerceToolbox.app` 使用隔离数据根 `/tmp/toolbox-m06-01-ui-WItshJ/EcommerceToolboxData` 启动；首页 AX/截图显示 13 个工具、基础服务正常，设置页显示数据根位于该隔离目录，未触碰现有 `/Users/zyh/Library/Application Support/EcommerceToolboxData`（本轮检查时已有 8 项）。第一轮 `Cmd+Q` 后 CUA 返回 `App quit`，启动会话退出码 0（仅有两条非致命 `task_policy_set` 参数警告）。第二轮 `Cmd+W` 与退出复试均遇到 CUA `The user changed ... Re-query`，窗口隐藏/恢复行为不据此判通过；经核对隔离进程 PID 后用 SIGINT 清理第二轮测试应用，退出码 130，进程树消失，临时数据根已删除。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-desktop-access-20261115.json`（SHA-256 `8ec9c74ef5044ba2fd3fcbaea6360b2345ebdcf14940931417eabfa06d821d31`）。M06-01 仍为部分完成：Dock 恢复、全屏、菜单栏动作、活跃任务关闭行为及系统权限对话框未验收。

CUA 权限截图后的桌面复验（2026-11-15）：用户最新截图确认 macOS“辅助功能”中 ChatGPT 和 Codex Computer Use 均开启；结合此前截图，“电脑操控 → 任意应用”与“录屏与系统录音”也均开启。再次成功读取 Finder 桌面状态。目录版 `.app` 在独立 `/tmp/toolbox-m06-01-ui-20261115-aFeFlSWk/EcommerceToolboxData` 启动，首页列出 13 个工具、基础服务正常；保存窗口态和全屏态截图，分别 SHA-256 `443e35edaba0cd1ec328d5ccc52183e986f5a7e74fe81aecf06f347340f0c992` 与 `4d26a238ce175b8396e5ebe4968d13f2aa7000fb5d8d9cbfa409e60257c182ad`。点击绿色窗口按钮后，AX 树中的原生标题栏按钮消失，确认进入全屏。`Cmd+Q` 使进程会话以退出码 0 结束；临时数据根已核对并清理。`Cmd+W` 后 AX 树未变化，不记为通过；点击黄色最小化按钮后，随后 `get_app_state` 可能会激活/提升窗口，无法独立确认最小化状态。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-desktop-access-20261115-followup.json`（SHA-256 `006c919a938a92318c41b59c87fcab2d720d8e339a2829b8fa9ac4d52b0e3966`），窗口与全屏截图保存在同目录 `media/`。

macOS 关闭/恢复行为修复与打包验收（2026-11-15）：实际点击目录版 `.app` 红色关闭按钮后主进程仍存活，`/health/ready` 返回 200；Launch Services `open -a` 再次激活后 AX 能读取业务窗口。加入 macOS Window 菜单标准 `close` role 后，窗口态与全屏态 `Cmd+W` 均保持应用进程和健康接口，随后激活可重新显示同一业务路由；全屏态恢复后 AX 树仍无原生标题栏按钮。`Cmd+Q` 正常退出，退出码 0。Mac 状态栏菜单实现 template 图标、显示/隐藏/退出及点击切换，Dock/application activate 回调恢复窗口；启动诊断关闭后的恢复也有单元覆盖。五个定向测试文件 31/31 通过；桌面类型检查通过。`pnpm desktop:build`、`pnpm desktop:rebuild-native` 与 `node apps/desktop/scripts/package-desktop.mjs --keep-version` 均退出码 0，打包版本保持 1.0.9，资源图标存在；未制作 DMG。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-window-lifecycle-20261115.json`（SHA-256 `0c7b6bc4713fb86f4d14e3df18ab4f6c7ad4e1da3ff06098f9f0837b17d97562`）。

最小化与状态栏可达性复试（2026-11-16）：目录版 `.app` 用双重隔离变量从 `/tmp/toolbox-m06-01-statusmenu-20261116.kO57Hm/` 启动。CUA 点击黄色按钮后，隔离主进程仍存活且 `/health/ready` 返回 `ready`；后续 AX 读取又返回业务窗口，可能已激活窗口，因此最小化状态不记通过。针对 `com.apple.systemuiserver` 与 `com.apple.controlcenter` 的 CUA 状态查询均超时，未完成状态栏图标点击。随后只对已核实的隔离主 PID 发送 SIGINT，确认应用/Helper 进程退出并清理 `/tmp` 数据根。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-window-minimize-probe-20261116.json`（SHA-256 `3428806614cfcc201c3ab55d35fed0cbd938e6c3be9d2c49e78d3c539187b16d`）。

辅助功能截图后的实时复验（2026-11-16）：用户截图显示 ChatGPT 与 Codex Computer Use 的 macOS 辅助功能均开启。CUA 初始化成功，应用列表及 Finder Desktop 状态可读；对隔离目录版工具箱两次请求窗口状态各约 60 秒超时，没有发出点击/键盘输入。用现成目录 `.app` 和 `/tmp/toolbox-m06-01-live.rZ6MI4/EcommerceToolboxData` 双重隔离启动后，应用进程和 renderer 存活，`/api/v1/health` 返回 HTTP 200、`status=ok`。随后只向已核实的专属进程组 302 发送 SIGTERM；会话退出码 143、进程组消失、5173 关闭，临时数据根已删除。没有访问正式用户数据目录，也没有生成可视 UI/菜单验收。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-permission-live-app-probe-20261116.json`（SHA-256 `46ac1c3bb622e0fced0a7a696618406c9559c65ca0f1f64288f74ecdd1275045`）。

权限复核后的 CUA 重初始化探针（2026-11-16）：用户最新截图再次确认 ChatGPT 与 Codex Computer Use 的辅助功能开关均开启。Node Repl 导入 `@oai/cua` 后调用 `cua.initialize()` 等待 30 秒超时并重置 kernel；超时发生在应用状态查询之前，本轮未读取窗口、截图或发送输入事件。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-reinit-timeout-20261116.json`（SHA-256 `cd331a9c5c1930aab238fb69949427cb4e39806daabf293f030654660873c564`）。这条记录确认本次受阻在 Computer Use runtime 初始化，不是 macOS 辅助功能开关关闭；它不替代早前成功读取 Finder 的证据，也不构成应用 UI 验收。

原生文件选择/保存补验（2026-11-16）：目录版 `.app` 通过双重隔离变量启动。图片页面打开原生 macOS“打开”面板并进入 Downloads；视频去字幕页通过原生面板选择用户此前批准的 `/Users/zyh/Downloads/video.mp4`，页面显示 `video.mp4`、754.0 KB，但内嵌媒体报告“无法播放媒体”，故没有运行字幕检测或处理，也未写入 Downloads。随后在诊断页导出默认关闭额外事件的脱敏 JSON，通过原生“存储”面板写入项目内临时子目录；文件为有效 JSON（7,975 字节，SHA-256 `d7eaa4c22c9149bf0bbcf0a6e5cce988a12fa95abccaff708a6bbcfb60fb4c09`），核验后已删除。两次实例均使用隔离数据根；Cmd+Q 未结束后，只对已核实的隔离主 PID 59619、72825 发送 SIGINT，确认无匹配进程残留并清理隔离目录。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-native-file-picker-20261116.json`（SHA-256 `0e0054f9ed832bbe564dac8625aeccf54fc53f53f68797fa9418df81c13b98c8`）。直接保存到 Downloads/Desktop 根目录、局域网和防火墙行为仍未验。

标准文件夹保存、局域网与防火墙状态补验（2026-11-16）：在双重隔离目录版应用中，将脱敏诊断 JSON 分别通过原生保存面板写到 Desktop、Downloads 下新建的临时目录；两份均为有效 JSON（各 7,975 字节，SHA-256 均为 `7f7202f5f576b6111d5b6217293bab614eefa276e541a6b819316a89f713ab1b`），随后清理输出和临时目录。应用局域网面板显示本机私网访问地址，并提示仅与可信局域网共享、检查防火墙/网络隔离且应用不会自动修改防火墙。隔离应用监听 `*:5173`；从本机以私网地址请求 `/api/v1/health` 返回 HTTP 200、`success=true`、`data.status=ok`。`socketfilterfw` 报告全局防火墙关闭、阻止所有连接关闭，故未出现系统入站提示；未开启或修改防火墙，也未用手机/第二台电脑发起访问。只对已核实隔离主 PID 79133 发送 SIGINT，确认主进程与 helpers 退出后清理应用数据根和临时响应文件。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-02-root-save-lan-20261116.json`（SHA-256 `60726d0bf539dba1eff8a1e8de4025b18c33f9bb4cca90b4fbc4a11c55da2a46`）。

权限截图后的隔离复读（2026-11-15）：用户最新截图再次确认 ChatGPT 与 Codex Computer Use 的辅助功能开关开启；CUA 成功读取 Finder 桌面状态。随后从终端直接启动目录版 `.app`，显式设置两个隔离数据变量，Electron 参数显示 user-data 位于 `/tmp/toolbox-m06-01-menu-20261115.ek7ptR/EcommerceToolboxData/` 下；首页显示 13 个工具、基础服务正常。两次 CUA 退出快捷键尝试均未结束应用；之后以 SIGINT 停止该临时应用（退出码 130），进程树消失，隔离临时目录已清理。此轮没有实际点击状态栏菜单，也没有访问默认用户数据目录。更新后的运行报告同上。

验收副作用说明（2026-11-15）：隔离运行退出后，一次 CUA `get_app_state` 自动重新启动同一 `.app`，进程参数显示默认数据根 `/Users/zyh/Library/Application Support/EcommerceToolboxData/.runtime`。我立即通过 CUA `Cmd+Q` 正常退出，并确认该 bundle 的主进程和 helpers 均不再运行。没有检查、手动更改、删除或清理默认数据目录；应用启动期间是否产生常规启动写入未知。此后不会在未设置双重隔离变量时通过 CUA 启动或读取该应用。

M06-02 的进程归属/回收、文件选择、Downloads/Desktop 临时目录保存、同机私网健康请求及同网手机图文/图片上传下载已验；启用防火墙时的系统入站提示仍待用户桌面端验收。基础实机 LAN 报告 `reports/M07-02-phone-lan-basic-acceptance-20261116.json`（SHA-256 `bbb7655d1b8bfc1ddb573948fa86f5ece676b43884b6eaa1714f1428634e2d11`）。M06-01 已完成：源码窗口、Dock 恢复、状态栏菜单、全屏进入/退出、播放中退出保护及播放中隐藏恢复均有实测。用户要求暂停所有后续功能测试，改由其在桌面端逐项验证；未完成的设备/协议验收保持待验。未运行 `desktop:make`，未制作 DMG。

## M07：快捷键、触控板与局域网

状态：部分完成。视频时间线区间/坐标、LAN 上传续传与权限契约、系统代理处理的自动回归通过；Computer Use 权限已开启且可读取 Finder/应用，但注入键鼠事件不能替代真实键盘/触控板人工验收。同网手机已实测根页面、虚构图文发布、PNG 图片上传及预览/下载；基础报告 `reports/M07-02-phone-lan-basic-acceptance-20261116.json`（SHA-256 `bbb7655d1b8bfc1ddb573948fa86f5ece676b43884b6eaa1714f1428634e2d11`）。后续 64 MiB 分片暂停/续传及合成视频拖动测试文件已放到手机，用户要求暂停所有后续功能测试且未提供这些项目的结果；暂停报告 `reports/M07-02-phone-expanded-paused-20261116.json`（SHA-256 `d394494a6e781153e61a4dba819831fb3f4bb62feb22ef0cc7bb7238ea8d208e`）。手机类型/扫码、Android、第二台电脑、分片续传、手机媒体 Range、过期权限及防火墙拒绝提示仍待用户桌面端逐项验收，F13 保持部分完成。

自动回归：API LAN/访问/路由/代理 6 个文件、72/72 通过；前端 LAN 上传/续传及视频时间线坐标和区域 16 个文件、58/58 通过；桌面系统代理 1 个文件、5/5 通过。后端及前端类型检查均通过。完整命令与测试范围见 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M07-input-lan-regression.json`（SHA-256 `b2eb349a21a5d375458de72eef44fb10ea16eb27065a18a80c8967c5819144de`）。

F13 现记录为部分完成：自动测试覆盖分片、续传、配额、取消、Range、过期、访问权限和页面契约；一台同网手机完成基础图文与单图传输，详见基础实测报告。扩展手机测试按用户要求暂停，暂停前未收到上传/续传或视频拖动结果；手机类型/扫码、续传/Range/过期权限、Android、另一台电脑和防火墙拒绝提示仍待用户桌面端验证。F13 报告：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/F13.json`（SHA-256 `69d870f98c7dcf3fc5aa9c036cf524e2506b8a6aa9ed7b9ac07e06a1a9f11330`）。

未完成及原因：此前 CUA 报告 Mac 锁定且无法自动解锁，后续用户截图确认授权并恢复了桌面读取；本轮已能通过 CUA 操作目录版 `.app`。CUA 注入的键鼠事件不能替代计划要求的真实键盘/触控板人工验收，故删除保护、输入法组合、Retina/全屏坐标、触控板缩放仍待人工确认。也没有真实 iPhone、Android、另一台电脑网络流量或防火墙拒绝提示。设备验收需在可用硬件上完成；自动回归不代替上述人工和跨设备验收。

下一任务与前置条件：M08-01 合成迁移契约及临时挂载 APFS 卷回归已完成；用户提供的真实 Windows 导出包已完成隔离导入与抽样使用，细节见下文。M09-B01 已通过 LaunchServices 对 `.command` 的生产冷启动；没有声称物理双击。M06/M07 的部分人工与真实设备验收仍未完成。

## M08：Windows 到 Mac 数据迁移

M08-01 状态：完成。备份/恢复自动回归 3 个 API 测试文件 76/76 通过，前端备份交互 1 个文件 12/12 通过，后端类型检查通过。覆盖多个独立数据根下的受管路径重建、九个持久模块与组合包、merge/replace、未选模块保留、ID/媒体关联改写、恢复点、事务失败回滚、摘要/空间/不安全路径校验。夹具使用含中文和空格的 Mac storageRoot；本轮把文件冲突键统一为 Unicode NFD + 小写，ZIP 入口和模块路径拒绝大小写与 NFC/NFD 等价重复，补充两项负向回归。原始契约报告：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/S02.json`（SHA-256 `9a28d5d1ad37068dd9b847e7b703137717fa5dbbdb2ed5e1cc62939a94c22f13`）。

外置卷实测（2026-11-14）：创建临时 4 GiB sparse APFS disk image 并挂载至 `/Volumes/ToolboxExternalValidation`，设置 Node `TMPDIR` 后重新运行 `data-backup-entry.test.ts`、`audio-library-backup-merge.test.ts`、`module-data-backup.test.ts`，3 个测试文件 76/76 通过；全套合成备份/恢复临时根实际位于挂载卷。零可用空间保护用例在该次运行中通过现有 `statfs` mock 验证。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M08-01-external-volume-20261114.json`（SHA-256 `66178a6f24386c9b86ff90f8744ddff35355d17112d8273d5ad30409f97d14de`）。测试后已卸载并删除稀疏映像；挂载点与映像当前均不存在。

限制：M08-01 的合成测试及临时稀疏 APFS 卷不代表物理 USB 或其他文件系统。先前按文件名查找真实包未命中；该结果已被用户随后提供的备份包验收取代。

**M08-02 状态：部分完成。** 真实包完整导入与抽样使用通过；CUDA 历史记录项无样本。2026-11-15 用户提供 `/Users/zyh/Downloads/toolbox-backup-2026-11-15.zip`（SHA-256 `4e67c4d3db396b9efe4369f6af8776e638d21084ae831cb2fd08ebf28040a81f`）。包含 9 个持久数据模块，共 3,483 条记录、2,107 个文件描述符、2,373,763,515 字节媒体数据；全部模块索引摘要、2,059 个独立媒体对象摘要、包结构与领域校验通过。未发现路径穿越、符号链接或包外配置/模型根。

完整 `replace` 导入到全新隔离根 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M08-02-real-import-20261115/isolated-data-root`，未读写正式用户数据根。恢复后九模块领域记录数与来源完全一致，SQLite `quick_check` 为 `ok`，外键错误为 0；847 条归档记录通过业务 API 读取。代表图片媒体成功打开，并从导入记录调用图片压缩 API 重新生成 WebP（1086×1448，输出 155,404 字节）。M08-01 已覆盖 merge、replace 与回滚合成证据。

任务历史核对补充：Mac 通用 `TaskStore` 固定上限为 1,000 条。应用加载领域数据时会重建图片/语音任务投影；来源中的 2 条归档配乐通用投影达到容量上限后未留在通用任务列表，但对应 `archive-video-edit-job` 领域记录仍在，逐条详情 API 返回 200。所有来源通用任务均能从通用任务表或同 ID 领域记录读取。备份内有 0 条 CUDA 视频任务，因此无法以真实 CUDA 历史记录验收其旧设备显示；当前样本中的视频历史模块记录已完整导入。

报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M08-02-real-import-20261115/report.json`（SHA-256 `112414224ae5c19e62ea1cd53b4b3649dd02801c07bb6761989421551d52366e`）。隔离导入数据保留在该验证目录，以便后续桌面人工复核；它不是应用正式数据根。

下一任务与前置条件：M09-B01 源码生命周期与 LaunchServices 冷启动、M09-B02 配置和目录构建均已有证据；物理鼠标双击和窗口画面没有验收。M09-B03 仍待真实 DMG、干净环境及计划所需设备验收；按用户要求，本轮未制作安装包。

## M09-B01：Mac 启动、停止与资源预检

状态：完成（12/12 本地归档已校验、10 项能力已离线安装并通过生产自检；Electron 冷/热启动、复用、停止、仓库外中文空格路径、ZIP 无 `.git` 解压后的入口启停、占用端口保护及 LaunchServices 生产冷启动均有证据。未声称物理鼠标双击或可视窗口验收）。

完成内容：新增根目录可执行入口 `start.command` / `stop.command`，脚本定位项目根目录而非调用者 cwd，不依赖 `.git`；执行前要求原生 Apple Silicon 和 Node 24。启动器优先使用固定版本 pnpm；必要时使用已缓存 Corepack，并关闭 Corepack 网络获取，找不到固定版本时明确提示，不安装 Homebrew 或 workspace 依赖。启动先构建共享契约，再调用生产 `ComponentManager` 的源码离线 bootstrap；Mac bootstrap 按原生 `python/bin/python3.12`、`bin/ffmpeg` 和 Chromium 路径解析已安装资源，拒绝 CUDA 参数，缺失归档时一次列出，端口冲突只提示并退出。成功后构建桌面源码并在独立 session/process group 启动 Electron。

停止记录保存在被忽略的 `.runtime/macos-source-launcher/`，记录项目根、PID、PGID、进程启动时间、命令摘要和日志路径。`stop.command` 先校验记录、PID 重用指纹与独立进程组身份，再发 TERM，必要时仅对相同组发 KILL；不扫描端口或按名称结束进程。入口日志为 `.runtime/macos-source-launcher/desktop.log`。`pnpm dev:ai` 已改用跨平台 Node 启动器，Mac 选择 `.venv-image-ai/bin/python`，保留 Windows 路径和离线 Paddle/HuggingFace 设置。

资源准备由用户显式运行 `corepack pnpm macos:prepare-resources`；工具从签名 Mac catalog 读取 12 个 HTTPS 归档，安全处理 HTTPS 重定向，下载时限制到签名大小并逐项校验字节数/SHA-256，失败删除 partial，正确文件可按摘要复用。`corepack pnpm macos:resources-status` 只读核对本地文件。

执行与限制：签名 Mac catalog 的 12 个归档（6,133,503,214 字节）从本地正式候选 feed 逐项按字节数/SHA-256 校验，再以硬链接复用到被 Git 忽略的 `offline-resources/components/`；资源状态命令通过 12/12，未另占用归档副本。源码启动器执行生产离线初始化后，Python 3.12、FFmpeg、Edge-TTS、Image AI、Chatterbox、XHS Browser、XHS Archive、XHS Translation、Douyin Archive、Video AI 共 10 项均完成安装自检，整个过程使用 `--no-index` 和本地归档。首次启动发现 Electron 运行时缺失，Electron CLI 隐式下载失败；已清理过期启动记录，并为 `start.command` 加入 Electron 文件预检及实际进程组等待，避免运行时缺失时再次隐式联网。运行时安装后，两轮源码冷启动、热启动复用与停止均退出码 0；第二轮从 `/tmp` 通过含中文和空格的路径调用，启动器仍解析到本项目，停止后 PID、会话记录和临时路径均清理。生命周期报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B01-launch-lifecycle-20261114.json`（SHA-256 `120a623fce8fe203feb99e4f9915c81412cb93d0756b4a2290267facd99c284a`）。定向回归合计 29/29 通过，日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M09-B01-B02-targeted-node-tests-20261114-final.log`（SHA-256 `386f3ac0911f49c225196da1bf5a3177aab4b2189720625bd16372ec2e84a2f6`）。`start.command` / `stop.command` 当前均为 755。当前工具环境系统 `pnpm` 为 11.25.0，启动器通过禁用网络获取的 Corepack 选中了仓库锁定的 11.7.0。

ZIP 权限补充实测（2026-11-14）：对 `start.command` 和 `stop.command` 用 macOS `/usr/bin/ditto` 创建 ZIP 并解压，两个文件均保留 `0755` 执行权限及原 SHA-256；临时归档与解压目录已清理。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B01-ditto-zip-permissions-20261114.json`（SHA-256 `2d9ceec244d2da89adb8bb6e9e01855c6f500eb75a5de4c674dcf9ea23ce123c`）。

ZIP 无 `.git` 及占用端口保护集成回归（2026-11-15）：新增 `scripts/macos-project.test.mjs` 用真实 `zip`/`unzip` 建立中文空格目录的最小源码归档，不包含 `.git`；归档解压后直接运行真实 `start.command` 和 `stop.command`，生产 `macos-project.mjs` 完成隔离启动记录与进程组启停。测试让同一主机端口保持由外部服务占用，模拟 Electron 收到 `EADDRINUSE` 后仍运行，再通过 `stop.command` 停止本项目，验证外部监听仍存活。pnpm、bootstrap 与 Electron 由本地替身模拟；这验证入口、PGID 和冲突时不误杀，不声称是完整生产应用启动。六项 launcher 用例 6/6 通过，报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B01-command-zip-no-git-20261115.json`（日志 SHA-256 `fa92bdfc6fed68f2f080e8e9ddde1b142fc01c017913335bc34a4645022b5ec6`）。

受限 PATH 补充实测（2026-11-15）：`env PATH=/usr/bin:/bin ./start.command` 命中 Node 缺失门禁，退出码 1 并明确提示需要 Node.js 24 及重新打开终端/Finder；未启动桌面进程。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B01-restricted-path-20261115.json`（SHA-256 `6853f2aadcbca8b6cd218f9c4644fe2086343edc148b4af7d269a8c1ca6024c8`）。当时该受限 PATH 探针和 ZIP 测试尚不能代表实际 Finder 环境；后续 LaunchServices 生产冷启动已补足 `.command` 文件关联及原生 PATH 验收，物理鼠标双击和窗口画面仍未验证。

Finder 启动入口隔离探针（2026-11-16）：在 `/tmp` 创建临时目录，复制项目 `start.command`（源/副本 SHA-256 均为 `780f72f60a55f42596207899a24db0c69ed33e452b420849af9adcd7f7c4d915`，权限 `0755`），只将临时目录中的 `scripts/macos-project.mjs` 换成不启动应用的记录 stub。通过 Finder 的“打开”辅助操作执行该 `.command`，结果文件证明 Finder 所用 Node 为 `v24.18.0`、架构 `arm64`；当前目录为 `/Users/zyh`。没有启动工具箱或访问用户数据；等待提示期间的临时 shell 后续确认已退出。该项验证了 Finder 到 `.command` 的执行通道与 PATH 可用性，但不是物理双击，也没有运行项目 bootstrap、资源检查或应用启动；不能据此关闭 M09-B01。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B01-finder-launch-probe-20261116.json`（SHA-256 `3a63f5a8fb935d8922e55a2e781908474cb0abe4c9d0c67353173b1b8cb62cbf`）。

隔离源码冷启动和正常停止（2026-11-16）：为避免源码版 Electron 写入用户级 Application Support，新增仅在 macOS、双显式隔离开关及 `TOOLBOX_SOURCE_MANAGED=1` 同时满足时启用的数据根；默认启动行为不变。定向单测 5/5 通过。源码生产启动器通过 Node CLI 冷启动：10/10 本地签名能力包完成安装自检，共享/后端/前端/staging/Electron 构建成功；Electron 主进程和渲染进程存活，隔离根内 `http://127.0.0.1:5173/api/v1/health` 返回 HTTP 200、`status=ok`。随后运行项目 stop 命令退出码 0，进程组、会话锁和临时数据根均清理，5173 无残留监听。没有处理真实素材或登录平台。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B01-source-isolated-start-stop-20261116.json`（SHA-256 `444af1a7fafd6f9de2464af1176d643b1fa2f1b89c1a8b7f4b6dc33db13a1ab8`）。

Finder/LaunchServices 实际源码冷启动（2026-11-16）：第一轮暴露原生 Finder Terminal PATH 有 Node/Corepack、无 `pnpm` 的问题；已归档失败日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M09-B01-finder-pnpm-path-failure-20261116.log`（SHA-256 `7f36049e004ebee2d5e73e613f8211a1cbb43b88cf76c5ac5bd16bc2bfa1cb66`）。启动器现为 Corepack 回退添加校验过的项目级 pnpm shim，测试 8/8 通过；还将 `ps lstart` 固定为 C locale 并规范化旧中文时间，以保持 PID/PGID/命令摘要/开始时间身份检查有效。第二轮由 macOS LaunchServices 打开 `.command` 并进入 Terminal，生产启动器完成 10/10 离线能力自检及全部构建，Electron 主/渲染进程启动，健康检查 HTTP 200；运行 stop 命令退出码 0，进程组和临时数据清理。成功日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M09-B01-finder-source-start-20261116.log`（SHA-256 `906667604d06fa5ab52641bebc391f63523cc5b8b1c1597c7b0ef724035b596b`）。这验证了真实 `.command` 文件关联冷启动，但没有进行物理鼠标双击。截图捕获返回黑帧，因此不声称可视窗口验收。

下一任务与前置条件：M09-B01 已完成。M09-B02 的配置检查和目录 `.app` 构建已完成，真实 DMG 尚未制作；M09-B03 未开始。继续按用户既有要求不自动制作安装包，最终审计已逐项记录仍待外部设备、人工验收和真实安装的范围。

## M09-B02：打包配置与内部构建前检查

状态：部分完成（Mac 配置、手动 workflow、全 workspace 构建、Electron 原生模块重建和 staging 检查完成；目录 `.app` 可构建，未制作真实 DMG）。

完成内容：Mac DMG 文件名统一为 `电商工具箱-mac-arm64.dmg`；保留 `EcommerceToolbox` 内部英文 bundle/executable 名；electron-builder 显式限制 `dmg`、最低 macOS 14.0、ad-hoc identity `-`、不启用 Hardened Runtime、公证或 updater，并剔除 Windows NSIS/证书/publish 项。Mac 分支拒绝 `DESKTOP_RELEASE=1`，不会要求 Windows 证书；Windows 构建/发布路径保持现状。手动 macOS workflow 在构建前检查 `uname -m` 必须为 `arm64`，仍仅 `workflow_dispatch`。输出断言和 workflow artifact 路径已更新。

就绪清单：[docs/macos-internal-build-readiness-2026-11-12.md](macos-internal-build-readiness-2026-11-12.md)。其原始 2026-11-12 版本快照记录当时版本 1.0.9、预计升到 1.0.10、输出路径、签名边界和磁盘估算；2026-11-16 已补录当前版本 1.0.11、默认 `desktop:make` 目标版本 1.0.12、tag01 已完成及目录版 `.app` 仍为 1.0.9。签名 Mac 目录声明 6,133,503,214 字节压缩包和 19,780,004,096 字节安装体积；完整保留两者约需 24.14 GiB，峰值还需 staging 和构建空间。当前可用空间约 110 GiB；DMG 体积/构建峰值未实测。

构建与原生资源核验：`corepack pnpm typecheck` 通过全部 5 个 workspace 项目；`corepack pnpm desktop:build` 退出码 0，日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M09-B02-desktop-build-20261114.log`。初次 native rebuild 因前端 dist 尚未构建而失败，之后在完整桌面构建后重跑 `corepack pnpm desktop:rebuild-native`，退出码 0，日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M09-B02-desktop-rebuild-native-final-20261114.log`。staging 验证报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B02-stage-verification-20261114.json`：10/10 Mac manifest 使用嵌入受信任 Ed25519 key 验签；编译 backend chunk 含全部 manifest 签名，source map 中的生成 catalog 与源码逐字节相同；SQLite/Sharp native binary 均为 arm64 且 `codesign --verify --strict` 通过，`codesign -dv` 显示 ad-hoc 签名。

自动回归：Mac launcher/offline resource/image launcher/desktop packaging 定向测试合计 29/29；生产源码 bootstrap/resource 测试 23/23，另 1 项 Windows-only 跳过。包配置测试验证 Mac 名称、目标、minimumSystemVersion、identity、禁用更新、无 Windows NSIS 字段和禁止 Mac release signing。Electron 44.4.3 运行时已安装；归档 130,115,866 字节，SHA-256 与 GitHub 官方校验文件及 Electron 包内置 checksums 一致。运行时下的 ABI smoke 使用 Node v24.21.0 / ABI 149，SQLite 内存查询通过，Sharp 成功生成 2×2 PNG；报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B02-electron-runtime-validation-20261114.json`（SHA-256 `126a7052189e7ec31c60c5ca0251e2f67d5f1a1d98ad1fe33f2d1009996c649f`）。

目录 `.app` 构建补充（2026-11-15）：Electron Packager 在 macOS 返回平台输出目录而非 `.app` 本身；`tooling/build/package-desktop.mjs` 已规范化这两种返回形式，回归夹具改为模拟 Packager 实际返回值。`node --test tooling/build/desktop-version.test.mjs` 17/17 通过；`corepack pnpm --filter desktop run package --keep-version` 成功生成 `apps/desktop/out/EcommerceToolbox-darwin-arm64/EcommerceToolbox.app`，版本仍为 1.0.9。应用包为 672M、arm64，内部 Electron 可执行文件显示 ad-hoc 签名，必要 backend/frontend/app.asar 资源存在。该目录包只证明可打包，不是 M06 真实进程验收；未运行 `pnpm desktop:make`、未生成 DMG，也未递增版本。

依赖与剩余验收：M08-02 的 Windows 实包已完成隔离导入与抽样再编辑；CUDA 历史样本为 0，仍按部分完成记录。M03-04 tag01 的 32 项远端资产、正式签名目录和十项在线安装均已通过。真实 DMG 的签名、目录和磁盘峰值只能在制作 DMG 后验收。用户要求不自动制作安装包；没有执行 `desktop:make`。

文档同步（2026-11-14）：README 与旧 Mac 指南已更新为当前 macOS 14+ 目标、十项 Mac 能力、本机离线安装/自检状态及 M03-04、M06/M07、M08-02、M09-B03 的剩余门槛；移除了“能力目录为空”“八项能力”“当前 CPU-only”及将 `desktop:make` 当普通构建步骤的过时表述。指南保留旧范围仅作历史背景。用户已明确 Release 可变性不构成发布门槛，M05-03 的 TikTok 主页列表 F07-05 暂时跳过且仍未验收。

## M09-B03：打包后干净环境验收

状态：未开始。需要 M09-B02 前置检查完成、用户执行或明确授权一次 `pnpm desktop:make`，并提供满足计划要求的干净验收环境；不得以当前开发 Mac 的自动回归替代安装版测试。

辅助功能权限截图（2026-11-16）：用户再次提供 macOS“辅助功能”设置截图，ChatGPT 与 Codex Computer Use 开关均为开启。它补充确认系统授权状态；本条不代表本轮重新调用了 CUA，也不改变仍缺少真实键盘/触控板及跨设备验收的状态。

## 最终审计（2026-11-16）

依据 [Apple Silicon 全功能适配计划 §8.1](macos-apple-silicon-implementation-plan.md)，逐项结论如下。完成阶段成果不等于完整目标完成；凡设备或安装环境缺失均保持待验。

| # | 计划验收项 | 结论 | 证据与未满足范围 |
| - | --- | --- | --- |
| 1 | 十类 Mac 能力资源可信、原生，支持离线安装和导出再导入 | 全项通过 | 正式 tag01 的 12 个归档、10 个 manifest、10 个 SPDX 的签名/摘要审计及十项真实 HTTPS 安装、自检通过。2026-11-16 使用正式 darwin-arm64 Catalog，在单轮验收中对十项分别执行生产导出和依赖闭包离线导入；独立目标根全部健康，新 Manager 重启复核十项仍健康且十个签名资源解析通过，导入网络请求为 0。单轮报告及全部 ZIP/SHA-256：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-ten-ability-offline-roundtrip-20261116/report.json`。 |
| 2 | 四档视频去字幕和本地克隆在 M1 16 GB 约定范围完成，保持算法、分辨率、原音轨和数据 | 核心真实样本通过，资源观测部分完成 | STTN MPS FP32 与 ProPainter Hybrid FP16 的真实视频任务完成；用户接受 STTN 样本、ProPainter 画质及约 28.5 分钟耗时。Chatterbox MPS 三语推理完成且听感获用户接受；正式 Worker 英文短样本记录 MPS driver allocation 峰值 10.77 GB、当前张量分配峰值 3.52 GB、Worker 峰值 RSS 3.13 GB（M01-03 内存报告 SHA-256 `04f4e2bb7c902c506bb63fdc45928ed4a539bfc9cfa1c85281c8fd1d9dcb9e04`）。M1/16 GiB 主机记录与任务报告可复核；资源测量未覆盖三语全部负载及视频处理各档/整机统一内存峰值，因此本项资源观察仍部分完成。 |
| 3 | 13 模块、归档编辑/备份/桌面/LAN 实际闭环，人工画质和听感确认 | 部分通过 | 图片 AI、配音和视频真实样本画质/听感已由用户确认，Windows 备份已隔离导入并抽样再编辑。用户指定暂缓的 TikTok 主页历史 F07-05 明确保留为未验；同网手机已成功打开 LAN 首页、发布虚构图文、上传页面 PNG 并确认可打开/下载；桌面 Dock/状态栏隐藏恢复及播放中退出保护已由用户实机确认，更广泛的物理键盘/触控板验收仍未完成。M07-02 实测报告 `reports/M07-02-phone-lan-basic-acceptance-20261116.json`（SHA-256 `bbb7655d1b8bfc1ddb573948fa86f5ece676b43884b6eaa1714f1428634e2d11`）。分片/媒体 Range 扩展复核按用户要求暂停；手机类型/扫码、另一台电脑、过期权限及防火墙拒绝提示仍待用户桌面端逐项验收。系统防火墙关闭，本轮未更改网络/防火墙设置。 |
| 4 | 无开发环境安装、覆盖、移动应用、重装和重启复用 | 源码运行通过，安装版待验 | `.command` 冷/热启动、离线资源 bootstrap、健康检查、正常停止及 LaunchServices 冷启动通过；已有目录 `.app` 构建。没有 DMG 安装版、干净环境初装/覆盖/移动/重装/重启证据。 |
| 5 | Windows 受影响契约/单测及 Windows 原生/安装结果 | 部分通过 | Mac 上运行的共享契约/测试及平台保护证据在对应任务中记录；当前没有 Windows 原生设备、安装版或真实任务验收结果。 |
| 6 | macOS 14 和至少一台后续 M 系列设备实测 | 未满足 | 实测主机为 Apple M1、macOS 15.6.1；没有 macOS 14 或后续 M 系列设备记录。兼容性不得表述为实机通过。 |
| 7 | 未选模块、已有数据、旧签名资源、现有权限和非商用限制保持 | 已验证部分关键边界，安装版待验 | 备份恢复覆盖未选模块保留与回滚；迁移和启动验收使用隔离数据根，未将真实数据导入正式数据目录；正式签名资产只按获准流程替换，非商用许可限制保留。未完成安装/覆盖流程，故最终安装场景下的数据与旧资源保留仍待验。 |

第 6 节的 128 个检查槽位已逐项补齐状态和报告摘要校验：124 项通过，4 项部分完成，未留空。部分项是用户要求暂缓的 TikTok 主页历史、真实 LAN 设备与防火墙提示、备份中的历史 CUDA 视频任务，以及桌面真实睡眠唤醒检查。逐项状态与 SHA-256 位于 `.package/macos-validation/20261109T085328Z-e00daf0c/cases.json`；F08 的 LaMa 快速档真实 API 成品已完成媒体/原片核验，画质复核单独待用户结论，不影响已有 STTN 与 ProPainter FP16 的通过证据。

总判定：计划目标尚未完成。用户已要求暂缓 F07-05，且要求不自动制作安装包；这两项按原指示保留为待验/未制作，不计作通过。其他主要剩余项为 M06/M07 人工与跨设备验收、Windows 原生/安装结果、macOS 14 与后续 M 系列设备，以及 DMG 和干净环境安装验证。未自动提交、推送或制作安装包。

辅助功能权限截图后的 CUA 重试（2026-11-16）：截图确认 ChatGPT 与 Codex Computer Use 的 macOS 辅助功能开关均开启；CUA 本轮初始化约 30 秒后成功，应用枚举确认工具箱原先未运行，Finder Desktop AX 状态可读。以现有目录版 v1.0.9 `.app` 和隔离数据根启动后，对 `com.electron.ecommercetoolbox` 的状态查询在 45 秒超时；未发送鼠标或键盘事件。应用启动时 `/api/v1/health` 返回 200，随后清理序列已向该进程组发送 SIGTERM；约 5 分钟时检查发现 PID 18207 和两个应用 Helper 仍存活、5173 已无监听，GPU 子进程退出及网络服务重启发生在清理信号之后，因此不据此判为应用自发故障。对已逐项核实属于该 `.app` 的专属进程组发送 SIGTERM 后，进程组退出、端口关闭、隔离数据根清理。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-reinit-app-attempt-20261116.json`（SHA-256 `fe16970e4097f5f4b2bbb4c16518df3f964259a6b23efdbc37c84cdce30d2a99`）。该条记录仅反映此次超时；稍后的解锁后复测已成功读取源码窗口和原生控件，见 M06-01-cua-native-window-controls-retest-20261116.json。

原生屏幕捕获替代探针（2026-11-16）：为绕过 CUA 应用 AX 查询超时，在隔离目录版 `.app` 启动后用系统 `/usr/sbin/screencapture -x` 读取屏幕，没有发送输入事件。启动及约 1 分 51 秒时 health 均返回 200；发送 SIGINT 开始清理后 health 检查失败；截屏返回 2880×1800 的全黑图像（SHA-256 `4c858cc6b5673e452d36b89f3b8b6e4b285a0cdf3518d743f7765cb1e3ab1b04`），因此不能判断应用窗口是否可见，也不能据此推断 ChatGPT 的屏幕录制授权状态。独立 CoreGraphics 窗口列表探针未在观察窗口内返回，未取得窗口 ID/标题；随后在 SIGINT 清理过程中 health 检查拒绝连接；该状态视为清理期间观察，不能说明服务自行停止。随后仅清理已核实属于本次 `.app` 的隔离进程组；确认无匹配应用进程、5173 监听或临时数据根残留。截图保存在 `.package/macos-validation/20261109T085328Z-e00daf0c/media/M06-01-native-window-capture-20261116.png`；报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-native-window-capture-20261116.json`（SHA-256 `a7721fa70abfdd55a8b1932a51b7c2e12f1a14194dc80ab0e8c6fe11aa56f174`）。该替代截屏路径未能显示 UI；后续 CUA 已读取源码窗口，且用户实机确认 Dock 与状态栏菜单交互通过，详见 M06-01-cua-native-window-controls-retest-20261116.json。

GitHub 最新代码同步后的桌面回归（2026-11-16）：在 HEAD `413fa1c5759e76dd8d94b05d1ac8b326d7fbedc9`、桌面版本 1.0.11 与工作区桌面实现差异摘要 `643ac9aa3d160260ec3ff61d93451b67e9bf70857b4704539947b292ed785c50` 下，使用固定工具链 `corepack pnpm` 11.7.0 重跑 M06 生命周期 11 个测试文件，59 项通过、3 项按平台/环境跳过；桌面类型检查退出码 0。跳过的三项为 2 个 Windows Job Object 用例，以及未设置可执行文件路径的 1 个真实 worker 进程树用例；该真实 worker 用例另有 2026-11-15 实际 Python/FFmpeg/Chromium 通过证据。日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M06-desktop-lifecycle-regression-20261116-corepack.log`（SHA-256 `5edbd859c61fa63a8cbccaa7fd417ea6b01c82df3fc587c55fb40b9f8b033396`），报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-desktop-lifecycle-regression-20261116-post-sync.json`（SHA-256 `e337fcea3cbd9a10efb415a54a2735df857042f9c4161a0b947f9f69241f5bfa`）。此轮自动回归本身不覆盖人工键鼠；Dock 与状态栏菜单已在后续同日实机复验中确认通过，键鼠仍待实机确认。

当前源码版的 CUA 状态读取对照（2026-11-16）：由生产 `node scripts/macos-project.mjs start` 在显式双开关和 `TOOLBOX_SOURCE_MANAGED=1` 下冷启动；10 项本地签名能力均已安装并复用，源码构建完成。Electron PID 30067 的 `--user-data-dir` 指向 `/private/tmp/toolbox-m06-01-source-cua-20261116/EcommerceToolboxData/EcommerceToolboxData/.runtime`，health 在 CUA 前及超时后均返回 HTTP 200。CUA 初始化成功并将 `Electron (com.github.Electron)` 列为运行应用，但 `get_app_state` 在约 60 秒超时并重置 Node Repl；未发送任何输入事件。随后使用生产 `node scripts/macos-project.mjs stop` 正常停止（退出码 0），确认 session/lock、进程组、5173 监听及隔离数据根均清理；默认 Application Support 数据目录未被应用使用。日志 `.package/macos-validation/20261109T085328Z-e00daf0c/logs/M06-01-source-cua-20261116-start.log`（SHA-256 `e3189ab44fd7bb5696ad399b3d5afd8ad4ba2716daa364597f0d274a88b48e51`），报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-source-cua-20261116.json`（SHA-256 `9f30fae99fcdaffde5f561f2125d2ed28d9ef872d091dee1e9e7d3a9046916af`）。该对照显示 CUA 枚举可以读取，但 Electron 应用状态查询在当前源码版也超时；M06-01 仍无真实窗口交互通过结论。

延长初始化等待后的源码窗口探针（2026-11-16）：用户截图确认 ChatGPT 与 Codex Computer Use 的辅助功能开关均开启。将 CUA 初始化等待上限调至 90 秒后初始化成功、应用枚举成功；随后启动当前源码 Electron（PID 38126），隔离参数指向 `/private/tmp/toolbox-m06-01-cua-extended-20261116/EcommerceToolboxData/EcommerceToolboxData/.runtime`，查询前 `/api/v1/health` 返回 200。再次请求 `com.github.Electron` 窗口状态时，Node Repl 在 60 秒请求上限内返回执行超时并重置内核；没有发送输入事件，也未取得窗口树或截图。用 `node scripts/macos-project.mjs stop` 退出码 0 清理，核实本应用进程组、5173 监听均消失，临时数据根已删除。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-extended-app-state-20261116.json`（SHA-256 `a79257d9fce2b42cf0bbe742340458e88b27ff458d8e0dc831ee2a5b617211a7`）。该超时是此探针的结果，后续已解锁源码窗口复测成功，详见 M06-01-cua-native-window-controls-retest-20261116.json。


原生 Accessibility API 与锁屏原因核验（2026-11-16）：当前执行进程 `AXIsProcessTrusted()` 返回 true；Electron 原生窗口属性仍只返回 `AXApplication` 元素。`CGSessionCopyCurrentDictionary` 报 `CGSSessionScreenIsLocked=1`，NSWorkspace 前台 bundle id 为 `com.apple.loginwindow`，目标 app 不能置前。这解释了本轮窗口不可读，但不代表前几轮 CUA 超时都由锁屏导致。隔离实例已停止且临时根已清理。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-ax-lockscreen-block-20261116.json`（SHA-256 `538c0461c0168eaac39bf013a6484cf172f696cb0118de23e24d37c765d148ae`）。用户随后确认 Mac 已解锁；当前重试记录见下。

用户解锁后的源码窗口重试（2026-11-16）：Finder 的 CUA 状态与截图均可读取，应用列表确认源码 `Electron (com.github.Electron)` 正在运行；启动参数的 user-data 目录为 `/private/tmp/toolbox-m06-01-cua-source-20261116/EcommerceToolboxData/.runtime`，本机 health 返回 HTTP 200。对 Electron bundle id 的状态读取在默认执行上限超时；再以显示名读取并请求 60 秒仍超时，未得到窗口树/截图，未发送输入事件。随后通过项目启动器正常停止；确认进程组及 5173 监听消失，并移除本轮隔离数据根，未访问默认 Application Support 数据。报告 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M06-01-cua-unlocked-retest-20261116.json`（SHA-256 `ef436785a2f572e5dbaff530a4c4dec467327d0f701cd38efba8ca94bf5b54ef`）。后续同日复测已成功读取源码 Electron 窗口并验证最小化、隐藏/激活恢复及原生 Quit；Dock 点击恢复与状态栏菜单实点已通过；全屏进入/退出和播放中退出保护现已验收；播放中隐藏恢复与其他人工生命周期场景仍待验。
