# 视频去字幕功能：发布收尾交接文档

> 最新本地交付：1.1.0 已完成本地签名与源码能力目录更新，提供均衡 / 极致的非商用内部试用；安装顺序及限制见[本地安装说明](video-ai-local-installation.md)。尚未上传 GitHub，实际桌面安装包仍由用户自行制作验证。

> **接续核验（2026-11-06）**：下方原交接记录保留作历史参考，不是待执行命令清单。“唯一阻塞是补下载 7.7 GB”已不成立；本轮未读取私钥、修改签名归档、上传发布或制作安装包。
> STTN / ProPainter 后续接续进度已更新至 S06 / S07：核心接入、真实模型技术验证、回归和未签名交付准备见[实施方案](./video-ai-sttn-propainter-plan.md)及[时序引擎交付说明](./video-ai-sequence-release.md)。用户已明确非商用；画质和实装验收尚未完成，旧签名包的时序档位仍关闭。下文原交接记录中的“未实施”等描述保留其历史时点，不代表当前接续状态，许可及性能判断不能作为新引擎验收结论。

## 当前交付状态与必要操作核验

### Windows 进度文件替换修复（2026-11-06）

- 视频处理到末尾时的 `progress.tmp -> progress.json` 报 `WinError 5`，失败发生在进度快照替换，而非模型推理或视频封装。原 Worker 在此处没有重试，临时访问冲突会直接中断处理；仅凭该错误无法确定占用文件的具体进程。
- 新增应用自带的 `scripts/video-ai-worker-launcher.py`，在内存中为原 Worker 的进度发布增加有限退避重试。只匹配当前进度文件替换的 Windows 错误 5 / 32 / 33，最多 6 次尝试、合计等待 0.77 秒；保留原 JSON、节流、原子替换和强制最终进度。永久占用、真正的权限异常和磁盘错误不会被伪装成成功。
- 源码启动器和桌面受管启动均接入新入口；分发脚本清单包含该文件。仍由能力管理器验证和解析原 Worker，直接执行已验证源文件，不使用或生成该脚本的字节码缓存。认证、路径校验、输出提交和取消逻辑沿用原实现。模型、依赖、签名包及已安装 generation 不修改，原离线包可继续使用。
- 失败任务保留最后实际处理进度，避免 455/460 帧失败时显示 100%。已有失败任务不会自动恢复或重跑，需要用户重新提交。
- 定向验证：Python 41 项通过，含真实 Windows 禁止删除共享的文件句柄、短暂冲突、重试耗尽、非进度错误、原节流、命令行及合成视频管线；后端 56 项通过、3 项 macOS 专项跳过；工程脚本 14 项通过，含隔离资源复制夹具。后端类型检查、改动文件 ESLint、Python Ruff/Mypy 和架构检查通过。Python 测试复用既有两个开发环境的包，未安装新依赖。未构建或运行桌面安装包，实装验证由用户完成。

### GPU 扩展依赖补充修复（2026-11-06）

- GPU 包只安装 CUDA PyTorch / torchvision 及其增量依赖，OpenCV、PaddleOCR、FastAPI 等由基础包提供。原自检与 Worker 启动都没有组合这两套受管环境，导致安装报 `No module named 'cv2'`，仅移除自检导入还会留下启动缺包问题。
- 安装自检、诊断深检与 Worker 启动现在复用同一依赖路径组合：CUDA 环境优先，其后是已验证的 Python 3.12 基础包，避免基础包的 CPU PyTorch 覆盖 CUDA 版本。基础包缺失、版本不符、依赖目录不可用或越界时拒绝自检；可选 CUDA 解析失败保留原 CPU 回退。
- 没有向已安装环境写入 `.pth` 或安装额外依赖，不改签名 Worker、锁文件、模型和归档；每次启动重新解析当前 generation，基础包更新后不会固定引用旧版本目录。原离线包可复用。
- 定向测试 60 项通过，另 3 项 macOS 专项在 Windows 上跳过；包含安装缺包复现、GPU 优先级、CPU 回退、基础依赖失败和越界目录。后端类型检查、改动源码 ESLint 通过。未执行桌面打包和实装验证，由用户自行完成；STTN / ProPainter 仍未实施。

### 安装与入口补充修复（2026-11-06）

- CPU 基础包安装自检曾误导入只在 CUDA 扩展中提供的 `torchvision`，导致完整离线包也在自检阶段失败。基础包使用 TorchScript LaMa，不需要该依赖；现已按基础包实际依赖修正自检，仍检查 PyTorch、OpenCV、PaddleOCR 等依赖并执行已签名 Worker 的 `--check`。CUDA 扩展仍验证 `torchvision` 和 CUDA 版本，没有跳过自检或变更签名能力包。
- “视频去字幕”的共享注册和页面路由已存在，但侧栏分组漏登记，导致桌面端找不到入口。已补到“视频与文案”，并验证导航、搜索及注册工具完整性。
- 修复位于应用源码，必须使用包含修复的新桌面安装包才会生效。旧安装包不会随源码更新；重新构建安装后，可复用原离线能力包，再次安装失败的基础包，无需重新生成或下载模型包。
- 本次定向验证：后端 26 项、前端 22 项、能力包准备脚本 8 项通过；另 3 项 macOS 专项在 Windows 上跳过。现有 Python 3.12 环境中显式阻止 `torchvision` 导入后，实际 CPU 依赖检查与原签名 Worker 的 `--check` 均通过；Worker 源码、暂存副本和 CPU 锁文件仍与原签名清单摘要一致。类型检查及改动源码的 ESLint、格式检查通过。桌面安装包由用户自行打包和实装验证。

1. **能力目录已生成**：原有 10 项能力和原签名完整保留，加入 `video-ai`、`video-ai-cuda`，共 12 项。通过 Release API 只读核对新增 9 个资产的上传状态、大小与 SHA-256；新包本地文件也已校验。
2. **旧包全量下载不再必要**：目录生成器增加显式 `--base-catalog`。基准目录重新验证公钥 ID 和签名，只有签名及规范化清单完全一致的旧项才能保留原验证结果；新增或变化的项仍须本地全量校验归档、分包和 SBOM。不把已安装展开目录伪装成原归档。默认不带此参数仍执行完整 feed 校验。
3. **安装链路有实际缺口，已修复**：原桌面自检没有注册视频能力，安装会在“自检未注册”处拒绝，并非只有目录生成待完成。现在分别执行 CPU Worker 与 CUDA 扩展自检，并从已验证的 FFmpeg 能力取得媒体工具路径，保持离线和 Python 3.12 隔离环境。
4. **任务与页面收口**：修复取消与成功的竞争、确认框选丢失、任务等待时提前显示完成、历史分页与总数、预览 Range、输入合法性和结果容量检查；只有输出文件和最终数据库记录完成后发布成功。已结束任务的临时上传副本清理，成功结果长期保留、手动删除。损坏或越界的旧记录保留原文件供恢复，不用其中路径执行删除。
5. **已发布 Worker 兼容**：无字幕原样输出响应缺少尺寸，Node 端仅对该特定旧响应探测实际输出补齐；不改签名 Worker。提交成功前再核对实际输出的分辨率和时长。`video-ai-task`、永久结果及关联统一任务已纳入模块备份和合并导入。
6. **可用范围**：本次完成的是原交接第六节所述版本：`delogo`（OpenCV 像素修复）与 `fast`（Big-LaMa，CPU/可选 CUDA）。`balanced` / `extreme` 只有适配器，当前签名包没有 STTN/ProPainter 的实现和权重，页面禁用并显示原因；加入这些引擎是后续独立能力包专项，不能通过继续下载旧包解决。

本轮目录生成命令（`.package/video-ai-catalog-baseline.ts` 为执行前保存的原目录）：

```powershell
node scripts/assemble-component-catalog.mjs --feed .package/component-feed --base-catalog .package/video-ai-catalog-baseline.ts --python-version 3.12
```

复现时先将**本次修改前可信版本**的 `catalog.generated.ts` 另存为基准。不要拿不受信任的 TS 文件作基准；解析器只读取标准生成 JSON，不执行 TS/JS。新增能力版本必须带齐对应本地资产。本机的 `.package/` 是临时工作区，不作为项目运行依赖。

### 本轮验证记录

- Python Worker：通过独立临时目录、禁用外网的测试入口执行，34 项通过；未安装新依赖。
- 后端定向回归：覆盖创建、队列串行、取消成功竞争、无字幕兼容、下载 Range、删除保护、安装自检与备份合并。最终门禁结果见下方收尾记录。
- 真实媒体：使用现有 `.venv-video-ai` 和既有共享 FFmpeg，合成 64×48、带 AAC 音轨视频；`delogo`、真实 Big-LaMa CPU 推理和无字幕原样输出均成功，验证分辨率、音轨、时长、原文件摘要、中文空格路径及取消无半成品。该短片验证功能正确性，不代表 720p 性能或画质验收。
- 补充真实 OCR：另用 640×360 合成英文硬字幕视频，通过本地 PP-OCRv5 实际检测出 1 个字幕区域并完成 `delogo` 修复；CPU 依赖导入及 `--check` 也通过，缺失包与缺失模型清单均为空。未依靠框架自动下载模型。
- 前序 720p OCR/GPU 数据仅是 WorkBuddy 的历史记录，本轮没有重跑长时性能、真实业务素材画质、GPU、macOS 或安装包级验收。
- 全库 ESLint 发现既有 `output/playwright/json-format/check.js` 与 `output/playwright/tiktok-history-recovery/restore.ts` 临时文件告警；保留这些既有文件，本次源码单独检查。

### 最终门禁与复现命令

| 检查                                                                                      | 本轮结果                                                                                            |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm --filter backend test`                                                              | 1834 通过、6 跳过；跳过为 3 项 Mac 专属、1 项 Windows 符号链接限制、2 项真实 Edge-TTS 外网测试      |
| `pnpm --filter frontend exec vitest run --maxWorkers=2 --minWorkers=1`                    | 924 全部通过；限制并行避免既有 700 文件队列压力测试在资源争用时超过原 20 秒门槛，未改超时或减少测试 |
| 共享契约 / runtime-core / 桌面单元                                                        | 分别 174 / 26 / 186 通过                                                                            |
| `pnpm --filter desktop exec node --test scripts/smoke-installed-desktop.test.mjs`         | 冒烟脚本单元 7 通过，使用夹具，非实际安装包验收                                                     |
| `node scripts/test-python-workers.mjs --python <已有 Python 3.12 绝对路径> --suite video` | 34 通过；隔离临时目录、外网被禁用、未安装依赖                                                       |
| 工程脚本                                                                                  | 166 通过、1 既有 R11 样式指纹失败、1 跳过；新增源码启动器测试另有 1 通过                            |
| 类型检查、架构边界、Knip、业务源码 ESLint                                                 | 通过                                                                                                |
| `pnpm build`                                                                              | 共享包、后端、Web、体积预算与普通构建冒烟通过；未提高 150 / 75 KiB gzip 门槛                        |
| `pnpm --filter desktop build`                                                             | main / preload 编译通过，未执行 `desktop:make` 或签名发布                                           |
| `git diff --check`                                                                        | 通过                                                                                                |

全库门禁的独立问题保留：`pnpm format:check` 会被原有已跟踪报告 `output/diagnostics/audio-extract/changed-files.json` 阻断；全库 ESLint 的上述临时脚本有 4 条错误；R11 的冻结指纹与已提交的全局样式不一致。本轮不编辑这些报告、不回滚样式、不更新其指纹来掩盖失败。本模块涉及的源码格式及 ESLint 单独通过。

能力目录的旧整体冻结测试只增加**本次审核后完整文件 SHA-256 的精确允许值**；其它 Worker、锁文件及签名元数据冻结断言保留。另独立确认原 10 份清单及原公钥逐项未变、12 项均可验签，源码和暂存 Worker 的摘要与签名清单相同。

源码启动补充：`pnpm dev:video-ai` 通过 `scripts/start-video-ai-worker.mjs` 在 Python 导入前固定本地模型模式与离线变量，转发参数并只结束它创建的子进程。不安装解释器或模型。原 `start.bat` 的 9 项 CPU 基线及语音 `-WithCuda` 行为不变，不会额外安装视频模型。

### 开发机的模型路径

开发环境先使用已有 Python 3.12 准备 `.venv-video-ai` 和已验证的本地资产，然后在项目 `.env` 中填写自己的路径（不要复制其他电脑的绝对路径）：

```dotenv
VIDEO_AI_MODELS_ROOT=本机模型目录
VIDEO_AI_LAMA_MODEL=本机模型目录/big-lama.pt
VIDEO_AI_OCR_DETECTION_MODEL_DIR=本机模型目录/ocr/detection
VIDEO_AI_OCR_RECOGNITION_MODEL_DIR=本机模型目录/ocr/recognition
VIDEO_AI_FFMPEG=已准备的FFmpeg目录/bin/ffmpeg.exe
VIDEO_AI_FFPROBE=已准备的FFmpeg目录/bin/ffprobe.exe
```

模型目录内应具备相应 `inference.yml` 及权重文件。再运行 `pnpm dev:video-ai` 和前后端。桌面受管模式由能力管理解析已验签路径，不依赖这些开发配置。源码入口的离线固定策略没有修改已签名 Worker。

必要的用户操作：使用本轮源码启动，或由用户自行重新打包后在“设置 → 能力管理”安装视频基础包，NVIDIA 设备按需安装 CUDA 扩展。旧桌面安装包内的能力目录不会随源码文件自动更新。

---

## 原 WorkBuddy 交接记录（2026-11-05，以下状态已被上方核验更新）

> 交接时间：2026-11-05 23:20。前序工作（调研、方案、代码实现、实机验证、能力包生成与上传）已全部完成。
> 本文档只覆盖**尚未完成的发布收尾步骤**与所有踩过的坑。

## 一、全局进度

| 阶段                                                     | 状态                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| 方案文档 `docs/video-subtitle-removal-plan.md`           | ✅ 完成（含 10.4 许可证核验 / 10.5 打包记录 / 10.6 实机验证与缺陷修复） |
| Worker / 后端域 / 前端页面 / 共享契约 / 工具注册         | ✅ 完成，测试全通过                                                     |
| CPU 基础包 + CUDA 扩展包（暂存目录、签名、分卷）         | ✅ 完成                                                                 |
| 9 个资产上传到 GitHub Release `components-v1`            | ✅ 完成（API 核验大小一致、state=uploaded）                             |
| **补齐全量组件 feed（~7.7 GB 下载）**                    | ⏳ **未完成（当前唯一阻塞项）**                                         |
| `assemble-component-catalog` 更新 `catalog.generated.ts` | ❌ 待 feed 完成后执行                                                   |
| 回归测试 + 重打桌面安装包                                | ❌ 最后一步                                                             |

## 二、当前阻塞项：feed 补齐下载

### 原因

`assemble-component-catalog.mjs` 按 feed **全量重写** `apps/api/src/modules/components/catalog.generated.ts`，且要求依赖闭环 + 对每个资产做 Ed25519 验签 + SHA256 校验。现有 10 个组件的签名归档不在本机（旧 `.package/component-feed` 已清理，Release 是唯一副本），必须下载回来。项目里的 `.runtime/packages/` 只是安装后展开的形态，无法字节级重建归档。

### 已下载 / 缺口（截至交接时）

feed 根目录：`.package/component-feed/`（当前 ~3.5 GB）

**已完整**：chatterbox 主归档、douyin-archive、edge-tts、xhs-browser、xhs-translation、全部 12 个 manifest.json + spdx.json、trusted-keys/（两把公钥）。

**缺失（约 7.7 GB）**：

| 文件                                          | 大小    |
| --------------------------------------------- | ------- |
| chatterbox/…/model-t3.tar.gz                  | 1980 MB |
| image-ai 主归档                               | 1806 MB |
| chatterbox-cuda/…/cuda-torch-part-0001.tar.gz | 1498 MB |
| chatterbox-cuda/…/cuda-torch-part-0002.tar.gz | 1028 MB |
| chatterbox/…/model-s3gen.tar.gz               | 984 MB  |
| chatterbox-cuda 主归档                        | 210 MB  |
| ffmpeg 主归档                                 | 102 MB  |
| xhs-archive 主归档                            | 32 MB   |
| python-312 主归档                             | 21 MB   |
| chatterbox-cuda/…/cuda-torchaudio.tar.gz      | 4 MB    |

### 网络约束（重要，别重复踩坑）

- **GitHub 直连被墙/被沙箱挡**：Release 资产只能走镜像；`api.github.com`（元数据）和 `gh` CLI 正常。
- 可用镜像实测：
  - `gh-proxy.com`：单连接 0.4–1.2 MB/s，**不稳定，偶发忽略 Range 头**（返回 200 而非 206，导致 `curl -C -` 把断点文件从 0 重写——之前观察到文件反而变小就是这个原因）；并发 4 路时聚合反而降到 ~400 KB/s（按 IP 限速），并行无收益。
  - `ghfast.top`：**支持 Range（206）**，实测 ~200 KB/s（在其它下载占用带宽时测得）。
  - `ghproxy.net` / `gh-proxy.net`：不可用（连接失败 / 忽略 Range）。
- 本机 Clash（127.0.0.1:7897）：小文件可用，大文件 504 超时，勿用于大归档。

### 现成工具（都在 `.package/` 下，非 git 跟踪）

```bash
# 一键管线：循环(校验→补下载)×5 → 目录生成 → 回归测试
bash .package/feed-pipeline.sh          # 日志 tee 到 .package/feed-pipeline.log

# 单独补下载（串行 + 断点续传 + 完成后 SKIP）
bash .package/download-feed.sh          # 可用 PARALLEL=n 控制并发（默认 4，无收益）

# 完整性校验：按 manifest bytes 比对，删除半截文件，列出缺口
python .package/verify-feed.py
```

已知坑（均已修，但行为需知晓）：

- `download-feed.sh` 的 FAIL 分支会 `rm` 半截文件（丢断点）。chatterbox-cuda 主归档曾因此丢过 74 MB。
- 旧版 manifest（chatterbox-cuda）的 `sbom` 字段只有 `sha256`/`url`、没有 `bytes`——`verify-feed.py` 已兼容（跳过大小检查，交给 assemble 的 SHA256 兜底）。之前 KeyError 崩溃就是它。
- 终端的安全删除垫片（sitecustomize）会对被占用的文件报 trash 失败——**校验脚本不要在下载运行中并发执行**。
- 后台任务停止（TaskStop）能杀掉 bash 进程树；如见孤儿 curl 需手动 kill。

**建议策略**：镜像速度上限就这样，~7.7 GB 需要 2–4 小时。可以混合两个镜像（ghfast.top + gh-proxy.com 各拉不同文件，`download()` 里按文件名 hash 分流），或接受串行慢速挂着跑。所有下载完成后 SHA256 会被 assemble 全量核验，损坏文件会被当场拦下（删掉对应文件重下即可）。

## 三、feed 完成后的收尾步骤（命令直给）

```bash
# 1. 生成目录（全量验签 + 摘要核对，原子写入真实文件）
node scripts/assemble-component-catalog.mjs --feed .package/component-feed
# 产物: apps/api/src/modules/components/catalog.generated.ts（12 个组件 + 2 把信任公钥）

# 2. 回归测试
node --test scripts/video-ai-component-preparation.test.mjs scripts/worker-locks.test.mjs
# 以及既有测试套件（按仓库惯例跑 pnpm test / api tests）

# 3. 重打桌面安装包（含新目录）
# 按仓库现有桌面端构建流程（electron-builder），目录随安装包嵌入。
```

校验要点：生成后的 `catalog.generated.ts` 应包含 12 个 manifest（原 10 + video-ai + video-ai-cuda），`trustedPublicKeys` 应含 `ed25519-f372f170…`（video-ai 签名钥）与 `ed25519-80154152…`（既有组件签名钥）。

## 四、签名与发布相关事实

- 私钥（用户保管）：`C:\Users\tangmy\Desktop\component-signing-ed25519-private.pem`，keyId `ed25519-f372f170…`，与现有目录信任的钥匙一致。
- Release：`https://github.com/sunshine-tmy/tool2.0/releases/tag/components-v1`（资产 URL 前缀 `…/releases/download/components-v1/`）。
- video-ai 9 个资产已上传（主归档 674 MB + cuda 4 归档 + manifest/spdx ×2），manifest 的 `archive.url`/`sbom.url` 都指向上述前缀。
- `build-component-package.mjs` 无默认参数：`--definition --stage --output --github-release-url --signing-key-file` 全部必填；**不要用 pnpm 传参**（pnpm 11 把 `--` 原样传给脚本导致 usage 报错），直接 `node scripts/build-component-package.mjs …`。
- video-ai-cuda 的 torch cu124 wheel（2.5 GB）超 GitHub 2 GiB 资产上限，已按 chatterbox-cuda 同款机制做 1.5 GB 分卷（`additionalArchives` + `assembledFiles`），相关逻辑在 `tooling/components/prepare-video-ai-cuda-component.mjs`。

## 五、本轮新改动的代码文件（git 未提交，需 review + 提交）

| 文件                                                     | 改动                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tooling/components/prepare-video-ai-component.mjs`      | 固定资产下载改走 Node 下载器（原 PowerShell 包装脚本双 splat 缺陷）             |
| `tooling/components/prepare-video-ai-cuda-component.mjs` | 平台化锁校验（Windows 无 nvidia-* 包）+ torch 分卷打包 + 导出 `sha256File` 复用 |
| `scripts/video-ai-component-preparation.test.mjs`        | 双平台锁断言 + 分卷分组断言（8 项新增）                                         |
| `docs/video-subtitle-removal-plan.md`                    | 回填 10.5/10.6 打包与验证记录                                                   |
| `.package/` 下脚本                                       | download-feed.sh / verify-feed.py / feed-pipeline.sh（运维工具，不入 git）      |

## 六、能力边界（发布后即如此，非缺陷）

- `balanced`（STTN）/ `extreme`（ProPainter）两档缺引擎资产：显式报 `STTN_UNAVAILABLE`，不静默降级。delogo 兜底档与 fast 档（CPU/CUDA）可用。
- CPU fast 档 ~6.3 s/帧；3060 Ti + CUDA 扩展包实测 1.2–1.6 fps、峰值显存 <4 GB。
- 后续如需补 STTN：`prepare-video-ai-component.mjs --sttn-assets <目录>`（Apache-2.0，已核验）。

## 七、环境速查

- Python 构建环境：`.venv-video-ai/`（CPU 基线，与 `scripts/video-ai.lock.txt` 一致）
- 本机能力包安装目录：`.runtime/packages/`（image-ai 包内的 big-lama/OCR 模型曾被复用，摘要与固定值一致）
- 冒烟资产（临时，可删）：`.workbuddy/temp/video-ai-smoke/`
- GPU：RTX 3060 Ti 8G（sm_86，cu124 可用）
