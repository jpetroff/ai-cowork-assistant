import type { Chat } from '../generated/prisma/client'
import { createSqliteDb } from './db'
import type { TableName } from './db'

// Re-export the Prisma type
export type { Chat }

// Table name constant
const TABLE: TableName = 'chats'

// Database instance (singleton)
const db = createSqliteDb()

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
  return db.select<Chat>(
    'SELECT * FROM chats ORDER BY updated_at DESC'
  )
}

/**
 * Delete a chat by ID
 */
export async function remove(id: string): Promise<void> {
  return db.remove(TABLE, id)
}
