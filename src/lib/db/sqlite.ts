import Database from '@tauri-apps/plugin-sql'
import type { DbInterface, TableName } from './types'
import { DatabaseError } from './types'
import { QueryBuilder } from './query-builder'

const DB_NAME = 'sqlite:app_data.db'

function generateId(): string {
  return crypto.randomUUID()
}

export class SqliteDatabase implements DbInterface {
  private db: Database | null = null

  private async getDb(): Promise<Database> {
    if (!this.db) {
      this.db = await Database.load(DB_NAME)
    }
    return this.db
  }

  async get<T>(table: TableName, id: string): Promise<T | null> {
    const db = await this.getDb()
    try {
      const rows = await db.select<T[]>(`SELECT * FROM ${table} WHERE id = $1`, [id])
      return rows.length > 0 ? rows[0] : null
    } catch (error) {
      throw new DatabaseError(
        `Failed to get record from ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  async insert<T extends Record<string, unknown>>(
    table: TableName,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<string> {
    const db = await this.getDb()
    const id = generateId()
    const now = Date.now()

    const columns = ['id', ...Object.keys(data), 'created_at', 'updated_at']
    const values = [id, ...Object.values(data), now, now]
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const columnNames = columns.join(', ')

    try {
      await db.execute(
        `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
        values
      )
      return id
    } catch (error) {
      throw new DatabaseError(
        `Failed to insert record into ${table}: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  async upsert<T extends Record<string, unknown>>(
    table: TableName,
    data: Partial<T> & { id: string }
  ): Promise<void> {
    const db = await this.getDb()
    const now = Date.now()

    const { id, ...rest } = data
    const hasTimestamps = Object.keys(rest).length > 0

    try {
      const existing = await this.get(table, id)

      if (existing) {
        const updateFields = Object.keys(rest)
        if (hasTimestamps) {
          updateFields.push('updated_at')
        }

        const setClause = updateFields.map((key, i) => `${key} = $${i + 1}`).join(', ')
        const values = [...Object.values(rest), ...(hasTimestamps ? [now] : [])]

        await db.execute(
          `UPDATE ${table} SET ${setClause} WHERE id = $${values.length + 1}`,
          [...values, id]
        )
      } else {
        const columns = ['id', ...Object.keys(rest), 'created_at', 'updated_at']
        const values = [id, ...Object.values(rest), now, now]
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

        await db.execute(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        )
      }
    } catch (error) {
      throw new DatabaseError(
        `Failed to upsert record in ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  async remove(table: TableName, id: string): Promise<void> {
    const db = await this.getDb()
    try {
      await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id])
    } catch (error) {
      throw new DatabaseError(
        `Failed to remove record from ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  async select<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const db = await this.getDb()
    try {
      return await db.select<T[]>(sql, params)
    } catch (error) {
      throw new DatabaseError(
        `Failed to execute select query: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<void> {
    const db = await this.getDb()
    try {
      await db.execute(sql, params)
    } catch (error) {
      throw new DatabaseError(
        `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error instanceof Error ? error : undefined
      )
    }
  }

  query<T>(table: TableName): QueryBuilder<T> {
    return new QueryBuilder<T>(table)
  }
}

export const db = new SqliteDatabase()

export async function getLocalAppDb(): Promise<Database> {
  return db['getDb']()
}
