# 独角兽 Logo · v1

用于电商工具箱的 Logo 设计稿。提取现有独角兽的金色螺旋角、粉绿鬃毛、大眼睛和薄荷色翅膀，以浅紫色立体圆角底座配合应用主题。

## 文件

- `unicorn-logo-master.png`：1254 × 1254 透明母版，仅保留本地。
- `unicorn-logo-1024.webp`：高清透明 WebP。
- `unicorn-logo-{32,48,64,128,256,512,1024}.png`：常用尺寸 PNG，仅保留本地。
- `size-preview.png`：256、64、48、32 px 尺寸检查图，仅保留本地。
- `apps/web/src/assets/ui-v2/brand-unicorn-v1.webp`：256 px 前端候选素材。

本轮交付设计素材，尚未替换应用顶部、网站图标及桌面安装包图标。现有品牌素材保留。

已检查透明通道、资源尺寸及缩小后的可辨识度；未启动应用、业务模型或执行功能测试。PNG 母版和预览遵循仓库现有忽略规则，不进入源码提交。

## 生成记录

使用内置 imagegen，参考本地 `docs/design/ui-v2/mascot-source/unicorn-master.png`。使用 Sharp 导出尺寸与格式，未新增依赖。

实际生成提示词：

> Use case: logo-brand. Create ONE finished square app logo, not a mockup or collage, based on the provided unicorn character reference. A polished soft 3D rounded-square icon tile, pale lavender #F0EDFF with a restrained violet lower bevel. Transparent outside the rounded tile, no backdrop or external shadow. Center a compact friendly unicorn HEAD ONLY, filling about 78 percent of the tile: lavender face, big glossy black eyes, small smile, gold spiral horn, bold pink and mint forelock, small ears, tiny mint wing accents. Preserve the reference's cute identity but simplify for a desktop multimedia productivity toolbox. Frontal and balanced, generous safe padding, soft dimensional highlights. No body, no feet, no text, no lettering, no sparkles, no tiny strands, no heavy glow or dark saturated purple. Clean alpha edges and a strong readable silhouette at 32 pixels. 1024x1024.
