# Windows 桌面应用图标实施记录

阶段：7（原创图标与安装产物接入）
设计概念：折板星。两片蓝色与青绿色折板形成工具模块容器，中心四角负形表现组合产出；沿用阶段 1 的已确认主稿，不改变品牌方向、应用 ID 或更新识别信息。

## 图像资产

唯一母稿位于 `apps/desktop/assets/ecommerce-toolbox-icon-master.png`，实际尺寸 1254 × 1254 px，保留透明背景。由其可见 alpha 边界生成以下同源优化尺寸，避免原图透明留白在任务栏小图标里进一步缩小主体：

- `ecommerce-toolbox-icon-16.png`
- `ecommerce-toolbox-icon-24.png`
- `ecommerce-toolbox-icon-32.png`
- `ecommerce-toolbox-icon-48.png`
- `ecommerce-toolbox-icon-256.png`
- `ecommerce-toolbox.ico`（上述五种 PNG 编码尺寸）
- `ecommerce-toolbox-icon-master-1024.png`（保留母稿构图的 1024 px 透明主稿导出）

用 `pnpm desktop:icons` 可从母稿确定性地重新生成桌面 PNG、ICO，以及 `frontend/public` 中网页使用的 favicon 和品牌图。Windows ICO 写入脚本会检查 PNG 尺寸、ICO 目录、位深、偏移及 256 px 特殊尺寸编码。

## 接入点

- `@electron/packager` 为 `EcommerceToolbox.exe` 写入 ICO 资源。
- `electron-builder` 的 Windows / NSIS 配置将同一 ICO 用于安装器与卸载器；程序 ID 继续是 `com.ecommercetoolbox.desktop`。
- 数据迁移窗口和主窗口显式指定 ICO；Windows AppUserModelID 与现有快捷方式规则不变。
- Web favicon 使用多尺寸 ICO 与 32 px PNG；顶栏品牌图使用透明 32 px PNG，不再显示 Lucide `Boxes`。

## 验收

运行 `pnpm desktop:icons` 及 `pnpm test:scripts`；以 `pnpm desktop:make` 验证 Windows 程序、NSIS 安装器/卸载器能够载入图标，并以 `pnpm desktop:build` 验证 Web/主进程打包。小尺寸验收检查 16/32 px 透明边缘、主体辨识度和中心负形；真实 Windows 干净虚机的安装向导、资源管理器、任务栏、开始菜单截图作为发布验收记录。
