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
  apiNamespace: string;
};

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
    id: "xhs-archive",
    title: "多媒体内容归档",
    description: "将小红书、抖音与 TikTok 作品的正文、图片和视频保存到本机，支持预览、翻译与截帧。",
    category: "video",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["text/plain"],
    routePath: "/tools/media-archive",
    apiNamespace: "/api/v1/tools/xhs-archive"
  }
];

export function listTools(): ToolDefinition[] {
  return tools.map((tool) => ({ ...tool, acceptedTypes: [...tool.acceptedTypes] }));
}

export function getToolById(id: string): ToolDefinition | undefined {
  return listTools().find((tool) => tool.id === id);
}
