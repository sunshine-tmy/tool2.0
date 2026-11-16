# macOS FFmpeg 验证候选

M02-01 使用固定源码构建 macOS 14+ / Apple Silicon arm64 的 FFmpeg 8.1.2 与 FFprobe。x264、LAME、libogg、libvorbis 和 libopus 的 URL、版本/commit、SHA-256 与业务能力清单见 [`macos-media-sources.json`](../tooling/components/macos-media-sources.json)。

## 构建

构建机需安装 Xcode Command Line Tools，并在 `PATH` 中提供 `pkg-config`（pkgconf 可用）。FFmpeg 配置通过 `PKG_CONFIG_LIBDIR` 限定到本次临时 prefix；Homebrew 只可提供 `pkg-config` 工具，不能提供任何待链接媒体库。

```sh
pnpm components:prepare-ffmpeg -- --stage ".package/macos-validation/<run-id>/media/FFmpeg macOS arm64 验证"
```

stage 必须是尚不存在的新目录。源码归档缓存于 `.package/macos-media-source-cache/`，每次使用前按源码锁复核 SHA-256。依赖库通过 `DESTDIR` 安装在隔离临时根目录，不写系统路径；成功后临时源码和对象文件会清理。

## 候选内容和边界

成功的 stage 包含 `bin/ffmpeg`、`bin/ffprobe`、原始许可证/NOTICE、`SOURCE_LOCK.json`、`PROVENANCE.json`、`CAPABILITIES.json` 与合成素材编码结果 `SMOKE-RESULTS.json`。准备器在拷贝前核对 arm64 Mach-O、macOS 最低版本、动态库依赖和编码器/解码器/filter/muxer 清单，并对 H.264/AAC、MP3、Vorbis 与 Opus 执行合成编码读取 smoke。

这些 smoke 只证明候选二进制和编码库可用，不替代 M02-02 的真实业务媒体流程验收。为透明 PNG 解码明确链接 macOS 系统 zlib，其他外部媒体编解码库静态链接。启用 x264 后，这个 FFmpeg 候选按 GPLv2 许可发布条件处理；各依赖的许可证原文随 stage 保留。
