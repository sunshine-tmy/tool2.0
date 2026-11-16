// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import MaskEditor from "./MaskEditor.vue";

type CanvasState = { data: Uint8ClampedArray };
const states = new WeakMap<HTMLCanvasElement, CanvasState>();
const operations: Array<[string, ...number[]]> = [];
let wrapper: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  operations.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    let state = states.get(this);
    if (!state) {
      state = { data: new Uint8ClampedArray(this.width * this.height * 4) };
      states.set(this, state);
    }
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn((x: number, y: number) => operations.push(["moveTo", x, y])),
      lineTo: vi.fn((x: number, y: number) => operations.push(["lineTo", x, y])),
      stroke: vi.fn(() => {
        for (let index = 3; index < state!.data.length; index += 4) state!.data[index] = 255;
      }),
      fill: vi.fn(() => {
        for (let index = 3; index < state!.data.length; index += 4) state!.data[index] = 255;
      }),
      clearRect: vi.fn(() => state!.data.fill(0)),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(state!.data) }) as ImageData),
      createImageData: vi.fn((width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) })),
      putImageData: vi.fn((imageData: ImageData) => {
        state!.data = new Uint8ClampedArray(imageData.data);
      }),
      fillRect: vi.fn(),
      set fillStyle(_value: string) {},
      set strokeStyle(_value: string) {},
      set globalCompositeOperation(_value: GlobalCompositeOperation) {},
      set lineWidth(_value: number) {},
      set lineCap(_value: CanvasLineCap) {},
      set lineJoin(_value: CanvasLineJoin) {}
    } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "setPointerCapture").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["mask"], { type: "image/png" }));
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
});

describe("水印蒙版编辑器", () => {
  it("turns OCR suggestions into editable regions and supports manual brush strokes", async () => {
    wrapper = mount(MaskEditor, {
      props: { imageUrl: "blob:synthetic-image" },
      global: { stubs: { NButton: true, NButtonGroup: true, NSlider: true } }
    });
    const image = wrapper.get("img");
    Object.defineProperties(image.element, {
      naturalWidth: { value: 100, configurable: true },
      naturalHeight: { value: 50, configurable: true }
    });
    await image.trigger("load");
    await flushPromises();

    const exposed = wrapper.vm as unknown as {
      applySuggestions: (values: Array<{ polygon: Array<{ x: number; y: number }>; confidence: number }>) => void;
      toMaskBlob: () => Promise<Blob>;
    };
    exposed.applySuggestions([
      {
        polygon: [
          { x: 0.1, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.8, y: 0.4 }
        ],
        confidence: 0.9
      }
    ]);
    expect(operations.slice(0, 3)).toEqual([
      ["moveTo", 10, 10],
      ["lineTo", 80, 10],
      ["lineTo", 80, 20]
    ]);

    const canvas = wrapper.get("canvas.mask-layer");
    vi.spyOn(canvas.element, "getBoundingClientRect").mockReturnValue({
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      x: 10,
      y: 20,
      toJSON: () => ({})
    });
    await canvas.trigger("pointerdown", { pointerId: 1, pointerType: "mouse", clientX: 60, clientY: 70 });
    await canvas.trigger("pointermove", { pointerId: 1, pointerType: "mouse", clientX: 110, clientY: 80 });
    await canvas.trigger("pointerup", { pointerId: 1, pointerType: "mouse", clientX: 110, clientY: 80 });
    expect(operations).toContainEqual(["moveTo", 25, 25]);
    expect(operations).toContainEqual(["lineTo", 50, 30]);
    await expect(exposed.toMaskBlob()).resolves.toMatchObject({ type: "image/png", size: 4 });
  });
});
