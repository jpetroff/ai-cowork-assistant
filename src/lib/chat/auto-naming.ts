import type { ChatMessage } from './types'

/**
 * Generates a name for a chat based on its messages.
 * This is currently a stub that returns a static name.
 * In the future, it will call an LLM to generate a contextual name.
 *
 * @param messages - The chat messages to analyze
 * @returns A generated name for the chat
 */
export async function generateChatName(
  messages: ChatMessage[]
): Promise<string> {
  // TODO: Implement LLM-based naming
  // For now, return a static stub response
  return 'New Conversation'
}
