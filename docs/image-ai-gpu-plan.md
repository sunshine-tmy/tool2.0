# 图片 AI GPU 接入方案

日期：2026-11-24。状态：已完成代码接入及 Windows 签名能力包制作；未运行功能/模型测试，未发布到 GitHub Release。首期目标为 Windows NVIDIA CUDA，适配 RTX 3060 Ti 8 GB；功能验收由用户执行。

## 接入前的问题与范围

- `desktop-capability-runtime.ts` 将图片 Worker 的 `IMAGE_AI_DEVICE` 固定为 `cpu`，当前基础包也采用 CPU PyTorch。
- `image-ai-worker.py` 在桌面模式下将 BiRefNet 的 ONNX Provider 固定为 `CPUExecutionProvider`；只改 PyTorch 设备无法加速这条路径。
- 截图中的 BRIA 回退由缺少 `kornia` 触发。现有临时依赖目录不能代替完整锁文件，应审计模型代码的全部导入及 Transformers 自定义模型兼容性。
- 当前进度主要按完成图片数量更新，加载模型与单张推理期间缺少阶段信息；GPU 接入同时补充阶段状态。

首期覆盖 BRIA RMBG 2.0、BiRefNet、LaMa、Real-ESRGAN。OCR 维持 CPU，并明确显示设备。macOS 保留现有路径，不安装 CUDA；MPS/CoreML 加速另行规划。

## 本次交付与启用

- CPU 基础包：`image-ai 1.1.0-py312-cpu1`，补齐 BRIA 依赖和新版 Worker。
- GPU 扩展：`image-ai-cuda 1.0.0-py312-cu1241`，独立完整环境，含四类模型的 GPU 推理后端；OCR 保持 CPU。
- 固定版本：Python 3.12、torch 2.6.0 + CUDA 12.4、torchvision 0.21.0、ONNX Runtime GPU 1.20.2、transformers 4.48.3、timm 1.0.15、kornia 0.8.2。
- BRIA 固定到 `6a88d6a65119856a743be87ec1e6bee6f08e1f93`，通过 `scripts/image-ai-bria-assets.json` 校验模型及自定义代码；使用已有授权下载目录，不在包内重复分发权重。
- 签名目录已更新，共 14 项能力；基础资源仍为 13 个归档，三类 CUDA 扩展合计 12 个归档，总计 25 个。

新包位于项目根目录 `.package/image-ai-gpu-20261124/release/`。共 **9 个 Release 资产**：CPU 归档、manifest、SBOM 各一份；GPU 主归档、2 个 torch 分卷、torchvision 分卷，以及 GPU manifest 和 SBOM。全部已同步到 `offline-resources/components/`，均受 Git 忽略。源码 Git 中只保留签名目录、哈希锁与实现；原 CPU 归档保留供回滚参考。

源码环境启用：先等待现有任务结束，运行 `stop.bat`，再运行 `start-gpu.bat`。启动器按签名目录安装新版基础包和可选 GPU 包；不修改正在运行的旧服务。安装后进入图片处理，选择“自动”或“NVIDIA GPU”。仅修改源码和制作包不会让旧进程自动切换推理环境。

桌面发行版需使用包含本次代码与目录的新版本应用；旧安装包不会自动认识新增能力。外部机器下载安装前，需将上述 9 个资产上传到现有 `components-v1` Release；本次没有上传或发布。BRIA 权重需按已获授权的方式另外准备到运行时模型目录中的 `image-ai/BRIA-RMBG-2.0/`。

GPU 环境的 wheel 展开体积约 6.83 GB，连同离线依赖归档约 10.10 GB；manifest 按 **12 GB** 预留安装空间，联网安装还需另计下载缓存。建议已有基础包的机器安装前留出至少 18 GB 可用磁盘空间。包体、文件摘要和签名以生成 manifest 为准。

已执行依赖解析、固定资源摘要校验、签名资产制作、签名目录组装及静态核对。未执行模型推理、功能测试、类型检查、应用构建或桌面安装包构建；速度、显存峰值、输出质量和不同驱动版本的兼容性由用户按下方清单验收。

## Mac 兼容补丁

- 设备选择、GPU/CPU 硬件摘要、CUDA 环境说明和执行设备详情仅在 Worker 明确报告 Windows 时显示。旧 Mac Worker 无平台字段时也保持原界面，首次加载不显示 Windows GPU 提示。
- Mac 的主操作和历史详情沿用原状态卡、进度条及警告展示；不读取或保存设备偏好，不提交设备选项。服务端对 Mac 新任务和恢复任务统一使用 CPU，避免历史 GPU 偏好影响执行。
- Mac 制包输入补入 `timm 1.0.15`、`kornia 0.8.2`、`kornia-rs 0.2.0`，补齐新版共用 Worker 的依赖自检；其余原有 Mac 依赖版本及哈希块保留。新增哈希包含 Python 3.12 / Apple Silicon 的 Rust wheel，并按发布元数据核对必需依赖。
- 本补丁没有更换已发布的 Mac 签名包、目录版本或推理引擎，没有启用 CUDA/MPS，也没有改动上述 9 个 Windows Release 资产。Mac 新包仍需在 Apple Silicon 原生环境制作，并使用新的发布版本，不能覆盖原版本资产。
- 仅完成元数据、界面条件和代码静态核对；未运行 Mac 模型、功能、依赖安装或实机制包验证。

## 运行时与能力包

新增 `image-ai-cuda` 可选能力，依赖 `image-ai` 和 `python-312`，采用独立虚拟环境。基础包继续承担 CPU 回退及已有模型资源，扩展包提供 GPU 依赖；两个环境都必须有各自完整、带哈希的依赖锁。

本次采用项目已有的 Python 3.12、PyTorch 2.6.0 + CUDA 12.4、torchvision 0.21.0。PyTorch 官方提供该组合的 Windows wheel。ONNX GPU 版本单独按 CUDA/cuDNN 矩阵选择，采用与该基线匹配的 1.20.2；不能将现有 CPU ONNX Runtime 版本直接替换为同版本 GPU 包。最终版本及传递依赖已写入哈希锁；实际模型运行兼容性仍待用户验收。

- CPU 与 GPU 环境均补全 `timm`、`kornia` 及模型实际需要的传递依赖；审计后决定是否需要 `einops`，不凭猜测添加。
- GPU 环境只安装 `onnxruntime-gpu`，避免与 `onnxruntime` 共用同一 Python 命名空间。调整 rembg 依赖输入，避免 `[cpu]` extra 再次引入 CPU ONNX 包。
- Windows DLL 从选中环境的固定运行库加载；检查 CUDA、cuDNN 和 VC++ 运行库。不依赖其他能力包的活动 venv，不修改系统驱动或全局 Python。
- 复用已安装基础包的模型，以及用户已授权下载的 BRIA 目录；模型文件及自定义代码固定版本和摘要。推理阶段保持离线，不隐式重新下载模型。
- 将依赖修复和 Worker 更新发布为基础包的新版本；不直接修改已签名安装目录，也不覆盖现有 Release 的同名资产。
- 源码启动和桌面端走同一选择逻辑。扩展包加入可选 CUDA 资源清单，CPU 用户无需下载 GPU 环境。

## 设备与回退规则

设置提供“自动 / NVIDIA GPU / CPU”，默认自动。设备设置与现有模型策略分开，处理前确定，任务内不随设置变动。

| 选择       | 行为                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| 自动       | 扩展包、驱动及对应推理后端就绪时使用 GPU；不可用时使用 CPU，并展示原因       |
| NVIDIA GPU | 缺包、驱动不兼容、CUDA Provider 初始化失败或显存不足时明确报错，保留重试入口 |
| CPU        | PyTorch 和 ONNX 均明确使用 CPU，不因系统有显卡而偷偷启用 GPU                 |

自动模式发生显存不足时，释放当前模型后，同一模型最多回退 CPU 重试一次。BRIA 缺少依赖、模型无法加载等问题属于模型故障；按现有策略回退 BiRefNet 时单独记录原因。设备回退与模型回退分别上报，避免循环重试或隐藏失败。

缓存键包含模型、设备和精度。设备切换通过现有任务维护机制在空闲时应用，不中断运行中的任务。Real-ESRGAN 显式传入设备，BiRefNet 在创建会话后核对实际 Provider；不能仅凭 CUDA 可用就宣称本次用了 GPU。

## 8 GB 显存与处理性能

- 复用现有 AI 资源调度，图片批次逐张推理，同一 GPU 避免与视频修复、音色克隆同时抢占；等待期间展示排队状态。
- 同一图片 Worker 保持单模型缓存，切换模型释放旧资源。连续处理同类图片复用模型，不每张重载；记录冷启动和后续推理耗时。
- BRIA 维持当前 1024 输入和原图尺寸透明 PNG 输出，使用 `inference_mode`；混合精度按模型兼容性启用，不能为提速静默改变输出尺寸。
- Real-ESRGAN 使用分块，显存不足时有限次缩小块尺寸；保持输出倍率，仍不足则按所选设备策略处理。
- LaMa、BiRefNet 分别制定显存限制和预处理上限；不强制所有模型使用 FP16。ONNX 内存限制与实际 CUDA 显存共同监测，不能视为绝对防止 OOM 的保证。
- 限制全分辨率图像副本和批次预加载，避免 16 GB 主机内存持续吃满；取消任务后及时释放中间图像、会话及临时输出。

## 状态、进度与诊断

页面展示实际模型、实际设备、精度、GPU 名称和回退原因。阶段使用“等待资源 / 加载模型 / 图片处理 / 写入结果”，单次推理无可测百分比时展示阶段活动状态，不伪造连续进度。

健康检查区分“硬件可见 / 运行库可用 / 模型文件齐全 / 模型可加载 / 本次实际后端”。轻检查不加载模型；深检查由用户主动触发且避开运行任务。错误以中文概述，技术细节折叠保留缺包名、Provider/DLL、版本及错误码。

诊断记录请求设备、实际设备、Torch/CUDA/cuDNN/ONNX 版本、实际 Provider、峰值显存和各阶段耗时。GPU 利用率不以任务管理器默认的 3D 图作为唯一判断依据，也不承诺持续满载。

## 分阶段交付（工程及包制作已完成，实机验收待执行）

| 阶段           | 实施内容                                                                                                              | 交付结果                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 一：依赖与环境 | 审计 BRIA 依赖及自定义代码兼容性；更新 CPU 依赖锁；新增 GPU 定义、完整锁文件和制包入口；接通运行时选择与驱动/DLL 诊断 | 可独立安装、选择和回退的图片 GPU 环境               |
| 二：推理与交互 | 四类模型接通实际 GPU 后端；设备设置、有限回退、缓存、资源调度、分块与显存管理；补全阶段进度和结果设备信息             | 源码和桌面共用的 GPU 处理链路                       |
| 三：离线与交付 | 生成新版签名能力包及目录；更新可选离线资源和启动文档；完善升级、卸载、旧草稿/历史记录兼容；提供用户验收清单           | 正式可分发资产及安装/回滚说明；实机验收状态单独记录 |

正式包体大小、安装空间和性能数据以实际制包及用户实测为准，不提前承诺倍数。实现阶段不代用户执行模型或功能测试；未验证项目明确标记，不能因代码完成而称作实机验收通过。

## 主要改动位置

- `scripts/image-ai-worker.py`：显式设备、ONNX Provider、缓存、精度、回退、诊断和阶段上报。
- `scripts/image-ai-requirements.txt`、`scripts/image-ai.lock.txt`：基础依赖修复；新增 GPU 专用依赖输入和哈希锁。
- `scripts/component-definitions/`、`tooling/components/`：新增 `image-ai-cuda` 定义和制包逻辑，保留 CPU 制包约束。
- `apps/api/src/runtime/desktop-capability-runtime.ts`、`source-bootstrap.ts`：能力选择、升级维护和源码可选安装。
- `apps/api/src/domains/image-ai/`、`packages/shared/src/image/image-ai.ts`：任务设备配置、Worker 进度与结果信息契约、持久化兼容。
- `apps/web/src/features/image-ai/`：设备选择及实际执行状态，沿用当前共享控件和 UI 规范。
- `tooling/source/` 及能力诊断、管理相关模块：生成资源目录、离线安装、修复和回滚。

## 用户验收清单

1. 仅 CPU 基础包时照常处理；安装 GPU 扩展后，四类模型分别确认真实设备和输出，BRIA 不再因缺少依赖回退。
2. 对同一图片记录 CPU、GPU 冷启动及第二次处理耗时、峰值显存和输出质量；确认透明 PNG 尺寸及超分倍率。
3. 覆盖十张批次、大图、取消、低可用显存和其他 AI 任务占用；无无限重试、无成功状态覆盖失败。
4. 拔网启动、已有模型复用、中文目录、能力升级/卸载/回滚可用；CPU 模式和 GPU 强制模式符合上表。
5. macOS 继续使用原能力，不请求 CUDA 包、不产生错误的 GPU 可用标记；OCR 显示实际 CPU 后端。

## 技术依据

- [PyTorch 官方历史版本与 CUDA wheel 组合](https://pytorch.org/get-started/previous-versions/)
- [ONNX Runtime CUDA / cuDNN 兼容矩阵与 DLL 加载](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html)
- [BRIA RMBG 2.0 官方模型](https://huggingface.co/briaai/RMBG-2.0)
