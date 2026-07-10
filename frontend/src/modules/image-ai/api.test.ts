import { afterEach, describe, expect, it, vi } from "vitest";
import { resultDownloadUrl, triggerImageAiDownload } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("image ai downloads", () => {
  it("requests attachment disposition for individual PNG results", () => {
    expect(resultDownloadUrl("/api/tools/image-ai/tasks/task/files/result")).toBe(
      "/api/tools/image-ai/tasks/task/files/result?download=1"
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

    triggerImageAiDownload("/api/tools/image-ai/tasks/task/files/result?download=1");

    expect(anchor.href).toBe("/api/tools/image-ai/tasks/task/files/result?download=1");
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
  });
});

