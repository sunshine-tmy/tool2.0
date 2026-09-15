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
    id: "video-text",
    title: "视频文本解析",
    description: "从商品讲解、直播切片和素材视频中提取文本内容。",
    category: "video",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["video/mp4", "video/webm", "video/quicktime"],
    routePath: "/tools/video-text",
    apiNamespace: "/api/v1/tools/video-text"
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
    id: "short-video",
    title: "短视频解析",
    description: "解析抖音、小红书、TikTok 分享链接，提取公开视频、图集、封面和作者信息。",
    category: "video",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["text/plain"],
    routePath: "/tools/short-video",
    apiNamespace: "/api/v1/tools/short-video"
  },
  {
    id: "xhs-archive",
    title: "小红书内容归档",
    description: "从小红书链接获取标题、正文、图片和视频，保存到本机并随时预览下载。",
    category: "video",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["text/plain"],
    routePath: "/tools/xhs-archive",
    apiNamespace: "/api/v1/tools/xhs-archive"
  }
];

export function listTools(): ToolDefinition[] {
  return tools.map((tool) => ({ ...tool, acceptedTypes: [...tool.acceptedTypes] }));
}

export function getToolById(id: string): ToolDefinition | undefined {
  return listTools().find((tool) => tool.id === id);
}
