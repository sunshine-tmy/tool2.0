import type { Guide, GuideStep } from "./guides";
import {
  CHATTERBOX_MAX_TEXT_LENGTH,
  CHATTERBOX_MAX_BATCH_SEGMENTS,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  EDGE_TTS_MAX_BATCH_SEGMENTS,
  EDGE_TTS_MAX_BATCH_TEXT_LENGTH,
  EDGE_TTS_MAX_TRANSLATION_LENGTH
} from "@toolbox/shared";

const s = (
  id: string,
  target: string,
  title: string,
  description: string,
  fallbackTarget?: string,
  context?: string
): GuideStep => ({ id, target, title, description, fallbackTarget, context });
const archive = (id: string, title: string, context: string, steps: GuideStep[]): Guide => ({
  id,
  title,
  context,
  steps,
  version: 1,
  module: "多媒体内容归档",
  route: "/tools/media-archive",
  root: "archive-page"
});
const upload = "archive-upload-dialog",
  table = "archive-table-dialog",
  profile = "archive-profile-dialog",
  detail = "archive-detail-dialog";

export const detailedGuides: Guide[] = [
  archive("archive-upload", "本地视频批量归档", "archive-upload", [
    s(
      "requirements",
      "archive-upload-requirements",
      "文件要求",
      "阅读格式、数量、大小、时长及 FFmpeg 运行时要求。导入保留原文件，不会重新编码。",
      upload
    ),
    s(
      "files",
      "archive-upload-files",
      "选择多个视频",
      "结束教程后可一次选择多个视频。教程不打开文件选择器，也不添加文件。",
      upload
    ),
    s(
      "group",
      "archive-upload-group",
      "目标分组",
      "选择这些视频成功归档后的分组；未指定时遵守当前页面的默认规则。",
      upload
    ),
    s(
      "queue",
      "archive-upload-queue",
      "上传列表与状态",
      "列表显示待上传文件、标题、进度及归档结果。没有文件时先了解入口，结束教程后再选择。",
      upload
    ),
    s(
      "actions",
      "archive-upload-actions",
      "开始、停止与重试",
      "开始批量归档会逐条处理。停止只停止剩余上传；失败或已停止项可重试。清空只移除当前上传列表，不删除归档作品。",
      upload
    )
  ]),
  archive("archive-table", "表格批量归档", "archive-table", [
    s(
      "template",
      "archive-table-files",
      "模板与文件",
      "可下载 Excel 或 CSV 模板。作品链接是必填列，平台是可选列；文件及条数限制以提示为准。",
      table
    ),
    s(
      "validation",
      "archive-table-preview",
      "导入校验与预览",
      "选择表格后检查解析结果：无效链接和表内重复项会跳过，不要直接忽略错误行。当前没有表格时，教程不会生成预览行。",
      table
    ),
    s(
      "options",
      "archive-table-options",
      "已有作品与目标分组",
      "确认已有归档的处理方式及成功结果分组，再决定是否执行。教程不更改任何选项。",
      table
    ),
    s(
      "start",
      "archive-table-confirm",
      "确认执行",
      "只有你点击“确认并开始归档”才会创建批次。先核对可执行条数、分组和重复项。",
      table
    ),
    s(
      "progress",
      "archive-table-progress",
      "进度、停止与失败重试",
      "批次按实际状态显示进度。停止、重试与删除批次是不同操作；删除记录不会删除已归档作品。关闭弹窗不等于停止后台任务。",
      table
    ),
    s(
      "history",
      "archive-table-history",
      "历史批次",
      "可切换、搜索和刷新历史批次，查看每条作品结果。没有历史时，结束教程后再导入真实表格。",
      table
    )
  ]),
  archive("archive-profile", "TikTok 主页批量归档", "archive-profile", [
    s(
      "input",
      "archive-profile-input",
      "主页地址与读取入口",
      "填入用户主页地址后，主动点击读取作品才会开始采集；教程只展示弹窗，不读取主页。",
      profile
    ),
    s(
      "login",
      "archive-profile-help",
      "登录、验证与后台任务",
      "读取时可能打开运行服务电脑上的独立浏览器。登录或验证需要你自行完成；关闭此弹窗不会停止任务。",
      profile
    ),
    s(
      "history",
      "archive-profile-history",
      "主页任务历史",
      "切换历史可查看已读取的任务，刷新只用于同步现有状态。教程不会替你选择其他历史任务。",
      profile
    ),
    s(
      "works",
      "archive-profile-works",
      "作品列表与归档范围",
      "读取成功后核对作品列表及批量归档范围。没有读取结果时保留真实空状态，不虚构作品。",
      profile
    ),
    s(
      "actions",
      "archive-profile-actions",
      "批量归档、停止与记录",
      "按实际状态使用归档及停止入口。删除主页任务记录与删除作品不同，具体影响以确认提示为准。",
      profile
    ),
    s(
      "collector",
      "archive-profile-collector",
      "普通浏览器采集备用流程",
      "自动窗口异常时，可下载采集助手、安装采集书签，在正常浏览器中采集后粘贴作品链接导入。本教程只展开说明，不下载、复制、打开外部页面或导入链接。",
      profile,
      "archive-profile-collector"
    )
  ]),
  archive("archive-detail", "归档详情与媒体操作", "archive-detail", [
    s(
      "preview",
      "archive-detail-gallery",
      "真实归档与媒体预览",
      "这里展示真实归档。教程优先使用当前详情，其次是当前页已选作品，再使用当前页第一条作品；不会创建演示归档。",
      detail
    ),
    s(
      "switch",
      "archive-detail-thumbnails",
      "切换媒体",
      "缩略图可切换视频、图片和截帧。教程保留当前媒体选择，不自动播放或切换素材。",
      detail
    ),
    s(
      "media",
      "archive-detail-media-actions",
      "当前媒体下载与截帧",
      "可以下载当前媒体。视频播放到需要的位置后，可保存当前帧；图片或未就绪的视频不提供相同操作。教程不会保存截帧。",
      detail
    ),
    s(
      "editor",
      "archive-detail-media-actions",
      "视频编辑与图集生成",
      "视频可进入独立编辑模块，保存后同步关联归档；图集可生成附加视频。点击这些入口可能开始新的工作流程，教程不会执行。",
      detail
    ),
    s(
      "text",
      "archive-detail-text",
      "归档信息与译文",
      "查看作者、来源、正文和译文；不同作品的可用内容可能不同。",
      detail
    ),
    s(
      "soundtrack",
      "archive-detail-soundtrack",
      "原作品配乐",
      "归档带有原配乐时，可在此试听和下载。当前作品未归档原配乐时不显示播放器，教程不会自动播放或提取音频。",
      "archive-detail-gallery"
    ),
    s(
      "footer",
      "archive-detail-actions",
      "ZIP、发布标记与删除",
      "下载全部 ZIP 会包含当前归档媒体。发布标记只是整理状态；删除归档、生成英文及保存翻译需要你主动执行并遵守原有确认规则。",
      detail
    )
  ]),
  archive("archive-groups", "分组管理", "archive-groups-overview", [
    s("filter", "archive-group-filter", "按分组筛选", "分组筛选只改变展示范围。可组合选择已有分组与未分组作品。"),
    s(
      "name",
      "archive-group-name",
      "新建或编辑分组",
      "名称输入框用于新建或编辑分组。教程保留已有输入，只展示当前表单，不调用保存。",
      "archive-group-root",
      "archive-group-edit"
    ),
    s(
      "parent",
      "archive-group-parent",
      "选择上级分组",
      "可以选择上级分组，最多三级；不选择时使用顶级分组。结束教程后再填写并保存。",
      "archive-group-root",
      "archive-group-edit"
    ),
    s(
      "manage",
      "archive-group-management",
      "管理分组",
      "管理菜单提供重命名、删除和刷新。先选中目标分组；删除只在你主动确认后执行，教程不打开危险确认框。",
      "archive-group-root",
      "archive-group-management"
    ),
    s(
      "move",
      "archive-group-move-target",
      "移动所选作品",
      "先在归档列表选中作品，再打开移动到分组，核对目标和作品数量后确认。未选择作品时不自动勾选。",
      "archive-group-root",
      "archive-group-move"
    )
  ]),
  archive("archive-translation", "英文编辑", "archive-translation", [
    s(
      "title",
      "archive-translation-title",
      "编辑英文标题",
      "这里编辑真实归档已有的英文译文。机器翻译与人工编辑分别保留，教程不会生成翻译或覆盖输入。",
      "archive-translation-dialog"
    ),
    s(
      "body",
      "archive-translation-body",
      "正文与话题",
      "分别核对正文和话题译文，不同作品可能没有正文或话题。输入限制以表单为准。",
      "archive-translation-dialog"
    ),
    s(
      "topics",
      "archive-translation-topics",
      "话题译文",
      "有话题时逐条编辑对应英文，保留与原话题的对应关系。当前作品没有话题时不新增空字段。",
      "archive-translation-body"
    ),
    s(
      "save",
      "archive-translation-actions",
      "取消、保存与版本",
      "保存会写入人工编辑；取消不保存。后台归档变更时仍遵守原有版本校验。教程不会点击保存或恢复机器翻译。",
      "archive-translation-dialog"
    )
  ]),
  ...(["watermark", "audio"] as const).map((mode) =>
    archive(
      `archive-images-${mode}`,
      mode === "watermark" ? "图文批量加水印" : "图文批量配乐",
      `archive-images-${mode}`,
      [
        s(
          "source",
          "archive-image-queue",
          "已选图文与真实队列",
          "本章只使用你已经选中的适用图文。每条图文按原图顺序生成附加视频，原图保留；教程不会勾选作品或启动生成。",
          "archive-image-dialog"
        ),
        s(
          "settings",
          "archive-image-settings",
          "水印、配乐与画幅",
          "根据当前模式选择素材并配置停留时长、画幅及水印或音乐。已有设置会保留，教程不选择素材或更改参数。",
          "archive-image-dialog"
        ),
        s(
          "progress",
          "archive-image-queue",
          "生成队列与状态",
          "处理时逐条排队，失败不会影响其他作品；运行中的队列不能作为可重置的教学示例。当前列表没有结果时不会伪造进度。",
          "archive-image-dialog"
        ),
        s(
          "preview",
          "archive-image-queue",
          "预览效果与保存成品",
          "预览效果可能需要生成完整视频，预览成品读取已保存结果。教程只讲解入口，不触发新预览任务。",
          "archive-image-dialog"
        ),
        s(
          "actions",
          "archive-image-actions",
          "保存、停止与关闭",
          "开始批量保存会修改归档；停止后续处理仍允许当前项完成。收起窗口不一定停止任务，离开页面的行为以提示为准。教程不会保存、取消或恢复队列。",
          "archive-image-dialog"
        )
      ]
    )
  ),
  {
    id: "subtitle-ranges",
    title: "上传后：区间编辑",
    version: 1,
    module: "视频去字幕",
    route: "/tools/video-subtitle",
    root: "subtitle-page",
    ready: '[data-tour="subtitle-edit-ready"][data-tour-ready="true"]',
    prerequisite: "请先上传原视频并等待加载完成，在没有任务占用时学习区间编辑。",
    steps: [
      s(
        "add",
        "subtitle-add-range",
        "从指针添加区间",
        "结束教程后先把指针移到字幕出现处，再添加区间。默认长度 2 秒，视频结尾不足 2 秒时缩短；到视频末尾不能继续添加。",
        "subtitle-range-tools"
      ),
      s(
        "select",
        "subtitle-timeline-track",
        "选择一个或多个区间",
        "点击片段选择单个区间；在空白区域拖动可框选多个区间。选中状态决定哪些操作可用。教程不会创建或选择区间。",
        "subtitle-timeline"
      ),
      s(
        "trim",
        "subtitle-range-start",
        "调整起止时间",
        "拖动片段左右端点调整生效时间；聚焦端点后按左右方向键以 0.01 秒微调。当前没有区间时，结束教程后先添加；区间不能超出视频范围。",
        "subtitle-timeline"
      ),
      s(
        "move",
        "subtitle-range-clip",
        "移动整个区间",
        "拖动整个片段改变其时间位置。重叠区间会分行展示，每个区间保留自己的字幕框。",
        "subtitle-timeline"
      ),
      s(
        "split",
        "subtitle-range-split",
        "拆分与按指针裁剪",
        "将指针移到所选区间内部再拆分（Ctrl+B / ⌘B），两段分别保留字幕框。工具栏还可按指针裁掉前段（Q）或后段（W）；位于端点时不能拆分。",
        "subtitle-range-tools"
      ),
      s(
        "remove",
        "subtitle-range-remove",
        "删除区间与字幕框",
        "可删除当前区间或框选的多个区间，也可按 Delete / Backspace。删除区间会连同它的字幕框一起移除，不等同于只删除某个框。没有选中区间时，本步只讲解工具栏。",
        "subtitle-range-tools"
      ),
      s(
        "undo",
        "subtitle-timeline-toolbar",
        "撤回、缩放与吸附",
        "撤回可恢复编辑步骤，缩放帮助精确定位，自动吸附帮助对齐时间。教程不会改动当前缩放、吸附或编辑历史。",
        "subtitle-range-tools"
      )
    ]
  },
  {
    id: "subtitle-manual",
    title: "上传后：手动框选",
    version: 1,
    module: "视频去字幕",
    route: "/tools/video-subtitle",
    root: "subtitle-page",
    ready: '[data-tour="subtitle-edit-ready"][data-tour-ready="true"]',
    prerequisite: "请先上传原视频并等待加载完成，在没有任务占用时学习框选。",
    steps: [
      s(
        "time",
        "subtitle-timeline",
        "先选区间并定位指针",
        "选择需要处理的区间，再将指针移入区间。字幕框只在对应区间内生效；当前没有区间时需在结束教程后添加。",
        "subtitle-surface"
      ),
      s(
        "mode",
        "subtitle-manual-mode",
        "进入手动框选",
        "点击手动框选才进入绘制模式。此操作可能自动新增区间，因此教程不会替你开启；指针不在当前区间内时不能绘制。",
        "subtitle-region-tools"
      ),
      s(
        "draw",
        "subtitle-draw-overlay",
        "拖动绘制字幕框",
        "在视频上按住并拖动，尽量只覆盖字幕，避免人物和商品。没有开启手动模式时，这里只高亮视频区域进行讲解。",
        "subtitle-surface"
      ),
      s(
        "adjust",
        "subtitle-region",
        "调整字幕框位置与大小",
        "选中已有字幕框后可拖动位置、拖动边角调整大小。没有现成字幕框时，不生成示例框或改变你的数据。",
        "subtitle-surface"
      ),
      s(
        "remove",
        "subtitle-region-tools",
        "多个框与不同删除范围",
        "同一区间可以有多个字幕框。删除字幕框只删除该框；删除区间会移除区间内所有框；清除全部区域会移除现有区域设置。教程不会执行任何一种删除。"
      ),
      s(
        "finish",
        "subtitle-manual-mode",
        "完成并检查其他时间",
        "完成框选后检查其他字幕出现的位置，必要时为不同时间段设置区间和字幕框，再选择修复档位开始处理。",
        "subtitle-region-tools"
      )
    ]
  },
  ...(["clone", "online"] as const).map((mode): Guide => ({
    id: `speech-${mode}-segments`,
    title: mode === "clone" ? "音色克隆：智能识别分段" : "在线配音：智能识别分段",
    version: 1,
    module: "多国语言配音",
    route: "/tools/edge-tts",
    root: mode === "clone" ? "speech-clone" : "speech-online",
    context: `${mode}-segments`,
    prerequisite: `请先切换到${mode === "clone" ? "参考音色克隆" : "在线配音"}。教程不会自动切换引擎。`,
    steps: [
      s(
        "format",
        `${mode}-segments-help`,
        "编号、段落与双语文案",
        "按编号或段落组织文案，原文和中文译文对应排列。读取规则和长度限制以当前引擎的说明为准。",
        `${mode}-segments-dialog`
      ),
      s(
        "input",
        `${mode}-segments-input`,
        "粘贴与格式清理",
        "粘贴时会清理格式标记并保留编号、段落换行。教程不自动粘贴示例，已有输入保持不变。",
        `${mode}-segments-dialog`
      ),
      s(
        "preview",
        `${mode}-segments-preview`,
        "检查段数、原文和译文",
        "输入有效文案后，这里显示真实识别段数和双语预览。空输入时保留空状态，不伪造识别结果。",
        `${mode}-segments-dialog`
      ),
      s(
        "limits",
        `${mode}-segments-preview`,
        "空结果与长度限制",
        mode === "clone"
          ? `克隆批次最多 ${CHATTERBOX_MAX_BATCH_SEGMENTS} 段、原文合计 ${CHATTERBOX_MAX_BATCH_TEXT_LENGTH} 字符，单段原文最多 ${CHATTERBOX_MAX_TEXT_LENGTH}、中文最多 ${CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH} 字符。空结果或超限时先修改输入，再自行填入。`
          : `在线批次最多 ${EDGE_TTS_MAX_BATCH_SEGMENTS} 段、原文合计 ${EDGE_TTS_MAX_BATCH_TEXT_LENGTH} 字符，每段中文最多 ${EDGE_TTS_MAX_TRANSLATION_LENGTH} 字符。空结果或超限时先修改输入，再自行填入。`,
        `${mode}-segments-dialog`
      ),
      s(
        "apply",
        `${mode}-segments-actions`,
        "填入、覆盖与取消",
        "识别并填入会替换当前分段文案，已有内容时仍遵守原有覆盖确认。取消或关闭不填入。本教程不会点击填入或触发覆盖确认。",
        `${mode}-segments-dialog`
      )
    ]
  }))
];
