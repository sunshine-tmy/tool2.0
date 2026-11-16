# Apple Silicon 内部构建就绪清单（2026-11-12）

状态（更新至 2026-11-16）：构建配置、workspace 构建、原生模块重建、staging 检查和 Electron 44.4.3 ABI smoke 均已通过；真实 DMG 尚未制作。用户 Windows 备份已隔离导入并抽样再编辑，但历史 CUDA 视频任务为 0，M08-02 仍部分完成。M03-04 已使用用户指定的 `mac-ability-pack-2026-11-12-01` tag01 完成正式资产核验和十项在线安装自检。

## 构建配置

- 输出：`apps/desktop/out/mac-arm64/电商工具箱-mac-arm64.dmg`。
- 界面名称：`电商工具箱`；Electron bundle 与英文内部可执行名维持 `EcommerceToolbox`。
- 目标：Apple Silicon `arm64`，最低 macOS 14.0；只构建 DMG。
- 签名：ad-hoc（`identity: "-"`），不启用 Hardened Runtime、公证或自动更新。
- Mac 配置会移除 Windows NSIS、证书和发布字段；`DESKTOP_RELEASE=1` 在 Mac 上明确拒绝，不读取 Windows 证书。
- 手动 GitHub Actions 工作流在构建前执行 `uname -m = arm64` 检查，不依赖 runner 标签推断架构；工作流仅 `workflow_dispatch`，不会恢复 push/PR 自动检查。
- 版本快照（2026-11-12）：桌面版本为 `1.0.9`，普通 `pnpm desktop:make` 当时预计升至 `1.0.10`。

## 开始打包前必须核对

1. M08-02 已将用户提供的 Windows 导出包导入独立 Mac 数据根，完成完整性检查和样本再编辑；包中无历史 CUDA 视频任务，因此该项仍部分完成，不能把缺失样本写成已验。
2. M03-04 已完成：用户指定的 `mac-ability-pack-2026-11-12-01` tag01 正式资产大小/摘要/签名核验及十项在线安装自检均通过。Release 可变性已按用户要求豁免，无需再次替换 manifest。
3. **已完成（2026-11-14）**：workspace 类型检查、Mac 原生 `better-sqlite3`/`sharp` 重建、资源目录检查、实际 ad-hoc 签名检查和 Electron ABI 下 SQLite/Sharp 功能 smoke。详情见 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B02-stage-verification-20261114.json` 与 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M09-B02-electron-runtime-validation-20261114.json`。
4. 最新 checkout 为 `413fa1c5759e76dd8d94b05d1ac8b326d7fbedc9`，桌面版本为 `1.0.11`；普通 `pnpm desktop:make` 默认递增到 `1.0.12`（由 `tooling/build/desktop-version.mjs` 的 patch 默认值确认）。当前 `apps/desktop/out` 只有 680 MiB、版本 `1.0.9` 的旧目录 `.app`；它不代表最新源码。打包前还须检查源码提交、版本、目标输出和磁盘空间。
5. 只有在用户明确授权一次 `pnpm desktop:make` 后才制作 DMG；制作后记录应用版本、源码提交、能力目录摘要和 DMG SHA-256，再按 M09-B03 做干净环境安装验收。此前已明确不自动制作安装包，当前未运行 `desktop:make`。

## 磁盘空间估算

正式 Mac 目录目前声明的 12 个离线归档合计 **6,133,503,214 字节（约 5.71 GiB）**；签名清单声明的十项安装体积合计 **19,780,004,096 字节（约 18.42 GiB）**。若同时保留全部源归档和完整安装 generation，基线占用约 **24.14 GiB**，还需为安装 staging、workspace 构建缓存和 DMG 预留额外空间；该合计不是峰值上限。M03-03 的真实测试目录曾测得约 5.7 GiB 归档和 12 GiB 独立安装根，但它不覆盖本轮的完整正式 feed 峰值。

2026-11-12 本机快照：可用空间 139 GiB；workspace `node_modules` 约 521 MiB；当时没有 `apps/desktop/.stage` 或 `apps/desktop/out` 构建产物。DMG 本身大小及实际构建峰值尚未测量。构建前仍需重新检查可用空间。

2026-11-16 当前状态：磁盘可用约 110 GiB；`apps/desktop/.stage` 存在，`apps/desktop/out` 有 680 MiB 的旧 1.0.9 目录 `.app`。源码已快进到 `413fa1c` / 版本 1.0.11；旧 `.app` 未在这次源码更新后重建。DMG 输出大小和完整构建峰值仍未实测。

## 当前外部前置

截至 2026-11-16，GitHub Release tag01 的 32 项正式资产、10 个 manifest 与 10 个 SPDX SBOM 已完成远端大小/SHA-256 核验；签名 catalog 已从该 tag 完成十项生产在线安装和健康自检。用户已豁免 Release 不可变要求。权威记录见执行台账 M03-04 与 `.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-online-install-current-release-tag01-attempt4-20261115/report.json`。
