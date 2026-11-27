import type { Guide } from "./guides";

type ChapterEntry = { guideId: string; title?: string };
type ModuleDefinition = {
  id: string;
  title: string;
  route: string;
  groups: Array<{ id: string; title: string; chapters: ChapterEntry[] }>;
};
export type DirectoryChapter = { guide: Guide; title: string };
export type DirectoryModule = Omit<ModuleDefinition, "groups"> & {
  groups: Array<{ id: string; title: string; chapters: DirectoryChapter[] }>;
};

// Presentation taxonomy is separate from tutorial IDs, versions and progress.
export const directoryDefinitions: ModuleDefinition[] = [
  {
    id: "archive",
    title: "多媒体内容归档",
    route: "/tools/media-archive",
    groups: [
      { id: "intro", title: "新手入门", chapters: [{ guideId: "archive-basics" }] },
      {
        id: "import",
        title: "素材归档",
        chapters: [{ guideId: "archive-upload" }, { guideId: "archive-table" }, { guideId: "archive-profile" }]
      },
      {
        id: "organize",
        title: "内容整理",
        chapters: [{ guideId: "archive-detail" }, { guideId: "archive-groups" }, { guideId: "archive-translation" }]
      },
      {
        id: "images",
        title: "图文处理",
        chapters: [{ guideId: "archive-images-watermark" }, { guideId: "archive-images-audio" }]
      }
    ]
  },
  {
    id: "subtitle",
    title: "视频去字幕",
    route: "/tools/video-subtitle",
    groups: [
      { id: "basics", title: "基础流程", chapters: [{ guideId: "subtitle-basics" }] },
      {
        id: "editing",
        title: "精细编辑",
        chapters: [
          { guideId: "subtitle-ranges", title: "区间编辑" },
          { guideId: "subtitle-manual", title: "手动框选" }
        ]
      }
    ]
  },
  {
    id: "editor",
    title: "视频编辑",
    route: "/tools/video-editor",
    groups: [
      { id: "create", title: "开始创作", chapters: [{ guideId: "editor-home" }] },
      { id: "workspace", title: "编辑制作", chapters: [{ guideId: "editor-workspace" }] }
    ]
  },
  {
    id: "speech",
    title: "多国语言配音",
    route: "/tools/edge-tts",
    groups: [
      {
        id: "clone",
        title: "参考音色克隆",
        chapters: [
          { guideId: "speech-clone", title: "基础操作" },
          { guideId: "speech-clone-segments", title: "智能识别分段" }
        ]
      },
      {
        id: "online",
        title: "在线配音",
        chapters: [
          { guideId: "speech-online", title: "基础操作" },
          { guideId: "speech-online-segments", title: "智能识别分段" }
        ]
      }
    ]
  }
];

export function resolveGuideDirectory(guides: readonly Guide[]): DirectoryModule[] {
  const byId = new Map(guides.map((guide) => [guide.id, guide]));
  const assigned = new Set<string>();
  const result = directoryDefinitions.map((module) => ({
    ...module,
    groups: module.groups.map((group) => ({
      ...group,
      chapters: group.chapters.map(({ guideId, title }) => {
        const guide = byId.get(guideId);
        if (!guide || assigned.has(guideId) || guide.route !== module.route) {
          throw new Error(`Invalid onboarding directory entry: ${module.id}/${group.id}/${guideId}`);
        }
        assigned.add(guideId);
        return { guide, title: title ?? guide.title };
      })
    }))
  }));
  if (byId.size !== guides.length || assigned.size !== guides.length) {
    throw new Error("Every onboarding tutorial must appear exactly once in the directory");
  }
  return result;
}

export function directoryModuleForPath(directory: readonly DirectoryModule[], path: string) {
  return directory.find((module) => path === module.route || path.startsWith(`${module.route}/`));
}
