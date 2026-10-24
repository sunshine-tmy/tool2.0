/** Application assembly step; called directly on the original Fastify instance. */
import fastify from "fastify";
import { LOG_REDACTION_PATHS } from "../security/log-sanitization";

export function createServer() {
  return fastify({
    logger:
      process.env.NODE_ENV === "test"
        ? false
        : {
            level: process.env.LOG_LEVEL?.trim() || "info",
            redact: {
              paths: [...LOG_REDACTION_PATHS],
              censor: "[REDACTED]"
            }
          },
    bodyLimit: 1024 * 1024,
    requestIdHeader: "x-request-id"
  });
}
