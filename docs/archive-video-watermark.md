# 归档视频水印

在多媒体内容归档详情或获取结果中，选择视频或 Live Photo 视频，点击「添加水印」。已保存水印的媒体显示「编辑水印」。「编辑配乐」同样跳转到归档视频编辑页面，并默认打开配乐面板；两个面板可在编辑页内切换。图集生成视频仍使用原有弹窗。

## 使用

1. 点击或拖入 PNG、JPG、WebP 静态图片；建议使用透明 PNG。单张最多 20 MiB、最长边 8192 像素、总像素不超过 4000 万，不接受 SVG 或动态图片。
2. 调整透明度、宽度、显示起止时间。透明度与图片原有 Alpha 相乘；宽度按视频宽度比例设置，保持图片比例并限制在画面内。
3. 选择固定位置、直线移动、往返、碰边反弹或自定义关键帧。九宫格或拖动画面设置位置；方向键微调。运动位置按水印在可移动区域内的比例记录。
4. 自定义轨迹至少需要 2 个、最多 20 个关键帧。可以在当前播放位置添加，修改时间、定位后拖动、删除。时间必须递增且在水印显示区间内；最后一个关键帧后保持位置。
5. 播放查看即时水印效果；「生成 15 秒水印效果」使用真实 FFmpeg 渲染，同时包含配乐和音量设置。时间始终以完整原视频为准，中途预览不重置轨迹。
6. 「保存为最新版本」完成后，归档播放、下载和 ZIP 使用新成品。关闭页面不取消已开始的后台任务；任务运行时可停止，最终提交期间等待完成。

### 反弹轨迹样式

在「运动方式 → 碰边反弹 → 反弹轨迹」中，除原有经典斜向反弹外，可选择六种新增样式：Z 型折返、多段锯齿反弹、交叉穿梭反弹、长短交替反弹、多边不规则巡游、随机碰边巡游。

新增样式按「一轮往返」设置完整周期，可用方向选项镜像路线，九宫格或拖动调整起点。随机巡游生成固定种子的伪随机边界路点；「换一条随机轨迹」才更换种子。因此同一方案的播放、跳转、预览、重新打开和最终导出保持一致，不逐帧随机跳动。旧归档未指定样式时，继续使用原有斜向反弹。

### 保存与复用关键帧预设

1. 切换「自定义关键帧」，设置至少两个关键帧，在「轨迹预设」中填写名称并保存。
2. 下次编辑其他视频时，上传或选择该视频自己的水印，切换「自定义关键帧」，选择方案并点击「应用预设」。保存当前视频后正式生效。
3. 预设按水印显示区间的时间比例存储，自动适配新视频。例如 20 秒视频中 0、10、20 秒的关键帧，应用到 40 秒的完整显示区间后变为 0、20、40 秒。
4. 预设只包含轨迹，不包含原视频、水印图片、透明度、大小或配乐。这些参数沿用目标视频当前设置。删除预设不会改变已应用到视频的轨迹。

预设保存在应用 SQLite 数据库，跨视频、刷新和重启后可复用；通过同一主机的 LAN 页面也共用该库。最多保存 200 个，支持选择、搜索、刷新和确认删除；同名方案会提示更换名称。它与归档记录独立，删除源归档不删除预设。

### 水印素材库

在「水印设置 → 水印库」点击「从库中选择」，可查看透明底缩略图、按名称搜索并点击使用。点击「上传入库并使用」保存常用 Logo；支持 PNG/JPG/WebP 静态图片，每张不超过 20 MiB，规范化为带 Alpha 的 PNG。同样的规范化内容只入库一次，不因文件名不同重复占用空间。最多保存 200 张、合计 256 MiB，分页展示；素材长期保留，支持确认删除。

库中只保存图片。选择时创建当前视频专属的临时草稿，保留已经设置的透明度、大小、显示时间、轨迹及配乐；点击「保存为最新版本」后才修改归档视频。删除库素材不影响已选草稿或已保存视频，其他视频也能继续使用该库。顶部直接上传仍是单次草稿，不自动长期入库；需要复用的图片请通过库内上传。

素材文件位于归档根目录的 `watermark-library/`，默认是 `storage/xhs-archive/watermark-library/`；记录及文件索引保存在应用 SQLite 数据库。备份时同时保留数据库和素材目录，桌面数据迁移继续随整个数据根目录搬移。水印库独立于作品目录、临时草稿和轨迹预设，草稿过期清理、删除某个作品或删除轨迹预设均不会清空水印库。

直线模式的时间表示起点到终点的时长；往返表示完整来回的周期；反弹表示横穿可移动区域所需时间。横竖方向均有运动的反弹模式在各自边界反向。

## 保存与资源规则

- 始终从原片和当前完整编辑配置生成。换音乐保留水印，换水印保留音乐，不对上一次成品重复叠加。
- 「移除水印」只清除水印；「恢复原始视频」同时移除配乐、音量修改和水印。
- 长期保留原片、最新成品、当前配乐和当前水印。旧成品及被替换的编辑素材在提交成功且读取结束后清理，不保留无限历史版本。
- 未保存的水印属于**新增的临时上传草稿**，24 小时后清理；保存成功的草稿在其读取结束后即可回收。排队和运行中的任务持有租约，清理不会删除其输入。此规则不改变已有归档保留策略。
- 水印快照独立保存在该作品目录，并计入归档容量。草稿上传通过大小、数量和磁盘空间限制控制资源使用，同时最多保留 32 个未回收草稿；保存成功后释放对应草稿额度。永久素材库使用独立目录与容量限额，不改变作品、成品或草稿的保留规则。
- 沿用现有版本/摘要冲突检查、作品编辑锁、文件提交和回滚。失败或取消不替换当前成品；新媒体与最终任务记录提交后才发布成功。
- 使用已安装的 FFmpeg/FFprobe 和 Sharp，不新增模型、Python 包或修改签名能力包。加水印必须重新编码，保存可能慢于仅配乐，文件大小也可能变化。沿用现有时长、超时和空间边界。

## 兼容与实现位置

- 现有 `audio-edits`、`video-edits` API 和 `audioEdit` 元数据保留名称，新增可选 `watermark` 配置。
- 请求省略 `watermark` 保留已有水印；`null` 明确移除；对象包含 `settings`，首次上传或更换图片时另带 `draftId`。历史无水印记录无需转换。
- 上传：`POST /api/v1/tools/media-archive/items/:id/media/:mediaId/watermarks`，multipart 字段 `file`。
- 草稿预览：`GET .../watermarks/:draftId`，草稿绑定作品和媒体，不接受客户端路径。
- 保存的水印预览：`GET .../saved-watermark`。
- 轨迹预设：`GET/POST /api/v1/tools/media-archive/watermark-presets`，`DELETE .../watermark-presets/:presetId?revision=1`。
- 素材库：`GET/POST /api/v1/tools/media-archive/watermark-library`；`GET .../watermark-library/:watermarkId/image`；`DELETE .../watermark-library/:watermarkId?revision=1`。
- 选择素材：`POST .../items/:id/media/:mediaId/watermarks/from-library`，请求 `{ "libraryId": "素材ID" }`，返回当前视频专属草稿，不直接引用库文件。
- 前端页面：`/tools/media-archive/video-editor/:itemId/:mediaId`；`panel=audio` 打开配乐，其余值默认打开水印。返回列表恢复筛选、排序和页码，返回后可反复进入编辑页。
- 公共参数和轨迹计算在 `packages/shared/src/archive/video-watermark.ts`；后台实现集中于 `apps/api/src/domains/content-archive/video-edit/`；前端集中于 `apps/web/src/features/content-archive/`。

## 回归验证

```powershell
pnpm --filter @toolbox/shared test -- archive-watermark
pnpm --filter backend test -- src/__tests__/archive-video-edit.test.ts src/__tests__/archive-watermark-render.test.ts
pnpm --filter frontend test -- --maxWorkers=2 --minWorkers=1 src/features/content-archive/ArchiveAudioEditor.test.ts src/features/content-archive/ArchiveWatermarkControls.test.ts src/features/content-archive/ArchiveWatermarkPreview.test.ts src/features/content-archive/ArchiveVideoEditorPage.test.ts
```

真实渲染测试只使用临时合成视频、透明图片及音频，不读取业务素材或运行模型。优先通过 `TEST_FFMPEG_PATH`、`TEST_FFPROBE_PATH` 指定既有能力运行时；默认使用 PATH 中的工具。工具缺失时该测试组明确跳过，不能据此宣称真实编码已验收。页面视觉效果由用户自行验收，不自动截图或制作桌面安装包。
