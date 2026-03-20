import type { QueryBuilder } from './query-builder'

/**
 * Database types and shared definitions
 */

export type TableName =
  | 'projects'
  | 'conversations'
  | 'messages'
  | 'artifacts'
  | 'llm_providers'
  | 'app_settings'

// Entity types matching the SQLite schema in src-tauri/src/db.rs
export interface Project {
  id: string
  name: string
  folder_path: string
  created_at: number
  updated_at: number
}

export interface Conversation {
  id: string
  project_id: string
  title: string | null
  created_at: number
  updated_at: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  sequence_order: number
  created_at: number
}

export interface Artifact {
  id: string
  conversation_id: string
  message_id: string | null
  title: string | null
  content: string
  file_path: string | null
  file_hash: string | null
  version: number
  created_at: number
  updated_at: number
}

export interface LlmProvider {
  id: string
  name: string
  provider_type: string
  base_url: string
  api_key: string | null
  is_default: number
  created_at: number
}

export interface AppSetting {
  key: string
  value: string
}

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

  /**
   * Create a query builder for a table
   * @returns QueryBuilder for chaining filter/order/limit operations
   */
  query<T>(table: TableName): QueryBuilder<T>
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
