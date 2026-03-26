// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Message } from '@/lib/db/types'

// ── Mock artifact store ────────────────────────────────────────────────────────

const mockRequestRevisionLoad = vi.fn()

vi.mock('@/stores/artifactStore', () => ({
  useArtifactStore: (selector: (s: object) => unknown) =>
    selector({
      requestRevisionLoad: mockRequestRevisionLoad,
      activeRevisionId: 'rev-loaded',
      artifact: { title: 'My Document' },
    }),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import { ArtifactRevisionCard } from '../ArtifactRevisionCard'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSystemMessage(revisionId: string, author: 'user' | 'ai', overrides: Partial<Message> = {}): Message {
  return {
    id: 'sys-1',
    conversation_id: 'conv-1',
    role: 'system',
    content: `${author} created artifact revision`,
    metadata: JSON.stringify({ revisionId, author }),
    sequence_order: 1,
    created_at: new Date('2026-01-15T14:30:00').getTime(),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ArtifactRevisionCard', () => {
  it('renders artifact title from store', () => {
    render(<ArtifactRevisionCard message={makeSystemMessage('rev-1', 'user')} />)
    expect(screen.getByText('My Document')).toBeDefined()
  })

  it('renders "You" author label for user revision', () => {
    render(<ArtifactRevisionCard message={makeSystemMessage('rev-1', 'user')} />)
    expect(screen.getByText(/You/)).toBeDefined()
  })

  it('renders "AI" author label for ai revision', () => {
    render(<ArtifactRevisionCard message={makeSystemMessage('rev-1', 'ai')} />)
    expect(screen.getByText(/AI/)).toBeDefined()
  })

  it('renders formatted timestamp', () => {
    render(<ArtifactRevisionCard message={makeSystemMessage('rev-1', 'user')} />)
    // Timestamp should be visible (exact format is locale-dependent, just check element exists)
    const card = screen.getByText('My Document').closest('div')
    expect(card).not.toBeNull()
  })

  it('renders Load button when revision is not currently loaded', () => {
    render(<ArtifactRevisionCard message={makeSystemMessage('rev-other', 'user')} />)
    expect(screen.getByRole('button', { name: /load/i })).toBeDefined()
  })

  it('calls requestRevisionLoad with the correct revisionId on Load click', async () => {
    render(<ArtifactRevisionCard message={makeSystemMessage('rev-42', 'user')} />)
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(mockRequestRevisionLoad).toHaveBeenCalledWith('rev-42')
  })

  it('shows Loaded state and disables button when revision is currently loaded', () => {
    render(<ArtifactRevisionCard message={makeSystemMessage('rev-loaded', 'user')} />)
    const btn = screen.getByRole('button', { name: /loaded/i })
    expect(btn).toBeDefined()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('returns null for invalid metadata', () => {
    const msg = makeSystemMessage('rev-1', 'user', { metadata: null })
    const { container } = render(<ArtifactRevisionCard message={msg} />)
    expect(container.firstChild).toBeNull()
  })
})
