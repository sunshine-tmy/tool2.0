/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    allowGuestTransfer?: boolean;
    concurrencyLimit?: number;
  }
}
