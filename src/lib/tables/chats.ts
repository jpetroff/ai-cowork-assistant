import { getDb } from '../db'
import { QueryBuilder } from '../query'

export type ChatRecord = {
  id: string
  name: string
  created_at: number
  updated_at: number
}

export const chatsTable = 'chats'

export async function insert(
  data: Omit<ChatRecord, 'created_at' | 'updated_at'>
): Promise<void> {
  const db = await getDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO chats (id, name, created_at, updated_at)
     VALUES ($1, $2, $3, $4)`,
    [data.id, data.name, now, now]
  )
}

export async function upsert(
  data: Omit<ChatRecord, 'created_at' | 'updated_at'>
): Promise<void> {
  const db = await getDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO chats (id, name, created_at, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       updated_at = excluded.updated_at`,
    [data.id, data.name, now, now]
  )
}

export async function get(id: string): Promise<ChatRecord | null> {
  const db = await getDb()
  const rows = await db.select<ChatRecord[]>(
    'SELECT id, name, created_at, updated_at FROM chats WHERE id = $1',
    [id]
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}

export function query(): QueryBuilder<ChatRecord> {
  return new QueryBuilder<ChatRecord>('chats')
}

export async function list(): Promise<ChatRecord[]> {
  const db = await getDb()
  const rows = await db.select<ChatRecord[]>(
    'SELECT id, name, created_at, updated_at FROM chats ORDER BY updated_at DESC'
  )
  return rows ?? []
}

export async function remove(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM chats WHERE id = $1', [id])
}
