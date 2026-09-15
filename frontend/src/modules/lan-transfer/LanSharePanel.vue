<template>
  <div class="lan-share-card">
    <div class="share-strip">
      <div class="share-address">
        <span>局域网访问地址</span>
        <strong>{{ selectedUrl }}</strong>
        <n-select
          v-if="urlOptions.length > 1"
          :value="selectedUrl"
          size="small"
          :options="urlOptions"
          aria-label="选择局域网访问地址"
          @update:value="$emit('update:selectedUrl', $event)"
        />
      </div>
      <div class="share-actions">
        <img v-if="qrCode" :src="qrCode" alt="局域网访问地址二维码" class="share-qr" />
        <n-button secondary @click="$emit('copy-url')">复制地址</n-button>
      </div>
    </div>
    <div v-if="info" class="lan-capacity">
      已使用 {{ formatBytes(info.usedBytes) }}，上传预留 {{ formatBytes(info.reservedUploadBytes) }}， 总配额
      {{ formatBytes(info.maxStorageBytes) }}
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
</script>
