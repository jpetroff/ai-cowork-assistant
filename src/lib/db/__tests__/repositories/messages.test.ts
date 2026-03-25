import { describe, it, expect } from 'vitest'
import { mockDb, mockDatabaseInstance } from '../setup'
import { createMessage, createSystemRevisionMessage, listMessages } from '../../repositories/messages'

describe('createMessage()', () => {
  it('INSERT does not include updated_at column', async () => {
    await createMessage({
      conversation_id: 'c1',
      role: 'user',
      content: 'Hello',
      sequence_order: 0,
    })
    const { sql } = mockDb.rows[0]
    expect(sql).toContain('INSERT INTO messages')
    expect(sql).not.toContain('updated_at')
  })

  it('includes all required columns', async () => {
    await createMessage({
      conversation_id: 'c1',
      role: 'assistant',
      content: 'Reply',
      sequence_order: 1,
    })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('conversation_id')
    expect(sql).toContain('role')
    expect(sql).toContain('content')
    expect(sql).toContain('sequence_order')
    expect(params).toContain('c1')
    expect(params).toContain('assistant')
    expect(params).toContain('Reply')
    expect(params).toContain(1)
  })
})

describe('listMessages()', () => {
  it('orders by sequence_order ASC', async () => {
    mockDb.queueResult([])
    await listMessages('c1')
    const [sql, params] = mockDatabaseInstance.select.mock.calls[0]
    expect(sql).toContain('ORDER BY sequence_order ASC')
    expect(params).toEqual(['c1'])
  })
})

describe('createSystemRevisionMessage()', () => {
  it('inserts with role=system, correct content, and serialized metadata', async () => {
    await createSystemRevisionMessage({
      conversation_id: 'c1',
      author: 'user',
      revisionId: 'rev-abc',
      sequence_order: 3,
    })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain("'system'")
    expect(params).toContain('c1')
    expect(params).toContain('user created artifact revision')
    expect(params).toContain(3)
    const metadataArg = params.find((p) => typeof p === 'string' && p.includes('rev-abc'))
    expect(metadataArg).toBeDefined()
    const parsed = JSON.parse(metadataArg as string)
    expect(parsed).toEqual({ revisionId: 'rev-abc', author: 'user' })
  })

  it('inserts AI system message with author=ai in metadata', async () => {
    await createSystemRevisionMessage({
      conversation_id: 'c2',
      author: 'ai',
      revisionId: 'rev-xyz',
      sequence_order: 5,
    })
    const { params } = mockDb.rows[0]
    expect(params).toContain('ai created artifact revision')
    const metadataArg = params.find((p) => typeof p === 'string' && p.includes('rev-xyz'))
    const parsed = JSON.parse(metadataArg as string)
    expect(parsed.author).toBe('ai')
  })

  it('does not include updated_at column', async () => {
    await createSystemRevisionMessage({
      conversation_id: 'c1',
      author: 'user',
      revisionId: 'rev-1',
      sequence_order: 0,
    })
    expect(mockDb.rows[0].sql).not.toContain('updated_at')
  })
})
