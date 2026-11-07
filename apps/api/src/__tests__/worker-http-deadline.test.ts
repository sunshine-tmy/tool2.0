/** Real loopback requests: inference deadlines must override fetch's independent response timers. */
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { Agent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestWorkerHttp } from "../core/workers/http-transport";
import { getConfig } from "../config";
import { createVideoAiWorkerClient } from "../domains/video-ai/worker-client";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function startWorker(handle: (response: ServerResponse) => void) {
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    expect(request.headers["x-toolbox-worker-token"]).toBe("deadline-test-token");
    request.resume();
    handle(response);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, sockets };
}

function endLater(response: ServerResponse, milliseconds: number, body: string) {
  const timer = setTimeout(() => response.end(body), milliseconds);
  response.once("close", () => clearTimeout(timer));
}

class TransportError extends Error {}
function request(url: string, timeoutMs = 8000, signal?: AbortSignal) {
  return requestWorkerHttp({
    pathname: "/process",
    init: { method: "POST", signal },
    timeoutMs,
    getBaseUrl: () => url,
    getToken: () => "deadline-test-token",
    validate: (data): data is { finished: true } =>
      typeof data === "object" && data !== null && "finished" in data && data.finished === true,
    errors: {
      owns: (error) => error instanceof TransportError,
      http: () => new TransportError("worker failure"),
      invalid: () => new TransportError("invalid response"),
      aborted: (interrupted) => new TransportError(interrupted ? "interrupted" : "deadline"),
      unavailable: () => new TransportError("unavailable")
    }
  });
}

describe("Worker response deadlines", () => {
  it.each(["headers", "body"] as const)(
    "waits for slow %s without inheriting the global dispatcher timeout and releases sockets",
    async (part) => {
      const original = getGlobalDispatcher();
      const impatient = new Agent({ headersTimeout: 100, bodyTimeout: 100 });
      setGlobalDispatcher(impatient);
      cleanups.push(async () => {
        setGlobalDispatcher(original);
        await impatient.destroy();
      });
      const { url, sockets } = await startWorker((response) => {
        if (part === "body") {
          response.writeHead(200, { "content-type": "application/json" });
          response.write('{"success":true,"data":');
          endLater(response, 2500, '{"finished":true}}');
        } else endLater(response, 2500, '{"success":true,"data":{"finished":true}}');
      });
      // Control uses the old transport's ordinary fetch path. Shorten its timer
      // so this regression exercises the real parser without a five-minute CI wait.
      const control = fetch(url + "/process", {
        method: "POST",
        headers: { "x-toolbox-worker-token": "deadline-test-token" }
      })
        .then((response) => response.json())
        .catch((error: unknown) => error);
      await expect(request(url)).resolves.toEqual({ finished: true });
      expect(await control).toMatchObject({
        cause: { code: part === "headers" ? "UND_ERR_HEADERS_TIMEOUT" : "UND_ERR_BODY_TIMEOUT" }
      });
      await vi.waitFor(() => expect(sockets.size).toBe(0));
      expect(getGlobalDispatcher()).toBe(impatient);
    }
  );

  it.each(["headers", "body"] as const)("still enforces the whole-request deadline during %s", async (part) => {
    const { url, sockets } = await startWorker((response) => {
      if (part === "body") response.write('{"success":true,"data":');
      endLater(response, 1000, "{}");
    });
    await expect(request(url, 100)).rejects.toThrow("deadline");
    await vi.waitFor(() => expect(sockets.size).toBe(0));
  });

  it("preserves external interruption during body reading instead of reporting invalid JSON", async () => {
    const external = new AbortController();
    const { url, sockets } = await startWorker((response) => {
      response.write('{"success":true,"data":');
      const abort = setTimeout(() => external.abort(), 50);
      response.once("close", () => clearTimeout(abort));
    });
    await expect(request(url, 8000, external.signal)).rejects.toThrow("interrupted");
    await vi.waitFor(() => expect(sockets.size).toBe(0));
  });

  it("does not tell users to install a capability when an established video request loses its connection", async () => {
    const { url } = await startWorker((response) => response.destroy());
    const config = getConfig({ dotenvPath: false, environment: { NODE_ENV: "test" } });
    config.videoAiWorkerUrl = url;
    config.videoAiWorkerToken = "deadline-test-token";
    const client = createVideoAiWorkerClient(config);
    await expect(
      client.process({
        mode: "balanced",
        inputPath: "input.mp4",
        outputPath: "output.mp4",
        progressPath: "progress.json",
        cancelFlagPath: "cancel.flag"
      })
    ).rejects.toMatchObject({ code: "VIDEO_AI_WORKER_UNAVAILABLE", message: "视频处理连接中断，请检查运行诊断后重试" });
    await expect(client.health()).rejects.toMatchObject({
      code: "VIDEO_AI_WORKER_UNAVAILABLE",
      message: "无法连接视频处理服务，请检查能力状态和运行诊断"
    });
  });
});
