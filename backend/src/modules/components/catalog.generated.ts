/** 中文模块说明：由 scripts/assemble-component-catalog.mjs 生成；请勿手工编辑。 */
import type { ComponentCatalog } from "./component-manager";
// prettier-ignore
export const packagedComponentCatalog = {
  "manifests": [
    {
      "protocolVersion": 1,
      "id": "ffmpeg",
      "moduleId": "ffmpeg",
      "groupId": "shared",
      "displayName": "FFmpeg（共享媒体运行时）",
      "purpose": "为视频解析和参考音色能力提供 ffmpeg、ffprobe 及其运行时 DLL。",
      "dependencyIds": [],
      "taskToolIds": [],
      "installConditions": [
        "安装使用媒体处理的能力时需要；安装后可由多个能力共享。"
      ],
      "version": "8.1.2",
      "platform": "win32-x64",
      "archive": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/ffmpeg-8.1.2.tar.gz",
        "bytes": 102795156,
        "sha256": "504dbff58072a927e22b2f54e097394406c0a0deb311ea62e5e733f89314b86a",
        "format": "tar.gz"
      },
      "installedBytes": 300000000,
      "files": [
        {
          "path": "bin/avcodec-62.dll",
          "bytes": 97454080,
          "sha256": "34f5b1baac01c4be3edf464309c79db05ffbd4a9c905c94b4a4651cd15370296"
        },
        {
          "path": "bin/avdevice-62.dll",
          "bytes": 6323200,
          "sha256": "d213d6cad9f3a526f7664ebb3f93d6882669540db7164daecd03f52e0f5288cc"
        },
        {
          "path": "bin/avfilter-11.dll",
          "bytes": 124344320,
          "sha256": "e318cac83d648869180d0b57c45f21aad1e4db34a467000c157da2938ff7f63f"
        },
        {
          "path": "bin/avformat-62.dll",
          "bytes": 20179968,
          "sha256": "c04e6ed2f9f36d42325d4f4df5babb5d6ce7c55dbffeb7ef1007e25e97bcb716"
        },
        {
          "path": "bin/avutil-60.dll",
          "bytes": 3148288,
          "sha256": "6f172b5d10224fcc3f729c8baa6fd36a97bb58042bb3b1417078d77d2da59b87"
        },
        {
          "path": "bin/ffmpeg.exe",
          "bytes": 630784,
          "sha256": "9be30133edcc5786f16e632d57e2dab5b259fea9a5243ba99758ca3adc110bd9"
        },
        {
          "path": "bin/ffprobe.exe",
          "bytes": 228864,
          "sha256": "8fd54d7fc602ec180d023a5396f9d45d1a3d6f43a4c18d3217a1f0e306885fc9"
        },
        {
          "path": "bin/swresample-6.dll",
          "bytes": 486912,
          "sha256": "72e2721672c11fd37d983b05cc2370f612784e4e3218362a0cb4315d08c917fb"
        },
        {
          "path": "bin/swscale-9.dll",
          "bytes": 12748288,
          "sha256": "3d07972cada6ba38c492e92b0f6c025a6835607fe00cdf83afc604c2fbdfe550"
        },
        {
          "path": "LICENSE.txt",
          "bytes": 35147,
          "sha256": "8ceb4b9ee5adedde47b31e975c1d90c73ad27b6b165a1dcd80c7c545eb65b903"
        },
        {
          "path": "SOURCE.json",
          "bytes": 1625,
          "sha256": "9b3a6accaad409b530bbab6de0dcf83a2fe147435cea62542903d3486e743240"
        }
      ],
      "license": {
        "name": "GPL-3.0",
        "url": "https://www.gnu.org/licenses/gpl-3.0.html"
      },
      "sbom": {
        "url": "https://github.com/sunshine-tmy/tool2.0/releases/download/components-v1/ffmpeg-8.1.2.spdx.json",
        "sha256": "8a07ce2de12b676ab658710dc982d6576c33ada53165b8983eb38a498efe8ccc"
      },
      "keyId": "ed25519-80154152cb788d65d9e6b661",
      "signature": "owYB+AWg1CkU1yI6RLoKFXK39kt+KbwKS1pf4jtUjhMGcU+6nzKbg/WVr/j547J2FMbogWEkLhj7EWwtH9byDg=="
    }
  ],
  "trustedPublicKeys": {
    "ed25519-80154152cb788d65d9e6b661": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAkkENxOAwwVlHdJPkLjqYZ1XzaY+knV55v7Po3otcktg=\n-----END PUBLIC KEY-----\n"
  }
} satisfies ComponentCatalog;
