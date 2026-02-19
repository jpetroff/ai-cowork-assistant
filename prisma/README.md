# Database Schema Modification Guide

This guide explains how to add new tables or modify existing tables in the application database.

## Overview

The database schema is defined in multiple places that must be kept in sync:

1. **Prisma schema** (`prisma/schema.prisma`) - TypeScript type generation
2. **Rust migrations** (`src-tauri/src/db.rs`) - SQLite table creation
3. **TypeScript table names** (`src/lib/db/types.ts`) - Query builder support
4. **Convenience module** (`src/lib/<table>.ts`) - CRUD operations

## Adding a New Table

### Step 1: Define in Prisma Schema

Add the model to `prisma/schema.prisma`:

```prisma
model NewTable {
  id          String   @id
  name        String
  value       Int?
  created_at  Int
  updated_at  Int

  @@map("new_table")
}
```

**Rules:**

- Always include `id String @id`, `created_at Int`, `updated_at Int`
- Use `@@map("snake_case")` to map to SQLite table name
- Use `Int` for timestamps (Unix milliseconds)

### Step 2: Add Rust Migration

Edit `src-tauri/src/db.rs`. For a **new database** (no existing data):

Replace migration 1 entirely with all tables (including your new one):

```rust
Migration {
    version: 1,
    description: "create_base_schema",
    sql: "CREATE TABLE IF NOT EXISTS configuration ...;
          CREATE TABLE IF NOT EXISTS new_table (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              value INTEGER,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
          );",
    kind: MigrationKind::Up,
},
```

Add indexes to migration 2:

```rust
Migration {
    version: 2,
    description: "add_indexes",
    sql: "CREATE INDEX IF NOT EXISTS idx_new_table_updated_at ON new_table(updated_at);",
    kind: MigrationKind::Up,
},
```

### Step 3: Generate TypeScript Types

```bash
bun run db:generate
```

### Step 4: Register Table Name

Edit `src/lib/db/types.ts`:

```typescript
export type TableName =
  | 'artifacts'
  | 'messages'
  | 'chats'
  | 'configuration'
  | 'projects'
  | 'new_table' // Add here
```

### Step 5: Create Convenience Module

Create `src/lib/newTable.ts`:

```typescript
import type { NewTable } from '../generated/prisma/client'
import { createSqliteDb } from './db'
import type { TableName } from './db'

export type { NewTable }

const TABLE: TableName = 'new_table'
const db = createSqliteDb()

export type NewTableInput = Omit<NewTable, 'id' | 'created_at' | 'updated_at'>

export async function get(id: string): Promise<NewTable | null> {
  return db.get<NewTable>(TABLE, id)
}

export async function insert(data: NewTableInput): Promise<string> {
  return db.insert<NewTable>(TABLE, data)
}

export async function upsert(
  data: Partial<NewTable> & { id: string }
): Promise<void> {
  return db.upsert<NewTable>(TABLE, data)
}

export async function list(): Promise<NewTable[]> {
  return db.select<NewTable>('SELECT * FROM new_table ORDER BY updated_at DESC')
}

export async function remove(id: string): Promise<void> {
  return db.remove(TABLE, id)
}
```

### Step 6: Verify

```bash
bunx tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
```

## Modifying an Existing Table

### Adding a Column

1. **Update Prisma schema** - add the field:

```prisma
model Chat {
  id          String   @id
  name        String
  project_id  String?  // New column
  created_at  Int
  updated_at  Int

  @@map("chats")
}
```

2. **Update Rust migration** - add column to CREATE TABLE:

```rust
CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT,  // New column
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

3. **Add index** (if needed for queries) in migration 2:

```rust
CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);
```

4. **Regenerate types**:

```bash
bun run db:generate
```

5. **Update convenience module** - add query functions using the new column:

```typescript
export async function listByProject(projectId: string): Promise<Chat[]> {
  return db.select<Chat>(
    'SELECT * FROM chats WHERE project_id = $1 ORDER BY updated_at DESC',
    [projectId]
  )
}
```

## Important Notes

### Migration Strategy

**This app uses a simple migration strategy:**

- Version 1: Creates all tables
- Version 2: Creates all indexes
- **No backward compatibility needed** - assumes fresh database

If you need to support existing databases with data, you would need additional migration versions with `ALTER TABLE` statements.

### Column Types Mapping

| Prisma Type | SQLite Type                |
| ----------- | -------------------------- |
| `String`    | `TEXT`                     |
| `Int`       | `INTEGER`                  |
| `Float`     | `REAL`                     |
| `Boolean`   | `INTEGER` (0/1)            |
| `DateTime`  | `INTEGER` (Unix timestamp) |

### Nullable Columns

- Prisma: `String?` or `Int?`
- SQLite: No `NOT NULL` constraint
- Rust migration: No `NOT NULL` after type

### Foreign Keys

```prisma
model Message {
  id       String  @id
  chat_id  String
  // ...
}

// SQLite:
chat_id TEXT NOT NULL,
FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
```

## Checklist for New Table

- [ ] Add model to `prisma/schema.prisma`
- [ ] Add CREATE TABLE to migration 1 in `src-tauri/src/db.rs`
- [ ] Add CREATE INDEX to migration 2 in `src-tauri/src/db.rs`
- [ ] Run `bun run db:generate`
- [ ] Add table name to `src/lib/db/types.ts` TableName union
- [ ] Create `src/lib/<tableName>.ts` convenience module
- [ ] Run `bunx tsc --noEmit`
- [ ] Run `cargo check` in `src-tauri`

## Troubleshooting

**Type errors after schema change:**

- Run `bun run db:generate` again
- Check that Prisma field names match SQLite column names in migrations

**Migration not applying:**

- Delete the database file to start fresh
- Check SQL syntax in migration

**Query builder not finding table:**

- Add table name to `TableName` type in `src/lib/db/types.ts`
