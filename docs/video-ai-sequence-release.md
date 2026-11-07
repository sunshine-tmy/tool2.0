# STTN / ProPainter：非商用交付与验收说明

更新日期：2026-11-06。对应[实施方案](video-ai-sttn-propainter-plan.md)的 S06 / S07；原始基线为 `0daa7d00ad47a6df8b3adc5376d2f1b884a40892`，包含已有未提交实现，并非干净提交的发行版本。

> 后续本地交付已推进：用户要求均衡 / 极致可用并提供现有私钥路径后，已生成 1.1.0 本地签名内部试用包，并更新源码内置能力目录，见[本地安装说明](video-ai-local-installation.md)。以下审阅目录与关闭开关描述保留 S07 当时状态，不代表新的本地签名包；新包未上传 GitHub，旧客户端不会自动获得新目录。

## 当前能做什么

STTN 与 ProPainter 的生产适配器、时序调度、Worker 生命周期、安装验证和业务接线已实现。已在 Windows / RTX 3060 Ti 8 GB 上完成合成视频、用户提供的真实短片、ProPainter 两分钟视频、真实后端与 GPU Worker 联调，以及浏览器流程回归。

**当前交付的是代码和未签名审阅材料，不是可直接导入的发行包。** 两个 `sequence-bundle.json` 中的 `adapterReady` 仍为 `false`。未读取私钥、签名、改写生成目录清单、发布或制作桌面安装包。画质尚未获得用户确认；不能将技术检查通过写成已发布或全部平台验收完成。

## 数据与运行边界

- 原视频只读，保留原分辨率和帧率；处理结果另存，沿用现有任务、容量、历史、删除和备份恢复机制。
- CPU 基础包继续提供 OpenCV 与 Big-LaMa。均衡档使用 STTN，极致档使用 ProPainter，不以其他算法冒充两者，不自动降分辨率或回退 CPU。
- Python 3.12、PyTorch `2.6.0+cu124`、torchvision `0.21.0+cu124`；新增固定推理依赖为 einops `0.8.1`、SciPy `1.17.1`。本轮没有安装依赖或驱动。
- STTN 原尺寸区域分块；ProPainter 保留原尺寸裁剪，含上下文与补边后不超过 640×480 像素量、单边不超过 640，原视频不超过 720p 像素量。显存准备条件为至少 3 GiB 空闲，不能据此承诺所有 8 GB 显卡均可运行。
- 模型调用失败、取消及关闭释放本任务模型；不会清理其他模块模型或修改业务数据。

## 来源、许可与清单

固定来源见 [sequence-sources.json](../tooling/video-ai/sequence-sources.json)，其中包含源码 revision、Git blob、标准化后 SHA-256，以及权重来源、大小和摘要。

| 引擎       | 固定 revision                              | 随包许可                                  |
| ---------- | ------------------------------------------ | ----------------------------------------- |
| STTN       | `f39f62c5bbbe3e3eba084c487353a2c651bfdcde` | MIT                                       |
| ProPainter | `326782529a63d997cab80ab21439b92ed422b3d3` | S-Lab License 1.0，按用户确认的非商用用途 |

每个引擎目录保留 `LICENSE`、`PROVENANCE.json`、`sequence-bundle.json`。改动限于命名空间内的相对导入、换行规范化及必要包初始化文件；不带训练数据或执行训练。来源文件和权重分别核对，不能把基础包的 MIT 描述视为所有第三方资产的统一许可。

SPDX 2.3 清单列出逻辑文件及 Python 固定版本，包级未知许可保留 `NOASSERTION`，不能用清单替代逐项许可记录。构建器现兼容锁文件的多行哈希和行内哈希；实际清单为 CPU 82 个、CUDA 15 个 Python 包，包含 einops / SciPy。

## 本机离线审阅材料

本轮根目录：`.package/video-ai-sequence-s07-20261106/`，不进入 Git 或桌面分发资源。

| 路径                                             | 用途                                            |
| ------------------------------------------------ | ----------------------------------------------- |
| `base-stage/`、`cuda-stage/`                     | 实际新版本暂存内容，包含固定依赖和模型          |
| `base-definition.json`、`cuda-definition.json`   | 准备器派生的完整归档定义                        |
| `review-final/video-ai/1.1.0-py312-cpu1/`        | CPU 最终未签名审阅归档、SPDX 与 `.review.json`  |
| `review-final/video-ai-cuda/1.1.0-py312-cu1241/` | CUDA 最终未签名审阅分卷、SPDX 与 `.review.json` |
| `offline-inventory-final.json`                   | 实测大小、SHA-256、条目与逻辑文件核对结果       |
| `cpu-lock-audit.log`、`cuda-lock-audit.log`      | 完全离线、哈希锁定的 pip 依赖闭包检查           |
| `verify-review-final.log`                        | 全部归档、文件、分片重组和 SBOM 核对日志        |

早期 `review/` 和 `offline-inventory.json` 保留作排查记录，其 CUDA SBOM 漏列两个行内哈希依赖；**以 `review-final/` 与 `offline-inventory-final.json` 为准**。

完整离线组合需要 CPU 1 个归档和 CUDA 4 个归档，共 5 个；另须既有签名 Python 3.12、FFmpeg 能力。不能只取主 CUDA 归档或其中一个 torch 分卷。

| 归档                                                           |    实测字节数 | SHA-256                                                            |
| -------------------------------------------------------------- | ------------: | ------------------------------------------------------------------ |
| `video-ai-1.1.0-py312-cpu1.tar.gz`                             |   673,898,034 | `0a829d1fa31e8a74e7012284e2a4f63765f8cdf61081fb9e63f831093cad5a0b` |
| `video-ai-cuda-1.1.0-py312-cu1241.tar.gz`                      |   312,164,576 | `88cb9eb2aacbf65dbfa007657e69a76cb7687a6c4fed381a789fd5d30e1cfa12` |
| `video-ai-cuda-1.1.0-py312-cu1241-cuda-torch-part-0001.tar.gz` | 1,498,292,694 | `dbb92fe0985fcc6e9d849a8f11b0f166d5307733cfff073288e8f5c0b0d9fd0f` |
| `video-ai-cuda-1.1.0-py312-cu1241-cuda-torch-part-0002.tar.gz` | 1,028,311,500 | `d1334fdaf3fab7c87183f5579ff9e937c9e041a0cb39908e02a406d9a9abdab4` |
| `video-ai-cuda-1.1.0-py312-cu1241-cuda-torchvision.tar.gz`     |     6,097,876 | `4350957a4485b6de6a481839e41ec49f7682cddcaabaf222098e5d5ac3faed69` |

CPU 压缩后约 642.68 MiB，CUDA 所有分卷合计约 2.649 GiB；CPU 97 个逻辑文件、CUDA 51 个。每个归档均小于 2 GiB。解压后的有效负载分别为 700,696,999 / 2,870,911,645 字节；这些数值不包含 Python 安装后的展开环境、暂存和回退空间，不能视为实际安装占用。

归档检查按流读取所有文件，核对主卷和附加卷的大小 / SHA-256、路径安全、重名、签名候选文件集合与 SPDX。torch 逻辑大文件还核对分片顺序、各片摘要及拼接摘要，未借重复依赖安装完成验证。

`.review.json` 明确写入 `installable:false`、`requiresSignature:true`，没有协议签名、keyId、受信公钥或 `.manifest.json`。其中 `example.invalid` 是审阅占位地址，不能用于在线安装。离线导入仍必须使用后续真实签名发行物，不能改文件后缀或绕过验签。

## 离线复现准备和审阅

在仓库根目录执行，变量填写已有文件或目录的绝对路径。`$workRoot` 应为新的独立目录，不能指向旧版本、已安装 generation 或本轮证据目录。原 CPU 锁和旧版本定义不修改。

```powershell
$pythonDev = '<已有 Python 3.12 开发解释器>'
$cpuWheels = '<包含 CPU 锁全部 wheel 的离线目录>'
$cudaWheels = '<包含 CUDA 新锁全部 15 个 wheel 的离线目录>'
$assetCache = '<已有 LaMa 与 OCR 资产缓存>'
$sequenceCache = '<按 sequence-sources.json 核对的源码和权重缓存>'
$workRoot = '<新的独立准备目录>'

node scripts/prepare-video-ai-component.mjs --python $pythonDev `
  --stage "$workRoot/base-stage" --wheelhouse $cpuWheels --asset-cache $assetCache `
  --definition-output "$workRoot/base-definition.json"
node scripts/prepare-video-ai-cuda-component.mjs --python $pythonDev `
  --stage "$workRoot/cuda-stage" --wheelhouse $cudaWheels --sequence-cache $sequenceCache `
  --definition-output "$workRoot/cuda-definition.json"

# 不传私钥；不读取签名环境变量；不会生成可安装清单。
node scripts/build-component-package.mjs --definition "$workRoot/base-definition.json" `
  --stage "$workRoot/base-stage" --output "$workRoot/review" `
  --asset-base-url https://example.invalid/components/ --review-only true
node scripts/build-component-package.mjs --definition "$workRoot/cuda-definition.json" `
  --stage "$workRoot/cuda-stage" --output "$workRoot/review" `
  --asset-base-url https://example.invalid/components/ --review-only true
```

CPU 的 `--wheelhouse` 使用 `--no-index --find-links`、`--require-hashes --no-deps`，不查询远程索引；模型缓存不完整则先补齐缓存。CUDA 准备器只使用明确提供的 wheelhouse / 源码权重缓存，拒绝缺包、摘要错误或旧发布版本。

## 新旧组合、失败与回退

以下由 `video-ai-sequence-assets.test.ts`、能力管理器 / 自检 / generation 测试覆盖。是临时目录夹具和实际源代码链路的结果，不是新签名包实装结论。

| 基础包 / GPU 扩展                      | 保持的行为                                              |
| -------------------------------------- | ------------------------------------------------------- |
| 旧基础包 / 无 GPU                      | 原 CPU 能力和旧 Worker 可继续使用                       |
| 新基础包 / 旧 GPU                      | 不强制要求时序资产，旧快速档继续兼容                    |
| 旧基础包 / 新 GPU                      | 缺新基础协议时拒绝新扩展激活；保留可用 CPU 路线         |
| 新基础包 / 新 GPU                      | 独立解析签名引擎路径；基础模型根目录不变，CUDA 依赖优先 |
| 新基础包 / 无 GPU                      | 验证新基础辅助文件，保留 OpenCV / LaMa                  |
| 辅助脚本篡改、错平台、越界或不兼容描述 | 明确失败，不跳过签名 / 文件校验                         |
| 安装取消、自检失败、更新失败           | 沿用原管理器状态机和旧 current，不手动覆盖版本目录      |

未来升级顺序为 Python / FFmpeg 已就绪 → 新基础包 → 新 CUDA 扩展。更新前保留旧完整签名包；发生失败使用原能力管理流程重试或重装旧签名版本，禁止手改 current、拼装旧新 generation 或删除用户任务。回退应用时，也应配套使用兼容旧基础协议的扩展。

## 本轮验证结果与证据位置

完整日志根目录：`.package/video-ai-sequence-s06-20261106/`。

| 验证                                 | 实际结果                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| Python 无模型轻量测试                | 60 通过；隔离源码、模型 / 数据目录与网络                                        |
| 生产 Worker 轻量协议 / 生命周期测试  | 56 通过；含时序诊断加载状态和异常关闭                                           |
| Python Ruff / 格式 / Mypy            | 通过，未关闭检查或使用 `any` 绕过                                               |
| runtime-core / shared / API          | 26 / 174 / 1858 通过；API 6 跳过                                                |
| Web 覆盖率重跑                       | 929 通过；保留原超时与覆盖率门槛，串行重跑全体                                  |
| 桌面                                 | 186 单元 + 7 冒烟脚本测试通过；main / preload 编译通过                          |
| 浏览器 E2E                           | 13 通过；关闭截图、视频与 trace，覆盖其他模块与视频任务流程                     |
| 差异覆盖率                           | 固定基线 + 工作区全部改动，3539/3903，90.67%，90% 门槛不变                      |
| 类型 / 架构 / Knip / 受管源码 ESLint | 通过                                                                            |
| 普通 `pnpm build`                    | 通过；150 / 75 KiB 预算、隔离源码 / ZIP / 异目录 / 分发布局及备份恢复冒烟未降低 |
| S06 初次全量 `pnpm test:scripts`     | 184 项：182 通过、1 跳过、1 既有样式指纹失败；后续修复结果见下节                |

初次全库覆盖率的两个 700 / 1000 文件前端用例因同时运行的负载超过原 20 秒超时；未改超时或测试。全体前端串行重跑 929 项通过。初次 E2E 的两个失败是过时断言：旧音频库名称和固定 6 个服务；按当前名称及 13 项服务更新后重跑全体，未删测试或修改业务行为。

真实 GPU 联调报告为 `api-real/report.json`：使用实际后端路由、队列、持久化、Worker HTTP 认证、FFmpeg 和两套模型；仅在隔离进程中注入模型工厂与验收用健康状态，不修改资源开关或安装目录。验证无令牌拒绝访问、活跃任务拒绝删除、GPU 取消无下载、两档成功下载、重启保留三条历史、删除独立测试数据及原片摘要不变。输出留在该目录，测试数据库已关闭并清理。

`propainter-long/report.json`：真实生产流水线处理 3600 帧、432×240、约 120.12 秒的合成视频，输出帧率 `2997/100`、AAC，音画时长差约 0.12 毫秒。稳态分配显存在约 114～120.4 MiB 两个阶段值之间，抽样主进程峰值稳定约 1983.2 MiB；不含 FFmpeg 子进程。独立 GPU 阶段取消约 0.125 秒，模型关闭、无成功输出、无中间视频。上述仅证明此字幕裁剪配置，不推断全画面、任意视频或所有显卡。

用户短片对照仍保留在 S04 / S05 目录：STTN `real-sttn.mp4`、ProPainter `real-propainter.mp4` 及各自 `real-lama.mp4`。两者均保留 872 帧、576×1024、音频包摘要与原片一致；画质需用户查看残字、闪烁、人物 / 商品边缘及转场。

## 明确保留的未验收项

1. 真实画质尚未获得人工确认；当前只有一段用户自然素材，不能代替更多横屏、人物运动及自然转场验收。
2. macOS 原生运行和安装包级验收未执行；首版目标仍为 Windows / NVIDIA，macOS 不声明支持 CUDA 时序档。
3. 未对新版本执行真实签名安装、激活、在线升级或发行回退实装；离线闭包检查不等于真实新 generation 安装验收。

## 已修复的独立工程问题（2026-11-06 后续）

- **VSEQ-B01**：已确认是 R11 后三项已提交功能修复与历史冻结级联不同。保留原冻结 JSON，以独立登记逐项验证选择器、来源、声明、层级及位置，再在 AST 副本上还原历史级联。生产 CSS 不改动，未登记的变更仍会失败，详见 [R11 样式归属](refactoring/r11-style-ownership.md)。
- **VSEQ-B03**：`pnpm lint` 改为复用格式门禁的 Git 文件清单，覆盖受控文件与未被忽略的新文件。已被 Git 忽略的本机临时脚本不再混入检查；ESLint 规则、忽略配置与零告警门槛不变。真实 Git 夹具证明未提交 Vue 错误仍失败、强制受控的忽略路径仍被检查。保留原临时脚本，受控的诊断 JSON 只修正排版，内容与顺序不变。
- 全量工程测试现为 188 项：187 通过、原有 1 跳过、0 失败。详细检查与保护摘要位于 `.package/engineering-fixes-20261106/`；原 S06 失败日志仍保留，不改写原记录。

后续只有在画质确认、上述发行前验收完成并明确安排签名后，才可在**新暂存版本**中受控开放引擎、用真实固定资产 URL 重建并签名、核验目录和完整离线导入。不得直接改当前已安装包、旧归档或审阅 JSON；实际安装包仍由用户制作验证。业务数据及历史格式不需要迁移。
