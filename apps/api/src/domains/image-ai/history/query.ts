import type { ImageAiHistory, ImageAiHistoryQuery } from "@toolbox/shared";
import type { StoredImageAiTask } from "../types";
import { toPublicTask } from "../task-projections";

// Pure query over the manager's current iterable; never caches or owns task state.
export function listImageAiHistory(tasks: Iterable<StoredImageAiTask>, query: ImageAiHistoryQuery): ImageAiHistory {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const keyword = query.keyword?.trim().toLocaleLowerCase() ?? "";
  const matching = Array.from(tasks)
    .filter(
      (task) =>
        (!query.operation || task.operation === query.operation) &&
        (!query.status || task.status === query.status) &&
        (!keyword ||
          task.id.toLocaleLowerCase().includes(keyword) ||
          task.inputs.some((input) => input.originalName.toLocaleLowerCase().includes(keyword)))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return {
    items: matching.slice((page - 1) * pageSize, page * pageSize).map(toPublicTask),
    total: matching.length,
    page,
    pageSize
  };
}
