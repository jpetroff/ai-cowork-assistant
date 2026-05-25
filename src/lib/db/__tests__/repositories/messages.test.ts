import { describe, it, expect } from 'vitest'
import { mockDb, mockDatabaseInstance } from '../setup'
import { createMessage, listMessages } from '../../repositories/messages'

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

  it('serializes optional metadata', async () => {
    const metadata = { generation: { startedAt: 1000, steps: [] } }

    await createMessage({
      conversation_id: 'c1',
      role: 'assistant',
      content: 'Reply',
      metadata,
      sequence_order: 1,
    })

    const { params } = mockDb.rows[0]
    expect(params).toContain(JSON.stringify(metadata))
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
