import { getLocalAppDb } from '../db'
import { QueryBuilder } from '../query'
import { Document } from '../schema'

export type ArtifactRecord = {
  id: string
  name: string
  file_type: string
  content: string | null
  file_path: string | null
  chat_id: string | null
  message_id: string | null
  created_at: number
  updated_at: number
}

export type ArtifactInput = Omit<ArtifactRecord, 'created_at' | 'updated_at'>

export const artifactsTable = 'artifacts'

export async function insert(data: ArtifactInput): Promise<void> {
  const db = await getLocalAppDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO artifacts (id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      data.id,
      data.name,
      data.file_type,
      data.content,
      data.file_path,
      data.chat_id ?? null,
      data.message_id ?? null,
      now,
      now,
    ]
  )
}

export async function upsert(data: ArtifactInput): Promise<void> {
  const db = await getLocalAppDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO artifacts (id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       file_type = excluded.file_type,
       content = excluded.content,
       file_path = excluded.file_path,
       chat_id = excluded.chat_id,
       message_id = excluded.message_id,
       updated_at = excluded.updated_at`,
    [
      data.id,
      data.name,
      data.file_type,
      data.content,
      data.file_path,
      data.chat_id ?? null,
      data.message_id ?? null,
      now,
      now,
    ]
  )
}

export async function get(id: string): Promise<ArtifactRecord | null> {
  const db = await getLocalAppDb()
  const rows = await db.select<ArtifactRecord[]>(
    'SELECT id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at FROM artifacts WHERE id = $1',
    [id]
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}

export function query(): QueryBuilder<ArtifactRecord> {
  return new QueryBuilder<ArtifactRecord>('artifacts')
}

export async function list(): Promise<
  Pick<ArtifactRecord, 'id' | 'name' | 'file_type' | 'updated_at'>[]
> {
  const db = await getLocalAppDb()
  const rows = await db.select<
    Pick<ArtifactRecord, 'id' | 'name' | 'file_type' | 'updated_at'>[]
  >(
    'SELECT id, name, file_type, updated_at FROM artifacts ORDER BY updated_at DESC'
  )
  return rows ?? []
}

export async function getMostRecent(): Promise<ArtifactRecord | null> {
  const db = await getLocalAppDb()
  const rows = await db.select<ArtifactRecord[]>(
    'SELECT id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at FROM artifacts ORDER BY updated_at DESC LIMIT 1'
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}

export async function getByChat(
  chatId: string
): Promise<ArtifactRecord | null> {
  const db = await getLocalAppDb()
  const rows = await db.select<ArtifactRecord[]>(
    'SELECT id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at FROM artifacts WHERE chat_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [chatId]
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}

export async function listByChat(chatId: string): Promise<ArtifactRecord[]> {
  const db = await getLocalAppDb()
  const rows = await db.select<ArtifactRecord[]>(
    'SELECT id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at FROM artifacts WHERE chat_id = $1 ORDER BY updated_at DESC',
    [chatId]
  )
  return rows ?? []
}

export async function remove(id: string): Promise<void> {
  const db = await getLocalAppDb()
  await db.execute('DELETE FROM artifacts WHERE id = $1', [id])
}
