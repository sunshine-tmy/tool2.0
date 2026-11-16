# GitHub Release 当前待替换资产

当前正式目标是用户已有的可变 Release：[mac能力包](https://github.com/sunshine-tmy/tool2.0/releases/tag/mac%E8%83%BD%E5%8A%9B%E5%8C%85)。GitHub API 最近核对其 32 个资产：12 个归档和 10 个 SPDX SBOM 均与正式候选完全匹配；只需将 10 个旧测试签名 manifest 替换成正式签名版本。

请按[10 项正式 Manifest 替换清单](macos-github-release-manifest-replacement-list.md)删除同名旧文件并上传候选文件。不要重新上传 12 个归档或 10 个 SBOM。上传后我会核验远端摘要并完成在线安装复验。

tag `mac-ability-pack-2026-11-12-01` 是此前为不可变发布要求创建的空 Release；用户已确认不强制不可变，因此当前不需要上传到该 tag。
