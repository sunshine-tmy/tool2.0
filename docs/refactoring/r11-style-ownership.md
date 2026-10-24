# R11：样式归属与级联约束

这是一轮等效迁移，不是视觉设计。完整级联的规则、声明、层级和顺序，以迁移前工作区生成的 `r11-style-contracts.json` 为准，不以未包含 R00–R10 修改的 HEAD 文件替代。

## 加载方式

根入口仍为 `apps/web/src/styles/index.css`：`@layer tokens, foundation, components`，依次加载 tokens.css、global.css、redesign.css。两份原大文件保留为有序导入清单；已有消费者和层级不变，不维护第二套规则副本。

global.css 的 foundation 顺序：document → shell → AI 图片 → home → controls → 图片压缩 → LAN → shared-actions → speech → responsive。
redesign.css 的 components 顺序：document → shell → controls → home → services → image-tools → LAN → AI 图片 → speech → download-actions → route-states → responsive。

这是原文件连续区段的顺序，不是按文件名排序。不得因某段同时引用其他 feature 的兼容选择器而跨段重排。

## 目录

| 位置                              | 归属                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `styles/tokens.css`               | 原全部变量与 reduced-motion 规则；无需额外空目录                              |
| `styles/foundation/`              | 原文档默认、Shell 布局、公共控件/操作与跨领域响应式基础规则                   |
| `styles/components/`              | 原视觉层的文档、Shell、控件、服务状态、下载按钮、路由失败/加载及响应式覆盖    |
| `styles/features/home-*.css`      | 首页在两个原层中的对应连续区段                                                |
| `features/image-ai/styles/`       | AI 图片页面在 foundation/components 中的原全局规则                            |
| `features/image-compress/styles/` | 压缩在 foundation 中的区段；跨图片工具视觉规则留在 components/image-tools.css |
| `features/lan-transfer/styles/`   | LAN 在两个原层中的区段                                                        |
| `features/speech/shared/styles/`  | 两个配音引擎共同使用的两个原层区段                                            |

feature 文件仍经根有序清单加载，保持原全局可见性；没有改为懒加载或 scoped。现有 SFC scoped 块和 ChatterboxPanel.css 已属于各自 feature，本轮不转换它们的编译语义，也不迁移 Vue 模板和状态。

混合多个领域的媒体/容器查询保留在原层的 responsive.css，内部规则顺序不变。共享操作规则在原位置分段保留，不能为减少文件数把它提前或后移。

## 冗余审查

只将同一 selector、同一声明序列、同一完整祖先 layer/media/container 等条件下的完全重复规则列为候选。本次扫描完整展开级联，未发现此类重复。名称接近、前后覆盖、跨层相同属性和混合兼容选择器不构成删除依据。

没有用未覆盖全部动态状态的 class 字符串搜索来删除规则；没有将样式文件变短当作性能收益。旧全局大文件的 Prettier 特例在变为导入清单后移除，新分片均接受既有格式门禁。

## 验证与后续修改

工程测试自动发现 `tooling/quality/styles.test.mjs`。检查完整展开后的规范化 CSS 指纹及原计数，并以故意改变顺序、important、层级和媒体条件的夹具证明检查会拒绝不等效修改。没有在迁移后重算冻结摘要接受差异。

原始/文本摘要仍保留作历史证据；结构指纹从已逐项验证这些摘要的原始输入派生。它保留字符串内空格、后代 selector、声明顺序、important 和全部条件，忽略排版换行及函数括号/逗号旁无意义空格。四份原始输入另与固定基线的 `frontend/src/styles/*` 比对（仅规范 CRLF），全部匹配，可从该提交复现，不依赖删除临时文件后的记忆。

Vite 默认会为每个导入片段重复生成同名层块，并增加冗余单层注册语句。`apps/web/tooling/style-layers.ts` 是仅用于本 workspace 的 PostCSS 构建适配：只有先遇到原 `tokens, foundation, components` 完整顺序后，才删除已由该顺序声明的 foundation/components 单层注册，合并其相邻同名块；匿名/其他层、媒体查询及未分层规则都是边界，不跨越。保留注释，内部声明和条件不重排。它没有新增依赖，也不进入页面运行代码。

这一步有 5 项专门测试，并显式纳入 Web LCOV 与 90% 差异覆盖率范围。普通构建后的九个 CSS 文件（包括主入口）已与迁移前逐字节一致；不是把产物体积变大视为无关差异，也没有提高原分包预算。

独立浏览器配置 `playwright.styles.config.ts` 使用原组件和页面，客户端替身拦截所有 API 请求。仅模拟既有 idle playback 心跳；所有业务写请求仍失败并计入断言，不连接实际后端、模型或桌面 IPC。

每个宽度有 19 张截图：1920、1440、1024、768 高度 1000；375 高度 812。合计 95 张，包括六个入口、首页、菜单、长文件名、AI 侧栏/历史/详情、商品编辑器/颜色弹层/背景上传、设置和诊断。

基线创建要求原四份 CSS 的原始摘要完全匹配，wx 禁止覆盖；compare 只读基线，逐 PNG 字节比较，差异时保存 actual 并失败，没有 tolerance 或 update-snapshots 通道。先在未迁移源码上重复验证，再应用迁移，避免把控件动画/弹层时机当作迁移差异。

验收时的本地证据位于被忽略的 output/playwright，具体有效基线路径与结果见 R11 实施记录。2026-10-24 用户验收完成后，已按要求清理这些截图和临时输出，见 [清理记录](r12-verification.md#验收后临时资源清理2026-10-24)。普通 E2E/CI 不依赖未提交的二进制截图，CSS 源码契约继续保留并检查。以下历史截图 compare 命令仅适用于另有当时基线备份、且使用同一浏览器的情况：

```powershell
$env:R11_STYLE_BASELINE = '<实施记录中的绝对基线目录>'
$env:R11_STYLE_MODE = 'compare'
pnpm exec playwright test --config playwright.styles.config.ts
```

新电脑若没有本地历史截图，不应在已迁移源码上创建“迁移前”截图；应保留源码契约和普通 E2E 门禁，并明确该历史截图验收未在该机器复跑。新设计需要单独评审和建立自己的新基线，不能通过覆盖 R11 基线混入本次等效迁移。
