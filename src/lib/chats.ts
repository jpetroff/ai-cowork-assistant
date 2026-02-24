import type { Chat } from '../generated/prisma/client'
import { db, type TableName } from './db'

export type { Chat }

const TABLE: TableName = 'chats'

/**
 * Convenience type for insert operations
 */
export type ChatInput = Omit<Chat, 'id' | 'created_at' | 'updated_at'>

/**
 * Get a chat by ID
 */
export async function get(id: string): Promise<Chat | null> {
  return db.get<Chat>(TABLE, id)
}

/**
 * Insert a new chat
 * @returns The generated ID
 */
export async function insert(data: ChatInput): Promise<string> {
  return db.insert<Chat>(TABLE, data)
}

/**
 * Upsert a chat (insert or update)
 */
export async function upsert(
  data: Partial<Chat> & { id: string }
): Promise<void> {
  return db.upsert<Chat>(TABLE, data)
}

/**
 * List all chats (ordered by updated_at descending)
 */
export async function list(): Promise<Chat[]> {
  return db.select<Chat>('SELECT * FROM chats ORDER BY updated_at DESC')
}

/**
 * List all chats for a specific project
 */
export async function listByProject(projectId: string): Promise<Chat[]> {
  return db.select<Chat>(
    'SELECT * FROM chats WHERE project_id = $1 ORDER BY updated_at DESC',
    [projectId]
  )
}

/**
 * Delete a chat by ID
 */
export async function remove(id: string): Promise<void> {
  return db.remove(TABLE, id)
}

/**
 * Update a chat's name
 */
export async function rename(id: string, name: string): Promise<void> {
  return db.upsert<Chat>(TABLE, { id, name, updated_at: Date.now() })
}

/**
 * Move a chat to a different project
 */
export async function moveToProject(
  id: string,
  projectId: string
): Promise<void> {
  return db.upsert<Chat>(TABLE, {
    id,
    project_id: projectId,
    updated_at: Date.now(),
  })
}
