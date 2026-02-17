import Database from '@tauri-apps/plugin-sql'
import { QueryBuilder } from './query'

const DB_NAME = 'sqlite:cowork.db'
const USER_DATA_DB_NAME = 'sqlite:user_data.db'

let dbInstance: Database | null = null
let userDataDbInstance: Database | null = null

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME)
  }
  return dbInstance
}

export async function getUserDataDb(): Promise<Database> {
  if (!userDataDbInstance) {
    userDataDbInstance = await Database.load(USER_DATA_DB_NAME)
  }
  return userDataDbInstance
}

export type Configuration = Record<string, string>

export const CONFIG_KEYS = {
  USER_NAME: 'user_name',
  USER_AVATAR: 'user_avatar',
  MODEL_NAME: 'model_name',
  MODEL_API_URL: 'model_api_url',
} as const

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

export class DB {
  async insert<T extends Record<string, unknown>>(
    table: string,
    data: T
  ): Promise<string> {
    const db = table === 'artifacts' ? await getUserDataDb() : await getDb()
    const id = this.generateId()

    const columns = ['id', ...Object.keys(data)] as const
    const values = [id, ...Object.values(data)]

    const placeholders = columns.map(() => '?').join(', ')
    const columnNames = columns.join(', ')

    await db.execute(
      `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
      values
    )

    return id
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    const db = table === 'artifacts' ? await getUserDataDb() : await getDb()
    const rows = await db.select<T[]>(`SELECT * FROM ${table} WHERE id = $1`, [
      id,
    ])
    return rows.length > 0 ? rows[0] : null
  }

  async patch<T extends Record<string, unknown>>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    const db = table === 'artifacts' ? await getUserDataDb() : await getDb()
    const now = Date.now()
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ')

    const values = [...Object.values(data), id, now]

    await db.execute(
      `UPDATE ${table} SET ${setClause}, updated_at = ? WHERE id = ?`,
      values
    )
  }

  async replace<T extends Record<string, unknown>>(
    table: string,
    id: string,
    data: T
  ): Promise<void> {
    const db = table === 'artifacts' ? await getUserDataDb() : await getDb()

    const existing = await this.get<T>(table, id)
    if (!existing) {
      throw new Error(`Document ${id} not found in table ${table}`)
    }

    const allData = { ...data, id }
    const columns = Object.keys(allData)
    const placeholders = columns.map(() => '?').join(', ')
    const columnNames = columns.join(', ')

    await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id])

    const insertValues = columns.map(
      (key) => allData[key as keyof typeof allData]
    )
    await db.execute(
      `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
      insertValues
    )
  }

  async delete(table: string, id: string): Promise<void> {
    const db = table === 'artifacts' ? await getUserDataDb() : await getDb()
    await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id])
  }

  query<T>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table)
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }
}

export const db = new DB()
