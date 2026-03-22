/**
 * Database module - exports the database interface and implementation
 */

export {
  type TableName,
  type DbInterface,
  type Project,
  type Conversation,
  type Message,
  type Artifact,
  type ArtifactRevision,
  type LlmProvider,
  type AppSetting,
  DatabaseError,
} from './types'

export { SqliteDatabase, db } from './sqlite'

// Query builder for type-safe queries
export {
  QueryBuilder,
  type Operator,
  type OrderDirection,
  type FilterCondition,
  type OrderCondition,
} from './query-builder'

// Settings operations (replaces old config.ts)
export {
  SETTING_KEYS,
  type SettingKey,
  getSetting,
  setSetting,
} from './settings'

// Typed repository modules
export * from './repositories'

// Default database configuration
export const DEFAULT_DB_CONFIG = {
  name: 'sqlite:app_data.db',
}
