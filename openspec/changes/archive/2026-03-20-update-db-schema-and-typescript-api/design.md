## Context

The project has two independent representations of the database schema:

1. **Rust** (`src-tauri/src/db.rs`): The authoritative source. Migration v1 creates tables `projects`, `conversations`, `messages`, `artifacts`, `llm_providers`, `app_settings` with correct column names, types, constraints, and indices.
2. **TypeScript** (`src/lib/db/`): Currently describes an older schema — `TableName` still references `chats` and `configuration`; entity types are missing or wrong.
3. **Prisma** (`prisma/schema.prisma`): Generates TypeScript types, but its models also reflect the old schema (`Chat`, `Configuration`, wrong `Artifact` columns).

This creates a hard compile/runtime mismatch. The TypeScript layer must be rewritten to match the Rust migration exactly.

## Goals / Non-Goals

**Goals:**
- Update `prisma/schema.prisma` to mirror `db.rs` schema exactly (all six tables, correct columns and types).
- Update `src/lib/db/types.ts` `TableName` union and add TypeScript entity types for all six tables.
- Replace `config.ts` (which queries the old `configuration` table) with `settings.ts` that queries `app_settings`.
- Add repository-style helper modules for each entity group (`projects`, `conversations`, `messages`, `artifacts`, `llm-providers`) with typed CRUD operations, backed by the generic `SqliteDatabase`.
- Remove `migrations.ts` (its `updated_at` hack patched the old schema; no longer needed).
- Propose a schema-sync strategy to prevent Rust ↔ TypeScript drift.

**Non-Goals:**
- Changing the Rust migration SQL — `db.rs` is correct and is not modified.
- Adding application-level business logic (e.g., conversation orchestration, LLM calls) — only the data access layer.
- Generating Prisma migrations or using Prisma at runtime — Prisma is used only for TypeScript type generation; the Tauri SQLite plugin drives runtime access.

## Decisions

### Decision 1: Prisma as type-generator only (not runtime ORM)

**Choice**: Keep using Prisma in `generator client` mode purely for TypeScript type generation (`prisma generate`). The actual database calls continue to go through `@tauri-apps/plugin-sql` via `SqliteDatabase`.

**Why**: Prisma's runtime client requires Node.js / a standard SQLite driver and cannot run inside a Tauri webview. The plugin-sql path is the only viable runtime. Prisma's value is as a schema language that produces accurate TS types and catches schema errors at codegen time.

**Alternative considered**: Hand-write all TypeScript interfaces in `types.ts`. Rejected because Prisma gives us a single `.prisma` file that is the definitive TS-side schema description, catches typos, and auto-generates types from relations.

### Decision 2: Entity repository modules per domain

**Choice**: Add `src/lib/db/repositories/` with one file per entity group: `projects.ts`, `conversations.ts`, `messages.ts`, `artifacts.ts`, `llm-providers.ts`, `settings.ts`. Each exports typed CRUD functions that delegate to `SqliteDatabase`.

**Why**: The generic `db.get<T>()` / `db.insert<T>()` API requires callers to know table names and cast types. Typed repositories push the table name and type parameters into one place and expose a clean, domain-facing API to the rest of the app.

**Alternative considered**: Expand the generic `DbInterface` with entity-specific methods. Rejected — it mixes concerns and makes the interface monolithic.

### Decision 3: Schema sync via `prisma-to-drizzle` comment block (or manual parity check)

**Choice**: Document a "schema parity" convention: `prisma/schema.prisma` is the TypeScript-side source of truth; `src-tauri/src/db.rs` is the Rust-side source of truth. A `scripts/check-schema-parity.ts` script (future) can diff the two. For now, add a comment block at the top of both files pointing to the other as the peer definition, and include schema verification as a CI task placeholder.

**Why**: Full codegen from one source (e.g., generating Rust SQL from Prisma) requires a custom build step that adds fragile tooling. The lighter-weight convention — two files that must be kept in sync, with a future lint script — is achievable immediately.

**Alternative considered**: Use Drizzle ORM (SQLite WASM or custom driver) as the single TS schema source and generate SQL from it. Promising but requires replacing the Tauri plugin-sql integration, which is a larger change.

### Decision 4: UUID generation moves to TypeScript

**Choice**: Keep the existing `generateId()` (timestamp + random) for now; update it to use `crypto.randomUUID()` for proper UUID format to match the Prisma `String @id` type.

**Why**: The Prisma schema declares `id String @id` expecting UUID strings. `crypto.randomUUID()` is available in modern webviews and produces valid UUIDs.

## Risks / Trade-offs

- **Prisma datasource URL**: Prisma's `datasource db { provider = "sqlite" }` needs a `url` to validate locally. Use `env("DATABASE_URL")` pointing to a local `.db` file for `prisma generate`. This is for codegen only; the actual runtime path is controlled by Tauri. → Mitigation: document in `prisma/README.md` and `.env.example`.
- **Breaking import changes**: Old consumers of `chats`, `configuration`, `Chat`, `Configuration` exports will break. → Mitigation: the rewrite branch already deletes those consumers; flag in tasks.
- **`migrations.ts` removal**: Any code calling `runMigrations()` from the TypeScript side must be removed or replaced. The Tauri plugin handles migrations at startup. → Mitigation: grep for callers before deleting.

## Migration Plan

1. Update `prisma/schema.prisma` and run `prisma generate` to produce new types.
2. Update `src/lib/db/types.ts` — new `TableName`, new entity interfaces matching Prisma output.
3. Rewrite `src/lib/db/config.ts` → `src/lib/db/settings.ts` for `app_settings`.
4. Add `src/lib/db/repositories/` with typed CRUD helpers.
5. Update `src/lib/db/index.ts` to export new modules, remove old exports.
6. Delete `src/lib/db/migrations.ts`; remove any callers.
7. Update `prisma/schema.prisma` comment header to reference `db.rs` as peer schema.

Rollback: The change is isolated to the data-access layer. Old consumers are already deleted on the rewrite branch.

## Open Questions

- Should `crypto.randomUUID()` replace the current `generateId()` immediately, or is the existing format acceptable for the rewrite?
- Should `prisma generate` be added to the `dev`/`build` npm scripts to ensure types stay current automatically?
