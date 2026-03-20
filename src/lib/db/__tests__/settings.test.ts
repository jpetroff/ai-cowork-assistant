import { describe, it, expect } from 'vitest'
import { mockDb } from './setup'
import { getSetting, setSetting } from '../settings'

describe('getSetting()', () => {
  it('returns null when key is absent', async () => {
    mockDb.queueResult([])
    const result = await getSetting('theme')
    expect(result).toBeNull()
  })

  it('returns the stored value when key exists', async () => {
    mockDb.queueResult([{ key: 'theme', value: 'dark' }])
    const result = await getSetting('theme')
    expect(result).toBe('dark')
  })
})

describe('setSetting()', () => {
  it('executes INSERT ON CONFLICT upsert SQL', async () => {
    await setSetting('theme', 'dark')
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('ON CONFLICT(key) DO UPDATE SET value')
    expect(params).toEqual(['theme', 'dark'])
  })
})
