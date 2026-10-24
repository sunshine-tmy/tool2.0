# R08 前端归属与扩展落点

这是当前前端结构说明，不替代历史验收记录。页面 URL、API、工具 ID、存储格式和删除规则保持原契约。

| 目录                                       | 责任与边界                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `apps/web/src/app`                         | 根组件、路由、首页与应用级播放诊断保护；播放器在 router-view 外保持单实例 |
| `apps/web/src/shell`                       | 导航、搜索、响应式菜单、服务抽屉、会话与诊断轮询                          |
| `apps/web/src/shared`                      | 无 feature 反向依赖的 UI、HTTP、配置、composable 和纯工具                 |
| `apps/web/src/integrations/desktop`        | 固定桌面桥接、能力客户端/就绪投影、LAN 地址、Window 类型扩展              |
| `features/image-compress`                  | 图片压缩页面、参数、上传/下载客户端与纯预设                               |
| `features/image-ai/processing`             | 去水印/增强/抠图的既有组件及预览                                          |
| `features/image-ai/product-image`          | 文档/保存/离开保护、背景文件/URL、布局、精修 Canvas                       |
| `features/image-ai/history`                | 历史列表与删除协调、独立详情代次、纯展示映射                              |
| `features/speech/edge-tts`、`chatterbox`   | 各引擎自己的表单、批次、任务、音色状态；不合并生成队列                    |
| `features/speech/shared`                   | 有序编辑、字幕展示、选择工具与纯文案解析，不导入引擎私有实现              |
| `features/audio-library`                   | 永久素材、详情、分组、上传、回收站、备份及应用级播放器                    |
| `features/content-archive`                 | 统一归档页面/客户端/状态；旧小红书组件名与路由兼容不删除                  |
| `features/lan-transfer`                    | 已有分片上传、续传、分享和批处理状态，不复用为万能上传器                  |
| `features/desktop-settings`、`diagnostics` | 设置页组合及三个设置状态所有者、诊断页面                                  |

## 状态和资源所有权

- 页面只组合。一个 composable 拥有完整的一组状态、请求代次和生命周期，不让兄弟 composable 相互写入内部状态。
- 音频列表拥有搜索防抖与列表迟到响应屏障；items 拥有详情/回收站和串行变更互斥；groups 拥有撤销计时器；transfers 拥有上传草稿与备份恢复。
- 商品图背景对象 URL 由背景 composable 创建并释放；主编辑 composable 通过明确方法加载/重置背景。Canvas 精修与后台独立快照保持原实现。
- 图片历史选择和删除留在同一个协调者，详情通过 `closeRemoved(id)` 接收失效通知，不让迟到预览恢复已删除记录。
- Shell 的菜单监听、body class 和诊断轮询分别由自己的所有者卸载；LAN 卡片打开时读取实际端口，不缓存旧网卡地址。
- Edge-TTS 与 Chatterbox 继续在同一 KeepAlive 下切换；音频播放器不随页面重建。

## 显式功能集成

- `audio-library/integrations/speech.ts`：只提供保存音频操作组件。
- `audio-library/integrations/playback.ts`：提供既有播放器单例和根播放组件；不创建新实例。
- 其他跨 feature 消费者必须先明确必要出口，不导入对方页面内部状态。架构门禁同时检查运行时和类型依赖。
- API 客户端只通信；展示、localStorage 和下载 DOM 动作分别位于 presentation、preferences 和 media-links。

## 本阶段未做的事项

不修改 CSS 内容/顺序/作用域，不改变 HTTP、数据保留/删除、签名包或 Worker。样式职责迁移归 R11，桌面进程/IPC 归 R09，工程脚本归 R10；真实模型/macOS/安装包级验收统一留到 R12 完成后。
