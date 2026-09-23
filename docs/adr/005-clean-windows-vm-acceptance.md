# ADR 005：干净 Windows 虚机安装验收

## 状态

已接受。

## 决策

面向用户的 Windows tag 发布必须在签名打包之后、GitHub Release 发布之前，额外通过 `clean-vm-acceptance` job。该 job 运行于新的 `windows-latest` runner，不能复用打包 job 的目录、安装状态或用户数据。

验收从签名 job 上传的产物开始，而不是从源码输出目录开始，按以下顺序执行：

1. 校验每个发布资产的 SHA-256、`latest.yml` 的安装器 SHA-512 条目、安装器 Authenticode Subject。
2. 确认虚机不存在旧版 `%LOCALAPPDATA%\\EcommerceToolboxData`，然后用 `/S /D=<无空格的最终测试安装目录>` 静默执行 `EcommerceToolboxSetup.exe`；静默模式下 `/D` 指定最终目录，不会再追加产品目录。交互安装则由自定义目录确认页显示最终路径并追加产品目录。NSIS 的 [`/D` 参数规则](https://nsis.sourceforge.io/Docs/Chapter3.html#3.2)要求它是命令行最后一个参数且不带引号，即使路径含空格也如此。
3. 验证该 NSIS 指定安装目录包含预期版本的应用和卸载器，并再次验证安装目录中所有 `.exe` 的签名。
4. 启动已安装的 `EcommerceToolbox.exe`；通过 Chromium remote-debugging 仅观察其窗口实际加载的 `127.0.0.1` 后端，并请求 `/health/ready` 与 `/api/v1/health`。
5. 在安装根的 `data/` 写入用户数据哨兵，调用 NSIS 卸载器的 `/S` 模式，确认程序文件已移除、安装根因 `data/` 保留，并验证哨兵字节不变。

打包版完整数据根必须是 `dirname(EcommerceToolbox.exe)\\data`，且被测最终安装根应由安装向导明确展示。安装根不可写或与旧数据根重叠时必须拒绝启动，不得通过提权放宽目录权限。当前自动化脚本覆盖静默卸载保留；交互卸载删除数据的双重确认另做 UI 验收，静默和升级路径不得删除任何数据。

PR 和手动测试使用独立的 `desktop-install-acceptance.yml`：它在全新 `windows-latest` runner 上创建一份旧版数据哨兵，构建未签名测试安装包，通过 Electron DevTools 在首次启动迁移页实际选择“迁移”，检查安装目录副本与旧源均完整，再执行静默卸载并检查安装目录数据保留；不发布 Release，也不需要签名密钥。该流程验证安装和旧数据迁移生命周期，不替代 tag Release 流程中的 Authenticode 与资产校验；Release 工作流仍必须先通过签名虚机验收才可发布。

## 后果

- Windows tag release 的发布 job 依赖该 job；没有干净安装、真实启动和卸载数据保留证据，就不会创建/更新 GitHub Release。
- 该验收使用签名产物，因此仍依赖受控证书 secret、密码和 Subject；缺失时在打包阶段失败。
- 自动更新的“下载并替换”还需要一个已经存在的上游发布版本和真实更新 feed，首次版本没有前序版本可升级。其协议、签名和 `latest.yml` 完整性由阶段 8 单元测试和发布验证覆盖；首个正式发布后，后续版本必须在该干净 VM job 外加执行一次从上一稳定版升级到当前版的人工发布演练，并保留其报告。
