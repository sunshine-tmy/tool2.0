---
name: toolbox-ui
description: Apply this repository's blue-violet UI system when designing or refining its multimedia tool pages, shared controls, navigation, and responsive layouts. Use with ui-ux-pro-max for design guidance; not for backend or model changes.
---

# 电商工具箱 UI 使用约束

本项目是本地多媒体素材工作台，不是商城或营销落地页。

先读项目根目录 [design.md](../../../design.md)，需要组件细节时读
[公共组件规范](../../../docs/design/ui-v2/component-specs.md)。用户的后续明确决定优先。

- 技术栈是 Vue 3、Naive UI、Lucide、CSS 语义变量，桌面外壳为 Electron。优先复用现有组件，不另起平行主题。用户已允许为移动端优化增加确有必要的依赖；增加前记录现有能力不足的证据、收益、体积和许可证影响，不因检索推荐就安装。此许可不意味着更换技术栈、引入联网字体或修改模型环境。
- 保留蓝紫浅色方向、系统中文字体、现有独立模块图标和原创插画。普通操作用线性图标；不因 Skill 的通用 SVG 建议替换已批准的栅格品牌资产。
- 先核验 Git 工作区，保留未提交修改；先审查，再改规范，再做单模块试点。图片压缩试点后，用户已授权全局推广；沿用已确认方向，逐职责检查，不重复请求推广许可。
- 页面尺寸看模块实际可用宽度；保留桌面模块侧栏、手机菜单和头部浮层边界。不要把首页目录布局套进视频或音频编辑器。
- 上传限制、API、队列、取消、留档、TTL、删除确认、分组及原片/结果保留均不随 UI 调整。未画出的操作不能删除。
- 不更改模型、Python 依赖、签名包。未经要求不制作安装包、提交、推送或发布。
- 当前用户要求不截图、不过度执行测试/类型检查/构建；小型 UI 改动用必要静态或定向检查，视觉和设备验收明确留给用户。

## 使用 UI UX Pro Max

先读取已安装的 `ui-ux-pro-max/SKILL.md`。其默认安装位于用户 Codex skills 目录，
本项目不捆绑该第三方工具，也不把它加入运行时依赖。

已有系统优化用具体 `--domain ux` 查询；Vue 实现用 `--stack vue`，查询不含业务数据。
用 Skill 目录中的绝对路径运行 `scripts/search.py`。安装和检索证据见
[审查报告](../../../docs/design/ui-v2/ui-ux-pro-max-audit.md)。

逐条判断结果与项目是否匹配：采纳、调整或拒绝，并说明理由。零结果只重试一次，
不能把一般经验称为数据库命中。新页面也先沿用项目规范，不覆盖 `design.md`，
不通过 `--persist` 另建 MASTER 作为平行权威。

44pt、48dp 和 CSS px 不混用：桌面紧凑控件可用 32px，触控主要目标按项目规范扩大至 44 CSS px。
不机械应用 16px 全站字号、暗色主题、Google Fonts 或落地页模板。

交付列明改动范围、保留行为、执行检查、未验证项目。全局推广保留模块专属工作流，不新增快捷定位；实屏与设备效果由用户验收。
