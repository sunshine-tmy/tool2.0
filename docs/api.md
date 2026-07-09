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

## Download Output

`GET /api/files/:fileName`

Downloads a processed file from `storage/outputs`.
