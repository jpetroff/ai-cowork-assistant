import { describe, it, expect, vi } from 'vitest'
import { mockDb, mockDatabaseInstance } from './setup'
import { SqliteDatabase, DatabaseError } from '../index'

// Each test gets a fresh SqliteDatabase instance so the lazy db cache is clean
function makeDb() {
  return new SqliteDatabase()
}

describe('SqliteDatabase', () => {
  describe('get()', () => {
    it('returns null when plugin returns empty array', async () => {
      mockDb.queueResult([])
      const result = await makeDb().get('projects', 'missing-id')
      expect(result).toBeNull()
    })

    it('returns the row when plugin returns one result', async () => {
      const row = { id: 'p1', name: 'Test', folder_path: '/test', created_at: 1, updated_at: 1 }
      mockDb.queueResult([row])
      const result = await makeDb().get('projects', 'p1')
      expect(result).toEqual(row)
    })

    it('wraps plugin errors in DatabaseError', async () => {
      mockDatabaseInstance.select.mockRejectedValueOnce(new Error('disk I/O error'))
      await expect(makeDb().get('projects', 'x')).rejects.toBeInstanceOf(DatabaseError)
    })
  })

  describe('insert()', () => {
    it('executes INSERT with id, created_at, updated_at and returns a UUID string', async () => {
      const db = makeDb()
      const id = await db.insert('projects', { name: 'P', folder_path: '/p' })

      const { sql, params } = mockDb.rows[0]
      expect(sql).toContain('INSERT INTO projects')
      expect(sql).toContain('id')
      expect(sql).toContain('created_at')
      expect(sql).toContain('updated_at')
      expect(typeof id).toBe('string')
      expect(id).toMatch(/^[0-9a-f-]{36}$/)
      expect(params[0]).toBe(id)
    })

    it('wraps plugin errors in DatabaseError', async () => {
      mockDatabaseInstance.execute.mockRejectedValueOnce(new Error('constraint violation'))
      await expect(makeDb().insert('projects', { name: 'X', folder_path: '/x' })).rejects.toBeInstanceOf(DatabaseError)
    })
  })

  describe('upsert()', () => {
    it('executes UPDATE when record already exists', async () => {
      const existing = { id: 'p1', name: 'Old', folder_path: '/old', created_at: 1, updated_at: 1 }
      mockDb.queueResult([existing]) // get() returns existing row
      await makeDb().upsert('projects', { id: 'p1', name: 'New' })

      const updateCall = mockDb.rows.find(r => r.sql.includes('UPDATE'))
      expect(updateCall).toBeDefined()
      expect(updateCall!.sql).toContain('UPDATE projects SET')
    })

    it('executes INSERT when record does not exist', async () => {
      mockDb.queueResult([]) // get() returns nothing
      await makeDb().upsert('projects', { id: 'p2', name: 'New', folder_path: '/new' })

      const insertCall = mockDb.rows.find(r => r.sql.includes('INSERT'))
      expect(insertCall).toBeDefined()
      expect(insertCall!.sql).toContain('INSERT INTO projects')
    })
  })

  describe('remove()', () => {
    it('executes DELETE with correct table and id', async () => {
      await makeDb().remove('projects', 'p1')
      const { sql, params } = mockDb.rows[0]
      expect(sql).toBe('DELETE FROM projects WHERE id = $1')
      expect(params).toEqual(['p1'])
    })

    it('wraps plugin errors in DatabaseError', async () => {
      mockDatabaseInstance.execute.mockRejectedValueOnce(new Error('locked'))
      await expect(makeDb().remove('projects', 'x')).rejects.toBeInstanceOf(DatabaseError)
    })
  })
})
