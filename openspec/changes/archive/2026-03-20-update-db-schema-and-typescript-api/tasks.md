## 1. Prisma Schema

- [x] 1.1 Rewrite `prisma/schema.prisma`: replace all existing models with `Project`, `Conversation`, `Message`, `Artifact`, `LlmProvider`, `AppSetting` matching `db.rs` column names and types
- [x] 1.2 Add cross-reference comment at top of `prisma/schema.prisma` pointing to `src-tauri/src/db.rs` as the Rust peer
- [x] 1.3 Add cross-reference comment at top of `src-tauri/src/db.rs` pointing to `prisma/schema.prisma` as the TypeScript peer
- [x] 1.4 Run `prisma generate` and verify the generated types compile (`npm run db:generate`)
- [x] 1.5 Prepend `prisma generate` to `dev` and `build` npm scripts so types are always regenerated before compilation

## 2. TypeScript Types

- [x] 2.1 Update `TableName` union in `src/lib/db/types.ts` to `'projects' | 'conversations' | 'messages' | 'artifacts' | 'llm_providers' | 'app_settings'`
- [x] 2.2 Add TypeScript entity interfaces in `src/lib/db/types.ts` for all six tables (or re-export from Prisma generated types)
- [x] 2.3 Update `generateId()` in `src/lib/db/sqlite.ts` to use `crypto.randomUUID()` for proper UUID format

## 3. Settings Module

- [x] 3.1 Create `src/lib/db/settings.ts` with `getSetting(key)`, `setSetting(key, value)`, and a `SETTING_KEYS` constant for `theme`, `approval_mode`, `editor_autosave_interval_ms`
- [x] 3.2 Delete `src/lib/db/config.ts`
- [x] 3.3 Update `src/lib/db/index.ts` to export from `settings.ts` and remove all `config.ts` exports

## 4. Repository Modules

- [x] 4.1 Create `src/lib/db/repositories/projects.ts` with `createProject`, `getProject`, `listProjects`, `updateProject`, `deleteProject`
- [x] 4.2 Create `src/lib/db/repositories/conversations.ts` with `createConversation`, `getConversation`, `listConversations`, `updateConversation`, `deleteConversation` (ordered by `updated_at DESC`)
- [x] 4.3 Create `src/lib/db/repositories/messages.ts` with `createMessage`, `listMessages` (ordered by `sequence_order ASC`)
- [x] 4.4 Create `src/lib/db/repositories/artifacts.ts` with `createArtifact`, `getArtifact`, `listArtifacts`, `updateArtifact` (ordered by `version ASC`)
- [x] 4.5 Create `src/lib/db/repositories/llm-providers.ts` with `createLlmProvider`, `getLlmProvider`, `listLlmProviders`, `updateLlmProvider`, `deleteLlmProvider`, `setDefaultProvider` (clears other defaults atomically)
- [x] 4.6 Create `src/lib/db/repositories/index.ts` that re-exports all repository functions
- [x] 4.7 Export repositories from `src/lib/db/index.ts`

## 5. Cleanup

- [x] 5.1 Search for all callers of `runMigrations()` from `src/lib/db/migrations.ts` and remove the calls
- [x] 5.2 Delete `src/lib/db/migrations.ts`
- [x] 5.3 Search for all imports of old names (`loadConfiguration`, `saveConfigurationEntry`, `saveConfiguration`, `Configuration`, `chats`, `configuration` table references) and update or remove them
- [x] 5.4 Verify `tsc --noEmit` passes with no type errors after all changes
