import type { UploadItem } from "./types";

export function removeUploadItem(items: UploadItem[], target: UploadItem) {
  return items.filter((item) => item !== target);
}
