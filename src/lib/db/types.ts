/**
 * Database types and shared definitions
 */

export type TableName = 'artifacts' | 'messages' | 'chats' | 'configuration'

export interface DbConfig {
  name: string
}

/**
 * Base interface for database operations
 * All operations throw on error
 */
export interface DbInterface {
  /**
   * Get a single record by ID
   * @returns The record or null if not found
   * @throws DatabaseError on query failure
   */
  get<T>(table: TableName, id: string): Promise<T | null>

  /**
   * Insert a new record with auto-generated id and timestamps
   * @throws DatabaseError on insert failure (e.g., duplicate key)
   */
  insert<T extends Record<string, unknown>>(
    table: TableName,
    data: Omit<T, 'id' | 'created_at' | 'updated_at'>
  ): Promise<string>

  /**
   * Upsert a record (insert or update)
   * Auto-generates id and timestamps if not provided
   * @throws DatabaseError on operation failure
   */
  upsert<T extends Record<string, unknown>>(
    table: TableName,
    data: Partial<T> & { id: string }
  ): Promise<void>

  /**
   * Delete a record by ID
   * @throws DatabaseError on delete failure
   */
  remove(table: TableName, id: string): Promise<void>

  /**
   * Execute raw SQL select query
   * @throws DatabaseError on query failure
   */
  select<T>(sql: string, params?: unknown[]): Promise<T[]>

  /**
   * Execute raw SQL command
   * @throws DatabaseError on execution failure
   */
  execute(sql: string, params?: unknown[]): Promise<void>
}

/**
 * Base database error
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}
