import type { Message } from '../generated/prisma/client'
import { createSqliteDb } from './db'
import type { TableName } from './db'

// Re-export the Prisma type
export type { Message }

// Table name constant
const TABLE: TableName = 'messages'

// Database instance (singleton)
const db = createSqliteDb()

/**
 * Convenience type for insert operations
 */
export type MessageInput = Omit<Message, 'id' | 'created_at'>

/**
 * Get a message by ID
 */
export async function get(id: string): Promise<Message | null> {
  return db.get<Message>(TABLE, id)
}

/**
 * Insert a new message
 * @returns The generated ID
 */
export async function insert(data: MessageInput): Promise<string> {
  return db.insert<Message>(TABLE, data)
}

/**
 * Upsert a message (insert or update)
 */
export async function upsert(
  data: Partial<Message> & { id: string }
): Promise<void> {
  return db.upsert<Message>(TABLE, data)
}

/**
 * Get all messages for a specific chat, ordered by creation time
 */
export async function getByChat(chatId: string): Promise<Message[]> {
  return db.select<Message>(
    'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
    [chatId]
  )
}

/**
 * List all messages (ordered by creation time descending)
 */
export async function list(): Promise<Message[]> {
  return db.select<Message>(
    'SELECT * FROM messages ORDER BY created_at DESC'
  )
}

/**
 * Delete a message by ID
 */
export async function remove(id: string): Promise<void> {
  return db.remove(TABLE, id)
}
