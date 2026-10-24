/**
 * 中文模块说明：测试 apps/api/src/__tests__/xhs-translation-service.test.ts 中的稳定行为、边界条件和回归场景
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { XhsArchiveItem } from "@toolbox/shared";
import { getConfig } from "../config";
import type { XhsArchiveStore } from "../domains/content-archive/compat/xhs/store";
import { XhsTranslationService } from "../domains/content-archive/compat/xhs/translation-service";
import type { XhsTranslationRuntime } from "../domains/content-archive/core/translation-runtime";
import type { TaskStore } from "../tasks/task-store";

afterEach(() => {
  delete process.env.STORAGE_ROOT;
});

describe("xhs translation recovery", () => {
  it("marks interrupted translation states as failed without deleting the archive", async () => {
    process.env.STORAGE_ROOT = "xhs-translation-recovery-test";
    const item = {
      id: "archive-1",
      translation: { status: "translating" }
    } as unknown as XhsArchiveItem;
    const updateTranslation = vi.fn(async (_id: string, updater: (value: XhsArchiveItem) => XhsArchiveItem) =>
      updater(item)
    );
    const store = {
      list: vi.fn().mockResolvedValue({ items: [item], pageCount: 1 }),
      updateTranslation
    } as unknown as XhsArchiveStore;
    const runtime = { stop: vi.fn() } as unknown as XhsTranslationRuntime;
    const taskStore = { upsert: vi.fn() } as unknown as TaskStore;
    const service = new XhsTranslationService(getConfig(), store, runtime, taskStore);

    await service.recoverInterrupted();

    expect(updateTranslation).toHaveBeenCalledOnce();
    const recovered = updateTranslation.mock.results[0]?.value;
    await expect(recovered).resolves.toMatchObject({
      translation: {
        status: "failed",
        error: { code: "XHS_TRANSLATION_INTERRUPTED" }
      }
    });
    expect(item.id).toBe("archive-1");
  });
});
