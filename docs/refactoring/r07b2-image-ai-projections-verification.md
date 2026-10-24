# R07-B2：AI 图片类型和投影提取

## 任务与边界

状态：DONE（2026-10-23）。基线仍为 `55526abc4f67d04e99ba677b335c38b43b4584bb`。
开始核验工作区共 1137 条完整 porcelain 记录，真实索引为空；保留 R00–R07-B1 所有未提交修改。
无 AGENTS 指令，未使用子代理。只提取存储类型与三个纯投影函数，不进入持久化职责拆分。

本单元先在现有管理器上补兼容断言，再提取类型及公开 DTO、统一任务、数据库 entity 投影。
任务映射、队列、预留、source lease、删除锁、初始化/重启恢复、文件提交和成功发布顺序仍由原管理器拥有。
不改变原浅引用语义、optional/null 字段、取消映射及长期保留/过期删除规则；不新增 API 或数据库迁移。
不读取私钥、改能力包、下载模型或依赖，不提交/推送/发布，不制作桌面安装包。

## 执行证据

### 本次完成及改动范围

- `apps/api/src/domains/image-ai/types.ts`：原 StoredInput、私有 StoredResult、StoredImageAiTask 的唯一声明来源。
- 同目录 `task-projections.ts`：原 toUnifiedTask、toEntity、toPublicTask 的唯一实现来源。
- `task-manager.ts`：导入以上实现；原 StoredInput、StoredImageAiTask 导出通过 type re-export 保持，不新增 StoredResult 的公开导出。
- `image-ai-manager-compat.test.ts` 增加 4 项迁移前断言；新增 `image-ai-task-projections.test.ts` 16 项纯函数及类型兼容断言。
- 更新本报告与当前进度入口，其他已有工作区修改保留。

对本单元开始时捕获的源码与提取后源码逐段比较：整个 createImageAiTaskManager 函数文本相同，
其余未提取的自由函数文本相同；三个提取函数除增加 export 外文本相同；三个类型声明文本相同。
比较只规范化换行及段末空白，不重写条件、字段或顺序。
类型文件经现有 TypeScript 转译只有 `export {};`，没有加载商品渲染器或其他运行时副作用。
现有差异门禁也通过 AST 验证其仅含声明；未新增覆盖率排除规则。

### 保持不变的契约

公开 DTO 保留原字段及属性顺序，缺失可选字段仍为自身的 undefined 属性，JSON 序列化仍自然省略；
queuePosition、expiresAt 的 null 或具体值不被默认化。
结果对象仍只剔除 outputPath，并保留已有扩展属性；输入对象继续使用原字段白名单，顶层也不扩展字段。
顶层对象、输入/结果数组及元素、任务 warnings 仍复制；recipe、source、结果内 warnings 等嵌套值仍是原借用引用，不改为深克隆。

统一任务仍只取第一个结果路径，空结果为 undefined；仅在统一任务投影中将 canceled 映射为 failed/CANCELLED。
数据库 image-ai-task 记录保留原领域状态、原时间和 payload 引用，不创建新存储格式或额外副本。
管理器仍先保存领域记录，再更新统一任务投影；所有初始化、恢复、清理、提交和异常处理语句均未修改。
不改变成功及部分成功的永久留档、无结果过期清理、独立商品图快照、source lease、删除锁或成功发布顺序。

### 新增或调整的测试

提取前在原管理器上运行 10 项测试通过（原 6 项、增加 4 项）：
completed/failed/canceled 三种终态的领域记录与统一投影分别验证，多个结果只取首个路径；
无结果失败任务的未来过期时间、可选字段和缺失输出保持。

提取后原 API 20 项、管理器 10 项、路由契约 2 项通过；新增纯投影 16 项和管理器 10 项再次通过。
纯函数测试覆盖全部五种任务状态、空结果/双结果、取消错误、payload 身份、属性顺序、原浅引用语义、
已有结果扩展字段、输入/顶层白名单、undefined/null/具体时间及旧类型导出兼容。
冻结输入对象并核对未变，不加载模型、读取真实业务数据或创建推理任务。

本单元比 R07-B1 增加 20 项 API 测试；不存在无法解释的测试收集减少。

### 执行的命令及结果

| 命令/检查                                                    | 本任务实际结果                                                                                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| pnpm typecheck / lint / deadcode                             | 全工作区通过，没有 any、关闭检查或新增忽略                                                                                         |
| pnpm lint:architecture                                       | 369 个生产/配置文件通过，原两条精确跨应用债务不变                                                                                  |
| pnpm test:contracts / test:architecture / test:diff-coverage | 4 / 4 / 16 项通过，273 个 API/健康方法及路径冻结通过                                                                               |
| pnpm coverage                                                | core 21、shared 130、API 926、Web 389 通过；API 86 个测试文件通过、1 个原文件跳过，原 6 项跳过保留                                 |
| API / Web 覆盖率                                             | API 行/语句 92.57%、分支 83.01%、函数 91.07%；Web 行 80.31%、分支 84.39%、函数 76.34%                                              |
| 新投影文件覆盖率                                             | task-projections.ts 行/语句、分支、函数均 100%                                                                                     |
| pnpm build                                                   | 完整普通构建、领域 dist/浏览器契约、冷/热启动、ZIP 无 Git、异 cwd、已有资源复用及资源布局冒烟通过；编译态合成商品图渲染无需 Python |
| pnpm --filter desktop build / test                           | main/preload 编译通过；95 单元及 7 冒烟脚本单元通过；未运行根 desktop:build 或资源 stage/native rebuild                            |
| pnpm test:scripts / test:python:runner                       | 82 通过、1 项原跳过 / 5 通过                                                                                                       |
| 既有 .venv-refactor-tests 解释器                             | pytest 8 项通过；Ruff format 11 文件、Ruff lint、mypy 9 文件通过；未安装依赖                                                       |
| pnpm test:e2e                                                | 按 Playwright 技能复用原 5 项，全部通过，15.4 秒；未新建测试或连接真实模型服务                                                     |
| 固定基线差异门禁                                             | 2927/3107，94.21%；新投影 48/48，原 90% 门槛不变                                                                                   |
| pnpm format:check / git diff --check                         | 全库格式及 diff 检查通过；真实索引为空，HEAD 未变                                                                                  |

全局覆盖率 75%/65%、差异 90% 和测试超时不变；没有用不统计文件解决门禁。
入口 gzip 151744/153600 字节，懒加载块阈值 76800 字节不变。
差异覆盖率覆盖固定基线以来全部未提交改动，不仅本单元。

E2E 使用独立临时根 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r07b2-final-e2e-281c78d0ebe54158ba0233405809e2e4`，
finally 恢复 TEMP/TMP 和 TOOLBOX_LEGACY_DATA_ROOT；目录保留，不手动清理此前证据目录。
五项覆盖健康、LAN 续传与批量删除、固定替身配音、归档重试及确认取消。

### 跳过、独立缺陷与剩余过渡层

本单元未发现需要改变业务行为的独立缺陷；B05/B07/B10 保留单独待办，没有混修。
原 API 的 6 项和工程脚本的 1 项条件跳过保持，未删除测试或改收集规则。
本轮不重新执行真实 Worker 框架依赖专项、真实模型推理、真实能力安装、macOS 实机或桌面安装包级验收，不将轻量 pytest 或桌面编译等同于这些验收。

没有平行类型/投影实现。原管理器的类型 re-export 是兼容入口，不是第二套实现，仍保留。
持久化、推理/商品图执行、历史及删除职责仍在管理器，未冒称整个 AI 图片或 R07 已完成。
没有提交、推送、发布、签名或制作安装包，没有修改用户数据和已签名能力包。

## 下一任务

R07-B3 单独处理持久化适配，开始前重新核对工作区及兼容断言。
R07-B、R07 整体及 R08–R12 尚未完成；B05/B07/B10 独立待办不混修。
