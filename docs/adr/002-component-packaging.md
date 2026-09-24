# ADR-002：可选能力包的完整性与生命周期

状态：已接受（设计约束）

## 决策

每个可选能力以固定平台、固定版本、固定协议版本的内部能力包交付。能力包至少包含 manifest、文件清单、SHA-256、签名和 SBOM；许可信息可随包记录以供参考，不作为内部工程构建和验收门禁。

安装顺序固定为：下载到 `.partial`、验证大小和摘要、验证签名、在隔离目录安全解压、验证文件清单和自检、原子切换 `current.json`、保留上一版本。安装失败不得覆盖当前健康版本。

桌面安装自检在最终 generation 目录运行，并只使用随包构建的 Python、脚本及模型：FFmpeg/ffprobe 执行版本探测；转写检查 faster-whisper 导入和 Whisper 模型文件；Edge-TTS 执行协议 `check`；图片处理校验 CPU 推理依赖和固定模型；Chatterbox 校验 V3 API 与四个模型文件。图片和 Chatterbox 的 Loopback Worker 还须通过运行时健康检查。自检或 Worker 健康检查失败时，安装器不切换或恢复 `current.json` 到旧 generation，并保留原有可用版本。

Worker 只监听 loopback 动态端口，启动时由主程序传入随机令牌。主 API 与 Worker 的请求必须携带该令牌；不能把 Worker URL、命令或任意下载 URL 暴露给 renderer 配置。

能力包分为以下类别：

| 类别         | 包                                      | 安装策略                               |
| ------------ | --------------------------------------- | -------------------------------------- |
| 媒体基础     | ffmpeg、ffprobe                         | 可随核心安装器携带，或首次使用安装     |
| 小型在线能力 | edge-tts runner                         | 核心安装器或首次使用安装               |
| 转写         | faster-whisper 和模型                   | CPU/CUDA 与模型拆分，按需安装          |
| 图片 AI      | Python Worker、依赖和模型               | CPU/CUDA 拆分，按需安装                |
| 声音克隆     | Chatterbox Worker、依赖和模型           | CPU/CUDA 拆分，按需安装                |
| XHS 归档     | XHS-Downloader、受管 Python、登录浏览器 | 设置中显式安装，浏览器可复用或单独安装 |
| XHS 翻译     | CTranslate2、OPUS-MT 模型               | 首次翻译安装或离线导入                 |

## 禁止事项

- 不直接压缩现有 `.venv-*` 作为可移植发行物，必须先进行可移动运行时验证。
- 不下载未固定版本或未验证摘要的依赖、模型或浏览器。
- 不允许前端指定本机可执行文件、shell 命令或安装 URL。
- 不在更新应用时删除或覆盖 `data`、`components` 和用户配置。

## 当前工程约束

1. 内部包需固定平台、版本、来源、文件摘要、SBOM 和签名；不能用本机开发环境冒充安装资产。
2. 内部包源、签名公钥与私钥保管方案须可用于用户安装与更新。
3. 代码签名证书和更新源尚未提供，不能形成正式签名安装器。

当前项目范围为组织内部使用；许可或再分发逐项审批不阻断内部实现、CI 与验收。BRIA 权重当前尚未加入受管模型源，是资产接入工作而非许可门槛。若将来需要对外分发，再另行评估该范围。

## 内部包构建

`pnpm components:package` 从已准备好的 staging 目录生成固定时间戳的 `.tar.gz`、文件 SHA-256 清单、SPDX 2.3 SBOM 和 Ed25519 签名 manifest。定义文件可选提供 Python 解释器、wheelhouse、锁文件及 Python 版本；锁文件的摘要会写入签名 manifest，并把锁中的固定包名/版本记录到 SBOM。私钥仅从 `--signing-key-file` 或 `COMPONENT_SIGNING_KEY_FILE` 读取，禁止放入 staging 目录；公钥按 key ID 输出到 `trusted-keys/`。

示例：

```powershell
$env:COMPONENT_SIGNING_KEY_FILE = 'D:\internal-secrets\component-signing-private.pem'
pnpm components:package -- --definition scripts/component-package-definition.example.json --stage .package/stage/edge-tts --output .package/component-feed --asset-base-url https://packages.example.internal/components/
pnpm components:catalog -- --feed .package/component-feed
```

包目录和应用目录组装会验证签名、归档大小/摘要、SBOM 摘要、受信任公钥 ID、重复模块 ID 与缺失依赖。生成的 `backend/src/modules/components/catalog.generated.ts` 只包含 manifest 和公钥；签名私钥永不输出。实际用户安装前，仍需将版本目录中的归档/SBOM 上传到 `--asset-base-url` 对应的受控 HTTPS 静态源，并将最终生成的 catalog 随桌面应用构建。
