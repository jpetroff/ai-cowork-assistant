import { db } from '../sqlite'
import type { Artifact } from '../types'

export async function createArtifact(data: {
  conversation_id: string
  title?: string
  file_path?: string
  file_hash?: string
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.execute(
    `INSERT INTO artifacts (id, conversation_id, title, current_revision_id, file_path, file_hash, created_at, updated_at)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7)`,
    [id, data.conversation_id, data.title ?? null, data.file_path ?? null, data.file_hash ?? null, now, now]
  )
  return id
}

export async function getArtifact(id: string): Promise<Artifact | null> {
  return db.get<Artifact>('artifacts', id)
}

export async function listArtifacts(conversationId: string): Promise<Artifact[]> {
  return db.select<Artifact>(
    'SELECT * FROM artifacts WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  )
}

export async function listArtifactsByProject(projectId: string, limit?: number): Promise<Artifact[]> {
  const sql = limit != null
    ? `SELECT a.* FROM artifacts a JOIN conversations c ON a.conversation_id = c.id WHERE c.project_id = $1 ORDER BY a.updated_at DESC LIMIT ${limit}`
    : 'SELECT a.* FROM artifacts a JOIN conversations c ON a.conversation_id = c.id WHERE c.project_id = $1 ORDER BY a.updated_at DESC'
  return db.select<Artifact>(sql, [projectId])
}

export async function updateArtifact(
  id: string,
  data: Partial<Pick<Artifact, 'title' | 'file_path' | 'file_hash' | 'current_revision_id'>>
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

export async function deleteArtifact(id: string): Promise<void> {
  await db.remove('artifacts', id)
}
