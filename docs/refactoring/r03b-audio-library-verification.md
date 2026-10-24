# R03-B2：音频库领域共享契约入口

任务编号：R03-B2。状态：DONE，仅此音频库入口单元完成。R03 整阶段仍为 IN_PROGRESS。
固定基线：`55526abc4f67d04e99ba677b335c38b43b4584bb`。

## 本次完成与改动范围

- 开始核对工作区，真实 Git 索引为空，保留此前所有未提交修改。
- 先审查归档域，发现日期校验依赖 shared 根入口注册，已说明证据并暂停对应迁移，记录为 [C01 前置约束](baseline-issues.md)。本轮选择不依赖该注册的音频库域；没有修改归档 Schema 或初始化逻辑。
- 新增 `packages/shared/src/audio-library/index.ts` 和 `@toolbox/shared/audio-library` 类型/ESM 导出；仅转导出现有唯一规范实现，旧根导出和原文件不变。
- 精确子路径加入 TypeScript、API/Web 测试与 Vite 别名，位于根别名之前。
- 仅 API 音频文件校验器的容量常量、Web 音频库客户端的领域 Schema/类型改用新入口；媒体校验、URL、方法、参数、超时及文件提交均不变。
- 将上一轮图片冒烟中的临时目录、依赖副本、无 Node/Electron 声明编译及子进程校验提取到 `tooling/testing/shared-contract-consumer.mjs`，图片样本和负向断言保留，音频库复用同一夹具；不复制第二套隔离实现。
- 原图片冒烟函数名/调用保留；新增音频库冒烟接入既有 `pnpm smoke`，没有改变公开命令或引入测试框架。

## 保持不变的契约

`packages/shared/src/audio-library.ts` 与固定 HEAD 完全一致，`git diff --exit-code HEAD -- packages/shared/src/audio-library.ts` 通过。归档相关五份原文件也未改变。

100 MiB 文件上限、10 GiB 默认容量、可空分组、可选 presets、revision、清单版本及备份格式保持不变。永久副本、回收站/恢复/永久删除、导入来源、任务、播放器单实例及保留规则不变。

旧 shared 根及 desktop/image/edge-tts/chatterbox 子路径保持；未调整数据库、HTTP API 或错误码。没有新增依赖、模型、Python 包，没有改 lockfile、签名包、受信密钥或现有能力安装状态。

## 新增或调整的测试

- shared 新增 5 项：导出集合与引用身份；容量常量；nullable/optional 类型；旧清单无 presets 的读取；编辑、分组、导入及预设的接受范围和详细错误。
- Web 新增 4 项真实 API 客户端委托测试：列表/编辑、回收站/恢复/永久删除的独立请求、两种配音导入、预设创建/更新/加载及带版本删除。只替换 HTTP 传输，不 mock 被测 API 模块。
- 既有工程契约测试入口新增 2 项夹具保护：非法目录名在访问包前拒绝；初始化失败后清理自己的唯一临时目录。原 2 项冻结契约测试仍执行，公开命令不变。
- dist-only 消费在没有仓库源码、Git 或环境类型的临时中文空格目录运行；音频库在加载根入口之前验证旧清单和 nullable 字段，避免隐式依赖被根导入掩盖。错误字段类型和跨域导出必须被 TypeScript 拒绝。

## 执行命令及结果

- 定向 shared 5/5、Web 客户端 4/4、既有 API 音频库 22/22 通过。
- `pnpm test:contracts` 4 项通过；全库类型、Lint、Knip 及 313 个生产/配置源码的架构检查通过。
- shared 构建和单独执行图片/音频库 dist 消费通过；图片原有负向断言未删除。
- `pnpm coverage` 全工作区通过：runtime-core 21、shared 103、API 739、Web 385 项通过；API 保留原有 6 项跳过。相对上一轮仅增加 shared 5、Web 4 项，没有减少旧测试收集。
- 覆盖率（行/分支/函数）：API 92.90% / 81.65% / 90.98%；Web 80.06% / 84.14% / 76.36%；shared 97.63% / 93.15% / 88.63%；runtime-core 全部 100%。新音频库入口 100%，没有调整统计范围或原阈值。
- `pnpm test:scripts`：77 项通过、1 项原有跳过；`pnpm test:architecture` 4 项通过。桌面 95 项单元测试及 7 项冒烟脚本单元测试通过。
- 独立开发环境 pytest 8 项、Python runner 单元测试 5 项通过，未加载模型或安装依赖。
- `pnpm build` 全链通过：shared/core/API/Web、原体积预算、三个契约消费入口、源码和分发布局、不同 cwd/无 Git/冷热启动、本地资源保留及合成商品图冒烟；`pnpm --filter desktop build` 编译通过，没有执行暂存、原生模块重建或安装包命令。
- `pnpm format:check`、`git diff --check` 通过。
- 固定基线命令 `node scripts/check-diff-coverage.mjs --base 55526abc4f67d04e99ba677b335c38b43b4584bb --worktree --threshold 90`：122/130，93.85%，通过原 90% 门槛。
- 前端入口 gzip 151747 字节（限 153600），最大业务懒加载块 53096 字节（限 76800），未提高预算；不将轻微构建体积变化宣称为运行性能提升。
- 结束时真实 Git 索引仍为空，音频库契约临时目录无残留；未操作此前保留的 R03 临时目录。原音频库、归档五份契约及日期初始化模块与固定 HEAD 字节一致。

## 跳过、问题及剩余过渡层

不执行浏览器 E2E、真实模型、需要已有框架的 Python Worker 专项、macOS 实机或桌面安装包验收；不得据本轮静态/构建检查声称这些项目已验收。
构建保留上一轮 image 入口的 TypeBox Value 未使用导入提示，不为消除提示改写 Worker 协议。C01 不在本轮修复，B05 仍独立登记，B06 隔离修复保留。

平铺 `audio-library.ts` 仍是唯一规范实现，新目录只是稳定领域入口，未增加平行 Schema。API 客户端原有 localStorage/格式化函数仍待 R08，不在导出整理时顺带搬迁。

下一任务：先选取无隐式初始化依赖的另一领域继续 R03，或在说明 C01 的初始化策略后单独领取归档任务。没有提交、推送、发布、读取私钥、构建桌面安装包或修改数据保留/删除规则。
