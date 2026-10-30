// @vitest-environment happy-dom
import { nextTick, defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import { NInput } from "naive-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pasteSpeechText } from "./paste-speech-text";

function paste(target: HTMLTextAreaElement, text: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  const getData = vi.fn((type: string) => (type === "text/plain" ? text : '<b style="color:red">wrong HTML</b>'));
  Object.defineProperty(event, "clipboardData", { value: { getData } });
  target.addEventListener(
    "paste",
    (event) => pasteSpeechText(event as ClipboardEvent, (value) => (target.value = value)),
    { once: true }
  );
  target.dispatchEvent(event);
  return { event, getData };
}

afterEach(() => document.body.replaceChildren());

describe("plain speech paste", () => {
  it("updates the actual controlled NInput through its bubbling paste event and restores selection after rendering", async () => {
    const value = ref("Hello World");
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(NInput, {
            type: "textarea",
            value: value.value,
            "onUpdate:value": (text: string) => {
              value.value = text;
            },
            onPaste: (event: ClipboardEvent) =>
              pasteSpeechText(event, (text) => {
                value.value = text;
              })
          })
      }),
      { attachTo: document.body }
    );
    try {
      const target = wrapper.get("textarea").element;
      target.setSelectionRange(6, 11);
      const event = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", { value: { getData: () => "**Tang Tea**" } });
      target.dispatchEvent(event);
      await nextTick();
      expect(event.defaultPrevented).toBe(true);
      expect(value.value).toBe("Hello Tang Tea");
      expect(target.value).toBe(value.value);
      expect(target.selectionStart).toBe(value.value.length);
      expect(target.selectionEnd).toBe(value.value.length);
    } finally {
      wrapper.unmount();
    }
  });

  it("uses only plain text and inserts the cleaned result at the caret with the surrounding draft intact", async () => {
    const target = document.createElement("textarea");
    document.body.append(target);
    target.value = "Before: replace After";
    target.setSelectionRange(8, 15);
    const { event, getData } = paste(target, "**1. Hello.**\r\n你好。");
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(getData.mock.calls).toEqual([["text/plain"]]);
    expect(target.value).toBe("Before: 1. Hello.\n你好。 After");
    expect(target.selectionStart).toBe("Before: 1. Hello.\n你好。".length);
    expect(target.selectionEnd).toBe(target.selectionStart);
  });

  it("keeps boundary whitespace rather than joining words or paragraphs during insertion", async () => {
    const target = document.createElement("textarea");
    document.body.append(target);
    target.value = "HelloWorld";
    target.setSelectionRange(5, 5);
    paste(target, " **Tang Tea** ");
    await nextTick();
    expect(target.value).toBe("Hello Tang Tea World");
  });

  it("leaves clipboard content alone when there is no plain text or the input is not editable", () => {
    const target = document.createElement("textarea");
    target.value = "Unchanged";
    expect(paste(target, "").event.defaultPrevented).toBe(false);
    target.readOnly = true;
    expect(paste(target, "new").event.defaultPrevented).toBe(false);
    target.readOnly = false;
    target.disabled = true;
    expect(paste(target, "new").event.defaultPrevented).toBe(false);
    expect(target.value).toBe("Unchanged");
    const update = vi.fn();
    pasteSpeechText(new Event("paste") as ClipboardEvent, update);
    expect(update).not.toHaveBeenCalled();
  });
});
