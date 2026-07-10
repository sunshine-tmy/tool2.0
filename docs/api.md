# API

Base path: `/api`

## Health

`GET /api/health`

Returns service status.

## Tools

`GET /api/tools`

Returns the no-login tool registry.

## Tasks

`GET /api/tasks`

Returns recent in-memory tasks.

`GET /api/tasks/:taskId`

Returns one task.

## Image Compression

`POST /api/tools/image-compress`

Multipart fields:

- `file`: image file
- `quality`: number from 30 to 95
- `outputFormat`: `jpeg`, `png`, or `webp`
- `width`: optional positive number

## AI Image Processing

Canonical namespace: `/api/tools/image-ai`.

`GET /api/tools/image-ai/health`

Returns local Worker availability plus model name, version, license, SHA-256, device, and deployment usage.

`POST /api/tools/image-ai/watermark/suggestions`

Multipart field `file` contains one JPEG, PNG, or WebP image. The response contains normalized OCR polygons and confidence values; recognized text is never returned or logged.

`POST /api/tools/image-ai/tasks`

Multipart fields:

- `operation`: `watermark_remove`, `enhance`, or `background_remove`
- `files`: one image for watermark removal, up to ten for the other operations
- `mask`: required same-size PNG for watermark removal
- `scale`: `2` or `4` for enhancement

Returns `202` with a persistent asynchronous task. A maximum of 20 pending/running tasks is accepted.

`GET /api/tools/image-ai/tasks/:taskId`

Returns queue position, progress, results, actual provider/model, warnings, and expiry time.

`DELETE /api/tools/image-ai/tasks/:taskId`

Cancels a pending task or stops a running batch after its current image.

`GET /api/tools/image-ai/tasks/:taskId/files/:resultId`

Returns one sanitized PNG result for inline comparison. Add `?download=1` to return
`Content-Disposition: attachment` so a single button click downloads the file directly.

`GET /api/tools/image-ai/tasks/:taskId/download.zip`

Downloads every successful result in the task as a ZIP archive.


## LAN File Transfer

Canonical namespace: `/api/tools/lan-transfer`

Legacy namespace `/api/lan` is still supported for compatibility.

`POST /api/tools/lan-transfer/files`

Multipart fields:

- `file`: any single file. The default max size is 20GB.

Stores the file under `storage/lan-transfer/files/` and records metadata in `storage/lan-transfer/index.json`.

`GET /api/tools/lan-transfer/files`

Query parameters:

- `keyword`: file name or extension keyword
- `category`: `image`, `video`, `audio`, `text`, `pdf`, `archive`, `document`, or `other`
- `extension`: file extension without dot
- `sortBy`: `createdAt`, `size`, `name`, or `downloadCount`
- `sortOrder`: `asc` or `desc`

`GET /api/tools/lan-transfer/files/:id/preview`

Returns an inline preview for browser-native file categories: image, video, audio, text, and PDF. Range requests are supported.

`GET /api/tools/lan-transfer/files/:id/download`

Downloads the original file and increments `downloadCount`.

`DELETE /api/tools/lan-transfer/files/:id`

Deletes the file and metadata entry.

`POST /api/tools/lan-transfer/cleanup`

Deletes expired files. Files expire after 7 days by default.

## Video Text

Canonical namespace: `/api/tools/video-text`

`POST /api/tools/video-text/tasks`

Multipart fields:

- `file`: video file

The backend uses `VIDEO_TEXT_AUDIO_EXTRACT_COMMAND` followed by
`VIDEO_TEXT_TRANSCRIBE_COMMAND`. The recommended local command calls
`scripts/video-transcribe-faster-whisper.py` with `large-v3-turbo`, `--language zh`, CUDA, and
`int8_float16`. If the large model cannot be loaded, the helper automatically tries `medium`,
`small`, and `base`, then CPU `int8` fallbacks.

Completed transcriber results may include `recognitionQuality`:

- `requestedModel`, `model`, `language`, `device`, and `computeType`
- `averageLogProbability`
- `lowConfidenceSegments` for transcript fragments that should be manually reviewed

`GET /api/tools/video-text/tasks/:taskId/result`

Returns the completed analysis result.

`GET /api/tools/video-text/tasks/:taskId/export?format=txt|srt|json`

Exports the result. `txt` is the default.

## Short Video

Canonical namespace: `/api/tools/short-video`

`POST /api/tools/short-video/parse`

JSON body:

- `input`: required share text or direct URL
- `platform`: optional `auto`, `douyin`, or `xiaohongshu`

The backend extracts the first URL, rejects unsupported hosts, and calls the configured
`SHORT_VIDEO_PARSE_API_URL`. The default provider is `https://api.bugpk.com/api/short_videos`.
If the provider rejects Node's HTTP client with a 5xx response on Windows, the backend retries
the same request through PowerShell `Invoke-WebRequest`.
Successful responses are normalized into:

- `platform`, `title`, `description`, `author`, and `coverUrl`
- `media`: video and image URLs returned by the provider
- `warnings`: non-fatal parser notes, for example when no media URL is returned

## Download Output

`GET /api/files/:fileName`

Downloads a processed file from `storage/outputs`.
