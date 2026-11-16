# M03-04 tag01 正式签名 manifest 清单

- Release tag：`mac-ability-pack-2026-11-12-01`
- 下载基址：`https://github.com/sunshine-tmy/tool2.0/releases/download/mac-ability-pack-2026-11-12-01/`
- tag commit：`6972f58cd668fbf8b2e2f9040d4ae60d3fc8ee44`（已确认等于本机 `HEAD`）
- 签名 key ID：`ed25519-f372f170675a31f5015c6a38`
- 候选 feed：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01`
- 汇总报告：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/../reports/M03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01.json`

**本地验证：** 10/10 manifest 签名通过；10/10 SPDX 根包下载地址已改为 tag01 主归档 URL；12 个归档、10 个 SBOM 的摘要已核对；新 feed 组装器验证签名、依赖图、归档和 SBOM 摘要通过。feed 与 SBOM 中不再包含 `example.invalid`。

**2026-11-15 上传后复核：** tag01 已发布、`immutable=false`、含 32 个资产。远端 12/12 归档与本候选大小/SHA-256 一致；远端 10/10 manifest 均能通过正式公钥验签，但内容仍指向旧 `mac能力包` 下载 URL；远端 10/10 SPDX 摘要与各自 manifest 一致，但根包 `downloadLocation` 仍含 `example.invalid`。本候选的 10 个 manifest 和 10 个 SPDX 均需按[替换清单](macos-github-release-replacement-list-tag01.md)上传到 tag01。替换完成后再核对 32 项摘要并执行 tag01 URL 在线安装。

**2026-11-15 替换及安装复核：** 用户已完成元数据替换。GitHub API 显示 32/32 资产的远端大小/SHA-256 与本地候选完全一致；实际下载的 10/10 manifest 均由正式公钥验签通过、archive 和 SBOM URL 均绑定 tag01；10/10 SPDX 文件字节摘要匹配清单声明，根包下载位置不含占位域名。生产 ComponentManager 已从 tag01 完成十项在线安装、自检，最终均为 `installed=true / health=healthy`。安装报告：`.package/macos-validation/20261109T085328Z-e00daf0c/reports/M03-04-online-install-current-release-tag01-attempt4-20261115/report.json`。

候选目录中的 `trusted-keys/ed25519-f372f170675a31f5015c6a38.pem` 是应用信任公钥，不是 Release 资产；生成的 catalog 也应嵌入应用源码，不上传为 Release 资产。完整 32 项路径见 [tag01 上传清单](macos-github-release-upload-list-mac-ability-pack-2026-11-12-01.md)。

## Manifest 文件

### chatterbox (1.0.0-py312-mps1-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/chatterbox/1.0.0-py312-mps1-darwin-arm64.1/chatterbox-1.0.0-py312-mps1-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：40437 bytes
- SHA-256：`d18fccf2fc66b14f95085cb5b842a593e99af40e42d30fd574702f00472b02a5`
- 签名有效：`True`

### douyin-archive (1.0.0-anonymous-27468de-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/douyin-archive/1.0.0-anonymous-27468de-darwin-arm64.1/douyin-archive-1.0.0-anonymous-27468de-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：1787 bytes
- SHA-256：`71a7dd7d76a568fbe26eb99f4c82b6c0bb6b60033479b2e5b2a58dc381b95fee`
- 签名有效：`True`

### edge-tts (7.3.1-py312-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/edge-tts/7.3.1-py312-darwin-arm64.1/edge-tts-7.3.1-py312-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：4439 bytes
- SHA-256：`8134f902458f891ee293ad35a123c7243a4e7bfbbb0ee06a104557358ba31d9c`
- 签名有效：`True`

### ffmpeg (8.1.2-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/ffmpeg/8.1.2-darwin-arm64.1/ffmpeg-8.1.2-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：3769 bytes
- SHA-256：`ea3001db64199377928365f51193167d76299ec6a9161e38725deaa9162a30f2`
- 签名有效：`True`

### image-ai (1.0.0-py312-cpu1-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/image-ai/1.0.0-py312-cpu1-darwin-arm64.1/image-ai-1.0.0-py312-cpu1-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：28738 bytes
- SHA-256：`c45010921dc062eef014a8e5d35bd569c00b29570100ba4e2e3226c559001a37`
- 签名有效：`True`

### python-312 (3.12.14-20260924-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/python-312/3.12.14-20260924-darwin-arm64.1/python-312-3.12.14-20260924-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：411703 bytes
- SHA-256：`cec3199b30e1c3b50f65bb4635b484f2bab582d9a069f27c96beadb0d94c5a59`
- 签名有效：`True`

### video-ai (1.1.0-py312-mps1-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/video-ai/1.1.0-py312-mps1-darwin-arm64.1/video-ai-1.1.0-py312-mps1-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：27643 bytes
- SHA-256：`5adaaeb3b5e16801cfba6ba6e8de30ccd5ca582d797c4192ba3b8698b16bb652`
- 签名有效：`True`

### xhs-archive (2.7-afaf2fb-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/xhs-archive/2.7-afaf2fb-darwin-arm64.1/xhs-archive-2.7-afaf2fb-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：28307 bytes
- SHA-256：`e75143cab8c2f811eb4bc4d9fe66113d541f81921dfd983a21bc4dc32c9c2480`
- 签名有效：`True`

### xhs-browser (1.63.0-chromium-1243-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/xhs-browser/1.63.0-chromium-1243-darwin-arm64.1/xhs-browser-1.63.0-chromium-1243-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：104190 bytes
- SHA-256：`3d8f16e67fa68a8471eb89242e90f841dc94f6fae44635c7e34bcd648a68288f`
- 签名有效：`True`

### xhs-translation (1.0.0-ct2-cf109095-darwin-arm64.1)

- 路径：`.package/macos-validation/20261109T085328Z-e00daf0c/m03-04-formal-github-release-feed-mac-ability-pack-2026-11-12-01/xhs-translation/1.0.0-ct2-cf109095-darwin-arm64.1/xhs-translation-1.0.0-ct2-cf109095-darwin-arm64.1-darwin-arm64.manifest.json`
- 大小：6809 bytes
- SHA-256：`39c4b84e3daa77c9c122a1769291f609c15b437ec0ace8a1561032ed9276ea9f`
- 签名有效：`True`
