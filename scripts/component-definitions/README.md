# Windows 能力包准备与发布

AI 图片 CPU 包通过命令 pnpm components:prepare-image-ai -- --python .package/stage/python-311/python/python.exe --stage .package/stage/image-ai 准备。脚本使用哈希锁定的 CPU wheelhouse、固定 Hugging Face 模型提交和 SHA-256 固定权重，并将 worker、Real-ESRGAN、Big-LaMa、BiRefNet 与 PP-OCRv5 中文模型打入一个可离线自检的能力包。已缓存的上游模型文件可放在默认 .package/image-ai-source-assets 目录；每个文件都会在进入暂存目录前重新校验 SHA-256。准备后以 scripts/component-definitions/image-ai.json 生成签名产物，完成 Release 上传和核验前不会登记到嵌入式能力目录。

共享 Python 运行时固定使用 Astral `python-build-standalone` 的 `20260901` Windows x64 `install_only_stripped` 资产。准备脚本会校验资产长度和 SHA-256，再验证 `python.exe`、`venv`、`ensurepip`、SSL 与 SQLite；不要把本机 `.venv` 复制进能力包。

| 能力        | 固定版本           |         下载大小 | SHA-256                                                            |
| ----------- | ------------------ | ---------------: | ------------------------------------------------------------------ |
| Python 3.11 | `3.11.16-20260901` | 25,189,257 bytes | `06cbe479e039f5b9cb5640c286d790074d63f549f92a32d599a3748293bd4510` |

官方上游资产：[python-build-standalone 20260901](https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz)。

准备阶段产物都放在被 Git 忽略的 `.package` 下：

```powershell
node scripts/prepare-python-311-runtime.mjs `
  --archive .package/python-311-upstream-stripped.tar.gz `
  --stage .package/stage/python-311

node scripts/prepare-edge-tts-component.mjs `
  --python .package/stage/python-311/python/python.exe `
  --stage .package/stage/edge-tts
```

两个准备脚本只生成暂存目录；Python wheelhouse 由 `scripts/edge-tts.lock.txt` 的哈希约束并仅允许 Windows wheel。签名私钥必须保存在受保护目录，不能放入暂存目录、Release 资产或 Git。

用 `scripts/component-definitions/python-311.json` 和 `edge-tts.json` 分别调用 `scripts/build-component-package.mjs`，输出目录都指定为 `.package/component-feed`，Release 地址固定为 `https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/`。每个版本需要上传其目录中的 `.manifest.json`、`.spdx.json` 与 `.tar.gz` 三个文件到 `components-v1` Release；不得上传私钥。文件全部上传后，再运行：

```powershell
node scripts/assemble-component-catalog.mjs --feed .package/component-feed
```

该步骤会核验本地归档、SBOM、公钥 ID 和 Ed25519 签名，并更新后端嵌入式能力目录。合并目录变更前，先确认 GitHub Release 中存在清单引用的同名资产。
