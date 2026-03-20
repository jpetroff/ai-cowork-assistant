## Requirement: QueryBuilder generates correct SELECT SQL

The `QueryBuilder` class SHALL produce valid SQLite-compatible SQL strings from its fluent API without executing any real queries.

#### Scenario: Filter with equals operator
- **WHEN** `.filter('role', '=', 'user')` is chained and `.all()` is called
- **THEN** the generated SQL contains `WHERE role = ?` and the binding array contains `'user'`

#### Scenario: Multiple filters joined with AND
- **WHEN** two `.filter()` calls are chained
- **THEN** the WHERE clause joins them with `AND`

#### Scenario: IN operator with array value
- **WHEN** `.filter('id', 'IN', ['a', 'b', 'c'])` is called
- **THEN** the SQL contains `id IN (?, ?, ?)` and all three values appear in bindings

#### Scenario: orderBy produces ORDER BY clause
- **WHEN** `.orderBy('created_at', 'desc')` is chained
- **THEN** the SQL contains `ORDER BY created_at DESC`

#### Scenario: limit and offset produce LIMIT/OFFSET clauses
- **WHEN** `.limit(10).offset(20)` are chained
- **THEN** the SQL contains `LIMIT 10` and `OFFSET 20`

#### Scenario: count uses COUNT(*) subquery
- **WHEN** `.count()` is called
- **THEN** the SQL starts with `SELECT COUNT(*) as count FROM`

#### Scenario: first limits to one result
- **WHEN** `.first()` is called
- **THEN** the underlying query includes `LIMIT 1` and returns the first element or null

---

## Requirement: SqliteDatabase CRUD methods call correct SQL

`SqliteDatabase` SHALL delegate each method to the underlying plugin with correctly formed SQL and parameters. The plugin MUST be replaceable with a test double without modifying production code.

#### Scenario: get returns null when no row found
- **WHEN** `db.get('projects', 'nonexistent-id')` is called and the mock returns an empty array
- **THEN** the method returns `null`

#### Scenario: get returns typed record when found
- **WHEN** `db.get('projects', id)` is called and the mock returns one row
- **THEN** the method returns that row typed as the requested generic

#### Scenario: insert auto-generates id and timestamps
- **WHEN** `db.insert('projects', { name: 'X', folder_path: '/x' })` is called
- **THEN** the executed SQL includes `id`, `created_at`, and `updated_at` columns and returns a string ID

#### Scenario: upsert updates existing record
- **WHEN** `db.upsert('projects', { id: existingId, name: 'Y' })` is called and the record exists
- **THEN** an `UPDATE` statement is executed and `updated_at` is bumped

#### Scenario: upsert inserts new record when not found
- **WHEN** `db.upsert('projects', { id: newId, name: 'Z' })` is called and no record exists
- **THEN** an `INSERT` statement is executed

#### Scenario: remove calls DELETE with correct id
- **WHEN** `db.remove('projects', id)` is called
- **THEN** the executed SQL is `DELETE FROM projects WHERE id = $1` with the id as parameter

#### Scenario: DatabaseError is thrown on plugin failure
- **WHEN** the plugin mock throws and `db.get()` is called
- **THEN** the error is wrapped in a `DatabaseError` instance

---

## Requirement: Settings helpers read and write app_settings table

`getSetting` and `setSetting` SHALL correctly read from and upsert into the `app_settings` table using the singleton `db` instance.

#### Scenario: getSetting returns null when key absent
- **WHEN** `getSetting('theme')` is called and no row exists
- **THEN** the return value is `null`

#### Scenario: getSetting returns stored value
- **WHEN** `getSetting('theme')` is called and the table contains `{ key: 'theme', value: 'dark' }`
- **THEN** the return value is `'dark'`

#### Scenario: setSetting executes an INSERT ON CONFLICT upsert
- **WHEN** `setSetting('theme', 'dark')` is called
- **THEN** the executed SQL contains `ON CONFLICT(key) DO UPDATE SET value`

---

## Requirement: Repository functions perform correct domain operations

Each repository module SHALL provide typed, domain-specific functions that correctly construct and execute SQL through the `db` singleton.

#### Scenario: createProject inserts and returns a UUID
- **WHEN** `createProject({ name: 'P', folder_path: '/p' })` is called
- **THEN** an INSERT into `projects` is executed and a non-empty UUID string is returned

#### Scenario: listProjects orders by updated_at DESC
- **WHEN** `listProjects()` is called
- **THEN** the SQL contains `ORDER BY updated_at DESC`

#### Scenario: updateProject builds partial SET clause
- **WHEN** `updateProject(id, { name: 'New' })` is called
- **THEN** the SQL sets only the `name` and `updated_at` columns

#### Scenario: createConversation links to a project
- **WHEN** `createConversation({ project_id: pid })` is called
- **THEN** the INSERT includes the provided `project_id`

#### Scenario: listConversations filters by project_id
- **WHEN** `listConversations(projectId)` is called
- **THEN** the SQL contains `WHERE project_id = $1`

#### Scenario: createMessage excludes updated_at column
- **WHEN** `createMessage({ conversation_id, role, content, sequence_order })` is called
- **THEN** the INSERT does NOT include `updated_at` in its column list

#### Scenario: listMessages orders by sequence_order ASC
- **WHEN** `listMessages(conversationId)` is called
- **THEN** the SQL contains `ORDER BY sequence_order ASC`

#### Scenario: createArtifact defaults optional fields to null
- **WHEN** `createArtifact({ conversation_id, version: 1 })` is called with no optional fields
- **THEN** `message_id`, `title`, `file_path`, `file_hash` are inserted as `null`

#### Scenario: setDefaultProvider clears all then sets one
- **WHEN** `setDefaultProvider(id)` is called
- **THEN** two SQL statements execute: first sets all `is_default = 0`, then sets `is_default = 1` for the given id
