import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveMusicLibraryApi } from "./music";
import { audioLibraryApi } from "../api";
vi.mock("../api", () => ({ audioLibraryApi: { list: vi.fn(), upload: vi.fn(), item: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe("归档配乐素材查询范围", () => {
  it("默认仅查询背景音乐", async () => {
    await archiveMusicLibraryApi.list();
    expect(audioLibraryApi.list).toHaveBeenCalledWith({ view: "music" }, undefined);
  });
  it.each([undefined, "all", "music", "speech", "trash"])(
    "任何来源的 %s 查询均限制为背景音乐，保留搜索分页和取消信号",
    async (view) => {
      const controller = new AbortController();
      const params = { view, keyword: "测试", page: 2, groupId: "group123", pageSize: 20 };
      await archiveMusicLibraryApi.list(params, controller.signal);
      expect(audioLibraryApi.list).toHaveBeenCalledWith({ ...params, view: "music" }, controller.signal);
      expect(params.view).toBe(view);
    }
  );
});
