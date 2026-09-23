# ADR-004：Windows 签名、NSIS 更新源与发布 CI

状态：已接受（阶段 8 实现）

## 决策

Windows 桌面安装版使用 Electron Packager 与 Electron Builder 的 NSIS 目标。安装器为辅助安装模式，必须显示安装目录选择页。每个正式版本必须由 `v<major>.<minor>.<patch>` tag 触发，并由 Windows GitHub Actions runner 构建；不能通过手工工作流或未签名本地构建发布给终端用户。

release 模式强制要求以下构建输入：

| 输入                                   | 来源                                         | 用途                                   |
| -------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `WINDOWS_SIGNING_CERTIFICATE_BASE64`   | GitHub Actions secret                        | PFX 的 base64 内容                     |
| `WINDOWS_SIGNING_CERTIFICATE_PASSWORD` | GitHub Actions secret                        | PFX 解密口令                           |
| `WINDOWS_SIGNING_SUBJECT`              | GitHub Actions repository variable           | Authenticode 证书 Subject 的精确预期值 |
| tag 版本                               | `GITHUB_REF_NAME`                            | 安装器和应用版本                       |
| 更新源                                 | 当前仓库 GitHub Release 的 `latest/download` | `electron-updater` generic 静态目录    |

任一项缺失、tag 不是稳定三段语义版本、更新源不是无凭据 HTTPS URL，构建都会在打包前失败。

## 工件与更新协议

release 构建把版本与受控 generic 更新源写入安装包资源目录的 `app-update.yml`；开发构建不会带更新源。NSIS 输出以下工件并上传到同一个 GitHub Release：

- `EcommerceToolboxSetup.exe`：面向用户的安装器。
- `EcommerceToolboxSetup.exe.blockmap`：增量下载用块映射。
- `latest.yml`：稳定版本、安装器文件名、大小与 SHA-512 清单，`electron-updater` 下载前必须校验。
- 上述每个文件的 SHA-256 文件，供发布前/发布后人工与 CI 校验。

桌面进程只在满足以下全部条件时调用 `electron-updater`：已打包、Windows、资源目录包含由发布构建生成的合法 HTTPS generic `app-update.yml`。下载完成后用户选择是否立即重启；立即安装前先停止本地后端，并由 NSIS 更新安装器完成替换。

## 验证与发布保护

CI 必须验证：

1. `latest.yml` 指向唯一的 `EcommerceToolboxSetup.exe`，且其中的 SHA-512 与安装器字节完全匹配。
2. 安装器和 NSIS 解包后的安装目录内所有 `.exe` 均有 `Valid` Authenticode 签名，签发 Subject 与受控变量精确相同。
3. 所有上传工件的 SHA-256 再次在 Linux release job 中校验后，才创建或更新 GitHub Release。

本阶段实现了阻断机制，不提供证书本身。配置真实 PFX secret、证书 Subject 和受控 tag 发布权限仍是发布前外部条件；缺失时 CI 必须失败，不能生成“未签名但可下载”的桌面 Release。
