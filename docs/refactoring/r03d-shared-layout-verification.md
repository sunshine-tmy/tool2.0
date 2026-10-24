# R03-D：共享规范源码机械迁移

状态：DONE，仅本迁移单元完成；固定基线 `55526abc4f67d04e99ba677b335c38b43b4584bb`，保留此前未提交工作区。

## 改动范围与归属

| 目录          | 唯一规范文件                                                               |
| ------------- | -------------------------------------------------------------------------- |
| common        | api-response、api-schema、worker-protocol、tools                           |
| image         | image-options、image-ai、product-image                                     |
| speech        | edge-tts、edge-tts-batch、chatterbox                                       |
| archive       | content-archive、media-archive-link、xhs-archive、xhs-text、douyin-runtime |
| audio-library | contracts                                                                  |
| lan           | lan-file、lan-note、lan-transfer-api、lan-access                           |
| system        | component-packages、diagnostics                                            |

只迁移 22 个源码文件，以 TypeScript AST 精确定位模块字符串调整相对 import/export；测试只调整引用，未重写断言。同步现有两个 E2E 引用、桌面诊断的源码引用、旧引擎构建入口及当前 README 路径。桌面仍内联原规范，不扩大运行时依赖。

迁移前后对每个规范文件的非 import/export 顶层定义使用同一 TypeScript printer 去注释并计算 SHA-256，22/22 相同。确认 22 个旧平行文件均不存在。根导出的原顺序、旧包根及旧引擎子路径和 dist 文件名均保持。

## 验证与剩余事项

全量 coverage：core 21、shared 128、API 741、Web 385 项通过，API 6 项既有跳过保留；比上一单元仅增加 2 项 LAN DTO 断言，无测试减少。类型、Lint、Knip、架构 319 个生产/配置源码、冻结契约/夹具 4 项、格式及 diff 检查通过；固定基线差异覆盖率 183/191，95.81%。

完整生产构建、原体积预算和全部隔离构建冒烟通过；桌面 main/preload 编译、95 项单元及 7 项脚本测试通过。工程脚本 77 通过、1 项既有跳过；独立开发环境 pytest 8 项及 Python runner 5 项通过，未加载真实模型。

按 Playwright 技能复用既有 E2E，5 项全部通过（21.5 秒），覆盖健康状态、LAN 续传/删除、模拟配音批次、归档重试/取消。独立配置、runtime、models、TEMP/TMP 根为 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r03d-e2e-071225192edd463785de20ef0d096d96`；未读取项目 .env 或业务数据。初始包含递归清理的整条命令被安全策略拒绝、未执行；改为仅运行测试并保留证据目录，没有换方式删除。macOS、真实模型及安装包级验收未执行。

本单元有意保留混合职责 `system-operations.ts`：它同时定义图片压缩响应和清理契约，不能全部归入系统或全部归入图片。后续独立单元才拆分其定义、保留必要兼容导出，不在迁移时改变 Schema。

没有移动用户数据、模型、离线包、被忽略目录或已签名内容。无新 HTTP API、依赖、模型、Python 包或数据保留/删除变化；未制作桌面安装包、提交、推送或发布。
