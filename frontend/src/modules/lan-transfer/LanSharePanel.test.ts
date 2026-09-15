// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import LanSharePanel from "./LanSharePanel.vue";

describe("LAN share panel", () => {
  it("renders the share address and emits access actions", async () => {
    const wrapper = mount(LanSharePanel, {
      props: {
        selectedUrl: "http://127.0.0.1:5173/tools/lan-transfer",
        urlOptions: [{ label: "本机", value: "http://127.0.0.1:5173/tools/lan-transfer" }],
        qrCode: "",
        info: null,
        guestDescription: "",
        accessPin: "",
        unlocking: false,
        pendingUploads: []
      }
    });

    expect(wrapper.text()).toContain("局域网访问地址");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("copy-url")).toHaveLength(1);
  });
});
