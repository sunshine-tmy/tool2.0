# ADR 005：干净 Windows 虚机安装验收

## 状态

已接受。

## 决策

面向用户的 Windows tag 发布必须在签名打包之后、GitHub Release 发布之前，额外通过 `clean-vm-acceptance` job。该 job 运行于新的 `windows-latest` runner，不能复用打包 job 的目录、安装状态或用户数据。

验收从签名 job 上传的产物开始，而不是从源码输出目录开始，按以下顺序执行：

1. 校验每个发布资产的 SHA-256、`latest.yml` 的安装器 SHA-512 条目、安装器 Authenticode Subject。
2. 确认虚机不存在旧版 `%LOCALAPPDATA%\\EcommerceToolboxData`；该旧路径只由独立的未签名迁移验收流程创建哨兵。验收安装根位于 runner 临时目录且包含空格，用于检查 `/D=<最终目录>` 的参数处理。
3. 有更早的稳定语义版本 Release 同时包含桌面安装器和 SHA-256 sidecar 时，下载该旧安装器并核对摘要和 Authenticode Subject，再先安装旧版、写入数据哨兵并用当前签名安装器覆盖升级。没有前版安装器资产时只跳过这项升级场景，不跳过其他验收。
4. 验证最终安装目录包含当前预期版本的应用和卸载器，并再次验证安装目录中所有 `.exe` 的签名。启动已安装的 `EcommerceToolbox.exe`；通过 Chromium remote-debugging 仅观察其窗口实际加载的 `127.0.0.1` 后端，并请求 `/health/ready` 与 `/api/v1/health`。
5. 在实际桌面窗口所连接的回环后端中，使用固定目录 ID 安装签名 `python-311` 与小型 `edge-tts` 能力，等待作业完成并验证两项都为 `ready/healthy`，同时检查能力 generation 写在安装根 `data/components/packages/` 内；卸载两项能力后确认其运行时目录消失、数据哨兵字节不变。
6. 确认静默卸载只移除程序文件并保留 `data/` 哨兵；用同一安装器重装，验证哨兵字节仍相同且应用再次健康启动。
7. 在另一次交互卸载中，由验收器仅针对测试卸载进程、仅在两个中文数据删除确认对话框都匹配时点击“是”；随后确认应用数据根和程序文件已移除。未识别的对话框不会被确认，超时会令验收失败。

打包版完整数据根必须是 `dirname(EcommerceToolbox.exe)\\data`，且被测最终安装根应由安装向导明确展示。安装根不可写或与旧数据根重叠时必须拒绝启动，不得通过提权放宽目录权限。验收器仅对其新建的临时安装根运行卸载，不会按进程名结束用户的桌面应用；默认静默卸载与升级必须保留所有哨兵数据。

PR 和手动测试使用独立的 `desktop-install-acceptance.yml`：它在全新 `windows-latest` runner 上创建一份旧版数据哨兵，构建未签名测试安装包，通过 Electron DevTools 在首次启动迁移页实际选择“迁移”，检查安装目录副本与旧源均完整，再验收默认卸载与重装保留安装目录数据；不发布 Release，也不需要签名密钥。该流程验证安装与旧数据迁移生命周期，不替代 tag Release 流程中的 Authenticode、签名能力包、前版升级和显式删除验收。

## 后果

- Windows tag release 的发布 job 显式要求 `package` 和 `clean-vm-acceptance` 均成功；验收失败或被跳过时，Release job 不会创建或更新 GitHub Release。
- 该验收使用签名产物，因此仍依赖受控证书 secret、密码和 Subject；缺失时在打包阶段失败。
- 工作流会上传干净虚机验收报告作为单独的 CI artifact，不将上一稳定版测试安装器混入 GitHub Release 发布资产。
- 安装器升级生命周期在存在前版安装器资产时纳入自动验收；`electron-updater` 对公开更新 feed 的联网下载/重启仍由 `latest.yml`、SHA-512 和签名产物校验覆盖，若要发布新的更新渠道，应另行进行实际更新源演练。
