import { DatabaseError } from './types'
import { db } from './sqlite'

export const SETTING_KEYS = {
  THEME: 'theme',
  APPROVAL_MODE: 'approval_mode',
  EDITOR_AUTOSAVE_INTERVAL_MS: 'editor_autosave_interval_ms',
} as const

export type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS]

/**
 * Get a single app setting by key
 * @returns The stored value string, or null if not set
 * @throws DatabaseError on query failure
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = await db.select<{ key: string; value: string }>(
      'SELECT value FROM app_settings WHERE key = $1',
      [key]
    )
    return rows.length > 0 ? rows[0].value : null
  } catch (error) {
    throw new DatabaseError(
      `Failed to get setting "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    )
  }
}

/**
 * Set an app setting value (insert or update)
 * @throws DatabaseError on operation failure
 */
export async function setSetting(key: string, value: string): Promise<void> {
  try {
    await db.execute(
      'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
      [key, value]
    )
  } catch (error) {
    throw new DatabaseError(
      `Failed to set setting "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      error instanceof Error ? error : undefined
    )
  }
}
