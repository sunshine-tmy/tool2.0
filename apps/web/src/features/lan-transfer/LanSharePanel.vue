<!-- 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理 -->
<template>
  <div class="lan-share-card">
    <div class="share-strip">
      <div class="share-content">
        <div class="share-heading">
          <strong>局域网访问地址</strong>
          <span>同一可信局域网成员可访问</span>
        </div>
        <div class="share-address">
          <n-select
            v-if="urlOptions.length > 1"
            :value="selectedUrl"
            :options="urlOptions"
            aria-label="选择局域网访问地址"
            @update:value="$emit('update:selectedUrl', $event)"
          />
          <strong v-else-if="selectedUrl" class="share-url">{{ selectedUrl }}</strong>
          <span v-else class="share-unavailable">当前没有可用的局域网地址</span>
          <n-button :disabled="!selectedUrl" @click="$emit('copy-url')">
            <template #icon><Copy :size="16" /></template>复制地址
          </n-button>
        </div>
        <div v-if="info" class="lan-capacity">
          <span>已使用 {{ formatBytes(info.usedBytes) }}</span>
          <span>上传预留 {{ formatBytes(info.reservedUploadBytes) }}</span>
          <span>总配额 {{ formatBytes(info.maxStorageBytes) }}</span>
        </div>
      </div>
      <div v-if="qrCode" class="share-qr-block">
        <img :src="qrCode" alt="局域网访问地址二维码" class="share-qr" />
        <span>扫码访问</span>
      </div>
    </div>
  </div>

  <div v-if="info?.pinRequired && !info.authenticated" class="lan-access-strip">
    <div>
      <strong>当前为访客模式</strong>
      <span>{{ guestDescription }}</span>
    </div>
    <n-input
      :value="accessPin"
      type="password"
      show-password-on="click"
      placeholder="输入管理 PIN"
      aria-label="管理 PIN"
      @update:value="$emit('update:accessPin', $event)"
      @keyup.enter="$emit('unlock')"
    />
    <n-button type="primary" :loading="unlocking" @click="$emit('unlock')">解锁管理</n-button>
  </div>

  <div v-if="pendingUploads.length" class="resume-strip">
    <div>
      <strong>有 {{ pendingUploads.length }} 个未完成上传</strong>
      <span>重新选择同一个原文件即可从服务器已接收的分片继续。</span>
    </div>
    <n-button size="small" tertiary @click="$emit('clear-pending')">清除失效记录</n-button>
  </div>
</template>

<script setup lang="ts">
import { Copy } from "lucide-vue-next";
import { formatBytesAdaptive as formatBytes } from "../../shared/utils/format-bytes";
import { NButton, NInput, NSelect } from "naive-ui";
import type { LanTransferInfo, PendingLanUpload } from "./types";

defineProps<{
  selectedUrl: string;
  urlOptions: Array<{ label: string; value: string }>;
  qrCode: string;
  info: LanTransferInfo | null;
  guestDescription: string;
  accessPin: string;
  unlocking: boolean;
  pendingUploads: PendingLanUpload[];
}>();

defineEmits<{
  "update:selectedUrl": [value: string];
  "update:accessPin": [value: string];
  "copy-url": [];
  unlock: [];
  "clear-pending": [];
}>();
</script>

<style scoped>
.lan-share-card { margin: 0; }
.share-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 24px;
  padding: 0;
  border: 0;
  background: transparent;
}
.share-content { min-width: 0; display: grid; gap: 12px; }
.share-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 12px; }
.share-heading strong { color: var(--color-text); font-size: 14px; }
.share-heading > span { color: var(--color-text-tertiary); font-size: 12px; }
.share-address { display: flex; align-items: center; gap: 12px; min-width: 0; }
.share-address .n-select { flex: 1; min-width: 0; max-width: 600px; margin: 0; }
.share-address :deep(.n-base-selection) { background: var(--color-primary-50); }
.share-address :deep(.n-base-selection-label) { color: var(--color-primary-600); font-weight: 600; }
.share-url { min-width: 0; overflow-wrap: anywhere; padding: 9px 14px; border-radius: 8px; background: var(--color-primary-50); color: var(--color-primary-600); font-size: 15px; }
.share-address > .n-button { flex-shrink: 0; }
.lan-capacity { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; padding: 0; border: 0; background: transparent; color: var(--color-text-tertiary); font-size: 12px; line-height: 1.5; }
.share-qr-block { display: grid; justify-items: center; gap: 4px; padding-left: 24px; border-left: 1px solid var(--color-border); }
.share-qr-block > span { color: var(--color-text-tertiary); font-size: 11px; }
.share-qr { display: block; box-sizing: border-box; width: 88px; height: 88px; margin: 0; padding: 4px; background: white; border: 1px solid var(--color-border); border-radius: 8px; }
@media (max-width: 600px) {
  .share-strip { gap: 14px; }
  .share-qr-block { padding-left: 14px; }
  .share-address { flex-wrap: wrap; }
  .share-address .n-select { flex-basis: 100%; }
}
</style>
