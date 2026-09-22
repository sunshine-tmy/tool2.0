/**
 * 中文模块说明：随应用发行的能力包目录。实际条目只能在许可证、SBOM、签名密钥和再分发条件审核后加入。
 */
import type { ComponentCatalog } from "./component-manager";

// 当前没有已获准再分发的第三方 Worker 或模型。保留空目录比把未经审核的下载地址交给客户端更安全；
// 后续阶段会为每一个审核通过的能力包添加已签名 manifest 和对应公钥。
export const bundledComponentCatalog: ComponentCatalog = {
  manifests: [],
  trustedPublicKeys: {}
};
