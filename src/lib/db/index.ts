/**
 * Database module - exports the database interface and implementation
 */

import type { DbConfig } from './types'

export {
  type TableName,
  type DbInterface,
  DatabaseError,
} from './types'

// Re-export the SQLite implementation as the default
export { createSqliteDb, getLocalAppDb } from './sqlite'

// Query builder for type-safe queries
export {
  QueryBuilder,
  type Operator,
  type OrderDirection,
  type FilterCondition,
  type OrderCondition,
} from './query-builder'

// Configuration operations
export {
  type Configuration,
  CONFIG_KEYS,
  loadConfiguration,
  saveConfigurationEntry,
  saveConfiguration,
} from './config'

// Default database configuration
export const DEFAULT_DB_CONFIG: DbConfig = {
  name: 'sqlite:app_data.db',
}
