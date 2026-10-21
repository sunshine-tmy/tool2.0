# 新电脑启动资源放置区

首次双击 `start.bat` 前，按 [下载清单](../docs/source-resources.md) 准备当前版本的资源。无需旧项目、私钥或个人登录态。

- `components/`：必备的 11 个 CPU 能力归档；保持文件名，不解压。模型、Python、FFmpeg、Chromium 及 Python 离线依赖均已包含。默认不下载这些大文件，缺少时一次列出后停止。
- `bootstrap/`：可选的 Node/pnpm 固定版本压缩包；有符合要求的系统 Node 或已校验缓存时复用，否则优先使用本目录，再尝试固定来源下载。

支持将完整备份按 `components/能力ID/版本/文件名` 原样放置，不必改成平铺。**11 个包只覆盖 CPU 基线，不包含 GPU 扩展。** NVIDIA 参考音色克隆另需下载清单中的 4 个 `chatterbox-cuda` 归档（共 15 个），放到同一个 `components/` 目录后，双击根目录 `start-gpu.bat`，等价于 `start.bat -WithCuda`。只复制 GPU 包但仍双击 `start.bat` 不会安装 GPU 扩展；普通虚拟机继续使用默认 CPU 模式。

从 CPU 切换到 GPU 前先正常运行 `stop.bat` 停止已有服务，再使用 GPU 入口。已有正常 CPU 能力与模型会复用，不重新安装或下载；不会修改驱动。GPU 是否可用还取决于兼容的 NVIDIA 显卡和驱动。

也可以运行 `start.bat -ListResources` 查看 CPU 清单，或 `start-gpu.bat -ListResources` 查看含 GPU 的完整清单，不需要 Node，不会下载安装。压缩包受 Git 忽略，不要取消忽略后上传到源码仓库。

`node_modules` 由启动器按锁文件安装，可能联网；本目录不让在线自然配音、平台归档等业务离线可用。详细流程见根目录 README。
