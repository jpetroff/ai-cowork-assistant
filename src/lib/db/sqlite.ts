import Database from '@tauri-apps/plugin-sql'
import type { DbConfig, DbInterface, TableName } from './types'
import { DatabaseError } from './types'
import { QueryBuilder } from './query-builder'

const DB_NAME = 'sqlite:app_data.db'

let dbInstance: Database | null = null

export async function getLocalAppDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load(DB_NAME)
  }
  return dbInstance
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

export function createSqliteDb(): DbInterface {
  return {
    async get<T>(table: TableName, id: string): Promise<T | null> {
      const db = await getLocalAppDb()
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
    },

    async insert<T extends Record<string, unknown>>(
      table: TableName,
      data: Omit<T, 'id' | 'created_at' | 'updated_at'>
    ): Promise<string> {
      const db = await getLocalAppDb()
      const id = generateId()
      const now = Date.now()

      const columns = ['id', ...Object.keys(data), 'created_at', 'updated_at']
      const values = [id, ...Object.values(data), now, now]
      const placeholders = columns.map(() => '?').join(', ')
      const columnNames = columns.join(', ')

      try {
        await db.execute(
          `INSERT INTO ${table} (${columnNames}) VALUES (${placeholders})`,
          values
        )
        return id
      } catch (error) {
        throw new DatabaseError(
          `Failed to insert record into ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error instanceof Error ? error : undefined
        )
      }
    },

    async upsert<T extends Record<string, unknown>>(
      table: TableName,
      data: Partial<T> & { id: string }
    ): Promise<void> {
      const db = await getLocalAppDb()
      const now = Date.now()

      const { id, ...rest } = data
      const hasTimestamps = Object.keys(rest).length > 0

      try {
        // Check if record exists
        const existing = await this.get(table, id)

        if (existing) {
          // Update
          const updateFields = Object.keys(rest)
          if (hasTimestamps) {
            updateFields.push('updated_at')
          }

          const setClause = updateFields.map((key) => `${key} = ?`).join(', ')
          const values = [...Object.values(rest), ...(hasTimestamps ? [now] : [])]

          await db.execute(
            `UPDATE ${table} SET ${setClause} WHERE id = $${values.length + 1}`,
            [...values, id]
          )
        } else {
          // Insert with timestamps
          const columns = ['id', ...Object.keys(rest), 'created_at', 'updated_at']
          const values = [id, ...Object.values(rest), now, now]
          const placeholders = columns.map(() => '?').join(', ')

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
    },

    async remove(table: TableName, id: string): Promise<void> {
      const db = await getLocalAppDb()
      try {
        await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id])
      } catch (error) {
        throw new DatabaseError(
          `Failed to remove record from ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error instanceof Error ? error : undefined
        )
      }
    },

    async select<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const db = await getLocalAppDb()
      try {
        return await db.select<T[]>(sql, params)
      } catch (error) {
        throw new DatabaseError(
          `Failed to execute select query: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error instanceof Error ? error : undefined
        )
      }
    },

    async execute(sql: string, params?: unknown[]): Promise<void> {
      const db = await getLocalAppDb()
      try {
        await db.execute(sql, params)
      } catch (error) {
        throw new DatabaseError(
          `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error instanceof Error ? error : undefined
        )
      }
    },

    query<T>(table: TableName): QueryBuilder<T> {
      return new QueryBuilder<T>(table)
    },
  }
}
