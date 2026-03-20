import { db } from '../sqlite'
import type { Artifact } from '../types'

export async function createArtifact(data: {
  conversation_id: string
  message_id?: string
  title?: string
  content?: string
  file_path?: string
  file_hash?: string
  version: number
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.execute(
    `INSERT INTO artifacts (id, conversation_id, message_id, title, content, file_path, file_hash, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      data.conversation_id,
      data.message_id ?? null,
      data.title ?? null,
      data.content ?? '',
      data.file_path ?? null,
      data.file_hash ?? null,
      data.version,
      now,
      now,
    ]
  )
  return id
}

export async function getArtifact(id: string): Promise<Artifact | null> {
  return db.get<Artifact>('artifacts', id)
}

export async function listArtifacts(conversationId: string): Promise<Artifact[]> {
  return db.select<Artifact>(
    'SELECT * FROM artifacts WHERE conversation_id = $1 ORDER BY version ASC',
    [conversationId]
  )
}

export async function updateArtifact(
  id: string,
  data: Partial<Pick<Artifact, 'title' | 'content' | 'file_path' | 'file_hash' | 'message_id'>>
): Promise<void> {
  const fields = Object.keys(data)
  if (fields.length === 0) return
  const now = Date.now()
  const set = [...fields.map((k, i) => `${k} = $${i + 1}`), `updated_at = $${fields.length + 1}`].join(', ')
  await db.execute(
    `UPDATE artifacts SET ${set} WHERE id = $${fields.length + 2}`,
    [...Object.values(data), now, id]
  )
}
