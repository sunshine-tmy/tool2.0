# 设计资源维护

更新日期：2026-11-24。

正式图标使用 `apps/web/src/assets/ui-v2/icons/` 中的 256×256 WebP，首页、侧栏、模块标题和独立评审页共用资源。正式首页插画由 `HomeHeroArtwork.vue` 引用 `hero-ecommerce-assistant-refined.webp`。保留现有图案、颜色、构图、透明通道及留白，不以压缩名义重新设计。

采用 UI UX Pro Max 的图像优化建议，使用与显示用途匹配的尺寸和 WebP 格式；图标外观继续服从本项目 toolbox-ui 规范，不替换为其他图标风格。此次没有 3D 模型资源，不应用检索结果中的模型压缩建议。

设计效果图位于 `screens/*.webp`，历史样机插画为 `hero.webp`。这些预览以 WebP quality 90 编码，保持原始尺寸和构图。`screens.js`、`screen-manifest.json` 及设计规范链接指向预览，评审页可以继续直接打开，不依赖项目外文件。

被预览替代的 33 个高分辨率 PNG，以及不再引用的 4 个运行时插画已清理。现行资源的生成提示词保留；各清单中的 `originalFilename`、`originalSha256` 是历史来源，不是当前资源地址。三个停用插画/品牌方案的独立 JSON 已合并到 [历史摘要](../../history-summary.md#retired-images)，不再保留无图片引用的独立记录。当前资源地址使用 `file` 或 `webFile`。

视频编辑图标原先使用 `.webp` 后缀，但内容实际为 1254×1254 PNG。本次将实际在用的完整画布等比缩至 256×256，并编码为 WebP quality 94；没有使用历史裁切方案，也未重新生成或调色。

后续生成的大尺寸原图放到项目外或本地 `.package/`，不提交到源码。设计目录的 PNG 已加入 Git 忽略规则。需要保留到仓库的预览先转为 WebP，更新以下记录：

- `asset-manifest.json`：图标提示词、来源与当前文件映射。
- `screen-manifest.json`：效果图提示词、来源与预览映射。
- `icon-checks.json`：历史源图元数据及当前 WebP 尺寸、大小。
- `implementation-assets.json`：实际运行时图片、大小及 SHA256。
- `asset-optimization.json`：本次移除文件、衍生预览及体积变化。

本次只处理资源编码和静态引用，没有执行功能测试、浏览器截图、类型检查或构建。历史验收文档里的 PNG 摘要仅适用于当时的源图，不能用于校验当前 WebP。

从当前提交移除图片不会自动删除 Git 历史里的旧对象。此次不重写提交历史；本地 Git 对象维护与未来的历史瘦身应分开处理。
