# ADR 005：干净 Windows 虚机安装验收

## 状态

已接受。

## 决策

面向用户的 Windows tag 发布必须在签名打包之后、GitHub Release 发布之前，额外通过 `clean-vm-acceptance` job。该 job 运行于新的 `windows-latest` runner，不能复用打包 job 的目录、安装状态或用户数据。

验收从签名 job 上传的产物开始，而不是从源码输出目录开始，按以下顺序执行：

1. 校验每个发布资产的 SHA-256、`latest.yml` 的安装器 SHA-512 条目、安装器 Authenticode Subject。
2. 创建 `%LOCALAPPDATA%\\EcommerceToolboxData` 用户数据哨兵，然后用 `/S /D=<临时安装目录>` 静默执行 `EcommerceToolboxSetup.exe`。
3. 验证该 NSIS 指定安装目录包含预期版本的应用和卸载器，并再次验证安装目录中所有 `.exe` 的签名。
4. 启动已安装的 `EcommerceToolbox.exe`；通过 Chromium remote-debugging 仅观察其窗口实际加载的 `127.0.0.1` 后端，并请求 `/health/ready` 与 `/api/v1/health`。
5. 调用 NSIS 卸载器的 `/S` 模式，确认安装根已删除、数据哨兵仍存在且字节不变。

`EcommerceToolboxData` 是唯一桌面可写根；它必须与用户选择的 NSIS 安装根分离。这样安装、升级和卸载操作没有理由访问 SQLite、媒体、模型、能力包或迁移备份。

## 后果

- Windows tag release 的发布 job 依赖该 job；没有干净安装、真实启动和卸载数据保留证据，就不会创建/更新 GitHub Release。
- 该验收使用签名产物，因此仍依赖受控证书 secret、密码和 Subject；缺失时在打包阶段失败。
- 自动更新的“下载并替换”还需要一个已经存在的上游发布版本和真实更新 feed，首次版本没有前序版本可升级。其协议、签名和 `latest.yml` 完整性由阶段 8 单元测试和发布验证覆盖；首个正式发布后，后续版本必须在该干净 VM job 外加执行一次从上一稳定版升级到当前版的人工发布演练，并保留其报告。
