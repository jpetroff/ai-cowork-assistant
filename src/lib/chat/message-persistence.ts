import type { Message } from '../../generated/prisma/client'
import * as messagesDb from '../messages'
import type { ChatMessage } from './types'

export async function saveMessage(
  message: ChatMessage,
  chatId: string
): Promise<void> {
  const input: messagesDb.MessageInput = {
    chat_id: chatId,
    role: message.role,
    content: message.content,
  }
  await messagesDb.insert(input)
}

export async function loadChatMessages(chatId: string): Promise<ChatMessage[]> {
  const dbMessages = await messagesDb.getByChat(chatId)
  return dbMessages.map(dbToChatMessage)
}

function dbToChatMessage(msg: Message): ChatMessage {
  return {
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    createdAt: msg.created_at,
    status: 'complete',
  }
}
