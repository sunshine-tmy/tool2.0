export type ToolCategory = "file" | "image" | "video" | "text" | "table";

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
    apiNamespace: "/api/tools/image-compress"
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
    apiNamespace: "/api/tools/image-ai"
  },
  {
    id: "lan-transfer",
    title: "局域网文件传输",
    description: "局域网内双向收发文件，支持预览、筛选、下载和自动过期清理。",
    category: "file",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["*/*"],
    routePath: "/tools/lan-transfer",
    apiNamespace: "/api/tools/lan-transfer"
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
    apiNamespace: "/api/tools/video-text"
  },
  {
    id: "short-video",
    title: "短视频解析",
    description: "解析抖音、小红书分享链接，提取公开视频、图集、封面和作者信息。",
    category: "video",
    status: "ready",
    requiresAuth: false,
    acceptedTypes: ["text/plain"],
    routePath: "/tools/short-video",
    apiNamespace: "/api/tools/short-video"
  }
];

export function listTools(): ToolDefinition[] {
  return tools.map((tool) => ({ ...tool, acceptedTypes: [...tool.acceptedTypes] }));
}

export function getToolById(id: string): ToolDefinition | undefined {
  return listTools().find((tool) => tool.id === id);
}
