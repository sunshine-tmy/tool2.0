// @vitest-environment happy-dom
import { mount, shallowMount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Cover from "./ArchiveVideoCover.vue";
import Picker from "./ArchiveSourcePicker.vue";
import { loadVideoCover } from "./video-cover";
import { contentArchiveApi } from "./content-api";
vi.mock("./video-cover", () => ({ loadVideoCover: vi.fn() }));
vi.mock("./content-api", () => ({
  contentArchiveApi: { list: vi.fn() },
  archiveGroupApi: { list: vi.fn(async () => []) }
}));
const wrappers: VueWrapper[] = [];
let visibility: (entries: { isIntersecting: boolean }[]) => void;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof visibility) {
        visibility = callback;
      }
      observe() {
        visibility([{ isIntersecting: true }]);
      }
      disconnect() {}
    }
  );
});
afterEach(() => {
  for (const wrapper of wrappers) wrapper.unmount();
  wrappers.length = 0;
  vi.unstubAllGlobals();
});
function open(props: { url: string; title: string; image?: boolean }) {
  const wrapper = mount(Cover, { props });
  wrappers.push(wrapper);
  return wrapper;
}
it("loads image covers directly without allocating a video decoder", async () => {
  const wrapper = open({ url: "/cover.jpg", title: "本地视频", image: true });
  await flushPromises();
  expect(wrapper.get("img").attributes("src")).toBe("/cover.jpg");
  expect(loadVideoCover).not.toHaveBeenCalled();
  await wrapper.get("img").trigger("error");
  expect(wrapper.text()).toContain("封面暂不可用");
});
it("keeps a generated poster when unrelated title or visibility changes", async () => {
  vi.mocked(loadVideoCover).mockResolvedValue("data:image/jpeg;base64,poster");
  const wrapper = open({ url: "/video.mp4", title: "原名" });
  await flushPromises();
  expect(wrapper.find("video").exists()).toBe(false);
  expect(wrapper.get("img").attributes("src")).toContain("base64,poster");
  await wrapper.setProps({ title: "新名" });
  visibility([{ isIntersecting: false }]);
  await flushPromises();
  visibility([{ isIntersecting: true }]);
  await flushPromises();
  expect(loadVideoCover).toHaveBeenCalledTimes(1);
});
it("cancels hidden requests and ignores a late poster from a previous source", async () => {
  let finish!: (poster: string) => void;
  vi.mocked(loadVideoCover).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const wrapper = open({ url: "/old.mp4", title: "原视频" });
  await flushPromises();
  const signal = vi.mocked(loadVideoCover).mock.calls[0][1];
  visibility([{ isIntersecting: false }]);
  await flushPromises();
  expect(signal.aborted).toBe(true);
  await wrapper.setProps({ url: "/new.jpg", image: true });
  visibility([{ isIntersecting: true }]);
  await flushPromises();
  finish("data:image/jpeg;base64,stale");
  await flushPromises();
  expect(wrapper.get("img").attributes("src")).toBe("/new.jpg");
});
it("treats archived cover-kind JPG files as images in the video picker", async () => {
  vi.mocked(contentArchiveApi.list).mockResolvedValue({
    items: [
      {
        id: "local",
        title: "本地视频",
        coverKind: "cover",
        coverUrl: "/cover.jpg",
        platform: "local",
        fetchedAt: new Date().toISOString()
      }
    ],
    total: 1
  } as Awaited<ReturnType<typeof contentArchiveApi.list>>);
  const wrapper = shallowMount(Picker, {
    props: { show: false, imported: [] },
    global: { renderStubDefaultSlot: true }
  });
  wrappers.push(wrapper);
  await wrapper.setProps({ show: true });
  await flushPromises();
  expect(wrapper.getComponent(Cover).props("image")).toBe(true);
});
