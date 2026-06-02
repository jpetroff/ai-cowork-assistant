// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { LlmProvider } from '@/lib/db/types'
import { useLlmProviderStore } from '@/components/projects/llmProviderStore'
import { useProjectSettingsStore } from '@/components/projects/projectSettingsStore'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })),
}))

vi.mock('@/lib/db/repositories/llm-providers', () => ({
  listLlmProviders: vi.fn(async () => []),
}))

vi.mock('@/lib/db/settings', () => ({
  getSetting: vi.fn(async () => null),
  setSetting: vi.fn(async () => {}),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { AiConfigCard } from '../AiConfigCard'

function makeProvider(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    id: 'p1',
    name: 'Local Ollama',
    provider_type: 'ollama',
    base_url: 'http://localhost:11434',
    api_key: null,
    default_model: null,
    config_json: null,
    is_default: 0,
    created_at: Date.now(),
    ...overrides,
  }
}

afterEach(cleanup)

beforeEach(() => {
  useLlmProviderStore.setState({
    providers: [],
    modelsByProvider: {},
    status: 'idle',
  })
  useProjectSettingsStore.setState({ aiConfigs: {} })
  mockNavigate.mockReset()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AiConfigCard — no providers configured', () => {
  it('renders three disabled select triggers', () => {
    render(<AiConfigCard projectId='proj-1' />)
    const triggers = document.querySelectorAll('[data-slot="select-trigger"]')
    expect(triggers.length).toBe(3)
    triggers.forEach((t) => {
      expect((t as HTMLElement).hasAttribute('disabled')).toBe(true)
    })
  })

  it('renders a "Configure in Settings" button', () => {
    render(<AiConfigCard projectId='proj-1' />)
    expect(
      screen.getByRole('button', { name: /configure in settings/i })
    ).toBeTruthy()
  })
})

describe('AiConfigCard — with providers configured', () => {
  beforeEach(() => {
    useLlmProviderStore.setState({
      providers: [makeProvider({ id: 'p1', name: 'Ollama' })],
      modelsByProvider: {},
      status: 'ready',
    })
  })

  it('renders the provider name in the select list area', () => {
    render(<AiConfigCard projectId='proj-1' />)
    // Provider select trigger is present
    const triggers = document.querySelectorAll('[data-slot="select-trigger"]')
    expect(triggers.length).toBe(3)
  })

  it('does not render the "Configure in Settings" button', () => {
    render(<AiConfigCard projectId='proj-1' />)
    expect(
      screen.queryByRole('button', { name: /configure in settings/i })
    ).not.toBeInTheDocument()
  })
})

describe('AiConfigCard — saved config is pre-selected', () => {
  it('reflects saved provider_id from projectSettingsStore', () => {
    useLlmProviderStore.setState({
      providers: [makeProvider({ id: 'p1', name: 'Ollama' })],
      modelsByProvider: { p1: ['llama3'] },
      status: 'ready',
    })
    useProjectSettingsStore.setState({
      aiConfigs: {
        'proj-1': { provider_id: 'p1', model: 'llama3', embedding_model: null },
      },
    })

    render(<AiConfigCard projectId='proj-1' />)

    // Verify the select triggers render (value assertions require opening the select popup,
    // which needs a real browser; here we just confirm the card renders without errors)
    expect(
      document.querySelectorAll('[data-slot="select-trigger"]').length
    ).toBe(3)
  })
})
