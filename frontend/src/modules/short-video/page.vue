<!-- 中文模块说明：短视频前端模块，负责链接解析、下载和历史操作 -->
<template>
  <ToolLayout>
    <section class="main-column short-video-main">
      <ToolPageHeader
        title="短视频解析"
        description="粘贴抖音、小红书或 TikTok 公开分享链接，提取视频、图集、封面和作者信息。"
        kicker="SOCIAL MEDIA PARSER"
      />

      <section class="workspace-panel short-video-panel">
        <div class="short-video-form">
          <n-input
            v-model:value="inputText"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 8 }"
            placeholder="粘贴分享文案或链接，例如 https://v.douyin.com/...、https://www.xiaohongshu.com/explore/... 或 https://www.tiktok.com/@user/video/..."
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
            <n-button v-if="xhsAuthRequired" type="warning" :loading="authWaiting" @click="loginAndRetry">
              登录小红书并重试
            </n-button>
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
            <iframe
              v-if="result.embedUrl"
              class="short-video-embed"
              :src="result.embedUrl"
              title="TikTok 官方视频预览"
              loading="lazy"
              allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"
            />
            <!-- 本地预览代理透传 Range，请求元数据或拖动进度条时不会下载整个视频。 -->
            <video
              v-else-if="previewMedia?.type === 'video' && !previewLoadFailed"
              :key="previewMedia.url"
              class="short-video-preview"
              :src="createShortVideoPreviewUrl(previewMedia)"
              controls
              preload="metadata"
              playsinline
              @error="previewLoadFailed = true"
            />
            <img
              v-else-if="previewMedia?.type === 'image' && !previewLoadFailed"
              :key="previewMedia.url"
              :src="createShortVideoPreviewUrl(previewMedia)"
              alt="解析图片预览"
              loading="lazy"
              decoding="async"
              @error="previewLoadFailed = true"
            />
            <img v-else-if="result.coverUrl" :src="result.coverUrl" alt="封面" loading="lazy" decoding="async" />
            <div v-else class="empty-cover">
              <Clapperboard :size="32" />
              <span v-if="previewMedia">媒体预览加载失败，可尝试下载</span>
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
              <n-button secondary size="small" @click="selectPreview(item)">
                <template #icon>
                  <Play :size="14" />
                </template>
                预览
              </n-button>
              <n-button v-if="item.type === 'video'" secondary size="small" @click="extractCopywriting(item)">
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
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NInput, NTag, useMessage } from "naive-ui";
import { Clapperboard, Download, FileText, Link2, Play } from "lucide-vue-next";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import { ApiRequestError, formatApiError, isApiErrorCancelled } from "../../services/http";
import { copyTextToClipboard } from "../../utils/clipboard";
import { xhsArchiveApi } from "../xhs-archive/api";
import { shortVideoApi } from "./api";
import { createShortVideoDownloadName, createShortVideoPreviewUrl, triggerShortVideoDownload } from "./download";
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
const authWaiting = ref(false);
const xhsAuthRequired = ref(false);
const result = ref<ShortVideoResult | null>(null);
const downloadingUrls = ref<string[]>([]);
const selectedPreviewMedia = ref<ShortVideoMedia | null>(null);
const previewLoadFailed = ref(false);
const previewMedia = computed(() => {
  const media = result.value?.media ?? [];
  const selected = selectedPreviewMedia.value;
  if (selected && media.some((item) => item.url === selected.url && item.type === selected.type)) return selected;
  // 视频优先，确保解析到视频时结果区第一时间展示播放器；图集则展示首张图片。
  return media.find((item) => item.type === "video") ?? media[0] ?? null;
});
const platformOptions: PlatformOption[] = [
  { label: "自动识别", value: "auto" },
  { label: "抖音", value: "douyin" },
  { label: "小红书", value: "xiaohongshu" },
  { label: "TikTok", value: "tiktok" }
];

async function parse() {
  if (!inputText.value.trim()) {
    message.warning("请先粘贴分享链接");
    return;
  }

  loading.value = true;
  try {
    // 解析结果通过共享 Schema 校验后才写入页面状态，失败时保留原始输入便于重试。
    const parsed = await shortVideoApi.parse({
      input: inputText.value,
      platform: platform.value
    });
    result.value = parsed;
    selectedPreviewMedia.value = parsed.media.find((item) => item.type === "video") ?? parsed.media[0] ?? null;
    previewLoadFailed.value = false;
    xhsAuthRequired.value = false;
    message.success("解析完成");
  } catch (error) {
    xhsAuthRequired.value = error instanceof ApiRequestError && error.code === "SHORT_VIDEO_XHS_AUTH_REQUIRED";
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "短视频解析失败"));
  } finally {
    loading.value = false;
  }
}

function selectPreview(item: ShortVideoMedia) {
  selectedPreviewMedia.value = item;
  previewLoadFailed.value = false;
  // 备选清晰度或图集切换后让播放器回到可见区域，避免用户误以为按钮无响应。
  requestAnimationFrame(() =>
    document.querySelector(".short-video-cover")?.scrollIntoView({ behavior: "smooth", block: "center" })
  );
}

async function loginAndRetry() {
  authWaiting.value = true;
  try {
    // 登录窗口由后端托管，页面只轮询会话终态；Cookie 不会暴露给前端脚本。
    const session = await xhsArchiveApi.startAuth();
    let state = session;
    while (!["completed", "failed"].includes(state.status)) {
      await delay(1200);
      state = await xhsArchiveApi.auth(session.id);
    }
    if (state.status === "failed") throw new Error(state.error || state.message);
    message.success("登录成功，正在重新解析");
    await parse();
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "小红书登录失败"));
  } finally {
    authWaiting.value = false;
  }
}

async function copyUrl(url: string) {
  try {
    await copyTextToClipboard(url);
    message.success("已复制链接");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "复制失败"));
  }
}

async function downloadMedia(item: ShortVideoMedia) {
  if (downloadingUrls.value.includes(item.url)) return;
  // 以媒体 URL 去重下载按钮，避免用户重复点击创建多个隐藏下载 iframe。
  downloadingUrls.value = [...downloadingUrls.value, item.url];
  try {
    await triggerShortVideoDownload(item);
    message.success("已开始下载");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "下载失败"));
  } finally {
    downloadingUrls.value = downloadingUrls.value.filter((url) => url !== item.url);
  }
}

async function extractCopywriting(item: ShortVideoMedia) {
  if (item.type !== "video") return;
  // 将视频地址和安全文件名交给视频文案页面，统一复用远程抓取和任务进度流程。
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
  if (value === "tiktok") return "TikTok";
  return "未知平台";
}

function mediaMeta(item: ShortVideoMedia) {
  const parts = [item.quality, item.width && item.height ? `${item.width}x${item.height}` : ""].filter(Boolean);
  return parts.length ? parts.join(" | ") : "";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
</script>
