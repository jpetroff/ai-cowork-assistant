/**
 * Application-level types for the artifact revision system.
 * DB entity types (Artifact, ArtifactRevision, Message, etc.) live in src/lib/db/types.ts.
 */

import type { Message } from '@/lib/db/types'

/** Returned by `artifactStore.sealForSend()` — identifies the revision to attach to the outgoing message. */
export interface SealResult {
  artifactId: string
  revisionId: string
  content: string
}

/** Parsed metadata on a system message that anchors an artifact revision in the thread. */
export interface RevisionMessageMetadata {
  artifactId?: string
  revisionId: string
  author: 'user' | 'ai'
}

/** A single item in the merged chat thread. */
export type ThreadItem = { type: 'message'; data: Message }
