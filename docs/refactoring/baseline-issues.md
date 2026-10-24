# R00 独立基线问题（2026-10-22）

基线：`55526abc4f67d04e99ba677b335c38b43b4584bb`。
以下最初结果来自未改动的业务源码与 E2E 测试；不是目录重构造成的回归。保留失败原因与原检查目标，不通过忽略用例或修改业务来使其通过。

## 2026-10-24 状态索引

本轮登记的问题均已分别完成代码级修复/测试验收；下文“尚未修复”“暂停”等保留为发现时证据，不表示仍然阻塞 R12。真实环境专项仍见 [后续清单](post-r12-acceptance.md)，不从本表推断已通过。

| 问题                             | 最终代码级证据                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| B01 / B02：旧 E2E 控件与批次契约 | [R01 验收](r01-verification.md)                                                                                  |
| B03：轻量 Python 测试工具缺失    | [R01 的独立开发测试环境](r01-verification.md)，不改能力环境                                                      |
| B04：编译态根锚点                | [B04](b04-verification.md)                                                                                       |
| B05：桌面开发静态资源            | [B05](b05-verification.md)                                                                                       |
| B06 / B07：应用 / 配音测试隔离   | [B06](b06-verification.md)、[B07](b07-verification.md)                                                           |
| B08：声明文件差异覆盖率          | [B08](b08-verification.md)                                                                                       |
| B09 / B11：图片测试隔离          | [B09](b09-verification.md)、[B11](b11-verification.md)                                                           |
| B10：压缩响应尺寸                | [B10](b10-verification.md)                                                                                       |
| B12：ZIP 条目顺序测试            | [B12](b12-verification.md)                                                                                       |
| B13：推理最终记录写入失败        | [B13](b13-verification.md)                                                                                       |
| C01：独立契约入口格式初始化      | [初始化提取](r03-format-initialization-verification.md)、[最终契约归属](r03e-contract-ownership-verification.md) |

## B13：普通推理最终写入失败后公开状态误报完成（独立修复已验收）

后续用户明确授权，B13 已独立修复并通过完整门禁，见 [B13 修复验收](b13-verification.md)。以下保留发现时证据；B4 在此验收后恢复，不再由 B13 阻塞。

2026-10-23 R07-B4 故障验证确认：最终领域写入一次性失败时，图片任务接口为 completed，最后成功的领域及统一记录仍为 running。
原因是原普通 processTask 先 patch 成功，再 persist，失败上层未收敛当前任务。此函数与固定基线 AST 相同。
已撤回本轮提取草稿、在提取前源码复现，保留新增正常失败断言，不通过 skip/改预期隐藏。
这触及“成功状态先于持久化完成”的计划停止条件，R07-B4 标记 BLOCKED_BY_BASELINE，先独立修复 B13 再恢复。
详细复现、验证范围及修复建议见 [B13 记录](b13-inference-final-write-regression.md)。未改用户数据或保留/删除规则。

## B09：图片压缩既有测试的应用及本机配置未完整隔离

2026-10-23 R07-A 预检发现：image-tools.test.ts 在 beforeEach 仅设置进程 STORAGE_ROOT，直接 createApp() 仍可能读取本机 .env/runtime/models；afterEach 先删除该环境变量再 rm storage，且元数据测试没有 app.close。其他用例的 finally 也无法覆盖应用尚未创建成功或测试提前退出的全部路径。这是测试夹具风险，不是已经证实的压缩业务失败。

先独立复用 B06 的 createIsolatedAppFixture：明确布局、dotenvPath:false、受控 environment 和缺失能力替身路径；追踪本测试所有已启动应用，先 close 后删除经验证的专用临时根。不创建第二套隔离工具，不触碰业务实现、原 5 项断言/超时/测试收集或全局配置，不把它混入领域迁移。迁移前先验收本独立修复，结果见 [B09 验收](b09-verification.md)。

## B11：AI 图片 API 测试仍继承本机配置/运行时（独立测试修复）

2026-10-23 R07-B1 预检确认：image-ai.test.ts 设置 4 个全局环境变量后直接 createApp()，虽然 afterEach 会关闭最后的 app，但未显式隔离 .env/runtime/models；直接 delete 也无法恢复宿主原环境变量。重启测试确需复用本测试的文件数据库，不能简单改为每次新建内存数据库。

先独立复用 B06 夹具，显式传入其 storage 内 toolbox.db、本测试回环 Worker 地址和原 deploymentUsage；只为这 3 个既有配置增加受控测试选项类型，不改默认值或生产配置。原 24 次应用创建全部由夹具追踪，保留原 20 项断言/超时及重启、模拟 Worker 行为；先关闭应用和 Worker，再由夹具核验并清理其自有目录。新增夹具断言验证显式设置及两次启动复用、不继承/改写宿主设置，见 [B11 验收](b11-verification.md)。

## B12：压缩 ZIP 兼容测试误将条目顺序当作稳定契约（独立测试修复）

后续独立修复已通过，原失败及确定性复现保留；最终恢复全量验收见 [B12](b12-verification.md) 和 [R07-B1](r07b1-image-ai-layout-verification.md)。下文为发现时的暂停记录，不再表示仍阻塞。

2026-10-23 R07-B1 首次完整 coverage：API 904 通过、1 失败、6 原跳过；失败为 image-compression-compat 的 Unicode ZIP 用例，收到 ['商品图 (2).jpeg','商品图.jpeg']，断言却要求反序。单独重跑原 24 项又通过，不能靠重跑绿灯验收。

生产压缩源码在 R07-B1 未改；现用 archiver 8.0.0 的 lib/core.js 显式 statConcurrency=4，file 经并发 _statQueue，完成后入串行 _queue。文件选择与重名分配顺序固定，不等于中央目录条目顺序。原用例还使用两张相同图片，按条目序号比较内容不足以捕获文件名/内容错配。

R07-B1 暂缓验收，先独立 B12：添加可控逆序 Buffer append 夹具确定性复现旧断言失败；保留自然归档分支，再用两张不同图按文件名检查完整 ZIP 的每份字节、条目集合、重名和选择去重，不再依赖内部 I/O 完成顺序。不改生产归档、Schema、阈值、超时、测试发现或用户数据；验证见 [B12 验收](b12-verification.md)。

## B10：图片压缩缩放后仍返回原图尺寸（已独立修复）

2026-10-24 用户明确授权独立修复，代码级回归通过，见 [B10 验收](b10-verification.md)。现返回实际输出尺寸，Schema 和编码/提交规则不变。以下保留结构迁移时冻结旧行为的历史记录，不再表示仍待修复。

2026-10-23 R07-A 在移动前补兼容测试确认：上传 64×48 PNG 并指定 width=32，下载文件实际为 32×24，而响应 width/height 为 64/48。ImageFileGateway.compress 在 resize 后仍返回先前 metadata.width/height；ImageCompressionService 原样投影到响应。未指定缩放或请求放大时维持不放大的旧行为。

本轮只登记并用断言冻结现状，不顺便更改 API 字段、Sharp 编码或前端展示；不能将结构迁移前后相同视为此问题已修复。后续独立确认字段语义及消费者，再考虑改为输出尺寸并补 EXIF/缩放/格式回归。本任务不以重写历史元数据或用户文件作为修复途径。

## B01：服务状态 E2E 查找已不存在的控件

- 命令：`pnpm test:e2e`。
- 用例：`starts the web app and reports live/ready health`。
- 失败位置：`e2e/toolbox.spec.ts:16`；live/ready 请求和首页标题断言已执行通过。
- 测试等待按钮 `查看本地服务状态`，并期望文字 `本地服务可用`；10 秒内找不到元素。
- 当前 `frontend/src/layouts/ToolLayout.vue` 使用 `本地服务与管理员会话` 打开状态抽屉，诊断按钮名称为动态的 `…，查看环境诊断`。
- 当前诊断还区分基础服务与可选能力，缺少测试环境中的能力不能直接等同基础服务故障。
- 本机失败快照及 trace 位于 `test-results/toolbox-toolbox-critical-w-764a2-d-reports-live-ready-health/`，未纳入 Git。

建议独立任务：根据已有 UI 行为重新覆盖服务抽屉/基础健康和诊断入口；仍验证真实服务状态，不能只删除断言或允许任意状态。

已独立完成测试同步：点击当前服务/会话按钮，等待真实 `/api/v1/health` 响应，验证 `ok`、主服务正常及 6 个服务条目；live/ready 检查保留。全量 E2E 复验通过。

## B02：配音 E2E 仍描述旧版单条生成流程

- 用例：`creates and completes an Edge-TTS task in the page`。
- 失败位置：`e2e/toolbox.spec.ts:177`；等待旧 placeholder `例如：Selamat datang`，达到 60 秒上限。
- 当前 `frontend/src/modules/edge-tts/page.vue` 默认引擎为 Chatterbox；页面快照确认参考音色克隆 tab 已选中。
- 当前 `EdgeTtsPanel.vue` 使用有序编辑器、`createBatch` 和批次结果，而此用例仍模拟 `/edge-tts/tasks`、点击 `生成语音` 并等待旧单条结果。
- 仅增加切换 tab 仍不足以修复；必须为当前批次契约准备正确的请求、响应及事件夹具。
- 本机失败快照及 trace 位于 `test-results/toolbox-toolbox-critical-w-4ce2d-n-Edge-TTS-task-in-the-page/`，未纳入 Git。

建议独立任务：覆盖显式切换在线引擎、有序文案提交、批次完成、音频与字幕结果；使用固定替身，禁止发送真实文案至在线服务。
旧单条 API 的后端兼容测试继续保留，不能因前端界面演进删除旧 API。

已独立完成测试同步：显式切换在线引擎，提交两段有序原文/中文，验证完整请求字段、轮询完成及 5 个音频/字幕/ZIP 结果链接。
固定 queued/completed 响应经当前共享 Schema 校验；只拦截在线配音端点，未预期请求会失败。没有修改业务或删除其余 E2E，最终 5 项全部通过（15.5 秒）。

## B03：最初 Python 没有 pytest（已解决）

- 当前命令解析到 Python 3.12.14，`python -m pytest` 返回 `No module named pytest`。
- 未自动安装 Python 依赖、创建环境或修改任何能力环境。
- 另行执行标准库 unittest 的 8 项轻量测试，全部通过；它不包含另外两份需要模型框架依赖的 Worker 测试。
- 用户提供的 Python311 路径实际为 3.11.9，也缺少 pytest；不符合项目 `>=3.12,<3.13` 要求，不将其替代为项目运行时。

用户随后授权创建独立测试环境。已使用 Python 3.12.14 创建 `.venv-refactor-tests/`，仅安装项目已声明的 dev 工具及其依赖，pytest 8 项通过，Ruff 与 mypy 通过，pip check 通过。
能力环境、已签名包及依赖声明未修改；没有在能力环境中临时 pip 安装工具。

## 隔离入口实际运行补验

- 初次图片 Worker 测试 13 项中有 4 项异步测试失败：新隔离入口把 Windows 标准库 `socketpair` 的内部连接一起拦截，事件循环无法创建；不是业务 Worker 缺陷。
- 修复范围仅限 `tooling/testing/python-workers.mjs`：线程局部允许标准库内部管道创建，普通连接仍拒绝，加载 Worker 前自检这两种行为。
- 初次配音 Worker 测试 14 项中有 1 项无法导入 `chatterbox`：该安装的源码位于独立 vendor，不在 venv 的 site-packages。新增显式只读 `--vendor` 参数，不继承全局 PYTHONPATH，也不复制模型或修改安装。
- 重跑图片 13 项、配音 14 项全部通过；原 Worker 和测试文件保持原样。第三方 SciPy/pkg_resources 弃用警告保留，不通过升级依赖消除。

## B04：原编译态默认应用根目录高一级（已独立修复）

- R02-A 提取前的 `backend/src/runtime/runtime-layout.ts` 使用 `new URL("../../..", import.meta.url)`，源码位置 `backend/src/runtime/` 下指向仓库根。
- 原构建产物 `backend/dist/chunk-ZTSZJRM2.js` 第 38 行保留相同表达式，在 `backend/dist/` 下指向仓库父目录。本机为 `F:\git仓库内容`，而非 `F:\git仓库内容\tool2.0`。
- 实际构建模块的 `getConfig({dotenvPath:false, environment:{NODE_ENV:"test"}})` 已验证该默认值；调用不启动应用或打开数据库。
- 这是既存问题。R02-A 保留应用侧锚点及原语义，构建冒烟同时验证默认兼容与显式布局覆盖。
- 影响无显式布局的编译态默认资源/配置/数据定位；桌面显式布局不应因此改动，已明确配置的数据路径也不能顺带搬迁。
- 建议独立任务：只读核查实际默认数据/配置目录及入口，明确历史路径兼容策略，再统一源码/构建锚点。不得直接更改 URL 深度或 storage 默认值而隐藏旧数据，不自动移动或删除任何数据。
- R02-A 时保持原样；后续在用户同意单独优化后修复，未搬迁、转换或删除用户数据。
- 当前 source/dist 使用同一应用锚点。编译态发现旧根标记会拒绝启动；通过进程环境 `TOOLBOX_LEGACY_DATA_ROOT` 显式选择后复用旧可写目录，只读资源仍使用当前项目。显式桌面布局保持不变。
- 回归和边界见 [B04 验收记录](b04-verification.md)；此修复没有混入 R02-B 机械迁移。

## 当前推进边界

R00/R01、R02-A/B/C 和 B04 已完成；各阶段状态以本目录 README 为准。
实际安装包、真实模型以及 Windows/macOS 干净电脑验收仍待后续人工验证。

## B05：桌面开发模式静态资源根不是构建目录（已独立修复）

2026-10-24 已用实际桌面开发布局及隔离后端复现首页 404，修正为 apps/web/dist 后代码级回归通过，见 [B05 验收](b05-verification.md)。打包资源和数据位置不变，真实 Electron/macOS/安装包级验收另行执行。以下为原发现记录。

- R02-C 前 `createDesktopRuntimeLayout({packaged:false})` 的 `frontendDistRoot` 是仓库 `frontend/`，不是 `frontend/dist/`。
- 桌面入口向后端传入该显式目录，主窗口加载后端 origin；`registerFrontendAssets` 同时要求根目录的 `index.html` 和 `assets/`。
  源码目录没有构建产物的 `assets/`，因此现有桌面源码启动存在静态页面无法注册的风险。
- 该路径已有测试固定；本次等价改为 `apps/web/`，未顺便改为 `apps/web/dist/` 或扩大静态服务根。
- 打包模式仍指向 `resources/frontend`，不受源码目录迁移影响。
- 后续独立任务需复现 `desktop:start` 的静态页面加载，确定开发模式加载 Vite 还是构建产物，再增加回归测试。
  本次不运行真实桌面暂存或安装器制作，也不据此宣称桌面源码 UI 已验收。

## B06：既有应用测试未完整隔离本机存储与运行时

2026-10-22 独立修复通过：完整临时布局、受控配置、真实清理脚本副本及失败清理已实现，原 13 项应用测试与新增 5 项夹具测试通过；全工作区 coverage 及固定基线差异覆盖率通过，最终验证见 [B06 验收记录](b06-verification.md)。以下保留发现时的证据，不将当时的失败报告改写为成功。

- R03-A 验证发现 `apps/api/src/__tests__/app.test.ts` 多处直接 `createApp()`；
  “缺少签名能力时阻止任务”测试还直接构造 `getConfig({ desktopManagedCapabilities: true, dotenvPath: false, environment: { NODE_ENV: "test" } })`，没有显式 layout。
- 只读配置核查确认：默认测试数据库为内存，但 storage 在项目内，runtime 指向项目 `.runtime`，并非专用临时目录。
  不能把内存数据库等同于文件和能力运行时隔离，不能据此声称未访问本机存储。
- 首次全量 coverage：工具列表测试在既有 5000 ms 限制超时，API 733 通过、1 失败、6 既有跳过。
- 外部指定临时 `TOOLBOX_LEGACY_DATA_ROOT` 后单独复验：工具列表通过；签名能力缺失测试仍在 5000 ms 超时。
  它显式提供 environment，按原优先级不会继承外部的临时根选项。因此进程级参数不足以隔离整份文件。
- 两次超时发生在不同测试，尚不能仅据此认定根因。R03-A 没有修改上述测试、默认超时或任何任务/能力状态机；桌面 main.js 与本阶段开始前字节相同。
- 暂停继续重跑这些未隔离入口。R03-A 代码保留，不能标记完成，也不能将局部复验代替全量 coverage 门禁。

建议独立 B06 任务：

1. 为该测试文件每项创建专用临时根，显式传入包含 config/storage/runtime/models/scripts/frontend 的完整 RuntimeLayout。
2. 使用真实 `getConfig`，显式 `dotenvPath:false` 和受控 environment；不要 mock 整套配置来绕过业务校验。
3. 能力目录使用空的合成目录或受控替身，不能读取本机安装状态或启动真实模型。
4. 所有成功/失败分支均在 finally/afterEach 关闭本测试创建的应用，再清理经验证的临时目录。
5. 保留原断言、测试收集数量及 5000 ms 超时，不扩大排除或隐藏失败。
6. 独立记录修复与验证后，再恢复 R03-A 全量 coverage、差异覆盖率和收口验收。

此次复验目录保留在 `C:\Users\tangmy\AppData\Local\Temp\toolbox-r03-validation-a35af12c2dd84046b81a04750a1a0cde`。
包含递归清理的初始命令被安全策略拒绝、未执行；后续仅创建并使用专用临时根，没有换用其他删除手段。

## C01：归档独立契约入口依赖日期格式初始化（提取及 LAN/归档入口采用均已验证）

后续进展：LAN 响应契约也有相同依赖；R03-C01 已先单独提取 shared 内部显式格式初始化，保留原根入口的调用位置、Date.parse 判定及自定义校验器优先级，验证见 [格式初始化验收记录](r03-format-initialization-verification.md)。尚未新增 LAN/归档入口，以下发现与暂停记录保留；后续消费者采用仍需独立验证。

再后续 R03-B3/B4 已分别新增 LAN/归档入口，默认/自定义注册表的独立 dist、静态命名及动态浏览器 tree-shaking 验证通过，完整覆盖率和构建通过。此约束已按显式初始化方式落实；下文保留当时发现与暂停过程，不再视为未解决阻塞。

R03-B2 只读核查发现：`xhs-archive.ts` 多处使用 TypeBox `format: "date-time"`；`content-archive.ts` 复用这些 Schema，但日期格式仅在 `api-schema.ts` 的模块初始化中注册，现有根入口会加载该模块。

隔离子进程中以相同的合成翻译字段（含合法 editedAt）复验：直接导入原 xhs 模块时 `dateTimeRegistered:false, valid:false`；加载原 shared 根入口后为 `true,true`。没有修改全局宿主进程、用户数据或 Schema。

这不是已复现的现有业务入口故障，而是新增独立 archive 子路径时必须处理的结构约束。不能直接转导出后假定其独立加载行为与根入口等同，也不能靠测试先加载根模块掩盖差异。

本轮暂停归档子路径，原文件和依赖方向保持原样，改做无此初始化依赖的音频库入口。后续归档任务开始前，需先说明并确定公共格式初始化的归属和加载策略，兼容既有自定义 FormatRegistry 行为，并在干净子进程中验证合法/非法日期和未知字段；不得静默扩大日期接受范围或复制一套校验器。

## C02：R04 两个 replaceFile 并不等价，禁止按名称合并

2026-10-23 为后续 R04 只读预检：`chatterbox/batch-artifacts.ts` 的导出函数先备份旧目标、替换失败后恢复；`chatterbox/media-tools.ts` 私有同名函数实际调用 `storage/file-commit-gateway.ts` 的 `commitStagedFile`，具有同目录约束、fsync 和 rename 语义，无 backup/restore。基线 HEAD 中也是这两种不同实现，不是本轮迁移造成。

原方案“两个相同 replaceFile”的假设不成立，不视为已复现业务缺陷。后续暂停这两种策略的合并：只允许将 batch-artifacts 中现有 backup/restore 实现原样归属到配音共享层，消除 Edge-TTS 对 Chatterbox 私有实现的引用；media-tools 的持久提交策略保留。不得用新通用 rename 或 backup 策略替换 `commitStagedFile`，也不得改变提交顺序。

实际相同的 SRT 时间格式函数可独立提取，仍需先做相等证明和回归测试。此调整符合原方案“先证明行为相同，不按名称合并”的总约束，不扩展业务功能或数据规则。

R04 收口补充：batch-queue 内另有与 batch-artifacts 相同的 backup/restore，已用函数体 AST 对比证明并合入同一共享实现。故最终应区分“batch-artifacts 与 batch-queue 两份相同的备份策略”和“media-tools 的不同持久提交策略”；前述 C02 禁止合并的是后者，不应据此保留前者重复。相关验证见 R04-B 补充与 R04 总验收。

## B07：Chatterbox 测试断言失败时没有先关闭应用（已独立修复）

2026-10-24 已复用受控夹具追踪全部应用，并按应用/数据库 → 模拟 Worker → 临时目录收尾；确定性断言失败注入验证无 EBUSY，见 [B07 验收](b07-verification.md)。原 16 项业务断言、超时和 Worker 替身保持，旧证据根不删除。以下为原发现记录。

2026-10-23 R04-D 定向检查发现：chatterbox.test 的应用在成功路径末尾才 close；断言提前失败时会直接进入 afterEach，后者只关 mock Worker 然后 rm 临时根。因此出现测试数据库 shm 的 EBUSY，不能把它误认作业务数据库故障或通过忽略清理失败解决。

触发它的本轮遗漏导入已修正，原 16 项业务断言重新通过；夹具生命周期问题本身尚未修复。建议独立复用 B06 受控布局与应用追踪机制，在 afterEach 先关闭每个已创建应用，再清理本测试临时根；保持全部原断言、超时和 Worker 替身不变。不得混入本轮文件名提取或清理用户存储。

首次失败留下的测试证据根为 `C:\Users\tangmy\AppData\Local\Temp\toolbox-chatterbox-uHzE5S`、`C:\Users\tangmy\AppData\Local\Temp\toolbox-chatterbox-KSXJKn`；未手动重试清理。这不是模型、签名包或用户业务数据。

## B08：差异覆盖率将已排除的声明文件误计为可执行行

后续独立修复已通过，见 [B08 验收记录](b08-verification.md)；以下保留原失败及调整证据。

2026-10-23 R05 总回归首次差异门禁为 1970/2220（88.74%），未达到原 90%。coveragePolicyFor 明确将 types.ts 声明标为非必需，main 也打印 Outside required LCOV scope；但 evaluateDiffCoverage 只在检查缺失报告时使用该策略，累计分母时未使用。因此 V8 对纯类型文件产生的零命中占位行仍被计入执行行。新增最小夹具复现：已排除 types.ts 的两条零命中 LCOV 应计 0 行，实际计 2 行。

独立质量修复与 R05 业务提取分开：统计阶段一致应用既有策略，不添加任何文件或路径豁免。AppOptions、ConfigContext 仍保守计入原覆盖范围；没有扩大排除项。对既有声明排除先做 AST 验明，普通 .ts 中存在运行时导入/赋值/函数等实现则拒绝排除，不能用 types.ts 命名隐藏业务；.d.ts 的声明合并导入按 TypeScript 不生成运行时代码的语义保留。缺失业务 LCOV 仍失败，真实未覆盖运行时代码仍计入；90% 和全局阈值不变。R05 在该门禁修复验收前不标为完成。
