# ADR-002：可选能力包的完整性与生命周期

状态：已接受（设计约束）

## 决策

每个可选能力以固定平台、固定版本、固定协议版本的能力包交付。能力包至少包含 manifest、文件清单、SHA-256、签名、第三方许可证和 SBOM。

安装顺序固定为：下载到 `.partial`、验证大小和摘要、验证签名、在隔离目录安全解压、验证文件清单和自检、原子切换 `current.json`、保留上一版本。安装失败不得覆盖当前健康版本。

Worker 只监听 loopback 动态端口，启动时由主程序传入随机令牌。主 API 与 Worker 的请求必须携带该令牌；不能把 Worker URL、命令或任意下载 URL 暴露给 renderer 配置。

能力包分为以下类别：

| 类别 | 包 | 安装策略 |
| --- | --- | --- |
| 媒体基础 | ffmpeg、ffprobe | 可随核心安装器携带，或首次使用安装 |
| 小型在线能力 | edge-tts runner | 核心安装器或首次使用安装 |
| 转写 | faster-whisper 和模型 | CPU/CUDA 与模型拆分，按需安装 |
| 图片 AI | Python Worker、依赖和模型 | CPU/CUDA 拆分，按需安装 |
| 声音克隆 | Chatterbox Worker、依赖和模型 | CPU/CUDA 拆分，按需安装 |
| XHS 归档 | XHS-Downloader、受管 Python、登录浏览器 | 首次使用安装；受 GPL 和平台条款约束 |
| XHS 翻译 | CTranslate2、OPUS-MT 模型 | 首次翻译安装或离线导入 |

## 禁止事项

- 不直接压缩现有 `.venv-*` 作为可移植发行物，必须先进行可移动运行时验证。
- 不下载未固定版本或未验证摘要的依赖、模型或浏览器。
- 不允许前端指定本机可执行文件、shell 命令或安装 URL。
- 不在更新应用时删除或覆盖 `data`、`components` 和用户配置。

## 发布前阻断项

1. 根项目许可证未确定。
2. XHS-Downloader 的 GPL 分发与集成义务未经法律/版权负责人确认。
3. FFmpeg 构建配置、Whisper、PyTorch、Paddle、BiRefNet、Chatterbox 和模型的再分发条款未逐项确认。
4. 代码签名证书和更新源尚未提供。
