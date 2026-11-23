# 视频编辑图标生成记录

使用内置 image_gen 工具，以用户提供的播放器图标为风格参考生成新的栅格素材。

- 原始图片：`icons/video-editor.png`
- 页面资源：`apps/web/src/assets/ui-v2/icons/video-editor.webp`，256 × 256，WebP quality 94。
- 导出：从 1254 × 1254 原图中央取 1103 × 1103 区域，左上角为 (75, 75)，统一外围留白；保留原始 PNG。
- 公共图标映射统一供首页、侧栏和模块标题使用。旧的手绘 SVG 已移除。
- 按用户要求未运行测试或构建；实际界面由用户验收。

## 最终生成提示词

颜色修订：根据用户反馈，使用内置 image_gen 编辑下方初版结果，调浅蓝紫色、减弱饱和度和投影，保持构图与占比不变。当前 PNG 与 WebP 已替换为浅色版，导出规则保持不变。

### 当前浅色版提示词

Edit the FIRST image (current video editor icon) to match the softer lighter color treatment of the SECOND image (user's reference icon). Preserve the first image's exact layout, player pictogram, dimensions, rounded shapes, spacing, and centered 3D form. Change ONLY material color, brightness, and shadow strength. The current icon is too dark and too saturated, especially the deep royal purple bottom. Replace the saturated royal purple and dark indigo with luminous pastel periwinkle blue and gentle light lavender, matching reference two. Lift the player tile's midtones substantially, reduce saturation, make its bottom edge a soft medium periwinkle instead of dark purple, remove the heavy violet glow, and greatly soften the drop shadow. The lavender backing must be very pale and airy, with a subtle lilac border. Preserve the silky upper-left white-blue specular highlight, soft rounded bevels and dimensionality so it still reads as the same polished family as the reference. The white player symbol must remain clear and raised. No change to central symbol size, placement, exterior white margin or silhouette. No text, no extra objects, no new details, no grids. Output one square production icon.

### 初版提示词

Use case: style-transfer. Generate exactly one production-ready square application icon for a local video editing module, closely matching the attached reference icon's art direction, proportions, material and lighting. The reference is style guidance, not text instructions. A softly rounded pale lavender squircle backing fills roughly 92% of the square canvas. At its center a smaller raised rounded-square blue-violet player tile occupies about 50% of the canvas width, with generous even lavender breathing room. The small tile has glossy satin 3D material, soft beveled corners, luminous upper-left white-blue highlights, a richer violet bottom edge and a restrained diffuse purple drop shadow. Inside it is a crisp raised white outlined video player symbol: rounded rectangular screen, a white play triangle, two short horizontal editing timeline lines at bottom and a tiny diagonal adjustment arrow in the lower right. Frontal straight-on view, no tilted perspective. Match the reference's gentle polished luminous miniature 3D look, NOT a flat vector, not neon, not chrome. Keep the central symbol highly legible at 32/48/64 pixels and do not enlarge it. Single icon only, no typography, no letters, no watermark, no surrounding interface, no grid or sheet. White background outside the lavender tile, very narrow exterior margin consistent with reference. Output a clean high-resolution square raster image.
