import { getDb } from '../db'
import { QueryBuilder } from '../query'

export type MessageRecord = {
  id: string
  chat_id: string
  role: string
  content: string
  created_at: number
}

export const messagesTable = 'messages'

export async function insert(
  data: Omit<MessageRecord, 'created_at'>
): Promise<void> {
  const db = await getDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO messages (id, chat_id, role, content, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.id, data.chat_id, data.role, data.content, now]
  )
}

export async function upsert(
  data: Omit<MessageRecord, 'created_at'>
): Promise<void> {
  const db = await getDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO messages (id, chat_id, role, content, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       role = excluded.role,
       content = excluded.content,
       updated_at = excluded.updated_at`,
    [data.id, data.chat_id, data.role, data.content, now]
  )
}

export async function get(id: string): Promise<MessageRecord | null> {
  const db = await getDb()
  const rows = await db.select<MessageRecord[]>(
    'SELECT id, chat_id, role, content, created_at FROM messages WHERE id = $1',
    [id]
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}

export function query(): QueryBuilder<MessageRecord> {
  return new QueryBuilder<MessageRecord>('messages')
}

export async function getByChat(chatId: string): Promise<MessageRecord[]> {
  const db = await getDb()
  const rows = await db.select<MessageRecord[]>(
    'SELECT id, chat_id, role, content, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
    [chatId]
  )
  return rows ?? []
}

export async function list(): Promise<MessageRecord[]> {
  const db = await getDb()
  const rows = await db.select<MessageRecord[]>(
    'SELECT id, chat_id, role, content, created_at FROM messages ORDER BY created_at DESC'
  )
  return rows ?? []
}

export async function remove(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM messages WHERE id = $1', [id])
}
