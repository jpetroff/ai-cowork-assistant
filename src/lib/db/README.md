# Database Module

Universal database interface for the application. Supports both local SQLite and future cloud implementations.

## Architecture

```
src/lib/db/
├── types.ts      # Core types and interfaces
├── sqlite.ts     # SQLite implementation
├── config.ts     # Configuration operations
└── index.ts      # Public exports
```

## Core Interface

The `DbInterface` provides a unified API for database operations:

```typescript
interface DbInterface {
  get<T>(table: TableName, id: string): Promise<T | null>
  insert<T extends Record<string, unknown>>(
    table: TableName,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<string>  // Returns generated ID
  upsert<T extends Record<string, unknown>>(
    table: TableName,
    data: Partial<T> & { id: string }
  ): Promise<void>
  remove(table: TableName, id: string): Promise<void>
  select<T>(sql: string, params?: unknown[]): Promise<T[]>
  execute(sql: string, params?: unknown[]): Promise<void>
}
```

## Table Names

Valid table names are defined as:

```typescript
type TableName = 'artifacts' | 'messages' | 'chats' | 'configuration'
```

## Error Handling

All database operations throw `DatabaseError` on failure:

```typescript
try {
  const record = await db.get('artifacts', id)
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('DB Error:', error.message)
    console.error('Original error:', error.originalError)
  }
}
```

## Usage Examples

### Creating a Database Instance

```typescript
import { createSqliteDb } from '@/lib/db'

const db = createSqliteDb()
```

### Basic CRUD Operations

```typescript
import { createSqliteDb } from '@/lib/db'
import type { Artifact } from '@/lib/artifacts'

const db = createSqliteDb()

// Insert (auto-generates id, created_at, updated_at)
const id = await db.insert<Artifact>('artifacts', {
  name: 'My Project',
  file_type: 'markdown',
  content: '# Hello',
  file_path: null,
  chat_id: null,
  message_id: null
})

// Get by ID
const artifact = await db.get<Artifact>('artifacts', id)

// Upsert (update if exists, insert if not)
await db.upsert<Artifact>('artifacts', {
  id: 'existing-id',
  name: 'Updated Name',
  content: 'Updated content'
  // created_at/updated_at auto-managed
})

// Delete
await db.remove('artifacts', id)
```

### Custom Queries

```typescript
// Select with custom SQL
const artifacts = await db.select<Artifact>(
  'SELECT * FROM artifacts WHERE chat_id = $1 ORDER BY updated_at DESC',
  [chatId]
)

// Execute arbitrary SQL
await db.execute(
  'UPDATE artifacts SET name = $1 WHERE id = $2',
  ['New Name', id]
)
```

### Configuration Operations

```typescript
import { loadConfiguration, saveConfigurationEntry } from '@/lib/db'

// Load all config
const config = await loadConfiguration()
console.log(config.USER_NAME)

// Save single entry
await saveConfigurationEntry('USER_NAME', 'John Doe')
```

## Table-Specific APIs

While the universal interface works for all tables, convenience modules provide type-safe, domain-specific functions:

```typescript
import { artifacts } from '@/lib/artifacts'
import { messages } from '@/lib/messages'
import { chats } from '@/lib/chats'

// Artifacts
const artifact = await artifacts.get(id)
const recent = await artifacts.getMostRecent()
const list = await artifacts.listByChat(chatId)
await artifacts.upsertArtifact({
  id: '123',
  name: 'Project',
  file_type: 'markdown',
  content: '...',
  chat_id: '...' // optional
})

// Messages
const message = await messages.get(id)
const chatMessages = await messages.getByChat(chatId)

// Chats
const chat = await chats.get(id)
const allChats = await chats.list()
```

## Future: Cloud Implementation

To switch to a cloud API backend:

1. Create `http.ts` implementing `DbInterface`
2. Swap the import in table modules:

```typescript
// Before
import { createSqliteDb } from './db'
const db = createSqliteDb()

// After
import { createHttpDb } from './db/http'
const db = createHttpDb({ baseUrl: 'https://api.example.com' })
```

No changes needed in table-specific code.

## Adding a New Table

1. Define the table in `prisma/schema.prisma`:

```prisma
model NewTable {
  id          String   @id
  name        String
  value       Int
  created_at  Int
  updated_at  Int
  
  @@map("new_table")
}
```

2. Run `bun run db:generate` to generate TypeScript types

3. Add table name to `TableName` type in `db/types.ts`:

```typescript
export type TableName = 'artifacts' | 'messages' | 'chats' | 'configuration' | 'new_table'
```

4. Create convenience module `src/lib/newTable.ts`:

```typescript
import type { NewTable } from '../generated/prisma/client'
import { createSqliteDb } from './db'
import type { TableName } from './db'

export type { NewTable }

const TABLE: TableName = 'new_table'
const db = createSqliteDb()

export async function get(id: string): Promise<NewTable | null> {
  return db.get<NewTable>(TABLE, id)
}

export async function insert(
  data: Omit<NewTable, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  return db.insert<NewTable>(TABLE, data)
}

export async function upsert(
  data: Partial<NewTable> & { id: string }
): Promise<void> {
  return db.upsert<NewTable>(TABLE, data)
}

export async function remove(id: string): Promise<void> {
  return db.remove(TABLE, id)
}
```

## Best Practices

1. **Always use table-specific modules** for domain operations
2. **Handle errors** with try/catch blocks
3. **Use Prisma-generated types** for type safety
4. **Don't use raw SQL** unless necessary for complex queries
5. **Use the universal interface** only for generic operations

## Scripts

```bash
# Generate TypeScript types from Prisma schema
bun run db:generate

# Run database migrations
bun run db:migrate

# Open Prisma Studio (database GUI)
bun run db:studio
```
