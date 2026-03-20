import { describe, it, expect } from 'vitest'
import { mockDb, mockDatabaseInstance } from './setup'
import { QueryBuilder } from '../query-builder'

describe('QueryBuilder', () => {
  describe('filter', () => {
    it('single = filter produces WHERE clause with correct binding', async () => {
      mockDb.queueResult([])
      await new QueryBuilder('messages').filter('role', '=', 'user').all()
      const [sql, params] = mockDatabaseInstance.select.mock.calls[0]
      expect(sql).toContain('WHERE role = ?')
      expect(params).toEqual(['user'])
    })

    it('two filters are joined with AND', async () => {
      mockDb.queueResult([])
      await new QueryBuilder('messages')
        .filter('role', '=', 'user')
        .filter('conversation_id', '=', 'c1')
        .all()
      const [sql] = mockDatabaseInstance.select.mock.calls[0]
      expect(sql).toContain('WHERE role = ? AND conversation_id = ?')
    })

    it('IN operator with array produces correct placeholders and bindings', async () => {
      mockDb.queueResult([])
      await new QueryBuilder('messages').filter('id', 'IN', ['a', 'b', 'c']).all()
      const [sql, params] = mockDatabaseInstance.select.mock.calls[0]
      expect(sql).toContain('id IN (?, ?, ?)')
      expect(params).toEqual(['a', 'b', 'c'])
    })
  })

  describe('orderBy', () => {
    it('produces ORDER BY clause', async () => {
      mockDb.queueResult([])
      await new QueryBuilder('messages').orderBy('created_at', 'desc').all()
      const [sql] = mockDatabaseInstance.select.mock.calls[0]
      expect(sql).toContain('ORDER BY created_at DESC')
    })
  })

  describe('limit and offset', () => {
    it('produces LIMIT and OFFSET clauses', async () => {
      mockDb.queueResult([])
      await new QueryBuilder('messages').limit(10).offset(20).all()
      const [sql] = mockDatabaseInstance.select.mock.calls[0]
      expect(sql).toContain('LIMIT 10')
      expect(sql).toContain('OFFSET 20')
    })
  })

  describe('count()', () => {
    it('generates SELECT COUNT(*) as count', async () => {
      mockDb.queueResult([{ count: 5 }])
      const result = await new QueryBuilder('messages').count()
      const [sql] = mockDatabaseInstance.select.mock.calls[0]
      expect(sql).toMatch(/SELECT COUNT\(\*\) as count FROM/)
      expect(result).toBe(5)
    })
  })

  describe('first()', () => {
    it('applies LIMIT 1 and returns first element', async () => {
      const row = { id: '1', content: 'hello' }
      mockDb.queueResult([row])
      const result = await new QueryBuilder('messages').first()
      const [sql] = mockDatabaseInstance.select.mock.calls[0]
      expect(sql).toContain('LIMIT 1')
      expect(result).toEqual(row)
    })

    it('returns null when no results', async () => {
      mockDb.queueResult([])
      const result = await new QueryBuilder('messages').first()
      expect(result).toBeNull()
    })
  })
})
