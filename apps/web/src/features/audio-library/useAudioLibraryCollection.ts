import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { TreeOption } from "naive-ui";
import type { AudioLibraryList } from "@toolbox/shared";
import { audioLibraryApi as api } from "./api";
import { groupOptions, languages, languageLabel } from "./presentation";
import { formatApiError } from "../../shared/http/http";
export function useAudioLibraryCollection() {
  const data = ref<AudioLibraryList>(),
    loading = ref(false),
    error = ref(""),
    selected = ref<string[]>([]);
  const views = [
    { label: "全部音频", value: "all" },
    { label: "配音素材", value: "speech" },
    { label: "背景音乐", value: "music" },
    { label: "未分组", value: "ungrouped" },
    { label: "待补全文案", value: "incomplete" },
    { label: "回收站", value: "trash" }
  ];
  const view = ref("all"),
    groupId = ref<string | null>(null),
    keyword = ref(""),
    language = ref<string | null>(null),
    source = ref<string | null>(null),
    sort = ref("createdAt"),
    page = ref(1);
  const groups = computed(() => groupOptions(data.value?.groups || []));
  const tree = computed(() => {
    const visit = (parentId: string | null): TreeOption[] =>
      (data.value?.groups || [])
        .filter((x) => x.parentId === parentId)
        .map((x) => ({ key: x.id, label: x.name, children: visit(x.id) }));
    return visit(null);
  });
  const languageOptions = computed(() =>
    [...new Set([...Object.keys(languages), ...(data.value?.items.map((x) => x.language) || [])])].map((value) => ({
      label: languageLabel(value),
      value
    }))
  );
  let request = 0,
    debounce: ReturnType<typeof setTimeout> | undefined,
    disposed = false;
  async function load() {
    const current = ++request;
    loading.value = true;
    try {
      const result = await api.list({
        view: view.value,
        groupId: groupId.value || undefined,
        keyword: keyword.value,
        language: language.value || undefined,
        source: source.value || undefined,
        sort: sort.value,
        page: page.value
      });
      if (current === request && !disposed) {
        data.value = result;
        selected.value = [];
        error.value = "";
      }
    } catch (e) {
      if (current === request && !disposed) error.value = formatApiError(e);
    } finally {
      if (current === request) loading.value = false;
    }
  }
  watch([view, groupId, language, source, sort], () => {
    page.value = 1;
    void load();
  });
  watch(page, () => void load());
  watch(keyword, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      page.value = 1;
      void load();
    }, 250);
  });
  onMounted(() => void load());
  onBeforeUnmount(() => {
    disposed = true;
    request++;
    if (debounce) clearTimeout(debounce);
  });
  function chooseView(value: string) {
    groupId.value = null;
    view.value = value;
  }
  function selectGroup(keys: Array<string | number>) {
    groupId.value = keys.length ? String(keys[0]) : null;
    view.value = "all";
  }
  function selectAll(checked: boolean) {
    selected.value = checked ? data.value?.items.map((x) => x.id) || [] : [];
  }
  function toggleItem(id: string, checked: boolean) {
    selected.value = checked ? [...selected.value, id] : selected.value.filter((x) => x !== id);
  }

  return {
    data,
    loading,
    error,
    selected,
    views,
    view,
    groupId,
    keyword,
    language,
    source,
    sort,
    page,
    groups,
    tree,
    languageOptions,
    load,
    chooseView,
    selectGroup,
    selectAll,
    toggleItem
  };
}
export type AudioLibraryCollection = ReturnType<typeof useAudioLibraryCollection>;
