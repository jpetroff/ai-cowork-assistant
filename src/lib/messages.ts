import type { Message } from './db/types'
import { createMessage, listMessages } from './db/repositories/messages'
import { db } from './db'

export type { Message }

export type MessageInput = {
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  sequence_order: number
}

export async function insert(data: MessageInput): Promise<string> {
  return createMessage(data)
}

export async function getByConversation(conversationId: string): Promise<Message[]> {
  return listMessages(conversationId)
}

export async function remove(id: string): Promise<void> {
  return db.remove('messages', id)
}
