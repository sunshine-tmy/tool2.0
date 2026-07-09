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
  }
];

export function listTools(): ToolDefinition[] {
  return tools.map((tool) => ({ ...tool, acceptedTypes: [...tool.acceptedTypes] }));
}

export function getToolById(id: string): ToolDefinition | undefined {
  return listTools().find((tool) => tool.id === id);
}
