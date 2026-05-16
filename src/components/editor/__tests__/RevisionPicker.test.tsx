// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'

const { storeState } = vi.hoisted(() => ({
  storeState: {
    revisions: [] as ArtifactRevision[],
    artifact: null as Artifact | null,
    loadedRevisionId: null as string | null,
    requestRevisionLoad: vi.fn(),
  },
}))

vi.mock('@/stores/artifactStore', () => ({
  useArtifactStore: (selector: (s: typeof storeState) => unknown) =>
    selector(storeState),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <button type='button'>{children}</button>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode
    onClick: () => void
    className?: string
  }) => (
    <button type='button' className={className} onClick={onClick}>
      {children}
    </button>
  ),
}))

import { RevisionPicker } from '../RevisionPicker'

function makeRevision(
  overrides: Partial<ArtifactRevision> = {}
): ArtifactRevision {
  return {
    id: 'rev-1',
    artifact_id: 'art-1',
    message_id: 'msg-1',
    author: 'user',
    content: 'content',
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  storeState.revisions = []
  storeState.artifact = null
  storeState.loadedRevisionId = null
})

describe('RevisionPicker', () => {
  it('shows the loaded revision while still labeling the head revision current', async () => {
    storeState.artifact = {
      id: 'art-1',
      conversation_id: 'conv-1',
      title: null,
      current_revision_id: 'rev-2',
      file_path: null,
      file_hash: null,
      created_at: 1000,
      updated_at: 1000,
    }
    storeState.revisions = [
      makeRevision({ id: 'rev-1', content: 'old', created_at: 1000 }),
      makeRevision({
        id: 'rev-2',
        content: 'head',
        message_id: 'msg-2',
        created_at: 2000,
      }),
    ]
    storeState.loadedRevisionId = 'rev-1'

    render(<RevisionPicker />)

    expect(screen.getByRole('button', { name: /v1 of 2/i })).toBeDefined()
    expect(screen.getByText('current')).toBeDefined()

    await userEvent.click(screen.getByText('v2'))
    expect(storeState.requestRevisionLoad).toHaveBeenCalledWith('rev-2')
  })
})
