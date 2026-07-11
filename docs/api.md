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

- `POST /api/tools/short-video/parse`：JSON `{ input, platform? }`，平台为 `auto | douyin | xiaohongshu`。
- `GET /api/tools/short-video/download?url=...&filename=...`：以附件形式代理媒体。

分享链接只接受抖音/小红书主域或真实子域。远程媒体统一限制为 HTTP(S) 80/443、无凭证、非私网地址、最多 3 次逐跳验证重定向、默认 120 秒与 2 GiB。

## 常见错误码

| 错误码                                    | 含义                           |
| ----------------------------------------- | ------------------------------ |
| `FILE_REQUIRED` / `FILE_TOO_LARGE`        | 缺少文件或超过上限             |
| `INVALID_TASK_ID` / `TASK_NOT_FOUND`      | 任务 ID 非法或不存在           |
| `UPLOAD_INCOMPLETE` / `UPLOAD_FINALIZING` | 分片缺失或正在提交             |
| `INSUFFICIENT_STORAGE`                    | 可用磁盘不足                   |
| `IMAGE_AI_QUEUE_FULL`                     | AI 队列与预留槽已满            |
| `VIDEO_DOWNLOAD_FAILED`                   | 远程地址被拒绝、超时或响应异常 |
| `SHORT_VIDEO_PROVIDER_UNAVAILABLE`        | 第三方解析服务不可用           |

HTTP `413/415/429/507` 分别表示过大、不支持媒体类型、队列满和磁盘不足。
