import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("api app", () => {
  it("returns health information", async () => {
    const app = await createApp();
    const [response, live, ready] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/health" }),
      app.inject({ method: "GET", url: "/health/live" }),
      app.inject({ method: "GET", url: "/health/ready" })
    ]);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      requestId: expect.any(String),
      data: {
        status: "ok"
      }
    });
    expect(live.json()).toMatchObject({ success: true, requestId: expect.any(String), data: { status: "ok" } });
    expect(ready.json()).toMatchObject({
      success: true,
      requestId: expect.any(String),
      data: { status: "ready", database: "ok", storage: "ok" }
    });
    await app.close();
  });

  it("returns schema-stable task errors with a request id", async () => {
    const app = await createApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/tasks/missing-task" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      success: false,
      requestId: expect.any(String),
      error: { code: "TASK_NOT_FOUND", message: "Task not found" }
    });
    await app.close();
  });

  it("returns the no-login tool registry", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tools"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((tool: { id: string }) => tool.id)).toEqual([
      "image-compress",
      "image-ai",
      "lan-transfer",
      "video-text",
      "edge-tts",
      "short-video",
      "xhs-archive"
    ]);
    await app.close();
  });

  it("rejects malformed task ids and download file names at the schema boundary", async () => {
    const app = await createApp();
    const invalidTask = await app.inject({ method: "GET", url: "/api/v1/tasks/not-valid!" });
    const invalidFile = await app.inject({ method: "GET", url: "/api/v1/files/bad%0D%0Aname.txt" });

    expect(invalidTask.statusCode).toBe(400);
    expect(invalidTask.json()).toMatchObject({ success: false, error: { code: "REQUEST_INVALID" } });
    expect(invalidFile.statusCode).toBe(400);
    expect(invalidFile.json()).toMatchObject({ success: false, error: { code: "REQUEST_INVALID" } });
    await app.close();
  });

  it("exposes only whitelisted cleanup categories and rejects paths", async () => {
    const app = await createApp();
    const inspected = await app.inject({ method: "GET", url: "/api/v1/maintenance/cleanup" });
    expect(inspected.statusCode).toBe(200);
    expect(inspected.json().data.some((item: { id: string }) => item.id === "xhs-archive")).toBe(true);
    expect(inspected.json().data.some((item: { id: string }) => item.id === "build")).toBe(false);
    expect(inspected.json().data.some((item: { id: string }) => item.id === "packages")).toBe(false);

    const rejected = await app.inject({
      method: "POST",
      url: "/api/v1/maintenance/cleanup",
      payload: { ids: ["../../outside"] }
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json().error.code).toBe("CLEANUP_FAILED");
    await app.close();
  });

  it("allows CORS preflight requests for chunk upload PUT requests", async () => {
    process.env.CORS_ORIGINS = "http://192.168.1.241:5173";
    try {
      const app = await createApp();
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/tools/lan-transfer/uploads/upload-1/chunks/0",
        headers: {
          origin: "http://192.168.1.241:5173",
          "access-control-request-method": "PUT",
          "access-control-request-headers": "content-type"
        }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe("http://192.168.1.241:5173");
      expect(response.headers["access-control-allow-methods"]).toContain("PUT");
      await app.close();
    } finally {
      delete process.env.CORS_ORIGINS;
    }
  });

  it("does not reflect untrusted origins", async () => {
    process.env.CORS_ORIGINS = "http://127.0.0.1:5173";
    try {
      const app = await createApp();
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/health",
        headers: { origin: "https://attacker.example" }
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      await app.close();
    } finally {
      delete process.env.CORS_ORIGINS;
    }
  });

  it("fails fast when numeric environment configuration is invalid", async () => {
    process.env.API_PORT = "not-a-port";
    try {
      await expect(createApp()).rejects.toThrow(/API_PORT/);
    } finally {
      delete process.env.API_PORT;
    }
  });

  it("requires an administrator session, exact origin and CSRF token in LAN mode", async () => {
    process.env.DEPLOYMENT_MODE = "lan";
    process.env.ADMIN_PIN = "123456";
    process.env.CORS_ORIGINS = "http://192.168.1.10:5173";
    try {
      const app = await createApp();
      const denied = await app.inject({ method: "POST", url: "/api/v1/maintenance/cleanup", payload: { ids: [] } });
      expect(denied.statusCode).toBe(401);

      const login = await app.inject({
        method: "POST",
        url: "/api/v1/session",
        payload: { pin: "123456" }
      });
      expect(login.statusCode).toBe(200);
      const setCookie = login.headers["set-cookie"]!;
      const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie).split(";", 1)[0];
      const csrfToken = login.json().data.csrfToken;
      const restored = await app.inject({ method: "GET", url: "/api/v1/session", headers: { cookie } });
      expect(restored.statusCode).toBe(200);
      expect(restored.json().data.csrfToken).toBe(csrfToken);

      const csrfDenied = await app.inject({
        method: "POST",
        url: "/api/v1/maintenance/cleanup",
        headers: { cookie },
        payload: { ids: [] }
      });
      expect(csrfDenied.statusCode).toBe(403);

      const allowed = await app.inject({
        method: "POST",
        url: "/api/v1/maintenance/cleanup",
        headers: { cookie, origin: "http://192.168.1.10:5173", "x-csrf-token": csrfToken },
        payload: { ids: [] }
      });
      expect(allowed.statusCode).not.toBe(401);
      expect(allowed.headers["x-request-id"]).toBeTruthy();
      await app.close();
    } finally {
      delete process.env.DEPLOYMENT_MODE;
      delete process.env.ADMIN_PIN;
      delete process.env.CORS_ORIGINS;
    }
  });

  it("validates administrator login input before authentication", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/session",
      payload: { pin: "123", unexpected: true }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: "REQUEST_INVALID" },
      requestId: expect.any(String)
    });
    await app.close();
  });

  it("uses the current request id for every error envelope", async () => {
    const app = await createApp();
    const notFound = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });
    const invalid = await app.inject({ method: "POST", url: "/api/v1/session", payload: { pin: "123" } });

    expect(notFound.statusCode).toBe(404);
    expect(notFound.headers["x-request-id"]).toBeTruthy();
    expect(notFound.json()).toMatchObject({
      success: false,
      message: expect.any(String),
      error: { code: "ROUTE_NOT_FOUND", message: expect.any(String) },
      requestId: notFound.headers["x-request-id"]
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.headers["x-request-id"]).toBeTruthy();
    expect(invalid.json()).toMatchObject({
      success: false,
      message: expect.any(String),
      error: { code: "REQUEST_INVALID", message: expect.any(String) },
      requestId: invalid.headers["x-request-id"]
    });
    await app.close();
  });
});
