# Project Plan

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
2. Add frontend UI behavior under `frontend/src/modules/<tool-id>` or extend the workspace panel.
3. Add a backend handler under `backend/src/modules/<tool-id>`.
4. Add focused tests for shared validation or backend behavior.
