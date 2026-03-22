import { describe, it, expect } from 'vitest'
import { mockDb, mockDatabaseInstance } from '../setup'
import { createArtifact, updateArtifact, listArtifactsByProject } from '../../repositories/artifacts'

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

describe('listArtifactsByProject()', () => {
  it('SQL joins artifacts through conversations on project_id', async () => {
    mockDb.queueResult([])
    await listArtifactsByProject('proj-1')
    const [sql, params] = mockDatabaseInstance.select.mock.calls[0]
    expect(sql).toContain('JOIN conversations')
    expect(sql).toContain('project_id = $1')
    expect(params).toEqual(['proj-1'])
  })

  it('orders results by artifacts.updated_at DESC', async () => {
    mockDb.queueResult([])
    await listArtifactsByProject('proj-1')
    const [sql] = mockDatabaseInstance.select.mock.calls[0]
    expect(sql).toContain('ORDER BY a.updated_at DESC')
  })

  it('appends LIMIT clause when limit is provided', async () => {
    mockDb.queueResult([])
    await listArtifactsByProject('proj-1', 3)
    const [sql] = mockDatabaseInstance.select.mock.calls[0]
    expect(sql).toContain('LIMIT 3')
  })

  it('does not include LIMIT clause when limit is omitted', async () => {
    mockDb.queueResult([])
    await listArtifactsByProject('proj-1')
    const [sql] = mockDatabaseInstance.select.mock.calls[0]
    expect(sql).not.toContain('LIMIT')
  })

  it('returns whatever the DB returns', async () => {
    const fakeArtifacts = [{ id: 'a1', title: 'Doc 1' }]
    mockDb.queueResult(fakeArtifacts)
    const result = await listArtifactsByProject('proj-1')
    expect(result).toEqual(fakeArtifacts)
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
