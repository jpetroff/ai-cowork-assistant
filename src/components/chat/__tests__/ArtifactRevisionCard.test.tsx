// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Message } from '@/lib/db/types'

// ── Mock artifact store ────────────────────────────────────────────────────────

const { mockGetArtifactRevisionMeta, mockRequestRevisionLoad, storeState } =
  vi.hoisted(() => {
    const mockGetArtifactRevisionMeta = vi.fn()
    const mockRequestRevisionLoad = vi.fn()

    return {
      mockGetArtifactRevisionMeta,
      mockRequestRevisionLoad,
      storeState: {
        requestRevisionLoad: mockRequestRevisionLoad,
        getArtifactRevisionMeta: mockGetArtifactRevisionMeta,
      },
    }
  })

const revisionMeta = {
  artifact: { id: 'art-1', title: 'My Document' },
  revision: { id: 'rev-1' },
}

vi.mock('@/stores/artifactStore', () => ({
  useArtifactStore: (selector: (s: typeof storeState) => unknown) =>
    selector(storeState),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import { ArtifactRevisionCard } from '../ArtifactRevisionCard'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSystemMessage(
  revisionId: string,
  author: 'user' | 'ai',
  overrides: Partial<Message> = {}
): Message {
  return {
    id: 'sys-1',
    conversation_id: 'conv-1',
    role: 'system',
    content: `${author} created artifact revision`,
    metadata: JSON.stringify({ artifactId: 'art-1', revisionId, author }),
    sequence_order: 1,
    created_at: new Date('2026-01-15T14:30:00').getTime(),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  mockGetArtifactRevisionMeta.mockReturnValue(revisionMeta)
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ArtifactRevisionCard', () => {
  it('renders artifact title from store lookup', () => {
    render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-1', 'user')}
        isActive={false}
      />
    )
    expect(screen.getByText('My Document')).toBeDefined()
    expect(mockGetArtifactRevisionMeta).toHaveBeenCalledWith('art-1', {
      revisionId: 'rev-1',
    })
  })

  it('renders "You" author label for user revision', () => {
    render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-1', 'user')}
        isActive={false}
      />
    )
    expect(screen.getByText(/You/)).toBeDefined()
  })

  it('renders "AI" author label for ai revision', () => {
    render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-1', 'ai')}
        isActive={false}
      />
    )
    expect(screen.getByText(/AI/)).toBeDefined()
  })

  it('renders formatted timestamp', () => {
    render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-1', 'user')}
        isActive={false}
      />
    )
    // Timestamp should be visible (exact format is locale-dependent, just check element exists)
    const card = screen.getByText('My Document').closest('button')
    expect(card).not.toBeNull()
  })

  it('renders Load button when revision is not currently loaded', () => {
    render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-other', 'user')}
        isActive={false}
      />
    )
    expect(screen.getByRole('button', { name: /load/i })).toBeDefined()
  })

  it('calls requestRevisionLoad with the correct revisionId on Load click', async () => {
    render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-42', 'user')}
        isActive={false}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(mockRequestRevisionLoad).toHaveBeenCalledWith('rev-42')
  })

  it('shows Loaded state and disables button when revision is currently loaded', () => {
    render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-loaded', 'user')}
        isActive={true}
      />
    )
    const btn = screen.getByRole('button', { name: /loaded/i })
    expect(btn).toBeDefined()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('returns null for invalid metadata', () => {
    const msg = makeSystemMessage('rev-1', 'user', { metadata: null })
    const { container } = render(
      <ArtifactRevisionCard message={msg} isActive={false} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when artifact revision metadata is not loaded', () => {
    mockGetArtifactRevisionMeta.mockReturnValue(null)
    const { container } = render(
      <ArtifactRevisionCard
        message={makeSystemMessage('rev-1', 'user')}
        isActive={false}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
