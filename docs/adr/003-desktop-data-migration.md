# ADR-003：桌面设置与用户数据迁移

状态：已接受（阶段 7 实现）

## 决策

桌面应用的所有可写内容必须位于 `%LOCALAPPDATA%\\EcommerceToolboxData`（或 Electron 提供的等价当前用户目录）内。该目录独立于用户在 NSIS 安装向导中选择的安装根，安装、升级和卸载均不可操作用户数据：

| 用途                   | 目录                         |
| ---------------------- | ---------------------------- |
| 桌面偏好和迁移日志     | `config/`                    |
| SQLite、媒体和任务产物 | `data/`                      |
| 可选能力包             | `components/`                |
| 模型                   | `models/`                    |
| 完整数据迁移备份       | `migration-backups/desktop/` |

`resources/`、安装目录和 `app.asar` 只读。迁移器不在这些位置创建临时目录、备份或配置文件；它们只提供后端、前端和脚本资源。

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

## 实现位置与验收

- `apps/desktop/src/desktop-settings.ts`：原子设置读写和严格 JSON 校验。
- `apps/desktop/src/desktop-data-migration.ts`：清单、哈希、日志、导入、恢复和回滚。
- `apps/desktop/src/main.ts`：受信任窗口 IPC、一次性目录令牌、停服/重启编排。
- `frontend/src/pages/DesktopSettingsPage.vue`：设置、导入确认和回滚入口。

阶段 7 的自动化验收至少覆盖：默认设置不落盘、设置原子保存、无效设置拒绝、导入后旧目录不变、导入前数据有备份、回滚保留当前副本、目录重叠拒绝，以及中途终止时的恢复逻辑。
