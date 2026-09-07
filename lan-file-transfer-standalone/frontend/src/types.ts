export type ToolTask = {
  id: string;
  toolId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  outputPath?: string;
  error?: string;
};
