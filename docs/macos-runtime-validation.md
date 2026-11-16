# macOS Runtime Validation

This guide documents the implemented validation entry point. It runs only on native Apple Silicon macOS and uses explicit local paths. It never reads `.env`, changes application data, downloads dependencies, or starts the desktop app.

## Commands

Show the supported options:

```sh
pnpm validate:macos --help
```

Run preflight after a native Python 3.12 environment is available:

```sh
pnpm validate:macos --preflight \
  --python "/absolute/path/to/python3.12" \
  --assets "/absolute/path/to/validation-assets" \
  --output "/absolute/path/to/new-run-directory"
```

Run the implemented Python runtime case:

```sh
pnpm validate:macos \
  --case M01-01-python-runtime \
  --python "/absolute/path/to/python3.12" \
  --assets "/absolute/path/to/validation-assets" \
  --output "/absolute/path/to/new-run-directory" \
  --timeout-ms 300000
```

Run the pinned image AI models on synthetic inputs after the weights and the image environment are present:

```sh
IMAGE_PYTHON="/absolute/path/to/image-ai/venv/bin/python3.12"
ASSET_DIR="/absolute/path/to/new-image-validation-assets"

"$IMAGE_PYTHON" -I -B tooling/image-ai/generate-macos-validation-samples.py --assets-dir "$ASSET_DIR"
node tooling/image-ai/create-macos-validation-manifest.mjs \
  --assets-dir "$ASSET_DIR" \
  --environment-manifest "/absolute/path/to/image-ai/MANIFEST.json" \
  --lock "/absolute/path/to/image-ai.lock.txt" \
  --archive-dir "$ASSET_DIR/.incoming"

pnpm validate:macos \
  --case M01-02-image-ai \
  --python "$IMAGE_PYTHON" \
  --assets "$ASSET_DIR" \
  --output "/absolute/path/to/new-report-directory" \
  --timeout-ms 3600000
```

The asset directory must contain all files from `IMAGE_AI_MODEL_ASSETS` in `tooling/components/prepare-image-ai-component.mjs`, the two fixed PaddleOCR archive files in `.incoming/`, and the generated samples. The manifest builder verifies every pinned model digest and records the image environment lock, environment manifest, pinned model URLs, actual acquisition URLs, PaddleOCR archive digests, and synthetic sample hashes. If a model was fetched from an alternate HTTPS mirror, pass `--acquisition-source <model-name=https-url>` once for that model so provenance identifies both the pinned source and the actual download source. The probe invokes the repository's image worker with offline variables, isolated storage/cache directories, and `IMAGE_AI_DEVICE=cpu`; it refuses to import the worker if a repository `.env` file exists.

Run pinned Chatterbox CPU and MPS inference with native synthetic reference voices after downloading the fixed model revision and extracting its pinned source archive:

```sh
CHATTERBOX_PYTHON="/absolute/path/to/chatterbox/venv/bin/python"
CHATTERBOX_ASSETS="/absolute/path/to/new-chatterbox-validation-assets"
CHATTERBOX_SOURCE="$CHATTERBOX_ASSETS/source-tree/chatterbox-65b18437192794391a0308a8f705b1e33e633948"

# The pinned source must already be extracted into CHATTERBOX_ASSETS/source-tree.
# This installs only the source package metadata; the dependency lock remains unchanged.
"$CHATTERBOX_PYTHON" -m pip install --no-deps --no-build-isolation --no-index "$CHATTERBOX_SOURCE"
node tooling/chatterbox/generate-macos-validation-samples.mjs --assets-dir "$CHATTERBOX_ASSETS"
node tooling/chatterbox/create-macos-validation-manifest.mjs \
  --assets-dir "$CHATTERBOX_ASSETS" \
  --environment-manifest "/absolute/path/to/chatterbox/MANIFEST.json" \
  --lock "/absolute/path/to/chatterbox.lock.txt" \
  --model-acquisition-base-url "https://huggingface.co/ResembleAI/chatterbox/resolve/5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18"

pnpm validate:macos \
  --case M01-03-chatterbox \
  --python "$CHATTERBOX_PYTHON" \
  --assets "$CHATTERBOX_ASSETS" \
  --output "/absolute/path/to/new-report-directory" \
  --timeout-ms 3600000
```

The manifest builder verifies the four fixed Chatterbox weight sizes and SHA-256 values from `CHATTERBOX_MODEL_ASSETS`, records the pinned model revision and source commit, and preserves both upstream and actual download URLs. The three reference WAVs are generated locally with `say` voices Amira (`ms_MY`), Samantha (`en_US`), and Luciana (`pt_BR`), then converted to PCM 16-bit, 24 kHz mono. The probe checks CPU generation first for Malay, English, and Brazilian Portuguese; it then runs the same worker manager generation path on MPS with fallback disabled when MPS is available. CPU inference is required for `modelValidation: pass`; MPS status is reported independently, and a failed MPS run writes `mps-failure.txt` with the traceback and a minimal reproduction command. When MPS passes, the Worker accepts an explicit `mps` request only if the backend is built and available; it does not silently fall back to CPU. API, UI, health parsing, and persisted device contract integration remain M04-01 work.

Prepare the pinned STTN validation bundle and manifest using the isolated Mac video environment and fixed FFmpeg tools:

```sh
VIDEO_PYTHON="/absolute/path/to/video-ai/venv/bin/python"
STTN_ASSETS="/absolute/path/to/new-sttn-validation-assets"
VIDEO_ENV="/absolute/path/to/video-ai-environment"
FFMPEG="/absolute/path/to/verified/ffmpeg"
FFPROBE="/absolute/path/to/verified/ffprobe"

node tooling/video-ai/prepare-macos-sttn-validation-assets.mjs \
  --assets-dir "$STTN_ASSETS" \
  --environment-lock "$VIDEO_ENV/LOCK.txt" \
  --environment-manifest "$VIDEO_ENV/MANIFEST.json" \
  --ffmpeg "$FFMPEG" \
  --ffprobe "$FFPROBE"

pnpm validate:macos \
  --case M01-04-sttn \
  --python "$VIDEO_PYTHON" \
  --assets "$STTN_ASSETS" \
  --output "/absolute/path/to/new-report-directory" \
  --timeout-ms 3600000
```

The preparation command verifies the STTN source and weight pins in `tooling/video-ai/sequence-sources.json`, stages an inference-only bundle with `adapterReady: false`, and records the video environment, FFmpeg, and FFprobe digests. It downloads only the pinned STTN assets and does not install packages or enable a shipped adapter. The M01-04 probe injects the production `scripts/video_ai_sttn.py` adapter into the repository Worker while leaving the bundle release gate false; it checks encoder, temporal attention, decoder, original-resolution tiling and assembly on a 10-second, 1280×720 CFR video with two detected scenes, adjacent subtitle intervals, a cut-spanning interval, a tail interval, no-mask frames, and an AAC track. It verifies ordered frame markers, dimensions, frame count, finite `uint8` output, PCM audio identity, cancellation cleanup, and model release. MPS runs with CPU fallback disabled; only a failed MPS attempt is followed by an explicit CPU run, and the selected device and both memory measurements are reported. The complete media and cancellation outputs are retained in the run directory. `humanQuality` remains `pending` until a person reviews the generated video; a model runtime pass alone does not claim acceptable subtitle removal quality.

Prepare and run the pinned ProPainter bundle with the same isolated video environment and fixed FFmpeg tools:

```sh
PROPAINTER_PYTHON="/absolute/path/to/video-ai/venv/bin/python"
PROPAINTER_ASSETS="/absolute/path/to/new-propainter-validation-assets"
VIDEO_ENV="/absolute/path/to/video-ai-environment"
FFMPEG="/absolute/path/to/verified/ffmpeg"
FFPROBE="/absolute/path/to/verified/ffprobe"

node tooling/video-ai/prepare-macos-propainter-validation-assets.mjs \
  --assets-dir "$PROPAINTER_ASSETS" \
  --environment-lock "$VIDEO_ENV/LOCK.txt" \
  --environment-manifest "$VIDEO_ENV/MANIFEST.json" \
  --ffmpeg "$FFMPEG" \
  --ffprobe "$FFPROBE"

pnpm validate:macos \
  --case M01-05-propainter-video \
  --python "$PROPAINTER_PYTHON" \
  --assets "$PROPAINTER_ASSETS" \
  --output "/absolute/path/to/new-report-directory" \
  --timeout-ms 3600000
```

The bundle builder verifies the pinned ProPainter revision, source and weight digests, records the S-Lab license terms, and keeps `adapterReady: false`. Use remains limited to the recorded non-commercial terms. The probe injects the production `scripts/video_ai_propainter.py` adapter into the repository Worker while leaving the bundle release gate false: RAFT forward/backward flow stays FP32 on MPS, flow completion and repair use the requested FP32/FP16 profile, and unsupported `torchvision.ops.deform_conv2d` and `fold`/`col2im` are explicit FP32 CPU islands with measured tensor transfers and timings. Global MPS fallback is set to `0`, and any other unsupported-operator fallback warning fails the probe. Sparse appearance references remain outside adjacent RAFT flow pairs. It checks a 241-frame 1280×720 video with the exact legal 640×480 crop, audio identity, vertical 720×1280 output, one-frame scene, cancellation cleanup, over-limit rejection without resize, and model release. It then runs the same window in local FP16 (RAFT stays FP32), reporting stage time, MPS memory, and masked-pixel difference against FP32. These are synthetic model-runtime results; `humanQuality` remains `pending` until a person reviews the output and a real authorized source clip.

Each run needs a new output path whose parent directory already exists and is writable. The tool creates the output directory with private permissions. It refuses to overwrite an existing directory.

The assets directory must contain `manifest.json` using schema version 1:

```json
{
  "schemaVersion": 1,
  "resources": []
}
```

For each resource, add a unique `id`, a safe path relative to the assets directory, and its expected SHA-256:

```json
{
  "schemaVersion": 1,
  "resources": [
    {
      "id": "example-resource",
      "path": "models/example.bin",
      "sha256": "<64 hexadecimal characters>"
    }
  ]
}
```

Preflight verifies Node.js 24, macOS 14 or later on arm64, the explicit interpreter is executable Python 3.12 arm64, every manifest resource is a regular file inside the selected assets directory, the file digests match, and the output directory is new. It writes `report.json`; a successful preflight always records `modelValidation: not_run`.

`M01-01-python-runtime` checks the Python version and native architecture, imports SSL and SQLite, performs an in-memory SQLite round trip, creates a temporary venv without pip or dependency installation, and checks the venv interpreter. It does not load models. The temporary venv is removed when the probe exits.

Each case runs in a separate Python child process. The child receives a restricted environment with isolated home, cache, temporary, and storage directories under the run output. Network and model-download environment switches are disabled. Standard output and error are each capped at 64 KiB in the report. `Ctrl-C` cancels the child; `--timeout-ms` accepts 100–3,600,000 milliseconds. The report records cancellation as `blocked` and timeout or child failure as `fail`.

Reports include host memory in bytes. The best-effort `peakRssBytes` measurement samples the direct child with macOS `ps`; the report labels the RSS conversion from KiB to bytes. The M01-03, M01-04, and M01-05 model probes also sample MPS driver allocation from PyTorch. No result from the Python runtime case is model, quality, or performance acceptance.

`M01-01-python-runtime` does not load AI frameworks or models. `M01-02-image-ai` runs PaddleOCR detection and recognition, Big-LaMa, Real-ESRGAN 2× and 4×, and commercial-mode BiRefNet on the pinned synthetic inputs. `M01-03-chatterbox` runs all three languages on CPU and tests MPS separately. `M01-04-sttn` and `M01-05-propainter-video` run their pinned models through the complete Worker video path. Image model validation only passes after all five real model paths pass; Chatterbox CPU model validation only passes after all three decoded outputs are finite, non-silent, and within the duration range. Failed asset pins, missing outputs, invalid dimensions, missing transparency, child cancellation, or child failure cannot be reported as a model pass. These cases are model-runtime evidence and do not complete the F02 API/UI history, editing, deletion-protection, or human-quality checks.

## M01-06 冻结运行配置（2026-11-10）

### 主机与结论

验证主机为 Apple M1、16 GiB、macOS 15.6.1；受管 Python 为 3.12.14 arm64。视频环境固定 PyTorch 2.6.0 / TorchVision 0.21.0，音频环境固定 PyTorch / TorchAudio 2.6.0。验证适配器和模型资产仍只在 `.package/macos-validation/` 与 `tooling/` 验证路径中；STTN/ProPainter manifest 的 `adapterReady` 保持 `false`，以下设备配置不是生产能力开放声明。

M01 视频门槛通过：STTN 与 ProPainter 均走完 Worker 解码、mask、时序调度、编码、原音轨保留和取消/释放检查；两项真实样本画质均经用户确认。M01-05 选择的 ProPainter FP16 真实样本用时约 28.5 分钟，用户明确接受该画质与耗时。正确性、观感和性能的结论分开记录如下。

### 冻结矩阵

| 引擎          | 固定版本                                                                                                                                                                                 | 设备与精度                                                                                                                                              | 时序 / 空间限制                                                                                            | 实测性能与边界                                                                                                                                                                                                                                           | 人工结论                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 图片 AI / OCR | Python 3.12.14；Torch 2.6.0、TorchVision 0.21.0、PaddlePaddle 3.0.0、PaddleOCR 3.7.0、Real-ESRGAN 0.3.0、rembg 2.0.84、ONNX Runtime 1.23.2、Pillow 12.3.0                                | CPU；Torch 输入用 FP32，其他库按固定模型默认值；不开放 GPU                                                                                              | 单图处理；无时序窗口                                                                                       | 五条模型路径完整运行 490,636 ms，峰值 RSS 5,741,412,352 bytes；模型输出尺寸、RGBA alpha 和解码检查通过                                                                                                                                                   | 模型计算通过；人工图像观感留到 F02 验收                                                                    |
| Chatterbox    | 源码 `65b18437192794391a0308a8f705b1e33e633948`，模型 revision `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`；Torch / TorchAudio 2.6.0、Transformers 5.17.0、NumPy 1.26.4、librosa 0.11.0   | CPU 基线；MPS 显式请求也完成三语推理，关闭 MPS fallback；Worker 未启用 autocast/半精度，保持模型默认 FP32                                               | 无视频窗口或空间 crop；输出 24 kHz mono WAV                                                                | CPU+MPS 六个输出的完整运行 233,950 ms，峰值 RSS 5,896,093,696 bytes。正式 Worker 英文短样本另以 100 ms 间隔采样 516 次：MPS driver allocation peak 10,765,238,272 bytes、当前张量分配 peak 3,515,421,952 bytes、Worker peak RSS 3,125,657,600 bytes；该独立采样仅代表单个英文短样本，不代表三语全部负载或整机统一内存峰值。MPS 不可用时明确返回 `CHATTERBOX_MPS_UNAVAILABLE`，不静默回 CPU | CPU/MPS 数值、解码与非静音检查通过；自然度及马来语/巴葡可懂度待 F03 人工听测，MPS 不据运行通过宣称听感通过 |
| STTN          | `researchmm/STTN` revision `f39f62c5bbbe3e3eba084c487353a2c651bfdcde`；权重 SHA-256 `25b0c2c30042d82efd1893bd42ec726764262d94115393a1718f8d65d2a7817b`；Torch 2.6.0 / TorchVision 0.21.0 | MPS FP32；关闭 PyTorch CPU fallback；不把 MPS 失败静默改走 CPU                                                                                          | 窗口 center/before/after/history/references 为 4/2/2/12/2；tile 432×240、overlap 64                        | 合成完整片 119,365 ms，RSS 1,322,401,792 bytes、MPS peak 2,336,489,472 bytes。当前真实片 1,487,216 ms（约 24.8 分钟），RSS 513,409,024 bytes、MPS peak 2,408,448,000 bytes；493 帧、PTS 与 AAC PCM 均与源片一致。真实片保守场景检测只识别一个场景        | 合成和真实样本画质均由用户接受；运行时间已测量，未单独设定性能上限                                         |
| ProPainter    | `sczhou/ProPainter` revision `326782529a63d997cab80ab21439b92ed422b3d3`；ProPainter、RAFT、flow completion 权重摘要见本台账 M01-05；Torch 2.6.0 / TorchVision 0.21.0                     | **Hybrid FP16**：RAFT FP32、flow completion 与修复网络 FP16 在 MPS；`deform_conv2d` 与 `fold`/`col2im` 在显式 CPU 岛以 FP32 执行；关闭全局 MPS fallback | 保留 720p 像素预算、96 px 上下文、640×480 最大 crop、单边上限和 8 px 补边；493 帧真实样本走 247 个修复窗口 | FP16 全流程 1,711,976 ms（约 28.5 分钟），峰值 RSS 1,078,345,728 bytes、MPS peak 3,446,439,936 bytes。CPU 岛分别搬运 68,445,085,696 / 201,981,413,376 bytes，耗时 206,160.358 / 113,094.553 ms。超过 crop/像素限制返回 `RESOLUTION_TOO_HIGH`，不缩放输入 | 合成预览可接受；用户于 2026-11-10 接受 FP16 真实画质及约 28.5 分钟耗时；仍受非商用许可证限制               |

### 三类验收结论

- **计算正确性：** M01-02 五个图像模型通过；M01-03 CPU 与 MPS 三语结果通过数值、解码和资源释放检查；M01-04 STTN 与 M01-05 ProPainter 的合成完整视频、真实完整视频、音轨、PTS、取消和越界释放检查通过。M01-04 真实视频原探针报告因修正前的 21 秒抽帧点超出 16.44 秒样本而记为 `fail`；报告中的 Worker 模型推理成功，独立媒体核验 `pass_with_scene_detection_note` 且无 failures。不得把这项探针后处理错误写成模型失败或隐去。
- **人工质量：** STTN 合成与当前真实样本通过；ProPainter 合成与 FP16 真实样本通过。图片 AI 的视觉观感和 Chatterbox 的听感尚未确认，分别留待 F02、F03；本冻结不把它们写成通过。
- **性能：** ProPainter FP16 的真实样本耗时获用户明确接受；STTN、图片 AI、Chatterbox 记录了实测时长与适用内存，但用户没有为它们单独给出性能阈值。Chatterbox 正式 Worker 的单个英文短样本已记录 MPS driver allocation peak；该值不外推到另外两种语言、并发或整机统一内存峰值，不以 RSS 替代 MPS 指标。

### 固定限制与版本决策

- 不提出 Torch 升级：Torch 2.6.0 在已测 M1/macOS 15.6.1 上完成 STTN 与 ProPainter MPS 计算。ProPainter 的两个不支持 MPS 算子固定为显式 FP32 CPU 岛；任一其他 CPU fallback 都使探针失败。
- MPS 请求必须保持显式设备语义。若设备初始化/执行失败则报出原因，不静默切换 CPU；Chatterbox 的默认 CPU 行为保持不变。
- 真实样本输出保留视频编码、帧率、PTS 与原音轨；没有缩小输入、改算法或移除既有画布/crop 限制。
- 本机真实用户片源路径只在隔离报告中保留；源视频未进入 Git。ProPainter 权重按 NTU S-Lab License 1.0 本地非商用范围使用；M01 结果不授权商业发布。

### 主要证据

- 图片模型：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-02-image-ai-complete-run1/report.json`。
- Chatterbox：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-03-chatterbox-run6/report.json`。
- Chatterbox MPS 内存补测：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-03-chatterbox-mps-memory-20261116/report.json`（SHA-256 `04f4e2bb7c902c506bb63fdc45928ed4a539bfc9cfa1c85281c8fd1d9dcb9e04`）。
- STTN 合成：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-sttn-mps-post-propainter-final/report.json`；真实运行/独立核验：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-04-real-video-run3/`。
- ProPainter FP32/FP16 真实运行与独立媒体核验：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-05-real-video-run1/` 与 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M01-05-real-video-fp16-run1/`。
- 用户质量结论与报告 SHA-256 记录于 [macOS 执行台账](macos-execution-status.md) 的 M01-02 至 M01-05 条目。大模型、视频和机器报告留在忽略目录 `.package/`，不纳入 Git。
