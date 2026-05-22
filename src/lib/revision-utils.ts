/**
 * Pure utility functions for the artifact revision system.
 * All functions are stateless and have no side effects.
 */

import type { ArtifactRevision, Message } from '@/lib/db/types'
import type { ThreadItem } from '@/lib/types'

/**
 * Returns true if the HEAD revision can be edited in-place (copy-on-write is NOT needed).
 * A revision is editable in place only when it is a user draft.
 */
export function canEditInPlace(headRevision: ArtifactRevision): boolean {
  return headRevision.author === 'user' && headRevision.message_id === null
}

/**
 * Returns the most recent sealed revision (messageId !== null), or null if none exist.
 */
export function findLastSealedRevision(
  revisions: ArtifactRevision[]
): ArtifactRevision | null {
  for (let i = revisions.length - 1; i >= 0; i--) {
    if (revisions[i].message_id !== null) return revisions[i]
  }
  return null
}

/**
 * Returns true if the HEAD revision content differs from the last sealed revision's content.
 * If there are no sealed revisions, compares against an empty string.
 */
export function hasContentChangedSinceLastSeal(
  headRevision: ArtifactRevision,
  revisions: ArtifactRevision[]
): boolean {
  const lastSealed = findLastSealedRevision(revisions)
  const baseline = lastSealed?.content ?? ''
  return headRevision.content !== baseline
}

/**
 * Builds the ordered chat thread from messages alone.
 * System messages are internal records and are not shown in the chat thread.
 *
 * @param messages - All messages for the conversation, ordered by sequence_order ASC
 * @returns ThreadItem[] sorted by created_at ASC
 */
export function buildThread(messages: Message[]): ThreadItem[] {
  return [...messages]
    .sort((a, b) => a.created_at - b.created_at)
    .filter((m) => m.role !== 'system')
    .map((m) => ({ type: 'message', data: m }))
}
