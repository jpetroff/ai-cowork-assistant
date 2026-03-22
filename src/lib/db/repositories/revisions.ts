import { db } from '../sqlite'
import type { ArtifactRevision } from '../types'

/**
 * Insert a new revision and update the artifact's current_revision_id to point to it.
 * @returns The new revision id
 */
export async function createRevision(data: {
  artifact_id: string
  author: 'user' | 'ai'
  content?: string
  message_id?: string
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.execute(
    `INSERT INTO artifact_revisions (id, artifact_id, message_id, author, content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, data.artifact_id, data.message_id ?? null, data.author, data.content ?? '', now, now]
  )
  await db.execute(
    'UPDATE artifacts SET current_revision_id = $1, updated_at = $2 WHERE id = $3',
    [id, now, data.artifact_id]
  )
  return id
}

export async function getRevision(id: string): Promise<ArtifactRevision | null> {
  return db.get<ArtifactRevision>('artifact_revisions', id)
}

/**
 * Return the HEAD revision for an artifact by following current_revision_id.
 * Returns null if the artifact has no revisions yet.
 */
export async function getHeadRevision(artifactId: string): Promise<ArtifactRevision | null> {
  const rows = await db.select<ArtifactRevision>(
    `SELECT r.* FROM artifact_revisions r
     JOIN artifacts a ON a.current_revision_id = r.id
     WHERE a.id = $1`,
    [artifactId]
  )
  return rows[0] ?? null
}

export async function listRevisions(artifactId: string): Promise<ArtifactRevision[]> {
  return db.select<ArtifactRevision>(
    'SELECT * FROM artifact_revisions WHERE artifact_id = $1 ORDER BY created_at DESC',
    [artifactId]
  )
}

/** Update content of a single revision (only valid while it is HEAD). */
export async function updateRevisionContent(id: string, content: string): Promise<void> {
  await db.execute(
    'UPDATE artifact_revisions SET content = $1, updated_at = $2 WHERE id = $3',
    [content, Date.now(), id]
  )
}

/** Seal a revision by linking it to the message that triggered the send. */
export async function sealRevision(id: string, messageId: string): Promise<void> {
  await db.execute(
    'UPDATE artifact_revisions SET message_id = $1 WHERE id = $2',
    [messageId, id]
  )
}
