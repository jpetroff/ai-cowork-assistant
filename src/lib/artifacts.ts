import {
  type ArtifactRecord,
  insert,
  upsert,
  get,
  list,
  getMostRecent,
  getByChat,
  listByChat,
  remove,
} from './tables/artifacts'

export type { ArtifactRecord }

export {
  insert,
  upsert,
  get,
  list,
  getMostRecent,
  getByChat,
  listByChat,
  remove,
}

export async function loadArtifactById(
  id: string
): Promise<ArtifactRecord | null> {
  return get(id)
}

export type UpsertArtifactInput = {
  id: string
  name: string
  file_type: string
  content: string
  chat_id?: string
  message_id?: string
}

export async function upsertArtifact(
  input: UpsertArtifactInput
): Promise<void> {
  await upsert({
    id: input.id,
    name: input.name,
    file_type: input.file_type,
    content: input.content,
    file_path: null,
    chat_id: input.chat_id ?? null,
    message_id: input.message_id ?? null,
  })
}

export async function getMostRecentArtifact(): Promise<ArtifactRecord | null> {
  return getMostRecent()
}

export async function getMostRecentArtifactByChat(
  chatId: string
): Promise<ArtifactRecord | null> {
  return getByChat(chatId)
}
