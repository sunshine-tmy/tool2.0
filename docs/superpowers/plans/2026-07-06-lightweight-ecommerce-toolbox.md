# Lightweight Ecommerce Toolbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a lightweight no-login ecommerce toolbox with a Vue 3 frontend, Fastify backend, shared contracts, and first image tool boundaries.

**Architecture:** Use a pnpm monorepo with `frontend`, `backend`, and `packages/shared`. Shared contracts define tools, API envelopes, and validation. Backend exposes health, tool registry, task, image compression, and image conversion routes. Frontend opens directly to a polished tool workspace.

**Tech Stack:** Vue 3, Vite, TypeScript, Naive UI, Pinia, Vue Router, Fastify, Sharp, Vitest, pnpm.

---

## File Structure

- Create root workspace config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Create docs: `docs/project-plan.md`, `docs/api.md`
- Create shared package: `packages/shared`
- Create backend app: `backend`
- Create frontend app: `frontend`
- Create runtime storage folders with `.gitkeep`

## Tasks

### Task 1: Shared Contracts

- [ ] Write failing tests for API envelopes, tool registry, and image option validation.
- [ ] Run shared tests and confirm they fail because implementation files do not exist.
- [ ] Implement shared TypeScript types, helpers, and registry.
- [ ] Run shared tests and confirm they pass.

### Task 2: Backend Core

- [ ] Write failing tests for task store and route registration behavior.
- [ ] Run backend tests and confirm they fail because implementation files do not exist.
- [ ] Implement Fastify app factory, health route, tools route, task store, and image route handlers.
- [ ] Run backend tests and confirm they pass.

### Task 3: Frontend Workspace

- [ ] Create Vue 3 app shell with route config and tool workspace page.
- [ ] Add Naive UI layout with header, sidebar categories, tool grid, selected tool panel, and task list.
- [ ] Add API service and shared tool metadata consumption.
- [ ] Run frontend typecheck and build.

### Task 4: Project Polish

- [ ] Add README, project plan, API docs, env example, and storage folders.
- [ ] Install dependencies.
- [ ] Run full test and build verification.
