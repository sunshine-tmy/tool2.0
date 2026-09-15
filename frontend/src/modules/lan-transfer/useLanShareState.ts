/**
 * 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理
 */
import { computed, ref, watch } from "vue";
import QRCode from "qrcode";
import type { LanFileCategory } from "@toolbox/shared";
import { lanFileCategories } from "@toolbox/shared";
import { currentWebUrl } from "../../config/runtime";
import type { LanTransferInfo } from "./types";

export function useLanShareState() {
  // 分享地址和权限计算集中在 composable，页面组件只消费 canRead/canUpload/canManage 三类能力。
  const currentTransferUrl = new URL("/tools/lan-transfer", currentWebUrl()).toString();
  const lanInfo = ref<LanTransferInfo | null>(null);
  const selectedShareUrl = ref(currentTransferUrl);
  const shareQrCode = ref("");
  const accessPin = ref("");
  const unlocking = ref(false);

  const lanCategoryOptions = lanFileCategories.map((category) => ({
    label: categoryName(category),
    value: category
  }));
  const shareUrlOptions = computed(() =>
    Array.from(new Set([...(lanInfo.value?.lanUrls ?? []), currentTransferUrl])).map((url) => ({
      label: url,
      value: url
    }))
  );
  const guestModeDescription = computed(() => {
    const descriptions: Record<NonNullable<LanTransferInfo>["guestMode"], string> = {
      full: "访客可以上传、查看和管理文件及图文",
      "upload-only": "访客仅可上传文件和发布图文",
      "download-only": "访客仅可查看和下载文件及图文",
      disabled: "访客无访问权限"
    };
    return lanInfo.value ? descriptions[lanInfo.value.guestMode] : "";
  });
  const hasFullAccess = computed(
    () => !lanInfo.value?.pinRequired || lanInfo.value.authenticated || lanInfo.value.guestMode === "full"
  );
  const canReadFiles = computed(() => hasFullAccess.value || lanInfo.value?.guestMode === "download-only");
  const canUploadFiles = computed(() => hasFullAccess.value || lanInfo.value?.guestMode === "upload-only");
  const canManageFiles = computed(() => hasFullAccess.value);

  watch(
    selectedShareUrl,
    async (url) => {
      // QR 码随选中地址变化异步生成；失败时清空旧图片，避免展示与链接不一致的二维码。
      try {
        shareQrCode.value = await QRCode.toDataURL(url, { width: 180, margin: 1, errorCorrectionLevel: "M" });
      } catch {
        shareQrCode.value = "";
      }
    },
    { immediate: true }
  );

  return {
    currentTransferUrl,
    lanInfo,
    selectedShareUrl,
    shareQrCode,
    accessPin,
    unlocking,
    lanCategoryOptions,
    shareUrlOptions,
    guestModeDescription,
    canReadFiles,
    canUploadFiles,
    canManageFiles
  };
}

function categoryName(category: LanFileCategory) {
  const names: Record<LanFileCategory, string> = {
    image: "图片",
    video: "视频",
    audio: "音频",
    text: "文本",
    pdf: "PDF",
    archive: "压缩包",
    document: "文档",
    other: "其他"
  };
  return names[category];
}
