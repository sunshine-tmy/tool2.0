/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
export type ToolCategory = "file" | "image" | "video" | "audio" | "text" | "table";

export type ToolStatus = "ready" | "planned";

export type ToolDefinition = {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  requiresAuth: false;
  acceptedTypes: string[];
  routePath: string;
} & ({ execution?: "server"; apiNamespace: string } | { execution: "browser"; apiNamespace: null });

const tools: ToolDefinition[] = [
  {
    id: "image-compress",
    title: "图片压缩",
    description: "批量压缩商品图、详情页素材和社媒图片，兼顾体积与清晰度。",
    category: "image",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
    routePath: "/tools/image-compress",
    apiNamespace: "/api/v1/tools/image-compress"
  },
  {
    id: "image-ai",
    title: "AI 图片处理",
    description: "本地完成去水印、变清晰和商品图抠图，图片无需上传第三方平台。",
    category: "image",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
    routePath: "/tools/image-ai",
    apiNamespace: "/api/v1/tools/image-ai"
  },
  {
    id: "lan-transfer",
    title: "局域网文件传输",
    description: "局域网内双向收发文件和图文便签，支持预览、复制、下载和自动过期清理。",
    category: "file",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["*/*"],
    routePath: "/tools/lan-transfer",
    apiNamespace: "/api/v1/tools/lan-transfer"
  },
  {
    id: "edge-tts",
    title: "多国语言配音",
    description: "支持马来语、英语和巴西葡萄牙语的在线配音，以及 Chatterbox V3 本机参考音色克隆。",
    category: "audio",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["text/plain"],
    routePath: "/tools/edge-tts",
    apiNamespace: "/api/v1/tools/edge-tts"
  },
  {
    id: "audio-library",
    title: "音频素材库",
    description: "永久保存配音与背景音乐，按分组整理、试听并组织循环播放。",
    category: "audio",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/flac"],
    routePath: "/tools/audio-library",
    apiNamespace: "/api/v1/tools/audio-library"
  },
  {
    id: "audio-extract",
    title: "音频提取器",
    description: "从视频提取独立音轨，支持批量、原编码输出和 MP3，不改动原视频。",
    category: "audio",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: [".mp4", ".mkv", ".avi", ".mov", ".webm"],
    routePath: "/tools/audio-extract",
    apiNamespace: "/api/v1/tools/audio-extract"
  },
  {
    id: "audio-convert",
    title: "音频格式转换",
    description: "批量将 OGG、FLAC 与支持的 MGG/MFLAC 转为 MP3，可加入音频素材库。",
    category: "audio",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["audio/ogg", "audio/flac", ".mgg", ".mflac"],
    routePath: "/tools/audio-convert",
    apiNamespace: "/api/v1/tools/audio-convert"
  },
  {
    id: "xhs-archive",
    title: "多媒体内容归档",
    description: "将小红书、抖音与 TikTok 作品的正文、图片和视频保存到本机，支持预览、翻译与截帧。",
    category: "video",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["text/plain"],
    routePath: "/tools/media-archive",
    apiNamespace: "/api/v1/tools/xhs-archive"
  },
  {
    id: "video-subtitle",
    title: "视频去字幕",
    description: "自动检测并修复烧录在画面中的硬字幕，保留原分辨率与原音轨，全程本机处理。",
    category: "video",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["video/mp4", "video/x-matroska", "video/x-msvideo", "video/quicktime", "video/webm"],
    routePath: "/tools/video-subtitle",
    apiNamespace: "/api/v1/tools/video-ai"
  },
  {
    id: "json-format",
    title: "JSON 格式化",
    description: "本地校验、格式化和压缩 JSON，保留数字精度与字段顺序，支持复制和下载。",
    category: "text",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["application/json", "text/plain"],
    routePath: "/tools/json-format",
    execution: "browser",
    apiNamespace: null
  },
  {
    id: "base64",
    title: "Base64 编解码",
    description: "本地编解码 UTF-8 文本和文件，支持 Base64URL、二进制还原与复制下载。",
    category: "text",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["*/*"],
    routePath: "/tools/base64",
    execution: "browser",
    apiNamespace: null
  },
  {
    id: "url-codec",
    title: "URL 编解码",
    description: "本地编解码 URL 组件、完整 URL 和表单字段值，支持 UTF-8、错误定位与复制下载。",
    category: "text",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["text/plain"],
    routePath: "/tools/url-codec",
    execution: "browser",
    apiNamespace: null
  },
  {
    id: "uuid-generator",
    title: "UUID 生成",
    description: "本地批量生成随机 UUID v4，支持大小写、连字符、JSON 数组和复制下载。",
    category: "text",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: [],
    routePath: "/tools/uuid-generator",
    execution: "browser",
    apiNamespace: null
  }
];

export function listTools(): ToolDefinition[] {
  return tools.map((tool) => ({ ...tool, acceptedTypes: [...tool.acceptedTypes] }));
}

export function getToolById(id: string): ToolDefinition | undefined {
  return listTools().find((tool) => tool.id === id);
}
