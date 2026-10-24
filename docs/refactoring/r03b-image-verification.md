# R03-B1：图片领域共享契约入口

任务编号：R03-B1。状态：DONE，仅图片领域入口这一原子任务完成。R03-B 及 R03 整阶段仍未完成。
固定基线：`55526abc4f67d04e99ba677b335c38b43b4584bb`。

## 本次完成与改动范围

- 开始重新核对工作区，真实 Git 索引为空；保留此前 R00–R03-A 和 B06 的全部未提交修改。
- 新增 `packages/shared/src/image/index.ts`，仅转导出既有图片压缩参数、AI 图片和商品图契约。新增 `@toolbox/shared/image` 包导出及声明/ESM 构建入口。
- 原 `index.ts` 根导出及 image-options/image-ai/product-image 文件保持原样，不复制 Schema、不派生第二套 DTO、不扩大公开字段。
- 为 TS、API Vitest、Web Vitest 和 Vite 增加精确图片子路径映射。具体子路径必须先于根别名，否则 Vite 会把 `@toolbox/shared/image` 展开为 `index.ts/image`。
- 仅两个真实消费者切换导入来源：API 压缩服务的 `normalizeImageOptions`，Web AI 图片 API 的图片领域 Schema/查询类型。实现函数、请求构造、响应解析、业务目录和队列均不变。
- 新增图片契约 dist-only 消费检查，接入原 `pnpm smoke` / `pnpm build`。只复制 shared 清单、dist 和已有 TypeBox 依赖至临时中文空格目录，没有源码、Git、用户配置或工作区链接。

## 保持不变的契约

公开启动/构建命令、旧 shared 根导出及 desktop/edge-tts/chatterbox 子路径保留。API、URL、错误码、字段、optional/nullable、默认值、未知字段策略、Worker 协议、任务/留档及删除规则不变。

三份规范实现与固定 HEAD 内容完全一致，使用 `git diff --exit-code HEAD -- packages/shared/src/image-options.ts packages/shared/src/image-ai.ts packages/shared/src/product-image.ts` 验证，不通过重新生成快照接受 Schema 变化。

保留现有 tsup 独立入口打包策略：源码入口共享原对象；dist 不承诺跨独立打包入口的 JavaScript 引用身份，验证其导出名称、Schema 内容、类型和函数结果等效，不新增引用身份契约。

没有新增或升级依赖、模型、Python 包，没有修改 lockfile 或任何已签名包。

## 新增与调整的测试

图片入口新增 5 项测试：

1. 导出名称恰为三份原模块的并集，不泄漏其他领域。
2. 原模块、根入口和图片入口的每个源码 Schema/函数/常量引用一致。
3. 根/领域类型一致，原图 URL 可选性不变。
4. 合法及非法配方的接受范围和详细错误一致，覆盖额外字段、空颜色及尺寸/缩放边界。
5. 压缩默认参数和商品布局函数结果一致。

dist 检查使用无 Node/Electron 环境类型的 ES2022 TypeScript 编译；错误字段类型及跨领域导入必须拒绝。实际加载根/图片入口核对运行时 Schema、默认值、布局及额外字段拒绝行为，并检查导入没有创建业务数据。

原测试均保留，未扩大测试排除、降低覆盖率或体积预算。

## 执行命令及结果

- 定向图片入口测试 5/5，API 压缩测试 5/5，Web AI 图片 API 测试 4/4。
- 全工作区类型检查、Lint、Knip 通过。架构检查 312 个生产/配置源通过；冻结契约 2 项、架构检查自身 4 项通过。
- 首次 `pnpm build` 中各构建与预算通过，但新增冒烟脚本使用未公开的 `@sinclair/typebox/package.json` 定位失败；同一旧写法触发 Knip 未声明依赖告警。修正为读取 shared 实际安装目录后，`pnpm smoke` 及 Knip 均通过。没有添加依赖或检查忽略。
- tsup 提示 image 独立入口的 TypeBox Value 未使用导入；未改写原 Worker 协议文件来消除此非致命提示。是否需要独立优化留待有证据的工程任务。
- `pnpm coverage` 全部通过：runtime-core 21、shared 98、API 739、Web 381 项通过，API 保留既有 6 项跳过。shared 比上一轮增加 5 项，其他测试数量未减少。
- 覆盖率（行/分支/函数）：API 92.90% / 81.65% / 90.98%；Web 79.89% / 84.05% / 75.48%；shared 97.63% / 93.15% / 88.63%；runtime-core 全部 100%。新图片入口 100%，原门槛不变。
- 完整 `pnpm build` 修正后重跑通过，包含 shared/core/API/Web 构建、体积预算、图片/桌面 dist 消费、源码及分发路径、冷/热启动和合成商品图冒烟。
- `pnpm --filter desktop test`：95 项单元测试、7 项冒烟脚本单元测试通过；`pnpm --filter desktop build` 编译通过，没有执行根目录的桌面暂存或安装包制作命令。
- `pnpm test:scripts`：77 项通过、1 项原有跳过。独立开发环境 pytest 8 项通过，Python runner 单元测试 5 项通过；没有安装依赖或加载模型。
- `pnpm format:check`、`git diff --check` 通过。
- `node scripts/check-diff-coverage.mjs --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree --threshold 90`：119/127，93.70%，通过原 90% 门槛。
- 入口 gzip 151815 字节（限 153600），最大业务懒加载块 53094 字节（限 76800），与 R03-A 收口时一致；没有提高预算。
- 结束时真实 Git 索引仍为空；新图片契约临时目录无残留。没有操作此前保留的 R03 验证目录。

## 跳过、独立缺陷与后续

本轮不执行真实模型、Python Worker 专项、浏览器 E2E、macOS 实机或安装包制作；这些检查不能据此标记为本轮通过。
B05 仍独立登记，B06 隔离修复保留；本轮没有业务缺陷修复或数据迁移。

剩余过渡层：原三份平铺文件仍是唯一规范实现，图片目录目前是稳定领域导出入口；不是第二套源码。以后可独立迁移实现位置，必须保留根导出并核对内部消费者，不能在本轮同时搬目录。

下一任务：R03-B2，另选一个领域整理契约与子路径，逐项复用已有 Schema；不得顺带修改业务实现。没有提交、推送、发布、读取私钥或构建桌面安装包。
