/** 双平台列表/抽屉状态：筛选清空选择，取消旧请求，代际校验防止迟到响应覆盖新页面。 */
import { onScopeDispose, ref, watch } from "vue";
import type { ContentArchiveItem, ContentArchiveListQuery, ContentArchiveListResponse } from "@toolbox/shared";
import { contentArchiveApi } from "./content-api";
import { useRequestScope } from "../../composables/useRequestScope";
import { isApiErrorCancelled } from "../../services/http";

export function useArchiveCollection(reportError: (error: unknown) => void) {
  const scope = useRequestScope();
  const keyword = ref("");
  const typeFilter = ref<NonNullable<ContentArchiveListQuery["type"]>>("all");
  const platformFilter = ref<NonNullable<ContentArchiveListQuery["platform"]>>("all");
  const page = ref(1);
  const listLoading = ref(false);
  const archives = ref<ContentArchiveListResponse>({ items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 });
  const selectedArchiveIds = ref<string[]>([]);
  const current = ref<ContentArchiveItem>();
  const detail = ref<ContentArchiveItem>();
  const drawerOpen = ref(false);
  let listGeneration = 0;
  let detailGeneration = 0;
  let listController: AbortController | undefined;
  let detailController: AbortController | undefined;

  function filter() {
    return { keyword: keyword.value, type: typeFilter.value, platform: platformFilter.value };
  }
  function invalidateList() {
    listGeneration++;
    listController?.abort();
    listLoading.value = false;
    selectedArchiveIds.value = [];
  }
  // 搜索文字变化只重置分页，不逐字发送请求；类型/平台切换自动读取新范围。
  watch(
    [keyword, typeFilter, platformFilter],
    () => {
      invalidateList();
      page.value = 1;
    },
    { flush: "sync" }
  );
  watch([typeFilter, platformFilter], () => void loadArchives());
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
      const result = await contentArchiveApi.list({ ...filter(), page: page.value, pageSize: 12 }, signal);
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
    page,
    listLoading,
    archives,
    selectedArchiveIds,
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
