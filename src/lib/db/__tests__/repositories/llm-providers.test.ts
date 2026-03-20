import { describe, it, expect } from 'vitest'
import { mockDb } from '../setup'
import { createLlmProvider, setDefaultProvider } from '../../repositories/llm-providers'

describe('createLlmProvider()', () => {
  it('executes INSERT and returns a UUID', async () => {
    const id = await createLlmProvider({
      name: 'Anthropic',
      provider_type: 'anthropic',
      base_url: 'https://api.anthropic.com',
    })
    const { sql, params } = mockDb.rows[0]
    expect(sql).toContain('INSERT INTO llm_providers')
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(params).toContain('Anthropic')
  })

  it('defaults is_default to 0 and api_key to null', async () => {
    await createLlmProvider({
      name: 'OpenAI',
      provider_type: 'openai',
      base_url: 'https://api.openai.com',
    })
    const { params } = mockDb.rows[0]
    expect(params).toContain(null)  // api_key
    expect(params).toContain(0)     // is_default
  })
})

describe('setDefaultProvider()', () => {
  it('executes two statements: clear all, then set one', async () => {
    await setDefaultProvider('provider-1')
    expect(mockDb.rows).toHaveLength(2)
    const [clear, set] = mockDb.rows
    expect(clear.sql).toContain('UPDATE llm_providers SET is_default = 0')
    expect(set.sql).toContain('UPDATE llm_providers SET is_default = 1 WHERE id =')
    expect(set.params).toContain('provider-1')
  })
})
