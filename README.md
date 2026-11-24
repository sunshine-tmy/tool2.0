# 电商工具箱

本地优先的多媒体素材工作台，集中处理图片、视频、音频、内容归档与局域网文件传输。提供 Windows 桌面版、Web 开发入口和 Apple Silicon macOS 源码入口。

[快速开始](#快速开始) · [使用文档](docs/README.md) · [发布版本](https://github.com/sunshine-tmy/tool2.0/releases) · [问题反馈](https://github.com/sunshine-tmy/tool2.0/issues)

**技术栈：** Vue 3 · TypeScript · Naive UI · Fastify · SQLite · Electron · Python Workers

## 功能

| 分类       | 内容                                                               |
| ---------- | ------------------------------------------------------------------ |
| 文件协作   | 局域网文件与图文传输、预览、下载及到期清理                         |
| 图片处理   | 批量压缩、尺寸调整、AI 去水印、增强、抠图与商品图编辑              |
| 视频与内容 | 多媒体归档、视频去字幕、多轨道视频编辑、文本、配乐、水印与草稿管理 |
| 音频工具   | 在线配音、本机参考音色克隆、素材库、音频提取与格式转换             |
| 开发工具   | JSON 格式化、Base64、URL 编解码与 UUID 生成                        |

AI、浏览器和翻译等能力按需通过签名能力包安装。在线配音、平台获取及配置的外部服务需要网络；本地处理能力的模型与依赖可从离线包恢复。

## 快速开始

### Windows 源码启动

1. 克隆项目，进入仓库根目录：

   ```powershell
   git clone https://github.com/sunshine-tmy/tool2.0.git
   cd tool2.0
   ```

2. 按 [离线资源清单](docs/source-resources.md) 准备能力包，将全部所需 `.tar.gz` 归档放入 `offline-resources/components/`，保持原名、不解压。已有相同版本的备份可直接复用，无需重新下载模型。

   ```powershell
   .\start.bat -ListResources
   ```

3. 启动 Web、API 和本地 Worker：

   ```powershell
   .\start.bat
   ```

启动器支持 Windows x64，复用已有 Node.js 24，或准备固定版本的 Node/pnpm；随后安装锁定依赖、构建共享包并导入本地能力。首次会从 `.env.example` 创建 `.env`，已有配置不覆盖。缺少能力归档时会列出并停止，不自动下载模型。

默认页面为 <http://127.0.0.1:5173>，以启动输出为准。Node/pnpm 和项目依赖在没有缓存时可能需要联网。

- NVIDIA 扩展：准备清单中的额外 CUDA 归档，运行 `start-gpu.bat`。
- 停止服务：运行 `stop.bat`，或在启动终端按 `Ctrl+C`。
- 日常桌面使用、安装与升级见 [桌面应用帮助](docs/desktop-application-help.md)。

### 手动开发

需要 **Node.js 24.x** 和 **pnpm 11.7.0**。首次将 `.env.example` 复制为 `.env`，保留已有配置，然后执行：

```sh
pnpm install --frozen-lockfile
pnpm build:shared
pnpm dev
```

这些命令启动前后端开发服务；可选 AI Worker 和模型需另外准备。需要完整本地能力时，优先使用上述源码启动器。

若桌面运行时提示 Electron 未安装，执行 `node apps/desktop/node_modules/electron/install.js` 补齐运行时，再按 [启动诊断](docs/startup-diagnostics.md) 排查。不要删除锁文件或跳过必要的依赖安装脚本。

### macOS 源码启动

仅面向 Apple Silicon。准备原生 arm64 Node.js 24 和 pnpm 11.7.0，在仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm macos:prepare-resources
chmod u+x start.command stop.command
./start.command
```

停止时运行 `./stop.command`。Mac 能力包与 Windows 包不可混用；平台限制、原生依赖和分发验收状态见 [macOS 指南](docs/macos-apple-silicon-build.md)。

## 项目结构

源码、离线能力包和运行数据分开存放。复制源码运行或自行打包时，应保留以下源码与配置：

| 路径                                                    | 用途                                      |
| ------------------------------------------------------- | ----------------------------------------- |
| `apps/web/`                                             | Vue 前端                                  |
| `apps/api/`                                             | API、数据库、任务与媒体处理               |
| `apps/desktop/`                                         | Electron 桌面外壳与打包入口               |
| `packages/`                                             | 共享契约与运行时基础模块                  |
| `scripts/`、`tooling/`                                  | 公开脚本入口与工程实现，启动时均需要      |
| `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml` | 工作区、依赖版本与安装规则                |
| `.env.example`                                          | 本机配置模板                              |
| `start.bat`、`start-gpu.bat`、`stop.bat`                | Windows 源码启动与停止                    |
| `start.command`、`stop.command`                         | macOS 源码启动与停止                      |
| `offline-resources/`                                    | 本地能力归档与可选启动工具，不随 Git 分发 |
| `storage/`                                              | 源码运行的默认业务数据目录                |
| `docs/`                                                 | 使用、架构、设计及历史文档                |

## 开发与质量命令

| 命令                 | 用途                                       |
| -------------------- | ------------------------------------------ |
| `pnpm dev`           | 启动 Web/API 开发服务                      |
| `pnpm doctor`        | 只读环境诊断                               |
| `pnpm build`         | 编译共享包、后端和前端，并执行构建冒烟检查 |
| `pnpm desktop:build` | 构建桌面源码与运行资源                     |
| `pnpm desktop:make`  | 在目标平台构建桌面安装包                   |
| `pnpm test`          | 工作区单元测试                             |
| `pnpm test:e2e`      | 浏览器端到端检查                           |
| `pnpm check`         | 格式、Lint、架构、类型、测试与构建检查     |

桌面打包会按规则递增版本；签名、原生依赖和平台要求见 [桌面帮助](docs/desktop-application-help.md) 与 [macOS 指南](docs/macos-apple-silicon-build.md)。真实模型、设备和安装包验收不等同于普通源码检查。

## 配置与数据

- 配置项以 `.env.example` 为准；自定义端口、局域网访问和权限见 [运维手册](docs/operations.md)。LAN 模式面向可信局域网。
- 源码运行默认将业务数据写入 `storage/`；桌面安装版的数据位置见 [桌面帮助](docs/desktop-application-help.md)。跨设备迁移使用 [数据备份与恢复](docs/module-data-backup.md)。
- `.env`、用户数据、模型、运行环境与离线包不提交 Git。重新克隆不会恢复这些本机内容；删除项目之前应另行保存所需数据和能力包。

## 文档

| 主题           | 入口                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| 全部文档       | [文档导航](docs/README.md)                                                             |
| 离线能力包     | [资源清单与放置方式](docs/source-resources.md)                                         |
| 安装与故障排查 | [桌面帮助](docs/desktop-application-help.md) · [启动诊断](docs/startup-diagnostics.md) |
| 架构与接口     | [架构指南](docs/architecture.md) · [API 参考](docs/api.md)                             |
| 数据与运维     | [备份恢复](docs/module-data-backup.md) · [运维手册](docs/operations.md)                |
| UI 规范        | [设计系统](design.md) · [组件规范](docs/design/ui-v2/component-specs.md)               |
| 历史与待验边界 | [历史摘要](docs/history-summary.md) · [验收归档](docs/archive/README.md)               |

## 参与与说明

开发协作见 [CONTRIBUTING.md](CONTRIBUTING.md)，安全问题见 [SECURITY.md](SECURITY.md)。提交问题时请附应用版本、复现步骤及脱敏诊断信息。

本项目按组织内部使用维护。第三方代码、服务与模型遵循各自的许可和使用限制，见 [第三方说明](THIRD_PARTY_NOTICES.md) 及相应模块的交付文档。
