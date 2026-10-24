# B05 桌面开发静态资源目录修复

状态：DONE，代码级回归通过。2026-10-24；HEAD 55526ab，保留全部已有未提交修改。

## 证据与修复

desktop:start 的既有链路先构建 Web/API 并编译桌面主进程，主窗口加载后端 origin，不是直接加载 Vite。
createDesktopRuntimeLayout(packaged:false) 却把 frontendDistRoot 传成 apps/web，静态插件要求同一目录的 index.html 和 assets。
按真实桌面开发布局及当前构建产物，在独立可写根启动后端：修复前 GET / 为 404，新布局断言同时失败。

仅将开发模式资源根改为 apps/web/dist；打包模式 resources/frontend、后端入口、所有用户数据/模型/能力目录保持不变。
不扩大静态服务范围、不改 SPA/API 边界、不读取私钥或用户数据库。

## 测试及验证范围

- runtime-layout 原 6 项：开发目录期望更新为 dist，其余打包/数据/macOS 路径断言保持；修复前 1 失败、修复后 6 通过。
- 新增 smoke-desktop-development，接入既有普通 pnpm build 冒烟；实际读取桌面源码布局和 Web/API 构建产物。
- 修复后首页、JS 资源、AI/LAN 深链接成功，未知 API 仍 404，所有可写路径属于 mkdtemp 专用根，关闭后仅清理自有根。
- 该冒烟不加载 Electron 窗口、不运行安装器，也不能当作 macOS/安装包级验收。

首次普通构建调用的新冒烟把 fileURLToPath 返回的仓库尾部分隔符也当作路径差异；已明确复现为同一 resolved path，
仅将冒烟预期做 path.resolve 规范化，保持目录身份断言，不修改生产布局或跳过检查。

开发布局源码由项目要求的 Node 24 原生类型擦除读取；本机 Node 24.14.0 已实际执行。
没有新依赖或包/公开命令变动；不影响已发布资源名称。
最终 pnpm typecheck / lint / deadcode / lint:architecture 通过，契约 4、架构 7、差异检查器 16 项通过。
pnpm build 重新完整通过，包含本新增冒烟及原源码/dist、冷热/异 cwd/无 Git ZIP、离线复用和分发布局检查，原分包预算不变。
pnpm --filter desktop build/test：主进程/preload 编译、95 单元及 7 冒烟脚本单元通过，无 stage/rebuild/package/make。
工程脚本 82 通过、1 原跳过；全库格式、git diff --check、空索引核对通过，HEAD 未变。

后续真实模型、macOS 和安装包专项留待统一验收；本次不制作安装包、提交、推送或发布。
