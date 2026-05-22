// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'

const { storeState, mockListArtifacts, mockListRevisions } = vi.hoisted(() => ({
  storeState: {
    artifact: null as Artifact | null,
    headRevision: null as ArtifactRevision | null,
    requestArtifactLoad: vi.fn(async () => undefined),
  },
  mockListArtifacts: vi.fn<() => Promise<Artifact[]>>(),
  mockListRevisions:
    vi.fn<(...args: unknown[]) => Promise<ArtifactRevision[]>>(),
}))

vi.mock('@/components/editor/artifactStore', () => ({
  useArtifactStore: (selector: (s: typeof storeState) => unknown) =>
    selector(storeState),
}))

vi.mock('@/lib/db/repositories/documents', () => ({
  listArtifacts: () => mockListArtifacts(),
}))

vi.mock('@/lib/db/repositories/revisions', () => ({
  listRevisions: (...args: unknown[]) => mockListRevisions(...args),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    disabled,
    ...props
  }: {
    children: ReactNode
    disabled?: boolean
  }) => (
    <button type='button' disabled={disabled} {...props}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
  }) => (
    <button
      type='button'
      disabled={disabled}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

import { ArtifactMenu } from '../ArtifactMenu'

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'art-1',
    conversation_id: 'conv-1',
    title: 'Draft',
    current_revision_id: 'rev-1',
    file_path: null,
    file_hash: null,
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  }
}

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
  storeState.artifact = null
  storeState.headRevision = null
})

describe('ArtifactMenu', () => {
  it('lists artifacts for the active conversation and opens the selected artifact', async () => {
    const activeArtifact = makeArtifact({ title: 'Active artifact' })
    const otherArtifact = makeArtifact({
      id: 'art-2',
      title: 'Second artifact',
      current_revision_id: 'rev-2',
      updated_at: 2000,
    })
    storeState.artifact = activeArtifact
    storeState.headRevision = makeRevision()
    mockListArtifacts.mockResolvedValue([activeArtifact, otherArtifact])
    mockListRevisions.mockImplementation(async (artifactId) =>
      artifactId === 'art-2'
        ? [makeRevision({ id: 'rev-2', artifact_id: 'art-2' })]
        : [makeRevision()]
    )

    render(<ArtifactMenu />)

    await waitFor(() => {
      expect(screen.getByText('Second artifact')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('Second artifact'))

    expect(storeState.requestArtifactLoad).toHaveBeenCalledWith('art-2')
  })
})
