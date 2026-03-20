import type { Message } from '../db/types'
import { createMessage, listMessages } from '../db/repositories/messages'
import type { ChatMessage } from './types'

export async function saveMessage(
  message: ChatMessage,
  conversationId: string,
  sequenceOrder: number
): Promise<void> {
  try {
    await createMessage({
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      sequence_order: sequenceOrder,
    })
  } catch (error) {
    console.error('[message-persistence] Failed to save message:', error)
    // Don't throw - allow chat to continue even if persistence fails
  }
}

export async function loadConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const dbMessages = await listMessages(conversationId)
    return dbMessages.map(dbToChatMessage)
  } catch (error) {
    console.error('[message-persistence] Failed to load messages:', error)
    return []
  }
}

function dbToChatMessage(msg: Message): ChatMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.created_at,
    status: 'complete',
  }
}
