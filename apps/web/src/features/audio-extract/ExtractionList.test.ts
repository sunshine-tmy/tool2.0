// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import { NButton } from "naive-ui";
import type { AudioExtractJob } from "@toolbox/shared/audio-extract";
import List from "./ExtractionList.vue";
const closed = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ audioExtractApi: { media: (id: string) => `/audio/${id}` } }));
vi.mock("./ExtractionAudioPreview.vue", async () => {
  const { defineComponent, onBeforeUnmount } = await import("vue");
  return {
    default: defineComponent({
      name: "ExtractionAudioPreview",
      props: { url: String, title: String, duration: Number, bytes: Number },
      setup(props) {
        onBeforeUnmount(() => closed(props.url));
      },
      template: "<div />"
    })
  };
});
let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});
function job(id: string, extension = "mp3") {
  return {
    id,
    name: `${id}.mp4`,
    status: "completed",
    phase: "完成",
    progress: 100,
    format: "mp3",
    bitrate: 192,
    extension,
    bytes: 1024,
    createdAt: "2026-11-03T00:00:00Z",
    track: { index: 0, language: "und", title: "", codec: "aac", channels: 2, duration: 29 }
  } as AudioExtractJob;
}
async function click(index: number) {
  const buttons = wrapper!.findAllComponents(NButton).filter((b) => /^(试听|收起试听)$/.test(b.text()));
  await buttons[index].trigger("click");
  await flushPromises();
}
it("mounts one waveform audition at a time and closes it on collapse or disappearance", async () => {
  wrapper = mount(List, { props: { jobs: [job("a"), job("b"), job("c", "mka")], selected: [], locked: false } });
  const preview = () => wrapper!.findAllComponents({ name: "ExtractionAudioPreview" });
  expect(preview()).toHaveLength(0);
  await click(0);
  expect(preview()).toHaveLength(1);
  expect(preview()[0].props()).toMatchObject({ url: "/audio/a", duration: 29, bytes: 1024 });
  await click(1);
  expect(preview()).toHaveLength(1);
  expect(closed).toHaveBeenCalledWith("/audio/a");
  expect(preview()[0].props("url")).toBe("/audio/b");
  await click(1);
  expect(preview()).toHaveLength(0);
  await click(0);
  await wrapper.setProps({ jobs: [job("b")] });
  expect(preview()).toHaveLength(0);
  await wrapper.setProps({ jobs: [job("a"), job("b")] });
  expect(preview()).toHaveLength(0);
});
