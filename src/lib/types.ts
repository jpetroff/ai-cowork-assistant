/**
 * Application-level types for the artifact revision system.
 * DB entity types (Artifact, ArtifactRevision, Message, etc.) live in src/lib/db/types.ts.
 */

import type { Message, ArtifactRevision } from '@/lib/db/types'

/** Payload for `artifactStore.save()` — carries the revision ID that was active when editing began. */
export interface SaveRequest {
  revisionId: string
  content: string
}

/** Signal set on the store when the editor must swap its content. Processed by EditorPanel in useLayoutEffect. */
export interface ContentSwapRequest {
  revisionId: string
  content: string
}

/** Returned by `artifactStore.sealForSend()` — identifies the revision to attach to the outgoing message. */
export interface SealResult {
  artifactId: string
  revisionId: string
  content: string
}

/** A single item in the merged chat thread: either a regular message or a sealed artifact revision card. */
export type ThreadItem =
  | { type: 'message'; data: Message }
  | { type: 'revision'; data: ArtifactRevision }
