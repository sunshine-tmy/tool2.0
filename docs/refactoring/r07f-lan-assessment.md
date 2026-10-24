# R07-F LAN 领域归属与保护清单

状态：DONE，依此核对完成迁移及全量回归，见 [F 验收](r07f-lan-layout-verification.md)。2026-10-24。

modules/lan-transfer.ts 是业务装配：创建三个独立 store、finalizingUploads 集合、访问控制和审计，顺序 ensure / cleanup 后注册路由及定时清理。
其 9 份辅助实现分别负责权限、文件/图文/分片路由、文件发送、清单 IO、仓储、响应契约及上传会话。
这些共同归 domains/lan-transfer，入口改为 routes.ts；不合并其他业务上传或队列。

modules/lan-access.ts 是全业务共享地址及播放忙碌上报，不是文件传输；按目标结构归 system/lan-access/routes.ts。
runtime/desktop-lan-gateway.ts 继续作为桌面运行时集成，只更新其对 IPv4 判断的引用；不在本阶段重排桌面生命周期。
core/config/lan.ts 仍归配置，前端 LAN feature 留给 R08；公开命令、API 和页面地址不改。

## 必须保持

- 访客 full/upload-only/download-only/关闭模式，管理员和 PIN、会话 12 小时、CSRF、Origin 和请求配额。
- 文件与图文各自清单、临时上传会话、独立串行修改范围、SQLite 事实源和旧清单/备份恢复。
- 乱序分片、Set 去重与排序、缺片续传、末片尺寸、预留容量及合并的暂存提交。
- finalizingUploads 排除活动会话；定时清理、延期、过期和高风险管理规则不改。
- MIME/签名、文本/SVG 沙箱、PDF 特例、Range、文件名和批量 ZIP 行为不改。
- 局域网地址只来自原 RFC1918 IPv4 判定，不推断实际防火墙可达性；播放上报不开放诊断或进程接口。
- 应用关闭仍清除自己的定时器，不结束其他进程。

只移动源码及更新引用，不移动 storage、runtime、模型、离线包或用户文件，不执行清理和数据格式转换。
