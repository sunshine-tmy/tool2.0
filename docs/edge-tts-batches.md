# 在线自然音色：有序文案与批次

在线模式保留语言、音色、语速、音量及音调预设，支持与参考音色克隆相同的常用批次流程：

- 编号双语文案智能识别、按空行拆分、添加、复制、删除、拖动与上下移动。
- 批次名称、每段外语、中文参考译文及文件名。清空只影响待提交草稿。
- 运行中继续提交新批次；每批最多 30 段、原文总计 20000 字符，每段中文最多 2000 字符。
- 提交仍受服务端队列总容量限制（默认 20 段，含单条任务、所有批次和正在生成的段落）。超过剩余容量时整批拒绝，不会只提交部分段落。
- 每段独立 MP3，按文案顺序合并 MP3，原文、中文、双语总 SRT，以及 ZIP 与文案清单。
- 批次分页、详情、选段入库、单段重生成、已结束批次重排和删除段落；取消只影响尚未开始的段落。
- 原单条生成历史可下载、删除或载入有序文案，不做破坏性迁移。

中文译文不发送给在线语音服务，也不会自动翻译；源文案和中文都会独立保存到音频库，默认未分组。入库按来源引擎、批次、段落和生成版本去重，不会将未提交的详情草稿配到旧音频上。删除源批次不会删除音频库副本。

在线模式不使用参考录音、克隆授权、GPU 或克隆推理参数。批次沿用单条任务的保留期限；服务端持久化批次及任务快照，重启后仍可查看或重试中断任务。总产物按需生成；多音频合并需要 FFmpeg，桌面模式只使用已安装、校验过的 FFmpeg 能力，不依赖 Chatterbox 环境。

开发环境可通过 `EDGE_TTS_FFMPEG_PATH` 配置 FFmpeg。桌面发行时需要同步重新构建应用和在线配音组件；新组件定义声明 Python 3.12 与 FFmpeg 依赖，已有签名目录和 Release 资产不会被源码修改自动覆盖。

验证入口：

```powershell
pnpm --filter frontend test src/modules/edge-tts src/modules/audio-library
pnpm --filter backend test src/__tests__/edge-tts-batch.test.ts src/__tests__/edge-tts.test.ts src/__tests__/audio-library.test.ts
$env:EDGE_TTS_LIVE = "1"
pnpm --filter backend test src/__tests__/edge-tts-live.test.ts
Remove-Item Env:\EDGE_TTS_LIVE
```

真实在线测试仅发送固定测试文案，在隔离临时存储中验证多语言独立/合并 MP3、字幕和 ZIP，不读取用户音色或素材库。
