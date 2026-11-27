import { contextUnavailable } from "./contexts";
import { detailedGuides } from "./detailed-guides";
export type GuideStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  missing?: string;
  context?: string;
  fallbackTarget?: string;
};
export type Guide = {
  id: string;
  version: number;
  module: string;
  title: string;
  route: string;
  root: string;
  prerequisite?: string;
  ready?: string;
  context?: string;
  steps: GuideStep[];
};

const step = (id: string, title: string, description: string, missing?: string): GuideStep => ({
  id,
  target: id,
  title,
  description,
  missing
});

export const guides: Guide[] = [
  {
    id: "archive-basics",
    version: 2,
    module: "多媒体内容归档",
    title: "获取与整理",
    route: "/tools/media-archive",
    root: "archive-page",
    steps: [
      step(
        "archive-link",
        "分享链接归档",
        "把作品链接或分享文案粘贴到这里，再点击“获取并存档”。支持小红书、抖音和 TikTok。教程不会自动提交链接。"
      ),
      step(
        "archive-source",
        "选择平台与归档分组",
        "可以自动识别来源平台，并为本次归档指定分组。已有作品会遵守页面显示的分组规则。"
      ),
      step(
        "archive-import",
        "批量与本地导入",
        "这里提供本地视频、表格和 TikTok 主页批量归档入口。结束引导后，根据素材来源选择入口。"
      ),
      step("archive-search", "搜索与筛选", "按标题、正文或作者搜索，再结合类型、平台、发布标记和排序缩小范围。"),
      step(
        "archive-list",
        "浏览与整理归档",
        "归档列表支持卡片和列表展示、分组、分页及批量操作。列表为空时，先从上方获取或导入素材。"
      ),
      {
        ...step(
          "archive-detail",
          "详情、下载与编辑",
          "点击归档卡片打开详情，可预览、下载素材，并从视频操作进入视频编辑。关联归档的工程保存后会同步更新归档内容。"
        ),
        target: "archive-list"
      }
    ]
  },
  {
    id: "subtitle-basics",
    version: 2,
    module: "视频去字幕",
    title: "视频去字幕处理流程",
    route: "/tools/video-subtitle",
    root: "subtitle-page",
    steps: [
      step(
        "subtitle-health",
        "先确认服务状态",
        "绿点表示服务可用，黄点表示检查中或部分可用，红点表示不可用。点击状态点可查看详情与刷新入口。"
      ),
      step(
        "subtitle-upload",
        "上传待处理视频",
        "选择包含画面内硬字幕的视频。原视频与处理结果会分别保留，请先确认当前上传限制。"
      ),
      step(
        "subtitle-preview",
        "播放与定位字幕",
        "上传后播放原视频，拖动播放指针检查字幕出现的时间和位置。区间编辑及手动框选有独立详细章节；没有视频时先结束教程并上传。"
      ),
      step(
        "subtitle-detect",
        "自动检测与真实结果",
        "自动检测会读取视频并识别字幕区域，需要你主动点击。已有结果时检查预览中的真实区域；尚未检测时只介绍入口，教程不会执行检测。"
      ),
      step(
        "subtitle-settings",
        "选择修复方式",
        "结合字幕区域与画面选择修复档位。不可用档位需要先检查对应能力包；检查处理区域后再开始。"
      ),
      step(
        "subtitle-start",
        "开始、进度与取消",
        "配置完成后点击开始处理，任务区域会显示实际进度；运行时可以取消。引导只说明操作，不会创建任务。"
      ),
      step(
        "subtitle-history",
        "查看和下载结果",
        "处理记录中可以查看、下载结果或继续编辑。没有记录时，请在结束引导后先完成一次处理。"
      )
    ]
  },
  {
    id: "editor-home",
    version: 2,
    module: "视频编辑",
    title: "开始创作与草稿",
    route: "/tools/video-editor",
    root: "editor-home",
    steps: [
      step(
        "editor-create",
        "开始创作",
        "导入本地视频，或从已有归档中选择视频开始编辑。教程不会打开文件选择器或创建草稿。"
      ),
      step("editor-draft-search", "搜索与切换展示", "使用草稿名称搜索，或切换网格和列表视图；刷新可重新读取本地草稿。"),
      step(
        "editor-drafts",
        "打开与管理草稿",
        "点击草稿封面继续编辑。每条草稿提供重命名、复制与删除操作；删除仍使用原有确认流程。打开真实工程后，可从目录学习编辑工作台。"
      )
    ]
  },
  {
    id: "editor-workspace",
    version: 1,
    module: "视频编辑",
    title: "编辑工作台",
    route: "/tools/video-editor",
    root: "editor-workspace",
    ready: '[data-tour="editor-workspace"][data-tour-ready="true"]',
    prerequisite: "请先创建或打开真实视频工程，并等待时间线加载完成，再开始工作台教程。",
    steps: [
      step(
        "editor-materials",
        "添加素材",
        "素材区提供视频、音频、文本和水印入口。可导入本地素材或选择已有素材，再添加到时间线；本地音频只保留在草稿中。"
      ),
      step(
        "editor-preview",
        "画布预览",
        "所有编辑会实时应用到预览。底部可播放、切换成片画幅及进入全屏；画幅也是实际导出的尺寸比例。"
      ),
      step(
        "editor-timeline",
        "时间线与常用操作",
        "点击素材进行选择，拖动调整位置；工具栏提供拆分、撤销、删除及视频专用操作。复制和粘贴使用 Ctrl/Cmd+C、Ctrl/Cmd+V。"
      ),
      step(
        "editor-inspector",
        "按素材类型编辑属性",
        "选中视频、音频、文本或水印后，右侧显示对应属性。没有选择素材时先在时间线上选择；引导不会改变当前选择。"
      ),
      step(
        "editor-save",
        "保存成品与补帧",
        "点击保存后在保存设置中确认输出帧率；智能补帧默认关闭，只有主动开启才会处理。关联归档的工程保存后会同步归档。"
      ),
      step(
        "editor-navigation",
        "返回草稿或归档",
        "可以返回草稿主页；关联归档的工程还提供返回归档入口。离开前仍按原有规则处理未保存内容。"
      )
    ]
  },
  {
    id: "speech-clone",
    version: 2,
    module: "多国语言配音",
    title: "参考音色克隆",
    route: "/tools/edge-tts",
    root: "speech-clone",
    prerequisite: "请先切换到“参考音色克隆”，再开始本章。引导不会自动切换引擎或覆盖文案。",
    steps: [
      step(
        "speech-health",
        "确认本机服务",
        "点击服务状态点查看本机音色克隆是否就绪。该功能在本机生成，第一次处理可能需要加载模型。"
      ),
      step(
        "clone-reference",
        "准备参考音色",
        "展开参考音色区域，上传已获授权的参考音频，或选择保存的音色。录音要求以页面说明为准；教程不会更换你的参考音色。"
      ),
      step(
        "clone-text",
        "输入有序文案",
        "按顺序添加需要生成的文案，可填写中文译文、分段及调整顺序。每段会生成独立音频，也可以得到顺序拼接的结果。"
      ),
      step(
        "clone-smart-segments",
        "智能识别分段",
        "从这里打开智能分段，粘贴带编号或分段的双语文案，检查真实预览后再填入。目录中的独立智能分段章节会讲解完整弹窗；教程不会覆盖原文。"
      ),
      step(
        "clone-settings",
        "配置语言和生成参数",
        "选择与文案对应的语言和可用设备，按需要调整生成参数及字幕选项。引导不会修改当前设置。"
      ),
      step(
        "clone-submit",
        "加入生成队列",
        "确认参考音色和文案后，再点击按钮创建批次。任务运行时可在当前批次中查看进度与取消操作。"
      ),
      step(
        "clone-history",
        "试听与下载",
        "批次记录中可试听、下载独立音频、总音频及字幕，也可重新生成。文件保留时间以页面显示为准。"
      )
    ]
  },
  {
    id: "speech-online",
    version: 2,
    module: "多国语言配音",
    title: "在线配音",
    route: "/tools/edge-tts",
    root: "speech-online",
    prerequisite: "请先切换到“在线配音”，再开始本章。引导不会自动切换引擎或覆盖文案。",
    steps: [
      step(
        "speech-privacy",
        "了解在线服务",
        "在线配音需要联网，外语文案会发送给微软在线语音服务。开始使用前请阅读页面的处理及留档说明。"
      ),
      step(
        "online-text",
        "填写有序文案",
        "按顺序编辑文案和译文，可按需要添加、删除及调整段落。教程不会填入示例或覆盖已有输入。"
      ),
      step(
        "online-smart-segments",
        "智能识别分段",
        "从这里打开在线配音自己的智能分段弹窗，检查原文、译文和段数后再填入。目录提供独立详细章节，教程不会切换引擎或覆盖已有分段。"
      ),
      step(
        "online-settings",
        "语言、音色与生成参数",
        "先选择语言与口音，再选择对应音色；音色加载完成后，按需使用预设或调整语速、音量、语调和字幕选项。教程不改动当前配置。"
      ),
      step(
        "online-submit",
        "开始生成",
        "文案和音色准备好后，点击生成按钮加入队列。任务进度和取消入口会在当前批次区域显示。"
      ),
      step(
        "online-history",
        "试听和下载结果",
        "从历史批次中查看、试听及下载音频与字幕。没有记录时，结束教程后再创建真实批次。"
      )
    ]
  },
  ...detailedGuides
];

export function visibleTarget(target: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)).find(
    (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden"
  );
}

export function guideUnavailable(guide: Guide): string {
  if (!visibleTarget(guide.root)) return guide.prerequisite ?? "请先进入对应模块。";
  if (guide.ready && !document.querySelector(guide.ready)) return guide.prerequisite ?? "页面仍在加载，请稍后开始。";
  return guide.context ? contextUnavailable(guide.context) : "";
}
