import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("api app", () => {
  it("returns health information", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        status: "ok"
      }
    });
  });

  it("returns the no-login tool registry", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/tools"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((tool: { id: string }) => tool.id)).toEqual([
      "image-compress",
      "image-ai",
      "lan-transfer",
      "video-text",
      "edge-tts",
      "short-video"
    ]);
  });

  it("allows CORS preflight requests for chunk upload PUT requests", async () => {
    process.env.CORS_ORIGINS = "http://192.168.1.241:5173";
    try {
      const app = await createApp();
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/tools/lan-transfer/uploads/upload-1/chunks/0",
        headers: {
          origin: "http://192.168.1.241:5173",
          "access-control-request-method": "PUT",
          "access-control-request-headers": "content-type"
        }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe("http://192.168.1.241:5173");
      expect(response.headers["access-control-allow-methods"]).toContain("PUT");
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
        url: "/api/health",
        headers: { origin: "https://attacker.example" }
      });

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
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
});
