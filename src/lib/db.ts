import Database from '@tauri-apps/plugin-sql'

const DB_NAME = 'sqlite:cowork.db'

export const CONFIG_KEYS = {
  USER_NAME: 'user_name',
  USER_AVATAR: 'user_avatar',
  MODEL_NAME: 'model_name',
  MODEL_API_URL: 'model_api_url',
} as const

let dbInstance: Database | null = null

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME)
  }
  return dbInstance
}

export type Configuration = Record<string, string>

export async function loadConfiguration(): Promise<Configuration> {
  const db = await getDb()
  const rows = await db.select<{ key: string; value: string }[]>(
    'SELECT key, value FROM configuration'
  )
  const config: Configuration = {}
  for (const row of rows) {
    config[row.key] = row.value ?? ''
  }
  return config
}

export async function saveConfigurationEntry(
  key: string,
  value: string
): Promise<void> {
  const db = await getDb()
  await db.execute(
    'INSERT INTO configuration (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value]
  )
}

export async function saveConfiguration(config: Configuration): Promise<void> {
  const db = await getDb()
  for (const [key, value] of Object.entries(config)) {
    await db.execute(
      'INSERT INTO configuration (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
      [key, value]
    )
  }
}
