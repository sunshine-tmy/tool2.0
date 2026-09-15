# Lightweight Ecommerce Toolbox Design

## Goal

Build a lightweight, no-login ecommerce utility toolbox. Users land on the home page and can immediately use tools for files, images, and video text extraction.

## Product Scope

The first version focuses on a clean tool workspace instead of a SaaS account system. It does not include login, roles, membership, payment, admin panels, or multi-tenant data.

Initial modules:

- Image compression
- LAN file transfer
- Video text extraction

Image compression should be usable first. LAN transfer and video text extraction can start as structured modules with UI entries and backend boundaries.

## Architecture

Use a small monorepo with separate frontend and backend apps plus shared TypeScript contracts.

- `frontend`: Vue 3, Vite, TypeScript, Naive UI, Pinia, Vue Router
- `backend`: Fastify, TypeScript, local file storage, Sharp for image processing
- `packages/shared`: tool definitions, API response helpers, common types, validation helpers

The backend should stay stateless except for temporary uploaded and output files under `storage/`. A lightweight in-memory task store is enough for the initial version.

## UX Direction

The home page is the product. It should open directly into a tool workspace:

- Header with project name, search, and basic status
- Left tool category navigation
- Tool card grid with realistic tool names and descriptions
- Selected tool panel with upload/input, parameters, and result state

The style should feel like a polished productivity app: restrained colors, clear spacing, compact cards, 6-8px radii, professional typography, and no marketing hero.

## Module Boundary

Each tool should have:

- Shared metadata in `packages/shared`
- A frontend module under `frontend/src/modules/<tool-id>`
- A backend route or handler under `backend/src/modules/<tool-id>`
- Clear request and response types

This keeps future tools easy to add without rewriting the platform shell.

## API Shape

Use simple JSON envelopes:

```ts
type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

type ApiFailure = {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
};
```

Initial API routes:

- `GET /api/v1/health`
- `GET /api/v1/tools`
- `POST /api/v1/tools/image-compress`
- `GET /api/v1/tasks/:taskId`

## Verification

Use Vitest for shared and backend logic. Verify:

- Tool registry exposes expected no-login tools
- API response helpers return consistent shapes
- Image option validation rejects invalid values
- Task store creates, updates, and reads task state

Use TypeScript build checks for frontend and backend.
