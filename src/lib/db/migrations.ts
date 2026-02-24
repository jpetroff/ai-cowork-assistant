import { db } from './index'

/**
 * Run database migrations to ensure schema is up to date
 */
export async function runMigrations(): Promise<void> {
  await migrateMessagesTable()
}

/**
 * Migration: Add updated_at column to messages table if it doesn't exist
 */
async function migrateMessagesTable(): Promise<void> {
  try {
    // Check if updated_at column exists by trying to select it
    await db.select('SELECT updated_at FROM messages LIMIT 1')
    // If we get here, the column exists
  } catch {
    // Column doesn't exist, add it
    try {
      await db.execute('ALTER TABLE messages ADD COLUMN updated_at INTEGER')
      // Update existing rows to set updated_at = created_at
      await db.execute('UPDATE messages SET updated_at = created_at')
      console.log('[migration] Added updated_at column to messages table')
    } catch (error) {
      console.error('[migration] Failed to add updated_at column:', error)
    }
  }
}
