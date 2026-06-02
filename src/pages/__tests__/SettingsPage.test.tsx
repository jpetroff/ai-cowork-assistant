// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLlmProviderStore } from '@/components/projects/llmProviderStore'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => path,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
}))

vi.mock('@/lib/db/settings', () => ({
  getSetting: vi.fn(async () =>
    JSON.stringify({ name: 'John', avatarPath: null })
  ),
  setSetting: vi.fn(async () => {}),
}))

vi.mock('@/lib/db/repositories/llm-providers', () => ({
  listLlmProviders: vi.fn(async () => []),
  createLlmProvider: vi.fn(async () => 'provider-1'),
  updateLlmProvider: vi.fn(async () => {}),
  deleteLlmProvider: vi.fn(async () => {}),
  setDefaultProvider: vi.fn(async () => {}),
}))

import { SettingsPage } from '../SettingsPage'

afterEach(cleanup)

beforeEach(() => {
  useLlmProviderStore.setState({
    providers: [],
    modelsByProvider: {},
    status: 'idle',
  })
})

describe('SettingsPage', () => {
  it('renders Personal by default and switches to Providers', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /personal/i })).toBeTruthy()
    expect(screen.getByLabelText(/your name/i)).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /providers/i }))

    expect(screen.getByPlaceholderText('Local Ollama')).toBeTruthy()
    expect(screen.getByRole('button', { name: /new provider/i })).toBeTruthy()
  })
})
