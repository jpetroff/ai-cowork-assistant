import Database from '@tauri-apps/plugin-sql'
import { DatabaseError } from './types'

const DB_NAME = 'sqlite:app_data.db'

let dbInstance: Database | null = null

async function getLocalAppDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME)
  }
  return dbInstance
}

export type Configuration = Record<string, string>

export const CONFIG_KEYS = {
  USER_NAME: 'user_name',
  USER_AVATAR: 'user_avatar',
  MODEL_NAME: 'model_name',
  MODEL_API_URL: 'model_api_url',
  FULL_REMOTE: 'full_remote',
} as const

/**
 * Load all configuration entries
 * @throws DatabaseError on query failure
 */
export async function loadConfiguration(): Promise<Configuration> {
  const db = await getLocalAppDb()
  try {
    const rows = await db.select<{ key: string; value: string }[]>(
      'SELECT key, value FROM configuration'
    )
    const config: Configuration = {}
    for (const row of rows) {
      config[row.key] = row.value ?? ''
    }
    return config
  } catch (error) {
    throw new DatabaseError(
      `Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Save a single configuration entry
 * @throws DatabaseError on insert/update failure
 */
export async function saveConfigurationEntry(
  key: string,
  value: string
): Promise<void> {
  const db = await getLocalAppDb()
  try {
    await db.execute(
      'INSERT INTO configuration (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
      [key, value]
    )
  } catch (error) {
    throw new DatabaseError(
      `Failed to save configuration entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Save multiple configuration entries
 * @throws DatabaseError on insert/update failure
 */
export async function saveConfiguration(config: Configuration): Promise<void> {
  const db = await getLocalAppDb()
  try {
    for (const [key, value] of Object.entries(config)) {
      await db.execute(
        'INSERT INTO configuration (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
        [key, value]
      )
    }
  } catch (error) {
    throw new DatabaseError(
      `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    )
  }
}
