import { computed, onScopeDispose, ref, type ComputedRef } from "vue";
import { useMessage } from "naive-ui";
import { absoluteImageAiUrl } from "../media-links";
export function useProductImageBackground(busy: ComputedRef<boolean>, changed: () => void) {
  const message = useMessage();
  const backgroundInput = ref<HTMLInputElement>(),
    draggingBackground = ref(false),
    backgroundUrl = ref<string>(),
    backgroundFile = ref<File>();
  let objectUrl: string | undefined;
  const backgroundPreviewUrl = computed(() =>
    backgroundUrl.value?.startsWith("blob:")
      ? backgroundUrl.value
      : backgroundUrl.value
        ? absoluteImageAiUrl(backgroundUrl.value)
        : undefined
  );

  function releaseBackground() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }
  function selectBackground(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    input.value = "";
    acceptBackground(file);
  }
  function dropBackground(event: DragEvent) {
    draggingBackground.value = false;
    if (busy.value) return;
    if (event.dataTransfer?.files.length !== 1) {
      message.error("每次请选择一张背景图片");
      return;
    }
    acceptBackground(event.dataTransfer.files[0]);
  }
  function acceptBackground(file: File | undefined) {
    if (busy.value) return;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024) {
      message.error("请选择 20 MiB 以内的 JPG、PNG 或 WebP 图片");
      return;
    }
    releaseBackground();
    backgroundFile.value = file;
    objectUrl = URL.createObjectURL(file);
    backgroundUrl.value = objectUrl;
    changed();
  }

  function restoreBackground(url: string | undefined) {
    releaseBackground();
    backgroundFile.value = undefined;
    backgroundUrl.value = url;
  }
  onScopeDispose(releaseBackground);
  return {
    backgroundInput,
    draggingBackground,
    backgroundUrl,
    backgroundFile,
    backgroundPreviewUrl,
    selectBackground,
    dropBackground,
    restoreBackground
  };
}
