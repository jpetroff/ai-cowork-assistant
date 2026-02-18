import type { Artifact } from '../generated/prisma/client'
import { createSqliteDb } from './db'
import type { TableName } from './db'

// Re-export the Prisma type
export type { Artifact }

// Table name constant
const TABLE: TableName = 'artifacts'

// Database instance (singleton)
const db = createSqliteDb()

/**
 * Convenience type for upsert operations
 * Content is required (not nullable), chat_id/message_id are optional
 */
export type UpsertArtifactInput = Pick<
  Artifact,
  'id' | 'name' | 'file_type'
> & {
  content: string
  chat_id?: string
  message_id?: string
}

/**
 * Get an artifact by ID
 */
export async function get(id: string): Promise<Artifact | null> {
  return db.get<Artifact>(TABLE, id)
}

/**
 * Insert a new artifact
 * @returns The generated ID
 */
export async function insert(
  data: Omit<Artifact, 'id' | 'created_at' | 'updated_at'>
): Promise<string> {
  return db.insert<Artifact>(TABLE, data)
}

/**
 * Upsert an artifact (insert or update)
 */
export async function upsert(
  data: Partial<Artifact> & { id: string }
): Promise<void> {
  return db.upsert<Artifact>(TABLE, data)
}

/**
 * Upsert with convenience API (content required, optional chat/message IDs)
 */
export async function upsertArtifact(input: UpsertArtifactInput): Promise<void> {
  await upsert({
    id: input.id,
    name: input.name,
    file_type: input.file_type,
    content: input.content,
    file_path: null,
    chat_id: input.chat_id ?? null,
    message_id: input.message_id ?? null,
  })
}

/**
 * List all artifacts (minimal fields for list views)
 */
export async function list(): Promise<
  Pick<Artifact, 'id' | 'name' | 'file_type' | 'updated_at'>[]
> {
  return db.select<
    Pick<Artifact, 'id' | 'name' | 'file_type' | 'updated_at'>
  >(
    'SELECT id, name, file_type, updated_at FROM artifacts ORDER BY updated_at DESC'
  )
}

/**
 * Get the most recently updated artifact
 */
export async function getMostRecent(): Promise<Artifact | null> {
  const rows = await db.select<Artifact>(
    'SELECT * FROM artifacts ORDER BY updated_at DESC LIMIT 1'
  )
  return rows.length > 0 ? rows[0] : null
}

/**
 * Alias for getMostRecent
 */
export async function getMostRecentArtifact(): Promise<Artifact | null> {
  return getMostRecent()
}

/**
 * Get the most recent artifact for a specific chat
 */
export async function getByChat(chatId: string): Promise<Artifact | null> {
  const rows = await db.select<Artifact>(
    'SELECT * FROM artifacts WHERE chat_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [chatId]
  )
  return rows.length > 0 ? rows[0] : null
}

/**
 * Alias for getByChat
 */
export async function getMostRecentArtifactByChat(
  chatId: string
): Promise<Artifact | null> {
  return getByChat(chatId)
}

/**
 * List all artifacts for a specific chat
 */
export async function listByChat(chatId: string): Promise<Artifact[]> {
  return db.select<Artifact>(
    'SELECT * FROM artifacts WHERE chat_id = $1 ORDER BY updated_at DESC',
    [chatId]
  )
}

/**
 * Delete an artifact by ID
 */
export async function remove(id: string): Promise<void> {
  return db.remove(TABLE, id)
}

/**
 * Alias for get()
 */
export async function loadArtifactById(id: string): Promise<Artifact | null> {
  return get(id)
}
