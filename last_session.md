Implementation Complete
Successfully implemented Convex-style DB API abstraction layer with the following components:
Files Created:

1. src/lib/schema.ts - Validator builder (similar to Convex's v object) for runtime validation
2. src/lib/query.ts - QueryBuilder class with chainable API: .filter(), .orderBy(), .limit(), .offset()
3. src/lib/tables/ - Table-specific helper modules:
   - artifacts.ts - CRUD operations, upsert, getByChat
   - chats.ts - CRUD operations
   - messages.ts - CRUD operations, getByChat
Files Modified:
4. src/lib/db.ts - Added DB class with Convex-like API:
   - db.insert(table, data) - Returns new document ID
   - db.get(table, id) - Get by ID
   - db.query(table) - Chainable query builder
   - db.patch(table, id, data) - Shallow merge update
   - db.replace(table, id, data) - Full replace
   - db.delete(table, id) - Delete by ID
   - Exported CONFIG_KEYS (moved from db.ts)
5. src/lib/artifacts.ts - Refactored to use table helpers, exports:
   - loadArtifactById, upsertArtifact, getMostRecentArtifact, getMostRecentArtifactByChat
   - UpsertArtifactInput type
6. src-tauri/src/db.rs - Added indexes for performance (version 6 migration):
   - idx_artifacts_chat_id
   - idx_artifacts_updated_at
   - idx_messages_chat_id
   - idx_messages_created_at
   - idx_chats_updated_at
Usage Examples:
// Low-level DB API (Convex-style)
import { db } from '@/lib/db'
const id = await db.insert('artifacts', { name: 'test', ... })
const artifact = await db.get<Artifact>('artifacts', id)
await db.patch('artifacts', id, { name: 'updated' })
// Query builder
const artifacts = await db.query<Artifact>('artifacts')
  .filter('chat_id', '=', chatId)
  .orderBy('updated_at', 'desc')
  .limit(10)
  .all()
// High-level table API
import { artifacts } from '@/lib/artifacts'
await artifacts.upsert({ id, name, file_type, content })
const recent = await artifacts.getByChat(chatId)
✅ All type checks pass  
✅ Build succeeds  
✅ Code formatted with Prettier
