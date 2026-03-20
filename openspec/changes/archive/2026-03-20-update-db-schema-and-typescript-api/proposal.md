## Why

The project is being rewritten from a previous schema (using `chats`/`configuration` tables) to the schema defined in REQUIREMENTS.md. The current `src/lib/db/` TypeScript API and `prisma/schema.prisma` still reference old table names and shapes (`chats`, `configuration`, old `artifacts` columns), causing a mismatch with the SQLite schema already implemented in `src-tauri/src/db.rs`. This must be resolved so the TypeScript layer, Prisma types, and Rust migrations all describe the same database.

## What Changes

- **`src/lib/db/types.ts`**: Update `TableName` union to reference the new tables: `projects`, `conversations`, `messages`, `artifacts`, `llm_providers`, `app_settings`.
- **`src/lib/db/`**: Add typed repository helpers for each entity (`Project`, `Conversation`, `Message`, `Artifact`, `LlmProvider`, `AppSetting`) with CRUD operations matching the schema in `db.rs`.
- **`prisma/schema.prisma`**: Rewrite all models to mirror the Rust migration schema exactly — correct column names, types, and relations — so Prisma generates accurate TypeScript types.
- **Schema sync solution (optional)**: Propose a single source-of-truth approach so `db.rs` SQL and Prisma schema cannot drift.

## Capabilities

### New Capabilities

- `typescript-db-api`: Typed TypeScript repository layer for all entities in the new schema (`projects`, `conversations`, `messages`, `artifacts`, `llm_providers`, `app_settings`), aligned with the Rust SQLite migrations.

### Modified Capabilities

- `database-schema`: Existing spec covers the Rust migration. The TypeScript and Prisma sides need to match it; the spec should be extended to cover the Prisma/TypeScript alignment and schema-sync approach.

## Impact

- `src/lib/db/types.ts` — `TableName`, entity types
- `src/lib/db/index.ts` — new exports
- `src/lib/db/config.ts` — update to use `app_settings` table
- `prisma/schema.prisma` — full rewrite of all models
- Any frontend code importing old types (`Chat`, `Configuration`, `chats`, `configuration`) — **BREAKING** rename/removal
