/** 一个所有者管理水印配置、上传及请求迟到；图片使用受控 URL，不创建 Object URL。 */
import { computed, ref, toRaw, type Ref } from "vue";
import {
  defaultArchiveWatermarkSettings,
  type ArchiveWatermarkInput,
  type ContentArchiveMedia
} from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
export function useArchiveWatermark(
  itemId: () => string,
  media: Ref<ContentArchiveMedia | undefined>,
  signal: () => AbortSignal
) {
  const settings = ref(defaultArchiveWatermarkSettings());
  const asset = ref<{ width: number; height: number; url: string; draftId?: string }>();
  const uploading = ref(false),
    error = ref("");
  const selectedPoint = ref<"from" | "to">("from"),
    selectedFrame = ref(0);
  let generation = 0;
  const input = computed<ArchiveWatermarkInput | null>(() =>
    asset.value
      ? {
          ...(asset.value.draftId ? { draftId: asset.value.draftId } : {}),
          settings: settings.value
        }
      : null
  );
  function load(value?: ContentArchiveMedia) {
    generation++;
    uploading.value = false;
    error.value = "";
    selectedFrame.value = 0;
    selectedPoint.value = "from";
    const saved = value?.audioEdit?.watermark;
    settings.value = saved ? structuredClone(toRaw(saved.settings)) : defaultArchiveWatermarkSettings();
    asset.value = saved
      ? {
          width: saved.width,
          height: saved.height,
          url: resolveBackendUrl(
            `/api/v1/tools/media-archive/items/${itemId()}/media/${value!.id}/saved-watermark?v=${saved.file.checksum}`
          )
        }
      : undefined;
  }
  async function upload(file: File) {
    if (uploading.value || !media.value) return;
    if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
      error.value = "请选择不超过 20 MiB 的 PNG、JPG 或 WebP 静态图片";
      return;
    }
    return replaceAsset((item, mediaId, requestSignal) =>
      videoEditApi.uploadWatermark(item, mediaId, file, requestSignal)
    );
  }
  async function selectLibrary(id: string) {
    if (uploading.value || !media.value) return;
    return replaceAsset((item, mediaId, requestSignal) =>
      videoEditApi.selectLibraryWatermark(item, mediaId, id, requestSignal)
    );
  }
  async function replaceAsset(
    request: (item: string, mediaId: string, signal: AbortSignal) => ReturnType<typeof videoEditApi.uploadWatermark>
  ) {
    if (uploading.value || !media.value) return;
    const version = ++generation,
      currentItem = itemId(),
      currentMedia = media.value.id,
      requestSignal = signal();
    uploading.value = true;
    error.value = "";
    try {
      const draft = await request(currentItem, currentMedia, requestSignal);
      if (
        version !== generation ||
        requestSignal.aborted ||
        itemId() !== currentItem ||
        media.value?.id !== currentMedia
      )
        return;
      asset.value = {
        width: draft.width,
        height: draft.height,
        draftId: draft.id,
        url: resolveBackendUrl(draft.previewUrl)
      };
    } catch (e) {
      if (version === generation && !isApiErrorCancelled(e)) error.value = formatApiError(e);
    } finally {
      if (version === generation) uploading.value = false;
    }
  }
  function move(point: { x: number; y: number }) {
    const next = structuredClone(toRaw(settings.value));
    if (next.motion.type === "keyframes") {
      if (!next.motion.keyframes[selectedFrame.value]) return;
      Object.assign(next.motion.keyframes[selectedFrame.value], point);
    } else next.motion[selectedPoint.value] = point;
    settings.value = next;
  }
  return {
    settings,
    asset,
    input,
    uploading,
    error,
    selectedPoint,
    selectedFrame,
    load,
    upload,
    selectLibrary,
    move,
    remove: () => {
      generation++;
      asset.value = undefined;
      uploading.value = false;
      error.value = "";
    }
  };
}
