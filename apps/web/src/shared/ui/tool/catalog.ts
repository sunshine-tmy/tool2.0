import { listTools, type ToolCategory } from "@toolbox/shared/common";
import type { ComputedRef, InjectionKey } from "vue";
import imageCompress from "../../../assets/ui-v2/icons/image-compress.webp";
import imageAi from "../../../assets/ui-v2/icons/image-ai.webp";
import archive from "../../../assets/ui-v2/icons/content-archive.webp";
import video from "../../../assets/ui-v2/icons/video-ai.webp";
import speech from "../../../assets/ui-v2/icons/speech.webp";
import library from "../../../assets/ui-v2/icons/audio-library.webp";
import extract from "../../../assets/ui-v2/icons/audio-extract.webp";
import convert from "../../../assets/ui-v2/icons/audio-convert.webp";
import json from "../../../assets/ui-v2/icons/json-format.webp";
import base64 from "../../../assets/ui-v2/icons/base64.webp";
import url from "../../../assets/ui-v2/icons/url-codec.webp";
import uuid from "../../../assets/ui-v2/icons/uuid-generator.webp";
import lan from "../../../assets/ui-v2/icons/lan-transfer.webp";

export const toolPresentationKey: InjectionKey<ComputedRef<ReturnType<typeof toolForPath>>> =
  Symbol("tool-presentation");

// Presentation only: the runtime catalog remains the owner of IDs, URLs and enabled entries.
const presentation: Record<string, { icon: string; summary: string; keywords?: string }> = {
  "image-compress": {
    icon: imageCompress,
    summary: "批量压缩与调整尺寸。",
    keywords: "缩小 图片 优化"
  },
  "image-ai": {
    icon: imageAi,
    summary: "去水印、增强、抠图与商品图。",
    keywords: "换背景 主图 精修"
  },
  "xhs-archive": {
    icon: archive,
    summary: "获取、整理与编辑图文视频。",
    keywords: "tiktok 小红书 抖音 配乐 水印"
  },
  "video-subtitle": {
    icon: video,
    summary: "识别、框选并修复字幕。",
    keywords: "去字幕 视频 STTN ProPainter"
  },
  "edge-tts": {
    icon: speech,
    summary: "在线配音与音色克隆。",
    keywords: "声音 文本转语音 TTS"
  },
  "audio-library": {
    icon: library,
    summary: "管理背景音乐与配音素材。",
    keywords: "音乐 波形 播放"
  },
  "audio-extract": {
    icon: extract,
    summary: "从视频提取独立音轨。",
    keywords: "音频 提取 MP3"
  },
  "audio-convert": {
    icon: convert,
    summary: "批量转换为 MP3。",
    keywords: "ogg flac mgg mflac"
  },
  "json-format": {
    icon: json,
    summary: "校验、排版与压缩。",
    keywords: "JSON 格式化"
  },
  base64: {
    icon: base64,
    summary: "文本与文件转换。",
    keywords: "base64 编码 解码"
  },
  "url-codec": {
    icon: url,
    summary: "链接与参数转换。",
    keywords: "url 编码 解码"
  },
  "uuid-generator": {
    icon: uuid,
    summary: "批量生成随机标识。",
    keywords: "UUID v4 随机 ID"
  },
  "lan-transfer": {
    icon: lan,
    summary: "同网设备收发文件与图文。",
    keywords: "局域网 分享 传输 二维码"
  }
};

export const toolCategories: { value: ToolCategory; label: string }[] = [
  { value: "image", label: "图片处理" },
  { value: "video", label: "视频与内容" },
  { value: "audio", label: "音频工具" },
  { value: "text", label: "开发工具" },
  { value: "file", label: "文件协作" }
];

export function workbenchTools() {
  const order = Object.keys(presentation);
  return listTools()
    .map((tool) => ({ ...tool, ...presentation[tool.id] }))
    .sort((a, b) => {
      const position = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
      return position(a.id) - position(b.id);
    });
}

export function toolForPath(path: string) {
  const canonical = path.replace(/^\/tools\/xhs-archive(?=\/|$)/, "/tools/media-archive");
  return workbenchTools().find((tool) => canonical === tool.routePath || canonical.startsWith(`${tool.routePath}/`));
}

export function categoryLabel(category: ToolCategory) {
  return toolCategories.find((entry) => entry.value === category)?.label ?? "工具";
}
