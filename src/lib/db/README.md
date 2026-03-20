# Database Module

SQLite database layer backed by `@tauri-apps/plugin-sql`. Provides a universal `DbInterface`, a fluent query builder, typed repository functions per domain, and app settings helpers.

## Architecture

```text
src/lib/db/
├── types.ts              # Entity types, DbInterface, DatabaseError
├── sqlite.ts             # SqliteDatabase implementation + singleton `db`
├── query-builder.ts      # Fluent QueryBuilder
├── settings.ts           # App settings (get/set key-value pairs)
├── repositories/
│   ├── projects.ts       # Project CRUD
│   ├── conversations.ts  # Conversation CRUD
│   ├── messages.ts       # Message insert/list
│   ├── artifacts.ts      # Artifact CRUD
│   ├── llm-providers.ts  # LLM provider CRUD + default management
│   └── index.ts          # Re-exports all repositories
└── index.ts              # Public exports
```

## Tables

| Table | Entity type | Notes |
| --- | --- | --- |
| `projects` | `Project` | Top-level workspace folders |
| `conversations` | `Conversation` | Belongs to a project |
| `messages` | `Message` | Belongs to a conversation; no `updated_at` |
| `artifacts` | `Artifact` | Files/content produced in a conversation |
| `llm_providers` | `LlmProvider` | AI provider config; no `updated_at` |
| `app_settings` | `AppSetting` | Key-value store for app preferences |

## Importing

```typescript
// Preferred: use repository functions directly
import {
  createProject, getProject, listProjects, updateProject, deleteProject,
  createConversation, getConversation, listConversations, updateConversation, deleteConversation,
  createMessage, listMessages,
  createArtifact, getArtifact, listArtifacts, updateArtifact,
  createLlmProvider, getLlmProvider, listLlmProviders, updateLlmProvider, deleteLlmProvider, setDefaultProvider,
} from '@/lib/db'

// Settings
import { getSetting, setSetting, SETTING_KEYS } from '@/lib/db'

// Low-level access (only when needed)
import { db } from '@/lib/db'
import type { Project, Conversation, Message, Artifact, LlmProvider } from '@/lib/db'
```

## Repositories

### Projects

```typescript
import { createProject, getProject, listProjects, updateProject, deleteProject } from '@/lib/db'

const id = await createProject({ name: 'My Project', folder_path: '/home/user/my-project' })

const project = await getProject(id)          // Project | null

const all = await listProjects()               // Project[], ordered by updated_at DESC

await updateProject(id, { name: 'Renamed' })  // partial update, auto-bumps updated_at

await deleteProject(id)
```

### Conversations

```typescript
import { createConversation, getConversation, listConversations, updateConversation, deleteConversation } from '@/lib/db'

const id = await createConversation({ project_id: projectId, title: 'Optional title' })

const conv = await getConversation(id)                  // Conversation | null

const all = await listConversations(projectId)           // Conversation[], ordered by updated_at DESC

await updateConversation(id, { title: 'New title' })

await deleteConversation(id)
```

### Messages

Messages are append-only — there is no update function. Sequence order must be managed by the caller.

```typescript
import { createMessage, listMessages } from '@/lib/db'

const id = await createMessage({
  conversation_id: convId,
  role: 'user',           // 'user' | 'assistant'
  content: 'Hello',
  sequence_order: 0,      // caller manages ordering
})

const msgs = await listMessages(convId)   // Message[], ordered by sequence_order ASC
```

### Artifacts

```typescript
import { createArtifact, getArtifact, listArtifacts, updateArtifact } from '@/lib/db'

const id = await createArtifact({
  conversation_id: convId,
  version: 1,
  // optional:
  message_id: msgId,
  title: 'Result',
  content: '# Hello',
  file_path: '/path/to/file',
  file_hash: 'abc123',
})

const artifact = await getArtifact(id)              // Artifact | null

const all = await listArtifacts(convId)              // Artifact[], ordered by version ASC

await updateArtifact(id, {
  content: '# Updated',
  file_hash: 'def456',
  // any subset of: title, content, file_path, file_hash, message_id
})
```

### LLM Providers

```typescript
import { createLlmProvider, getLlmProvider, listLlmProviders, updateLlmProvider, deleteLlmProvider, setDefaultProvider } from '@/lib/db'

const id = await createLlmProvider({
  name: 'Anthropic',
  provider_type: 'anthropic',
  base_url: 'https://api.anthropic.com',
  api_key: 'sk-...',   // optional
  is_default: 1,       // optional, defaults to 0
})

const provider = await getLlmProvider(id)    // LlmProvider | null

const all = await listLlmProviders()          // LlmProvider[], ordered by created_at ASC

await updateLlmProvider(id, { api_key: 'new-key' })

// Clears is_default on all rows, then sets is_default = 1 on the given id
await setDefaultProvider(id)

await deleteLlmProvider(id)
```

## App Settings

Typed keys are defined in `SETTING_KEYS`. You can also pass arbitrary string keys.

```typescript
import { getSetting, setSetting, SETTING_KEYS } from '@/lib/db'

// SETTING_KEYS = { THEME, APPROVAL_MODE, EDITOR_AUTOSAVE_INTERVAL_MS }

await setSetting(SETTING_KEYS.THEME, 'dark')

const theme = await getSetting(SETTING_KEYS.THEME)   // string | null
```

## Low-Level DbInterface

Use the singleton `db` when repository functions don't cover your needs.

```typescript
import { db } from '@/lib/db'

// Get by ID
const project = await db.get<Project>('projects', id)

// Insert (auto-generates id, created_at, updated_at)
const newId = await db.insert<Project>('projects', { name: 'X', folder_path: '/x' })

// Upsert (update if exists, insert if not)
await db.upsert<Project>('projects', { id, name: 'Updated' })

// Delete
await db.remove('projects', id)

// Raw select
const rows = await db.select<Project>(
  'SELECT * FROM projects WHERE folder_path LIKE $1',
  ['/home/%']
)

// Raw execute
await db.execute('DELETE FROM projects WHERE created_at < $1', [cutoff])
```

## Query Builder

The `QueryBuilder` provides a fluent, type-safe API for `SELECT` queries. Access it via `db.query()`.

```typescript
import { db } from '@/lib/db'
import type { Message } from '@/lib/db'

// Basic filter + order + limit
const messages = await db
  .query<Message>('messages')
  .filter('conversation_id', '=', convId)
  .orderBy('sequence_order', 'asc')
  .limit(50)
  .all()

// First result
const first = await db
  .query<Message>('messages')
  .filter('conversation_id', '=', convId)
  .first()    // Message | null

// Count
const total = await db
  .query<Message>('messages')
  .filter('conversation_id', '=', convId)
  .count()    // number

// IN operator
const selected = await db
  .query<Message>('messages')
  .filter('id', 'IN', ['id1', 'id2', 'id3'])
  .all()

// Pagination
const page2 = await db
  .query<Message>('messages')
  .filter('conversation_id', '=', convId)
  .orderBy('sequence_order', 'asc')
  .limit(20)
  .offset(20)
  .all()
```

**Supported filter operators:** `=` `!=` `<` `<=` `>` `>=` `LIKE` `IN`

**Terminal methods:** `.all()` → `T[]`, `.first()` → `T | null`, `.count()` → `number`

> Note: Multiple `.filter()` calls are joined with `AND`. There is no `OR` support in the query builder — use raw `db.select()` for complex conditions.

## Error Handling

All operations throw `DatabaseError` on failure:

```typescript
import { DatabaseError } from '@/lib/db'

try {
  await createProject({ name: 'X', folder_path: '/x' })
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error(error.message)        // human-readable description
    console.error(error.originalError)  // underlying plugin error, if any
  }
}
```

## Adding a New Table

1. Define the model in `prisma/schema.prisma` and run `bun run db:generate`

2. Add the table name to `TableName` in [types.ts](types.ts):

   ```typescript
   export type TableName = 'projects' | 'conversations' | ... | 'new_table'
   ```

3. Add the entity interface to [types.ts](types.ts)

4. Create `repositories/new-table.ts` following the existing repository pattern

5. Re-export from [repositories/index.ts](repositories/index.ts)

## Scripts

```bash
bun run db:generate   # Regenerate TypeScript types from Prisma schema
bun run db:migrate    # Run migrations
bun run db:studio     # Open Prisma Studio
```
