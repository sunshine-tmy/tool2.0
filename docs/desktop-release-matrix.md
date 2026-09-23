# 桌面发行范围与验收矩阵

本文是 Windows 桌面化的阶段验收基线。后续实施不得把下表中的“外部依赖”描述为已离线打包能力。

| 功能                | 核心安装器可用 | 可选能力包                   | 外部依赖                 | 发行前特别检查                    |
| ------------------- | -------------- | ---------------------------- | ------------------------ | --------------------------------- |
| 图片压缩            | 是             | 无                           | 无                       | Sharp Electron ABI、图片回归      |
| 局域网文件传输      | 是             | 无                           | 用户主动开放防火墙       | LAN PIN、端口和手机访问           |
| 短视频解析          | 是             | 无                           | 第三方解析服务、目标平台 | 隐私提示、超时与降级              |
| Edge-TTS            | 否             | edge-tts                     | Microsoft 在线语音服务   | 网络失败和隐私提示                |
| 视频文本解析        | 否             | ffmpeg、faster-whisper、模型 | 首次下载；CUDA 可选      | CPU/CUDA、模型和磁盘配额          |
| AI 图片处理         | 否             | image-ai、模型               | 首次下载；CUDA 可选      | 模型许可、CPU/CUDA 和 Worker 鉴权 |
| Chatterbox 声音克隆 | 否             | chatterbox、模型、ffmpeg     | 首次下载；CUDA 推荐      | 授权声明、显存释放和音频回归      |
| 小红书内容归档      | 否             | XHS runtime、浏览器          | 小红书、首次下载         | GPL、登录态保护和平台条款         |
| 小红书翻译          | 否             | translation runtime、模型    | 首次下载或离线导入       | 模型摘要与回滚                    |

## 分阶段提交顺序

1. `desktop/01-runtime-layout`
2. `desktop/02-static-production-server`
3. `desktop/03-electron-shell`
4. `desktop/04-native-module-packaging`
5. `desktop/05-component-manager`
6. `desktop/06-worker-integration`
7. `desktop/07-settings-and-migration`
8. `desktop/08-signing-updater-ci`
9. `desktop/09-clean-vm-acceptance`

## 每阶段统一验收

- 不修改或删除既有用户数据。
- 现有 Web 开发启动方式仍然可用。
- 新增行为有最小化自动化测试。
- 运行相关单元测试、类型检查、lint 和生产构建。
- 在提交说明中记录验证命令、结果和未解决的外部阻断项。

## 发布阻断项

- 未经有效证书签名的面向终端用户 Windows 安装器。
- 未经确认的第三方许可证和模型再分发条件。
- 未在干净 Windows 环境验证的真实安装产物。
- 应用升级、卸载或能力包更新可能删除用户数据。

阶段 9 的满足条件是：发布工作流在独立的 `windows-latest` 虚机中对签名产物完成校验、安装、启动和健康检查、卸载，并证明 `%LOCALAPPDATA%\\EcommerceToolboxData` 中预先存在的数据未被修改。该 job 是 GitHub Release 的依赖，而不是发布后的可选检查。
