<template>
  <ToolLayout>
    <section class="main-column short-video-main">
      <div class="section-title">
        <div>
          <h2>短视频解析</h2>
          <p>粘贴抖音或小红书公开分享链接，提取视频、图集、封面和作者信息。</p>
        </div>
      </div>

      <section class="workspace-panel short-video-panel">
        <div class="short-video-form">
          <n-input
            v-model:value="inputText"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 8 }"
            placeholder="粘贴分享文案或链接，例如 https://v.douyin.com/... 或 https://www.xiaohongshu.com/explore/..."
          />

          <div class="short-video-controls">
            <div class="platform-switch">
              <n-button
                v-for="option in platformOptions"
                :key="option.value"
                size="small"
                :type="platform === option.value ? 'primary' : 'default'"
                @click="platform = option.value"
              >
                {{ option.label }}
              </n-button>
            </div>
            <n-button type="primary" :loading="loading" :disabled="!inputText.trim()" @click="parse">
              <template #icon>
                <Link2 :size="16" />
              </template>
              开始解析
            </n-button>
          </div>
        </div>
      </section>

      <section v-if="result" class="workspace-panel short-video-result">
        <div class="panel-heading">
          <h3>{{ result.title }}</h3>
          <n-tag :bordered="false" type="success">{{ platformName(result.platform) }}</n-tag>
        </div>

        <div class="short-video-result-grid">
          <div class="short-video-cover">
            <img v-if="result.coverUrl" :src="result.coverUrl" alt="封面" />
            <div v-else class="empty-cover">
              <Clapperboard :size="32" />
            </div>
          </div>

          <div class="metric-list">
            <div>
              <span>作者</span>
              <strong>{{ result.author?.name || "未知" }}</strong>
            </div>
            <div>
              <span>类型</span>
              <strong>{{ result.type }}</strong>
            </div>
            <div>
              <span>媒体</span>
              <strong>{{ result.media.length }}</strong>
            </div>
            <div>
              <span>来源</span>
              <strong>{{ result.provider }}</strong>
            </div>
          </div>
        </div>

        <p v-if="result.description" class="short-video-desc">{{ result.description }}</p>

        <div class="media-list">
          <article v-for="item in result.media" :key="`${item.type}-${item.url}`" class="media-row">
            <div>
              <strong>{{ item.label }}</strong>
              <span>{{ item.type === "video" ? "视频" : "图片" }} {{ mediaMeta(item) }}</span>
            </div>
            <div class="file-actions short-video-actions">
              <n-button
                v-if="item.type === 'video'"
                secondary
                size="small"
                @click="extractCopywriting(item)"
              >
                <template #icon>
                  <FileText :size="14" />
                </template>
                提取文案
              </n-button>
              <n-button
                class="short-video-download-button"
                secondary
                size="small"
                :loading="downloadingUrls.includes(item.url)"
                @click="downloadMedia(item)"
              >
                <template #icon>
                  <Download :size="14" />
                </template>
                下载
              </n-button>
              <n-button secondary size="small" tag="a" :href="item.url" target="_blank" rel="noreferrer">
                打开
              </n-button>
              <n-button tertiary size="small" @click="copyUrl(item.url)">复制链接</n-button>
            </div>
          </article>
        </div>

        <p v-for="warning in result.warnings" :key="warning" class="status-error">{{ warning }}</p>
      </section>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NInput, NTag, useMessage } from "naive-ui";
import { Clapperboard, Download, FileText, Link2 } from "lucide-vue-next";
import ToolLayout from "../../layouts/ToolLayout.vue";
import { copyTextToClipboard } from "../../utils/clipboard";
import { shortVideoApi } from "./api";
import { createShortVideoDownloadName, triggerShortVideoDownload } from "./download";
import type { ShortVideoResult } from "./types";
import type { ShortVideoMedia, ShortVideoPlatform } from "@toolbox/shared";

type PlatformOption = {
  label: string;
  value: Exclude<ShortVideoPlatform, "unknown">;
};

const message = useMessage();
const router = useRouter();
const inputText = ref("");
const platform = ref<PlatformOption["value"]>("auto");
const loading = ref(false);
const result = ref<ShortVideoResult | null>(null);
const downloadingUrls = ref<string[]>([]);
const platformOptions: PlatformOption[] = [
  { label: "自动识别", value: "auto" },
  { label: "抖音", value: "douyin" },
  { label: "小红书", value: "xiaohongshu" }
];

async function parse() {
  if (!inputText.value.trim()) {
    message.warning("请先粘贴分享链接");
    return;
  }

  loading.value = true;
  try {
    result.value = await shortVideoApi.parse({
      input: inputText.value,
      platform: platform.value
    });
    message.success("解析完成");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "短视频解析失败");
  } finally {
    loading.value = false;
  }
}

async function copyUrl(url: string) {
  try {
    await copyTextToClipboard(url);
    message.success("已复制链接");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "复制失败");
  }
}

async function downloadMedia(item: ShortVideoMedia) {
  if (downloadingUrls.value.includes(item.url)) return;
  downloadingUrls.value = [...downloadingUrls.value, item.url];
  try {
    await triggerShortVideoDownload(item);
    message.success("已开始下载");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "下载失败");
  } finally {
    downloadingUrls.value = downloadingUrls.value.filter((url) => url !== item.url);
  }
}

async function extractCopywriting(item: ShortVideoMedia) {
  if (item.type !== "video") return;
  await router.push({
    name: "video-text",
    query: {
      remoteUrl: item.url,
      fileName: createShortVideoDownloadName(item)
    }
  });
}

function platformName(value: ShortVideoResult["platform"]) {
  if (value === "douyin") return "抖音";
  if (value === "xiaohongshu") return "小红书";
  return "未知平台";
}

function mediaMeta(item: ShortVideoMedia) {
  const parts = [item.quality, item.width && item.height ? `${item.width}x${item.height}` : ""].filter(Boolean);
  return parts.length ? parts.join(" | ") : "";
}
</script>
