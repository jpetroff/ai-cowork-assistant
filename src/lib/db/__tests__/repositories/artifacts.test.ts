import { describe, it, expect } from 'vitest'
import { mockDb } from '../setup'
import { createArtifact, updateArtifact } from '../../repositories/artifacts'

describe('createArtifact()', () => {
  it('with minimal args inserts null for optional fields', async () => {
    await createArtifact({ conversation_id: 'c1', version: 1 })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('INSERT INTO artifacts')
    // message_id, title, file_path, file_hash should all be null
    const nullCount = params.filter(p => p === null).length
    expect(nullCount).toBeGreaterThanOrEqual(4)
  })

  it('returns a UUID', async () => {
    const id = await createArtifact({ conversation_id: 'c1', version: 1 })
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('updateArtifact()', () => {
  it('builds SET clause for only provided fields', async () => {
    await updateArtifact('a1', { content: '# Updated', title: 'New Title' })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('content =')
    expect(sql).toContain('title =')
    expect(sql).toContain('updated_at =')
    expect(params).toContain('# Updated')
    expect(params).toContain('New Title')
    expect(params).toContain('a1')
  })

  it('does nothing when no fields provided', async () => {
    await updateArtifact('a1', {})
    expect(mockDb.rows).toHaveLength(0)
  })
})
