import type { ImageAiResult, ImageAiTask } from "@toolbox/shared";
import type { ProductImageAssets } from "./product-image-renderer";

export type StoredInput = {
  path: string;
  originalName: string;
  mimetype: string;
  size: number;
  width: number;
  height: number;
};

type StoredResult = ImageAiResult & { outputPath: string };

export type StoredImageAiTask = Omit<ImageAiTask, "results" | "inputs"> & {
  inputs: StoredInput[];
  maskPath?: string;
  results: StoredResult[];
  cancelRequested?: boolean;
  assets?: ProductImageAssets;
  submissionKey?: string;
};
