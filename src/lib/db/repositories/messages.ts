import { db } from '../sqlite'
import type { Message } from '../types'

export async function createMessage(data: {
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: unknown
  sequence_order: number
}): Promise<string> {
  // Messages have no updated_at column — insert manually to exclude it
  const id = crypto.randomUUID()
  const now = Date.now()
  const metadata = data.metadata == null ? null : JSON.stringify(data.metadata)
  await db.execute(
    `INSERT INTO messages (id, conversation_id, role, content, metadata, sequence_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      data.conversation_id,
      data.role,
      data.content,
      metadata,
      data.sequence_order,
      now,
    ]
  )
  return id
}

export async function getMessage(id: string): Promise<Message | null> {
  return db.get<Message>('messages', id)
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  return db.select<Message>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY sequence_order ASC',
    [conversationId]
  )
}

export async function updateMessageContentAndMetadata(
  id: string,
  content: string,
  metadata?: unknown
): Promise<void> {
  await db.execute(
    'UPDATE messages SET content = $1, metadata = $2 WHERE id = $3',
    [content, metadata == null ? null : JSON.stringify(metadata), id]
  )
}

export async function listMessagesWithStreamStatus(
  status: string
): Promise<Message[]> {
  const messages = await db.select<Message>(
    "SELECT * FROM messages WHERE role = 'assistant' AND metadata IS NOT NULL ORDER BY created_at ASC"
  )

  return messages.filter((message) => {
    try {
      const metadata = JSON.parse(message.metadata ?? '{}') as {
        stream?: { status?: unknown }
      }
      return metadata.stream?.status === status
    } catch {
      return false
    }
  })
}
