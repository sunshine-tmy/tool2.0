# Shared contracts

本包只包含浏览器安全的契约、Schema、纯函数和常量，不依赖应用源码、Node、Electron、进程或模型。Node 专用布局原语归 `@toolbox/runtime-core`。

| 公开入口                        | 源码归属                                         |
| ------------------------------- | ------------------------------------------------ |
| `@toolbox/shared/common`        | 响应信封、通用请求/任务、Worker 协议、工具注册表 |
| `@toolbox/shared/image`         | 图片压缩、AI 图片、商品图编辑                    |
| `@toolbox/shared/speech`        | Edge-TTS、Chatterbox 及在线批次                  |
| `@toolbox/shared/archive`       | 统一归档、平台契约及旧小红书兼容类型             |
| `@toolbox/shared/audio-library` | 音频库契约                                       |
| `@toolbox/shared/lan`           | 局域网文件、图文、上传及访问契约                 |
| `@toolbox/shared/system`        | 能力包、诊断、维护清理契约                       |
| `@toolbox/shared/desktop`       | 桌面逐方法桥接类型，无运行时实现                 |

旧根入口及 `edge-tts`、`chatterbox` 子路径继续有效；不要为迁移而删除旧导出或一次性替换所有消费者。领域入口转导出唯一规范定义，不能复制 Schema。`index.ts` 中的既有求值顺序属于兼容边界。

新 wire DTO 从已有 Schema 派生；领域仓储、浏览器状态、`File`/multipart 输入、AbortSignal 和回调不是相同契约，不按字段名称强行合并。保留 optional、nullable、默认值、未知字段和错误映射策略。

日期格式初始化为内部显式机制：沿用既有 `Date.parse` 判定，不覆盖调用方已注册的校验器。新增独立入口若包含日期 Schema，必须用冷进程及浏览器 tree-shaking 消费验证，不能仅在先导入根模块的单元测试中验证。

修改后运行共享测试、类型检查和普通 `pnpm build`；构建冒烟在隔离目录消费 dist 声明/运行时，验证旧入口和浏览器依赖边界。不需要、也不应为修改本包重建签名能力包。
