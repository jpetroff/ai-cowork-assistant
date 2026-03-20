import { describe, it, expect } from 'vitest'
import { mockDb, mockDatabaseInstance } from '../setup'
import { createConversation, listConversations, updateConversation } from '../../repositories/conversations'

describe('createConversation()', () => {
  it('inserts with provided project_id', async () => {
    const id = await createConversation({ project_id: 'proj-1', title: 'Chat 1' })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('INSERT INTO conversations')
    expect(params).toContain('proj-1')
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('uses null for missing title', async () => {
    await createConversation({ project_id: 'proj-1' })
    const { params } = mockDb.rows[0]
    expect(params).toContain(null)
  })
})

describe('listConversations()', () => {
  it('SQL filters WHERE project_id = $1', async () => {
    mockDb.queueResult([])
    await listConversations('proj-1')
    const [sql, params] = mockDatabaseInstance.select.mock.calls[0]
    expect(sql).toContain('WHERE project_id = $1')
    expect(params).toEqual(['proj-1'])
  })
})

describe('updateConversation()', () => {
  it('sets title and updated_at', async () => {
    await updateConversation('c1', { title: 'New Title' })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('title = $1')
    expect(sql).toContain('updated_at =')
    expect(params).toContain('New Title')
    expect(params).toContain('c1')
  })
})
