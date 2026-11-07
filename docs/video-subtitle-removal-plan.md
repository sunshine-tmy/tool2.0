# 视频去字幕模块实施方案

> 文档状态：历史设计与实施记录。2026-11-06 接续核验后的实际交付范围和验证结果见[发布交接文档](./video-ai-release-handover.md)。原设计中的 STTN/ProPainter、多档默认值及性能估算不代表当前包已支持。
> 后续 STTN / ProPainter 接入以[独立实施方案](./video-ai-sttn-propainter-plan.md)为准，当前暂不实施。原文关于外层 Apache-2.0 许可覆盖、8 GB 显存及处理速度的判断保留作历史记录，不作为新引擎的许可或可用性证明。
> 目标硬件：Windows 本地电脑，NVIDIA RTX 3060 Ti 8 GB 显存。
> 使用范围：非商用、内部本地使用。选型不受商用许可限制，但许可证情况仍在下文如实登记。

## 1. 模块目标与功能说明

新增"视频去字幕"工具（侧栏入口，页面 `/tools/video-subtitle`），从本机选择 MP4、MKV、AVI、MOV、WebM 视频，去除烧录在画面中的硬字幕/文本水印，输出保留原分辨率、原帧率、原音轨的新视频。原视频不修改、不移动、不删除；全部处理在本机完成，不上传外部服务。

核心能力：

1. **自动字幕区域检测**：抽样式 OCR 检测（默认每 1 秒抽 1 帧，最少 5 帧），对检测框求时域并集，得到固定字幕掩码；硬字幕位置通常固定，无需逐帧检测。
2. **手动框选**：用户可在首帧画面上拖拽框选字幕区域，跳过自动检测；也可在自动检测后人工修正。
3. **三档修复引擎**（见第 2 节选型）：快速（LaMa）、均衡（STTN，默认）、极致（ProPainter）。
4. **批量任务与进度**：复用现有任务体系，单并发处理、可取消、进度百分比 + 当前帧/总帧数通过 SSE 推送；成功结果长期保留、手动删除，模块空间预留上限 20 GiB（与音频提取器一致）。
5. **极速兜底模式**：ffmpeg delogo 像素插值，零模型依赖，组件未安装或显存不足时仍可用。

非目标：不做软字幕（SRT/ASS 轨道）剥离以外的字幕编辑；不做翻译、配音；不处理超过 8 GB 显存可承载的分辨率（见第 6 节降级策略，不静默降质伪装成功）。

## 2. 技术选型及理由（3060 Ti 8 GB 约束）

### 2.1 管线总览

```
输入视频 → ffprobe 探测 → 抽样式 OCR 检测（或手动画框）→ 掩码膨胀(8px)
        → 修复引擎（LaMa / STTN / ProPainter 三选一）
        → ffmpeg 合成（H.264，CRF 18，音轨直通 -c:a copy）
```

检测与修复分离，复刻 VSR（YaoFANGUK/video-subtitle-remover）验证过的两段式思路，但 worker 代码自研，不直接引入 VSR 仓库。

### 2.2 引擎分档与显存估算（720p 基准）

| 档位         | 引擎                              | 原理                                       | 显存估算（720p）                                                                                              | 速度预期（3060 Ti）                  | 适用场景                                 |
| ------------ | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| 快速         | LaMa（big-lama，ONNX/Torch 逐帧） | 傅里叶卷积大掩码图像修复                   | 约 2–3 GB                                                                                                     | 8–15 fps，1 分钟视频约 1–2 分钟      | 动画、图文、静态背景；帧间有轻微闪烁风险 |
| 均衡（默认） | STTN                              | 时空 Transformer，邻帧参考补全             | MAX_LOAD_NUM=30、邻帧/参考长度=10 时约 4–6 GB                                                                 | 1–3 fps，1 分钟视频约 3–8 分钟       | 真人视频、自然运动，时域一致性好         |
| 极致         | ProPainter                        | 循环光流补全 + 双域传播 + 稀疏 Transformer | 保守参数（subvideo_length=10、fp16、邻帧=5）约 5–7 GB；官方默认 80 帧一批需 15 GB+，**8 GB 不可用，必须降参** | 0.3–0.8 fps，1 分钟视频约 15–40 分钟 | 剧烈运动、镜头切换频繁、质量优先         |

1080p 处理策略：LaMa 可直跑；STTN 将 MAX_LOAD_NUM 降至 15（约 5–7 GB）；ProPainter 在 8 GB 下不支持 1080p，前端直接禁用该组合并明示原因，不自动缩放画面冒充原分辨率。

以上显存为文献与社区实测的估算值，首次实机验证时用 `nvidia-smi` 实测校正，并在 worker `/health` 中回读实际可用显存，不足时拒绝提交并提示降档，而不是任务跑到一半 OOM。

### 2.3 为什么不用 DiffuEraser

DiffuEraser（阿里通义，2025，扩散模型）效果最强，但 720p 需约 33 GB 显存、权重 30 GB+、10 秒视频推理 5 分钟+，3060 Ti 8 GB 物理上无法运行，排除。

### 2.4 为什么默认 STTN 而不是 LaMa

LaMa 逐帧独立修复会引入帧间闪烁；STTN 以邻帧为参考做时空联合修复，闪烁显著更少，且 8 GB 显存可承载、速度可接受。LaMa 保留为"快速"档供静态画面/动画使用。

## 3. 依赖与模型清单、许可证登记

### 3.1 Python 依赖（哈希锁定，wheelhouse 离线安装）

- `torch` / `torchvision` CUDA 12.4 版（复用 chatterbox-cuda 已锁定的 cu124 版本线）
- `onnxruntime-gpu`（LaMa ONNX 推理，可选加速路径）
- `opencv-python-headless`、`numpy`、`av`（视频帧读写）、`fastapi`/`uvicorn`（worker 框架，与 image-ai 一致）
- OCR 推理复用项目已有的 PP-OCRv5 ONNX 推理代码路径，不引入 paddlepaddle 运行时

### 3.2 模型资产（全部随能力包离线安装，固定 SHA256，运行时绝不下载）

| 模型                                                             | 用途               | 来源                                                                      | 许可证                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| PP-OCRv5 det/rec（ONNX）                                         | 字幕区域检测       | PaddleOCR 官方                                                            | Apache-2.0                                                                                                                                   |
| big-lama.pt（TorchScript）                                       | 快速档修复         | enesmsahin/simple-lama-inpainting v0.1.0 发布物（权重源自 advimman/lama） | **已核验（2026-11-05）**：权重以 Apache-2.0 分发，simple-lama-inpainting 代码为 MIT；SHA256 `7ba7aa7a…` 与 image-ai 组件固定值同源           |
| STTN infer_model.pth                                             | 均衡档修复         | ECCV 2020 官方权重（VSR 仓库同源）                                        | **已核验（2026-11-05）**：YaoFANGUK/video-subtitle-remover 整仓库为 Apache-2.0，STTN 权重随仓库分发，无附加条款；STTN 原论文实现代码同源可用 |
| ProPainter.pth + raft-things.pth + recurrent_flow_completion.pth | 极致档修复         | sczhou/ProPainter 官方                                                    | NTU S-Lab License 1.0（本项目非商用内部使用满足其条件；若未来用途变化需重新评估）                                                            |
| FFmpeg 8.1.2                                                     | 抽帧/合成/音轨直通 | 复用现有 `ffmpeg` 共享组件                                                | GPL/LGPL（按现有组件既有合规口径执行，不新增义务）                                                                                           |

实施动作：准备器下载每个权重时记录 URL + SHA256 + 来源许可证文本到暂存目录的 `PROVENANCE.json`（沿用 ffmpeg 组件的做法）。上表两项"引入前核验"已完成（见第 10 节实施记录），结论均为可分发；后续如更换权重来源需重新核验并更新本表。

### 3.3 组件拆分（沿用 chatterbox / chatterbox-cuda 的"基础包 + CUDA 扩展包"双包先例）

| 组件 id                                             | 内容                                                                                     | 安装条件                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `video-ai`（基础包，`1.0.0-py312-cpu1` 风格版本号） | worker 脚本、CPU 版依赖、PP-OCRv5 + big-lama + STTN 模型；CPU 可跑 LaMa 档与 delogo 兜底 | `dependencyIds: ["python-312", "ffmpeg"]`，预估安装后约 3–4 GB                                                                            |
| `video-ai-cuda`（GPU 扩展包）                       | torch cu124 wheelhouse + ProPainter 权重，启用 STTN/ProPainter GPU 档                    | `dependencyIds: ["video-ai", "python-312"]`；installConditions 明示需要 NVIDIA 显卡与兼容驱动、首次安装需数 GB 空间；不安装或修改显卡驱动 |

ffmpeg 是 shared 组件，视频模块直接声明依赖，不重复打包。

## 4. 模型安装方式（与现有逻辑一致）

严格复用现有能力包机制，不做任何运行时自动下载：

1. 构建期：`tooling/components/prepare-video-ai-component.mjs` 校验 Python 3.12、按 `scripts/video-ai.lock.txt` 执行 `pip download --require-hashes` 生成 wheelhouse、按固定 SHA256 下载模型权重，产出离线暂存目录。
2. 发布期：现有签名流程（Ed25519 清单 + 资产 SHA256）生成目录，私钥不进仓库。
3. 用户侧：桌面端"能力管理"中**用户手动点击安装** `video-ai`（及可选的 `video-ai-cuda`），安装进度走现有 component-jobs SSE；安装失败可重装或离线导入。
4. 运行期：worker `/health` 只做本地文件存在性与 SHA256 校验；模型缺失时能力显示未安装，前端引导去能力管理安装，**worker 内不出现任何下载代码**。`--check` 自检模式与 image-ai 一致，供安装自检调用。

## 5. 与现有逻辑的集成方式

完全复刻 image-ai 的五层范式，不改动任何已有模块的行为：

1. **Worker 层**：新建 `scripts/video-ai-worker.py` —— FastAPI loopback 服务（仅 127.0.0.1，HMAC token 中间件，`protocolVersion: 1`）；端点：`GET /health`（模型清单/显存回读/SHA256 校验）、`POST /process`（传文件路径，`operation: subtitle_remove`，参数含 `mode: fast|balanced|extreme|delogo`、`subtitleArea` 可选）；`asyncio.Lock` 串行推理；进度写入任务目录下的 `progress.json`（已处理帧/总帧数/当前阶段）；`trusted_path()` 仅允许访问 `storage/video-ai`。
2. **后端层**：新建 `apps/api/src/domains/video-ai/` —— worker-client 复用 `core/workers/http-transport.ts`；task-manager 复用 image-ai 的 FIFO 队列 + AbortController 取消 + SQLite 持久化 + 重启恢复；进度由 Node 端轮询 worker 进度文件并 `patchTask` 广播 SSE；视频输入复用 `audio-extract` 的暂存/配额/过期清理模式（单文件最大 2 GiB、最长 6 小时）；`core/media/runtime.ts` 的 `resolveFfmpegTools` 解析共享 ffmpeg。
3. **运行时装配**：`apps/api/src/runtime/desktop-capability-runtime.ts` 增加 `configureVideoAi` / `resetVideoAiConfiguration`，照抄 image-ai 的 spawn + 轮询 `/health` + 写 config 模式；组件卸载/重装时 `beforeUninstall/afterMutation` 重启 worker。
4. **契约层**：schema、错误码、tool id（`video-ai` / `video-ai-job`）放入 `packages/shared`；API 清单按惯例登记（避免重蹈 audio-extract 契约测试未登记的教训）。
5. **前端层**：新建 `apps/web/src/features/video-ai/` —— `httpClient` multipart 上传、`useTaskEvents` SSE 进度（失败降级轮询）、仿 `ImageAiTaskStatusCard` 的状态卡、首帧预览画框组件（用 `<canvas>` 叠加在视频首帧截图上）；组件安装 UI 复用 `DesktopComponentCard`。
6. **存储**：结果存 `<storageRoot>/video-ai/results/<jobId>/video.mp4`；临时输入位于同模块 `staging`；纳入"数据备份与恢复"模块清单；普通缓存清理不触碰永久结果。

## 6. 本地启动流程与依赖关系

**依赖关系**：`video-ai` → `python-312`（共享解释器，隔离 venv）+ `ffmpeg`（共享媒体运行时）；`video-ai-cuda` → `video-ai`。与 image-ai/chatterbox 的 venv 完全隔离，不共享 site-packages，不影响已有功能。

**开发模式（源码）**：

```bash
pnpm dev                              # 前端 + 后端，与现状一致
pnpm dev:video-ai                     # 新增：.venv-video-ai\Scripts\python.exe scripts\video-ai-worker.py
```

`dev:video-ai` 为新增 npm script，只新增不修改现有 script；worker 未启动时，前端该功能页显示"能力不可用"引导安装，其余功能不受影响。

**桌面受管模式**：启动时 `desktop-capability-runtime` 检测已安装的 `video-ai` generation，验签通过后 spawn worker（随机 loopback 端口 + 随机 token），轮询 `/health` 就绪后写入 `config.videoAiWorkerUrl/Token`；未安装则该能力静默缺省，不影响其他能力启动。

**硬件检测**：worker 启动时检测 CUDA 可用性与显存总量；无 GPU 或未装 `video-ai-cuda` 时仅开放 fast(CPU LaMa)/delogo 档，balanced/extreme 档在 UI 置灰并注明原因。

## 7. 验证方法

1. **单元/契约**：worker `--check` 自检；后端 domain 定向测试（队列、取消、去重、持久化、配额）；API 清单契约测试；前端定向测试。
2. **实机冒烟**（3060 Ti 机器）：三个合成/实拍用例——固定底部硬字幕（访谈类静态背景）、滚动字幕、动态背景（运动画面）——分别跑三档引擎；用 `nvidia-smi` 记录峰值显存校正第 2.2 节估算；校验输出分辨率/帧率/时长/音轨与原片一致（ffprobe 对比 + 音视频同步抽查）。
3. **回归**：`pnpm check` 全量（lint、typecheck、测试、构建、体积预算）；确认未改动既有 lockfile、已签名能力包、Python 3.11 存量逻辑。
4. **验收边界**：不做 macOS 验收（目标环境为 Windows + N 卡）；不以合成测试代替安装包实机验收。

## 8. 潜在风险及应对措施

| 风险                                        | 影响               | 应对                                                                                                                        |
| ------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| LaMa 逐帧修复帧间闪烁                       | 快速档观感下降     | 掩码时域并集 + 相邻帧修复区加权平滑；UI 明示快速档适用场景，引导真人视频用均衡档                                            |
| STTN/ProPainter 显存估算偏差导致 OOM        | 任务失败           | 提交前 `/health` 显存预检；worker 捕获 OOM 自动降 MAX_LOAD_NUM 重试一次并如实上报；仍失败则明确报错提示降档，不静默降分辨率 |
| 长视频耗时过长（极致档 1 小时视频需数小时） | 用户等待           | UI 提交前按档位显示预估耗时；支持取消；进度精确到帧；不做无人值守批量宣称                                                   |
| OCR 漏检/误检字幕区域                       | 残留字幕或误伤画面 | 手动画框与检测后修正入口；掩码膨胀 8px 兜底边缘；检测结果预览确认后再开始修复                                               |
| ProPainter/STTN 权重许可证核验不通过        | 对应档位无法上架   | 基础包仍交付 LaMa + delogo 两档；核验结果更新本文档后再打包                                                                 |
| CUDA 驱动不兼容                             | GPU 档不可用       | installConditions 明示驱动要求且不代装驱动；`/health` 检测失败时降级为 CPU 档并提示                                         |
| 磁盘空间不足                                | 任务中途失败       | 接收输入前检查磁盘（输出预估 ≈ 输入大小 × 1.2）；模块 20 GiB 上限与既有模块一致                                             |

## 9. 实施顺序（后续开发严格按此执行）

1. 模型许可证核验 → 更新本文档第 3.2 节
2. `prepare-video-ai-component.mjs` + 组件定义 JSON + 锁文件（打包链路先跑通，模型资产落盘）
3. `video-ai-worker.py`（含 `--check` 自检）→ 本地命令行冒烟
4. 后端 `domains/video-ai/` + 运行时装配 + 契约登记 → 定向测试
5. 前端 `features/video-ai/` → 端到端联调
6. 实机三用例验证 + 显存实测校正 + 全量 `pnpm check` + 本文档补验证记录

## 10. 实施记录（2026-11-05）

### 10.1 已交付文件

| 层          | 文件                                                                                                                                         | 说明                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker      | `scripts/video-ai-worker.py`                                                                                                                 | FastAPI loopback、HMAC 令牌、`/health`、`/subtitle/detect`、`/process`、`--check` 自检；检测抽样、掩码聚类、四档引擎、进度文件、取消标记、ffmpeg 合成                                |
| Worker 测试 | `scripts/test_video_ai_worker.py`                                                                                                            | 34 项：路径白名单、抽样密度、静态/双行/滚动/迟到字幕聚类、掩码膨胀、delogo 修复质量、LaMa 时域平滑、序列引擎缺失与分辨率上限、管线完成/无字幕直通/取消/异常输入/多分辨率、鉴权中间件 |
| 组件定义    | `scripts/component-definitions/video-ai.json`、`video-ai-cuda.json`                                                                          | `media` 分组；依赖 `python-312` + 共享 `ffmpeg`；GPU 扩展依赖基础包                                                                                                                  |
| 打包        | `tooling/components/prepare-video-ai-component.mjs`、`prepare-video-ai-cuda-component.mjs` + `scripts/` 稳定入口                             | 哈希锁 wheelhouse、固定 SHA256 模型（big-lama/PP-OCRv5）、引擎目录逐文件 PROVENANCE                                                                                                  |
| 锁任务      | `tooling/components/lock-worker-dependencies.ps1`                                                                                            | 新增 `video-ai`（cpu）与 `video-ai-cuda`（cu124）两条                                                                                                                                |
| 契约        | `packages/shared/src/video/video-ai.ts`、`common/tools.ts`                                                                                   | 任务/检测/健康/历史 Schema、模式与尺寸常量、工具注册表条目 `video-subtitle`                                                                                                          |
| 后端        | `apps/api/src/domains/video-ai/*`（types/projections/persistence/worker-client/task-manager/routes）                                         | FIFO 单并发队列、进度轮询（500ms 读、2s 落库）、取消标记、20 GiB 上限、重启恢复、下载与历史                                                                                          |
| 配置/装配   | `core/config/video.ts`、`config.ts`、`core/config/types.ts`、`context.ts`、`app/business-routes.ts`、`runtime/desktop-capability-runtime.ts` | 新增配置段与 `configureVideoAi`：CUDA 扩展覆盖 Python、基础包提供脚本与模型；`startWorker` 注入 `VIDEO_AI_WORKER_PORT/TOKEN`                                                         |
| 前端        | `apps/web/src/features/video-ai/{api.ts,page.vue}`、`app/router.ts`                                                                          | 选片、视频预览、拖拽框选、自动检测叠加、档位选择、SSE 进度、下载、历史与删除                                                                                                         |
| 文档        | `docs/api.md`、本文档                                                                                                                        | 接口清单与错误码；实施记录                                                                                                                                                           |

### 10.2 与方案的差异（有意收敛）

1. **STTN/ProPainter 以运营方提供的引擎目录入包**：方案 3.2 要求先完成许可证核验再上架，因此准备脚本通过 `--sttn-assets` / `--propainter-assets` 接收已核验的 `engine.py` + `weights/`，逐文件记录 SHA256；未提供时 `balanced`/`extreme` 在 `/health` 明确不可用，任务返回 `STTN_UNAVAILABLE`，不静默回退到低档。
2. **基础包不含 PyTorch CUDA**：`video-ai` 锁 `torch==2.6.0+cpu`，GPU 推理只在 `video-ai-cuda`（`2.6.0+cu124`）中启用，与 chatterbox / chatterbox-cuda 完全同构。
3. **进度上报**：Worker 原子写入 `progress.json`，Node 端轮询并广播 SSE，不为长任务引入 Worker 侧长连接。

### 10.3 本地启动与验证

源码模式（开发机，非桌面受管）：

1. `python -m venv .venv-video-ai`，然后用该解释器安装 `scripts/video-ai-requirements.txt`。
2. `pnpm dev:video-ai` 启动 Worker（默认 `127.0.0.1:3211`），另开终端 `pnpm dev` 启动前后端。
3. `.\.venv-video-ai\Scripts\python.exe scripts\video-ai-worker.py --check` 做安装自检（包、模型、ffmpeg、设备）。

桌面受管模式无需上述步骤：在"设置 → 能力管理"手动安装 `video-ai`（可选 `video-ai-cuda`），启动时自动拉起 Worker；模型与依赖全部来自签名能力包，运行期零下载。

### 10.4 验证结果

| 检查                              | 结果                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------- |
| Worker 单元测试（pytest）         | 34 项通过；覆盖检测聚类、掩码、修复、管线边界                                |
| Worker 静态检查                   | `ruff check`、`ruff format --check`、`mypy` 全部通过                         |
| 组件打包契约（node --test）       | 7 项通过                                                                     |
| 后端 `video-ai.test.ts`（vitest） | 13 项通过，含伪 Worker 端到端（提交→完成→下载→删除）与 Worker 拒绝时的失败态 |
| 后端/前端类型检查                 | `tsc --noEmit`、`vue-tsc -b` 通过                                            |
| 架构/死代码/Lint/格式             | `lint:architecture`、`knip`、`eslint`、`prettier --check` 通过               |
| 前端构建与体积预算                | `pnpm build:web` 通过，未提高预算                                            |
| 配置与夹具回归                    | 25 项通过（config-sections / isolated-app / runtime-layout）                 |

### 10.5 剩余事项与完成进度

1. ~~**模型许可证核验**~~：已完成（2026-11-05）。结论：big-lama 权重 Apache-2.0（见 3.2 节核验记录）；STTN 权重随 VSR 仓库（整体 Apache-2.0）分发，可随包携带。基础包打包时通过 `--sttn-assets` 引入已核验权重。
2. ~~**锁文件生成**~~：已完成（2026-11-05）。`scripts/video-ai.lock.txt`（`torch==2.6.0+cpu` + paddlepaddle 3.3.1）与 `scripts/video-ai-cuda.lock.txt`（`torch==2.6.0+cu124` / `torchvision==0.21.0+cu124`，不含 fastapi/paddle 等基础包依赖）已用 uv 按 `pnpm lock:python` 同参生成，`scripts/worker-locks.test.mjs` 新增两条断言覆盖（共 8 项通过）。
3. ~~**真实模型推理验收**~~：`fast` 档已完成（2026-11-05，详见 10.6 实测记录：CPU 与 GPU 双基线、显存采样、OCR 复检确认字幕移除、聚类三用例与负向用例全部通过）。`balanced`/`extreme` 档待引入已核验的 STTN/ProPainter 引擎资产后实测。
4. **签名与发布**：生成签名产物、上传 Release、更新嵌入目录后重打桌面安装包；在此之前"能力管理"中不会出现该能力。**进度（2026-11-05）**：两个暂存目录均已生成并通过验证。
   - `.package/stage/video-ai`（CPU 基础包）：82 个经哈希锁校验的 wheel、`requirements.lock`、`video-ai-worker.py`、big-lama.pt 与 PP-OCRv5 det/rec 共 227 MB 固定模型、`PROVENANCE.json`。用 `pip install --no-index` 离线装入独立 venv 成功，worker `--check` 返回 `available: true`（device=cpu），torch/paddle/cv2 均可导入。
   - `.package/stage/video-ai-cuda`（GPU 扩展包）：13 个 cu124 wheel（torch 2532 MB + torchvision 6 MB + 依赖），锁文件哈希全部核对通过；离线安装后 `torch.cuda.is_available()=True`，识别 `NVIDIA GeForce RTX 3060 Ti`（sm_86）。
   - 下载提速记录：官方 `download.pytorch.org` 实测约 180 KB/s（2.5 GB 需 3 小时以上），改用 SJTU `mirror.sjtu.edu.cn/pytorch-wheels/cu124/` 稳定 35 MB/s，入库后仍按锁文件 `--require-hashes` 逐一校验，摘要与锁文件一致。
   - 序列引擎均未提供，故 balanced/extreme 档仍不可用。
   - 剩余：Ed25519 签名产物、上传 Release、`components:catalog`（注意该命令按 feed 全量重写 `catalog.generated.ts`，feed 必须包含既有全部组件，否则会丢失其它能力）、重打桌面安装包。

### 10.6 实机验证与修复记录（2026-11-05，RTX 3060 Ti 8G 宿主机实测）

冒烟环境：`.venv-video-ai`（Python 3.12.14 / torch 2.6.0+cpu / paddlepaddle 3.3.1 / paddleocr 3.7.0 / opencv 4.11）；三个合成用例（1280×720、25 fps、5 s，微软雅黑渲染真实中文字形：固定底部硬字幕 / 滚动跑马灯 / 动态背景 testsrc2+固定字幕）；驱动脚本 `.workbuddy/temp/video-ai-smoke/smoke.py`（独立端口 3221，不与后端测试冲突）。

#### 实测发现并修复的真实缺陷（前四项已合入 worker，第五项在能力包准备脚本）

1. **torch / paddle 导入顺序冲突**：Windows 上先 `import paddle` 再 `import torch` 会触发 `WinError 127`（shm.dll 加载失败，OpenMP/MKL 运行时遮蔽）。修复：worker 启动即在任何 paddle 导入前预载 torch。
2. **非 ASCII（中文）路径全面失效**：本机项目位于 `F:/git仓库内容`，paddle / torch / cv2 的窄字符 C API 均无法打开含中文的路径（torch `jit.load` 与 paddle 推理直接报错，cv2 imread 同样失败；8.3 短路径在该卷被禁用）。修复：worker 新增 `ascii_safe_dir()`——通过 Windows 目录联接（junction，零拷贝，`_winapi.CreateJunction`）为 OCR 模型目录与序列引擎目录建立纯 ASCII 别名，失败退化为整目录复制；`PADDLE_PDX_CACHE_HOME` 强制改写到 ASCII 真实目录（paddlex 会 resolve 穿透 junction）。LaMa 权重加载本就走二进制流，不受影响。
3. **paddleocr 3.7 `predict` 不接受字节流**：传入 PNG bytes 会被静默忽略（仅支持 ndarray/路径），导致检测恒为空。修复：`detect_frame` 直接传 BGR ndarray。
4. **paddle 3.3.1 CPU MKLDNN 缺陷**：新 PIR 模型触发 `ConvertPirAttribute2RuntimeAttribute` NotImplementedError。修复：worker 默认 `PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT=False`（桌面运行时注入同名变量，双保险）。
5. **能力包准备脚本模型下载全部失败**（2026-11-05 打包时发现）：`scripts/download-fixed-model-file.ps1` 用 `@PSBoundParameters @args` 双 splat 转发，pwsh 7 下空 `$args` 会被当作一个 `$null` 位置参数，报"找不到接受自变量 '$null' 的位置参数"，7 个固定模型无一例外失败。修复：`prepare-video-ai-component.mjs` 改走同源 Node 下载器 `scripts/download-fixed-model-file.mjs`（同样强制 HTTPS + 完成前校验 SHA-256），不再经过 PowerShell 包装。
6. **GPU 扩展包锁文件校验与 Windows 现实不符**（2026-11-05 打包时发现）：`validateVideoAiCudaLock` 强制要求 `nvidia-cublas-cu12==`，但该包只在 Linux 分发；Windows 版 `torch-2.6.0+cu124` wheel 已内置 cublas/cudnn/cudart DLL（体积 2.5 GB 即源于此）。原实现使 Windows 上永远无法准备 GPU 扩展包。修复：按平台校验——Windows 要求不得混入 `nvidia-*`，其他平台仍要求 `nvidia-cublas-cu12`；同步更新 `scripts/video-ai-component-preparation.test.mjs`（7 项通过）。

另有一项性能优化：**LaMa 全幅推理过慢**（720p 实测 23 s/帧）→ 改为掩码窗口 + 上下文边距（默认 96px，`VIDEO_AI_LAMA_CONTEXT_PX` 可调）的局部推理，修复后约 6.3 s/帧（静态字幕用例），质量无损（LaMa 仅需邻域纹理重建掩码区）。

#### CPU 基线实测数据（fast 档 = big-lama CPU + 时域平滑）

| 场景                                    | 实测             | 折算                                                  |
| --------------------------------------- | ---------------- | ----------------------------------------------------- |
| delogo 兜底档（127 帧 + 音轨直通）      | 9.8 s            | ≈ 13 帧/s，1 分钟视频 ≈ 7 s                           |
| 自动检测（单视频，含 OCR 模型首次加载） | ~30–60 s         | 采样 1 帧/s，每帧推理 ~1.5 s                          |
| fast 档 · 静态字幕用例                  | 803 s / 127 帧   | ≈ 6.3 s/帧；1 分钟视频 ≈ 2.6 小时（CPU 仅适合短视频） |
| fast 档 · 动态背景用例                  | 1995 s / 127 帧  | ≈ 15.7 s/帧（掩码窗更大）                             |
| OCR 复检（修复后帧字幕带）              | clean            | PP-OCRv6 复检 0 文本，字幕移除确认                    |
| balanced 负向用例                       | STTN_UNAVAILABLE | 引擎缺失时显式失败，不静默降级 ✓                      |

结论：CPU 上 delogo 兜底档实用、fast 档仅适合秒级短片；**3060 Ti 上 fast 档应经 `video-ai-cuda` 扩展包走 GPU**（GPU 实测见下节）。

#### GPU 实测数据（fast 档 = big-lama CUDA 12.4 + cu124 torch，`video-ai-cuda` 扩展包形态）

验证方式：在同一 venv 中换装 `torch-2.6.0+cu124`（复刻 video-ai-cuda 锁定版本线），worker 以 `VIDEO_AI_DEVICE=auto` 运行，`/health` 上报 `device=cuda, vramTotalMb=8191`，处理期间每 2 s 采样 `nvidia-smi`。驱动脚本 `.workbuddy/temp/video-ai-smoke/smoke_gpu.py`（端口 3222）。验证后已将 venv 恢复为 CPU 基线（与 `video-ai.lock.txt` 一致）。

| 场景（720p / 25 fps / 127 帧） | 用时    | 吞吐     | 峰值显存 | 峰值 GPU 利用率 |
| ------------------------------ | ------- | -------- | -------- | --------------- |
| fast GPU · 静态字幕用例        | 107.6 s | 1.18 fps | 2965 MiB | 62%             |
| fast GPU · 动态背景用例        | 77.5 s  | 1.64 fps | 3932 MiB | 100%            |

结论与校正：

- fast 档 GPU 实测显存 3.0–3.9 GB，**低于方案估算上限并留有充足余量**（8 GB 卡可在后台并行其他任务）；`/health` 的显存预检（方案第 6 节）保持有效。
- GPU 对 CPU 提速约 **5–7.5×**（6.3 s/帧 → 0.61–0.85 s/帧）；720p 1 分钟视频约 10–14 分钟。逐帧小窗口推理下 GPU 利用率不满（62% 静态用例），瓶颈在传输与单帧调度而非算力——若需进一步提速可引入帧批处理（batch=4–8）或提高 `VIDEO_AI_LAMA_CONTEXT_PX` 换取单次更大窗口，属后续可选优化。
- `balanced`/`extreme` 档仍需按 3.2 节引入已核验的 STTN/ProPainter 引擎资产后才能实测（`--sttn-assets` / `--propainter-assets` 打包路径），负向行为（缺失即显式 `STTN_UNAVAILABLE`）已实测确认。
