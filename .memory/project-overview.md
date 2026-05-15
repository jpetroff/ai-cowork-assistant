# Project Overview

AI Cowork Lab is a local-first Tauri desktop app for AI-assisted project work. It combines project/task management, chat, rich-text/Markdown artifact editing, artifact revisions, local SQLite persistence, and a Python sidecar for AI work.

## Stack

- Frontend: React 19, TypeScript, Vite, React Router memory router.
- State: Zustand domain stores.
- UI: shadcn-style components, Base UI primitives, Tailwind CSS v4, CVA.
- Editor: TipTap.
- Desktop: Tauri v2 with Rust backend/plugins.
- Data: SQLite via Tauri SQL plugin; Prisma schema/types generated into `src/generated/prisma`.
- Sidecar: Python FastAPI/LlamaIndex under `src-python`.
- Tests: Vitest, Testing Library, jsdom.

## Entry Points

- `src/main.tsx`: mounts `App`.
- `src/App.tsx`: initializes app store, window persistence, router.
- `src/router.tsx`: route loaders coordinate store loading.
- `src-tauri`: desktop shell/backend.
- `src-python/main.py`: sidecar service entry.

## Current Spec Drift

- OpenSpec docs are useful background but stale in places.
- Requirements still describe artifact `content/version/message_id`; current code uses `Artifact` plus `ArtifactRevision`.
- Sidecar transport in specs mentions WebSocket; frontend currently streams via sidecar HTTP/SSE-style flow.
- Several spec paths/names are old: `AI CoLab`, `fastapi-schemas.py`, `artifact.store.ts`, command module layout.

## Agent Findings

- Project-map agent: confirmed stack, commands, and OpenSpec drift.
- Frontend agent: mapped route/component/store relationships.
- Revision agent: identified manual revision drift and safe fixes around draft mutability, system revision cards, and revision metadata.
