# Project Plan (Historical Archive)

> 文档状态：历史记录。本文保留原始规划及其原有日期和基线，不是当前任务清单。当前功能与操作见 [README](../README.md)，当前重构状态见 [R00–R12 实施记录](refactoring/README.md)。未记录的原始提交不补造。

## Direction

This project is a lightweight ecommerce toolbox. It intentionally avoids login, memberships, payments, and admin workflows. Users should open the home page and immediately use tools.

## First Version

- Home workspace with search, categories, tool cards, and a selected-tool panel
- Shared tool registry for frontend and backend
- Fastify API with health, tools, tasks, and image compression routes
- Local file output under `storage/outputs`

## Initial Tools

- Image compression: ready
- LAN file transfer: planned module
- Video text extraction: planned module

## Add A New Tool

1. Add metadata to `packages/shared/src/tools.ts`.
2. Add frontend UI behavior under `apps/web/src/modules/<tool-id>` or extend the workspace panel.
3. Add a backend handler under `apps/api/src/modules/<tool-id>`.
4. Add focused tests for shared validation or backend behavior.
