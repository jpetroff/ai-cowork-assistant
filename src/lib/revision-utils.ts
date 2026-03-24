/**
 * Pure utility functions for the artifact revision system.
 * All functions are stateless and have no side effects.
 */

import type { ArtifactRevision, Message } from '@/lib/db/types'
import type { ThreadItem } from '@/lib/types'

/**
 * Returns true if the HEAD revision can be edited in-place (copy-on-write is NOT needed).
 * A revision is editable in place when it is a user draft (messageId === null).
 */
export function canEditInPlace(headRevision: ArtifactRevision): boolean {
  return headRevision.message_id === null
}

/**
 * Returns the most recent sealed revision (messageId !== null), or null if none exist.
 */
export function findLastSealedRevision(revisions: ArtifactRevision[]): ArtifactRevision | null {
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
 * Merges messages and sealed artifact revisions into a single chronologically ordered thread.
 * Draft revisions (messageId === null) are excluded from the output.
 *
 * @param messages - All messages for the conversation, ordered by created_at ASC
 * @param revisions - All revisions for the active artifact, ordered by created_at ASC
 * @returns Interleaved ThreadItem[] sorted by created_at ASC
 */
export function buildThread(messages: Message[], revisions: ArtifactRevision[]): ThreadItem[] {
  const items: ThreadItem[] = []

  for (const message of messages) {
    items.push({ type: 'message', data: message })
  }

  for (const revision of revisions) {
    // Draft revisions (messageId === null) are not shown in the thread
    if (revision.message_id !== null) {
      items.push({ type: 'revision', data: revision })
    }
  }

  // Sort by created_at ascending
  items.sort((a, b) => a.data.created_at - b.data.created_at)

  return items
}
