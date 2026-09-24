/**
 * 中文模块说明：随应用发行的内部能力包目录。正式条目要求固定资产、哈希清单和受信任签名。
 */
import type { ComponentCatalog } from "./component-manager";

// 内部使用不把许可审查作为工程门禁；仍须先产出真实 Windows 资产、内部包源地址和受信任签名。
// 目录暂时为空是因为当前没有已构建并签名的包，不能用临时链接或本机开发环境冒充正式安装资产。
export const bundledComponentCatalog: ComponentCatalog = {
  manifests: [],
  trustedPublicKeys: {}
};
