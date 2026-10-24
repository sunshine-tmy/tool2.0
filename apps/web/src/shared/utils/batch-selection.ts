/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
type PageSelectionState = {
  checked: boolean;
  indeterminate: boolean;
};

export function toggleSelectedId(selectedIds: string[], id: string, checked: boolean) {
  if (checked) {
    return selectedIds.includes(id) ? selectedIds : [...selectedIds, id];
  }
  return selectedIds.filter((selectedId) => selectedId !== id);
}

export function togglePageSelection(selectedIds: string[], pageIds: string[], checked: boolean) {
  if (checked) {
    return [...selectedIds, ...pageIds.filter((id) => !selectedIds.includes(id))];
  }
  return selectedIds.filter((id) => !pageIds.includes(id));
}

export function getPageSelectionState(selectedIds: string[], pageIds: string[]): PageSelectionState {
  if (!pageIds.length) {
    return { checked: false, indeterminate: false };
  }

  const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id)).length;
  return {
    checked: selectedOnPage === pageIds.length,
    indeterminate: selectedOnPage > 0 && selectedOnPage < pageIds.length
  };
}

export function pruneSelectedIds(selectedIds: string[], visibleIds: string[]) {
  return selectedIds.filter((id) => visibleIds.includes(id));
}
