# API 参考

基础路径：`/api/v1`。除文件流与导出外，接口使用统一 `{ success, message, data | error, requestId }` 响应结构。正式接口不保留旧 `/api` 路径兼容层。

## 系统

- `GET /api/v1/health`：服务、转写、短视频 Provider 和图片 AI 配置状态。
- `GET /api/v1/tools`：工具注册表。
- `GET /api/v1/tasks`：最近任务，SQLite 默认最多保留 1000 条。
- `GET /api/v1/tasks/:taskId`：读取一个任务。
- `GET /api/v1/tasks/:taskId/events`：SSE 任务进度；断线后客户端回退轮询。
- `POST /api/v1/session`：`lan` 模式用 `{ pin }` 建立 HttpOnly 管理员会话并取得 CSRF token。
- `GET /api/v1/session`：通过现有 Cookie 恢复 CSRF token。
- `DELETE /api/v1/session`：退出管理员会话。
- `GET /api/v1/files/:fileName`：流式下载 `storage/outputs` 内的处理结果。

## 图片压缩

`POST /api/v1/tools/image-compress` 使用 `multipart/form-data`：

- `file`：JPEG、PNG 或 WebP，最大 20 MiB、4000 万像素。
- `quality`：30–95。
- `outputFormat`：`jpeg | png | webp`。
- `width`：可选正整数，不放大原图。

返回输出大小、节省比例、任务和 `downloadUrl`。

## AI 图片处理

- `GET /api/v1/tools/image-ai/health`：Worker、模型、设备、许可和摘要状态。
- `POST /api/v1/tools/image-ai/watermark/suggestions`：上传单图，返回归一化 OCR 多边形，不返回识别文字。
- `POST /api/v1/tools/image-ai/tasks`：创建异步任务，成功返回 `202`。
- `GET /api/v1/tools/image-ai/tasks/:taskId`：队列位置、进度、结果、警告和过期时间。
- `DELETE /api/v1/tools/image-ai/tasks/:taskId`：取消等待任务，或在当前图片完成后停止批次。
- `GET /api/v1/tools/image-ai/tasks/:taskId/files/:resultId`：读取清洗后的 PNG；`?download=1` 强制下载。
- `GET /api/v1/tools/image-ai/tasks/:taskId/download.zip`：下载任务中所有成功结果。

创建任务字段：

- `operation`：`watermark_remove | enhance | background_remove`。
- `files`：去水印 1 张，其他操作最多 10 张。
- `mask`：去水印必需，尺寸必须与原图一致的 PNG。
- `scale`：增强操作的 `2 | 4`。

## 局域网文件传输

唯一正式命名空间：`/api/v1/tools/lan-transfer`。

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

## Edge-TTS 多国语言配音

- `GET /api/v1/tools/edge-tts/health`：Python 运行环境、版本、队列、保留期和文本上限。
- `GET /api/v1/tools/edge-tts/voices?language=ms-MY|en-US|en-GB|pt-BR`：读取并缓存在线音色；网络异常时返回内置推荐音色。`pt-BR` 为巴西葡萄牙语，推荐 `pt-BR-FranciscaNeural` 和 `pt-BR-AntonioNeural`。
- `POST /api/v1/tools/edge-tts/tasks`：JSON `{ text, language, voice, rate, volume, pitch, includeSubtitles, fileName? }`，成功返回 `202`。
- `GET /api/v1/tools/edge-tts/tasks?page=1&pageSize=10`：分页历史，不返回完整文案。
- `GET /api/v1/tools/edge-tts/tasks/:taskId`：任务详情、完整文案和生成结果地址。
- `GET /api/v1/tools/edge-tts/tasks/:taskId/audio`：浏览器内试听 MP3。
- `GET /api/v1/tools/edge-tts/tasks/:taskId/download`：下载 MP3。
- `GET /api/v1/tools/edge-tts/tasks/:taskId/subtitle`：下载可选 SRT。
- `DELETE /api/v1/tools/edge-tts/tasks/:taskId`：取消任务并删除语音、字幕和元数据。

文本最多 20,000 字符；语速 `-50..100`、音量和音调 `-50..50`。音色必须来自服务端音色列表并与语言匹配。任务通过受控进程参数调用 Python，不经过 shell；同时生成数、排队总数、超时和保留期均可通过环境变量限制。文案会发送给微软在线语音服务。

### Chatterbox Multilingual V3 声音克隆

命名空间：`/api/v1/tools/edge-tts/chatterbox`。

- `GET /health`：Worker、模型加载、CUDA 设备、队列、参考音频限制、水印和保留期。
- `POST /tasks`：`multipart/form-data` 创建任务并返回 `202`。
- `GET /tasks?page=1&pageSize=10`：分页历史，不返回完整文案。
- `GET /tasks/:taskId`：任务详情、完整文案和结果地址。
- `GET /tasks/:taskId/audio|download|subtitle`：试听或下载 MP3 / SRT。
- `DELETE /tasks/:taskId`：删除等待任务或已完成记录；GPU 正在推理时需等待当前任务结束。
- `GET /voices`：列出永久保存的参考音色。
- `POST /voices`：multipart 字段 `reference`、`name`、`language`、`authorization`、`consentConfirmed=true`，标准化后永久保存。
- `GET /voices/:voiceId/audio`：试听永久参考音色。
- `DELETE /voices/:voiceId`：永久删除参考音色；已生成音频和批次副本不受影响。
- `POST /batches`：`multipart/form-data` 创建多段批次；`segments` 为有序的 `{ text, fileName? }[]` JSON。
- `GET /batches`、`GET /batches/:batchId`：分页批次历史与包含全部文案段的详情。
- `GET /batches/:batchId/items/:itemId/audio|download`：试听或下载单段 MP3。
- `GET /batches/:batchId/combined-audio`：两个及以上文案段完成后，下载按当前顺序拼接的总 MP3。
- `GET /batches/:batchId/subtitle`：所有文案段完成后下载原文 SRT。
- `GET /batches/:batchId/subtitle.zh-CN`：填写过中文翻译时，下载单独的中文 SRT。
- `GET /batches/:batchId/subtitle.bilingual`：两个及以上文案段完成且填写过中文翻译时，下载原文在上、中文在下的双语 SRT。

字幕文件名使用同一批次随机 ID 的前 8 位作为稳定哈希。原文文件名为 `马来语|英语|巴西葡语-<hash>.srt`，中文文件名为 `中文字幕-<hash>.srt`。

- `GET /batches/:batchId/download.zip`：下载有序单段 MP3、总 MP3、原文/中文/双语 SRT 和 `manifest.txt`。
- `POST /batches/:batchId/items/:itemId/regenerate`：可修改文案、文件名、种子并安全重新生成；参考音色已删除时需重新上传 `reference`。
- `PATCH /batches/:batchId/order`：通过完整的 `{ itemIds }` 调整顺序并重建总 SRT。
- `DELETE /batches/:batchId/items/:itemId`、`DELETE /batches/:batchId`：删除单段或整个批次。
- `POST /batches/:batchId/cancel`：取消尚未开始的文案段。
- `DELETE /batches/:batchId/reference`：提前删除已保留的标准化参考音色。

创建字段：`reference` 音频文件、`text`、`language=ms|en|pt-BR`、`authorization=self|authorized`、`consentConfirmed=true`、`exaggeration=0.25..1.5`、`cfgWeight=0..1`、`temperature=0.1..1.5`、`seed=0..2147483647`、`includeSubtitles`、`fileName?`。文本最多 1,200 字符；参考音频最大 20 MB、5–30 秒，服务端通过 ffprobe 校验并转为 24 kHz 单声道 PCM。SRT 以完整句子作为字幕块，使用 Worker 返回的真实生成片段时间进行对齐；长句只在同一个字幕块内换行，不拆成多个时间段。旧版结构不正确的字幕会在下载时按音频总时长重建。参考音频在成功或失败后立即删除，输出保留 Chatterbox 内置 PerTh AI 水印。

批量生成和永久音色库同样支持 `ms|en|pt-BR`。`pt-BR` 在任务、历史及音色信息中保留不变，仅在 Worker 调用通用多语言模型时映射为 `pt`；建议使用巴西葡语参考录音引导地域口音。批量分段的 `referenceTranslation` 不会发送给语音模型，而是用于单独的中文字幕和双语字幕；原文字幕保持不变。按句分段且原文与中文句数不同时，该文案段的中文及双语字幕会回退为一个完整字幕块。

批次最多 30 段，每段最多 1,200 字符、总计最多 20,000 字符。额外字段包括 `name?`、`referenceRetained` 和 `subtitleMode=sentences|segments`。创建批次时可以上传 `reference`，也可以通过 `voiceId` 使用永久音色库。每段使用最终 MP3 的实际时长，字幕按顺序累计偏移；总音频按相同顺序拼接。重新生成、删除或重排会自动重建总音频和字幕时间轴。单段重新生成支持覆盖 `exaggeration`、`cfgWeight`、`temperature` 和 `seed`，也可以上传新参考音频或传入永久音色 `voiceId`。重新生成先写入候选文件，成功后才替换旧音频，失败时保留原结果。永久音色只在明确调用删除接口时移除；批次临时参考音色默认在批次结束后删除，仅在 `referenceRetained=true` 时保留到批次过期或用户主动删除。

每个 `segments` 项可包含最多 2,000 字符的 `referenceTranslation?`。该字段作为中文参考元数据保存，不发送给 Worker，也不参与音频生成或列表摘要；它会用于生成独立中文 SRT 和双语 SRT。单段重新生成接口也可传入该字段并同步重建字幕。

## 视频文本解析

- `POST /api/v1/tools/video-text/tasks`：字段 `file`，上传视频并执行本地转写。
- `POST /api/v1/tools/video-text/tasks/from-url`：JSON `{ url, fileName? }`。
- `GET /api/v1/tools/video-text/remote-video?url=...`：为浏览器代理远程视频，支持 Range。
- `GET /api/v1/tools/video-text/tasks/:taskId`：任务及可选结果。
- `GET /api/v1/tools/video-text/tasks/:taskId/result`：结果详情。
- `GET /api/v1/tools/video-text/tasks/:taskId/export?format=txt|srt|json`：导出结果。
- `DELETE /api/v1/tools/video-text/tasks/:taskId`：删除任务和结果。
- `GET /api/v1/tools/video-text/history`：`keyword/page/pageSize` 历史查询。
- `GET /api/v1/tools/video-text/history/:taskId`：历史详情。
- `DELETE /api/v1/tools/video-text/history/:taskId`：删除历史和关联文件。

任务 ID 只允许 1–64 位字母、数字、下划线和连字符。转写命令不经过 shell；上传视频、WAV 和转写中间文件在任务结束后删除。

## 短视频

- `POST /api/v1/tools/short-video/parse`：JSON `{ input, platform? }`，平台为 `auto | douyin | xiaohongshu | tiktok`。
- `GET /api/v1/tools/short-video/download?url=...&filename=...`：以附件形式代理媒体。

分享链接只接受抖音、小红书、TikTok 主域或真实子域，并校验所选平台与链接域名一致。解析结果默认短缓存 5 分钟；TikTok 主解析失败时可降级到官方 oEmbed 预览。远程媒体统一限制为 HTTP(S) 80/443、无凭证、非私网地址、最多 3 次逐跳验证重定向、默认 120 秒与 2 GiB。

## 小红书内容归档

- `POST /api/v1/tools/xhs-archive/items`：JSON `{ url }` 创建获取任务；`url` 可为链接或包含链接的分享文案。
- `GET /api/v1/tools/xhs-archive/tasks/:taskId`：读取环境安装、链接解析、媒体下载和写入存档进度。
- `GET /api/v1/tools/xhs-archive/items?keyword=&type=&page=&pageSize=`：搜索、筛选和分页读取存档。
- `GET /api/v1/tools/xhs-archive/items/:id`：读取完整正文、作者和媒体清单。
- `POST /api/v1/tools/xhs-archive/items/:id/refresh`：重新获取并原子更新相同笔记。
- `DELETE /api/v1/tools/xhs-archive/items/:id`：永久删除记录和本地媒体。
- `GET /api/v1/tools/xhs-archive/items/:id/media/:mediaId`：本地媒体预览；`?download=1` 强制下载，视频支持 Range。
- `GET /api/v1/tools/xhs-archive/items/:id/download.zip`：流式下载 `内容.txt`、`metadata.json` 和顺序编号媒体。
- `GET /api/v1/tools/xhs-archive/runtime`：读取固定版本解析环境及登录状态。
- `POST /api/v1/tools/xhs-archive/auth/start`、`GET /api/v1/tools/xhs-archive/auth/:sessionId`：打开本机浏览器登录并读取结果。

只接受 `xiaohongshu.com`、`xhslink.com` 和 `xhslink.cn`，媒体下载复用统一 SSRF、重定向、单文件大小和总配额限制。刷新期间先写 staging；任何媒体失败均保留旧存档。

## 存储与清理

- `GET /api/v1/maintenance/cleanup`：返回白名单分类的文件数、占用、风险和停服建议。
- `POST /api/v1/maintenance/cleanup`：JSON `{ ids, dryRun? }` 清理选中的分类 ID，不接受文件路径。

小红书永久存档为独立高风险分类且默认不选；依赖、模型、Python 环境、`.env` 和小红书登录态不属于任何可清理分类。

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
| `XHS_AUTH_REQUIRED`                       | 内容不完整，需要登录后重试     |
| `XHS_MEDIA_DOWNLOAD_PARTIAL`              | 部分媒体失败，旧存档保持不变   |
| `XHS_STORAGE_QUOTA_EXCEEDED`              | 小红书存档空间不足             |

HTTP `413/415/429/507` 分别表示过大、不支持媒体类型、队列满和磁盘不足。
