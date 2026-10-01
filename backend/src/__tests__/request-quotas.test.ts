/**
 * 中文模块说明：测试 backend/src/__tests__/request-quotas.test.ts 中的稳定行为、边界条件和回归场景
 */
import fastify from "fastify";
import { get } from "node:http";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { registerConcurrencyQuotas } from "../security/request-quotas";

describe("request concurrency quotas", () => {
  it("动态参数共用同一路由并发桶，不同路由相互隔离", async () => {
    const app = fastify({ logger: false });
    registerConcurrencyQuotas(app);
    let unblock!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    app.get("/items/:id", { config: { concurrencyLimit: 1 } }, async (request) => {
      if (request.params && (request.params as { id?: string }).id === "first") {
        entered();
        await blocked;
      }
      return { success: true };
    });
    app.get("/other/:id", { config: { concurrencyLimit: 1 } }, () => ({ success: true }));
    await app.ready();

    try {
      const first = app.inject("/items/first");
      await started;
      expect((await app.inject("/items/second")).statusCode).toBe(429);
      expect((await app.inject("/other/first")).statusCode).toBe(200);
      unblock();
      expect((await first).statusCode).toBe(200);
      expect((await app.inject("/items/second")).statusCode).toBe(200);
    } finally {
      unblock();
      await app.close();
    }
  });

  it("处理器异常后释放并发额度，后续请求可以继续", async () => {
    const app = fastify({ logger: false });
    registerConcurrencyQuotas(app);
    let calls = 0;
    app.get("/unstable", { config: { concurrencyLimit: 1 } }, async () => {
      calls += 1;
      if (calls === 1) throw new Error("simulated handler failure");
      return { success: true };
    });
    await app.ready();

    expect((await app.inject("/unstable")).statusCode).toBe(500);
    expect((await app.inject("/unstable")).statusCode).toBe(200);
    expect(calls).toBe(2);
    await app.close();
  });

  it("播放中断释放流式额度，重复断连不会耗尽或重复释放", async () => {
    const app = fastify();
    registerConcurrencyQuotas(app);
    const streams: PassThrough[] = [];
    const closed: Promise<void>[] = [];
    app.get("/stream", { config: { concurrencyLimit: 1 } }, (_request, reply) => {
      const stream = new PassThrough();
      streams.push(stream);
      closed.push(new Promise((resolve) => reply.raw.once("close", resolve)));
      reply.type("application/octet-stream").send(stream);
      stream.write("video-data");
    });
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    try {
      for (let index = 0; index < 3; index++) {
        await new Promise<void>((resolve, reject) => {
          const request = get(`${origin}/stream`, (response) => {
            if (response.statusCode !== 200) {
              response.resume();
              reject(new Error(`流式请求返回 ${response.statusCode}`));
              return;
            }
            response.once("data", () => {
              response.destroy();
              resolve();
            });
          });
          request.once("error", reject);
        });
        // 等待服务端观察真实 TCP 断连，而不是只模拟正常 inject 响应或固定睡眠。
        await closed[index];
      }
      expect(streams).toHaveLength(3);
      const active = get(`${origin}/stream`);
      const response = await new Promise<import("node:http").IncomingMessage>((resolve) =>
        active.once("response", resolve)
      );
      expect(response.statusCode).toBe(200);
      expect((await app.inject("/stream")).statusCode).toBe(429);
      response.destroy();
    } finally {
      for (const stream of streams) stream.destroy();
      await app.close();
    }
  });
  it("客户端提前断连不能释放尚未完成的耗时处理器额度", async () => {
    const app = fastify();
    registerConcurrencyQuotas(app);
    let unblock!: () => void;
    let entered!: () => void;
    let finished!: () => void;
    let disconnect!: () => void;
    const blocked = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const completed = new Promise<void>((resolve) => {
      finished = resolve;
    });
    const disconnected = new Promise<void>((resolve) => {
      disconnect = resolve;
    });
    app.addHook("onSend", async (_request, reply, payload) => {
      if (reply.statusCode === 200) finished();
      return payload;
    });
    app.get("/work", { config: { concurrencyLimit: 1 } }, async (_request, reply) => {
      reply.raw.once("close", disconnect);
      entered();
      await blocked;
      return { success: true };
    });
    const origin = await app.listen({ host: "127.0.0.1", port: 0 });
    try {
      const request = get(`${origin}/work`);
      request.on("error", () => undefined);
      await started;
      request.destroy();
      await disconnected;
      expect((await app.inject("/work")).statusCode).toBe(429);
      unblock();
      await completed;
      await new Promise((resolve) => setImmediate(resolve));
      expect((await app.inject("/work")).statusCode).toBe(200);
    } finally {
      unblock();
      await app.close();
    }
  });
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
