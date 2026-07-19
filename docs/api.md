# API 参考

基础路径：`/api`。除文件流与导出外，接口使用统一 `{ success, message, data | error }` 响应结构。

## 系统

- `GET /api/health`：服务、转写、短视频 Provider 和图片 AI 配置状态。
- `GET /api/tools`：工具注册表。
- `GET /api/tasks`：最近的内存任务，默认最多保留 1000 条。
- `GET /api/tasks/:taskId`：读取一个内存任务。
- `GET /api/files/:fileName`：流式下载 `storage/outputs` 内的处理结果。

## 图片压缩

`POST /api/tools/image-compress` 使用 `multipart/form-data`：

- `file`：JPEG、PNG 或 WebP，最大 20 MiB、4000 万像素。
- `quality`：30–95。
- `outputFormat`：`jpeg | png | webp`。
- `width`：可选正整数，不放大原图。

返回输出大小、节省比例、任务和 `downloadUrl`。

## AI 图片处理

- `GET /api/tools/image-ai/health`：Worker、模型、设备、许可和摘要状态。
- `POST /api/tools/image-ai/watermark/suggestions`：上传单图，返回归一化 OCR 多边形，不返回识别文字。
- `POST /api/tools/image-ai/tasks`：创建异步任务，成功返回 `202`。
- `GET /api/tools/image-ai/tasks/:taskId`：队列位置、进度、结果、警告和过期时间。
- `DELETE /api/tools/image-ai/tasks/:taskId`：取消等待任务，或在当前图片完成后停止批次。
- `GET /api/tools/image-ai/tasks/:taskId/files/:resultId`：读取清洗后的 PNG；`?download=1` 强制下载。
- `GET /api/tools/image-ai/tasks/:taskId/download.zip`：下载任务中所有成功结果。

创建任务字段：

- `operation`：`watermark_remove | enhance | background_remove`。
- `files`：去水印 1 张，其他操作最多 10 张。
- `mask`：去水印必需，尺寸必须与原图一致的 PNG。
- `scale`：增强操作的 `2 | 4`。

## 局域网文件传输

主命名空间：`/api/tools/lan-transfer`。兼容命名空间 `/api/lan` 提供相同接口。

- `GET /info`：局域网访问地址、容量、保留期和访问模式。
- `POST /access`：使用可选管理 PIN 解锁完整权限。
- `POST /files/batch-download`：将 `ids` 指定的文件打包为 ZIP。
- `POST /files/batch-delete`：批量删除 `ids` 指定的文件。
- `PATCH /files/:id/expiry`：通过 `{ "days": 30 }` 延长文件有效期。
- `POST /notes`：multipart 字段 `title?`、`content?`、`images`；支持纯文字或文字加最多 6 张图片。
- `GET /notes`：分页获取局域网图文便签。
- `GET /notes/:id/images/:imageId/preview|download`：预览或下载图文图片。
- `PATCH /notes/:id/expiry`：延长图文有效期。
- `DELETE /notes/:id`：删除图文及其图片。

未完成上传会话会按 `LAN_TRANSFER_UPLOAD_RETENTION_HOURS` 自动回收；正式文件和图文按配置保留期定时清理。图文文字上限 20,000 字，最多 6 张图片，单张 10 MiB、合计 30 MiB，只接受通过文件签名校验的 JPG、PNG、GIF、WebP 和 AVIF。配置 `LAN_TRANSFER_PIN` 后，可通过 `LAN_TRANSFER_GUEST_MODE` 将未解锁设备限制为仅上传、仅下载或禁止访问。

普通文件：

- `POST /files`：字段 `file`，默认上限 20 GiB。
- `GET /files`：查询、排序和分页。
- `GET /files/:id/preview`：安全内联预览，支持 Range。
- `GET /files/:id/download`：附件下载并增加下载次数。
- `DELETE /files/:id`：删除文件和元数据。
- `POST /cleanup`：清理过期文件。

列表参数：`keyword`、`category`、`extension`、`sortBy`、`sortOrder`、`page`、`pageSize`。`category` 支持 `image|video|audio|text|pdf|archive|document|other`，`pageSize` 最大 100。

分片上传：

- `POST /uploads`：JSON `originalName`、`mimeType`、`size`、`chunkSize`。
- `GET /uploads/:uploadId`：读取已上传分片与续传状态。
- `PUT /uploads/:uploadId/chunks/:index`：字段 `chunk`，可乱序和重传。
- `POST /uploads/:uploadId/complete`：校验并原子合并。
- `DELETE /uploads/:uploadId`：取消会话并删除分片。

合并在同盘 `.partial-*` 文件中完成，大小校验和 `fsync` 后才原子重命名；失败保留原分片供续传。

## Edge-TTS 马来语 / 英语配音

- `GET /api/tools/edge-tts/health`：Python 运行环境、版本、队列、保留期和文本上限。
- `GET /api/tools/edge-tts/voices?language=ms-MY|en-US|en-GB`：读取并缓存在线音色；网络异常时返回内置推荐音色。
- `POST /api/tools/edge-tts/tasks`：JSON `{ text, language, voice, rate, volume, pitch, includeSubtitles, fileName? }`，成功返回 `202`。
- `GET /api/tools/edge-tts/tasks?page=1&pageSize=10`：分页历史，不返回完整文案。
- `GET /api/tools/edge-tts/tasks/:taskId`：任务详情、完整文案和生成结果地址。
- `GET /api/tools/edge-tts/tasks/:taskId/audio`：浏览器内试听 MP3。
- `GET /api/tools/edge-tts/tasks/:taskId/download`：下载 MP3。
- `GET /api/tools/edge-tts/tasks/:taskId/subtitle`：下载可选 SRT。
- `DELETE /api/tools/edge-tts/tasks/:taskId`：取消任务并删除语音、字幕和元数据。

文本最多 20,000 字符；语速 `-50..100`、音量和音调 `-50..50`。音色必须来自服务端音色列表并与语言匹配。任务通过受控进程参数调用 Python，不经过 shell；同时生成数、排队总数、超时和保留期均可通过环境变量限制。文案会发送给微软在线语音服务。

### Chatterbox Multilingual V3 声音克隆

命名空间：`/api/tools/edge-tts/chatterbox`。

- `GET /health`：Worker、模型加载、CUDA 设备、队列、参考音频限制、水印和保留期。
- `POST /tasks`：`multipart/form-data` 创建任务并返回 `202`。
- `GET /tasks?page=1&pageSize=10`：分页历史，不返回完整文案。
- `GET /tasks/:taskId`：任务详情、完整文案和结果地址。
- `GET /tasks/:taskId/audio|download|subtitle`：试听或下载 MP3 / SRT。
- `DELETE /tasks/:taskId`：删除等待任务或已完成记录；GPU 正在推理时需等待当前任务结束。

创建字段：`reference` 音频文件、`text`、`language=ms|en`、`authorization=self|authorized`、`consentConfirmed=true`、`exaggeration=0.25..1.5`、`cfgWeight=0..1`、`temperature=0.1..1.5`、`seed=0..2147483647`、`includeSubtitles`、`fileName?`。文本最多 1,200 字符；参考音频最大 20 MB、5–30 秒，服务端通过 ffprobe 校验并转为 24 kHz 单声道 PCM。SRT 以完整句子作为字幕块，使用 Worker 返回的真实生成片段时间进行对齐；长句只在同一个字幕块内换行，不拆成多个时间段。旧版结构不正确的字幕会在下载时按音频总时长重建。参考音频在成功或失败后立即删除，输出保留 Chatterbox 内置 PerTh AI 水印。

## 视频文本解析

- `POST /api/tools/video-text/tasks`：字段 `file`，上传视频并执行本地转写。
- `POST /api/tools/video-text/tasks/from-url`：JSON `{ url, fileName? }`。
- `GET /api/tools/video-text/remote-video?url=...`：为浏览器代理远程视频，支持 Range。
- `GET /api/tools/video-text/tasks/:taskId`：任务及可选结果。
- `GET /api/tools/video-text/tasks/:taskId/result`：结果详情。
- `GET /api/tools/video-text/tasks/:taskId/export?format=txt|srt|json`：导出结果。
- `DELETE /api/tools/video-text/tasks/:taskId`：删除任务和结果。
- `GET /api/tools/video-text/history`：`keyword/page/pageSize` 历史查询。
- `GET /api/tools/video-text/history/:taskId`：历史详情。
- `DELETE /api/tools/video-text/history/:taskId`：删除历史和关联文件。

任务 ID 只允许 1–64 位字母、数字、下划线和连字符。转写命令不经过 shell；上传视频、WAV 和转写中间文件在任务结束后删除。

## 短视频

- `POST /api/tools/short-video/parse`：JSON `{ input, platform? }`，平台为 `auto | douyin | xiaohongshu | tiktok`。
- `GET /api/tools/short-video/download?url=...&filename=...`：以附件形式代理媒体。

分享链接只接受抖音、小红书、TikTok 主域或真实子域，并校验所选平台与链接域名一致。解析结果默认短缓存 5 分钟；TikTok 主解析失败时可降级到官方 oEmbed 预览。远程媒体统一限制为 HTTP(S) 80/443、无凭证、非私网地址、最多 3 次逐跳验证重定向、默认 120 秒与 2 GiB。

## 常见错误码

| 错误码                                    | 含义                           |
| ----------------------------------------- | ------------------------------ |
| `FILE_REQUIRED` / `FILE_TOO_LARGE`        | 缺少文件或超过上限             |
| `INVALID_TASK_ID` / `TASK_NOT_FOUND`      | 任务 ID 非法或不存在           |
| `UPLOAD_INCOMPLETE` / `UPLOAD_FINALIZING` | 分片缺失或正在提交             |
| `INSUFFICIENT_STORAGE`                    | 可用磁盘不足                   |
| `IMAGE_AI_QUEUE_FULL`                     | AI 队列与预留槽已满            |
| `EDGE_TTS_NOT_INSTALLED`                  | Edge-TTS Python 环境尚未安装   |
| `EDGE_TTS_QUEUE_FULL`                     | 语音生成队列已满               |
| `CHATTERBOX_NOT_AVAILABLE`                | 本地声音克隆 Worker 未就绪     |
| `CHATTERBOX_CONSENT_REQUIRED`             | 未确认拥有合法声音授权         |
| `CHATTERBOX_REFERENCE_DURATION_INVALID`   | 参考音频不在 5–30 秒范围       |
| `CHATTERBOX_QUEUE_FULL`                   | 本地声音克隆队列已满           |
| `VIDEO_DOWNLOAD_FAILED`                   | 远程地址被拒绝、超时或响应异常 |
| `SHORT_VIDEO_PROVIDER_UNAVAILABLE`        | 第三方解析服务不可用           |
| `SHORT_VIDEO_PLATFORM_MISMATCH`           | 选择的平台与分享链接不匹配     |

## 竞品拆解

- `POST /api/tools/video-insights`：JSON `{ input, platform?: "auto"|"douyin"|"xiaohongshu"|"tiktok" }`，解析公开链接、尝试本地转写并创建本地卡片。
- `POST /api/tools/video-insights/upload`：multipart 字段 `file`，仅接受 `video/*`。必须配置本地转写；服务端完成转写和拆解后立即删除原视频及全部临时产物，只保存卡片 JSON。
- `GET /api/tools/video-insights`：支持 `page`、`pageSize`、`keyword`、`platform`、`tag`、`favorite`、`archived`、`createdFrom`、`createdTo` 和 `sort`（`newest`/`oldest`/`updated`）。返回分页卡片和不含密钥的模型配置状态。
- `GET /api/tools/video-insights/:id`：获取完整卡片、转写、规则拆解和人工内容。
- `PATCH /api/tools/video-insights/:id`：可更新 `title`、`tags`、`notes`、`scriptDraft`、`favorite`、`archived`。
- `DELETE /api/tools/video-insights/:id`：仅删除本地卡片 JSON，不删除或复制原始视频。
- `POST /api/tools/video-insights/:id/analyze`：JSON `{ mode: "rules"|"model" }`。`model` 模式需要 `.env` 中的模型地址和名称；API 响应永不包含模型密钥。

规则分析结果当前为 `version: 3`，包含 `quality`、`brief`、`hookAnalysis`、`keyPoints`、`sellingPointChains`、`scriptBlueprint`、`missingElements`、`improvements`、`finalOutput` 和 `changeLog`。关键点及卖点链均附带原文证据、时间定位、规则信号和证据充分度；最终稿只重排已有事实，缺少证据时使用明确占位符，不会自动补造。

常见错误：`VIDEO_INSIGHT_DUPLICATE`（链接已存在）、`VIDEO_INSIGHT_NOT_FOUND`、`VIDEO_TRANSCRIBER_NOT_CONFIGURED`、`VIDEO_INSIGHT_UPLOAD_TOO_LARGE`、`VIDEO_INSIGHT_TRANSCRIPT_EMPTY`、`MODEL_NOT_CONFIGURED`、`MODEL_REQUEST_FAILED`。

HTTP `413/415/429/507` 分别表示过大、不支持媒体类型、队列满和磁盘不足。
