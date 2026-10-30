/** 双平台列表/抽屉状态：筛选清空选择，取消旧请求，代际校验防止迟到响应覆盖新页面。 */
import { onScopeDispose, ref, watch } from "vue";
import type { ContentArchiveItem, ContentArchiveListQuery, ContentArchiveListResponse } from "@toolbox/shared";
import { contentArchiveApi } from "./content-api";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { isApiErrorCancelled } from "../../shared/http/http";

export function useArchiveCollection(reportError: (error: unknown) => void, initial: Record<string, unknown> = {}) {
  const scope = useRequestScope();
  const restored = initial.editorReturn === "1" ? initial : {};
  const keyword = ref(typeof restored.keyword === "string" ? restored.keyword.slice(0, 500) : "");
  const typeFilter = ref<NonNullable<ContentArchiveListQuery["type"]>>(
    ["video", "image", "live-photo"].includes(String(restored.type))
      ? (restored.type as NonNullable<ContentArchiveListQuery["type"]>)
      : "all"
  );
  const platformFilter = ref<NonNullable<ContentArchiveListQuery["platform"]>>(
    ["tiktok", "douyin", "xiaohongshu", "local"].includes(String(restored.platform))
      ? (restored.platform as NonNullable<ContentArchiveListQuery["platform"]>)
      : "all"
  );
  const groupFilter = ref(
    typeof restored.group === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(restored.group) ? restored.group : "all"
  );
  const sort = ref<NonNullable<ContentArchiveListQuery["sort"]>>(
    ["archived-desc", "archived-asc", "published-desc", "published-asc"].includes(String(restored.sort))
      ? (restored.sort as NonNullable<ContentArchiveListQuery["sort"]>)
      : "archived-desc"
  );
  const restoredPage = Number(restored.page);
  const page = ref(Number.isSafeInteger(restoredPage) && restoredPage > 0 && restoredPage <= 100000 ? restoredPage : 1);
  const listLoading = ref(false);
  const archives = ref<ContentArchiveListResponse>({ items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 });
  const selectedArchiveIds = ref<string[]>([]);
  const publicationBusyIds = ref<string[]>([]);
  const current = ref<ContentArchiveItem>();
  const detail = ref<ContentArchiveItem>();
  const drawerOpen = ref(false);
  let listGeneration = 0;
  let detailGeneration = 0;
  let listController: AbortController | undefined;
  let detailController: AbortController | undefined;

  function filter() {
    return {
      keyword: keyword.value,
      type: typeFilter.value,
      platform: platformFilter.value,
      ...(groupFilter.value !== "all" ? { groupId: groupFilter.value } : {})
    };
  }
  function invalidateList() {
    listGeneration++;
    listController?.abort();
    listLoading.value = false;
    selectedArchiveIds.value = [];
  }
  // 搜索文字变化只重置分页，不逐字发送请求；类型/平台切换自动读取新范围。
  watch(
    [keyword, typeFilter, platformFilter, groupFilter, sort],
    () => {
      invalidateList();
      page.value = 1;
    },
    { flush: "sync" }
  );
  watch([typeFilter, platformFilter, groupFilter, sort], () => void loadArchives());
  watch(page, invalidateList, { flush: "sync" });
  watch(
    drawerOpen,
    (open) => {
      if (!open) {
        detailGeneration++;
        detailController?.abort();
      }
    },
    { flush: "sync" }
  );

  async function loadArchives() {
    if (scope.aborted) return;
    const generation = ++listGeneration;
    listController?.abort();
    listController = new AbortController();
    const signal = AbortSignal.any([scope.signal, listController.signal]);
    listLoading.value = true;
    try {
      const result = await contentArchiveApi.list(
        { ...filter(), sort: sort.value, page: page.value, pageSize: 12 },
        signal
      );
      if (signal.aborted || generation !== listGeneration) return;
      archives.value = result;
      selectedArchiveIds.value = selectedArchiveIds.value.filter((id) => result.items.some((item) => item.id === id));
    } catch (error) {
      if (!signal.aborted && generation === listGeneration && !isApiErrorCancelled(error)) reportError(error);
    } finally {
      if (generation === listGeneration) listLoading.value = false;
    }
  }
  async function openDetail(id: string) {
    if (scope.aborted) return;
    const generation = ++detailGeneration;
    detailController?.abort();
    detailController = new AbortController();
    const signal = AbortSignal.any([scope.signal, detailController.signal]);
    detail.value = undefined;
    drawerOpen.value = true;
    try {
      const result = await contentArchiveApi.detail(id, signal);
      if (signal.aborted || generation !== detailGeneration) return;
      detail.value = result;
      return result;
    } catch (error) {
      if (!signal.aborted && generation === detailGeneration && !isApiErrorCancelled(error)) reportError(error);
    }
  }
  function updateItem(item: ContentArchiveItem) {
    if (scope.aborted) return;
    if (current.value?.id === item.id) current.value = item;
    if (detail.value?.id === item.id) detail.value = item;
  }
  async function setPublication(id: string, publishedElsewhere: boolean) {
    if (scope.aborted || publicationBusyIds.value.includes(id) || !archives.value.items.some((item) => item.id === id))
      return false;
    publicationBusyIds.value = [...publicationBusyIds.value, id];
    try {
      const state = await contentArchiveApi.setPublication(id, publishedElsewhere, scope.signal);
      if (scope.aborted) return false;
      if (state.archiveId !== id || state.publishedElsewhere !== publishedElsewhere)
        throw new Error("更新已发布标记返回了不匹配的作品或状态");
      archives.value = {
        ...archives.value,
        items: archives.value.items.map((item) => (item.id === id ? { ...item, publishedElsewhere } : item))
      };
      // Reuse current filters/page and invalidate any pre-mutation list response; selection stays intact.
      await loadArchives();
      return !scope.aborted;
    } catch (error) {
      if (!scope.aborted && !isApiErrorCancelled(error)) reportError(error);
      return false;
    } finally {
      if (!scope.aborted) publicationBusyIds.value = publicationBusyIds.value.filter((value) => value !== id);
    }
  }
  function forgetItem(id: string) {
    if (current.value?.id === id) current.value = undefined;
    if (detail.value?.id === id) {
      drawerOpen.value = false;
      detail.value = undefined;
    }
    selectedArchiveIds.value = selectedArchiveIds.value.filter((value) => value !== id);
  }
  function toggleArchiveSelection(id: string, checked: boolean) {
    if (!archives.value.items.some((item) => item.id === id)) return;
    selectedArchiveIds.value = checked
      ? [...new Set([...selectedArchiveIds.value, id])]
      : selectedArchiveIds.value.filter((value) => value !== id);
  }
  function toggleSelectAllArchives(checked: boolean) {
    selectedArchiveIds.value = checked ? archives.value.items.map((item) => item.id) : [];
  }
  onScopeDispose(() => {
    listGeneration++;
    detailGeneration++;
    listController?.abort();
    detailController?.abort();
  });
  return {
    keyword,
    typeFilter,
    platformFilter,
    groupFilter,
    sort,
    page,
    listLoading,
    archives,
    selectedArchiveIds,
    publicationBusyIds,
    setPublication,
    current,
    detail,
    drawerOpen,
    filter,
    loadArchives,
    openDetail,
    updateItem,
    forgetItem,
    toggleArchiveSelection,
    toggleSelectAllArchives
  };
}
