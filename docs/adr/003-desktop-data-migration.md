# ADR-003：桌面设置与用户数据迁移

状态：阶段 2 实现已完成；等待干净 Windows 虚机验收后接受

## 决策

Windows 打包版应用管理的持久内容位于用户在 NSIS 安装向导中选择的最终安装根之 `data/` 子目录。普通用户必须可以写入最终安装根；不支持以管理员提权方式将程序目录设为可写。Web/开发模式继续使用既有 `%LOCALAPPDATA%\\EcommerceToolboxData` 数据根。桌面版布局为：

| 用途                          | 目录                         |
| ----------------------------- | ---------------------------- |
| 桌面偏好和桌面数据迁移记录    | `config/`                    |
| SQLite、媒体和任务产物        | `data/`                      |
| 可选能力包及依赖              | `components/`                |
| 模型                          | `models/`                    |
| Chromium 登录状态与浏览器数据 | `profile/`                   |
| 应用日志                      | `logs/`                      |
| 临时文件                      | `temp/`                      |
| 完整数据迁移备份              | `migration-backups/desktop/` |
| Electron 内部配置与单实例锁   | `.runtime/`                  |

Electron 的 `userData`、`sessionData`、logs、crashDumps 和 temp 在主进程早期分别设到 `data/` 下。NSIS 卸载器只删除构建时生成的程序文件白名单，绝不递归删除安装根；默认卸载、升级和静默卸载保留 `data/`。仅交互卸载中用户连续两次确认，才会删除安装根内 `data/` 与已知旧版 `%LOCALAPPDATA%\\EcommerceToolboxData`。

安装向导展示最终安装目录，并在安装前进行普通用户写入探测；不可写时要求用户返回选择其他路径。应用若从旧的受保护安装目录启动且写入探测失败，会提示重新运行安装程序，不尝试改 ACL 或自动更新。

首次启动发现 `%LOCALAPPDATA%\\EcommerceToolboxData` 含旧版内容时，会先展示来源、目标、文件数、预估字节数和目标盘可用空间；业务界面保持关闭，用户必须选择完整迁移或以空数据启动。迁移覆盖 `config/`、`data/`、`components/`、`models/`、`profile/`、必要日志和迁移备份。每个文件复制时核对 SHA-256，同盘暂存与备份、持久化状态日志和启动恢复支持中断回滚。源目录始终保留，空数据选择也只写明示状态，不删除旧目录。

桌面设置由 Electron 主进程通过 context-isolated preload API 提供，而不是增加 HTTP 设置接口。渲染器只能读取或修改两个白名单布尔值：`startAtLogin` 与 `automaticUpdateChecks`。设置文件 `config/desktop-settings.json` 使用写入临时文件、fsync、rename 的方式原子落盘。

## 旧数据导入协议

1. 用户通过原生目录选择器选择旧版 `storage` 目录。主进程保存十分钟一次性令牌；渲染器不会获得或提交任意绝对路径。
2. 主进程暂停本地 API，防止 SQLite、媒体或任务文件仍被打开。
3. 迁移器只接受含已知工具数据标志的目录，拒绝当前用户数据目录重叠、符号链接、特殊文件和路径穿越。
4. 旧目录被复制到用户目录内的 `.data-import-<id>`；每个文件都比较大小和 SHA-256，并在完成后重新扫描清单。
5. 旧的 `data/` 整体移动至 `migration-backups/desktop/<id>/previous-data/`；临时目录随后原子改名为新的 `data/`。
6. `config/desktop-migrations/<id>.json` 在每一个切换点记录状态。启动前会恢复任何 `staging-ready`、`previous-backed-up` 或回滚中断状态，优先恢复旧数据，不会启用半成品目录。
7. 新 API 重新启动后才重新加载渲染器。

迁移清单保存旧数据和导入数据的逐文件大小、SHA-256、总文件数和总字节数。源目录始终仅读，不会被改名、删除或改写。

## 回滚协议

回滚先校验 `previous-data` 与迁移清单。当前 `data/` 会先移动到同一备份目录中的 `rollback-current-data/`，然后才恢复 `previous-data`。如果恢复或校验失败，失败数据保留为 `failed-rollback-data/`，并恢复回滚前数据。摘要不一致时直接拒绝回滚，不写入任何数据目录。

## 既有 storage 导入与首次启动迁移的边界

完整数据根迁移在首次启动时自动发现固定旧路径，不接收 renderer 提交的路径；已存在设置页里的“导入旧版 storage”则仍是独立、用户主动选择的业务数据导入，仅替换 SQLite/素材数据并保留导入前备份。两者不能混为一个迁移状态或相互删除源目录。

## 实现位置与验收

- `apps/desktop/src/desktop-settings.ts`：原子设置读写和严格 JSON 校验。
- `apps/desktop/src/desktop-data-migration.ts`：清单、哈希、日志、导入、恢复和回滚。
- `apps/desktop/src/desktop-root-migration.ts`：旧数据根扫描、空间预检、SHA-256 复制、原子切换日志和恢复。
- `apps/desktop/src/main.ts`：受信任窗口 IPC、一次性目录令牌、停服/重启编排。
- `frontend/src/pages/DesktopSettingsPage.vue`：设置、导入确认和回滚入口。
- `apps/desktop/installer-custom.nsh` 与 `apps/desktop/scripts/package-desktop.mjs`：最终安装路径写入测试、显式双重删除确认、基于打包清单的程序文件白名单卸载。

自动化验收覆盖：桌面数据根布局、无旧数据首次启动、完整迁移、登录 profile 复制、源目录保留、覆盖前目标保护副本、异常路径拒绝、切换中断回滚、已提交迁移收尾、显式空数据选择；并通过真实 NSIS 编译验证写入页及白名单宏。PR/手动 Windows 安装验收流程另在干净 runner 上验证安装、启动、健康检查和静默卸载保留哨兵，不验证签名且不发布 Release。阶段 2 的最终接受还须验收交互卸载双重确认删除、旧版数据迁移和完整发布签名链；完成前不得进入阶段 3。
