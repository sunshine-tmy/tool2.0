import { computed, ref, type Ref } from "vue";
import { defaultProductImageRecipe, type ProductImageRecipe } from "@toolbox/shared";
import { baseCheckOptions, presets, type Tool } from "./options";
export function useProductImageLayout(recipe: Ref<ProductImageRecipe>, changed: () => void) {
  const tool = ref<Tool>("layout"),
    subjectView = ref(false),
    brush = ref(40),
    strength = ref(100),
    zoom = ref(1),
    checkColor = ref("");
  const customPreset = ref(false);
  const checkOptions = computed(() =>
    baseCheckOptions.some((item) => item.value === checkColor.value)
      ? baseCheckOptions
      : [...baseCheckOptions, { label: "自定义底色（仅检查）", value: checkColor.value }]
  );
  const preset = computed(() => {
    const value = `${recipe.value.canvas.width}x${recipe.value.canvas.height}`;
    return !customPreset.value && presets.some((item) => item.value === value) ? value : "custom";
  });
  function setCheckColor(value: string) {
    checkColor.value = value.toLowerCase();
  }
  function setOffset(x: number, y: number) {
    recipe.value.layout.offsetX = x;
    recipe.value.layout.offsetY = y;
    changed();
  }
  function setTool(value: Tool) {
    tool.value = value;
    if (value !== "pan") subjectView.value = value !== "layout";
  }
  function setBackground(value: "color" | "transparent" | "image") {
    recipe.value.background.kind = value;
    changed();
  }
  function setColor(value: string) {
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      recipe.value.background.color = value;
      changed();
    }
  }
  function applyPreset(value: string) {
    customPreset.value = value === "custom";
    if (value !== "custom") {
      const [width, height] = value.split("x").map(Number);
      recipe.value.canvas = { width, height };
      changed();
    }
  }
  function setDimension(key: "width" | "height", value: number | null) {
    if (value === null) return;
    recipe.value.canvas[key] = value;
    customPreset.value = true;
    changed();
  }
  function resetLayout() {
    recipe.value.layout = defaultProductImageRecipe().layout;
    tool.value = "layout";
    subjectView.value = false;
    changed();
  }

  return {
    tool,
    subjectView,
    brush,
    strength,
    zoom,
    checkColor,
    customPreset,
    checkOptions,
    preset,
    setCheckColor,
    setOffset,
    setTool,
    setBackground,
    setColor,
    applyPreset,
    setDimension,
    resetLayout
  };
}
