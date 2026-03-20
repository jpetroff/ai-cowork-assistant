import type { Artifact } from './db/types'
import {
  createArtifact,
  getArtifact,
  listArtifacts,
  updateArtifact,
} from './db/repositories/artifacts'
import { db } from './db'

export type { Artifact }

export { createArtifact, getArtifact, listArtifacts, updateArtifact }

/**
 * Get an artifact by ID
 */
export async function get(id: string): Promise<Artifact | null> {
  return getArtifact(id)
}

/**
 * List all artifacts for a conversation
 */
export async function listByConversation(conversationId: string): Promise<Artifact[]> {
  return listArtifacts(conversationId)
}

/**
 * Get the most recent artifact for a conversation
 */
export async function getMostRecentByConversation(
  conversationId: string
): Promise<Artifact | null> {
  const rows = await db.select<Artifact>(
    'SELECT * FROM artifacts WHERE conversation_id = $1 ORDER BY version DESC LIMIT 1',
    [conversationId]
  )
  return rows.length > 0 ? rows[0] : null
}

/**
 * Delete an artifact by ID
 */
export async function remove(id: string): Promise<void> {
  return db.remove('artifacts', id)
}
