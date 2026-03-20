import { db } from '../sqlite'
import type { Message } from '../types'

export async function createMessage(data: {
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  sequence_order: number
}): Promise<string> {
  // Messages have no updated_at column — insert manually to exclude it
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.execute(
    `INSERT INTO messages (id, conversation_id, role, content, sequence_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, data.conversation_id, data.role, data.content, data.sequence_order, now]
  )
  return id
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  return db.select<Message>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY sequence_order ASC',
    [conversationId]
  )
}
