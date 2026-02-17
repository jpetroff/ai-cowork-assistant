import Database from '@tauri-apps/plugin-sql'

const USER_DATA_DB_NAME = 'sqlite:user_data.db'

let userDataDbInstance: Database | null = null

export async function getUserDataDb(): Promise<Database> {
  if (!userDataDbInstance) {
    userDataDbInstance = await Database.load(USER_DATA_DB_NAME)
  }
  return userDataDbInstance
}

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

export async function loadArtifactById(
  id: string
): Promise<ArtifactRecord | null> {
  const db = await getUserDataDb()
  const rows = await db.select<ArtifactRecord[]>(
    'SELECT id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at FROM artifacts WHERE id = $1',
    [id]
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}

export type UpsertArtifactInput = {
  id: string
  name: string
  file_type: string
  content: string
  chat_id?: string
  message_id?: string
}

export async function upsertArtifact(
  input: UpsertArtifactInput
): Promise<void> {
  const db = await getUserDataDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO artifacts (id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       file_type = excluded.file_type,
       content = excluded.content,
       chat_id = excluded.chat_id,
       message_id = excluded.message_id,
       updated_at = excluded.updated_at`,
    [
      input.id,
      input.name,
      input.file_type,
      input.content,
      null,
      input.chat_id ?? null,
      input.message_id ?? null,
      now,
      now,
    ]
  )
}

export async function listArtifacts(): Promise<
  Pick<ArtifactRecord, 'id' | 'name' | 'file_type' | 'updated_at'>[]
> {
  const db = await getUserDataDb()
  const rows = await db.select<
    Pick<ArtifactRecord, 'id' | 'name' | 'file_type' | 'updated_at'>[]
  >(
    'SELECT id, name, file_type, updated_at FROM artifacts ORDER BY updated_at DESC'
  )
  return rows ?? []
}

export async function getMostRecentArtifact(): Promise<ArtifactRecord | null> {
  const db = await getUserDataDb()
  const rows = await db.select<ArtifactRecord[]>(
    'SELECT id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at FROM artifacts ORDER BY updated_at DESC LIMIT 1'
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}

export async function getMostRecentArtifactByChat(
  chatId: string
): Promise<ArtifactRecord | null> {
  const db = await getUserDataDb()
  const rows = await db.select<ArtifactRecord[]>(
    'SELECT id, name, file_type, content, file_path, chat_id, message_id, created_at, updated_at FROM artifacts WHERE chat_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [chatId]
  )
  if (rows.length === 0) return null
  return rows[0] ?? null
}
