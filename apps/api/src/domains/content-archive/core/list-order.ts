/** Both archive list readers sort before pagination, with unknown publication dates always last. */
import type { ContentArchiveItem, ContentArchiveListQuery } from "@toolbox/shared/archive";

export function compareArchiveListItems(
  left: ContentArchiveItem,
  right: ContentArchiveItem,
  sort: NonNullable<ContentArchiveListQuery["sort"]>
) {
  const field = sort.startsWith("published-") ? "publishedAt" : "fetchedAt";
  const leftTime = Date.parse(left[field] ?? "");
  const rightTime = Date.parse(right[field] ?? "");
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);
  if (leftValid !== rightValid) return leftValid ? -1 : 1;
  if (leftValid && rightValid && leftTime !== rightTime)
    return (leftTime - rightTime) * (sort.endsWith("-asc") ? 1 : -1);
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}
