/**
 * 中文模块说明：测试 frontend/src/modules/image-ai/api.test.ts 中的稳定行为、边界条件和回归场景
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageAiTaskSchema } from "@toolbox/shared";
import { imageAiApi, resultDownloadUrl, triggerImageAiDownload } from "./api";

const httpMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("image ai downloads", () => {
  // API 合约集中验证健康检查、建议图、任务查询和取消，防止单个端点遗漏 Schema 或超时配置。
  it("delegates health, suggestion, task lookup and task cancellation operations", async () => {
    for (const method of Object.values(httpMock)) method.mockResolvedValue({});
    const file = new File(["image"], "input.png", { type: "image/png" });
    const taskForm = new FormData();

    await imageAiApi.health();
    await imageAiApi.suggestions(file);
    await imageAiApi.createTask(taskForm);
    await imageAiApi.getTask("task-1");
    await imageAiApi.cancelTask("task-1");

    expect(httpMock.post).toHaveBeenCalledWith("/tools/image-ai/tasks", ImageAiTaskSchema, taskForm, {
      timeout: 220000
    });
    expect(httpMock.get).toHaveBeenCalledWith("/tools/image-ai/tasks/task-1", ImageAiTaskSchema);
    expect(httpMock.delete).toHaveBeenCalledWith("/tools/image-ai/tasks/task-1", ImageAiTaskSchema);
  });

  it("requests attachment disposition for individual PNG results", () => {
    expect(resultDownloadUrl("/api/v1/tools/image-ai/tasks/task/files/result")).toBe(
      "/api/v1/tools/image-ai/tasks/task/files/result?download=1"
    );
  });

  it("triggers a browser download from a single button click without opening a new tab", () => {
    const anchor = {
      href: "",
      style: { display: "" },
      click: vi.fn(),
      remove: vi.fn()
    };
    const appendChild = vi.fn();
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { appendChild }
    });

    triggerImageAiDownload("/api/v1/tools/image-ai/tasks/task/files/result?download=1");

    expect(anchor.href).toBe("/api/v1/tools/image-ai/tasks/task/files/result?download=1");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
  });
});
