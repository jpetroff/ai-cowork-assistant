import { db } from '../sqlite'
import type { Conversation } from '../types'

export async function createConversation(data: {
  project_id: string
  title?: string
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.execute(
    'INSERT INTO conversations (id, project_id, title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [id, data.project_id, data.title ?? null, now, now]
  )
  return id
}

export async function getConversation(id: string): Promise<Conversation | null> {
  return db.get<Conversation>('conversations', id)
}

export async function listConversations(projectId: string): Promise<Conversation[]> {
  return db.select<Conversation>(
    'SELECT * FROM conversations WHERE project_id = $1 ORDER BY updated_at DESC',
    [projectId]
  )
}

export async function updateConversation(
  id: string,
  data: Partial<Pick<Conversation, 'title'>>
): Promise<void> {
  const fields = Object.keys(data)
  if (fields.length === 0) return
  const now = Date.now()
  const set = [...fields.map((k, i) => `${k} = $${i + 1}`), `updated_at = $${fields.length + 1}`].join(', ')
  await db.execute(
    `UPDATE conversations SET ${set} WHERE id = $${fields.length + 2}`,
    [...Object.values(data), now, id]
  )
}

export async function deleteConversation(id: string): Promise<void> {
  return db.remove('conversations', id)
}
