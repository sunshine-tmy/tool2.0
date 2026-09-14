import fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerConcurrencyQuotas } from "../security/request-quotas";

describe("request concurrency quotas", () => {
  it("returns the stable 429 contract and releases capacity after completion", async () => {
    const app = fastify();
    registerConcurrencyQuotas(app);
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    app.get("/limited", { config: { concurrencyLimit: 1 } }, async () => {
      await blocked;
      return { success: true };
    });
    await app.ready();

    const first = app.inject({ method: "GET", url: "/limited" });
    await new Promise((resolve) => setImmediate(resolve));
    const rejected = await app.inject({ method: "GET", url: "/limited" });
    expect(rejected.statusCode).toBe(429);
    expect(rejected.json()).toMatchObject({
      success: false,
      error: { code: "CONCURRENCY_LIMIT_EXCEEDED" }
    });

    release?.();
    expect((await first).statusCode).toBe(200);
    const afterRelease = app.inject({ method: "GET", url: "/limited" });
    await new Promise((resolve) => setImmediate(resolve));
    release?.();
    expect((await afterRelease).statusCode).toBe(200);
    await app.close();
  });
});
