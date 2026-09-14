import "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    allowGuestTransfer?: boolean;
  }
}
