# 智能补帧能力包交接

## 2026-11-24 Mac Apple Silicon 交付

Mac 版本为 `1.0.0-rife46-20221029-darwin-arm64.1`，沿用原有受信任 Ed25519 公钥，已接入 Mac 源码能力目录。客户端需要更新至包含该目录的构建，才能识别和离线导入此能力。用户已上传至 `mac-ability-pack-2026-11-12-01` Release，2026-11-24 已使用生产 HTTPS 能力下载器完整下载三项产物，大小、SHA-256 及清单签名均与本地产物一致。核验记录为 `.package/video-interpolation-macos-20261123/remote-verification-report.json`。

交付目录为 `.package/video-interpolation-macos-20261123/offline-install/`。

| 文件                                                                                |     字节数 | 用途                         |
| ----------------------------------------------------------------------------------- | ---------: | ---------------------------- |
| `video-interpolation-1.0.0-rife46-20221029-darwin-arm64.1-darwin-arm64.tar.gz`      | 18,499,675 | 已安装 FFmpeg 时导入         |
| `video-interpolation-1.0.0-rife46-20221029-darwin-arm64.1.toolbox-capabilities.zip` | 83,977,443 | 包含 Mac FFmpeg 的完整离线包 |

同目录包含正式签名清单、SPDX、安装说明和 `SHA256SUMS.txt`。原始包摘要为 `a0338818293cacb7ab6cd95bd23ce06bcfba9ee61ca345728c5a4616133a4dc6`，完整离线包摘要为 `82e2da69fa145124f7b4f029691831c3deed3c04aeb2f71a7a1a7f14cdef4447`。

来源为固定上游 20221029 Mac 发行包，包含原生 arm64 程序与同版本 rife-v4.6 模型。原始发行归档及各文件摘要已锁定，暂存后的可执行文件完成 ad-hoc 签名与严格验证。

已在本机完成 CPU、GPU 中间帧生成。生产 ComponentManager 在独立目录中安装 FFmpeg 与 RIFE 并执行安装自检，再导出完整包，在第二个空目录重新导入并验证文件与推理。安装验证禁止网络下载。既有十项 Mac 清单和受信任公钥逐项保持一致。记录位于 `.package/video-interpolation-macos-20261123/validation-report.json`。

本次未验收长时 4K、Intel Mac 或整段编辑器导出，也未制作桌面安装器。

## Windows x64 交付

2026-11-22 已制作 Windows x64 正式签名能力包，版本 `1.0.0-rife46-20221029`，能力 ID 为 `video-interpolation`。使用现有受信任 Ed25519 密钥；没有新增信任钥匙，私钥未复制到 staging、归档或交付目录。

## 本地产物

根目录：`.package/video-interpolation-release-20261122/`。

| 文件               | 位置                                                                                 | 大小与用途                                           |
| ------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 正式原始归档       | `offline-install/video-interpolation-1.0.0-rife46-20221029.tar.gz`                   | 12,283,527 字节，约 11.7 MiB；FFmpeg 已安装时使用    |
| 完整离线包         | `offline-install/video-interpolation-1.0.0-rife46-20221029.toolbox-capabilities.zip` | 283,416,594 字节，约 270.3 MiB；包含 RIFE 与 FFmpeg  |
| 签名清单及 SBOM    | `feed/video-interpolation/1.0.0-rife46-20221029/`                                    | `.manifest.json` 与 `.spdx.json`，用于正式分发与审计 |
| 安装说明及 SHA-256 | `offline-install/安装说明.txt`、`offline-install/SHA256SUMS.txt`                     | 交付时一并提供                                       |
| 验证记录           | `validation-report.json`                                                             | 原始包、完整包的真实隔离安装与自检结果               |
| 新目录与原目录备份 | `catalog.generated.ts`、`previous-catalog.generated.ts`                              | 新目录已写入源码；保留原始版本便于复核               |

原始归档 SHA-256：`61a88e119676dc6ad4431106410b9b0addee5648dd8f139be4c677fad4da4451`。

完整离线包 SHA-256：`fa7636173a524c998f309bcf0401257cac3d8c6de6a42a5cbe3857f17a0f8680`。

## 安装与范围

需要包含本次补帧代码及内置目录的新版客户端；旧客户端不能通过导入文件动态增加新的能力 ID。本次没有制作桌面安装器，也没有修改用户当前安装的能力或业务数据。

在“设置 → 能力管理 → 智能补帧（RIFE）→ 离线导入”中选择一个文件：已有 FFmpeg 时选择 `.tar.gz`；需要完整依赖时选择 `.toolbox-capabilities.zip`。不要手工解包、改名或复制模型到受管目录。

安装后回到归档视频编辑，点击“保存为最新版本”或“导出视频”，在输出设置中点击“重新检测能力”，选择“AI 补帧（RIFE）”、目标帧率及其他参数，开启补帧后开始处理。新版补帧统一作用于完整成片，原生能力包无需重新制作。

本次验证了：

- 来源锁、程序和模型文件摘要、归档摘要、SBOM、现有信任密钥的签名。
- 使用生产 ComponentManager，从原始归档安装 FFmpeg 与 RIFE，运行生产自检，实际生成中间帧。
- 从已安装能力导出完整离线包，在第二个空目录中导入，重新验证依赖、签名、文件和原生推理。
- 全流程禁用网络下载，仅使用交付文件；所有既有能力清单与公钥逐项保持一致。

当前验证平台仅 Windows x64；不代表已完成 macOS、长时 4K 或所有 GPU 的验收。

## 在线发布与远端验证

用户已将正式签名产物上传到 [components-v1 Release](https://github.com/sunshine-tmy/tool2.0/releases/tag/components-v1)。2026-11-22 使用生产 HTTPS 能力下载器完整下载以下三个文件，逐一核验字节数及 SHA-256，全部与本地产物一致：

- `video-interpolation-1.0.0-rife46-20221029.tar.gz`
- `video-interpolation-1.0.0-rife46-20221029.spdx.json`
- `video-interpolation-1.0.0-rife46-20221029.manifest.json`

归档大小为 12,283,527 字节，SHA-256 与上文相同。下载验证使用客户端相同的 HTTPS 跳转、公网 DNS 校验及分段请求逻辑；验证记录保存为 `.package/video-interpolation-release-20261122/remote-verification-report.json`。

源码内置目录已加入此能力，包含新目录和补帧代码的客户端可在线安装或离线导入。旧客户端仍需更新后才能识别新能力。本次上传由用户完成；助手核验了远端产物，没有制作桌面安装器、提交或推送代码。
