import { db } from '../sqlite'
import type { LlmProvider } from '../types'

export type LlmProviderInput = {
  name: string
  provider_type: string
  base_url: string
  api_key?: string
  default_model?: string | null
  config_json?: string | null
  is_default?: number
}

export type LlmProviderUpdate = Partial<
  Pick<
    LlmProvider,
    | 'name'
    | 'provider_type'
    | 'base_url'
    | 'api_key'
    | 'default_model'
    | 'config_json'
  >
>

export async function createLlmProvider(
  data: LlmProviderInput
): Promise<string> {
  // LlmProvider has no updated_at column — insert manually
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.execute(
    `INSERT INTO llm_providers (id, name, provider_type, base_url, api_key, default_model, config_json, is_default, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      data.name,
      data.provider_type,
      data.base_url,
      data.api_key ?? null,
      data.default_model ?? null,
      data.config_json ?? null,
      data.is_default ?? 0,
      now,
    ]
  )
  return id
}

export async function getLlmProvider(id: string): Promise<LlmProvider | null> {
  return db.get<LlmProvider>('llm_providers', id)
}

export async function listLlmProviders(): Promise<LlmProvider[]> {
  return db.select<LlmProvider>(
    'SELECT * FROM llm_providers ORDER BY created_at ASC'
  )
}

export async function updateLlmProvider(
  id: string,
  data: LlmProviderUpdate
): Promise<void> {
  const fields = Object.keys(data)
  if (fields.length === 0) return
  const set = fields.map((k, i) => `${k} = $${i + 1}`).join(', ')
  await db.execute(
    `UPDATE llm_providers SET ${set} WHERE id = $${fields.length + 1}`,
    [...Object.values(data), id]
  )
}

export async function deleteLlmProvider(id: string): Promise<void> {
  return db.remove('llm_providers', id)
}

export async function setDefaultProvider(id: string): Promise<void> {
  await db.execute('UPDATE llm_providers SET is_default = 0')
  await db.execute('UPDATE llm_providers SET is_default = 1 WHERE id = $1', [
    id,
  ])
}
