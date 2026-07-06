# 电商工具箱

一个免登录、打开即用的电商小工具集合。项目采用前后端分离结构，按工具模块维护功能。

## 技术栈

- 前端：Vue 3 + TypeScript + Vite + Naive UI + Pinia + Vue Router
- 后端：Fastify + TypeScript
- 图片处理：Sharp
- 包管理：pnpm workspace
- 测试：Vitest

## 模块路由

```text
/                         工具总览
/tools/image-compress      图片压缩
/tools/format-convert      格式转换
/tools/lan-transfer        局域网文件传输
/tools/video-text          视频文本解析
```

## 目录结构

```text
frontend/src/layouts/      工具通用布局
frontend/src/modules/      前端工具模块页面
backend/src/modules/       后端工具模块路由与服务
packages/shared/           前后端共享类型、工具注册、响应格式
storage/                   本地上传、输出和临时文件目录
docs/                      项目规划和接口文档
```

## 本地启动

双击根目录的 `start.bat`，即可自动启动前端和后端，并打开浏览器。

也可以使用命令行：

```bash
pnpm install
pnpm dev:api
pnpm dev:web
```

默认地址：

- 前端：http://192.168.1.241:5173
- 后端：http://192.168.1.241:3100

## 局域网文件传输

- 前端页面：`/tools/lan-transfer`
- 后端接口：`/api/tools/lan-transfer/*`
- 兼容旧接口：`/api/lan/*`
- 支持同局域网设备双向上传、预览、筛选、下载和删除文件
- 支持图片、视频、音频、文本、PDF、压缩包、Office 文档等类型
- 单文件默认上限：20GB
- 文件默认保留：7 天
- 元数据位置：`storage/lan-transfer/index.json`
- 文件位置：`storage/lan-transfer/files/`

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
```
