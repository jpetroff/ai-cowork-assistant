import { describe, it, expect } from 'vitest'
import { mockDb, mockDatabaseInstance } from '../setup'
import { createProject, listProjects, updateProject } from '../../repositories/projects'

describe('createProject()', () => {
  it('executes INSERT into projects and returns a UUID', async () => {
    const id = await createProject({ name: 'My Project', folder_path: '/my/project' })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('INSERT INTO projects')
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(params).toContain('My Project')
    expect(params).toContain('/my/project')
  })
})

describe('listProjects()', () => {
  it('SQL contains ORDER BY updated_at DESC', async () => {
    mockDb.queueResult([])
    await listProjects()
    const [sql] = mockDatabaseInstance.select.mock.calls[0]
    expect(sql).toContain('ORDER BY updated_at DESC')
  })
})

describe('updateProject()', () => {
  it('sets only requested fields and updated_at', async () => {
    await updateProject('p1', { name: 'Renamed' })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('name = $1')
    expect(sql).toContain('updated_at =')
    expect(sql).not.toContain('folder_path')
    expect(params).toContain('Renamed')
    expect(params).toContain('p1')
  })

  it('does nothing when no fields provided', async () => {
    await updateProject('p1', {})
    expect(mockDb.rows).toHaveLength(0)
  })
})
