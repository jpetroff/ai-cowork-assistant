import { vi, beforeEach } from 'vitest'

// In-memory store: table name → array of row objects
export const mockDb = {
  rows: [] as { sql: string; params: unknown[] }[],
  selectResults: [] as unknown[],

  // Queue a result for the next select() call
  queueResult(result: unknown) {
    this.selectResults.push(result)
  },

  reset() {
    this.rows = []
    this.selectResults = []
  },
}

const mockDatabaseInstance = {
  select: vi.fn(async (_sql: string, _params?: unknown[]) => {
    return (mockDb.selectResults.shift() ?? []) as unknown[]
  }),
  execute: vi.fn(async (sql: string, params?: unknown[]) => {
    mockDb.rows.push({ sql, params: params ?? [] })
    return { rowsAffected: 1, lastInsertId: 0 }
  }),
}

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn(async () => mockDatabaseInstance),
  },
}))

// Reset state and mock call history between every test
beforeEach(() => {
  mockDb.reset()
  mockDatabaseInstance.select.mockClear()
  mockDatabaseInstance.execute.mockClear()
  mockDatabaseInstance.select.mockImplementation(async (_sql: string, _params?: unknown[]) => {
    return (mockDb.selectResults.shift() ?? []) as unknown[]
  })
})

export { mockDatabaseInstance }
