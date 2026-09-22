# ADR-001：桌面运行时与交付形态

状态：已接受（Windows 第一阶段）

## 背景

电商工具箱当前由 Vue 前端、Fastify API、SQLite、本地文件存储以及多种 Python/媒体 Worker 构成。现有 `standalone` 产物是源码归档，不是终端用户可直接安装和运行的桌面程序。

## 决策

1. 第一阶段仅支持 Windows 10/11 x64；不承诺 macOS、Linux 或 Windows ARM64 的安装产物。
2. 使用 Electron 作为桌面壳，保留 Vue + Fastify HTTP 架构；不将既有业务 API 批量改造成 Electron IPC。
3. Electron 主进程负责单实例、窗口、托盘、更新、下载、目录选择和子进程监管。Fastify 在 Electron utility process 中运行，桌面窗口通过同源 HTTP 访问它。
4. Fastify 必须同时提供生产版 Vue 静态资源和 `/api/v1`。本机桌面模式监听 `127.0.0.1` 随机端口；局域网模式由用户显式启用并使用固定端口。
5. Windows 分发使用 Electron Packager + electron-winstaller（Squirrel），面向用户交付 `EcommerceToolboxSetup.exe`。应用升级、能力包升级和用户数据相互隔离。
6. 安装目录和 `app.asar` 视为只读。配置、SQLite、媒体、日志、模型和可选运行时全部写入 `%LOCALAPPDATA%\\EcommerceToolbox` 或用户选择的数据目录。
7. 主安装器仅携带核心 UI/API 和必要的 Node 原生模块。FFmpeg、转写、图片 AI、Chatterbox、小红书运行时、浏览器和模型以版本化能力包形式按需安装。
8. 打包桌面模式下，浏览器窗口使用一次性 bootstrap nonce 建立 HttpOnly 本机会话；renderer 不获得 Node、文件系统、子进程或任意 IPC 权限。

## 后果

- 现有 Web 开发模式、`start.bat` 和可信局域网 Web 部署必须继续可用。
- `process.cwd()`、仓库根目录、`.venv-*` 和 `scripts/` 不能再作为打包运行时的隐含前提。
- `better-sqlite3` 和 `sharp` 必须针对实际 Electron 版本重建，且原生 `.node` 文件不能封入 ASAR。
- Electron 主程序可以是一个安装入口，但完整 AI 能力不应承诺为一个单体 exe；现有已安装可选运行时与模型约 16.6 GiB。

## 非目标

- 不在第一阶段提供离线、单文件、包含全部模型的 10+ GiB 安装器。
- 不改变在线 Edge-TTS、第三方短视频解析或小红书平台本身的网络依赖。
- 不绕过小红书验证、平台限制或第三方服务条款。
